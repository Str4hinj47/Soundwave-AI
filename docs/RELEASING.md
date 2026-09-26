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

CI (GitHub Actions, `windows-latest`) runs: typecheck + tests → frontend
build → downloads ffmpeg/yt-dlp into `desktop/bin/` → assembles the app tree
→ **smoke-tests the real assembled app on Windows** → `electron-builder`
produces:

| Artifact | What it is |
| --- | --- |
| `SoundwaveAI-Setup-1.0.0.exe` | NSIS installer: Start Menu + desktop shortcut, per-user (no admin/UAC), uninstaller |
| `SoundwaveAI-Portable-1.0.0.exe` | Single portable exe — double-click, nothing to install |

The customer needs **nothing preinstalled**: no Node, no Python, no ffmpeg,
no terminal, no `.bat`. Node runtime (inside Electron), ffmpeg, and yt-dlp all
ship in the package; first run generates its own JWT secrets and uses
`%APPDATA%\Soundwave AI\` for all data.

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
- **No runtime `npm install` / downloads of executables** — binaries are in
  the installer, fetched at build time.
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
