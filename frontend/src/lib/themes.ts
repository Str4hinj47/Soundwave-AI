// ── Theme system ────────────────────────────────────────────────────────────
// Soundwave AI ships with selectable themes. A theme is a set of semantic
// colour tokens (stored as space-separated RGB triplets so Tailwind's opacity
// modifiers keep working), plus an appearance (dark/light) used for
// `color-scheme`. Users can additionally override the accent pair, corner
// radius, and UI density — all of it stored in localStorage and applied to
// <html> as CSS custom properties.
//
// Token → Tailwind colour mapping lives in tailwind.config.js; defaults live in
// src/index.css so the UI renders correctly before React mounts.

export type Appearance = "dark" | "light";

/** Every colour token a theme must define (space-separated RGB channels). */
export interface ThemeTokens {
  bg: string;
  "bg-deep": string;
  surface: string;
  "surface-2": string;
  "surface-3": string;
  "surface-inset": string;
  border: string;
  "border-strong": string;
  fg: string;
  "fg-strong": string;
  "fg-muted": string;
  "fg-subtle": string;
  "fg-inverse": string;
  primary: string;
  "primary-soft": string;
  "primary-fg": string;
  accent: string;
  "accent-soft": string;
  success: string;
  "success-soft": string;
  warning: string;
  "warning-soft": string;
  danger: string;
  "danger-soft": string;
  info: string;
  "info-soft": string;
  ring: string;
}

export interface ThemeShadows {
  card: string;
  lift: string;
  pop: string;
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  appearance: Appearance;
  /** Colour swatches used by the picker preview (plain CSS colours). */
  preview: { bg: string; surface: string; primary: string; accent: string };
  tokens: ThemeTokens;
  shadows: ThemeShadows;
}

const shadow = (a: string, b: string, c: string): ThemeShadows => ({ card: a, lift: b, pop: c });

