// ── Offline fallback TTS engine ─────────────────────────────────────────────
// A lightweight deterministic formant synthesizer used ONLY as a last-resort
// fallback when the server-side Microsoft Neural TTS endpoint is unreachable
// (e.g. the API server is offline). It is surfaced in the UI as the "demo
// voice". The primary engine is server-side edge-tts — see
// server/src/lib/edgeTts.ts and hooks/useTTS.ts.

import type { BackendKind, VoiceSettings } from "./types";
import { OFFLINE_SAMPLE_RATE, normalizeFloat32 } from "./audio";

export interface SynthRequest {
  text: string;
  voiceId: string;
  settings: VoiceSettings;
}

export interface SynthResult {
  samples: Float32Array;
  sampleRate: number;
  duration: number;
}

export interface EngineHandle {
  kind: "offline";
  backend: BackendKind;
  voices(): Promise<string[]>;
  synth(req: SynthRequest): Promise<SynthResult>;
  dispose?(): Promise<void>;
}

// ── Seeded PRNG (mulberry32) for deterministic offline synthesis ────────────
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Syllable {
  start: number;
  dur: number;
  f1: number;
  f2: number;
  f3: number;
  voiced: boolean;
}

function planSyllables(word: string, rnd: () => number, baseF0: number): Syllable[] {
  const cleaned = word.toLowerCase().replace(/[^a-z']/g, "");
  if (cleaned.length === 0) {
    return [{ start: 0, dur: 0.16, f1: 700, f2: 1400, f3: 2600, voiced: true }];
  }
  const vowels = "aeiou";
  // Split into ~vowel-grouped chunks.
  const chunks: string[] = [];
  let cur = "";
  for (const ch of cleaned) {
    cur += ch;
    if (vowels.includes(ch)) {
      chunks.push(cur);
      cur = "";
    }
  }
  if (cur) chunks.push(cur);
  if (chunks.length === 0) chunks.push(cleaned);

  const out: Syllable[] = [];
  let t = 0;
  for (const chunk of chunks) {
    const hasVowel = /[aeiou]/.test(chunk);
    const voiced = hasVowel;
    // Formant centers randomized per syllable within human-ish ranges.
    const f1 = 300 + rnd() * 550;
    const f2 = 900 + rnd() * 1500;
    const f3 = 2200 + rnd() * 1200;
    const dur = (0.07 + rnd() * 0.09) * Math.max(1, chunk.length);
    out.push({ start: t, dur, f1, f2, f3, voiced });
    t += dur;
  }
  // Normalize timings to the word duration computed by the caller.
  const total = t || 0.16;
  for (const s of out) {
    s.start /= total;
    s.dur /= total;
  }
  void baseF0;
  return out;
}

function synthesizeOffline(req: SynthRequest): SynthResult {
  const sampleRate = OFFLINE_SAMPLE_RATE;
  const { text, voiceId, settings } = req;

  // Base pitch per voice — male lower, female higher; slight per-voice variation.
  const seed = hashStr(voiceId);
  // Match the actual neural voice ids (en-US-GuyNeural, en-US-ChristopherNeural,
  // en-GB-RyanNeural, …) — the old /^[ab]m/ pattern never matched, so every
  // male voice silently used the female pitch.
  const isMale = /guy|christopher|ryan|male/i.test(voiceId);
  const baseF0 = (isMale ? 95 : 175) + (seed % 60);
  const pitchFactor = Math.pow(2, (settings.pitch ?? 0) / 100);
  const f0 = baseF0 * pitchFactor;
  const speed = clamp(settings.speed ?? 1, 0.5, 2);

  const rnd = mulberry32(hashStr(text + voiceId));

  const words = text.split(/\s+/).filter(Boolean);
  // Estimate per-word durations (inverse of speed).
  const wordDurs: number[] = words.map((w) => {
    const base = (0.22 + Math.min(0.7, w.length * 0.055)) / speed;
    return base * (0.85 + rnd() * 0.3);
  });

  const gap = 0.12 / speed;
  const totalDur =
    wordDurs.reduce((a, b) => a + b, 0) +
    gap * Math.max(0, words.length - 1) +
    0.15;

  const n = Math.ceil(totalDur * sampleRate) + 1;
  const out = new Float32Array(n);

  let cursor = 0;
  for (let wi = 0; wi < words.length; wi++) {
    const word = words[wi]!;
    const wd = wordDurs[wi]!;
    const syls = planSyllables(word, rnd, f0);
    const wStart = cursor;
    const wEnd = cursor + Math.floor(wd * sampleRate);

    // Pre-compute syllable boundary samples.
    const boundaries = syls.map((s) => ({
      s: wStart + Math.floor(s.start * wd * sampleRate),
      e: wStart + Math.floor((s.start + s.dur) * wd * sampleRate),
    }));

    const nHarm = Math.min(40, Math.floor(4000 / f0));
    const twopi = 2 * Math.PI;

    for (let i = wStart; i < wEnd && i < n; i++) {
      const tSec = (i - wStart) / sampleRate;

      // Find active syllable & interpolation factor.
      let si = 0;
      let localT = 0;
      let interp = 0;
      for (let k = 0; k < syls.length; k++) {
        const b = boundaries[k]!;
        if (i >= b.s && i < b.e) {
          si = k;
          localT = (i - b.s) / Math.max(1, b.e - b.s);
          break;
        }
      }
      if (i >= wEnd) si = syls.length - 1;
      const s = syls[si] ?? syls[0]!;

      // Adjacent syllable for formant interpolation.
      const sNext = syls[Math.min(si + 1, syls.length - 1)] ?? s;
      interp = localT;

      const f1 = lerp(s.f1, sNext.f1, interp);
      const f2 = lerp(s.f2, sNext.f2, interp);
      const f3 = lerp(s.f3, sNext.f3, interp);

      // Glottal source: harmonic-rich (sawtooth-like) signal.
      const phase = twopi * f0 * tSec;
      let sample = 0;
      for (let h = 1; h <= nHarm; h++) {
        const freq = f0 * h;
        const amp = 1 / h;
        // Formant shaping: sum of 3 Gaussian bumps.
        const g =
          gauss(freq, f1, 120) * 1.0 +
          gauss(freq, f2, 180) * 0.8 +
          gauss(freq, f3, 300) * 0.5;
        sample += Math.sin(phase * h + rnd() * 0.02) * amp * g;
      }
      // Fricative noise for consonants (unvoiced parts).
      const noise = (rnd() * 2 - 1) * 0.06 * (s.voiced ? 0.25 : 1);

      // Amplitude envelope per syllable (attack/hold/release).
      const attack = 0.15;
      const release = 0.3;
      let env = 1;
      if (localT < attack) env = localT / attack;
      else if (localT > 1 - release) env = (1 - localT) / release;
      // Word-level soft edges.
      const wEdge = Math.min(1, tSec / 0.02, (wd - tSec) / 0.02);
      sample = (sample * 0.5 + noise) * env * Math.max(0, Math.min(1, wEdge));

      out[i] = out[i]! + clamp(sample, -1, 1);
    }
    cursor = wEnd + Math.floor(gap * sampleRate);
  }

  // Fade out.
  for (let i = Math.max(0, n - Math.floor(0.05 * sampleRate)); i < n; i++) {
    const k = (i - (n - 0.05 * sampleRate)) / (0.05 * sampleRate);
    out[i] = (out[i] ?? 0) * (1 - k);
  }

  // Master normalize: prevent any residual peak above the Int16 ceiling so
  // downstream WAV/MP3 conversion never clips.
  const samples = normalizeFloat32(out);
  return { samples, sampleRate, duration: samples.length / sampleRate };
}

function gauss(x: number, center: number, bw: number): number {
  const d = (x - center) / bw;
  return Math.exp(-d * d);
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function createOfflineEngine(): EngineHandle {
  return {
    kind: "offline",
    backend: "demo",
    voices: async () => [
      "en-US-JennyNeural", "en-US-AnaNeural", "en-GB-SoniaNeural",
      "en-US-ChristopherNeural", "en-US-GuyNeural", "en-GB-RyanNeural",
    ],
    synth: async (req) => synthesizeOffline(req),
  };
}

/** Warm-up: a single short phrase to JIT-compile shaders / spin up runtime. */
export async function warmup(engine: EngineHandle): Promise<void> {
  try {
    await engine.synth({ text: "Ready.", voiceId: "en-US-JennyNeural", settings: { speed: 1, pitch: 0, volume: 100 } });
  } catch {
    /* non-fatal */
  }
}

export { synthesizeOffline };
