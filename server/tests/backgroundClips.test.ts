// Exercises the REAL background clip library (lib/backgroundClips.ts):
// slice a long video → hand out one 60s clip → delete it → next clip →
// when the source runs out, retire it, delete the big file, remember its URL.
//
// YouTube is unreachable in CI, so the "download" step is simulated by placing
// a real synthetic long video where the downloader would put it and recording
// it in state.json. Everything after that (ffmpeg slicing, clip deletion,
// state persistence, source retirement, URL memory) is the production path.

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { config, resolveFfmpegPath } from "../src/config.js";

// Small batches so a short synthetic source still proves multi-batch slicing.
process.env.BACKGROUND_CLIP_BATCH = "2";

const {
  acquireClip,
  releaseClip,
  loadState,
  saveState,
  getBackgroundStatus,
  discoverSources,
  extractVideoId,
  probeDuration,
  libraryDir,
  clipsDir,
  clipPath,
  resetLibrary,
  CLIP_SECS,
  isBlacklisted,
} = await import("../src/lib/backgroundClips.js");

const SOURCE_ID = "TESTSRC0001";
const SOURCE_URL = `https://www.youtube.com/watch?v=${SOURCE_ID}`;
let sourceFile = "";
const SOURCE_SECS = 150;

beforeAll(() => {
  resetLibrary();
  const sources = path.join(libraryDir(), "sources");
  fs.mkdirSync(sources, { recursive: true });
  fs.mkdirSync(clipsDir(), { recursive: true });
  sourceFile = path.join(sources, `source_${SOURCE_ID}.mp4`);

  // Real 150s video with a keyframe every second so stream-copy cuts land.
  const r = spawnSync(resolveFfmpegPath(), [
    "-y",
    "-f", "lavfi",
    "-i", `testsrc=size=64x64:rate=10:duration=${SOURCE_SECS}`,
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-g", "10",
    "-pix_fmt", "yuv420p",
    sourceFile,
  ]);
  expect(r.status, r.stderr?.toString().slice(-500)).toBe(0);
  expect(fs.statSync(sourceFile).size).toBeGreaterThan(100_000);

  // Exactly what downloadSource() would have persisted after a real download.
  saveState({
    version: 1,
    source: {
      url: SOURCE_URL,
      videoId: SOURCE_ID,
      title: "synthetic parkour",
      filePath: sourceFile,
      durationSec: SOURCE_SECS,
      consumedSec: 0,
      acquiredAt: new Date().toISOString(),
    },
    queue: [],
    usedVideoIds: [],
    lastUsedVideoId: null,
    clipsDelivered: 0,
    sourcesConsumed: 0,
  });
});

afterAll(() => {
  resetLibrary();
});

describe("minecraft parkour clip library", () => {
  // One ordered walk-through of the whole lifecycle the agent runs in
  // production, so the clip ordering is unambiguous.
  it("slices, serves, deletes, exhausts and retires the source in order", async () => {
    // ── acquire #1 — empty library, so the source gets sliced into a batch ──
    const a = await acquireClip();
    expect(a).not.toBeNull();
    expect(fs.existsSync(a!.path)).toBe(true);
    expect(a!.sourceUrl).toBe(SOURCE_URL);
    expect(a!.freshSource).toBe(false);

    let st = loadState();
    expect(st.queue.length).toBe(1); // rest of the batch waits in line
    expect(st.clipsDelivered).toBe(1);
    expect(st.source?.consumedSec).toBe(2 * CLIP_SECS);

    // The clip is real footage of roughly the requested length, not a stub.
    const dur = await probeDuration(a!.path);
    expect(dur).toBeGreaterThan(CLIP_SECS * 0.5);
    expect(dur).toBeLessThan(CLIP_SECS * 1.6);

    // ── release #1 — the used clip must vanish from disk ──────────────────
    const aPath = a!.path;
    releaseClip(aPath);
    expect(fs.existsSync(aPath), "used clip must be deleted").toBe(false);

    // ── acquire #2 — served straight off the queue, no re-slicing ──────────
    const b = await acquireClip();
    expect(b).not.toBeNull();
    expect(b!.name).not.toBe(a!.name);
    expect(fs.existsSync(b!.path)).toBe(true);
    expect(loadState().source?.consumedSec).toBe(2 * CLIP_SECS);
    expect(loadState().queue.length).toBe(0);

    const bPath = b!.path;
    releaseClip(bPath);
    expect(fs.existsSync(bPath), "used clip must be deleted").toBe(false);

    // ── acquire #3 — queue drained, so the tail of the source gets cut ─────
    // 120s of the 150s source is gone; the last 30s yields one final clip.
    const c = await acquireClip();
    expect(c).not.toBeNull();
    expect(fs.existsSync(c!.path)).toBe(true);

    st = loadState();
    expect(fs.existsSync(sourceFile), "exhausted source file must be deleted").toBe(false);
    expect(st.source, "retired source must be cleared").toBeNull();
    expect(st.usedVideoIds).toContain(SOURCE_ID); // ← the link is remembered
    expect(st.lastUsedVideoId).toBe(SOURCE_ID);
    expect(st.sourcesConsumed).toBe(1);
    expect(getBackgroundStatus().source).toBeNull();

    releaseClip(c!.path);
    expect(fs.existsSync(c!.path)).toBe(false);

    // ── acquire #4 — out of clips, no source, YouTube unreachable ──────────
    // Degrade to null so the caller falls back to a solid background.
    const d = await acquireClip();
    expect(d).toBeNull();
  }, 300_000);

  it("never offers an already-clipped URL again", async () => {
    const candidates = await discoverSources([SOURCE_ID]);
    const ids = candidates.map((c) => c.videoId);
    expect(ids).not.toContain(SOURCE_ID);
    // Curated list still available (minus anything already used).
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) expect(isBlacklisted(c.url)).toBe(false);
  }, 180_000);

  it("parses every supported YouTube URL shape into a video id", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=abc123XYZ_-")).toBe("abc123XYZ_-");
    expect(extractVideoId("https://youtu.be/abc123XYZ_-")).toBe("abc123XYZ_-");
    expect(extractVideoId("https://www.youtube.com/shorts/abc123XYZ_-")).toBe("abc123XYZ_-");
    expect(extractVideoId("https://example.com/watch?v=abc123XYZ_-")).toBe("");
  });

  it("rejects blacklisted urls", () => {
    expect(isBlacklisted("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(isBlacklisted(SOURCE_URL)).toBe(false);
  });

  it("survives a corrupt state file", () => {
    const statePath = path.join(libraryDir(), "state.json");
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, "{not json", "utf8");
    const state = loadState();
    expect(state.queue).toEqual([]);
    expect(state.source).toBeNull();
    expect(state.usedVideoIds).toEqual([]);
  });

  it("drops queued clips whose files were deleted behind its back", async () => {
    const fake = clipPath("clip_ghost_000.mp4");
    saveState({
      version: 1,
      source: null,
      queue: ["clip_ghost_000.mp4"],
      usedVideoIds: [],
      lastUsedVideoId: null,
      clipsDelivered: 0,
      sourcesConsumed: 0,
    });
    expect(fs.existsSync(fake)).toBe(false);
    expect(getBackgroundStatus().clipsReady).toBe(0);
  });

  it("keeps its cache inside the configured data dir", () => {
    expect(libraryDir()).toContain(config.dataDir);
    expect(clipsDir()).toBe(path.join(libraryDir(), "60s"));
  });
});
