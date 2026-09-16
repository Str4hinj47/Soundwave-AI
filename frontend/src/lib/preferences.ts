import { DEFAULT_VOICE_ID, VOICE_BY_ID } from "./voices";

// ── User preferences (localStorage) ────────────────────────────────────────
// Small, dependency-free preference layer shared by Settings and the Studio /
// Video Compositor. Values are validated on read so a stale or hand-edited
// entry can never break a page.

const KEYS = {
  defaultVoice: "sw.default_voice",
  exportQuality: "sw.export_quality",
  autoPlay: "sw.autoplay",
  aspect: "sw.default_aspect",
} as const;

export type ExportQuality = "low" | "medium" | "high";
export type Aspect = "16:9" | "9:16";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage disabled — preferences stay in-memory for this session */
  }
}

export function getDefaultVoice(): string {
  const v = read(KEYS.defaultVoice);
  return v && VOICE_BY_ID[v] ? v : DEFAULT_VOICE_ID;
}

export function setDefaultVoice(voiceId: string): void {
  if (VOICE_BY_ID[voiceId]) write(KEYS.defaultVoice, voiceId);
}

export function getExportQuality(): ExportQuality {
  const v = read(KEYS.exportQuality);
  return v === "low" || v === "high" ? v : "medium";
}

export function setExportQuality(q: ExportQuality): void {
  write(KEYS.exportQuality, q);
}

export function getAutoPlay(): boolean {
  return read(KEYS.autoPlay) !== "false";
}

export function setAutoPlay(v: boolean): void {
  write(KEYS.autoPlay, String(v));
}

export function getDefaultAspect(): Aspect {
  return read(KEYS.aspect) === "9:16" ? "9:16" : "16:9";
}

export function setDefaultAspect(a: Aspect): void {
  write(KEYS.aspect, a);
}
