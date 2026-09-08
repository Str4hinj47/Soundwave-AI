import type { CSSProperties } from "react";
import type { SubtitleStyle } from "./types";

/** Convert a hex color + opacity percentage to an rgba() string. */
export function hexToRgba(hex: string, opacityPct: number): string {
  const clean = (hex ?? "#FFFFFF").replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) || 255;
  const g = parseInt(clean.slice(2, 4), 16) || 255;
  const b = parseInt(clean.slice(4, 6), 16) || 255;
  const a = Math.max(0, Math.min(1, opacityPct / 100));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Convert a subtitle style object to inline CSS for the live preview. */
export function subtitleStyleToCss(s: SubtitleStyle): CSSProperties {
  const css: CSSProperties = {
    fontFamily: `'${s.fontFamily}', sans-serif`,
    fontSize: `${s.fontSize}px`,
    fontWeight: s.fontWeight,
    letterSpacing: `${s.letterSpacing}px`,
    lineHeight: s.lineHeight,
    color: hexToRgba(s.color, s.textOpacity),
    background: s.bgOpacity > 0 ? hexToRgba(s.bgColor, s.bgOpacity) : "transparent",
    padding: `${s.bgPadding}px ${s.bgPadding * 1.6}px`,
    borderRadius: `${s.bgRadius}px`,
    textAlign: "center",
    overflowWrap: "break-word",
    wordBreak: "break-word",
    maxWidth: "100%",
  };
  if (s.strokeEnabled && s.strokeWidth > 0) {
    css.WebkitTextStroke = `${s.strokeWidth}px ${s.strokeColor}`;
  }
  if (s.shadowEnabled) {
    css.textShadow = `${s.shadowX}px ${s.shadowY}px ${s.shadowBlur}px ${s.shadowColor}`;
  }
  return css;
}

export interface PositionStyle {
  left?: number | string;
  right?: number | string;
  top?: number | string;
  bottom?: number | string;
  transform?: string;
}

/** Compute absolute positioning within the 16:9 preview. */
export function subtitlePosition(s: SubtitleStyle): PositionStyle {
  if (s.customX != null || s.customY != null) {
    return {
      left: s.customX != null ? `${s.customX}%` : undefined,
      top: s.customY != null ? `${s.customY}%` : undefined,
      transform: "translate(-50%, -50%)",
    };
  }
  const pos: PositionStyle = {};
  if (s.hAlign === "left") pos.left = `${s.margin}px`;
  else if (s.hAlign === "right") pos.right = `${s.margin}px`;
  else pos.left = "50%";
  if (s.vAlign === "top") pos.top = `${s.margin}px`;
  else if (s.vAlign === "middle") pos.top = "50%";
  else pos.bottom = `${s.margin}px`;
  if (s.vAlign === "middle") pos.transform = "translate(-50%, -50%)";
  else if (s.hAlign === "center") pos.transform = "translateX(-50%)";
  return pos;
}
