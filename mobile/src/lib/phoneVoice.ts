// ── The Soundwave voices on the phone itself ────────────────────────────────
// When the PC is off, replies and the morning briefing are spoken by the
// native EdgeTts plugin (android/…/EdgeTtsPlugin.java): Microsoft's neural
// voices, the same ones the PC uses, synthesized right on the phone. In a
// desktop browser (development) there's no plugin: the text stays on screen.

import { Capacitor, registerPlugin } from "@capacitor/core";

interface EdgeTtsPlugin {
  synthesize(opts: { text: string; voice?: string; rate?: string; url?: string }): Promise<{ audio: string; mime: string; bytes: number }>;
}

const EdgeTts = registerPlugin<EdgeTtsPlugin>("EdgeTts");

export function phoneVoiceAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("EdgeTts");
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** One piece of speech (≤ ~2000 characters) in a Soundwave voice, as MP3. */
export async function synthesizeOnPhone(text: string, voice: string | null | undefined): Promise<{ audio: Uint8Array; mime: string }> {
  if (!phoneVoiceAvailable()) throw new Error("Speaking without the PC works in the Android app.");
  const r = await EdgeTts.synthesize({ text, voice: voice || "en-US-GuyNeural", rate: "-5%" });
  return { audio: fromBase64(r.audio), mime: r.mime || "audio/mpeg" };
}