export const THEMES: Theme[] = [
  {
    id: "midnight",
    name: "Midnight",
    description: "The Soundwave signature — deep navy with blue → violet light.",
    appearance: "dark",
    preview: { bg: "#0A0F1C", surface: "#111827", primary: "#3B82F6", accent: "#8B5CF6" },
    tokens: {
      bg: "10 15 28",
      "bg-deep": "6 10 20",
      surface: "17 24 39",
      "surface-2": "25 34 52",
      "surface-3": "36 47 68",
      "surface-inset": "13 19 32",
      border: "39 51 73",
      "border-strong": "58 72 99",
      fg: "230 236 245",
      "fg-strong": "255 255 255",
      "fg-muted": "165 176 197",
      "fg-subtle": "126 139 164",
      "fg-inverse": "10 15 28",
      primary: "59 130 246",
      "primary-soft": "147 197 253",
      "primary-fg": "255 255 255",
      accent: "139 92 246",
      "accent-soft": "196 181 253",
      success: "16 185 129",
      "success-soft": "110 231 183",
      warning: "245 158 11",
      "warning-soft": "252 211 77",
      danger: "239 68 68",
      "danger-soft": "252 165 165",
      info: "56 189 248",
      "info-soft": "125 211 252",
      ring: "96 165 250",
    },
    shadows: shadow(
      "0 1px 2px rgba(0,0,0,.5), 0 8px 24px -12px rgba(0,0,0,.6)",
      "0 14px 34px -14px rgba(0,0,0,.7)",
      "0 26px 60px -22px rgba(0,0,0,.8)",
    ),
  },
  {
    id: "aurora",
    name: "Aurora",
    description: "Emerald and cyan over deep teal — calm, focused, studio-green.",
    appearance: "dark",
    preview: { bg: "#06181B", surface: "#0C2427", primary: "#10B981", accent: "#22D3EE" },
    tokens: {
      bg: "6 24 27",
      "bg-deep": "3 16 19",
      surface: "12 36 39",
      "surface-2": "17 49 53",
      "surface-3": "26 65 69",
      "surface-inset": "8 29 32",
      border: "28 69 72",
      "border-strong": "43 94 96",
      fg: "226 245 243",
      "fg-strong": "255 255 255",
      "fg-muted": "156 191 189",
      "fg-subtle": "114 151 150",
      "fg-inverse": "6 24 27",
      primary: "16 185 129",
      "primary-soft": "110 231 183",
      "primary-fg": "4 32 25",
      accent: "34 211 238",
      "accent-soft": "165 243 252",
      success: "52 211 153",
      "success-soft": "167 243 208",
      warning: "251 191 36",
      "warning-soft": "253 230 138",
      danger: "248 113 113",
      "danger-soft": "254 202 202",
      info: "56 189 248",
      "info-soft": "125 211 252",
      ring: "45 212 191",
    },
    shadows: shadow(
      "0 1px 2px rgba(0,0,0,.55), 0 8px 24px -12px rgba(2,20,22,.75)",
      "0 14px 34px -14px rgba(2,20,22,.85)",
      "0 26px 60px -22px rgba(2,20,22,.9)",
    ),
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "Warm amber and rose over plum — golden-hour energy for voice work.",
    appearance: "dark",
    preview: { bg: "#1A0E16", surface: "#24141E", primary: "#FB923C", accent: "#F472B6" },
    tokens: {
      bg: "26 14 22",
      "bg-deep": "18 9 15",
      surface: "36 20 30",
      "surface-2": "50 28 40",
      "surface-3": "66 38 53",
      "surface-inset": "30 16 25",
      border: "76 44 58",
      "border-strong": "103 62 77",
      fg: "250 236 235",
      "fg-strong": "255 255 255",
      "fg-muted": "206 174 179",
      "fg-subtle": "163 129 137",
      "fg-inverse": "26 14 22",
      primary: "251 146 60",
      "primary-soft": "253 186 116",
      "primary-fg": "45 20 8",
      accent: "244 114 182",
      "accent-soft": "249 168 212",
      success: "52 211 153",
      "success-soft": "167 243 208",
      warning: "250 204 21",
      "warning-soft": "254 240 138",
      danger: "248 113 113",
      "danger-soft": "254 202 202",
      info: "96 165 250",
      "info-soft": "191 219 254",
      ring: "251 146 60",
    },
    shadows: shadow(
      "0 1px 2px rgba(0,0,0,.55), 0 8px 26px -12px rgba(30,10,20,.8)",
      "0 14px 34px -14px rgba(30,10,20,.85)",
      "0 26px 60px -22px rgba(30,10,20,.9)",
    ),
  },
  {
    id: "nebula",
    name: "Nebula",
    description: "Fuchsia and cyan on near-black indigo — high-contrast synthwave.",
    appearance: "dark",
    preview: { bg: "#09081A", surface: "#120F29", primary: "#D946EF", accent: "#22D3EE" },
    tokens: {
      bg: "9 8 26",
      "bg-deep": "5 4 18",
      surface: "18 15 41",
      "surface-2": "26 22 57",
      "surface-3": "37 31 79",
      "surface-inset": "13 11 33",
      border: "54 44 105",
      "border-strong": "78 63 145",
      fg: "235 232 255",
      "fg-strong": "255 255 255",
      "fg-muted": "181 173 215",
      "fg-subtle": "138 129 177",
      "fg-inverse": "9 8 26",
      primary: "217 70 239",
      "primary-soft": "240 171 252",
      "primary-fg": "30 4 38",
      accent: "34 211 238",
      "accent-soft": "165 243 252",
      success: "52 211 153",
      "success-soft": "167 243 208",
      warning: "251 191 36",
      "warning-soft": "253 230 138",
      danger: "251 113 133",
      "danger-soft": "254 205 211",
      info: "96 165 250",
      "info-soft": "191 219 254",
      ring: "232 121 249",
    },
    shadows: shadow(
      "0 1px 2px rgba(0,0,0,.6), 0 8px 24px -12px rgba(80,20,140,.5)",
      "0 14px 34px -14px rgba(80,20,140,.55)",
      "0 26px 60px -22px rgba(80,20,140,.6)",
    ),
  },
  {
    id: "daylight",
    name: "Daylight",
    description: "Bright, crisp light theme — blue and indigo on white.",
    appearance: "light",
    preview: { bg: "#F4F6FB", surface: "#FFFFFF", primary: "#2563EB", accent: "#7C3AED" },
    tokens: {
      bg: "244 246 251",
      "bg-deep": "232 237 246",
      surface: "255 255 255",
      "surface-2": "246 248 252",
      "surface-3": "238 242 249",
      "surface-inset": "249 251 254",
      border: "214 221 233",
      "border-strong": "181 191 209",
      fg: "27 35 50",
      "fg-strong": "9 15 27",
      "fg-muted": "86 99 120",
      "fg-subtle": "117 130 151",
      "fg-inverse": "255 255 255",
      primary: "37 99 235",
      "primary-soft": "29 78 216",
      "primary-fg": "255 255 255",
      accent: "124 58 237",
      "accent-soft": "109 40 217",
      success: "5 150 105",
      "success-soft": "4 120 87",
      warning: "180 83 9",
      "warning-soft": "146 64 14",
      danger: "220 38 38",
      "danger-soft": "185 28 28",
      info: "2 132 199",
      "info-soft": "3 105 161",
      ring: "37 99 235",
    },
    shadows: shadow(
      "0 1px 2px rgba(15,23,42,.06), 0 8px 24px -14px rgba(15,23,42,.25)",
      "0 14px 34px -16px rgba(15,23,42,.3)",
      "0 26px 60px -24px rgba(15,23,42,.35)",
    ),
  },
  {
    id: "sandstone",
    name: "Sandstone",
    description: "Warm light theme — terracotta and rose on soft paper.",
    appearance: "light",
    preview: { bg: "#FAF6F0", surface: "#FFFDFA", primary: "#C2410C", accent: "#BE185D" },
    tokens: {
      bg: "250 246 240",
      "bg-deep": "242 236 227",
      surface: "255 253 250",
      "surface-2": "249 243 234",
      "surface-3": "242 233 221",
      "surface-inset": "253 249 243",
      border: "231 218 201",
      "border-strong": "207 190 168",
      fg: "46 35 27",
      "fg-strong": "28 20 14",
      "fg-muted": "110 90 73",
      "fg-subtle": "142 122 102",
      "fg-inverse": "255 255 255",
      primary: "194 65 12",
      "primary-soft": "154 52 18",
      "primary-fg": "255 255 255",
      accent: "190 24 93",
      "accent-soft": "159 18 57",
      success: "21 128 61",
      "success-soft": "22 101 52",
      warning: "161 98 7",
      "warning-soft": "133 77 14",
      danger: "185 28 28",
      "danger-soft": "153 27 27",
      info: "3 105 161",
      "info-soft": "7 89 133",
      ring: "194 65 12",
    },
    shadows: shadow(
      "0 1px 2px rgba(70,50,30,.07), 0 8px 24px -14px rgba(70,50,30,.25)",
      "0 14px 34px -16px rgba(70,50,30,.3)",
      "0 26px 60px -24px rgba(70,50,30,.35)",
    ),
  },
  {
    id: "graphite",
    name: "Graphite",
    description: "Monochrome, distraction-free — for long editing sessions.",
    appearance: "dark",
    preview: { bg: "#0F1115", surface: "#181B21", primary: "#E2E8F0", accent: "#94A3B8" },
    tokens: {
      bg: "15 17 21",
      "bg-deep": "10 11 14",
      surface: "24 27 33",
      "surface-2": "34 38 46",
      "surface-3": "46 51 62",
      "surface-inset": "19 22 27",
      border: "48 54 65",
      "border-strong": "70 78 92",
      fg: "232 235 240",
      "fg-strong": "255 255 255",
      "fg-muted": "166 173 185",
      "fg-subtle": "126 134 150",
      "fg-inverse": "15 17 21",
      primary: "226 232 240",
      "primary-soft": "241 245 249",
      "primary-fg": "15 17 21",
      accent: "148 163 184",
      "accent-soft": "203 213 225",
      success: "52 211 153",
      "success-soft": "167 243 208",
      warning: "251 191 36",
      "warning-soft": "253 230 138",
      danger: "248 113 113",
      "danger-soft": "254 202 202",
      info: "148 163 184",
      "info-soft": "203 213 225",
      ring: "148 163 184",
    },
    shadows: shadow(
      "0 1px 2px rgba(0,0,0,.5), 0 8px 24px -12px rgba(0,0,0,.65)",
      "0 14px 34px -14px rgba(0,0,0,.7)",
      "0 26px 60px -22px rgba(0,0,0,.75)",
    ),
  },
];

