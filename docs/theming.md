# Theming guide

Soundwave AI is theme-driven: no component hard-codes a palette. Every colour,
radius, density and shadow is a CSS custom property on `<html>`, written by the
theme store and consumed through Tailwind’s semantic colour names.

```
src/lib/themes.ts          presets, accents, radii, densities, CSS-var builder
src/store/theme.ts         zustand store: current settings + apply + persist
src/components/ThemeProvider.tsx
                           applies the theme, follows the OS, syncs tabs
src/components/theme/ThemePicker.tsx
                           the picker UI (navbar, auth screen, Settings)
index.html                 inline bootstrap script (no flash before React)
tailwind.config.js         token → Tailwind colour map
src/index.css              `.sw-*` component classes + default tokens
```

## Tokens

A preset defines these tokens (space-separated RGB triplets, so Tailwind
opacity modifiers keep working — `bg-primary/20` compiles to
`rgb(var(--sw-primary) / 0.2)`):

| Group | Tokens |
| --- | --- |
| Surfaces | `bg`, `bg-deep`, `surface`, `surface-2`, `surface-3`, `surface-inset` |
| Lines | `border`, `border-strong` |
| Text | `fg`, `fg-strong`, `fg-muted`, `fg-subtle`, `fg-inverse` |
| Brand | `primary`, `primary-soft`, `primary-fg`, `accent`, `accent-soft`, `ring` |
| Status | `success`, `warning`, `danger`, `info` (+ `-soft` for each) |

Non-colour tokens come from the radius/density definitions:
`--sw-radius-card|btn|input`, `--sw-pad-card|panel|row`, `--sw-control-h`,
plus `--sw-shadow-card|lift|pop` from the preset.

## Using tokens in components

```tsx
// Prefer semantic classes — they re-skin instantly with the theme.
<div className="sw-card sw-card-pad">
  <h2 className="text-fg-strong">Title</h2>
  <p className="text-fg-muted">Body</p>
  <Button variant="primary">Go</Button>
</div>
```

Helper classes live in `src/index.css` (`.sw-card`, `.sw-card-pad`,
`.sw-panel`, `.sw-inset`, `.sw-input`, `.sw-chip`, `.sw-nav-link`,
`.sw-icon-btn`, `.sw-link`, `.sw-eyebrow`, `.sw-title`, `.sw-muted`,
`.sw-subtle`, `.sw-label`, `.sw-divider`, `.sw-range`, `.sw-glow`,
`.sw-aurora`).

Never use raw hex colours in components. The only exceptions are genuinely
brand-fixed artwork (the Google “G”, subtitle style defaults that are baked
into the exported video) and canvas painting, which must read the live values:

```tsx
import { cssVarColor } from "../store/theme";

ctx.fillStyle = cssVarColor("accent", 0.9);   // → rgb(139 92 246 / 0.9)
```

`cssVarColor` reads the *applied* variables from `<html>`, so it also picks up
accent overrides. Subscribe to the store keys you care about if you paint only
once per render (see `components/Waveform.tsx`).

## Adding a preset

1. Add an entry to `THEMES` in `src/lib/themes.ts` with `id`, `name`,
   `description`, `appearance` (`"dark"` or `"light"`), a `preview` swatch set
   and the full `tokens` object.
2. If it needs a partner for “follow system”, add it to `THEME_COUNTERPART`.
3. Add the first four tokens to the `PRESETS` map in `index.html` so the
   pre-paint bootstrap can render it without a flash:

   ```js
   mytheme: ["dark", "10 15 28", "17 24 39", "39 51 73", "230 236 245"],
   //          appearance, --sw-bg, --sw-surface, --sw-border, --sw-fg
   ```

4. Run `npm run typecheck` (the `ThemeTokens` interface makes a missing token a
   compile error) and check both appearances for contrast.

Accents are separate: add an entry to `ACCENTS` with `dark` and `light`
variants for `primary`, `primary-soft`, `primary-fg`, `accent`, `accent-soft`
and `ring`. `theme` is the sentinel that keeps the preset’s own colours.

## Behaviour

- **Persistence**: `localStorage["sw.theme.v1"]` holds
  `{ themeId, mode, accentId, radiusId, densityId, reduceMotion }`. Reads are
  validated (unknown ids fall back to the preset default).
- **First paint**: the inline script in `index.html` applies background,
  surface, border, text, radius and density variables before React mounts.
- **Live application**: `applyThemeToDocument()` writes every variable, sets
  `data-theme`, `data-appearance` (`color-scheme`), `data-density` and
  `data-motion` on `<html>`, and updates the `theme-color` meta tag.
- **System mode**: `mode: "system"` follows `prefers-color-scheme`; if the
  selected preset has the wrong appearance for the OS preference the
  counterpart preset is used instead (Midnight ⇄ Daylight, Sunset ⇄ Sandstone,
  …).
- **Cross-tab**: a `storage` listener mirrors changes into every other tab.
- **Reduce motion**: the OS media query *and* the in-app toggle both set
  `data-motion="reduced"`, which disables the decorative animations in
  `index.css` and short-circuits Framer Motion transitions in the UI.

## Testing a theme change

```bash
cd frontend
npm run typecheck
npm run build
npm run dev      # Settings → Appearance, then reload to confirm no flash
```

Checklist for a new preset: light *and* dark rendering, sidebar hover/active
states, buttons (`primary`, `outline`, `ghost`, gradient), badges, the waveform
and subtitle canvases, focus rings, scrollbars, the auth screens and the
loading skeleton.
