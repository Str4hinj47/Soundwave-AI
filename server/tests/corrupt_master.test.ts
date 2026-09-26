import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "fs";
import os from "os";
import path from "path";

// Use sandbox data + cache dirs BEFORE the pool module reads them, so the
// corrupt fixture never touches the repo's real background_cache.
const origDataDir = process.env.SOUNDWAVE_DATA_DIR;
const origCacheDir = process.env.BACKGROUND_CACHE_DIR;
const tmpData = mkdtempSync(path.join(os.tmpdir(), "sw-corrupt-master-"));
process.env.SOUNDWAVE_DATA_DIR = tmpData;
process.env.BACKGROUND_CACHE_DIR = path.join(tmpData, "background_cache");

const { backgroundPool, backgroundCacheRoot } = await import("../src/lib/backgroundPool.js");
const { isReadableMediaFile } = await import("../src/lib/mediaFile.js");

describe("corrupt local master video", () => {
  afterAll(() => {
    rmSync(tmpData, { recursive: true, force: true });
    if (origDataDir === undefined) delete process.env.SOUNDWAVE_DATA_DIR;
    else process.env.SOUNDWAVE_DATA_DIR = origDataDir;
    if (origCacheDir === undefined) delete process.env.BACKGROUND_CACHE_DIR;
    else process.env.BACKGROUND_CACHE_DIR = origCacheDir;
  });

  it(
    "never survives: the corrupt file is deleted and replaced by a valid master (or the failure is reported clearly)",
    { timeout: 240_000 },
    async () => {
      const mdir = path.join(backgroundCacheRoot(), "minecraft_parkour", "80s");
      mkdirSync(mdir, { recursive: true });
      const master = path.join(mdir, "parkour_master_80s.mp4");
      // 1 MB of garbage with a real extension: passes the old size-only check
      // but is structurally invalid (no moov atom) — the exact failure mode the
      // user hit ("moov atom not found").
      writeFileSync(master, Buffer.alloc(1_000_000, 7));

      let returned: string | undefined;
      let rejection: Error | undefined;
      try {
        returned = await backgroundPool.ensureLocalMasterVideo();
      } catch (e) {
        rejection = e as Error;
      }

      if (rejection) {
        // A failure must be explicit and about the corruption/validity problem,
        // never a raw ffmpeg "moov atom not found" input error.
        expect(rejection.message).toMatch(/corrupt|valid|regenerat/i);
      }
      if (returned) {
        expect(isReadableMediaFile(returned)).toBe(true);
      }
      // Whatever the outcome, the corrupt bytes are gone: either the file was
      // regenerated (now valid) or it was deleted so a later run regenerates it.
      if (existsSync(master)) {
        expect(isReadableMediaFile(master)).toBe(true);
      }
    },
  );
});
