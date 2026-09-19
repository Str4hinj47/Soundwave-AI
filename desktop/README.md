# Soundwave Assistant — Desktop App

A native desktop window that shows **only the Soundwave assistant** (the
`S.O.U.N.D.W.A.V.E` command-deck HUD with the arc-reactor orb, conversation
stream, macros, and the 1-Click Viral Short generator) — none of the website
chrome. The full website still runs in the background: an Electron supervisor
boots the Express API (which then also serves the built frontend) on a free
localhost port and points a chromeless window at `/agent-desktop`.

Everything keeps working exactly like on the web — including **real video
generation**: the assistant's short generator renders 9:16 MP4s through the
background server + FFmpeg (the vendored `vendor/ffmpeg` binary is wired in
automatically; on a fresh machine `winget install ffmpeg` also works), and the
finished short downloads straight to your `Downloads` folder.

```
┌───────────────────────────────┐
│  Soundwave Assistant (Electron)│
│   ┌─────────────────────────┐ │
│   │  /agent-desktop  (HUD)  │ │
│   └────────────▲────────────┘ │
│                │ same-origin  │
│   ┌────────────┴────────────┐ │
│   │ Express API :<free port>│ │
│   │  + built frontend (SPA) │ │
│   │  + FFmpeg / yt-dlp      │ │
│   └─────────────────────────┘ │
└───────────────────────────────┘
```

## Run it (development)

```bash
# 1. Build the pieces the desktop app loads (once, or after changes)
cd frontend && npm install && npm run build
cd ../server  && npm install && npm run build

# 2. Launch the assistant desktop app
cd ../desktop && npm install && npm start
```

The Electron binary downloads from GitHub releases on `npm install`. If your
network blocks it, everything else can still be exercised headlessly:

```bash
cd desktop && npm run smoke
# → boots the background website and verifies the assistant-only SPA loads:
#   SMOKE spa: OK (200) / SMOKE health: OK … / DESKTOP_READY http://127.0.0.1:4177
```

## Package installers (optional)

```bash
cd desktop
npm run build:all    # frontend + server dist
npm run dist         # electron-builder → desktop/release/ (dmg / nsis / AppImage)
```

`electron-builder` config in `desktop/package.json` bundles the built frontend
(`web/dist`), the compiled API (`server/dist` + `node_modules` + `prisma`),
and the vendored `vendor/ffmpeg` + `vendor/yt-dlp` binaries as resources, so
the packaged app is self-contained. App data (JSON store, uploads, exports)
is written to the OS user-data directory, never into the install folder.

## Notes

- The window is locked to the local app origin; external links open in the
  user's real browser and exports land in `Downloads`.
- Single-instance: launching the app twice focuses the existing window.
- JWT secrets are generated automatically into `server/.env` on first run.
- Quitting the window stops the background website (it belongs to the app).
- The Python HUD (`soundwave-agent/ui.py`, `soundwave_agent.py --gui`) remains
  available as a lightweight alternative, but this Electron app is the
  full-fidelity desktop experience of the web assistant.
