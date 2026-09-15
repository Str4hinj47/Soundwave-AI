import type { SubtitleCue, WordTiming } from "./types";

// ── Client-side audio helpers ───────────────────────────────────────────────
// All encoding happens in the browser. No audio is uploaded except when the
// user explicitly initiates a video export.
//
// Sample-rate policy: the TTS engine outputs mono 24,000 Hz audio (both the
// offline fallback synth and the server-side edge-tts MP3s). We keep every
// AudioBuffer at its *source* sample rate (24 kHz) and let the Web Audio
// AudioContext resample to the device rate on playback — that is the correct
// and lossless way to handle non-device rates. Resampling is only performed
// explicitly where a codec demands a specific rate (see encodeMp3).

/** Native output sample rate of the offline fallback synth (matches the
 *  edge-tts 24 kHz mono format so downstream code is uniform). */
export const OFFLINE_SAMPLE_RATE = 24000;

/** Coerce any model output into a mono Float32Array with no NaN/Inf.
 *  Accepts Float32Array, number[], nested [L, R] channel pairs, or a
 *  tensor-like `{ data }` object. */
export function toMonoFloat32(audio: unknown): Float32Array {
  if (audio instanceof Float32Array) {
    let dirty = false;
    for (let i = 0; i < audio.length; i++) {
      if (!Number.isFinite(audio[i] as number)) {
        dirty = true;
        break;
      }
    }
    if (!dirty) return audio;
    const out = new Float32Array(audio.length);
    for (let i = 0; i < audio.length; i++) {
      const v = audio[i] as number;
      out[i] = Number.isFinite(v) ? v : 0;
    }
    return out;
  }
  if (Array.isArray(audio)) {
    // Stereo pairs: [left[], right[]] → average into mono.
    if (audio.length > 0 && Array.isArray(audio[0])) {
      const first = audio[0] as number[];
      const out = new Float32Array(first.length);
      for (let i = 0; i < first.length; i++) {
        let sum = 0;
        let n = 0;
        for (const ch of audio as number[][]) {
          const v = ch[i] as number | undefined;
          if (v !== undefined && Number.isFinite(v)) {
            sum += v;
            n++;
          }
        }
        out[i] = n > 0 ? sum / n : 0;
      }
      return out;
    }
    const arr = audio as number[];
    const out = new Float32Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i] as number;
      out[i] = Number.isFinite(v) ? v : 0;
    }
    return out;
  }
  if (audio && typeof audio === "object" && "data" in (audio as object)) {
    return toMonoFloat32((audio as { data: unknown }).data);
  }
  return new Float32Array(0);
}

/** Validate/coerce a model-reported sample rate to a sane value.
 *  Falls back to the native TTS rate of 24 kHz. */
export function normalizeSampleRate(rate: unknown): number {
  const n = typeof rate === "number" ? rate : NaN;
  if (Number.isFinite(n) && n >= 8000 && n <= 384000) return Math.round(n);
  return OFFLINE_SAMPLE_RATE;
}

/** Peak-normalize a mono Float32 buffer: attenuates only when the peak
 *  exceeds `targetPeak`, never amplifies quiet audio, and zeroes NaN/Inf.
 *  This prevents hard-clipping during Int16 conversion. */
export function normalizeFloat32(samples: Float32Array, targetPeak = 0.98): Float32Array {
  let peak = 0;
  let dirty = false;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i] as number;
    if (!Number.isFinite(v)) {
      dirty = true;
      continue;
    }
    const a = Math.abs(v);
    if (a > peak) peak = a;
  }
  if (peak === 0) return new Float32Array(samples.length);
  const gain = peak > targetPeak ? targetPeak / peak : 1;
  if (gain === 1 && !dirty) return samples;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i] as number;
    out[i] = Number.isFinite(v) ? v * gain : 0;
  }
  return out;
}

