/**
 * Soundwave AI — Desktop Server Supervisor
 *
 * Boots the full Soundwave website in the background for the desktop app:
 *   1. Prepares server/.env (generates JWT secrets on first run)
 *   2. Picks a free localhost port
 *   3. Spawns the Express API (built dist, or tsx from source in dev)
 *      with the vendored ffmpeg/yt-dlp wired in
 *   4. Waits for /api/health — after that the API also serves the built
 *      frontend, so the desktop shell can simply load /agent-desktop
 *      (the assistant-only view) from http://127.0.0.1:<port>
 *
 * This module is plain Node (no Electron imports) so it can be smoke-tested
 * headlessly:  node serverSupervisor.js --smoke
 */

const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_SERVER_DIR = path.join(REPO_ROOT, "server");

const DEFAULT_PORT = 4177; // dev-server-friendly: 4000 stays free for `npm run dev`

// ── helpers ─────────────────────────────────────────────────────────────────
function log(msg) {
  console.log(`[soundwave-desktop] ${msg}`);
}

function findFfmpeg(resourcesDir) {
  const candidates = [
    resourcesDir ? path.join(resourcesDir, "bin", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg") : null,
    path.join(REPO_ROOT, "vendor", "ffmpeg", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"),
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      fs.accessSync(c, fs.constants.X_OK);
      return c;
    } catch {
      /* keep looking */
    }
  }
  return null; // config.ts then falls back to PATH (e.g. `winget install ffmpeg`)
}

function findYtDlp(resourcesDir) {
  const name = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
  const candidates = [
    resourcesDir ? path.join(resourcesDir, "bin", name) : null,
    path.join(REPO_ROOT, "vendor", "yt-dlp", name),
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      fs.accessSync(c, fs.constants.X_OK);
      return c;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

/** Create server/.env on first run so the API boots without manual setup. */
function ensureServerEnv(serverDir) {
  const envPath = path.join(serverDir, ".env");
  if (fs.existsSync(envPath)) return;

  const templatePath = path.join(serverDir, ".env.example");
  let body = fs.existsSync(templatePath)
    ? fs.readFileSync(templatePath, "utf8")
    : "NODE_ENV=development\n";

  const secret = () => crypto.randomBytes(32).toString("hex");
  body = body
    .replace(/^JWT_ACCESS_SECRET=.*$/m, `JWT_ACCESS_SECRET=${secret()}`)
    .replace(/^JWT_REFRESH_SECRET=.*$/m, `JWT_REFRESH_SECRET=${secret()}`)
    .replace(/^CORS_ORIGINS=.*$/m, "CORS_ORIGINS=");
  if (!/^JWT_ACCESS_SECRET=/m.test(body)) body += `\nJWT_ACCESS_SECRET=${secret()}\n`;
  if (!/^JWT_REFRESH_SECRET=/m.test(body)) body += `\nJWT_REFRESH_SECRET=${secret()}\n`;

  fs.writeFileSync(envPath, body, "utf8");
  log("created server/.env with fresh JWT secrets");
}

function pickFreePort(preferred) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(pickFreePort(0)));
    srv.listen(preferred || 0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function waitForHealth(port, timeoutMs = 60_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get({ host: "127.0.0.1", port, path: "/api/health", timeout: 2_000 }, (res) => {
        res.resume();
        if (res.statusCode === 200) {
          resolve(true);
          return;
        }
        retry();
      });
      req.on("error", retry);
      req.on("timeout", () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Soundwave server did not become healthy on port ${port} within ${timeoutMs / 1000}s`));
        return;
      }
      setTimeout(attempt, 500);
    };
    attempt();
  });
}

// ── supervisor ──────────────────────────────────────────────────────────────
class ServerSupervisor {
  /**
   * @param {{ serverDir?: string|null }} paths — override for packaged layouts
   *        (electron-builder puts the API at <resources>/server/...).
   */
  constructor(paths = {}) {
    this.serverDir = paths.serverDir || DEFAULT_SERVER_DIR;
    this.distEntry = path.join(this.serverDir, "dist", "index.js");
    this.srcEntry = path.join(this.serverDir, "src", "index.ts");
    this.txCli = path.join(this.serverDir, "node_modules", "tsx", "dist", "cli.mjs");
    this.child = null;
    this.port = null;
    this.stopped = false;
  }

  get baseUrl() {
    return this.port ? `http://127.0.0.1:${this.port}` : null;
  }

  /**
   * Boot the website (API + built frontend) in the background.
   * @param {{ resourcesDir?: string, userDataDir?: string, port?: number }} opts
   */
  async start(opts = {}) {
    ensureServerEnv(this.serverDir);

    const port = opts.port || (await pickFreePort(DEFAULT_PORT));
    this.port = port;

    const resourcesDir = opts.resourcesDir || null;
    const ffmpeg = findFfmpeg(resourcesDir);
    const ytdlp = findYtDlp(resourcesDir);

    // Persistent app data lives outside the code tree when packaged.
    const dataRoot = opts.userDataDir || this.serverDir;
    const env = {
      ...process.env,
      PORT: String(port),
      NODE_ENV: process.env.NODE_ENV || "development",
      DATA_DIR: path.join(dataRoot, "data"),
      UPLOADS_DIR: path.join(dataRoot, "uploads"),
      // The API auto-serves ../frontend/dist; packaged builds copy it into
      // resources/web/dist — point the server at it explicitly.
      SOUNDWAVE_RESOURCES_DIR: resourcesDir || "",
      ...(ffmpeg ? { FFMPEG_PATH: ffmpeg } : {}),
      ...(ytdlp ? { YTDLP_PATH: ytdlp } : {}),
    };

    // On packaged builds there is no system `node` — reuse Electron's binary
    // in plain-Node mode (ELECTRON_RUN_AS_NODE) so the same code path works.
    let command;
    let args;
    if (fs.existsSync(this.distEntry)) {
      args = [this.distEntry];
      command = process.versions.electron ? process.execPath : "node";
      if (process.versions.electron) env.ELECTRON_RUN_AS_NODE = "1";
      log(`starting API from dist on port ${port}`);
    } else if (fs.existsSync(this.txCli)) {
      command = process.versions.electron ? process.execPath : "node";
      if (process.versions.electron) env.ELECTRON_RUN_AS_NODE = "1";
      args = [this.txCli, this.srcEntry];
      log(`starting API from source (tsx) on port ${port}`);
    } else {
      throw new Error(
        "The Soundwave server is not built. Run `cd server && npm install && npm run build` first (or `npm install` so tsx is available for dev mode).",
      );
    }

    this.child = spawn(command, args, {
      cwd: this.serverDir,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    const forward = (buf) => {
      const text = buf.toString();
      if (this.stopped) return;
      for (const line of text.split("\n").filter(Boolean)) log(`[api] ${line}`);
    };
    this.child.stdout.on("data", forward);
    this.child.stderr.on("data", forward);
    this.child.on("exit", (code) => {
      if (!this.stopped) log(`API process exited unexpectedly (code ${code})`);
    });

    await waitForHealth(port);
    log(`website is up in the background: ${this.baseUrl}`);
    return this.baseUrl;
  }

  stop() {
    this.stopped = true;
    if (!this.child || this.child.exitCode !== null) return;
    log("stopping background website…");
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(this.child.pid), "/T", "/F"], { windowsHide: true });
      } else {
        this.child.kill("SIGTERM");
        const child = this.child;
        setTimeout(() => {
          if (child.exitCode === null) child.kill("SIGKILL");
        }, 3_000).unref?.();
      }
    } catch {
      /* already gone */
    }
  }
}

module.exports = { ServerSupervisor, REPO_ROOT, ensureServerEnv };

// ── headless smoke test: node serverSupervisor.js --smoke ───────────────────
if (require.main === module && process.argv.includes("--smoke")) {
  (async () => {
    const supervisor = new ServerSupervisor();
    const url = await supervisor.start();
    const page = await new Promise((resolve, reject) => {
      http
        .get(`${url}/agent-desktop`, { headers: { accept: "text/html" } }, (res) => {
          let body = "";
          res.on("data", (d) => (body += d));
          res.on("end", () => resolve({ status: res.statusCode, body }));
        })
        .on("error", reject);
    });
    const spaOk = page.status === 200 && page.body.includes("<div id=\"root\">");
    const health = await new Promise((resolve, reject) => {
      http
        .get(`${url}/api/health`, (res) => {
          let body = "";
          res.on("data", (d) => (body += d));
          res.on("end", () => resolve({ status: res.statusCode, body }));
        })
        .on("error", reject);
    });
    console.log(`SMOKE spa: ${spaOk ? "OK" : "FAIL"} (${page.status})`);
    console.log(`SMOKE health: ${health.status === 200 ? "OK" : "FAIL"} ${health.body}`);
    console.log(`DESKTOP_READY ${url}`);
    supervisor.stop();
    process.exit(spaOk && health.status === 200 ? 0 : 1);
  })().catch((err) => {
    console.error("SMOKE FAILED:", err.message);
    process.exit(1);
  });
}
