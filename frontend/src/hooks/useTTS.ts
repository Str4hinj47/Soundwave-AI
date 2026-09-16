import { useCallback, useEffect, useRef, useState } from "react";
import { createOfflineEngine, warmup, type EngineHandle } from "../lib/ttsEngine";
import { decodeAudioBlob, encodeWav, estimateWordTimings, float32ToAudioBuffer, getAudioContext } from "../lib/audio";
import { http } from "../lib/api";
import type { GenerationStatus, VoiceSettings, WordTiming } from "../lib/types";

// ── Text-to-speech hook ─────────────────────────────────────────────────────
// Primary engine: server-side Microsoft Edge Neural voices (node-edge-tts),
// exposed through POST /tts/synthesize. Returns MP3 + word timings.
//
// Fallback: a built-in offline formant synthesizer, used automatically when
// the API is unreachable (e.g. the server is offline) so the studio keeps
// working. Clearly surfaced in the UI as the "demo voice".

interface SynthesizeResponse {
  audioBase64: string;
  mimeType?: string;
  duration?: number;
  wordTimings?: { word: string; start: number; end: number }[];
  used?: number;
  limit?: number;
  resetDate?: string;
}

export interface TTSResult {
  audioBuffer: AudioBuffer;
  audioBlob: Blob;
  duration: number;
  text: string;
  voiceId: string;
  wordTimings: WordTiming[];
  engine: "edge" | "offline" | "clone";
}

export interface UseTTS {
  generate: (text: string, voiceId: string, settings: VoiceSettings) => void;
  cancel: () => void;
  status: GenerationStatus;
  audioBuffer: AudioBuffer | null;
  audioBlob: Blob | null;
  wordTimings: WordTiming[];
  /** Engine that produced the current result ("edge", "clone", or "offline"). */
  engine: "edge" | "offline" | "clone" | null;
  error: string | null;
}

/** Cloned-voice ids are `clone:<profileId>` (see /api/v1/tts/clone). */
const CLONE_PREFIX = "clone:";
export const isCloneVoiceId = (id: string): boolean => id.startsWith(CLONE_PREFIX);
export const cloneProfileIdOf = (voiceId: string): string => voiceId.slice(CLONE_PREFIX.length);

/**
 * Normalise studio markup before synthesis.
 *
 * The Edge TTS endpoint escapes everything it is sent (the text is wrapped in
 * a single SSML `<prosody>` element), so inline SSML *cannot* work. Instead:
 *   - `<break time="500ms"/>` → a comma, which the voice renders as a pause;
 *   - `{say:"word|phonetic"}` → the phonetic spelling ("say it like this");
 *   - `{spell:ABC}`           → "A, B, C" so acronyms are spelled out;
 *   - any remaining tag/directive is stripped so it is never read aloud.
 */
export function cleanTextForTTS(text: string): string {
  return text
    .replace(/<break[^>]*\/?>/gi, ", ")
    .replace(/\{say:\s*"([^"|]*)\|([^"]*)"\s*\}/gi, (_m, _word: string, phonetic: string) => ` ${phonetic} `)
    .replace(/\{say:\s*"([^"|]*)"\s*\}/gi, (_m, word: string) => ` ${word} `)
    .replace(/\{spell:\s*([^}]*)\}/gi, (_m, letters: string) =>
      ` ${String(letters).replace(/[^\p{L}\p{N}]+/gu, "").split("").join(", ")} `,
    )
    .replace(/\{pronounce:\s*"([^"|]*)\|([^"]*)"\s*\}/gi, (_m, _w: string, ph: string) => ` ${ph} `)
    .replace(/<[^>]*>/g, "")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

let offlineEngine: EngineHandle | null = null;
async function getOfflineEngine(): Promise<EngineHandle> {
  if (!offlineEngine) {
    offlineEngine = createOfflineEngine();
    await warmup(offlineEngine);
  }
  return offlineEngine;
}