/** Linear-interpolation resampler (adequate for speech up/down-sampling). */
export function resampleLinear(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate || samples.length === 0 || fromRate <= 0 || toRate <= 0) return samples;
  const ratio = fromRate / toRate;
  const outLen = Math.max(1, Math.round(samples.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const frac = pos - i0;
    const a = samples[i0] ?? 0;
    const b = samples[Math.min(i0 + 1, samples.length - 1)] ?? 0;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

/** Build a mono AudioBuffer at the source sample rate (normalized, NaN-free).
 *  The AudioContext transparently resamples to the device rate on playback. */
export function float32ToAudioBuffer(samples: Float32Array, sampleRate: number, ctx: BaseAudioContext): AudioBuffer {
  const clean = normalizeFloat32(toMonoFloat32(samples));
  const buffer = ctx.createBuffer(1, Math.max(1, clean.length), normalizeSampleRate(sampleRate));
  buffer.getChannelData(0).set(clean.length === buffer.length ? clean : clean.subarray(0, buffer.length));
  return buffer;
}

/** Convert a Float32 array (optionally interleaved) into an AudioBuffer. */
export function samplesToAudioBuffer(
  samples: Float32Array,
  sampleRate: number,
  ctx: AudioContext,
  channels = 1,
): AudioBuffer {
  const length = Math.floor(samples.length / channels);
  const buffer = ctx.createBuffer(channels, length, sampleRate);
  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      const v = samples[i * channels + c];
      data[i] = v !== undefined && Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
    }
  }
  return buffer;
}

export function audioBufferToMono(buffer: AudioBuffer): Float32Array {
  const out = new Float32Array(buffer.length);
  const n = buffer.numberOfChannels;
  for (let c = 0; c < n; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < d.length; i++) out[i] = (out[i] ?? 0) + (d[i] ?? 0);
  }
  if (n > 1) for (let i = 0; i < out.length; i++) out[i] = (out[i] ?? 0) / n;
  return out;
}

export interface WavOptions {
  /** Emit 32-bit IEEE float samples instead of 16-bit PCM. Default: false (16-bit). */
  float32?: boolean;
}

/** Encode an AudioBuffer to a WAV Blob (mono, 16-bit PCM by default,
 *  or 32-bit float). Samples are peak-normalized first so the Int16
 *  conversion can never overflow. Header: PCM format 1 / IEEE-float 3. */
export function encodeWav(buffer: AudioBuffer, options: WavOptions = {}): Blob {
  const samples = normalizeFloat32(audioBufferToMono(buffer));
  const sampleRate = buffer.sampleRate;
  const numChannels = 1;
  const bitsPerSample = options.float32 ? 32 : 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = samples.length * bytesPerSample;
  const bufferSize = 44 + dataSize;
  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, bufferSize - 8, true); // RIFF chunk size
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size (PCM/float, no extension)
  view.setUint16(20, options.float32 ? 3 : 1, true); // 1 = PCM, 3 = IEEE float
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += bytesPerSample) {
    const s = samples[i] ?? 0;
    if (options.float32) {
      view.setFloat32(offset, s, true);
    } else {
      // [-1, 1] → full 16-bit range without asymmetry overflow.
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
  }
  return new Blob([arrayBuffer], { type: "audio/wav" });
}

/** Encode an AudioBuffer to MP3 using lamejs (client-side).
 *  Samples are peak-normalized and resampled to 44.1 kHz — the rate lamejs
 *  is most thoroughly validated against (it also accepts 24 kHz, but 44.1 kHz
 *  MPEG-1 Layer III is universally compatible). */
