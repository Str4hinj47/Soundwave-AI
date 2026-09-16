# Soundwave AI

**Text-to-speech, subtitle styling and video export — in one workspace.**

Generate studio-quality voiceovers with **Microsoft Neural voices** (via the
key-less Edge TTS service) or with **your own cloned voice** (optional
self-hosted OmniVoice sidecar), style and burn subtitles into video, and export
finished MP4/WebM with FFmpeg. The UI ships with **seven switchable themes**
you can restyle further with your own accent colour, radius and density.

> **TTS is server-side.** Your script is sent to the API, synthesised through
> Microsoft's Neural voices and streamed back as a 24 kHz mono MP3 with
> word-level timings. Nothing is downloaded to the browser and no model runs on
> the client. If the API can't reach the voice service the Studio falls back to
> a small in-browser formant synthesiser so you can keep working.

---

## Architecture

| Layer | Stack |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS 3, Framer Motion, Zustand, React Hook Form + Zod |
| Theming | CSS custom properties (`--sw-*`) + semantic Tailwind tokens, 7 presets, 8 accents, 3 radii, 2 densities, light/dark/system |
| TTS | Server-side **Microsoft Neural voices** via `node-edge-tts` (24 kHz mono MP3 + word timings), offline formant fallback in the browser |
| Backend | Express 4 + TypeScript, PostgreSQL + Prisma (JSON-file store fallback), JWT sessions (httpOnly cookies + refresh rotation + CSRF), Stripe billing stubs, SSE export jobs |
| Media | FFmpeg (`libx264`/`libvpx-vp9`, `libass` subtitles + ASS watermark, volume/fades, media probing) |

```
soundwave-ai/
├── frontend/            # Vite + React SPA
│   ├── src/pages/       # Landing, Pricing, Legal, auth, Dashboard, Studio,
│   │                    #   SubtitleEditor, VideoCompositor, Projects, Settings, Help
│   ├── src/components/  # ui/ primitives, layout/, theme/, VoicePicker, Waveform, …
│   ├── src/hooks/       # useTTS (edge-tts API call + offline fallback)
│   ├── src/lib/         # themes, audio, ttsEngine, voices, subtitlePresets, idb, api, …
│   └── src/store/       # Zustand: auth, studio, theme, toast
├── server/              # Express API
│   ├── src/routes/      # auth, voices, tts, projects, upload, export, user, billing, apiKeys
│   ├── src/lib/         # auth (JWT/bcrypt), edgeTts, store (Prisma/JSON), ffmpeg, ytdlp, plans, security
│   ├── prisma/schema.prisma
│   └── scripts/generate-samples.ts
├── docs/                # theming guide + review notes
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
cp .env.example .env                  # fill in JWT_ACCESS_SECRET + JWT_REFRESH_SECRET
npm run prisma:generate               # optional — only needed with a Postgres DSN
npm run dev                           # http://localhost:4000

# 2. Frontend (separate terminal)
cd frontend
npm install
npm run dev                           # http://localhost:5173 (proxies /api → :4000)
```

Both secrets are required: the server refuses to boot with the placeholder
defaults, in development as well as production. Any random string works
locally — `openssl rand -hex 32` (or a password generator on Windows).

Without `DATABASE_URL` (Postgres) the API transparently uses a JSON-file store
(`server/data/store.json`) so the full product works locally with zero infra.

