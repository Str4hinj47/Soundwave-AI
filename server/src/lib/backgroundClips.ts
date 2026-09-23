// ── Minecraft Parkour Background Clip Library ───────────────────────────────
// One long REAL minecraft gameplay video is downloaded ONCE, sliced into a
// library of 60s clips, and each generated short consumes exactly one clip.
// The clip is deleted the moment it has been used, and the cursor advances.
//
// Sourcing order for a new source:
//   1. Bundled local masters (vendor/minecraft-backgrounds/*.mp4) — real
//      footage shipped with the repo / fetched by scripts/fetch_background_master.py.
//   2. The curated Orbital NCG videos (verified no-copyright gameplay).
//   3. The rest of the Orbital channel, walked newest-first. No other
//      channel is ever used — the metadata gate refuses any video whose
//      channel/uploader is not "Orbital".
//
// Nothing is ever handed out as a "minecraft parkour clip" unless it survives
// two gates:
//   • pre-download metadata gate — the video's title must actually be
//     Minecraft and its duration must fit the library;
//   • post-slice frame gate — sampled frames are analysed and the source is
//     REJECTED when they look like a test pattern (SMPTE/testsrc color bars)
//     or solid/blank footage. Synthetic placeholders can never masquerade as
//     gameplay again.
//
// When the library runs dry the manager retires that source (deleting the big
// downloaded file — never a bundled master), remembers its URL so it is never
// picked again, and looks for a NEW video. Everything persists to state.json,
// so a restart resumes the remaining clips instead of re-downloading the same
// hour of video.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { config, resolveFfmpegPath } from "../config.js";
import { resolveYtDlpPath, parseYouTubeUrl } from "./ytdlp.js";

/** Length of every background clip the agent draws from. */
export const CLIP_SECS = 60;

// ── Source: Orbital - No Copyright Gameplay (https://www.youtube.com/@OrbitalNCG)
// ALL automatic background downloads come from this one channel. Every video
// on it is public, no-copyright / free-to-use minecraft parkour gameplay
// ("You can monetize your content with this copyright free gameplay"), and
// the download gate additionally refuses anything whose channel/uploader
// does not match, so no other channel can ever slip in.
// Credits required by the channel: mention it in the video description and
// don't re-upload the footage as "No Copyright Gameplay" (see the CREDITS.txt
// written by scripts/fetch_background_master.py).
export const ORBITAL_CHANNEL_URL = "https://www.youtube.com/@OrbitalNCG/videos";
const ORBITAL_CHANNEL_RE = /orbital/i;

