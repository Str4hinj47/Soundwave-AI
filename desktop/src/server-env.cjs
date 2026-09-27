// Shared bootstrap for the bundled Soundwave server.
// Used by BOTH the Electron main process (src/main.js) and the standalone
// smoke test (smoke.mjs) — one source of truth for how a packaged install
// configures the API: loopback-only bind, user-data folders, generated JWT
// secrets, bundled ffmpeg/yt-dlp, SPA served from WEB_DIST.
"use strict";

const path = require("node:path");
const fs = require("node:fs");
const net = require("node:net");
const crypto = require("node:crypto");

/** Ask the OS for a free loopback port. */
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => (port ? resolve(port) : reject(new Error("could not allocate a port"))));
    });
  });
}

function loadSecrets(secretsFile) {
  let secrets = {};
  try {
    secrets = JSON.parse(fs.readFileSync(secretsFile, "utf8"));
  } catch {
    /* first run */
  }
  if (!secrets.jwtAccess || !secrets.jwtRefresh) {
    secrets = {
      jwtAccess: crypto.randomBytes(32).toString("hex"),
      jwtRefresh: crypto.randomBytes(32).toString("hex"),
    };
    try {
      fs.mkdirSync(path.dirname(secretsFile), { recursive: true });
      fs.writeFileSync(secretsFile, JSON.stringify(secrets, null, 2), { mode: 0o600 });
    } catch (err) {
      console.warn("[soundwave-desktop] could not persist secrets:", err.message);
    }
  }
  return secrets;
}

/**
 * Apply the packaged-mode environment and chdir into the bundled server.
 * Returns { serverRoot, appUrl, port } once configured (server not started yet).
 *
 * Layout (both installed and unpackaged):
 *   appRoot/
 *     server/        package.json, dist/, node_modules/   (assembled)
 *     frontend/dist/ built SPA served at WEB_DIST
 *     scripts/assets bundled static assets (music, …)
 *   binDir/
 *     ffmpeg.exe, yt-dlp.exe                              (runtime binaries)
 */
async function applyServerEnv({ appRoot, binDir, userDataDir }) {
  const serverRoot = path.join(appRoot, "server");
  const webDist = path.join(appRoot, "frontend", "dist");

  if (!fs.existsSync(path.join(serverRoot, "dist", "index.js"))) {
    throw new Error(`Bundled server build not found at ${path.join(serverRoot, "dist", "index.js")}`);
  }
  if (!fs.existsSync(path.join(webDist, "index.html"))) {
    throw new Error(`Bundled frontend build not found at ${path.join(webDist, "index.html")}`);
  }

  fs.mkdirSync(userDataDir, { recursive: true });
  const secrets = loadSecrets(path.join(userDataDir, "secrets.json"));
  const port = await getFreePort();
  const appUrl = `http://127.0.0.1:${port}`;

  const dataDir = path.join(userDataDir, "data");
  const env = {
    NODE_ENV: "production",
    PORT: String(port),
    // Loopback only — the local API is never exposed to the LAN.
    BIND_HOST: "127.0.0.1",
    APP_URL: appUrl,
    CORS_ORIGINS: appUrl,
    DATA_DIR: dataDir,
    // Uploads (incl. YouTube link imports) and the agent's Orbital NCG history
    // live in the user-data folder, never the install directory.
    UPLOADS_DIR: path.join(userDataDir, "uploads"),
    WEB_DIST: webDist,
    JWT_ACCESS_SECRET: secrets.jwtAccess,
    JWT_REFRESH_SECRET: secrets.jwtRefresh,
  };

  // Only point at bundled binaries that actually exist; otherwise let the
  // server's own resolver fall back to vendor/PATH with a clear boot warning.
  const isWin = process.platform === "win32";
  const ffmpegBin = path.join(binDir, isWin ? "ffmpeg.exe" : "ffmpeg");
  const ytdlpBin = path.join(binDir, isWin ? "yt-dlp.exe" : "yt-dlp");
  if (fs.existsSync(ffmpegBin)) env.FFMPEG_PATH = ffmpegBin;
  if (fs.existsSync(ytdlpBin)) env.YTDLP_PATH = ytdlpBin;

  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  process.chdir(serverRoot);

  return { serverRoot, webDist, appUrl, port, dataDir };
}

module.exports = { applyServerEnv, getFreePort, loadSecrets };
