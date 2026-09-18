import type { SubtitleStyle } from "./types";

/** Portrait captions get +35% — the TikTok/Shorts look needs text that reads
 *  instantly on a tall phone screen. Mirror in server buildAss + standaloneExport. */
export const PORTRAIT_FONT_BOOST = 1.35;

export function isPortraitAspect(aspect: string): boolean {
  return aspect === "9:16";
}

/** Portrait auto-layout: big, centered captions. A custom drag position
 *  (customX/customY) always wins; everything else becomes middle-center. */
export function portraitAdjustedStyle(style: SubtitleStyle, portrait: boolean): SubtitleStyle {
  if (!portrait) return style;
  const sized: SubtitleStyle = { ...style, fontSize: Math.round(style.fontSize * PORTRAIT_FONT_BOOST) };
  if (style.customX != null || style.customY != null) return sized;
  return { ...sized, hAlign: "center", vAlign: "middle" };
}
