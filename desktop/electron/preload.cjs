const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("companion", {
  isElectron: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  hide: () => ipcRenderer.send("companion:hide"),
  toggle: () => ipcRenderer.send("companion:toggle"),
  quit: () => ipcRenderer.send("companion:quit"),
  openExternal: (url) => ipcRenderer.send("companion:open-external", url),
  onVisibility: (cb) => {
    const handler = (_evt, visible) => cb(Boolean(visible));
    ipcRenderer.on("companion:visibility", handler);
    return () => ipcRenderer.removeListener("companion:visibility", handler);
  },
});