export const DEFAULT_THEME_ID = "midnight";
export const THEME_BY_ID: Record<string, Theme> = Object.fromEntries(
  THEMES.map((t) => [t.id, t]),
);

export function getTheme(id: string): Theme {
  return THEME_BY_ID[id] ?? THEME_BY_ID[DEFAULT_THEME_ID]!;
}

// ── Accent overrides ────────────────────────────────────────────────────────
// "theme" (default) keeps whatever the preset defines; anything else swaps the
// primary/accent pair while leaving surfaces untouched.

export interface AccentDefinition {
  id: string;
  name: string;
  swatch: string;
  dark: Partial<ThemeTokens>;
  light: Partial<ThemeTokens>;
}

export const ACCENTS: AccentDefinition[] = [
  {
    id: "theme",
    name: "Theme default",
    swatch: "linear-gradient(135deg,#3B82F6,#8B5CF6)",
    dark: {},
    light: {},
  },
  {
    id: "ocean",
    name: "Ocean",
    swatch: "linear-gradient(135deg,#2563EB,#22D3EE)",
    dark: {
      primary: "59 130 246",
      "primary-soft": "147 197 253",
      "primary-fg": "255 255 255",
      accent: "34 211 238",
      "accent-soft": "165 243 252",
      ring: "96 165 250",
    },
    light: {
      primary: "37 99 235",
      "primary-soft": "29 78 216",
      "primary-fg": "255 255 255",
      accent: "8 145 178",
      "accent-soft": "21 94 117",
      ring: "37 99 235",
    },
  },
  {
    id: "violet",
    name: "Violet",
    swatch: "linear-gradient(135deg,#8B5CF6,#EC4899)",
    dark: {
      primary: "139 92 246",
      "primary-soft": "196 181 253",
      "primary-fg": "255 255 255",
      accent: "236 72 153",
      "accent-soft": "249 168 212",
      ring: "167 139 250",
    },
    light: {
      primary: "124 58 237",
      "primary-soft": "109 40 217",
      "primary-fg": "255 255 255",
      accent: "219 39 119",
      "accent-soft": "190 24 93",
      ring: "124 58 237",
    },
  },
  {
    id: "emerald",
    name: "Emerald",
    swatch: "linear-gradient(135deg,#10B981,#84CC16)",
    dark: {
      primary: "16 185 129",
      "primary-soft": "110 231 183",
      "primary-fg": "4 32 25",
      accent: "132 204 22",
      "accent-soft": "190 242 100",
      ring: "52 211 153",
    },
    light: {
      primary: "5 150 105",
      "primary-soft": "4 120 87",
      "primary-fg": "255 255 255",
      accent: "77 124 15",
      "accent-soft": "63 98 18",
      ring: "5 150 105",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    swatch: "linear-gradient(135deg,#F97316,#F43F5E)",
    dark: {
      primary: "249 115 22",
      "primary-soft": "253 186 116",
      "primary-fg": "45 20 8",
      accent: "244 63 94",
      "accent-soft": "253 164 175",
      ring: "251 146 60",
    },
    light: {
      primary: "194 65 12",
      "primary-soft": "154 52 18",
      "primary-fg": "255 255 255",
      accent: "190 18 60",
      "accent-soft": "159 18 57",
      ring: "194 65 12",
    },
  },
  {
    id: "cyan",
    name: "Cyan",
    swatch: "linear-gradient(135deg,#06B6D4,#6366F1)",
    dark: {
      primary: "34 211 238",
      "primary-soft": "165 243 252",
      "primary-fg": "8 40 48",
      accent: "99 102 241",
      "accent-soft": "165 180 252",
      ring: "34 211 238",
    },
    light: {
      primary: "8 145 178",
      "primary-soft": "21 94 117",
      "primary-fg": "255 255 255",
      accent: "79 70 229",
      "accent-soft": "67 56 202",
      ring: "8 145 178",
    },
  },
  {
    id: "rose",
    name: "Rose",
    swatch: "linear-gradient(135deg,#F43F5E,#A855F7)",
    dark: {
      primary: "244 63 94",
      "primary-soft": "253 164 175",
      "primary-fg": "255 255 255",
      accent: "168 85 247",
      "accent-soft": "216 180 254",
      ring: "251 113 133",
    },
    light: {
      primary: "190 18 60",
      "primary-soft": "159 18 57",
      "primary-fg": "255 255 255",
      accent: "147 51 234",
      "accent-soft": "126 34 206",
      ring: "190 18 60",
    },
  },
  {
    id: "amber",
    name: "Amber",
    swatch: "linear-gradient(135deg,#F59E0B,#EF4444)",
    dark: {
      primary: "245 158 11",
      "primary-soft": "252 211 77",
      "primary-fg": "42 24 3",
      accent: "239 68 68",
      "accent-soft": "252 165 165",
      ring: "251 191 36",
    },
    light: {
      primary: "180 83 9",
      "primary-soft": "146 64 14",
      "primary-fg": "255 255 255",
      accent: "185 28 28",
      "accent-soft": "153 27 27",
      ring: "180 83 9",
    },
  },
];

export const ACCENT_BY_ID: Record<string, AccentDefinition> = Object.fromEntries(
  ACCENTS.map((a) => [a.id, a]),
);

// ── Radius & density ────────────────────────────────────────────────────────

export type RadiusId = "sharp" | "default" | "round";
export type DensityId = "comfortable" | "compact";

export interface RadiusDefinition {
  id: RadiusId;
  name: string;
  card: string;
  btn: string;
  input: string;
}

export const RADII: RadiusDefinition[] = [
  { id: "sharp", name: "Sharp", card: "6px", btn: "5px", input: "4px" },
  { id: "default", name: "Rounded", card: "14px", btn: "10px", input: "10px" },
  { id: "round", name: "Pill", card: "22px", btn: "999px", input: "14px" },
];

export const RADIUS_BY_ID: Record<string, RadiusDefinition> = Object.fromEntries(
  RADII.map((r) => [r.id, r]),
);

export interface DensityDefinition {
  id: DensityId;
  name: string;
  cardPad: string;
  panelPad: string;
  controlH: string;
  rowPad: string;
}

export const DENSITIES: DensityDefinition[] = [
  { id: "comfortable", name: "Comfortable", cardPad: "20px", panelPad: "16px", controlH: "44px", rowPad: "12px" },
  { id: "compact", name: "Compact", cardPad: "14px", panelPad: "12px", controlH: "38px", rowPad: "8px" },
];

export const DENSITY_BY_ID: Record<string, DensityDefinition> = Object.fromEntries(
  DENSITIES.map((d) => [d.id, d]),
);

// ── Applying a theme ────────────────────────────────────────────────────────

export interface ThemeSettings {
  themeId: string;
  /** "system" follows the OS light/dark preference and picks the closest theme. */
  mode: "manual" | "system";
  accentId: string;
  radiusId: RadiusId;
  densityId: DensityId;
  reduceMotion: boolean;
}

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  themeId: DEFAULT_THEME_ID,
  mode: "manual",
  accentId: "theme",
  radiusId: "default",
  densityId: "comfortable",
  reduceMotion: false,
};

