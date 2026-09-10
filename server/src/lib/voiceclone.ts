import { spawn } from "node:child_process";
import { config, resolveFfmpegPath } from "../config.js";
import { ApiError } from "../middleware/error.js";

// ── OmniVoice sidecar client ────────────────────────────────────────────────
// The actual cloning happens in the Python service (voiceclone/) which holds
// the model in memory. Everything here is a thin, well-behaved proxy with
// timeouts and friendly errors.

export interface CloneProfile {
  id: string;
  name: string;
  createdAt: string;
  hasRefText: boolean;
}

export function voiceCloneConfigured(): boolean {
  return config.voiceCloneUrl.length > 0;
}

function base(): string {
  return config.voiceCloneUrl.replace(/\/+$/, "");
}

class SidecarError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function sidecarFetch(path: string, init: RequestInit = {}, timeoutMs = 15_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${base()}${path}`, { ...init, signal: controller.signal });
  } catch (e) {
    const err = e as Error;
    if (err.name === "AbortError") {
      throw new SidecarError(504, "The voice-cloning service took too long to respond. Try shorter text, or give it more time (CPU generation is slow).");
    }
    throw new SidecarError(
      503,
      "The voice-cloning service isn't reachable. Start it (see voiceclone/README.md: `uvicorn server:app --port 8100`) and set VOICECLONE_URL.",
    );
  } finally {
    clearTimeout(timer);
  }
}

async function sidecarJson<T>(path: string, init: RequestInit = {}, timeoutMs = 15_000): Promise<T> {
  const res = await sidecarFetch(path, init, timeoutMs);
  if (!res.ok) {
    let detail = `Voice-clone service error (${res.status})`;
    try {
      const body = (await res.json()) as { detail?: string };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* keep default */
    }
    throw new SidecarError(res.status === 404 ? 404 : 502, detail);
  }
  return (await res.json()) as T;
}

function toApiError(e: unknown): ApiError {
  if (e instanceof SidecarError) {
    if (e.status === 503) return new ApiError(503, "VOICECLONE_UNAVAILABLE", e.message);
    if (e.status === 504) return new ApiError(504, "VOICECLONE_TIMEOUT", e.message);
    if (e.status === 404) return new ApiError(404, "VOICE_PROFILE_NOT_FOUND", e.message);
    return new ApiError(502, "VOICECLONE_ERROR", e.message);
  }
  return new ApiError(502, "VOICECLONE_ERROR", (e as Error)?.message ?? "Voice cloning failed.");
}

export function assertConfigured(): void {
  if (!voiceCloneConfigured()) {
    throw new ApiError(
      503,
      "VOICECLONE_NOT_CONFIGURED",
      "Voice cloning isn't enabled on this server. Set VOICECLONE_URL to a running OmniVoice sidecar (see voiceclone/README.md).",
    );
  }
}

export async function probeVoiceClone(): Promise<boolean> {
  if (!voiceCloneConfigured()) return false;
  try {
    const res = await sidecarFetch("/health", {}, 3_000);
    return res.ok;
  } catch {
    return false;
  }
}

export async function listCloneProfiles(): Promise<CloneProfile[]> {
  try {
    return await sidecarJson<CloneProfile[]>("/profiles");
  } catch (e) {
    throw toApiError(e);
  }
}

export async function createCloneProfile(input: {
  name: string;
  audio: Buffer;
  filename: string;
  mimeType: string;
  refText?: string;
}): Promise<CloneProfile> {
  try {
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array(input.audio)], { type: input.mimeType }), input.filename);
    fd.append("name", input.name);
    if (input.refText) fd.append("refText", input.refText);
    // Prompt creation runs Whisper when no transcript is given — generous timeout.
    return await sidecarJson<CloneProfile>("/profiles", { method: "POST", body: fd }, 300_000);
  } catch (e) {
    throw toApiError(e);
  }
}

export async function deleteCloneProfile(id: string): Promise<void> {
  try {
    await sidecarJson<unknown>(`/profiles/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (e) {
    throw toApiError(e);
  }
}

