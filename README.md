# Soundwave AI

**Production-grade, client-side AI text-to-speech and video compositing studio.**

Generate studio-quality voiceovers with **Microsoft Neural voices** (via the
free, key-less Edge TTS service) or with **your own cloned voice** (OmniVoice
voice cloning, optional local sidecar), style and burn subtitles into video,
and export finished MP4/WebM with FFmpeg.

---

## Architecture

| Layer | Stack |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Zustand, React Hook Form + Zod |
| Agent Engine | Python 3 Autonomous Shorts Creator, 2026 Viral Research Hooks, Reactive Soundwave HUD, Batch Automation |
| TTS | Server-side **Microsoft Neural voices** via `node-edge-tts` (24 kHz mono MP3 + word timings), offline formant fallback |
| Backend | Express 5 + TypeScript, PostgreSQL + Prisma (JSON-file store fallback), JWT sessions (httpOnly cookies + refresh rotation + CSRF), Stripe billing stubs, SSE export jobs |
| Media | FFmpeg (`libx264`/`libvpx-vp9`, `libass` subtitles + ASS watermark, volume/fades, media probing) |

```
soundwave-ai/
├── soundwave-agent/     # Autonomous Desktop Shorts Agent & 2026 Viral Engine
│   ├── viral_engine.py  # 7 High-performing niches & 6 viral hook frameworks
│   ├── short_runner.py  # 1-Click & batch vertical video pipeline orchestrator
│   ├── hud.py           # Futuristic acoustic visualizer HUD (no weird 3D avatar)
│   ├── cache_manager.py # 60s Minecraft parkour clip library (download once → slice → delete after use)
│   ├── main.py          # Unified CLI & GUI desktop launcher
│   └── plugins/         # Clean, modular plugin extensions
├── frontend/            # Vite + React SPA
│   ├── src/pages/       # AgentHub, Studio, SubtitleEditor, VideoCompositor, Projects, ...
│   ├── src/components/  # ui/ primitives, layout/, VoicePicker, Waveform, …
│   ├── src/hooks/       # useTTS (edge-tts API call + offline fallback)
│   ├── src/lib/         # audio, ttsEngine, voices, subtitlePresets, idb, api, …
│   └── src/store/       # Zustand: auth, studio, toast
├── server/              # Express API
│   ├── src/routes/      # agent, auth, voices, tts, projects, upload, export, billing, ...
│   ├── src/lib/         # auth (JWT/bcrypt), edgeTts, store (Prisma/JSON), ffmpeg, ytdlp, plans, security
│   ├── prisma/schema.prisma
│   └── scripts/generate-samples.ts
├── deploy/              # Dockerfile.api, nginx.conf
├── voiceclone/          # optional OmniVoice voice-cloning sidecar (see its README)
├── docker-compose.yml
└── vendor/              # static ffmpeg (export) + yt-dlp zipapp (YouTube import)
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

> **Windows:** the commands are the same in PowerShell or `cmd`. Install
> [Node.js 20+](https://nodejs.org), and for video export install FFmpeg once
> with `winget install ffmpeg` (then restart the terminal) or point
> `FFMPEG_PATH` at `ffmpeg.exe`. YouTube import needs Python 3
> ([python.org](https://www.python.org/downloads/) or `winget install
> Python.Python.3.12`) — the vendored `vendor/yt-dlp/yt-dlp` zipapp is
> launched through it automatically; `pip install yt-dlp` works too.
> Copy the env file with `copy .env.example .env` and fill in the two JWT
> secrets (any random strings in dev).

> **FFmpeg** is required only for *video export*. In dev, point `FFMPEG_PATH`
> at a static binary (e.g. `vendor/ffmpeg/ffmpeg`) or install ffmpeg. Note: the
> static build has no `drawtext` filter, so the export watermark is rendered
> through the `libass` filter (same path as subtitle burn-in).
>
> **YouTube import** (Video Compositor → "Import from YouTube") uses
> [yt-dlp](https://github.com/yt-dlp/yt-dlp). A prebuilt zipapp lives in
> `vendor/yt-dlp/yt-dlp` and is auto-detected — it only needs `python3`. To
> override, install yt-dlp yourself (`pip install yt-dlp` / `brew install
> yt-dlp`) or point `YTDLP_PATH` at the binary. `YTDLP_COOKIES` accepts a
> cookies.txt export for bot/age-gated videos, and `YTDLP_MAX_DURATION`
> (seconds) caps the length of importable videos.
>
> **Portrait video** is a first-class export style: pick 9:16 in the Video
> Compositor to render vertical video optimized for YouTube Shorts, TikTok,
> and Instagram Reels (all resolutions supported, e.g. 1080p → 1080×1920).

### Tests

```bash
cd server && npm test            # vitest: 18 unit + API tests
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
| POST | `/api/v1/export/video` | ✓ | start FFmpeg export job (16:9 or 9:16 portrait) |
| GET | `/api/v1/export/jobs/:id` | ✓ | job status (SSE stream supported) |
| GET | `/api/v1/export/jobs/:id/download` | ✓ | download finished export |
| POST | `/api/v1/agent/generate-short` | — | 1-click viral short generation (script + Jenny + TikTok + gameplay) |
| GET | `/api/v1/agent/defaults` | — | default 9:16 vertical short configuration & presets |
| GET | `/api/v1/agent/status` | — | agent status, binary availability & background cache size |
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
  'self'` (TTS is server-side, so no model CDN or WebAssembly is needed).
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

## Minecraft background footage (shorts)

Every generated short uses **real** Minecraft parkour gameplay as its 9:16
background — never a synthetic placeholder. Footage comes from exactly one
place: the **Orbital – No Copyright Gameplay** channel
([youtube.com/@OrbitalNCG](https://www.youtube.com/@OrbitalNCG)), whose videos
are public, no-copyright / free-to-use gameplay (usable with attribution).

How a source is chosen when the 60s clip library runs dry:

1. **Bundled masters** — any `*.mp4` in `vendor/minecraft-backgrounds/`
   (fetched once by `scripts/fetch_background_master.py`; consumed but never
   deleted, so the pipeline works offline too).
2. **Curated Orbital highlights** — a verified list of long uploads (a
   4h53m vertical 9:16 build, 2h29m, 1h16m, 1h10m, …).
3. **The rest of the Orbital channel**, walked newest-first.

Two gates make sure nothing fake ever reaches a short:

- **Metadata gate** (before any download): the video must be from the Orbital
  channel, titled Minecraft, and within the 2m–6h duration range.
- **Frame gate** (after slicing): frames are sampled and the source is
  rejected when they look like a test pattern (SMPTE / ffmpeg `testsrc`
  color bars) or solid/blank footage — the exact failure mode this gate was
  built to prevent.

Credits required by the channel: mention **Orbital – No Copyright Gameplay**
in the video description and don't re-upload the footage as
"No Copyright Gameplay" (`CREDITS.txt` is written next to any fetched master).

```bash
# Optional one-time offline master (runs where YouTube is reachable):
python3 scripts/fetch_background_master.py            # 2h29m landscape
python3 scripts/fetch_background_master.py fw_eWpb7uCE  # 4h53m VERTICAL 9:16
```

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
| FFmpeg | not installed | export jobs fail with a clear message; everything else works |
| SMTP | not configured | emails are logged to stdout |
| Stripe | not configured | billing returns 501 stubs |
| Edge TTS (Microsoft) | unreachable | `/tts/synthesize` returns an error; the frontend falls back to the built-in demo voice |
| Voice cloning | `VOICECLONE_URL` unset or sidecar down | "Cloned voices" tab is hidden / shows an offline notice; neural voices unaffected |

### Voice cloning (OmniVoice)

An optional sidecar in [`voiceclone/`](voiceclone/README.md) runs
[OmniVoice](https://github.com/k2-fsa/OmniVoice) (zero-shot voice cloning,
600+ languages) next to the app. Upload a 3–10 s reference clip in the
Studio's **Cloned voices** tab, generate with your cloned voice, and the audio
flows through the exact same subtitles + video pipeline.

- **Multi-user safe.** Cloned voices are owned per-user by this API (reference
  clips under `<dataDir>/voice-clips/<userId>/`); the sidecar is stateless and
  only ever sees "one clip + one text" per request.
- **Runs anywhere.** Localhost next to the API, or free/always-on options —
  Hugging Face Space (free CPU), Oracle Cloud Always Free VM, or your home PC
  behind a free Cloudflare Tunnel. See
  [voiceclone/README.md](voiceclone/README.md#4-free-hosting-no-home-pc-required).
  Set `VOICECLONE_TOKEN` on both ends whenever it's not localhost.
- **Degrades gracefully.** Unset/offline sidecar → the UI hides the tab.
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