/** The preset that best matches a system light/dark preference. */
export function themeForSystemPreference(dark: boolean): string {
  return dark ? "midnight" : "daylight";
}

/**
 * Counterpart used when "Follow system" is on and the selected preset has the
 * wrong appearance for the current OS preference. Dark presets fall back to a
 * light partner and vice-versa, so the user's chosen palette is respected
 * whenever it already matches.
 */
export const THEME_COUNTERPART: Record<string, Partial<Record<Appearance, string>>> = {
  midnight: { light: "daylight" },
  aurora: { light: "daylight" },
  nebula: { light: "daylight" },
  graphite: { light: "daylight" },
  sunset: { light: "sandstone" },
  daylight: { dark: "midnight" },
  sandstone: { dark: "sunset" },
};

export function resolveTheme(settings: ThemeSettings, systemDark: boolean): Theme {
  const selected = getTheme(settings.themeId);
  if (settings.mode !== "system") return selected;
  const wanted: Appearance = systemDark ? "dark" : "light";
  if (selected.appearance === wanted) return selected;
  const counterpart = THEME_COUNTERPART[selected.id]?.[wanted];
  return getTheme(counterpart ?? themeForSystemPreference(systemDark));
}

/** Build the full CSS-variable map for a settings object. */
export function themeCssVars(settings: ThemeSettings, systemDark: boolean): Record<string, string> {
  const theme = resolveTheme(settings, systemDark);
  const accent = ACCENT_BY_ID[settings.accentId] ?? ACCENT_BY_ID.theme!;
  const accentTokens = theme.appearance === "dark" ? accent.dark : accent.light;
  const tokens: ThemeTokens = { ...theme.tokens, ...accentTokens };
  const radius = RADIUS_BY_ID[settings.radiusId] ?? RADIUS_BY_ID.default!;
  const density = DENSITY_BY_ID[settings.densityId] ?? DENSITY_BY_ID.comfortable!;

  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens)) vars[`--sw-${key}`] = value;
  vars["--sw-radius-card"] = radius.card;
  vars["--sw-radius-btn"] = radius.btn;
  vars["--sw-radius-input"] = radius.input;
  vars["--sw-pad-card"] = density.cardPad;
  vars["--sw-pad-panel"] = density.panelPad;
  vars["--sw-control-h"] = density.controlH;
  vars["--sw-pad-row"] = density.rowPad;
  vars["--sw-shadow-card"] = theme.shadows.card;
  vars["--sw-shadow-lift"] = theme.shadows.lift;
  vars["--sw-shadow-pop"] = theme.shadows.pop;
  return vars;
}

/** `rgb()` string for a token of the resolved theme (for canvas/inline styles). */
export function themeColor(settings: ThemeSettings, token: keyof ThemeTokens, systemDark = false): string {
  const vars = themeCssVars(settings, systemDark);
  return `rgb(${vars[`--sw-${token}`] ?? "255 255 255"})`;
}

/**
 * Apply settings to <html>. Called by the theme store on every change; the
 * same attributes are set by the inline bootstrap script in index.html so the
 * first paint already matches the stored theme.
 */
export function applyThemeToDocument(settings: ThemeSettings, systemDark: boolean): void {
  const root = document.documentElement;
  const theme = resolveTheme(settings, systemDark);
  const vars = themeCssVars(settings, systemDark);
  for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value);
  root.dataset.theme = theme.id;
  root.dataset.appearance = theme.appearance;
  root.dataset.density = settings.densityId;
  root.dataset.motion = settings.reduceMotion ? "reduced" : "full";
  root.style.colorScheme = theme.appearance;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", `rgb(${vars["--sw-bg"]})`);
}

export const THEME_STORAGE_KEY = "sw.theme.v1";
