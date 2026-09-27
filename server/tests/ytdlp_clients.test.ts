import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// yt-dlp itself is replaced by a scripted child process, so these tests pin
// down exactly which arguments reach yt-dlp and how its answers are handled.
type Reply = { code: number; stdout?: string; stderr?: string };
const fake = vi.hoisted(() => ({
  calls: [] as string[][],
  reply: (_args: string[]): Reply => ({ code: 0 }),
}));

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    spawn: vi.fn((_command: string, args: string[]) => {
      fake.calls.push(args);
      const child = Object.assign(new EventEmitter(), {
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        kill: () => true,
      });
      const r = fake.reply(args);
      setImmediate(() => {
        if (r.stdout) child.stdout.write(r.stdout);
        if (r.stderr) child.stderr.write(r.stderr);
        setImmediate(() => child.emit("close", r.code));
      });
      return child;
    }),
  };
});

const { config } = await import("../src/config.js");
const ytdlp = await import("../src/lib/ytdlp.js");
const { fetchMetadata, downloadVideo, listChannelVideos, isVideoSpecificYtError, jsRuntimeArgs, YtDlpError } = ytdlp;

const URL_ = "https://www.youtube.com/watch?v=Ey5YXBINl2Q";
const METADATA = "Orbital gameplay\n3600\nhttps://www.youtube.com/watch?v=Ey5YXBINl2Q\nOrbital NCG\nhttps://www.youtube.com/@OrbitalNCG\n";
const RELOAD = { code: 1, stderr: "ERROR: [youtube] Ey5YXBINl2Q: The page needs to be reloaded.\n" };
const mutableConfig = config as unknown as { ytDlpCookies: string; ytDlpBrowser: string; uploadsDir: string };

const extractorArgs = (args: string[]) => {
  const i = args.indexOf("--extractor-args");
  return i >= 0 ? args[i + 1] : null;
};

async function rejection(p: Promise<unknown>): Promise<InstanceType<typeof YtDlpError>> {
  try {
    await p;
  } catch (e) {
    return e as InstanceType<typeof YtDlpError>;
  }
  throw new Error("expected the call to fail");
}

beforeEach(() => {
  fake.calls.length = 0;
  fake.reply = () => ({ code: 0, stdout: METADATA });
  ytdlp._resetYtDlpClientStrategyForTests();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  mutableConfig.ytDlpCookies = "";
  mutableConfig.ytDlpBrowser = "";
  vi.restoreAllMocks();
});

