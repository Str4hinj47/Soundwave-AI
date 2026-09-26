/**
 * Soundwave Companion — Electron shell
 *
 * Mirrors the heytaby.com experience:
 *  - Frameless, transparent panel that hangs from the TOP CENTER of the screen
 *  - Drops down / tucks away with a slide animation
 *  - Hover the top edge of the screen to reveal it; move away and it hides
 *  - Global shortcut: Ctrl + Alt + Space  (Cmd + Option + Space on macOS)
 *  - Tray menu (Show / Hide / Quit), no dock icon, skips the taskbar
 */
const { app, BrowserWindow, globalShortcut, Tray, Menu, screen, ipcMain, shell, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");

const DEV_URL = process.env.VITE_DEV_SERVER_URL || "";
const PANEL_WIDTH = 472;
const MAX_PANEL_HEIGHT = 780;
const HOVER_EDGE = 4; // px from the top of the primary display
const HIDE_AFTER_MS = 850;

let win = null;
let tray = null;
let visible = false;
let sliding = false;
let hideDeadline = 0;
let hideTimer = null;

function panelBounds() {
  const { workArea } = screen.getPrimaryDisplay();
  const height = Math.min(MAX_PANEL_HEIGHT, Math.round(workArea.height * 0.94));
  const x = Math.round(workArea.x + (workArea.width - PANEL_WIDTH) / 2);
  return { x, y: workArea.y, width: PANEL_WIDTH, height };
}

function createWindow() {
  const bounds = panelBounds();
  win = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (DEV_URL) {
    win.loadURL(DEV_URL);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  win.on("blur", () => {
    // Clicking the desktop away from the panel tucks it back in.
    scheduleHide(350);
  });
}

function isInsidePanel(pt, margin = 10) {
  const b = win.getBounds();
  return (
    pt.x >= b.x - margin &&
    pt.x <= b.x + b.width + margin &&
    pt.y >= b.y - margin &&
    pt.y <= b.y + b.height + margin
  );
}

function animateTo(targetY, done) {
  if (!win || sliding) return;
  sliding = true;
  const fromY = win.getPosition()[1];
  const steps = 8;
  let i = 0;
  const tick = () => {
    if (!win || win.isDestroyed()) {
      sliding = false;
      return;
    }
    i += 1;
    const t = i / steps;
    const eased = 1 - Math.pow(1 - t, 3);
    const y = Math.round(fromY + (targetY - fromY) * eased);
    const [x] = win.getPosition();
    win.setPosition(x, y, false);
    if (i >= steps) {
      sliding = false;
      if (done) done();
    } else {
      setTimeout(tick, 14);
    }
  };
  tick();
}

function showPanel(focus = false) {
  if (!win || visible || sliding) return;
  clearTimeout(hideTimer);
  hideDeadline = 0;
  const b = panelBounds();
  win.setBounds({ ...b, y: b.y - b.height - 8 }, false);
  if (focus) {
    win.show();
    win.focus();
  } else {
    win.showInactive();
  }
  animateTo(b.y, () => {
    visible = true;
    win?.webContents.send("companion:visibility", true);
  });
}

function hidePanel() {
  if (!win || !visible || sliding) return;
  clearTimeout(hideTimer);
  hideDeadline = 0;
  const b = panelBounds();
  animateTo(b.y - b.height - 8, () => {
    visible = false;
    if (win && !win.isDestroyed()) win.hide();
  });
}

function togglePanel(focus = true) {
  if (!win) return;
  if (win.isVisible() && win.isFocused()) hidePanel();
  else showPanel(focus);
}

function scheduleHide(ms) {
  clearTimeout(hideTimer);
  hideDeadline = Date.now() + ms;
  hideTimer = setTimeout(() => {
    if (!win || !visible || sliding) return;
    const pt = screen.getCursorScreenPoint();
    if (!isInsidePanel(pt, 6)) hidePanel();
    else scheduleHide(HIDE_AFTER_MS);
  }, ms);
}

function startHoverWatcher() {
  // When tucked away, hovering the top edge of the screen drops the panel down.
  // When visible, moving the mouse off the panel tucks it away.
  setInterval(() => {
    if (!win || win.isDestroyed() || sliding) return;
    const pt = screen.getCursorScreenPoint();
    if (!win.isVisible()) {
      if (pt.y <= HOVER_EDGE) showPanel();
      return;
    }
    if (!visible) return;
    const inside = isInsidePanel(pt, 8);
    if (inside) {
      if (hideDeadline) {
        clearTimeout(hideTimer);
        hideDeadline = 0;
      }
    } else if (!hideDeadline) {
      scheduleHide(HIDE_AFTER_MS);
    }
  }, 240);
}

function createTray() {
  const iconPath = path.join(__dirname, "tray.png");
  const image = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip("Soundwave Companion");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Show Companion", click: () => showPanel(true) },
      { label: "Hide Companion", click: () => hidePanel() },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ])
  );
  tray.on("double-click", togglePanel);
}

function devServerReady(url) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok) => {
      if (!settled) {
        settled = true;
        resolve(ok);
      }
    };
    try {
      const req = http.get(url, (res) => {
        res.resume();
        done(true);
      });
      req.on("error", () => done(false));
      req.setTimeout(700, () => {
        req.destroy();
        done(false);
      });
    } catch {
      done(false);
    }
  });
}

async function loadRenderer() {
  if (DEV_URL) {
    // Wait briefly for the Vite dev server spawned by scripts/electron-dev.mjs
    for (let i = 0; i < 60; i += 1) {
      if (await devServerReady(DEV_URL)) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    win.loadURL(DEV_URL).catch(() => win.loadFile(path.join(__dirname, "..", "dist", "index.html")));
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showPanel(true);
  });

  app.whenReady().then(() => {
    if (app.dock) app.dock.hide(); // live in the tray, like a buddy should
    createWindow();
    createTray();
    loadRenderer();
    startHoverWatcher();

    globalShortcut.register("CommandOrControl+Alt+Space", () => togglePanel(true));

    ipcMain.on("companion:hide", () => hidePanel());
    ipcMain.on("companion:toggle", () => togglePanel(true));
    ipcMain.on("companion:quit", () => app.quit());
    ipcMain.on("companion:open-external", (_evt, url) => {
      if (typeof url === "string" && /^(https?:|mailto:)/i.test(url)) shell.openExternal(url);
    });

    // Drop the panel down on launch, without stealing focus.
    setTimeout(() => showPanel(false), 250);
  });

  app.on("will-quit", () => globalShortcut.unregisterAll());
}
