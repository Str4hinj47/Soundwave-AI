// ── Microsoft Edge TTS (neural voices) wrapper ──────────────────────────────
// Uses the free, key-less Microsoft Edge online TTS service via node-edge-tts.
// Produces crisp 24 kHz mono MP3 audio plus word-boundary timings.
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { EdgeTTS } from "node-edge-tts";

export interface EdgeVoiceInput {
  text: string;
  voice: string;
  /** 0.5 .. 2.0 multiplier, mapped to SSML prosody rate. Default 0.95 for human pacing. */
  speed?: number;
  /** -50 .. +50 (%), mapped to SSML prosody pitch. Default 0. */
  pitch?: number;
  /** 0 .. 100 (%), mapped to SSML prosody volume. */
  volume?: number;
}

export interface EdgeWordTiming {
  word: string;
  start: number; // seconds
  end: number; // seconds
}

export interface EdgeSynthResult {
  audioBase64: string;
  mimeType: "audio/mpeg";
  duration: number; // seconds
  wordTimings: EdgeWordTiming[];
}

const OUTPUT_FORMAT = "audio-24khz-96kbitrate-mono-mp3";

/**
 * Format raw script into natural, human-paced conversational delivery:
 * - Adds pauses after provocative hooks ("Did you know that...", "Here's the truth:")
 * - Adds clear breathing marks after numbers and list items
 * - Ensures sentence boundaries have distinct rhythmic cadence
 */
export function formatNaturalSpeechPacing(text: string): string {
  let paced = text
    .replace(/\s+/g, " ")
    .replace(/(\d+)\.\s+/g, "$1: ")
    .replace(/\b(Did you know that)\b/gi, "$1...")
    .replace(/\b(Believe it or not)\b/gi, "$1,")
    .replace(/\b(The truth is)\b/gi, "$1...")
    .replace(/\b(Here is why|Here's why)\b/gi, "$1:")
    .replace(/\b(In fact)\b/gi, "$1,")
    .replace(/\b(However)\b/gi, "$1,")
    .replace(/\b(Specifically)\b/gi, "$1,")
    .replace(/\b(Think about this)\b/gi, "$1...")
    .trim();

  if (!/[.!?]$/.test(paced)) {
    paced += ".";
  }
  return paced;
}

/** Default pacing multiplier (0.95 = -5% rate) for relaxed, authoritative human cadence. */
function rateString(speed: number | undefined): string {
  const actualSpeed = speed ?? 0.95; // 0.95 gives natural conversational weight
  if (actualSpeed === 1) return "default";
  const pct = Math.round((actualSpeed - 1) * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

function pitchString(pitch: number | undefined): string {
  if (pitch == null || pitch === 0) return "-1Hz"; // subtle warm pitch resonance
  const pct = Math.round(Math.min(50, Math.max(-50, pitch)));
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

function volumeString(volume: number | undefined): string {
  if (volume == null || volume >= 100) return "default";
  const pct = Math.round(Math.min(0, Math.max(-100, volume - 100)));
  return `${pct}%`;
}

/** lang is derived from the voice id ("en-US-ChristopherNeural" → "en-US"). */
function langFor(voice: string): string {
  const m = /^[a-z]{2,3}-[A-Z]{2,3}/.exec(voice);
  return m ? m[0] : "en-US";
}

/** MP3 byte length → approximate duration (96 kbps CBR). Fallback only. */
function estimateDurationMp3(bytes: number): number {
  return (bytes * 8) / 96000;
}

export async function synthesizeEdgeTTS(input: EdgeVoiceInput): Promise<EdgeSynthResult> {
  const pacedText = formatNaturalSpeechPacing(input.text);
  const targetVoice = input.voice || "en-US-ChristopherNeural";

  let lastError: Error | null = null;
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const dir = fs.mkdtempSync(path.join(tmpdir(), "swtts-"));
    const audioPath = path.join(dir, "out.mp3");

    try {
      const tts = new EdgeTTS({
        voice: targetVoice,
        lang: langFor(targetVoice),
        outputFormat: OUTPUT_FORMAT,
        saveSubtitles: true,
        rate: rateString(input.speed),
        pitch: pitchString(input.pitch),
        volume: volumeString(input.volume),
        timeout: 25_000,
      });

      await tts.ttsPromise(pacedText, audioPath);

      const buf = fs.readFileSync(audioPath);
      if (buf.length === 0) throw new Error("Edge TTS returned empty audio buffer.");

      // Word-boundary metadata
      const wordTimings: EdgeWordTiming[] = [];
      const subPath = `${audioPath}.json`;
      if (fs.existsSync(subPath)) {
        try {
          const cues = JSON.parse(fs.readFileSync(subPath, "utf8")) as Array<{
            part: string;
            start: number;
            end: number;
          }>;
          for (const c of cues) {
            const word = String(c.part ?? "").trim();
            if (!word) continue;
            wordTimings.push({ word, start: c.start / 1000, end: c.end / 1000 });
          }
        } catch {
          /* metadata is best-effort */
        }
      }

      const duration = wordTimings.length
        ? wordTimings[wordTimings.length - 1]!.end
        : estimateDurationMp3(buf.length);

      return {
        audioBase64: buf.toString("base64"),
        mimeType: "audio/mpeg",
        duration,
        wordTimings,
      };
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries) {
        // Exponential backoff before retry
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  throw new Error(`Edge TTS failed after retries: ${lastError?.message}`);
}

/** Regenerate one voice sample clip. */
export async function synthesizeSample(text: string, voice: string): Promise<Buffer> {
  const dir = fs.mkdtempSync(path.join(tmpdir(), "swsamp-"));
  const audioPath = path.join(dir, `${randomUUID()}.mp3`);
  try {
    const tts = new EdgeTTS({
      voice,
      lang: langFor(voice),
      outputFormat: OUTPUT_FORMAT,
      saveSubtitles: false,
      rate: rateString(0.95),
      timeout: 20_000,
    });
    await tts.ttsPromise(formatNaturalSpeechPacing(text), audioPath);
    return fs.readFileSync(audioPath);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