> **Windows:** the commands are the same in PowerShell or `cmd`. Install
> [Node.js 20+](https://nodejs.org), and for video export install FFmpeg once
> with `winget install ffmpeg` (then restart the terminal) or point
> `FFMPEG_PATH` at `ffmpeg.exe`. YouTube import needs Python 3
> ([python.org](https://www.python.org/downloads/) or `winget install
> Python.Python.3.12`) — the vendored `vendor/yt-dlp/yt-dlp` zipapp is
> launched through it automatically; `pip install yt-dlp` works too.
> Copy the env file with `copy .env.example .env`.

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

### Tests & checks

```bash
cd server   && npm test              # vitest: 33 unit + API + OAuth tests
cd server   && npm run typecheck     # tsc --noEmit
cd frontend && npm run typecheck     # tsc --noEmit
cd frontend && npm run build         # production build (typecheck + vite build)
```

---

## Theming

Everything visual resolves through semantic tokens, so the whole app re-skins
at runtime without a reload or a re-render pass:

| Preset | Appearance | Notes |
| --- | --- | --- |
| Midnight | dark | default — deep navy with blue → violet light |
| Aurora | dark | emerald + cyan over deep teal |
| Sunset | dark | amber + rose over plum |
| Nebula | dark | fuchsia + cyan on near-black indigo |
| Graphite | dark | monochrome, distraction-free |
| Daylight | light | crisp light theme, blue + indigo on white |
| Sandstone | light | warm light theme, terracotta + rose on paper |

On top of the preset you can pick an **accent** (8 options, incl. "match
theme"), **corner radius** (sharp / rounded / pill), **density** (comfortable /
compact) and **reduce motion**, or follow the OS light/dark preference.
Choices are stored in `localStorage` (`sw.theme.v1`), mirrored onto `<html>` as
CSS variables, and applied before first paint by a tiny inline bootstrap script
so there is no flash of the wrong palette.

```
Settings → Appearance   with the theme picker
/public                 the theme picker also lives in the marketing navbar and
                        on the sign-in screen, so visitors can pick before signing up
```

See **[docs/theming.md](docs/theming.md)** for the token list and how to add a
preset.

---

## API surface

All routes are prefixed with `/api/v1`. `✓` = requires a session cookie, `Ent`
= Enterprise plan (API keys authenticate as their owner over
`Authorization: Bearer sw_…`).

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/auth/signup` | — | creates user, sends verification mail, sets session cookies |
| POST | `/auth/signin` | — | JWT session + refresh rotation; per-account lock-out after 5 failures |
| POST | `/auth/signout` | — | revokes the current session |
| POST | `/auth/refresh` | refresh cookie | rotates the refresh token |
| GET | `/auth/session` | ✓ | current user |
| POST | `/auth/forgot-password` | — | always returns ok (no user enumeration) |
| POST | `/auth/reset-password` | — | tokenized reset; revokes all sessions |
| POST | `/auth/verify-email` | — | tokenized verify |
| POST | `/auth/resend-verification` | ✓ | throttled to 1 / 2 min |
| GET | `/auth/providers` | — | which OAuth providers are configured |
| GET | `/auth/oauth/:provider` | — | starts OAuth (302 to provider, sets state cookie) |
| GET | `/auth/oauth/:provider/callback` | — | OAuth callback → sets session |
| GET/DELETE | `/auth/sessions` | ✓ | list / revoke sessions |
| GET | `/voices` | — | voice metadata |
| GET | `/voices/:voiceId/sample` | — | sample audio (static under `/voice-samples`) |
| GET | `/tts/quota` | ✓ | quota snapshot |
| POST | `/tts/synthesize` | ✓ | server-side synthesis → MP3 + word timings; quota enforced *before* synthesis |
| POST | `/tts/usage` | ✓ | quota accounting for the offline fallback |
| GET | `/tts/clone/status`, `/tts/clone/profiles` | ✓ | voice-clone sidecar state / profiles |
| POST | `/tts/clone/profiles`, `/tts/clone` | ✓ | upload a reference clip / synthesise with a clone |
| GET/POST | `/projects` | ✓ | list / create (cloud save needs Pro+) |
| GET/PUT/DELETE | `/projects/:id` | ✓ | read / update / delete |
| PUT | `/projects/:id/subtitles` | ✓ | save cues + style |
| POST | `/projects/:id/duplicate` | ✓ | duplicate |
| POST | `/upload/video\|audio\|avatar` | ✓ | magic-byte validated uploads |
| POST | `/upload/youtube` | ✓ | import a background video from a YouTube URL (yt-dlp) |
| GET | `/upload/file/:key` | ✓ | stream an uploaded/imported video (Range supported) |
| POST | `/export/video` | ✓ | start an FFmpeg export job (16:9 or 9:16, 720p→4K, optional solid background colour) |
| GET | `/export/jobs/:id`, `/export/jobs/:id/events` | ✓ | job status (SSE supported) |
| GET | `/export/jobs/:id/download` | ✓ | download the finished export |
| GET/PUT | `/user/profile` | ✓ | profile |
| PUT | `/user/password` | ✓ | password change |
| DELETE | `/user/account` | ✓ | account deletion (30-day recovery window) |
| GET | `/user/usage` | ✓ | quota snapshot + recent generation logs |
| GET | `/user/data-export` | ✓ | GDPR data export (JSON download) |
| GET | `/billing/plans` | — | plan definitions |
| POST | `/billing/create-checkout`, `/billing/create-portal` | ✓ | Stripe (returns 501 without keys) |
| POST | `/billing/apply-plan` | ✓ | dev plan switch (disabled without a payment provider in prod) |
| POST | `/billing/webhook` | signature | Stripe webhook |
| GET/POST | `/api-keys`, DELETE `/api-keys/:id` | ✓ Ent | create (returned once) / list / revoke |

State-changing requests need the `X-CSRF-Token` header matching the readable
`csrf_token` cookie (double-submit). Rate limiting: 120 req/min general per
user-IP, 10 sign-ins / 15 min (200 in dev), 5 sign-ups / 15 min (100 in dev).

---

## Security model

- **Sessions**: 15-minute access JWT + 7-day rotating refresh JWT in
  `httpOnly` + `SameSite=Strict` + `Secure` (prod) cookies. Refresh rotates the
  token; a hash mismatch is treated as theft and revokes every session.
- **CSRF**: double-submit cookie/header on all mutating cookie-authenticated
  routes. Bearer API keys are header credentials and are exempt.
- **Headers** (Helmet): HSTS, `X-Content-Type-Options`, referrer policy, and a
  strict CSP — `script-src 'self'`, `connect-src 'self'` (TTS is server-side,
  so no model CDN or WebAssembly is needed).
- **Passwords**: bcrypt (cost 12). Reset/verification tokens are SHA-256 hashed
  at rest, single-use, 1-hour TTL for resets. Failed sign-ins lock the account
  for 15 minutes after 5 attempts (`429` + `Retry-After`).
- **Uploads**: magic-byte validation, size caps per plan, UUID file keys,
  extension allow-list, content served as `application/octet-stream`.
- **API keys**: SHA-256 hashed at rest, `sw_` prefix kept for display, shown in
  full only once, optional expiry, `lastUsedAt` tracking.
- **TTS**: text is sent to Microsoft's Edge TTS service for synthesis only and
  is never persisted; quota is enforced before synthesis.
- **Privacy**: see the in-app [Privacy Policy](/privacy) page — the same text
  the product links to, kept in `frontend/src/pages/Legal.tsx`.

## Quotas & plans

| | Free | Pro | Enterprise |
| --- | --- | --- | --- |
| Characters / month | 10k | 200k | 2M |
| Max export | 720p · watermark | 1080p | 4K · no watermark |
| Exports / hour | 2 | 20 | 100 |
| Cloud project save | Local only | ✓ | ✓ |
| Max upload size | 100 MB | 500 MB | 2 GB |
| API access | — | — | ✓ |

---

## Production deployment

```bash
export JWT_ACCESS_SECRET="$(openssl rand -hex 32)"
export JWT_REFRESH_SECRET="$(openssl rand -hex 32)"
docker compose up --build
```

- **API** auto-selects Prisma + Postgres when `DATABASE_URL` is set (see
  `server/prisma/schema.prisma`); otherwise the JSON store is used.
- Set `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`,
  `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` to activate billing, email and
  OAuth; without them the corresponding endpoints degrade gracefully
  (billing 501 / email logged to stdout / OAuth button hidden).
- Set `APP_URL` to the public origin (used for OAuth redirects and mail links)
  and `CORS_ORIGINS` if the SPA is served from another origin.
- Run `prisma migrate deploy` in CI before rolling out schema changes.

### Setting up OAuth sign-in

1. **Google** — [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → *Create credentials → OAuth client ID* → Web application. Add authorized redirect URI `http://localhost:5173/api/v1/auth/oauth/google/callback`, then set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
2. Restart the server. The sign-in button only appears when the provider is configured (`GET /api/v1/auth/providers`).

Users are matched by email — an existing password account is linked to the
OAuth identity; new OAuth users are created email-verified with no password.

### Feature flags & graceful degradation

| Capability | Without infra | Behaviour |
| --- | --- | --- |
| Postgres | not installed | JSON-file store, identical API |
| Redis | not installed | in-process rate limiting |
| FFmpeg | not installed | export jobs fail with a clear message; everything else works |
| Email provider | not configured | emails are logged to stdout |
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
- **Consent required.** Only clone voices you have permission to use — see the
  in-app [Terms of Service](/terms).

The Node API proxies it under `/api/v1/tts/clone*`: quota accounting and auth
are identical to `/tts/synthesize`. OmniVoice doesn't emit word timings, so
the API derives weighted per-word estimates from the text + audio duration,
which keeps subtitle auto-cueing working.

---

## Design system

Semantic tokens only — no hard-coded palette anywhere in the components:

| Token group | Examples | Tailwind |
| --- | --- | --- |
| Surfaces | `--sw-bg`, `--sw-surface`, `--sw-surface-inset` | `bg-app`, `bg-surface`, `bg-surface-inset` |
| Borders | `--sw-border`, `--sw-border-strong` | `border-border`, `border-border-strong` |
| Text | `--sw-fg`, `--sw-fg-strong`, `--sw-fg-muted`, `--sw-fg-subtle` | `text-fg-strong`, `text-fg-muted` |
| Brand | `--sw-primary`, `--sw-accent`, `…-soft`, `--sw-ring` | `bg-primary`, `text-accent`, `ring-ring` |
| Status | `--sw-success`, `--sw-warning`, `--sw-danger`, `--sw-info` (+ `-soft`) | `text-danger`, `border-warning/40` |
| Shape | `--sw-radius-card|btn|input`, `--sw-pad-card|panel|row`, `--sw-control-h` | `rounded-card`, `rounded-btn`, `.sw-card-pad` |

Radii and density come from the theme too, so "compact" really is denser
everywhere (including control heights and table row padding). Focus rings use
`:focus-visible` with the themed ring colour, contrast targets WCAG 2.1 AA in
both light and dark presets, and reduced-motion is honoured both by the OS
media query and the in-app toggle.
