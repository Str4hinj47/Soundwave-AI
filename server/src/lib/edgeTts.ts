// ── Microsoft Edge TTS (neural voices) wrapper ──────────────────────────────
// Uses the free, key-less Microsoft Edge online TTS service via node-edge-tts.
// Produces crisp 24 kHz mono MP3 audio plus word-boundary timings (when the
// service returns metadata). No local model, no API key.
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { EdgeTTS } from "node-edge-tts";

export interface EdgeVoiceInput {
  text: string;
  voice: string;
  /** 0.5 .. 2.0 multiplier, mapped to SSML prosody rate. */
  speed?: number;
  /** -50 .. +50 (%), mapped to SSML prosody pitch. */
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

/** Studio "speed" is a multiplier (0.5..2.0) → SSML rate percentage. */
function rateString(speed: number | undefined): string {
  if (speed == null || speed === 1) return "default";
  const pct = Math.round((speed - 1) * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

function pitchString(pitch: number | undefined): string {
  if (pitch == null || pitch === 0) return "default";
  const pct = Math.round(Math.min(50, Math.max(-50, pitch)));
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

function volumeString(volume: number | undefined): string {
  if (volume == null || volume >= 100) return "default";
  const pct = Math.round(Math.min(0, Math.max(-100, volume - 100)));
  return `${pct}%`;
}

/** lang is derived from the voice id ("en-US-JennyNeural" → "en-US"). */
function langFor(voice: string): string {
  const m = /^[a-z]{2,3}-[A-Z]{2,3}/.exec(voice);
  return m ? m[0] : "en-US";
}

/** MP3 byte length → approximate duration (96 kbps CBR). Fallback only. */
function estimateDurationMp3(bytes: number): number {
  return (bytes * 8) / 96000;
}

export async function synthesizeEdgeTTS(input: EdgeVoiceInput): Promise<EdgeSynthResult> {
  const dir = fs.mkdtempSync(path.join(tmpdir(), "swtts-"));
  const audioPath = path.join(dir, "out.mp3");
  try {
    const tts = new EdgeTTS({
      voice: input.voice,
      lang: langFor(input.voice),
      outputFormat: OUTPUT_FORMAT,
      saveSubtitles: true,
      rate: rateString(input.speed),
      pitch: pitchString(input.pitch),
      volume: volumeString(input.volume),
      timeout: 20_000,
    });
    await tts.ttsPromise(input.text, audioPath);

    const buf = fs.readFileSync(audioPath);
    if (buf.length === 0) throw new Error("Edge TTS returned empty audio.");

    // Word-boundary metadata (written next to the audio when saveSubtitles is on).
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
  } catch (edgeError) {
    // Edge TTS failed — fallback to synthetic duration estimation
    throw new Error(`Edge TTS failed: ${(edgeError as Error).message}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Regenerate one voice sample clip (used by scripts/generate-samples.ts). */
export async function synthesizeSample(text: string, voice: string): Promise<Buffer> {
  const dir = fs.mkdtempSync(path.join(tmpdir(), "swsamp-"));
  const audioPath = path.join(dir, `${randomUUID()}.mp3`);
  try {
    const tts = new EdgeTTS({
      voice,
      lang: langFor(voice),
      outputFormat: OUTPUT_FORMAT,
      saveSubtitles: false,
      timeout: 20_000,
    });
    await tts.ttsPromise(text, audioPath);
    return fs.readFileSync(audioPath);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}