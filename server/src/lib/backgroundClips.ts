// ── Minecraft Parkour Background Clip Library ───────────────────────────────
// One long parkour video is downloaded ONCE, sliced into a library of 60s
// clips, and each generated short consumes exactly one clip. The clip is
// deleted the moment it has been used, and the cursor advances to the next.
//
// When the library runs dry the manager retires that source (deleting the big
// file), remembers its URL so it is never picked again, and goes looking for a
// NEW video — first through the curated list, then by actually searching
// YouTube with yt-dlp. Everything is persisted to state.json, so a restart
// resumes the remaining clips instead of re-downloading the same hour of video.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { config, resolveFfmpegPath } from "../config.js";
import { resolveYtDlpPath, parseYouTubeUrl } from "./ytdlp.js";

/** Length of every background clip the agent draws from. */
export const CLIP_SECS = 60;

// ── Curated high-quality ONLY minecraft parkour — no watermark, clean gameplay
export const CURATED_MINECRAFT_PARKOUR = [
  "https://www.youtube.com/watch?v=tiOl_mcAsF4", // 1 HOUR 2026 high quality
  "https://www.youtube.com/watch?v=BXUA2FncVPI", // 4K 2025 background for Shorts
  "https://www.youtube.com/watch?v=71YeZAUS9NQ", // 4K 60FPS FREE great for Shorts
  "https://www.youtube.com/watch?v=FOX3lBXVeck", // Free2Use drive link
  "https://www.youtube.com/watch?v=85z7jqGAGcc", // 2 Hours
  "https://www.youtube.com/watch?v=Geuaf2Nj_zE",
];

export const BLACKLIST = ["dQw4w9WgXcQ", "NJ1VD4eCcD0"];

export function isBlacklisted(url: string): boolean {
  return BLACKLIST.some((id) => url.includes(id));
}

function intEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const v = parseInt(raw, 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

/** How many 60s clips are cut per slicing pass (bounds disk usage). */
const CLIP_BATCH = intEnv("BACKGROUND_CLIP_BATCH", 10);
/** Refuse sources shorter than this — not enough footage to build a library. */
const MIN_SOURCE_SECS = intEnv("BACKGROUND_MIN_SOURCE_SECS", 120);
/** Refuse sources longer than this — a 12h livestream would fill the disk. */
const MAX_SOURCE_SECS = intEnv("BACKGROUND_MAX_SOURCE_SECS", 3 * 3600);
/** Height cap for the source download (background gets cropped to 9:16 anyway). */
const MAX_HEIGHT = intEnv("BACKGROUND_MAX_HEIGHT", 720);
/** Long videos take a while; give the download its own generous budget. */
const DOWNLOAD_TIMEOUT_MS = intEnv("BACKGROUND_DOWNLOAD_TIMEOUT_MS", 900_000);
/** Re-encode clips instead of stream-copying. Slower, but frame-accurate cuts. */
const REENCODE_CLIPS = (process.env.BACKGROUND_CLIP_REENCODE ?? "").toLowerCase() === "true";
/** Query used to find a NEW video once curated + history are exhausted. */
const SEARCH_QUERY = process.env.BACKGROUND_SEARCH_QUERY ?? "minecraft parkour gameplay no copyright long";

export interface SourceRecord {
  url: string;
  videoId: string;
  title?: string;
  filePath: string;
  durationSec: number;
  /** Seconds of the source already handed out as clips. */
  consumedSec: number;
  acquiredAt: string;
}

export interface ClipState {
  version: 1;
  source: SourceRecord | null;
  /** Clip filenames (not full paths) waiting to be used, in order. */
  queue: string[];
  /** Fully-consumed sources — never selected again. */
  usedVideoIds: string[];
  lastUsedVideoId: string | null;
  clipsDelivered: number;
  sourcesConsumed: number;
}

// ── Paths ───────────────────────────────────────────────────────────────────
export function libraryDir(): string {
  return path.join(config.dataDir, "background_cache", "minecraft_parkour");
}
export function clipsDir(): string {
  return path.join(libraryDir(), "60s");
}
function sourceDir(): string {
  return path.join(libraryDir(), "sources");
}
function stateFile(): string {
  return path.join(libraryDir(), "state.json");
}
export function clipPath(name: string): string {
  return path.join(clipsDir(), name);
}

function emptyState(): ClipState {
  return {
    version: 1,
    source: null,
    queue: [],
    usedVideoIds: [],
    lastUsedVideoId: null,
    clipsDelivered: 0,
    sourcesConsumed: 0,
  };
}

export function loadState(): ClipState {
  try {
    const raw = fs.readFileSync(stateFile(), "utf8");
    const parsed = JSON.parse(raw) as Partial<ClipState>;
    const s = emptyState();
    return {
      ...s,
      ...parsed,
      source: parsed.source ?? null,
      queue: Array.isArray(parsed.queue) ? parsed.queue.filter((q) => typeof q === "string") : [],
      usedVideoIds: Array.isArray(parsed.usedVideoIds)
        ? parsed.usedVideoIds.filter((q) => typeof q === "string")
        : [],
    };
  } catch {
    return emptyState();
  }
}

export function saveState(state: ClipState): void {
  try {
    fs.mkdirSync(libraryDir(), { recursive: true });
    const tmp = `${stateFile()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
    fs.renameSync(tmp, stateFile());
  } catch (e) {
    console.warn("[clips] failed to persist state:", (e as Error).message);
  }
}

/** youtube.com/watch?v=X, youtu.be/X, /shorts/X → X (or "" when unrecognised). */
export function extractVideoId(url: string): string {
  const parsed = parseYouTubeUrl(url);
  if (!parsed) return "";
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "youtu.be") return parsed.pathname.slice(1).split("/")[0] ?? "";
  const v = parsed.searchParams.get("v");
  if (v) return v;
  const m = parsed.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/]+)/);
  return m?.[1] ?? "";
}

// ── Process helpers ─────────────────────────────────────────────────────────
interface RunOutcome {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runProc(command: string, args: string[], timeoutMs: number): Promise<RunOutcome> {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      reject(e);
      return;
    }
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${command} timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

/** yt-dlp is a zipapp on Windows — launch it through the interpreter there. */
function ytDlpInvocation(): { command: string; prefixArgs: string[] } {
  const bin = resolveYtDlpPath();
  if (process.platform === "win32" && !bin.toLowerCase().endsWith(".exe")) {
    return { command: process.env.PYTHON ?? "python", prefixArgs: [bin] };
  }
  return { command: bin, prefixArgs: [] };
}

/** Read a media file's duration by parsing `ffmpeg -i` (no ffprobe needed). */
export async function probeDuration(file: string): Promise<number> {
  try {
    const { stderr } = await runProc(resolveFfmpegPath(), ["-hide_banner", "-i", file], 30_000);
    const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (!m) return 0;
    return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number.parseFloat(m[3] ?? "0");
  } catch {
    return 0;
  }
}

// ── Discovery: find a NEW video to clip ─────────────────────────────────────
interface Candidate {
  url: string;
  videoId: string;
  durationSec: number;
  title?: string;
}

/** Ask yt-dlp to search YouTube — this is how the agent finds genuinely new footage. */
async function searchYouTube(query: string, limit: number): Promise<Candidate[]> {
  const { command, prefixArgs } = ytDlpInvocation();
  try {
    const { code, stdout } = await runProc(
      command,
      [
        ...prefixArgs,
        "--no-warnings",
        "--ignore-config",
        "--flat-playlist",
        "--playlist-end",
        String(limit),
        "--print",
        "%(url)s\t%(duration)s\t%(title)s",
        `ytsearch${limit}:${query}`,
      ],
      120_000,
    );
    if (code !== 0) return [];
    return stdout
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [url, dur, title] = line.split("\t");
        return {
          url: url ?? "",
          videoId: extractVideoId(url ?? ""),
          durationSec: Number.parseFloat(dur ?? "0") || 0,
          title: title?.slice(0, 200),
        };
      })
      .filter((c) => c.url.length > 0);
  } catch (e) {
    console.warn("[clips] YouTube search failed:", (e as Error).message);
    return [];
  }
}

/**
 * Build the ordered list of videos to try: curated first, then live YouTube
 * search results. Anything already consumed (`usedVideoIds`) or blacklisted is
 * skipped — this is the "remember the link you already clipped" behaviour.
 */
export async function discoverSources(usedVideoIds: string[]): Promise<Candidate[]> {
  const used = new Set(usedVideoIds);
  const out: Candidate[] = [];
  const seen = new Set<string>();

  const push = (url: string, durationSec: number, title?: string) => {
    if (!url || isBlacklisted(url)) return;
    const id = extractVideoId(url);
    if (!id || seen.has(id) || used.has(id)) return;
    seen.add(id);
    out.push({ url, videoId: id, durationSec, title });
  };

  for (const url of CURATED_MINECRAFT_PARKOUR) push(url, 0, "curated");

  // Curated list exhausted → go find something new online.
  const found = await searchYouTube(SEARCH_QUERY, 15);
  for (const c of found) push(c.url, c.durationSec, c.title);

  return out;
}

// ── Download one LONG source video ──────────────────────────────────────────
async function downloadSource(c: Candidate): Promise<SourceRecord | null> {
  if (!parseYouTubeUrl(c.url)) {
    console.warn(`[clips] refusing non-YouTube url: ${c.url}`);
    return null;
  }
  fs.mkdirSync(sourceDir(), { recursive: true });
  const filePath = path.join(sourceDir(), `source_${c.videoId || Date.now()}.mp4`);

  const { command, prefixArgs } = ytDlpInvocation();
  const args = [
    ...prefixArgs,
    "--no-playlist",
    "--no-warnings",
    "--ignore-config",
    "--restrict-filenames",
    "-f",
    `bv*[height<=${MAX_HEIGHT}][ext=mp4]+ba[ext=m4a]/b[height<=${MAX_HEIGHT}][ext=mp4]/bv*[height<=${MAX_HEIGHT}]+ba/b`,
    "--merge-output-format",
    "mp4",
    "-o",
    filePath,
    c.url,
  ];
  if (config.ytDlpCookies) args.splice(1, 0, "--cookies", config.ytDlpCookies);

  try {
    const { code, stderr } = await runProc(command, args, DOWNLOAD_TIMEOUT_MS);
    if (code !== 0 || !fs.existsSync(filePath)) {
      console.warn(`[clips] download failed for ${c.url}:`, stderr.split("\n").pop() ?? "unknown error");
      return null;
    }
  } catch (e) {
    console.warn(`[clips] download error for ${c.url}:`, (e as Error).message);
    return null;
  }

  const durationSec = c.durationSec > 0 ? c.durationSec : await probeDuration(filePath);
  if (durationSec > 0 && durationSec < MIN_SOURCE_SECS) {
    console.warn(`[clips] ${c.url} is only ${durationSec}s — too short to build a clip library`);
    fs.rmSync(filePath, { force: true });
    return null;
  }
  if (durationSec > MAX_SOURCE_SECS) {
    console.warn(`[clips] ${c.url} is ${durationSec}s — exceeds ${MAX_SOURCE_SECS}s cap`);
    fs.rmSync(filePath, { force: true });
    return null;
  }

  return {
    url: c.url,
    videoId: c.videoId,
    title: c.title,
    filePath,
    durationSec,
    consumedSec: 0,
    acquiredAt: new Date().toISOString(),
  };
}

// ── Slicing: cut the next batch of 60s clips ────────────────────────────────
async function sliceBatch(source: SourceRecord, count: number): Promise<string[]> {
  fs.mkdirSync(clipsDir(), { recursive: true });
  const stamp = `${Date.now()}_${Math.round(source.consumedSec)}`;
  const pattern = path.join(clipsDir(), `clip_${stamp}_%03d.mp4`);

  const args = ["-hide_banner", "-loglevel", "error", "-y"];
  if (source.consumedSec > 0) args.push("-ss", source.consumedSec.toFixed(3));
  args.push("-i", source.filePath, "-map", "0:v:0", "-an", "-avoid_negative_ts", "make_zero");
  if (REENCODE_CLIPS) {
    args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p");
  } else {
    args.push("-c:v", "copy");
  }
  args.push(
    "-f",
    "segment",
    "-segment_time",
    String(CLIP_SECS),
    "-segment_format",
    "mp4",
    "-reset_timestamps",
    "1",
    "-t",
    String(count * CLIP_SECS),
    pattern,
  );

  const { code, stderr } = await runProc(resolveFfmpegPath(), args, 600_000);
  if (code !== 0) {
    console.warn("[clips] slice failed:", stderr.split("\n").pop() ?? `exit ${code}`);
    return [];
  }

  const produced = fs
    .readdirSync(clipsDir())
    .filter((f) => f.startsWith(`clip_${stamp}_`) && f.endsWith(".mp4"))
    .sort()
    // A clip must actually hold video — skip zero-byte failures.
    .filter((f) => {
      try {
        return fs.statSync(path.join(clipsDir(), f)).size > 50_000;
      } catch {
        return false;
      }
    });
  return produced;
}

// ── Serialise state mutations (concurrent generations share one library) ────
let lock: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.catch(() => undefined);
  return run;
}

export interface AcquiredClip {
  path: string;
  name: string;
  sourceUrl: string;
  clipsRemaining: number;
  freshSource: boolean;
}

/** Drop any queued clips whose files have vanished (manual cleanup, reboots). */
function pruneQueue(state: ClipState): void {
  state.queue = state.queue.filter((n) => {
    try {
      return fs.existsSync(clipPath(n)) && fs.statSync(clipPath(n)).size > 50_000;
    } catch {
      return false;
    }
  });
}

/** Delete a source's big file and record its URL as used, forever. */
function retireSource(state: ClipState): void {
  if (!state.source) return;
  try {
    if (fs.existsSync(state.source.filePath)) fs.rmSync(state.source.filePath, { force: true });
  } catch {}
  if (state.source.videoId && !state.usedVideoIds.includes(state.source.videoId)) {
    state.usedVideoIds.push(state.source.videoId);
  }
  state.lastUsedVideoId = state.source.videoId || state.lastUsedVideoId;
  state.sourcesConsumed += 1;
  state.source = null;
}

/** Grab the next usable 60s clip, downloading/slicing a new source if needed. */
export async function acquireClip(): Promise<AcquiredClip | null> {
  return withLock(async () => {
    const state = loadState();
    pruneQueue(state);
    let freshSource = false;

    // 1. Serve from the existing library.
    if (state.queue.length === 0 && state.source && fs.existsSync(state.source.filePath)) {
      const made = await sliceBatch(state.source, CLIP_BATCH);
      state.queue.push(...made);
      state.source.consumedSec += made.length * CLIP_SECS;
      if (made.length === 0 || state.source.consumedSec >= state.source.durationSec - 1) {
        retireSource(state); // source exhausted → next call finds a new video
      }
      saveState(state);
    }

    // 2. Library empty (or no source) → find a NEW video online and clip it.
    if (state.queue.length === 0) {
      const candidates = await discoverSources(state.usedVideoIds);
      for (const c of candidates) {
        const src = await downloadSource(c);
        if (!src) continue;
        state.source = src;
        freshSource = true;
        const made = await sliceBatch(src, CLIP_BATCH);
        state.queue.push(...made);
        src.consumedSec += made.length * CLIP_SECS;
        if (made.length === 0) {
          retireSource(state);
          continue; // unusable source — try the next candidate
        }
        break;
      }
    }

    pruneQueue(state);
    const name = state.queue.shift();
    if (!name) {
      saveState(state);
      return null;
    }
    state.clipsDelivered += 1;
    saveState(state);

    return {
      path: clipPath(name),
      name,
      sourceUrl: state.source?.url ?? "",
      clipsRemaining: state.queue.length,
      freshSource,
    };
  });
}

/** The clip has been used — delete it from disk and forget it. */
export function releaseClip(p: string): void {
  try {
    if (fs.existsSync(p)) fs.rmSync(p, { force: true });
  } catch (e) {
    console.warn("[clips] failed to delete used clip:", (e as Error).message);
  }
  const state = loadState();
  const name = path.basename(p);
  state.queue = state.queue.filter((q) => q !== name);
  saveState(state);
}

/**
 * Force a specific YouTube URL to become the next source (used when the caller
 * passes an explicit `youtubeUrl`). It is downloaded and sliced immediately,
 * replacing whatever source is currently loaded.
 */
export async function seedSource(url: string): Promise<SourceRecord | null> {
  return withLock(async () => {
    if (isBlacklisted(url) || !parseYouTubeUrl(url)) return null;
    const state = loadState();
    const id = extractVideoId(url);
    if (state.source && state.source.videoId === id && fs.existsSync(state.source.filePath)) {
      return state.source; // already loaded — keep the remaining clips
    }
    const src = await downloadSource({ url, videoId: id, durationSec: 0 });
    if (!src) return null;

    retireSource(state);
    // Seeded footage is user-chosen, so it may be re-seeded later.
    state.usedVideoIds = state.usedVideoIds.filter((u) => u !== id);
    state.source = src;
    const made = await sliceBatch(src, CLIP_BATCH);
    state.queue = made;
    src.consumedSec += made.length * CLIP_SECS;
    saveState(state);
    return made.length > 0 ? src : null;
  });
}

export interface BackgroundStatus {
  clipSeconds: number;
  source: {
    url: string;
    videoId: string;
    title?: string;
    durationSec: number;
    consumedSec: number;
    remainingSec: number;
    present: boolean;
  } | null;
  clipsReady: number;
  clipFiles: string[];
  usedVideoIds: string[];
  lastUsedVideoId: string | null;
  clipsDelivered: number;
  sourcesConsumed: number;
  dirs: { library: string; clips: string };
}

/** Introspection for the /background/status endpoint. */
export function getBackgroundStatus(): BackgroundStatus {
  const state = loadState();
  pruneQueue(state);
  const src = state.source;
  return {
    clipSeconds: CLIP_SECS,
    source: src
      ? {
          url: src.url,
          videoId: src.videoId,
          title: src.title,
          durationSec: src.durationSec,
          consumedSec: src.consumedSec,
          remainingSec: Math.max(0, Math.round(src.durationSec - src.consumedSec)),
          present: fs.existsSync(src.filePath),
        }
      : null,
    clipsReady: state.queue.length,
    clipFiles: state.queue,
    usedVideoIds: state.usedVideoIds,
    lastUsedVideoId: state.lastUsedVideoId,
    clipsDelivered: state.clipsDelivered,
    sourcesConsumed: state.sourcesConsumed,
    dirs: { library: libraryDir(), clips: clipsDir() },
  };
}

/** Delete the whole library — next generation starts from scratch. */
export function resetLibrary(): void {
  try {
    fs.rmSync(libraryDir(), { recursive: true, force: true });
  } catch (e) {
    console.warn("[clips] reset failed:", (e as Error).message);
  }
}
