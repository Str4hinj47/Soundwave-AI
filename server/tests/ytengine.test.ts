// Tests for the yt-download engine bridge wrapper (server/src/lib/ytengine.ts).
// A mock bridge.py stands in for the real engine so the suite runs without
// YouTube access: it speaks the same JSON-over-stdio contract
// ("PROGRESS <pct>" on stderr, one JSON object on stdout).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const MOCK_BRIDGE = `#!/usr/bin/env python3
import argparse, json, os, sys

p = argparse.ArgumentParser()
sub = p.add_subparsers(dest="cmd", required=True)
pi = sub.add_parser("info"); pi.add_argument("url"); pi.add_argument("--proxy", default=None)
pd = sub.add_parser("download")
pd.add_argument("url"); pd.add_argument("-q", "--quality", default="1080")
pd.add_argument("-o", "--output", default="."); pd.add_argument("--basename", required=True)
pd.add_argument("--proxy", default=None); pd.add_argument("--ffmpeg", default=None)
pd.add_argument("--start", type=float, default=None); pd.add_argument("--end", type=float, default=None)
args = p.parse_args()

if args.cmd == "info":
    print(json.dumps({"id": "mockvid00001", "title": "Mock Parkour Video",
        "duration": 321, "url": "https://www.youtube.com/watch?v=mockvid00001",
        "channel": "mock", "thumbnail": None}))
else:
    if args.start is not None:  # prove the section args passed through
        open(os.path.join(args.output, args.basename + ".section.txt"), "w").write(
            f"{args.start}-{args.end}")
    sys.stderr.write("PROGRESS 12.5\\nPROGRESS 87.5\\n")
    out = os.path.join(args.output, args.basename + ".mp4")
    with open(out, "wb") as fh:
        fh.write(b"\\x00" * 2048)
    print(json.dumps({"file": os.path.basename(out), "ext": "mp4", "size": 2048}))
`;

let engineDir: string;
let bridgePath: string;
let mod: typeof import("../src/lib/ytengine.js");

function havePython(): boolean {
  try {
    execFileSync(process.platform === "win32" ? "python" : "python3", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

beforeAll(async () => {
  engineDir = fs.mkdtempSync(path.join(os.tmpdir(), "ytengine-test-"));
  bridgePath = path.join(engineDir, "bridge.py");
  fs.writeFileSync(bridgePath, MOCK_BRIDGE);
  process.env.YT_ENGINE_PATH = bridgePath;
  mod = await import("../src/lib/ytengine.js");
});

afterAll(() => {
  delete process.env.YT_ENGINE_PATH;
  fs.rmSync(engineDir, { recursive: true, force: true });
});

describe("ytengine wrapper (mocked yt-download bridge)", () => {
  it("keeps the YouTube URL guard intact", () => {
    expect(mod.parseYouTubeUrl("https://www.youtube.com/watch?v=abc12345678")).not.toBeNull();
    expect(mod.parseYouTubeUrl("https://youtu.be/abc12345678")).not.toBeNull();
    expect(mod.parseYouTubeUrl("https://www.youtube.com/shorts/abc12345678")).not.toBeNull();
    expect(mod.parseYouTubeUrl("https://example.com/watch?v=abc12345678")).toBeNull();
    expect(mod.parseYouTubeUrl("file:///etc/passwd")).toBeNull();
    expect(mod.parseYouTubeUrl("not a url")).toBeNull();
  });

  it("parses yt-dlp style download sections", () => {
    expect(mod.parseDownloadSections("*00:30-03:30")).toEqual({ start: 30, end: 210 });
    expect(mod.parseDownloadSections("*0-90")).toEqual({ start: 0, end: 90 });
    expect(mod.parseDownloadSections("*01:00:00-")).toEqual({ start: 3600, end: undefined });
    expect(mod.parseDownloadSections("bogus")).toBeNull();
  });

  it("resolves the engine via YT_ENGINE_PATH", () => {
    expect(mod.resolveYtEnginePath()).toBe(bridgePath);
    expect(mod.isYtEngineAvailable()).toBe(true);
  });

  it.runIf(havePython())("fetches metadata as JSON", async () => {
    const meta = await mod.fetchMetadata("https://www.youtube.com/watch?v=mockvid00001");
    expect(meta.title).toBe("Mock Parkour Video");
    expect(meta.duration).toBe(321);
    expect(meta.webpageUrl).toContain("mockvid00001");
  });

  it.runIf(havePython())("downloads via the bridge with progress + section args", async () => {
    const uuid = "00000000-0000-4000-8000-0000000000ab";
    const { config } = await import("../src/config.js");
    const progress: number[] = [];
    const res = await mod.downloadVideo(
      "https://www.youtube.com/watch?v=mockvid00001",
      uuid,
      10_000_000,
      (pct) => progress.push(pct),
      "*00:30-03:30",
      30_000,
    );
    expect(res.fileKey).toBe(`${uuid}.mp4`);
    expect(res.size).toBe(2048);
    expect(fs.existsSync(res.filePath)).toBe(true);
    expect(progress).toContain(12.5);
    // section spec converted to seconds and handed to the engine
    expect(fs.readFileSync(path.join(config.uploadsDir, `${uuid}.section.txt`), "utf8")).toBe("30.0-210.0");
    fs.rmSync(res.filePath, { force: true });
    fs.rmSync(path.join(config.uploadsDir, `${uuid}.section.txt`), { force: true });
  });

  it.runIf(havePython())("enforces the size cap with a 413-coded error", async () => {
    const uuid = "00000000-0000-4000-8000-0000000000cd";
    await expect(
      mod.downloadVideo("https://www.youtube.com/watch?v=mockvid00001", uuid, 100, undefined, undefined, 30_000),
    ).rejects.toMatchObject({ status: 413, code: "FILE_TOO_LARGE" });
  });
});
