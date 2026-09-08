import { useCallback, useRef, useState } from "react";
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
  engine: "edge" | "offline";
}

export interface UseTTS {
  generate: (text: string, voiceId: string, settings: VoiceSettings) => void;
  cancel: () => void;
  status: GenerationStatus;
  audioBuffer: AudioBuffer | null;
  audioBlob: Blob | null;
  wordTimings: WordTiming[];
  /** Engine that produced the current result ("edge" or "offline"). */
  engine: "edge" | "offline" | null;
  error: string | null;
}

/** Studio inserts <break time="500ms"/> tags; the edge-tts API escapes all
 *  markup, so convert pauses to punctuation and drop any other tags. */
export function cleanTextForTTS(text: string): string {
  return text
    .replace(/<break[^>]*\/?>/gi, ", ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s{2,}/g, " ")
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
  const [engine, setEngine] = useState<"edge" | "offline" | null>(null);
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

      (async () => {
        try {
          const res = await http.post<SynthesizeResponse>(
            "/tts/synthesize",
            {
              text: clean,
              voice: voiceId,
              speed: settings.speed,
              pitch: settings.pitch,
              volume: settings.volume,
            },
            { signal: controller.signal, timeout: 60_000 },
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
            engine: "edge",
          });
        } catch (e) {
          if (requestId.current !== id) return;
          if ((e as Error).name === "AbortError") {
            setStatus("cancelled");
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