export interface CloneSynthResult {
  audioBase64: string;
  mimeType: string;
  duration: number;
  wordTimings: { word: string; start: number; end: number }[];
}

export async function synthesizeClone(input: {
  text: string;
  profileId: string;
  speed?: number;
}): Promise<CloneSynthResult> {
  let res: Response;
  try {
    res = await sidecarFetch(
      "/clone",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input.text, profileId: input.profileId, ...(input.speed != null ? { speed: input.speed } : {}) }),
      },
      config.voiceCloneTimeoutMs,
    );
  } catch (e) {
    throw toApiError(e);
  }
  if (!res.ok) {
    let detail = `Voice-clone generation failed (${res.status})`;
    try {
      const body = (await res.json()) as { detail?: string };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* keep default */
    }
    throw toApiError(new SidecarError(res.status === 404 ? 404 : 502, detail));
  }

  const wav = Buffer.from(await res.arrayBuffer());
  const headerDuration = parseFloat(res.headers.get("x-audio-duration") ?? "0");
  const mp3 = await wavToMp3(wav);
  const duration = Number.isFinite(headerDuration) && headerDuration > 0 ? headerDuration : 0;
  return {
    audioBase64: mp3.toString("base64"),
    mimeType: "audio/mpeg",
    duration,
    // OmniVoice returns no timings — estimate per-word timing so subtitle
    // auto-cueing keeps working (mirrors the client-side estimator).
    wordTimings: estimateWordTimings(input.text, duration),
  };
}

/** WAV (stdin) → MP3 (stdout) via ffmpeg pipes — no temp files. */
function wavToMp3(wav: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      resolveFfmpegPath(),
      ["-hide_banner", "-loglevel", "error", "-f", "wav", "-i", "pipe:0", "-f", "mp3", "-codec:a", "libmp3lame", "-q:a", "4", "pipe:1"],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    const chunks: Buffer[] = [];
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => chunks.push(d));
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new ApiError(502, "AUDIO_CONVERSION_FAILED", stderr.slice(-300) || "ffmpeg mp3 conversion failed"));
    });
    child.stdin.on("error", () => undefined); // EPIPE if ffmpeg exits early
    child.stdin.write(wav);
    child.stdin.end();
  });
}

/** Per-word timing estimate weighted by word length — mirrors
 *  frontend/src/lib/audio.ts estimateWordTimings. */
export function estimateWordTimings(text: string, duration: number): { word: string; start: number; end: number }[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || duration <= 0) return [];
  const weights = words.map((w) => Math.max(1, w.replace(/[^\w]/g, "").length));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const pause = Math.min(0.08, duration * 0.02);
  const usable = Math.max(0, duration - pause * (words.length - 1));
  const timings: { word: string; start: number; end: number }[] = [];
  let t = 0;
  for (let i = 0; i < words.length; i++) {
    const w = (weights[i] ?? 1) / totalWeight;
    const dur = Math.max(0.08, usable * w);
    timings.push({ word: words[i] ?? "", start: Number(t.toFixed(3)), end: Number((t + dur).toFixed(3)) });
    t += dur + pause;
  }
  return timings;
}

/** Tiny audio magic-byte check for reference clips. */
export function sniffAudio(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  const s = (off: number, len: number) => buf.toString("latin1", off, off + len);
  if (s(0, 4) === "RIFF" && s(8, 4) === "WAVE") return true; // wav
  if (s(0, 3) === "ID3" || (buf[0] === 0xff && (buf[1]! & 0xe0) === 0xe0)) return true; // mp3
  if (s(0, 4) === "OggS") return true; // ogg
  if (s(0, 4) === "fLaC") return true; // flac
  if (buf.subarray(4, 8).toString("hex") === "66747970") return true; // m4a (ftyp)
  return false;
}
