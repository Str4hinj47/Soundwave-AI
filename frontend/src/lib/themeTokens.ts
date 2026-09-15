/**
 * Canvas code can't consume CSS variables directly, so it reads the resolved
 * RGB channels from the document root and composes `rgb(r g b / a)` strings.
 * Call it inside a draw loop (or an effect that depends on the theme) so the
 * visualisations follow the active theme.
 */
export function tokenChannels(name: string): string {
  if (typeof window === "undefined") return "128 128 128";
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(`--c-${name}`)
    .trim();
  return value || "128 128 128";
}

/** `tokenColor("accent", 0.5)` → `rgb(138 163 187 / 0.5)` */
export function tokenColor(name: string, alpha = 1): string {
  return alpha >= 1 ? `rgb(${tokenChannels(name)})` : `rgb(${tokenChannels(name)} / ${alpha})`;
}
