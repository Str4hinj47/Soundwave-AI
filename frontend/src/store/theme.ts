import { create } from "zustand";
import {
  applyThemeToDocument,
  DEFAULT_THEME_SETTINGS,
  themeCssVars,
  THEME_STORAGE_KEY,
  type DensityId,
  type RadiusId,
  type Theme,
  type ThemeSettings,
  resolveTheme,
} from "../lib/themes";

// ── Theme store ─────────────────────────────────────────────────────────────
// Persisted in localStorage and mirrored onto <html> as CSS custom properties,
// so every themed component re-skins without a re-render pass. Cross-tab sync
// is handled by the `storage` event.

interface ThemeState extends ThemeSettings {
  /** OS-level light/dark preference — used when mode === "system". */
  systemDark: boolean;
  setTheme: (themeId: string) => void;
  setMode: (mode: ThemeSettings["mode"]) => void;
  setAccent: (accentId: string) => void;
  setRadius: (radiusId: RadiusId) => void;
  setDensity: (densityId: DensityId) => void;
  setReduceMotion: (v: boolean) => void;
  reset: () => void;
  /** Currently resolved preset (after system-preference resolution). */
  resolvedTheme: () => Theme;
  /** Internal — mirrors the OS preference and re-applies "system" themes. */
  setSystemDark: (v: boolean) => void;
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readStored(): Partial<ThemeSettings> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<ThemeSettings>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function persist(settings: ThemeSettings): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage disabled (private mode) — theme still applies for this session */
  }
}

const initial: ThemeSettings = { ...DEFAULT_THEME_SETTINGS, ...readStored() };

export const useTheme = create<ThemeState>((set, get) => {
  const commit = (patch: Partial<ThemeSettings>) => {
    const next: ThemeSettings = {
      themeId: get().themeId,
      mode: get().mode,
      accentId: get().accentId,
      radiusId: get().radiusId,
      densityId: get().densityId,
      reduceMotion: get().reduceMotion,
      ...patch,
    };
    set(patch);
    persist(next);
    applyThemeToDocument(next, get().systemDark);
  };

  return {
    ...initial,
    systemDark: systemPrefersDark(),
    setTheme: (themeId) => commit({ themeId, mode: "manual" }),
    setMode: (mode) => commit({ mode }),
    setAccent: (accentId) => commit({ accentId }),
    setRadius: (radiusId) => commit({ radiusId }),
    setDensity: (densityId) => commit({ densityId }),
    setReduceMotion: (reduceMotion) => commit({ reduceMotion }),
    reset: () => commit({ ...DEFAULT_THEME_SETTINGS }),
    resolvedTheme: () => resolveTheme(get(), get().systemDark),
    setSystemDark: (systemDark: boolean) => {
      set({ systemDark });
      if (get().mode === "system") {
        applyThemeToDocument(
          {
            themeId: get().themeId,
            mode: get().mode,
            accentId: get().accentId,
            radiusId: get().radiusId,
            densityId: get().densityId,
            reduceMotion: get().reduceMotion,
          },
          systemDark,
        );
      }
    },
  };
});

/** Read the current settings object (for non-reactive use, e.g. canvas paint). */
export function currentThemeSettings(): ThemeSettings {
  const s = useTheme.getState();
  return {
    themeId: s.themeId,
    mode: s.mode,
    accentId: s.accentId,
    radiusId: s.radiusId,
    densityId: s.densityId,
    reduceMotion: s.reduceMotion,
  };
}

/**
 * Resolve a semantic token to a concrete CSS colour for canvas drawings and
 * inline styles. Re-reads the variables from <html>, so it always reflects the
 * *applied* theme (including accent overrides).
 */
export function cssVarColor(token: string, alpha = 1): string {
  if (typeof window === "undefined") return `rgba(255,255,255,${alpha})`;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--sw-${token}`).trim();
  const channels = raw.length > 0 ? raw : themeCssVars(currentThemeSettings(), true)[`--sw-${token}`];
  if (!channels) return `rgba(255,255,255,${alpha})`;
  return `rgb(${channels} / ${alpha})`;
}
