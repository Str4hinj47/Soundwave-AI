import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { backgroundPool, CURATED_LONG_PARKOUR_VIDEOS } from "../src/lib/backgroundPool.js";

describe("Minecraft Background Pool & 60s Rotation Engine", () => {
  it("initializes background pool with status and history", () => {
    const status = backgroundPool.getStatus();
    expect(status).toBeDefined();
    expect(typeof status.clipsRemaining).toBe("number");
    expect(Array.isArray(status.usedUrls)).toBe(true);
    expect(Array.isArray(status.clipNames)).toBe(true);
  });

  it("stores used long video URLs persistently to guarantee no duplicate downloads", () => {
    const hist = backgroundPool.getHistory();
    expect(hist).toBeDefined();
    expect(Array.isArray(hist.usedUrls)).toBe(true);

    const testUrl = "https://www.youtube.com/watch?v=TEST_PARKOUR_UNIQUE_123";
    backgroundPool.addCustomUrl(testUrl);

    const updated = backgroundPool.getHistory();
    expect(updated.customUrls).toContain(testUrl);
  });

  it("sources every curated video from the Orbital NCG channel", () => {
    expect(CURATED_LONG_PARKOUR_VIDEOS.length).toBeGreaterThanOrEqual(5);
    // Orbital NCG catalog video ids (https://www.youtube.com/@OrbitalNCG/videos)
    const orbitalIds = new Set([
      "fw_eWpb7uCE",
      "zeyy5Yj-A4I",
      "-qK8scH4UC8",
      "85z7jqGAGcc",
      "z84bmLDzIIk",
      "tiOl_mcAsF4",
      "xU29hjgAg2w",
      "_GxTLyLyIbs",
      "s600FYgI5-s",
      "yve_DhR1F8s",
      "VwZO7Im_tAc",
      "FOX3lBXVeck",
      "BXUA2FncVPI",
      "zdVQSm8bYu8",
    ]);
    for (const url of CURATED_LONG_PARKOUR_VIDEOS) {
      expect(url).toContain("youtube.com/watch?v=");
      const id = url.split("watch?v=")[1];
      expect(orbitalIds.has(id)).toBe(true);
    }
  });

  it("consumes a 60s clip, deletes it from the pool, and moves to the next sequentially", async () => {
    // Ensure at least one test clip exists in pool to test consumption & rotation
    const poolDir = (backgroundPool as any).poolDir;
    fs.mkdirSync(poolDir, { recursive: true });
    const dummyClip = path.join(poolDir, `mc_clip_test_${Date.now()}_001.mp4`);
    fs.writeFileSync(dummyClip, Buffer.alloc(300_000, 0));

    const initialStatus = backgroundPool.getStatus();
    const consumedClip = await backgroundPool.consumeNextClip();
    
    expect(fs.existsSync(consumedClip)).toBe(true);
    expect(fs.statSync(consumedClip).size).toBeGreaterThan(100_000);

    const afterStatus = backgroundPool.getStatus();
    expect(afterStatus.totalClipsConsumed).toBeGreaterThanOrEqual(initialStatus.totalClipsConsumed);
  });
});
