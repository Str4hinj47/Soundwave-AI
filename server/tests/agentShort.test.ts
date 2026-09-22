// End-to-end regression test for POST /api/v1/agent/generate-short.
//
// The original failure was `os is not defined`, thrown from the background
// lookup after TTS succeeded — so a real request must travel the whole way
// through script → TTS → background → ffmpeg export to prove the fix.
// Edge TTS is mocked (no network in CI) and the clip library is pre-seeded
// with a real synthetic source, so ffmpeg really renders a video.

import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createApp } from "../src/app.js";
import { JsonStore, setStoreForTests } from "../src/lib/store.js";
import { config, resolveFfmpegPath } from "../src/config.js";

const FAKE_AUDIO = "/tmp/soundwave-fake-vo.wav";
const SOURCE_ID = "E2ESRC0002";

vi.mock("../src/lib/edgeTts.js", () => ({
  synthesizeEdgeTTS: async () => {
    const buf = fs.readFileSync("/tmp/soundwave-fake-vo.wav");
    return {
      audioBase64: buf.toString("base64"),
      mimeType: "audio/mpeg" as const,
      duration: 2.0,
      wordTimings: [
        { word: "Did", start: 0.0, end: 0.3 },
        { word: "you", start: 0.3, end: 0.6 },
        { word: "know", start: 0.6, end: 1.0 },
        { word: "this", start: 1.0, end: 1.4 },
        { word: "fact", start: 1.4, end: 2.0 },
      ],
    };
  },
}));

const { libraryDir, clipsDir, loadState, saveState, resetLibrary, getBackgroundStatus } = await import(
  "../src/lib/backgroundClips.js"
);

let app: ReturnType<typeof createApp>;
let sourceFile = "";

beforeAll(async () => {
  const store = new JsonStore();
  await store.init();
  setStoreForTests(store);
  app = createApp();

  // A stand-in voiceover track for the mocked TTS.
  spawnSync(resolveFfmpegPath(), [
    "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-ar", "24000", FAKE_AUDIO,
  ]);
  expect(fs.existsSync(FAKE_AUDIO)).toBe(true);

  // Seed the clip library with a real long video (stands in for a download).
  resetLibrary();
  const sources = path.join(libraryDir(), "sources");
  fs.mkdirSync(sources, { recursive: true });
  fs.mkdirSync(clipsDir(), { recursive: true });
  sourceFile = path.join(sources, `source_${SOURCE_ID}.mp4`);
  const r = spawnSync(resolveFfmpegPath(), [
    "-y", "-f", "lavfi", "-i", "testsrc=size=320x180:rate=10:duration=150",
    "-c:v", "libx264", "-preset", "ultrafast", "-g", "10", "-pix_fmt", "yuv420p", sourceFile,
  ]);
  expect(r.status, r.stderr?.toString().slice(-400)).toBe(0);

  saveState({
    version: 1,
    source: {
      url: `https://www.youtube.com/watch?v=${SOURCE_ID}`,
      videoId: SOURCE_ID,
      title: "synthetic parkour",
      filePath: sourceFile,
      durationSec: 150,
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
  fs.rmSync(FAKE_AUDIO, { force: true });
});

describe("POST /api/v1/agent/generate-short", () => {
  it("renders a vertical short without the old `os is not defined` failure", async () => {
    const before = getBackgroundStatus();
    expect(before.clipsReady).toBe(0);

    const res = await request(app)
      .post("/api/v1/agent/generate-short")
      .send({ topic: "facts", voice: "en-US-JennyNeural", resolution: "720p", useDefaultBackground: true });

    // Regression guard: the response must never be the old ReferenceError.
    expect(String(res.body?.error ?? "")).not.toMatch(/os is not defined/);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.status).toBe("COMPLETED");

    // A real, playable mp4 came out the other end.
    const dl = await request(app).get(res.body.downloadUrl);
    expect(dl.status).toBe(200);
    expect(dl.body.length).toBeGreaterThan(20_000);

    // Script was produced and returned to the caller.
    expect(typeof res.body.script).toBe("string");
    expect(res.body.script.length).toBeGreaterThan(20);
    expect(res.body.scriptSource).toBe("generated");
    expect(res.body.durationSeconds).toBeCloseTo(2.0, 1);
    expect(res.body.cues).toBeGreaterThan(0);
    expect(res.body.defaults.aspect).toBe("9:16");
    expect(res.body.defaults.background).toMatch(/minecraft_parkour 60s clip/);
  }, 300_000);

  it("consumes and deletes exactly one clip per generated short", async () => {
    const before = getBackgroundStatus();
    const res = await request(app)
      .post("/api/v1/agent/generate-short")
      .send({ topic: "history", voice: "en-US-JennyNeural", resolution: "720p" });
    expect(res.status, JSON.stringify(res.body)).toBe(200);

    const after = getBackgroundStatus();
    expect(after.clipsDelivered).toBe(before.clipsDelivered + 1);

    // Every clip handed out so far is gone from disk — nothing accumulates.
    for (const f of after.clipFiles) {
      expect(fs.existsSync(path.join(clipsDir(), f))).toBe(true); // still queued → present
    }
    const leftover = fs
      .readdirSync(clipsDir())
      .filter((f) => f.endsWith(".mp4") && !after.clipFiles.includes(f));
    expect(leftover, "used clips must be deleted, not left behind").toEqual([]);
  }, 300_000);

  it("accepts a caller-supplied script verbatim", async () => {
    const script = "Custom hook written by the user for this specific short.";
    const res = await request(app)
      .post("/api/v1/agent/generate-short")
      .send({ topic: "facts", script, voice: "en-US-JennyNeural" });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.script).toBe(script);
    expect(res.body.scriptSource).toBe("custom");
  }, 300_000);

  it("rejects an empty script and falls back to a generated one", async () => {
    const res = await request(app)
      .post("/api/v1/agent/generate-short")
      .send({ topic: "motivation", script: "", voice: "en-US-JennyNeural" });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.scriptSource).toBe("generated");
    expect(res.body.script.length).toBeGreaterThan(20);
  }, 300_000);
});

describe("background library endpoints", () => {
  it("exposes which long video is clipped and what is remembered", async () => {
    const res = await request(app).get("/api/v1/agent/background/status");
    expect(res.status).toBe(200);
    expect(res.body.clipSeconds).toBe(60);
    expect(Array.isArray(res.body.usedVideoIds)).toBe(true);
    expect(typeof res.body.clipsDelivered).toBe("number");
    expect(res.body.dirs.clips).toBe(path.join(libraryDir(), "60s"));
  });

  it("reports the clip lifecycle in /defaults", async () => {
    const res = await request(app).get("/api/v1/agent/defaults");
    expect(res.status).toBe(200);
    expect(res.body.background.clipDuration).toBe(60);
    expect(res.body.background.lifecycle).toMatch(/NEW video/i);
    expect(res.body.script.niches).toContain("psychology");
  });

  it("clears the library on reset", async () => {
    const res = await request(app).post("/api/v1/agent/background/reset");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(loadState().queue).toEqual([]);
    expect(fs.existsSync(sourceFile)).toBe(false);
  });
});
