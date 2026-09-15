# Soundwave AI

**Production-grade, client-side AI text-to-speech and video compositing studio.**

Generate studio-quality voiceovers with **Microsoft Neural voices** (via the
free, key-less Edge TTS service), style and burn subtitles into video, and
export finished MP4/WebM with FFmpeg.

---

## Architecture

| Layer | Stack |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Zustand, React Hook Form + Zod |
| TTS | Server-side **Microsoft Neural voices** via `node-edge-tts` (24 kHz mono MP3 + word timings), offline formant fallback |
| Backend | Express 5 + TypeScript, PostgreSQL + Prisma (JSON-file store fallback), JWT sessions (httpOnly cookies + refresh rotation + CSRF), Stripe billing stubs, SSE export jobs |
| Media | FFmpeg (`libx264`/`libvpx-vp9`, `libass` subtitles + ASS watermark, volume/fades, media probing) |

```
soundwave-ai/
├── frontend/            # Vite + React SPA
│   ├── src/pages/       # Landing, Pricing, auth, Dashboard, Studio,
│   │                    #   SubtitleEditor, VideoCompositor, Projects, Settings
│   ├── src/components/  # ui/ primitives, layout/, VoicePicker, Waveform, …
│   ├── src/hooks/       # useTTS (edge-tts API call + offline fallback)
│   ├── src/lib/         # audio, ttsEngine, voices, subtitlePresets, idb, api, …
│   └── src/store/       # Zustand: auth, studio, toast, theme
├── server/              # Express API
│   ├── src/routes/      # auth, voices, tts, projects, upload, export, user, billing, apiKeys
│   ├── src/lib/         # auth (JWT/bcrypt), edgeTts, store (Prisma/JSON), ffmpeg, plans, security
│   ├── prisma/schema.prisma
│   └── scripts/generate-samples.ts
├── deploy/              # Dockerfile.api, nginx.conf
├── docker-compose.yml
└── vendor/ffmpeg/       # static ffmpeg for local export (dev)
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

> **FFmpeg** is required only for *video export*. In dev, point `FFMPEG_PATH`
> at a static binary (e.g. `vendor/ffmpeg/ffmpeg`) or install ffmpeg. Note: the
> static build has no `drawtext` filter, so the export watermark is rendered
> through the `libass` filter (same path as subtitle burn-in).

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
| GET | `/api/v1/auth/oauth/google\|github` | — | starts OAuth (302 to provider) |
| GET | `/api/v1/auth/oauth/:provider/callback` | — | OAuth callback → sets session |
| GET | `/api/v1/auth/sessions` | ✓ | list / revoke sessions |
| GET | `/api/v1/voices` | — | voice metadata + sample URLs |
| GET | `/voice-samples/:voiceId.mp3` | — | static sample audio |
| POST | `/api/v1/tts/synthesize` | ✓ | server-side synthesis (Microsoft Neural) → MP3 + word timings; enforces quota |
| POST | `/api/v1/tts/usage` | ✓ | quota accounting (offline-fallback synth) |
| GET/POST | `/api/v1/projects` | ✓ | cloud projects (Pro+ for save) |
| PATCH/DELETE | `/api/v1/projects/:id` | ✓ | update / soft-delete |
| POST | `/api/v1/upload/video\|audio\|avatar` | ✓ | magic-byte validated uploads |
| POST | `/api/v1/export/video` | ✓ | start FFmpeg export job |
| GET | `/api/v1/export/jobs/:id` | ✓ | job status (SSE stream supported) |
| GET | `/api/v1/export/jobs/:id/download` | ✓ | download finished export |
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

## Production deployment

```bash
export JWT_SECRET="$(openssl rand -hex 32)"
docker compose up --build
```

- **API** auto-selects Prisma + Postgres when `DATABASE_URL` is set (see
  `server/prisma/schema.prisma`); otherwise the JSON store is used.
- Set `STRIPE_*`, `SMTP_*`, `GOOGLE_*`/`GITHUB_*` env vars to activate billing,
  email, and OAuth; without them the corresponding endpoints degrade gracefully
  (billing 501 / logged email / OAuth redirect to a "not configured" notice).
- Run `prisma migrate deploy` in CI before rolling out schema changes.

### Setting up OAuth sign-in

1. **Google** — [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → *Create credentials → OAuth client ID* → Web application. Add authorized redirect URI `http://localhost:5173/api/v1/auth/oauth/google/callback`, then set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
2. **GitHub** — [GitHub Developer Settings](https://github.com/settings/developers) → *New OAuth App*. Set the callback URL to `http://localhost:5173/api/v1/auth/oauth/github/callback`, then set `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.
3. Restart the server. In production, use your `APP_URL` origin in the redirect URIs.

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

---

## Design system

A quiet, minimal UI with two themes — **charcoal** (soft neutral dark) and
**paper** (warm off-white light) — plus a **system** mode that follows the OS.
No gradients, no coloured glow, one muted dusty slate-blue accent.

Everything is driven by CSS custom properties declared in
`frontend/src/index.css` under `[data-theme="dark"]` / `[data-theme="light"]`
and exposed to Tailwind as semantic colour tokens (`frontend/tailwind.config.js`).
Each token stores raw RGB channels, so opacity modifiers (`bg-accent/10`,
`border-line/60`) work in both themes.

| Token | Purpose | Charcoal | Paper |
| --- | --- | --- | --- |
| `canvas` / `surface` / `raised` / `sunken` | page, cards, popovers, inputs | `#16191D` / `#1E2227` / `#23282E` / `#191D21` | `#F6F5F1` / `#FDFCFA` / `#FFFFFF` / `#F2F1EC` |
| `line` / `line-strong` / `line-emphasis` | hairlines, inputs, hover borders | `#2D333A` / `#414A53` / `#5C666F` | `#E4E2DB` / `#D6D3CA` / `#BFBBB0` |
| `fg` / `fg-soft` / `muted` / `faint` | text hierarchy | `#E4E7EA` → `#878F98` | `#23282D` → `#6B747C` |
| `accent` / `accent-strong` / `accent-ink` | brand + on-brand text | `#8AA3BB` / `#A5BCD0` / `#111519` | `#4F6D8A` / `#3E5A75` / `#FAFBFC` |
| `secondary` | muted stone-violet (badges) | `#9E95A8` | `#796F85` |
| `success` / `danger` / `warning` | desaturated status colours | `#86A891` / `#C78A8A` / `#C7AC7C` | `#4F7A5C` / `#A85C5C` / `#91713A` |
| `tint` / `tint-strong` | subtle fills, hover states, tracks | `#2A2F35` / `#3A4149` | `#E8E5DE` / `#DFDCD3` |

Radii 8/8/12 (input/button/card), 4-px spacing grid, Inter/JetBrains Mono type
scale, semibold headings at most, soft neutral shadows (`shadow-card`,
`shadow-pop`), visible `:focus-visible` rings, WCAG 2.1 AA contrast in both
themes. Every text container truncates or clamps; flex children carry
`min-width:0`.

**Theming plumbing**

- `frontend/src/store/theme.ts` — zustand store (`light` / `dark` / `system`),
  persisted in `localStorage["soundwave:theme"]`; writes `data-theme` on
  `<html>` and keeps `<meta name="theme-color">` in sync.
- An inline script in `frontend/index.html` resolves the stored theme before
  first paint (no flash), and `initTheme()` re-applies it on boot and listens
  for OS-level `prefers-color-scheme` changes.
- `frontend/src/components/ui/ThemeToggle.tsx` — icon switch (navbar, app
  header, auth pages) and `ThemeSelect` (Settings → Preferences → Appearance).
- Canvas visualisers (waveform, hero bars) read tokens through
  `frontend/src/lib/themeTokens.ts` and redraw when the theme changes.
