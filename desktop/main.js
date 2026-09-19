/**
 * Soundwave AI — Assistant Desktop App (Electron main process)
 *
 * Shows ONLY the Soundwave assistant (the S.O.U.N.D.W.A.V.E command-deck HUD),
 * while the full website — Express API + built frontend — keeps running in the
 * background. The assistant's 1-Click Viral Short generator renders real MP4s
 * through that background server + FFmpeg, exactly like on the web.
 *
 * Run:   cd desktop && npm install && npm start
 */

const path = require("node:path");
const { app, BrowserWindow, session, shell, Menu, ipcMain } = require("electron");
const { ServerSupervisor, REPO_ROOT } = require("./serverSupervisor");

// Packaged resources (electron-builder "extraResources") vs. dev checkout.
const isPackaged = app.isPackaged;
const resourcesDir = isPackaged ? process.resourcesPath : null;
const webDistDir = isPackaged
  ? path.join(resourcesDir, "web", "dist")
  : path.join(REPO_ROOT, "frontend", "dist");

const ALLOWED_ORIGIN_PREFIXES = []; // filled once the supervisor knows the port
let allowedOrigin = null;
let supervisor = null;
let mainWindow = null;

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: "#070B14",
    title: "Soundwave Assistant",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  // Keep the app shell self-contained: no in-window site hopping…
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (allowedOrigin && !url.startsWith(allowedOrigin)) {
      event.preventDefault();
      shell.openExternal(url).catch(() => undefined);
    }
  });
  // …and every new window/target=_blank goes to the user's real browser.
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target).catch(() => undefined);
    return { action: "deny" };
  });

  // Finished exports (Download 9:16 Short) save straight to Downloads.
  session.defaultSession.on("will-download", (_event, item) => {
    const downloads = app.getPath("downloads");
    item.savePath = path.join(downloads, item.getFilename());
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  void mainWindow.loadURL(url);
}

// Mic/screen permissions for the assistant's vision + Creator Studio tools.
function configurePermissions() {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    const allowed = ["media", "audioCapture", "display-capture", "fullscreen", "notifications"];
    callback(allowed.includes(permission));
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  ipcMain.on("soundwave:quit", () => app.quit());

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null); // chromeless assistant window
    configurePermissions();

    supervisor = new ServerSupervisor();
    try {
      const baseUrl = await supervisor.start({
        resourcesDir,
        // Packaged layout: extraResources puts the API at <resources>/server.
        serverDir: isPackaged ? path.join(resourcesDir, "server") : null,
        userDataDir: isPackaged ? app.getPath("userData") : null,
      });
      allowedOrigin = baseUrl;
      ALLOWED_ORIGIN_PREFIXES.push(baseUrl);
      createWindow(`${baseUrl}/agent-desktop`);
    } catch (err) {
      const { dialog } = require("electron");
      dialog.showErrorBox(
        "Soundwave Assistant could not start",
        `${err.message}\n\nThe website backend runs in the background and could not be reached. ` +
          `Try:\n  cd server && npm install && npm run build\nthen relaunch the assistant.`,
      );
      app.quit();
    }
  });

  app.on("window-all-closed", () => {
    // Quit entirely — the background website belongs to this app's lifecycle.
    app.quit();
  });

  app.on("before-quit", () => {
    supervisor?.stop();
  });
}