// Curated highlights from the channel, verified live on 2026-09-23. Longest
// first; the vertical one needs no cropping for 9:16 shorts. The rest of the
// channel is walked automatically (newest first) once these are consumed.
export const CURATED_MINECRAFT_PARKOUR = [
  "https://www.youtube.com/watch?v=fw_eWpb7uCE", // 4:53:37 VERTICAL 9:16
  "https://www.youtube.com/watch?v=85z7jqGAGcc", // 2:29:21
  "https://www.youtube.com/watch?v=_GxTLyLyIbs", // 1:16:18 4K
  "https://www.youtube.com/watch?v=tiOl_mcAsF4", // 1:10:24
  "https://www.youtube.com/watch?v=BXUA2FncVPI", // 10:30 4K
  "https://www.youtube.com/watch?v=zdVQSm8bYu8", // 10:02
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
const MAX_SOURCE_SECS = intEnv("BACKGROUND_MAX_SOURCE_SECS", 6 * 3600);
/** Height cap for the source download (background gets cropped to 9:16 anyway). */
const MAX_HEIGHT = intEnv("BACKGROUND_MAX_HEIGHT", 720);
/** Long videos take a while; give the download its own generous budget. */
const DOWNLOAD_TIMEOUT_MS = intEnv("BACKGROUND_DOWNLOAD_TIMEOUT_MS", 900_000);
/** Re-encode clips instead of stream-copying. Slower, but frame-accurate cuts. */
const REENCODE_CLIPS = (process.env.BACKGROUND_CLIP_REENCODE ?? "").toLowerCase() === "true";
/** How many of the channel's newest videos to look at when the curated list is exhausted. */
const CHANNEL_SCAN_LIMIT = intEnv("BACKGROUND_CHANNEL_SCAN_LIMIT", 40);

/** Title must actually be Minecraft footage — keeps short clips / junk out. */
const MINECRAFT_TITLE_RE = /minecraft/i;

export interface SourceRecord {
  url: string;
  videoId: string;
  title?: string;
  filePath: string;
  durationSec: number;
  /** Seconds of the source already handed out as clips. */
  consumedSec: number;
  acquiredAt: string;
  /** Bundled local master — the file is the user's, NEVER deleted on retire. */
  local?: boolean;
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

/** Run ffmpeg and capture BINARY stdout (rawvideo frames must not be text-decoded). */
function runFfmpegBinary(args: string[], timeoutMs: number): Promise<{ code: number; data: Buffer }> {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(resolveFfmpegPath(), [...["-hide_banner", "-loglevel", "error"], ...args], {
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (e) {
      reject(e);
      return;
    }
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {}
      reject(new Error(`ffmpeg frame probe timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    child.stdout.on("data", (d: Buffer) => chunks.push(d));
    child.stderr.on("data", () => {});
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, data: Buffer.concat(chunks) });
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

// ── Gate 1: metadata — must BE minecraft footage FROM the Orbital channel ──
export interface YtMeta {
  title: string;
  durationSec: number;
  uploader?: string;
  channel?: string;
}

/** Cheap yt-dlp metadata fetch (no download). Null when unreachable/unknown. */
export async function fetchYouTubeMeta(url: string): Promise<YtMeta | null> {
  const { command, prefixArgs } = ytDlpInvocation();
  try {
    const { code, stdout } = await runProc(
      command,
      [
        ...prefixArgs,
        "--no-warnings",
        "--ignore-config",
        "--no-playlist",
        "--print",
        "%(title)s\t%(duration)s\t%(uploader)s\t%(channel)s",
        url,
      ],
      60_000,
    );
    if (code !== 0) return null;
    const line = stdout.split("\n").map((l) => l.trim()).find(Boolean);
    if (!line) return null;
    const [title, dur, uploader, channel] = line.split("\t");
    return {
      title: title ?? "",
      durationSec: Number.parseFloat(dur ?? "0") || 0,
      uploader: uploader || undefined,
      channel: channel || undefined,
    };
  } catch (e) {
    console.warn("[clips] metadata fetch failed:", (e as Error).message);
    return null;
  }
}

/** The only channel automatic downloads may come from. */
export function isOrbitalSource(meta: Pick<YtMeta, "uploader" | "channel">): boolean {
  return ORBITAL_CHANNEL_RE.test(`${meta.uploader ?? ""} ${meta.channel ?? ""}`);
}

// ── Gate 2: frames — reject test patterns and blank/solid footage ───────────
export interface FootageVerdict {
  ok: boolean;
  reason: string;
}

/** Set BACKGROUND_FOOTAGE_CHECK=false to bypass (tests simulate downloads). */
export function footageCheckEnabled(): boolean {
  return (process.env.BACKGROUND_FOOTAGE_CHECK ?? "true").toLowerCase() !== "false";
}

const FW_W = 160;
const FW_H = 90;
const FW_SAMPLES = 5;
/** Neighbouring profile points closer than this are "flat". */
const FW_FLAT_DIFF = 2.5;
/** A jump above this is a colour-band boundary. */
const FW_SHARP_DIFF = 40;
/** Primary signature: mostly-flat profile with 6+ boundaries (7-bar pattern). */
const FW_MIN_FLAT_RATIO = 0.55;
const FW_MIN_TRANSITIONS = 6;
/** Secondary signature: many sharp boundaries (testsrc2-style, noise-mixed). */
const FW_MIN_FLAT_RATIO2 = 0.42;
const FW_MIN_TRANSITIONS2 = 9;
/** Global per-channel RMS below this = a blank/solid frame. */
const FW_SOLID_FRAME_STD = 3;

async function grabFrame(file: string, t: number): Promise<Buffer | null> {
  const size = FW_W * FW_H * 3;
  try {
    const { code, data } = await runFfmpegBinary(
      ["-ss", t.toFixed(2), "-i", file, "-frames:v", "1", "-vf", `scale=${FW_W}:${FW_H}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"],
      60_000,
    );
    if (code !== 0 || data.length < size) return null;
    return data.subarray(0, size);
  } catch {
    return null;
  }
}

interface ProfileStats {
  flatRatio: number;
  transitions: number;
}

/** Profile of a 1-D colour curve: fraction of flat neighbours + sharp jumps. */
function analyzeProfile(profile: number[][]): ProfileStats {
  const diffs: number[] = [];
  for (let x = 1; x < profile.length; x++) {
    diffs.push(Math.hypot(profile[x]![0]! - profile[x - 1]![0]!, profile[x]![1]! - profile[x - 1]![1]!, profile[x]![2]! - profile[x - 1]![2]!));
  }
  return {
    flatRatio: diffs.filter((d) => d < FW_FLAT_DIFF).length / diffs.length,
    transitions: diffs.filter((d) => d > FW_SHARP_DIFF).length,
  };
}

/** Colour bars live in the upper 75% of the frame; testsrc's noise block sits
 *  bottom-right, so the column profile is taken over rows [0, 0.75H). */
function isBandProfile(frame: Buffer): boolean {
  const colTop = Math.floor(FW_H * 0.75);
  const col: number[][] = [];
  for (let x = 0; x < FW_W; x++) {
    let r = 0,
      g = 0,
      b = 0;
    for (let y = 0; y < colTop; y++) {
      const i = (y * FW_W + x) * 3;
      r += frame[i]!;
      g += frame[i + 1]!;
      b += frame[i + 2]!;
    }
    col.push([r / colTop, g / colTop, b / colTop]);
  }
  const row: number[][] = [];
  for (let y = 0; y < FW_H; y++) {
    const off = y * FW_W * 3;
    let r = 0,
      g = 0,
      b = 0;
    for (let x = 0; x < FW_W; x++) {
      r += frame[off + x * 3]!;
      g += frame[off + x * 3 + 1]!;
      b += frame[off + x * 3 + 2]!;
    }
    row.push([r / FW_W, g / FW_W, b / FW_W]);
  }
  return (
    isBand(analyzeProfile(col)) || isBand(analyzeProfile(row))
  );
}

function isBand(a: ProfileStats): boolean {
  return (
    (a.flatRatio >= FW_MIN_FLAT_RATIO && a.transitions >= FW_MIN_TRANSITIONS) ||
    (a.flatRatio >= FW_MIN_FLAT_RATIO2 && a.transitions >= FW_MIN_TRANSITIONS2)
  );
}

function globalStd(frame: Buffer): number {
  const n = FW_W * FW_H;
  let r = 0,
    g = 0,
    b = 0;
  for (let i = 0; i < n * 3; i += 3) {
    r += frame[i]!;
    g += frame[i + 1]!;
    b += frame[i + 2]!;
  }
  const mr = r / n,
    mg = g / n,
    mb = b / n;
  let v = 0;
  for (let i = 0; i < n * 3; i += 3) {
    v += (frame[i]! - mr) ** 2 + (frame[i + 1]! - mg) ** 2 + (frame[i + 2]! - mb) ** 2;
  }
  return Math.sqrt(v / (3 * n));
}

/**
 * Sample frames across the clip and reject anything that is NOT real footage:
 *  • colour-bar profile — a mostly-flat column/row colour curve with many
 *    sharp boundaries (SMPTE bars, ffmpeg testsrc/testsrc2 — the exact
 *    synthetic pattern that slipped into the library);
 *  • every sampled frame essentially one colour → blank/solid placeholder.
 * Real gameplay (sky + textured terrain, moving camera) has no long flat
 * profile with 6+ full-width colour boundaries, so it passes comfortably.
 */
export async function verifyFootage(file: string): Promise<FootageVerdict> {
  const dur = await probeDuration(file);
  if (dur <= 0) return { ok: false, reason: "no readable video stream" };

  let bandFrames = 0;
  let solidFrames = 0;
  let seen = 0;
  for (let i = 0; i < FW_SAMPLES; i++) {
    const t = (dur * (i + 0.5)) / FW_SAMPLES;
    const frame = await grabFrame(file, t);
    if (!frame) continue;
    seen++;
    if (isBandProfile(frame)) bandFrames++;
    if (globalStd(frame) < FW_SOLID_FRAME_STD) solidFrames++;
  }
  if (seen === 0) return { ok: false, reason: "could not sample frames" };
  if (bandFrames >= 3) return { ok: false, reason: "synthetic test pattern (color bars) detected" };
  if (solidFrames >= 3 && solidFrames === seen) return { ok: false, reason: "solid/blank footage" };
  return { ok: true, reason: "ok" };
}

// ── Bundled local masters (real footage shipped with the repo) ──────────────
/** Every *.mp4 in vendor/minecraft-backgrounds/ (fetched by the helper script). */
export function bundledMasterFiles(): string[] {
  const dirs = [
    path.join(process.cwd(), "vendor", "minecraft-backgrounds"),
    path.join(process.cwd(), "..", "vendor", "minecraft-backgrounds"),
  ];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const d of dirs) {
    let entries: string[] = [];
    try {
      entries = fs.readdirSync(d);
    } catch {
      continue;
    }
    for (const f of entries) {
      if (!/\.mp4$/i.test(f)) continue;
      const full = path.join(d, f);
      const key = path.resolve(full);
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        if (fs.statSync(full).size > 500_000) out.push(full);
      } catch {}
    }
  }
  return out;
}

/** Adopt a bundled master as a source without downloading (file is user-owned). */
async function adoptBundledMaster(file: string): Promise<SourceRecord | null> {
  const durationSec = await probeDuration(file);
  if (durationSec < MIN_SOURCE_SECS) {
    console.warn(`[clips] bundled master ${file} is only ${durationSec}s — too short for a clip library`);
    return null;
  }
  const base = path.basename(file);
  return {
    url: `local:${base}`,
    videoId: `local_${base}`,
    title: `bundled master ${base}`,
    filePath: file,
    durationSec,
    consumedSec: 0,
    acquiredAt: new Date().toISOString(),
    local: true,
  };
}

// ── Discovery: find a NEW video to clip ─────────────────────────────────────
interface Candidate {
  url: string;
  videoId: string;
  durationSec: number;
  title?: string;
}

/**
 * Walk the Orbital channel's video list (newest first). This is how the agent
 * finds genuinely new footage — always from the one approved channel.
 * `--flat-playlist` avoids probing every entry for full metadata.
 */
async function listOrbitalChannel(limit: number): Promise<Candidate[]> {
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
        ORBITAL_CHANNEL_URL,
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
    console.warn("[clips] Orbital channel list fetch failed:", (e as Error).message);
    return [];
  }
}

/**
 * Build the ordered list of videos to try: curated Orbital highlights first,
 * then the rest of the Orbital channel (newest first). Anything already
 * consumed (`usedVideoIds`) or blacklisted is skipped. Channel-walk results
 * must at least claim to be Minecraft in the title and fit the duration
 * range — the downloadSource() metadata gate re-checks the channel + title
 * for every candidate before any download starts.
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

  // Curated list exhausted → walk the Orbital channel for newer uploads.
  const found = await listOrbitalChannel(CHANNEL_SCAN_LIMIT);
  for (const c of found) {
    if (c.title && !MINECRAFT_TITLE_RE.test(c.title)) continue; // not minecraft
    if (c.durationSec > 0 && (c.durationSec < MIN_SOURCE_SECS || c.durationSec > MAX_SOURCE_SECS)) continue;
    push(c.url, c.durationSec, c.title);
  }

  return out;
}

// ── Download one LONG source video ──────────────────────────────────────────
async function downloadSource(c: Candidate): Promise<SourceRecord | null> {
  if (!parseYouTubeUrl(c.url)) {
    console.warn(`[clips] refusing non-YouTube url: ${c.url}`);
    return null;
  }

  // Gate 1 — channel/title/duration BEFORE spending minutes on a download.
  // Automatic downloads come ONLY from the Orbital channel.
  const meta = await fetchYouTubeMeta(c.url);
  if (meta) {
    if (!isOrbitalSource(meta)) {
      console.warn(`[clips] skipping ${c.url} — from "${meta.channel || meta.uploader || "unknown"}", not the Orbital channel`);
      return null;
    }
    if (!MINECRAFT_TITLE_RE.test(meta.title)) {
      console.warn(`[clips] skipping ${c.url} — title "${meta.title}" is not Minecraft gameplay`);
      return null;
    }
    if (meta.durationSec > 0 && meta.durationSec < MIN_SOURCE_SECS) {
      console.warn(`[clips] skipping ${c.url} — only ${Math.round(meta.durationSec)}s long`);
      return null;
    }
    if (meta.durationSec > MAX_SOURCE_SECS) {
      console.warn(`[clips] skipping ${c.url} — ${Math.round(meta.durationSec)}s exceeds the ${MAX_SOURCE_SECS}s cap`);
      return null;
    }
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
      fs.rmSync(filePath, { force: true });
      return null;
    }
  } catch (e) {
    console.warn(`[clips] download error for ${c.url}:`, (e as Error).message);
    fs.rmSync(filePath, { force: true });
    return null;
  }

  const durationSec = meta?.durationSec ?? (c.durationSec > 0 ? c.durationSec : await probeDuration(filePath));
  if (durationSec > 0 && durationSec < MIN_SOURCE_SECS) {
    console.warn(`[clips] ${c.url} is only ${Math.round(durationSec)}s — too short to build a clip library`);
    fs.rmSync(filePath, { force: true });
    return null;
  }
  if (durationSec > MAX_SOURCE_SECS) {
    console.warn(`[clips] ${c.url} is ${Math.round(durationSec)}s — exceeds ${MAX_SOURCE_SECS}s cap`);
    fs.rmSync(filePath, { force: true });
    return null;
  }

  return {
    url: c.url,
    videoId: c.videoId,
    title: meta?.title ?? c.title,
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

/** Delete a downloaded source's big file and record its URL as used, forever.
 *  Bundled local masters are the user's files — remembered but NEVER deleted. */
function retireSource(state: ClipState): void {
  if (!state.source) return;
  if (!state.source.local) {
    try {
      if (fs.existsSync(state.source.filePath)) fs.rmSync(state.source.filePath, { force: true });
    } catch {}
  }
  if (state.source.videoId && !state.usedVideoIds.includes(state.source.videoId)) {
    state.usedVideoIds.push(state.source.videoId);
  }
  state.lastUsedVideoId = state.source.videoId || state.lastUsedVideoId;
  state.sourcesConsumed += 1;
  state.source = null;
}

/**
 * Slice one batch from a source and verify it is REAL gameplay footage
 * (gate 2). Retires the source — deleting its clips — when verification
 * fails. Returns true when a verified batch is queued.
 */
async function fillVerifiedBatch(state: ClipState, src: SourceRecord): Promise<boolean> {
  const made = await sliceBatch(src, CLIP_BATCH);
  state.queue.push(...made);
  src.consumedSec += made.length * CLIP_SECS;
  if (made.length === 0) {
    retireSource(state);
    return false;
  }
  if (footageCheckEnabled()) {
    const verdict = await verifyFootage(clipPath(made[0]!));
    if (!verdict.ok) {
      console.warn(`[clips] ${src.videoId} REJECTED (${verdict.reason}) — retiring source`);
      for (const n of made) {
        try {
          fs.rmSync(clipPath(n), { force: true });
        } catch {}
      }
      state.queue = state.queue.filter((q) => !made.includes(q));
      retireSource(state);
      return false;
    }
  }
  return true;
}

/** Grab the next usable 60s clip, downloading/slicing a new source if needed. */
export async function acquireClip(): Promise<AcquiredClip | null> {
  return withLock(async () => {
    const state = loadState();
    pruneQueue(state);
    let freshSource = false;

    // 1. Serve from the existing library.
    if (state.queue.length === 0 && state.source && fs.existsSync(state.source.filePath)) {
      const good = await fillVerifiedBatch(state, state.source);
      if (good && state.source.consumedSec >= state.source.durationSec - 1) {
        retireSource(state); // source exhausted → next call finds a new video
      }
      saveState(state);
    }

    // 2a. Bundled local masters — real footage, no download needed.
    if (state.queue.length === 0) {
      for (const file of bundledMasterFiles()) {
        const id = `local_${path.basename(file)}`;
        if (state.usedVideoIds.includes(id)) continue;
        const src = await adoptBundledMaster(file);
        if (!src) continue;
        state.source = src;
        freshSource = true;
        if (await fillVerifiedBatch(state, src)) break;
        continue; // verification failed → try the next candidate
      }
    }

    // 2b. YouTube: curated list first, then live search.
    if (state.queue.length === 0) {
      const candidates = await discoverSources(state.usedVideoIds);
      for (const c of candidates) {
        const src = await downloadSource(c);
        if (!src) continue;
        state.source = src;
        freshSource = true;
        if (await fillVerifiedBatch(state, src)) break;
        continue; // unusable source — try the next candidate
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
 * replacing whatever source is currently loaded — and still has to pass both
 * verification gates, so a test pattern can never be seeded either.
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
    const good = await fillVerifiedBatch(state, src);
    if (!good) {
      console.warn(`[clips] seeded source ${id} failed verification — library stays empty`);
      state.source = null;
      state.queue = [];
      saveState(state);
      return null;
    }
    saveState(state);
    return src;
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
    local: boolean;
  } | null;
  clipsReady: number;
  clipFiles: string[];
  usedVideoIds: string[];
  lastUsedVideoId: string | null;
  clipsDelivered: number;
  sourcesConsumed: number;
  footageCheckEnabled: boolean;
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
          local: Boolean(src.local),
        }
      : null,
    clipsReady: state.queue.length,
    clipFiles: state.queue,
    usedVideoIds: state.usedVideoIds,
    lastUsedVideoId: state.lastUsedVideoId,
    clipsDelivered: state.clipsDelivered,
    sourcesConsumed: state.sourcesConsumed,
    footageCheckEnabled: footageCheckEnabled(),
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
