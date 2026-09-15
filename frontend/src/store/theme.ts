import { create } from "zustand";

export type ThemeMode = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

export const THEME_STORAGE_KEY = "soundwave:theme";

interface ThemeState {
  /** What the user asked for. */
  mode: ThemeMode;
  /** What is actually painted on screen (system mode resolves to dark/light). */
  theme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  /** Flip between the two concrete themes (used by the navbar switch). */
  toggle: () => void;
  /** Re-resolve "system" after an OS-level change. */
  syncSystem: () => void;
}

function prefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return !window.matchMedia("(prefers-color-scheme: light)").matches;
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === "system" ? (prefersDark() ? "dark" : "light") : mode;
}

/** Read the persisted choice, falling back to the OS preference. */
export function readStoredMode(): ThemeMode {
  if (typeof localStorage === "undefined") return "system";
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "dark" || raw === "light" || raw === "system") return raw;
  } catch {
    /* private mode / disabled storage — fall through */
  }
  return "system";
}

/**
 * Paint the theme on <html>. Called from an inline script in index.html before
 * first paint (no flash) and again from the store on every change.
 */
export function applyTheme(theme: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = theme === "dark" ? "#16191D" : "#F7F6F2";
}

export const useTheme = create<ThemeState>((set, get) => ({
  mode: "system",
  theme: "dark",
  setMode: (mode) => {
    const theme = resolveTheme(mode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
    applyTheme(theme);
    set({ mode, theme });
  },
  toggle: () => {
    const next: ResolvedTheme = get().theme === "dark" ? "light" : "dark";
    get().setMode(next);
  },
  syncSystem: () => {
    if (get().mode !== "system") return;
    const theme = resolveTheme("system");
    applyTheme(theme);
    set({ theme });
  },
}));

/** Initialise from storage. Safe to call more than once. */
export function initTheme() {
  const mode = readStoredMode();
  const theme = resolveTheme(mode);
  applyTheme(theme);
  useTheme.setState({ mode, theme });

  if (typeof window !== "undefined" && window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => useTheme.getState().syncSystem();
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
  }
}