export async function encodeMp3(buffer: AudioBuffer, kbps = 128): Promise<Blob> {
  const { Mp3Encoder } = await import("lamejs");
  const targetRate = 44100;
  let samples = normalizeFloat32(audioBufferToMono(buffer));
  if (buffer.sampleRate !== targetRate) {
    samples = resampleLinear(samples, buffer.sampleRate, targetRate);
  }
  const encoder = new Mp3Encoder(1, targetRate, kbps);
  const blockSize = 1152;
  const chunks: Int8Array[] = [];
  for (let i = 0; i < samples.length; i += blockSize) {
    const chunk = samples.subarray(i, i + blockSize);
    const int16 = new Int16Array(chunk.length);
    for (let j = 0; j < chunk.length; j++) {
      const s = chunk[j] ?? 0;
      int16[j] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const encoded = encoder.encodeBuffer(int16);
    if (encoded.length > 0) chunks.push(encoded as Int8Array);
  }
  const end = encoder.flush();
  if (end.length > 0) chunks.push(end as Int8Array);
  return new Blob(chunks as BlobPart[], { type: "audio/mpeg" });
}

/** Encode an AudioBuffer to OGG (or WebM) using MediaRecorder.
 *  Uses onended event instead of setTimeout to avoid background-tab throttling.
 *  Falls back to WAV if MediaRecorder is unavailable. */
export async function encodeOgg(buffer: AudioBuffer): Promise<Blob> {
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctor || typeof MediaRecorder === "undefined") {
    // Fallback to WAV when OGG not supported — better than throwing.
    return encodeWav(buffer);
  }
  const ctx = new Ctor();
  try {
    const dest = ctx.createMediaStreamDestination();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(dest);
    const mime = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
      ? "audio/ogg;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/ogg")
        ? "audio/ogg"
        : MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";
    const recorder = new MediaRecorder(dest.stream, { mimeType: mime, audioBitsPerSecond: 128000 });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const done = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        if (chunks.length === 0) {
          // If recorder produced nothing, fallback to WAV.
          resolve(encodeWav(buffer));
        } else {
          resolve(new Blob(chunks, { type: mime.startsWith("audio/ogg") ? "audio/ogg" : "audio/webm" }));
        }
      };
      recorder.onerror = () => reject(new Error("MediaRecorder failed during OGG export."));
    });
    recorder.start(100);
    const ended = new Promise<void>((res) => {
      src.onended = () => res();
    });
    src.start();
    // Wait for source to finish + small headroom, not arbitrary timeout.
    await ended;
    await new Promise((r) => setTimeout(r, 200));
    try { recorder.stop(); } catch { /* ignore */ }
    try { src.stop(); } catch { /* ignore */ }
    return await done;
  } catch {
    // Last resort fallback.
    return encodeWav(buffer);
  } finally {
    try { await ctx.close(); } catch { /* ignore */ }
  }
}

export async function encodeAudio(
  buffer: AudioBuffer,
  format: "mp3" | "wav" | "ogg",
  quality = 128,
): Promise<Blob> {
  switch (format) {
    case "wav":
      return encodeWav(buffer);
    case "mp3":
      return encodeMp3(buffer, quality);
    case "ogg":
      return encodeOgg(buffer);
  }
}

export function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(blob);
  });
}

let sharedCtx: AudioContext | null = null;
export function getAudioContext(): AudioContext {
  if (!sharedCtx) {
    sharedCtx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return sharedCtx;
}

export async function decodeAudioBlob(blob: Blob): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  const ab = await blobToArrayBuffer(blob);
  return ctx.decodeAudioData(ab);
}

export async function audioBlobDuration(blob: Blob): Promise<number> {
  const buffer = await decodeAudioBlob(blob);
  return buffer.duration;
}

/** Estimate word timings by distributing audio duration across words
 *  proportionally to their character counts (fallback when the model does not
 *  expose alignment data). */
export function estimateWordTimings(text: string, duration: number): WordTiming[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const weights = words.map((w) => Math.max(1, w.replace(/[^\w]/g, "").length));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const pause = Math.min(0.08, duration * 0.02);
  const usable = Math.max(0, duration - pause * (words.length - 1));
  const timings: WordTiming[] = [];
  let t = 0;
  for (let i = 0; i < words.length; i++) {
    const w = (weights[i] ?? 1) / totalWeight;
    const dur = Math.max(0.08, usable * w);
    timings.push({ word: words[i] ?? "", start: t, end: t + dur });
    t += dur + pause;
  }
  return timings;
}

/** Build default subtitle cues from word timings grouped into phrases. */
export function cuesFromTimings(timings: WordTiming[], maxChars = 42): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  let current: SubtitleCue | null = null;
  let id = 0;
  for (const t of timings) {
    if (!current || (current.text.length + t.word.length + 1 > maxChars && current.text.length > 0)) {
      current = {
        id: `cue-${id++}`,
        start: round2(t.start),
        end: round2(t.end),
        text: t.word,
      };
      cues.push(current);
    } else {
      current.text = `${current.text} ${t.word}`;
      current.end = round2(t.end);
    }
  }
  return cues;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Trigger a browser download for a Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
