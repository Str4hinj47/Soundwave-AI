# Soundwave AI

**An AI agent that writes, narrates and renders viral shorts.**

The app opens on the agent's **Command Center**. Press Generate — or tell the
agent "make a short about…" — and it writes the script, narrates it in a
**Soundwave voice** (Microsoft's neural voices via the free, key-less Edge TTS
service), burns word-by-word captions, and renders it over an Orbital NCG
gameplay video it hasn't used before. The agent is the only thing in the app
that makes videos; it also answers in the chat, out loud, in the same voice.

**Talk to it.** Tap the mic in the Command Center (or hold it to talk) — or,
in the desktop app, press **Ctrl+Shift+Space** from any app: a small voice bar
pops up above the taskbar, listens, and answers out loud. Speech is recognized
**on your PC** by [whisper.cpp](https://github.com/ggml-org/whisper.cpp) with a
bundled English model — no account, no API key, nothing uploaded. The desktop
app lives in the tray (closing the window keeps it running), can start with
Windows, and sends a Windows notification when a short is ready.

---

## Get the app (Windows)

Soundwave AI ships as a **native desktop app** — no terminal, no `.bat`, no
Node/Python/FFmpeg to install:

- **`SoundwaveAI-Setup-*.exe`** — installer with Start Menu + desktop
  shortcut (double-click → install → launch).
- **`SoundwaveAI-Portable-*.exe`** — single-file app, nothing to install.

Both are built by CI from this repo (see [docs/RELEASING.md](docs/RELEASING.md)
— including the code-signing steps that remove the Windows SmartScreen
prompt). All your projects, uploads and settings live in
`%APPDATA%\Soundwave AI\`.

The installers also include the speech engine for voice input (whisper.cpp +
OpenAI's Whisper base.en model, ~60 MB, both MIT licensed) and the Microsoft
C++ runtime it needs, so voice input works on a fresh Windows install.

The app's YouTube import keeps working through YouTube changes: its yt-dlp
lives in `%APPDATA%\Soundwave AI\bin\` and updates itself to the latest
nightly build each time the app starts (just restart the app if an import
fails with a YouTube-side error), and it uses the app itself as the
JavaScript runtime yt-dlp needs — no Node or Deno install required.

---

## Architecture

| Layer | Stack |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Zustand, React Hook Form + Zod |
| Agent Engine | Python 3 Autonomous Shorts Creator, 2026 Viral Research Hooks, Reactive Soundwave HUD, Batch Automation |
| Voice input | Local speech-to-text: whisper.cpp (`whisper-cli`) + Whisper base.en, run per command by the server (`POST /api/v1/agent/transcribe`); the browser records 16 kHz WAV (AudioWorklet) and detects the end of speech itself |
| Voice | **Soundwave voices** = Microsoft neural voices (Edge TTS). A direct WebSocket client streams replies as they are synthesized (24 kHz mono MP3 + word timings); `node-edge-tts` is the backup engine. No robotic fallback voice: if the service is unreachable the app says why |
| Backend | Express 5 + TypeScript, PostgreSQL + Prisma (JSON-file store fallback), JWT sessions (httpOnly cookies + refresh rotation + CSRF), Stripe billing stubs, SSE export jobs |
| Media | FFmpeg (`libx264`/`libvpx-vp9`, `libass` subtitles + ASS watermark, volume/fades, media probing) |

```
soundwave-ai/
├── soundwave-agent/     # Autonomous Desktop Shorts Agent & 2026 Viral Engine
│   ├── viral_engine.py  # 7 High-performing niches & 6 viral hook frameworks
│   ├── short_runner.py  # 1-Click & batch vertical video pipeline orchestrator
│   ├── hud.py           # Futuristic acoustic visualizer HUD (no weird 3D avatar)
│   ├── main.py          # Unified CLI & GUI desktop launcher
│   └── plugins/         # Clean, modular plugin extensions
├── frontend/            # Vite + React SPA
│   ├── src/pages/       # AgentHub (Command Center), Dashboard, Projects, VoiceLibrary, ...
│   ├── src/components/  # ui/ primitives, layout/, agent/ (orb, short cards)
│   ├── src/lib/         # voices, agentShorts, api, format, …
│   └── src/store/       # Zustand: auth, toast
├── server/              # Express API
│   ├── src/routes/      # agent, auth, voices, tts, projects, upload, export, billing, ...
│   ├── src/lib/         # auth (JWT/bcrypt), edgeTts, store (Prisma/JSON), ffmpeg, ytdlp, plans, security
│   ├── prisma/schema.prisma
│   └── scripts/generate-samples.ts
├── deploy/              # Dockerfile.api, nginx.conf
├── voiceclone/          # optional OmniVoice voice-cloning sidecar (see its README)
├── docker-compose.yml
└── vendor/              # static ffmpeg (export) + yt-dlp zipapp (YouTube import); whisper/ (voice input, git-ignored)
```

---

## Quick start (development)

```bash
# 1. Backend
cd server
npm install
cp .env.example .env          # edit JWT_SECRET, APP_URL
npm run prisma:generate       # optional — used only with a Postgres DSN
npm run dev                   # http://localhost:4000

# 2. Frontend (separate terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173 (proxies /api → :4000)
```

Without `DATABASE_URL` (Postgres) the API transparently uses a JSON-file store
(`server/data/store.json`) so the full product works locally with zero infra.

> **One-click launchers:** `start_windows.bat` (Windows) and `start.sh`
> (macOS/Linux) do all of the above and open the Agent Hub. Before starting the
> servers they run `node scripts/ensure_node_deps.mjs server frontend`, which
> checks every package against `package-lock.json` and repairs the install, so
> an interrupted first `npm install` no longer shows up later in the browser as
> `Failed to resolve import "lucide-react"`. If you install by hand and hit that
> error, delete that folder's `node_modules` and run `npm install` again — a
> plain re-run cannot repair packages that were only half-extracted.

> **Windows:** the commands are the same in PowerShell or `cmd`. Install
> [Node.js 22+](https://nodejs.org) (yt-dlp needs Node 22+ to solve YouTube's
> JavaScript challenges), and for video export install FFmpeg once
> with `winget install ffmpeg` (then restart the terminal) or point
> `FFMPEG_PATH` at `ffmpeg.exe`. `start_windows.bat` downloads the standalone
> `yt-dlp.exe` into `vendor\yt-dlp\` and updates it to the latest nightly on
> every start — YouTube breaks older yt-dlp builds every few weeks. Without
> it, YouTube import needs Python 3
> ([python.org](https://www.python.org/downloads/) or `winget install
> Python.Python.3.12`) — the vendored `vendor/yt-dlp/yt-dlp` zipapp is
> launched through it automatically; `pip install yt-dlp` works too.
> Copy the env file with `copy .env.example .env` and fill in the two JWT
> secrets (any random strings in dev).

> **FFmpeg** is required only for *rendering shorts*. In dev, point `FFMPEG_PATH`
> at a static binary (e.g. `vendor/ffmpeg/ffmpeg`) or install ffmpeg. Note: the
> static build has no `drawtext` filter, so the export watermark is rendered
> through the `libass` filter (same path as subtitle burn-in).
>
> **YouTube import** (the agent's Orbital NCG backgrounds) uses
> [yt-dlp](https://github.com/yt-dlp/yt-dlp). A prebuilt zipapp lives in
> `vendor/yt-dlp/yt-dlp` and is auto-detected — it only needs `python3`. To
> override, install yt-dlp yourself (`pip install yt-dlp` / `brew install
> yt-dlp`) or point `YTDLP_PATH` at the binary. `YTDLP_COOKIES` accepts a
> cookies.txt export for bot/age-gated videos, and `YTDLP_MAX_DURATION`
> (seconds) caps the length of importable videos. The importer uses yt-dlp's
> own default player clients (retuned by its maintainers as YouTube changes)
> and, when YouTube rejects them — e.g. *"The page needs to be reloaded"* —
> retries with the `web_embedded`/`web_safari` clients and, if cookies are
> configured, once without cookies.
>
> **Voices** come from Microsoft's online Edge TTS service, so the agent needs
> the internet to talk. `cd server && npx tsx scripts/edge-tts-smoke.ts` checks
> every Soundwave voice against the live service (CI runs it on each desktop
> build).
>
> **Voice input** (the mic) needs a local speech engine: put `whisper-cli`
> ([build whisper.cpp](https://github.com/ggml-org/whisper.cpp#quick-start) or
> take its release binary) and a ggml model such as `ggml-base.en-q5_1.bin`
> (from huggingface.co/ggerganov/whisper.cpp) in `vendor/whisper/` — or point
> `WHISPER_CLI_PATH` / `WHISPER_MODEL_PATH` at them. Without it the mic says
> why it's unavailable; typing works as usual. The desktop app bundles both.

### Tests

```bash
cd server && npm test            # vitest: unit + API tests (STT_REAL_SAMPLE=…/jfk.wav adds a real whisper.cpp run)
cd desktop && npm test           # desktop shell helpers (node --test)
cd frontend && npm run typecheck # tsc --noEmit
cd frontend && npm run build     # production build
```

---

## API surface

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/signup` | — | creates user, sets session cookies |
| POST | `/api/v1/auth/signin` | — | JWT session + refresh rotation |
| POST | `/api/v1/auth/signout` | ✓ | revokes session |
| POST | `/api/v1/auth/refresh` | refresh cookie | rotates refresh token |
| GET | `/api/v1/auth/session` | ✓ | current user + quota |
| POST | `/api/v1/auth/forgot-password` | — | email (log transport in dev) |
| POST | `/api/v1/auth/reset-password` | — | tokenized reset |
| POST | `/api/v1/auth/verify-email` | — | tokenized verify |
| GET | `/api/v1/auth/oauth/google` | — | starts OAuth (302 to provider) |
| GET | `/api/v1/auth/oauth/:provider/callback` | — | OAuth callback → sets session |
| GET | `/api/v1/auth/sessions` | ✓ | list / revoke sessions |
| GET | `/api/v1/voices` | — | voice metadata + sample URLs |
| GET | `/voice-samples/:voiceId.mp3` | — | static sample audio |
| POST | `/api/v1/tts/synthesize` | ✓ | server-side synthesis (Microsoft Neural) → MP3 + word timings; enforces quota |
| POST | `/api/v1/tts/usage` | ✓ | quota accounting (offline-fallback synth) |
| GET/POST | `/api/v1/projects` | ✓ | cloud projects (Pro+ for save) |
| PATCH/DELETE | `/api/v1/projects/:id` | ✓ | update / soft-delete |
| POST | `/api/v1/upload/video\|audio\|avatar` | ✓ | magic-byte validated uploads |
| POST | `/api/v1/upload/youtube` | ✓ | import a background video straight from a YouTube URL (yt-dlp) |
| GET | `/api/v1/upload/file/:key` | ✓ | stream an imported/uploaded video (Range supported, for previews) |
| GET | `/api/v1/export/jobs/:id` | — | a short's render status (SSE stream at `/events`) |
| GET | `/api/v1/export/jobs/:id/download` | — | download a finished short |
| POST | `/api/v1/agent/generate-short` | — | 1-click viral short generation (script + voice + TikTok captions + an unused Orbital NCG video imported via the YouTube link importer) |
| GET | `/api/v1/agent/defaults` | — | default 9:16 vertical short configuration & presets |
| GET | `/api/v1/agent/status` | — | agent status, binary availability & Orbital NCG background counts |
| GET | `/api/v1/agent/orbital` | — | Orbital NCG background history: used videos, unused count, skipped videos |
| POST | `/api/v1/agent/orbital/refresh` | — | re-list the Orbital NCG channel (picks up new uploads) |
| POST | `/api/v1/agent/orbital/reset` | — | forget which Orbital NCG videos were used |
| GET | `/api/v1/agent/jobs` | — | the agent's shorts, newest first (`?status=COMPLETED&kind=short&limit=`) |
| GET | `/api/v1/agent/speak/stream` | — | the agent's reply as streamed MP3 in a Soundwave voice (`?text=&voice=`) |
| POST | `/api/v1/agent/speak` | — | same, as base64 JSON (used by the Python desktop runner) |
| GET | `/api/v1/agent/speak/status` | — | why the last reply couldn't be spoken (if it couldn't) |
| POST | `/api/v1/agent/transcribe` | — | voice input: body = the recording (16 kHz mono WAV; other formats via ffmpeg) → `{ text, noSpeech, durationMs, elapsedMs, model }`, transcribed locally by whisper.cpp |
| GET | `/api/v1/agent/transcribe/status` | — | whether voice input is available here (and why not) |
| GET | `/api/v1/agent/niches` | — | 7 viral niches with hooks & sample scripts |
| POST | `/api/v1/agent/generate-script`| — | generate high-retention viral scripts on demand |
| GET | `/api/v1/ghost/macros` | — | list built-in and user custom automation macros |
| POST | `/api/v1/ghost/macros` | — | create/save custom sequential macro workflow |
| DELETE | `/api/v1/ghost/macros/:id` | — | remove user custom automation macro |
| POST | `/api/v1/ghost/decompose` | — | NLP step decomposer for natural language instructions |
| POST | `/api/v1/ghost/execute` | — | run sequential automation macro with step telemetry |
| POST | `/api/v1/creator/jump-cut` | — | auto-edit jump cut silence removal with FFmpeg |
| POST | `/api/v1/creator/screen-frame` | — | screen recording framing with rounded corners & shadow |
| GET/PATCH | `/api/v1/user/me` | ✓ | profile + password change |
| GET | `/api/v1/user/usage` | ✓ | quota snapshot |
| DELETE | `/api/v1/user/account` | ✓ | account deletion (30-day window) |
| GET | `/api/v1/user/export-data` | ✓ | GDPR data export |
| GET | `/api/v1/billing/plans` | — | plan definitions |
| GET | `/api/v1/billing/portal` | ✓ | Stripe customer portal (stub) |
| POST | `/api/v1/billing/checkout` | ✓ | Stripe checkout (stub) |
| GET/POST | `/api/v1/api-keys` | ✓ Ent | API key create/list |
| DELETE | `/api/v1/api-keys/:id` | ✓ Ent | revoke key |

