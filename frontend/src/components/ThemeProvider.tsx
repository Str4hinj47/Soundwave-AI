import { useEffect, type ReactNode } from "react";
import { applyThemeToDocument, THEME_STORAGE_KEY } from "../lib/themes";
import { currentThemeSettings, useTheme } from "../store/theme";

/**
 * Applies the active theme to <html> and keeps it in sync with the OS
 * light/dark preference plus other browser tabs.
 *
 * The same variables are applied by the inline bootstrap script in index.html
 * so the very first paint already matches the stored theme (no flash).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeId = useTheme((s) => s.themeId);
  const mode = useTheme((s) => s.mode);
  const accentId = useTheme((s) => s.accentId);
  const radiusId = useTheme((s) => s.radiusId);
  const densityId = useTheme((s) => s.densityId);
  const reduceMotion = useTheme((s) => s.reduceMotion);

  // Apply on every relevant change (including the first mount).
  useEffect(() => {
    applyThemeToDocument(currentThemeSettings(), useTheme.getState().systemDark);
  }, [themeId, mode, accentId, radiusId, densityId, reduceMotion]);

  // Follow the OS preference while "system" mode is active.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      useTheme.setState({ systemDark: e.matches });
      if (useTheme.getState().mode === "system") {
        applyThemeToDocument(currentThemeSettings(), e.matches);
      }
    };
    mq.addEventListener("change", onChange);
    // Late-resolving media queries (some embedded browsers) — sync once.
    if (mq.matches !== useTheme.getState().systemDark) {
      useTheme.setState({ systemDark: mq.matches });
      applyThemeToDocument(currentThemeSettings(), mq.matches);
    }
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Cross-tab sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key !== THEME_STORAGE_KEY) return;
      if (!e.newValue) return;
      let stored: Partial<ReturnType<typeof currentThemeSettings>>;
      try {
        stored = JSON.parse(e.newValue) as Partial<ReturnType<typeof currentThemeSettings>>;
      } catch {
        // Another tab (or an extension) wrote something unparseable — ignore
        // it rather than throwing inside a storage listener.
        return;
      }
      if (stored && typeof stored === "object") {
        useTheme.setState(stored);
        applyThemeToDocument(currentThemeSettings(), useTheme.getState().systemDark);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return <>{children}</>;
}
