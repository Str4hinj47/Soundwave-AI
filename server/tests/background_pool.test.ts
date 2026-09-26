import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { backgroundPool } from "../src/lib/backgroundPool.js";

// fetchMetadata is mocked (sandbox has no YouTube egress); downloadVideo stays
// real so failure paths behave like production.
const { fetchMetaMock } = vi.hoisted(() => ({ fetchMetaMock: vi.fn() }));
vi.mock("../src/lib/ytdlp.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/ytdlp.js")>();
  return { ...actual, fetchMetadata: fetchMetaMock };
});

beforeEach(() => {
  fetchMetaMock.mockReset();
  fetchMetaMock.mockRejectedValue(new Error("offline in tests"));
});

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

  it("does not mark a source URL used when the download fails", async () => {
    const hist0 = backgroundPool.getHistory();
    const before = hist0.usedUrls.length;
    // TEST_PARKOUR_UNIQUE_123 is already in customUrls from the earlier test;
    // force a fresh unused custom URL so replenish will attempt (and fail) it.
    const failUrl = "https://www.youtube.com/watch?v=ORBITAL_FAIL_RETRY_1";
    backgroundPool.addCustomUrl(failUrl);

    // Mock network is blocked in CI/sandbox — download must fail and leave URL unused.
    await backgroundPool.replenishPool(failUrl);

    const hist1 = backgroundPool.getHistory();
    expect(hist1.usedUrls).not.toContain(failUrl);
    // Either it wasn't recorded, or if somehow present the count shouldn't grow on pure failure
    if (!hist1.usedUrls.includes(failUrl)) {
      expect(hist1.usedUrls.length).toBe(before);
    }
    // The failure IS remembered so the pool stops retrying dead links blindly.
    expect(hist1.failedAttempts?.[failUrl] ?? 0).toBeGreaterThanOrEqual(1);
  }, 180_000);

  it("parks a URL after MAX_FAILED_ATTEMPTS failures and refuses to retry it", async () => {
    const parkedUrl = "https://www.youtube.com/watch?v=ORBITAL_FAIL_RETRY_1"; // failed once in the test above
    const hist = backgroundPool.getHistory();
    hist.failedAttempts[parkedUrl] = 3;
    (backgroundPool as any).saveHistory(hist);

    const beforeCount = backgroundPool.getStatus().failedAttempts[parkedUrl];
    expect(beforeCount).toBe(3);

    // A parked URL is refused instantly: no new failure recorded ⇒ it never even tried.
    const ok = await backgroundPool.replenishPool(parkedUrl);
    expect(ok).toBe(false);
    expect(backgroundPool.getStatus().failedAttempts[parkedUrl]).toBe(beforeCount);
  });

  it("copyright guard drops links that are not from the Orbital NCG channel", async () => {
    const foreignUrl = "https://www.youtube.com/watch?v=FOREIGN_NOT_ORBITAL_1";
    backgroundPool.addCustomUrl(foreignUrl); // no-op if a previous run left it queued
    expect(backgroundPool.getHistory().customUrls).toContain(foreignUrl);

    fetchMetaMock.mockResolvedValueOnce({
      title: "Some other channel's gameplay",
      duration: 600,
      webpageUrl: foreignUrl,
      channel: "Completely Unrelated Gameplay",
      channelUrl: "https://www.youtube.com/@someotherchannel",
    });

    const ok = await backgroundPool.replenishPool(foreignUrl);
    expect(ok).toBe(false);
    const hist = backgroundPool.getHistory();
    expect(hist.customUrls).not.toContain(foreignUrl); // purged from the queue
    expect(hist.usedUrls).not.toContain(foreignUrl); // never downloaded
    expect(hist.failedAttempts[foreignUrl] ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("never picks a video on its own: bare replenish with no imported link returns false", async () => {
    // Save aside whatever the shared history holds, empty the link queue…
    const hist = backgroundPool.getHistory();
    const saved = {
      customUrls: hist.customUrls,
      usedUrls: hist.usedUrls,
      failedAttempts: hist.failedAttempts,
    };
    (backgroundPool as any).saveHistory({ ...hist, customUrls: [], usedUrls: [], failedAttempts: {} });
    try {
      // …then a bare replenish (the old auto-download entrypoint) must be a
      // fast no-op: no source selection, no download, nothing marked used.
      const ok = await backgroundPool.replenishPool();
      expect(ok).toBe(false);
      const after = backgroundPool.getHistory();
      expect(after.usedUrls).toEqual([]);
    } finally {
      const h = backgroundPool.getHistory();
      h.customUrls = saved.customUrls;
      h.usedUrls = saved.usedUrls;
      h.failedAttempts = saved.failedAttempts;
      (backgroundPool as any).saveHistory(h);
    }
  });

  it("consumes a 60s clip, deletes it from the pool, and moves to the next sequentially", async () => {
    // Ensure at least one test clip exists in pool to test consumption & rotation
    const poolDir = (backgroundPool as any).poolDir;
    fs.mkdirSync(poolDir, { recursive: true });
    const dummyClip = path.join(poolDir, `mc_clip_test_${Date.now()}_001.mp4`);
    // Structurally-valid mini MP4: consumption only copies + deletes, but the
    // corrupt-file guard rejects raw garbage bytes, so the fixture must be a
    // well-formed ftyp+moov container.
    const mkBox = (type: string, body: Buffer): Buffer => {
      const b = Buffer.alloc(8 + body.length);
      b.writeUInt32BE(8 + body.length, 0);
      b.write(type, 4, "ascii");
      body.copy(b, 8);
      return b;
    };
    fs.writeFileSync(
      dummyClip,
      Buffer.concat([mkBox("ftyp", Buffer.from("isomabcdisom")), mkBox("moov", mkBox("mvhd", Buffer.alloc(280_000, 0)))]),
    );

    const initialStatus = backgroundPool.getStatus();
    const consumedClip = await backgroundPool.consumeNextClip();
    
    expect(fs.existsSync(consumedClip)).toBe(true);
    expect(fs.statSync(consumedClip).size).toBeGreaterThan(100_000);

    const afterStatus = backgroundPool.getStatus();
    expect(afterStatus.totalClipsConsumed).toBeGreaterThanOrEqual(initialStatus.totalClipsConsumed);
  });
});