export function useTTS(onComplete?: (r: TTSResult) => void): UseTTS {
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [wordTimings, setWordTimings] = useState<WordTiming[]>([]);
  const [engine, setEngine] = useState<"edge" | "offline" | "clone" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const finish = useCallback(
    (result: TTSResult) => {
      setAudioBuffer(result.audioBuffer);
      setAudioBlob(result.audioBlob);
      setWordTimings(result.wordTimings);
      setEngine(result.engine);
      setError(null);
      setStatus("done");
      onCompleteRef.current?.(result);
    },
    [],
  );

  const runOfflineFallback = useCallback(
    async (text: string, voiceId: string, settings: VoiceSettings) => {
      try {
        const engine = await getOfflineEngine();
        const r = await engine.synth({ text, voiceId, settings });
        const ctx = getAudioContext();
        const buffer = float32ToAudioBuffer(r.samples, r.sampleRate, ctx);
        const blob = encodeWav(buffer);
        const timings = estimateWordTimings(text, buffer.duration);
        // Best-effort usage accounting (server may be unreachable).
        void http.post("/tts/usage", { voiceId, characterCount: text.length, audioDurationSeconds: buffer.duration }).catch(() => undefined);
        finish({ audioBuffer: buffer, audioBlob: blob, duration: buffer.duration, text, voiceId, wordTimings: timings, engine: "offline" });
      } catch {
        setStatus("error");
        setError("Speech generation failed. Check your connection and try again.");
      }
    },
    [finish],
  );

  const generate = useCallback(
    (text: string, voiceId: string, settings: VoiceSettings) => {
      const clean = cleanTextForTTS(text);
      if (!clean) return;

      const id = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      requestId.current = id;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus("generating");
      setError(null);

      const clonedVoice = isCloneVoiceId(voiceId);

      (async () => {
        try {
          // Cloned voices go through the OmniVoice sidecar proxy; CPU
          // generation is slow, so allow a much longer timeout.
          const res = await http.post<SynthesizeResponse>(
            clonedVoice ? "/tts/clone" : "/tts/synthesize",
            clonedVoice
              ? { text: clean, profileId: cloneProfileIdOf(voiceId), speed: settings.speed }
              : {
                  text: clean,
                  voice: voiceId,
                  speed: settings.speed,
                  pitch: settings.pitch,
                  volume: settings.volume,
                },
            { signal: controller.signal, timeout: clonedVoice ? 600_000 : 60_000 },
          );
          if (requestId.current !== id) return;

          const bytes = Uint8Array.from(atob(res.audioBase64), (c) => c.charCodeAt(0));
          const blob = new Blob([bytes], { type: res.mimeType ?? "audio/mpeg" });
          const buffer = await decodeAudioBlob(blob);
          if (requestId.current !== id) return;

          const timings: WordTiming[] =
            res.wordTimings && res.wordTimings.length > 0
              ? res.wordTimings.map((w) => ({ word: w.word, start: w.start, end: w.end }))
              : estimateWordTimings(clean, buffer.duration);

          // Use the decoded buffer length for duration so the player seek bar,
          // toast, and history all agree (edge-tts pads a little silence).
          finish({
            audioBuffer: buffer,
            audioBlob: blob,
            duration: buffer.duration,
            text: clean,
            voiceId,
            wordTimings: timings,
            engine: clonedVoice ? "clone" : "edge",
          });
        } catch (e) {
          if (requestId.current !== id) return;
          if ((e as Error).name === "AbortError") {
            setStatus("cancelled");
            return;
          }
          if (clonedVoice) {
            // Don't silently swap a cloned voice for the robot demo voice.
            setStatus("error");
            setError((e as Error).message || "Voice-clone generation failed. Is the voice-clone service running?");
            return;
          }
          // API unreachable or failed → offline demo voice.
          await runOfflineFallback(clean, voiceId, settings);
        }
      })();
    },
    [finish, runOfflineFallback],
  );

  const cancel = useCallback(() => {
    requestId.current = null;
    abortRef.current?.abort();
    setStatus("cancelled");
  }, []);

  // Leaving the page mid-generation must not leave the request running (or
  // resolve into a component that no longer exists).
  useEffect(() => {
    return () => {
      requestId.current = null;
      abortRef.current?.abort();
    };
  }, []);

  return {
    generate,
    cancel,
    status,
    audioBuffer,
    audioBlob,
    wordTimings,
    engine,
    error,
  };
}