State-changing requests require the `X-CSRF-Token` header matching the
`csrf_token` cookie. Rate limiting: 300 req/min general, stricter on auth/upload.

---

## Security model

- **Sessions**: short-lived access JWT + 30-day rotating refresh JWT in
  `httpOnly` + `SameSite=Lax` + `Secure` (prod) cookies. Refresh rotation
  invalidates the old token; replay detection via `sessionVersion`.
- **CSRF**: double-submit token cookie/header on all mutating routes.
- **Headers** (Helmet): HSTS, `X-Content-Type-Options`, `X-Frame-Options`,
  referrer policy, and a strict CSP — `script-src 'self'`, `connect-src
  'self'`, `media-src 'self' blob:` (speech is server-side and streamed from
  the app's own origin, so no model CDN, WebAssembly or data: audio is needed).
- **Passwords**: bcrypt (cost 12). Reset/verification tokens are SHA-256 hashed
  at rest, single-use, 1-hour TTL.
- **Uploads**: magic-byte validation, size caps, UUIDv7 file keys, extension
  allow-list, content served as `application/octet-stream`.
- **API keys**: SHA-256 hashed, `swa_live_…` prefix retained for display,
  shown in full only once.
- **TTS**: text is sent server-side to Microsoft's Edge TTS service for
  synthesis only and is never persisted; quota is enforced before synthesis.

## Quotas & plans

| | Free | Pro | Enterprise |
| --- | --- | --- | --- |
| Characters / month | 10k | 200k | 2M |
| Max export | 720p · watermark | 1080p | 4K · no watermark |
| Cloud project save | Local only | ✓ | ✓ |
| API access | — | — | ✓ |
| Exports / hour | 2 | 20 | 100 |

---

## Production deployment

```bash
export JWT_SECRET="$(openssl rand -hex 32)"
docker compose up --build
```

- **API** auto-selects Prisma + Postgres when `DATABASE_URL` is set (see
  `server/prisma/schema.prisma`); otherwise the JSON store is used.
- Set `STRIPE_*`, `SMTP_*`, `GOOGLE_*` env vars to activate billing,
  email, and OAuth; without them the corresponding endpoints degrade gracefully
  (billing 501 / logged email / OAuth redirect to a "not configured" notice).
- Run `prisma migrate deploy` in CI before rolling out schema changes.

### Setting up OAuth sign-in

1. **Google** — [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → *Create credentials → OAuth client ID* → Web application. Add authorized redirect URI `http://localhost:5173/api/v1/auth/oauth/google/callback`, then set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
2. Restart the server. In production, use your `APP_URL` origin in the redirect URI.

Users are matched by email — an existing password account is linked to the
OAuth identity; new OAuth users are created email-verified with no password.

### Feature flags & graceful degradation

| Capability | Without infra | Behaviour |
| --- | --- | --- |
| Postgres | not installed | JSON-file store, identical API |
| Redis | not installed | in-process rate limiting |
| FFmpeg | not installed | shorts fail with a clear message; everything else works |
| SMTP | not configured | emails are logged to stdout |
| Stripe | not configured | billing returns 501 stubs |
| Edge TTS (Microsoft) | unreachable | the agent shows why it can't speak (no robotic stand-in voice); a short fails with a clear message instead of being narrated by another voice |
| Speech engine (whisper.cpp) | not in `vendor/whisper/` / `WHISPER_*` unset | `/agent/transcribe` answers 503 with the reason; the mic shows it; typing works |
| Voice cloning | `VOICECLONE_URL` unset or sidecar down | `/tts/clone*` answers with a clear error; the Soundwave voices are unaffected |

### Voice cloning (OmniVoice)

An optional sidecar in [`voiceclone/`](voiceclone/README.md) runs
[OmniVoice](https://github.com/k2-fsa/OmniVoice) (zero-shot voice cloning,
600+ languages) next to the app. It is API-only (`/api/v1/tts/clone*`): the
app no longer has a voiceover page — the agent is the only thing that makes
videos, and it narrates with the Soundwave voices.

- **Multi-user safe.** Cloned voices are owned per-user by this API (reference
  clips under `<dataDir>/voice-clips/<userId>/`); the sidecar is stateless and
  only ever sees "one clip + one text" per request.
- **Runs anywhere.** Localhost next to the API, or free/always-on options —
  Hugging Face Space (free CPU), Oracle Cloud Always Free VM, or your home PC
  behind a free Cloudflare Tunnel. See
  [voiceclone/README.md](voiceclone/README.md#4-free-hosting-no-home-pc-required).
  Set `VOICECLONE_TOKEN` on both ends whenever it's not localhost.
- **Degrades gracefully.** Unset/offline sidecar → the clone endpoints say so.
- **Controllable cost.** Same character quota as neural voices, plus
  `VOICECLONE_MIN_PLAN` (default `FREE`) if you want to reserve cloning for
  paying tiers.

The Node API proxies it under `/api/v1/tts/clone*`: quota accounting and auth
are identical to `/tts/synthesize`. OmniVoice doesn't emit word timings, so
the API derives weighted per-word estimates from the text + audio duration,
which keeps subtitle auto-cueing working.

---

## Design system

Dark-only UI: background `#0A0F1C`, cards `#111827`, primary blue `#3B82F6`,
accent violet `#8B5CF6`, success `#10B981`, danger `#EF4444`, warning `#F59E0B`.
Radii 4/6/8, 4-px spacing grid, Inter/JetBrains Mono type scale, layered
shadows, visible `:focus-visible` rings, WCAG 2.1 AA contrast. Every text
container truncates or clamps; flex children carry `min-width:0`.
