# Releasing Soundwave AI for Windows

How the sellable desktop app gets built, what customers see, and what it takes
to be fully "no warnings" on Windows.

## TL;DR

```bash
git tag v1.0.0
git push origin v1.0.0          # CI builds the Windows installers
gh run watch                    # or watch the Actions tab
gh run download -n soundwave-ai-windows -D dist/
```

**Test builds without releasing:** every push to a branch that changes the
app (`server/`, `frontend/`, `desktop/`, `scripts/assets/`, or the workflow)
runs the same build and attaches the installers to that Actions run as the
`soundwave-ai-windows` artifact — nothing is published. Only `v*` tags create
a GitHub Release.

CI (GitHub Actions, `windows-latest`) runs: typecheck + tests → frontend
build → downloads ffmpeg and the **nightly** yt-dlp into `desktop/bin/` →
assembles the app tree → **smoke-tests the real assembled app on Windows** →
`electron-builder` → **verifies the packaged exe works as yt-dlp's JavaScript
runtime** (`desktop/verify-runtime.mjs`) → produces:

| Artifact | What it is |
| --- | --- |
| `SoundwaveAI-Setup-1.0.0.exe` | NSIS installer: Start Menu + desktop shortcut, per-user (no admin/UAC), uninstaller |
| `SoundwaveAI-Portable-1.0.0.exe` | Single portable exe — double-click, nothing to install |

The customer needs **nothing preinstalled**: no Node, no Python, no ffmpeg,
no terminal, no `.bat`. Node runtime (inside Electron), ffmpeg, and yt-dlp all
ship in the package; first run generates its own JWT secrets and uses
`%APPDATA%\Soundwave AI\` for all data.

## YouTube import (yt-dlp) in the desktop app

YouTube changes regularly break older yt-dlp builds (e.g. "The page needs to
be reloaded", Aug 2026), so the desktop app handles yt-dlp specially:

- **Self-updating copy.** yt-dlp runs from
  `%APPDATA%\Soundwave AI\bin\yt-dlp.exe`, copied from the installer on first
  run (and again when an app update ships a newer build). Each start, the
  server updates that copy to yt-dlp's **nightly** channel in the background
  (`YTDLP_AUTO_UPDATE=nightly`); imports wait for the update so none races the
  exe being replaced. Customers get YouTube fixes by restarting the app — no
  new release needed. Set `YTDLP_AUTO_UPDATE=off` (or `stable`) in the
  environment to change that.
- **Built-in JavaScript runtime.** yt-dlp needs Node 22+ or Deno to solve
  YouTube's JS challenges. The app hands yt-dlp its own exe with
  `ELECTRON_RUN_AS_NODE=1` (Electron then behaves as plain Node), after a
  startup probe that replays yt-dlp's exact commands; if that fails it falls
  back to a node/deno on PATH. **Keep Electron's RunAsNode fuse enabled** —
  CI's verify step fails the build otherwise.
- The server log shows both: `[yt-dlp] self-update: …` and
  `[yt-dlp] JavaScript runtime: this app running as Node v… (Electron …)`.

## Local build (any OS with network access)

```bash
cd server   && npm ci && npm run build
cd ../frontend && npm ci && npm run build
cd ../desktop && npm ci && node assemble.mjs && node smoke.mjs
npx electron-builder --win        # needs network: downloads Electron + NSIS tools
```

`node smoke.mjs` boots the assembled app exactly like the desktop shell does
and asserts health, SPA serving, history fallback, and API behavior.

## SmartScreen & code signing (read this before selling)

What this repo already guarantees (no extra action needed):

- **No `.bat` / PowerShell downloaders** anywhere in the customer path.
- **No console windows** (child processes spawn with `windowsHide`).
- **No admin/UAC prompt** (`requestedExecutionLevel: asInvoker`).
- **No runtime `npm install`** — binaries are in the installer, fetched at
  build time. The one deliberate runtime download is yt-dlp updating its own
  copy in `%APPDATA%\Soundwave AI\bin\` (see above) — the same thing every
  yt-dlp front-end does, because YouTube breaks old versions within weeks.
- Proper exe metadata (product name, version, icon, company copyright).

What **no app can avoid without a certificate**: Windows SmartScreen shows
"Windows protected your PC" for **unsigned** executables, no matter the
stack (.NET, Electron, anything). Options, best first:

1. **Code-signing certificate (recommended for selling).** Buy an OV or EV
   code-signing cert from a public CA (DigiCert, Sectigo, SSL.com, Certum —
   ~$70–400/yr; EV used to be required for instant SmartScreen reputation,
   OV now accrues reputation after downloads). Export it as a `.pfx`, then:
   ```bash
   base64 -w0 your.pfx > pfx.b64          # or: certutil -encode your.pfx pfx.b64
   gh secret set CSC_LINK      --body "$(cat pfx.b64)"
   gh secret set CSC_KEY_PASSWORD --body "your-pfx-password"
   ```
   The next tagged build is signed automatically (electron-builder standard
   env vars) — installer and portable exe both.
2. **Microsoft Store** ($19 one-time dev account): Store-delivered apps are
   Microsoft-signed — zero SmartScreen prompts, no cert purchase.
3. **Unsigned**: buyers click "More info → Run anyway" once; SmartScreen
   reputation then accrues per-file.

Before selling, upload the final exe to https://www.virustotal.com once and
check for false positives — unsigned new files sometimes get heuristic flags
that vanish after signing.

## Versioning

Bump `desktop/package.json` → `version` (this drives artifact names), tag
`vX.Y.Z`, push the tag. Release notes are generated automatically.
