# Changelog

## 1.1.0 — redesign, theming & full bug sweep

A pass over the whole product: a real theme system, a visual redesign on
semantic tokens, and fixes for every issue found while reviewing the codebase.

### Added

- **Changeable themes.** Seven presets (Midnight, Aurora, Sunset, Nebula,
  Graphite, Daylight, Sandstone), eight accent colours, three corner radii,
  two densities, reduce-motion, and light/dark/system modes. Applied through
  CSS custom properties, persisted in `localStorage`, mirrored across tabs and
  applied before first paint (no flash). See [docs/theming.md](docs/theming.md).
- **Theme picker** in the marketing navbar, the sign-in screen and
  Settings → Appearance, so visitors can pick a look before signing up.
- **`/terms` and `/privacy`** pages describing what the code actually does
  (plan limits, data flows, browser storage, deletion window). The sign-up
  Terms/Privacy links were `href="#"` before.
- **Bearer API-key authentication** (`Authorization: Bearer sw_…`) for
  Enterprise keys — they could previously be created, listed and revoked but
  never used.
- **`docs/`** with the theming guide; **`CHANGELOG.md`**; `npm test` and
  `npm run lint` scripts in `server/` (`npx vitest run` was the only way to run
  the suite).
- Per-request `requestId` in error payloads (the middleware existed but was
  never mounted).

### Fixed — frontend

- **Studio blanked its player** when navigating away and back: audio is now
  read from `tts.audioBuffer ?? studio.audioBuffer` (plus blob and word
  timings).
- **Stale online/offline indicator** — it now subscribes to the
  `online`/`offline` events instead of reading `navigator.onLine` once.
- **Delivery tags** (`<break>`, `{say|spell|pronounce}`) were sent verbatim to
  the API, which escapes SSML, so they never worked. They are now expanded
  before synthesis (`, ` for breaks, phonetic replacements, spelled-out
  letters) and stripped if malformed; the Studio gained "Say as…" and
  "Spell out" helpers.
- **Fake save buttons** in Studio and Subtitle Editor now persist projects for
  real (IndexedDB for Free, cloud for Pro+) and reuse the saved id on the
  second save.
- **Video Compositor background colour** only changed the preview; it is now
  stored on the studio store and sent to FFmpeg as `backgroundColor` (the API
  validates it and feeds it to the `lavfi` colour source).
- **Audio player started unmuted** at full volume regardless of the stored
  volume/mute settings — the gain node is now seeded from them.
- **Offline demo voice** used a broken gender test (`/^[ab]m/` against
  `en-US-JennyNeural`), so every voice was pitched female; it now reads the
  voice metadata and gives British voices their own offset.
- **Waveform** was painted with hard-coded violet/grey and a white playhead —
  it now reads the live theme tokens, subscribes to theme changes, and
  supports Home/End in addition to the arrow keys.
- **Subtitle rows** were clickable anywhere (including while selecting text)
  and played the wrong thing; each row now has an explicit play button, plus
  "Export SRT" and "Continue to video".
- **Projects** sorted by `String.localeCompare` on ISO dates and re-fetched on
  every keystroke; search is URL-synced and sorting is date-based. Opening a
  project now seeds the studio instead of navigating to an empty editor.
- **Dashboard** was rebuilt on real data (quota, project count, total runtime,
  recent projects with open/delete) instead of placeholder values.
- **Sign-up** duplicated the brand mark on mobile and linked Terms/Privacy to
  `#`; several links used `hover:text-primary` on `text-primary` (a no-op) and
  are now `.sw-link`.
- **`resolveTheme`** ignored "follow system" unless the stored theme id was
  invalid, so light/dark never switched. It now resolves against the preset's
  appearance with explicit counterparts.
- **ThemeProvider** parsed `localStorage` cross-tab payloads without a
  `try/catch`, so a malformed value threw inside a storage listener.
- Removed a duplicated `FullPageLoader` (it lived in `App.tsx` and was
  imported from there by the OAuth callback), an unused `SkeletonRow`, an
  unused "remember me" field that did nothing, and the static/dynamic import
  mix that stopped Vite splitting `idb`/`localProjects`.

### Fixed — backend

- **Sign-in lock-out** returned `CAPTCHA_REQUIRED` after five failures even
  though no CAPTCHA exists anywhere in the product, dead-ending the account
  forever. It now returns `429` with `Retry-After` for a 15-minute lock-out,
  keyed by email so unknown addresses behave identically (no enumeration
  oracle).
- **CSRF ordering** blocked anonymous requests with a confusing
  "CSRF token required" 403 (and would have done the same to any header-based
  client). CSRF is now checked only for cookie-authenticated requests, before
  the silent token refresh, and a half-cleared cookie jar forces a clean
  re-authentication.
- **Rate-limit keys trusted `X-Forwarded-For[0]`**, which any client can forge;
  every limiter could be bypassed by rotating the header. `req.ip` is used now
  (Express resolves it from the header only when `trust proxy` is configured).
- **FFmpeg progress** divided `out_time_ms` (microseconds on modern builds) as
  if it were seconds, so the progress bar jumped to 99% immediately. It now
  parses `out_time=HH:MM:SS.ffffff` with a `out_time_us` fallback.
- **Subtitle style injection**: the font family was interpolated into the
  generated ASS style line, so a crafted `fontFamily` could inject extra style
  or dialogue lines. Values are sanitised and colours are normalised before
  they reach the subtitle file.
- **`multer` 1.x** (deprecated, unpatched CVEs) upgraded to 2.x with matching
  types.
- Comment fixes where the code and the docs disagreed (API keys described as
  client-side TTS/export-only, etc.).
- Removed the unused `optionalAuth` middleware (dead code, and an
  unauthenticated path that skipped CSRF).

### Changed

- Landing, Dashboard, Pricing, Projects, Settings, Help, Voice Library, the
  auth screens and 404 were restyled on semantic tokens with real states
  (loading skeletons, empty states, error copy), and the marketing copy now
  matches the implementation (server-side TTS, per-plan limits, real theme
  count, audio-only-leaves-for-export).
- README rewritten: accurate architecture, API table, plan table, security
  model, env vars and a theming section. The previous version claimed a
  dark-only UI, a nonexistent `JWT_SECRET`, Express 5, 18 tests and several
  endpoints that do not exist.

### Verification

- `cd server && npm test` → 33/33 passing.
- `cd server && npm run typecheck` → clean (Prisma client must be generated:
  `npm run prisma:generate`).
- `cd frontend && npm run build` → clean.
