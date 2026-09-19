/**
 * Soundwave AI — Assistant Desktop App preload
 * Minimal, contextIsolation-safe bridge. The assistant page is an ordinary
 * web app that talks to the background website over same-origin HTTP, so the
 * bridge only exposes harmless desktop metadata.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("soundwaveDesktop", {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  quit: () => ipcRenderer.send("soundwave:quit"),
});
