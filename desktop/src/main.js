// Soundwave AI — desktop shell.
//
// Boots the bundled Express server IN-PROCESS (all dependencies are pure JS),
// then opens the Command Center in a native window. No terminal, no .bat, no admin
// prompts — everything a customer needs ships in the installer. The one
// runtime download is yt-dlp keeping its user-data copy current (YouTube
// breaks old builds), and yt-dlp's JavaScript runtime is this very binary
// running as Node (ELECTRON_RUN_AS_NODE — see server/src/lib/jsRuntime.ts).
"use strict";

const { app, BrowserWindow, shell, dialog } = require("electron");
const path = require("node:path");
const http = require("node:http");
const { pathToFileURL } = require("node:url");
const { applyServerEnv } = require("./server-env.cjs");

// ── Child-process hygiene ────────────────────────────────────────────────────
// The server spawns ffmpeg / yt-dlp helpers. A GUI app on Windows would flash
// a console window for each of those unless windowsHide is set — patch the
// builtins ONCE, before the server is imported. (ESM named imports of
// node:child_process reflect the patched CJS exports.)
const cp = require("node:child_process");
const wrapHide = (fn) =>
  function (...args) {
    const last = args.length - 1;
    if (last >= 0 && args[last] && typeof args[last] === "object" && !Array.isArray(args[last])) {
      args[last] = { windowsHide: true, ...args[last] };
    }
    return fn.apply(this, args);
  };
for (const name of ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"]) {
  if (typeof cp[name] === "function") cp[name] = wrapHide(cp[name]);
}

let mainWindow = null;
let serverStarted = false;

function pollHealth(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const attempt = () => {
      const req = http.get(`${url}/api/health`, (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      });
      req.on("error", () => {
        if (Date.now() > deadline) return resolve(false);
        setTimeout(attempt, 300);
      });
      req.setTimeout(2000, () => {
        req.destroy();
        if (Date.now() > deadline) resolve(false);
        else setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: "#0a0e17",
    title: "Soundwave AI",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "..", "build", "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);

  // Never let the shell wander off-origin or open arbitrary windows.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "https:" || parsed.protocol === "http:" || parsed.protocol === "mailto:") {
        shell.openExternal(url);
      }
    } catch {
      /* ignore malformed urls */
    }
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(serverUrl)) {
      event.preventDefault();
      shell.openExternal(url).catch(() => {});
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  return mainWindow;
}

let serverUrl = "";

async function main() {
  // Single instance — a second launch focuses the running window.
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  const appRoot = path.join(__dirname, "..", "app");
  const binDir = app.isPackaged
    ? path.join(process.resourcesPath, "bin")
    : path.join(__dirname, "..", "bin");
  const userDataDir = app.getPath("userData");

  const { appUrl } = await applyServerEnv({ appRoot, binDir, userDataDir, autoUpdateYtDlp: true });
  serverUrl = appUrl;

  // Import the bundled server (ESM) — this starts listening on loopback.
  await import(pathToFileURL(path.join(appRoot, "server", "dist", "index.js")).href);
  serverStarted = true;

  const win = createWindow();
  const healthy = await pollHealth(appUrl, 45_000);
  if (!healthy) {
    console.error("[soundwave-desktop] server health check timed out; loading anyway");
  }
  await win.loadURL(appUrl);
  win.show();
}

app.whenReady().then(() =>
  main().catch((err) => {
    console.error("[soundwave-desktop] fatal:", err);
    dialog.showErrorBox(
      "Soundwave AI couldn't start",
      `${err && err.message ? err.message : String(err)}\n\n` +
        "Try restarting the app. If it keeps happening, reinstalling the app usually fixes it.",
    );
    app.quit();
  }),
);

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  // Server runs in-process — quitting the app stops the API with it.
  if (serverStarted) console.log("[soundwave-desktop] shutting down");
});
