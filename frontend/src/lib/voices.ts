import type { Accent, Gender, VoiceInfo } from "./types";

// ── Microsoft Edge Neural voice metadata ────────────────────────────────────
// TTS is generated server-side via node-edge-tts (Microsoft Neural voices).
// This is the static mirror used for the landing page, voice library, voice
// picker, and settings. Samples are pre-generated MP3s served from
// /voice-samples/<voiceId>.mp3.

interface VoiceMeta {
  id: string;
  displayName: string;
  gender: Gender;
  accent: Accent;
}

export const VOICE_META: VoiceMeta[] = [
  { id: "en-US-JennyNeural", displayName: "Jenny", gender: "Female", accent: "American" },
  { id: "en-US-AnaNeural", displayName: "Ana", gender: "Female", accent: "American" },
  { id: "en-GB-SoniaNeural", displayName: "Sonia", gender: "Female", accent: "British" },
  { id: "en-US-ChristopherNeural", displayName: "Christopher", gender: "Male", accent: "American" },
  { id: "en-US-GuyNeural", displayName: "Guy", gender: "Male", accent: "American" },
  { id: "en-GB-RyanNeural", displayName: "Ryan", gender: "Male", accent: "British" },
];

export const DEFAULT_VOICE_ID = "en-US-JennyNeural";

export const VOICE_BY_ID: Record<string, VoiceMeta> = Object.fromEntries(
  VOICE_META.map((v) => [v.id, v]),
);

export function sampleUrlFor(voiceId: string): string {
  return `/voice-samples/${voiceId}.mp3`;
}

export function toVoiceInfo(v: VoiceMeta): VoiceInfo {
  return { ...v, sampleUrl: sampleUrlFor(v.id) };
}

export const DEFAULT_VOICES: VoiceInfo[] = VOICE_META.map(toVoiceInfo);

export function displayNameFor(voiceId: string): string {
  return VOICE_BY_ID[voiceId]?.displayName ?? voiceId;
}

/** Group voices by "Accent Gender" for the picker. */
export function groupVoices(voices: VoiceInfo[]): Record<string, VoiceInfo[]> {
  const groups: Record<string, VoiceInfo[]> = {};
  for (const v of voices) {
    const key = `${v.accent} ${v.gender}`;
    (groups[key] ??= []).push(v);
  }
  return groups;
}

export const SAMPLE_SENTENCE =
  "Welcome to Soundwave AI. This is a sample of my voice. I can help you create professional audio content with natural-sounding speech.";
