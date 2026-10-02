// ── Microsoft Edge Neural voice metadata ────────────────────────────────────
// Served via /api/v1/voices and mirrored in the frontend. TTS is generated
// server-side with node-edge-tts (Microsoft Neural voices); these are the
// voices exposed to the user.

export interface VoiceMeta {
  id: string;
  displayName: string;
  gender: "Female" | "Male";
  accent: "American" | "British";
  sampleUrl: string;
}

const RAW: Array<[string, string, "Female" | "Male", "American" | "British"]> = [
  ["en-US-JennyNeural", "Jenny", "Female", "American"],
  ["en-US-AnaNeural", "Ana", "Female", "American"],
  ["en-GB-SoniaNeural", "Sonia", "Female", "British"],
  ["en-US-ChristopherNeural", "Christopher", "Male", "American"],
  ["en-US-GuyNeural", "Guy", "Male", "American"],
  ["en-GB-RyanNeural", "Ryan", "Male", "British"],
];

export const VOICES: VoiceMeta[] = RAW.map(([id, displayName, gender, accent]) => ({
  id,
  displayName,
  gender,
  accent,
  sampleUrl: `/voice-samples/${id}.mp3`,
}));

export const VOICE_IDS = new Set(VOICES.map((v) => v.id));

export function getVoice(id: string): VoiceMeta | null {
  return VOICES.find((v) => v.id === id) ?? null;
}