describe("yt-dlp player clients", () => {
  it("starts with yt-dlp's own default clients and this server's Node as the JS runtime", async () => {
    const meta = await fetchMetadata(URL_);
    expect(meta.title).toBe("Orbital gameplay");
    expect(fake.calls).toHaveLength(1);
    const args = fake.calls[0]!;
    // No forced client list — the old `tv,web_safari` override broke in Aug 2026.
    expect(extractorArgs(args)).toBeNull();
    expect(args.join(" ")).not.toContain("tv,web_safari");
    expect(args).toContain(`node:${process.execPath}`);
    expect(args).toContain("deno");
  });

  it("falls back to web_embedded when YouTube answers 'The page needs to be reloaded', and reuses it for that video only", async () => {
    fake.reply = (args) => (extractorArgs(args) ? { code: 0, stdout: METADATA } : RELOAD);
    await expect(fetchMetadata(URL_)).resolves.toMatchObject({ duration: 3600 });
    expect(fake.calls.map(extractorArgs)).toEqual([null, "youtube:player_client=default,web_embedded,web_safari"]);

    // The next call for the same video (e.g. the download right after the
    // metadata step) goes straight to the strategy that worked...
    await fetchMetadata(URL_);
    expect(fake.calls).toHaveLength(3);
    expect(extractorArgs(fake.calls[2]!)).toBe("youtube:player_client=default,web_embedded,web_safari");

    // ...while any other video starts from yt-dlp's defaults again.
    await fetchMetadata("https://www.youtube.com/watch?v=Orb1tal0001");
    expect(fake.calls.slice(3).map(extractorArgs)).toEqual([null, "youtube:player_client=default,web_embedded,web_safari"]);
  });

  it("retries a bot check with the fallback clients too", async () => {
    fake.reply = (args) =>
      extractorArgs(args)
        ? { code: 0, stdout: METADATA }
        : { code: 1, stderr: "ERROR: [youtube] Ey5YXBINl2Q: Sign in to confirm you're not a bot.\n" };
    await expect(fetchMetadata(URL_)).resolves.toMatchObject({ title: "Orbital gameplay" });
    expect(fake.calls).toHaveLength(2);
  });

  it("reports a clear YouTube-side error, not a broken video, when every client is rejected", async () => {
    fake.reply = () => RELOAD;
    const err = await rejection(fetchMetadata(URL_));
    expect(err).toBeInstanceOf(YtDlpError);
    expect(err.code).toBe("YT_CLIENT_REJECTED");
    expect(err.detail).toBe("The page needs to be reloaded.");
    expect(err.message).toContain('("The page needs to be reloaded.")');
    expect(err.message).toContain("not a problem with this video");
    expect(err.message).toContain("every player client tried");
    // The Orbital picker must not mark the video as unusable for this.
    expect(isVideoSpecificYtError(err)).toBe(false);
    expect(fake.calls).toHaveLength(2); // no cookies configured -> two strategies
  });

  it("does not retry errors that belong to the video or the connection", async () => {
    fake.reply = () => ({ code: 1, stderr: "ERROR: [youtube] Ey5YXBINl2Q: Private video. Sign in if you've been granted access to this video\n" });
    const priv = await rejection(fetchMetadata(URL_));
    expect(priv.code).toBe("YT_UNAVAILABLE");
    expect(isVideoSpecificYtError(priv)).toBe(true);
    expect(fake.calls).toHaveLength(1);

    fake.calls.length = 0;
    fake.reply = () => ({ code: 1, stderr: "ERROR: [youtube] Ey5YXBINl2Q: Unable to download webpage: TLS/SSL connection has been closed (EOF)\n" });
    expect((await rejection(fetchMetadata(URL_))).code).toBe("YT_NETWORK");
    expect(fake.calls).toHaveLength(1);
  });

  it("with cookies configured, tries once more without them (public videos need none)", async () => {
    mutableConfig.ytDlpCookies = "/tmp/cookies.txt";
    fake.reply = (args) => (args.includes("--cookies") ? RELOAD : { code: 0, stdout: METADATA });
    await expect(fetchMetadata(URL_)).resolves.toMatchObject({ title: "Orbital gameplay" });
    expect(fake.calls).toHaveLength(3);
    expect(fake.calls[0]).toContain("--cookies");
    expect(fake.calls[1]).toContain("--cookies");
    expect(fake.calls[2]).not.toContain("--cookies");
    expect(extractorArgs(fake.calls[2]!)).toBeNull();
  });

  it("clears a failed attempt's partial download before retrying with another client", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ytdlp-clients-"));
    const prevUploads = mutableConfig.uploadsDir;
    mutableConfig.uploadsDir = dir;
    try {
      let partialSeenOnRetry: boolean | null = null;
      fake.reply = (args) => {
        const out = args[args.indexOf("-o") + 1]!.replace("%(ext)s", "mp4");
        if (!extractorArgs(args)) {
          fs.writeFileSync(`${out}.part`, "half a video");
          return { code: 1, stderr: "ERROR: unable to download video data: HTTP Error 403: Forbidden\n" };
        }
        partialSeenOnRetry = fs.existsSync(`${out}.part`);
        fs.writeFileSync(out, Buffer.alloc(2048));
        return { code: 0, stdout: "[download] 100% of 2.00KiB\n" };
      };
      const result = await downloadVideo(URL_, "clip-1234", 10_000_000, undefined, undefined, "bv/b", {
        section: { start: 60, end: 90 },
      });
      expect(result).toMatchObject({ fileKey: "clip-1234.mp4", size: 2048 });
      expect(partialSeenOnRetry).toBe(false);
      expect(fake.calls).toHaveLength(2);
      expect(fake.calls[1]).toContain("--download-sections");
      expect(fs.readdirSync(dir)).toEqual(["clip-1234.mp4"]);
    } finally {
      mutableConfig.uploadsDir = prevUploads;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("never forces a player client for the channel listing", async () => {
    fake.reply = () => ({
      code: 0,
      stdout: JSON.stringify({ channel: "Orbital NCG", channel_id: "UC1", entries: [{ id: "Ey5YXBINl2Q", title: "Gameplay", duration: 600 }] }),
    });
    const listing = await listChannelVideos("https://www.youtube.com/@OrbitalNCG/videos");
    expect(listing.videos).toHaveLength(1);
    expect(extractorArgs(fake.calls[0]!)).toBeNull();
    expect(fake.calls[0]).not.toContain("--no-playlist");
  });
});

describe("jsRuntimeArgs", () => {
  it("passes the exact Node binary, Windows drive letter included", () => {
    expect(jsRuntimeArgs({ execPath: "C:\\Program Files\\nodejs\\node.exe" })).toEqual([
      "--js-runtimes",
      "node:C:\\Program Files\\nodejs\\node.exe",
      "--js-runtimes",
      "deno",
    ]);
  });

  it("uses a node on PATH inside the Electron desktop app, whose execPath is the app itself", () => {
    expect(jsRuntimeArgs({ execPath: "C:\\Program Files\\Soundwave AI\\Soundwave AI.exe", electron: "38.1.0" })).toEqual([
      "--js-runtimes",
      "node",
      "--js-runtimes",
      "deno",
    ]);
  });
});
