import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { config, resolveFfmpegPath } from "../config.js";

// ── YouTube import via yt-dlp ───────────────────────────────────────────────
// Lets users attach a compositing background straight from a YouTube URL,
// skipping the manual "download video → upload file" dance. The resolver
// prefers YTDLP_PATH, then the vendored zipapp (repo convention, mirrors
// vendor/ffmpeg), then a yt-dlp on PATH.

export interface YtMetadata {
  title: string;
  duration: number; // seconds, 0 when unknown
  webpageUrl: string;
}

/** Only real YouTube URLs are accepted (SSRF / abuse guard). */
export function parseYouTubeUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const ok =
    host === "youtube.com" ||
    host.endsWith(".youtube.com") ||
    host === "youtu.be" ||
    host === "youtube-nocookie.com" ||
    host.endsWith(".youtube-nocookie.com");
  if (!ok) return null;
  // youtu.be/<id> or youtube.com/watch?v=<id> or /shorts/<id>
  if (host === "youtu.be") {
    return url.pathname.length > 1 ? url : null;
  }
  if (url.pathname === "/watch" && url.searchParams.get("v")) return url;
  if (/^\/(shorts|embed|live|v)\/[^/]+/.test(url.pathname)) return url;
  return null;
}

/** Resolve how to launch yt-dlp: env override → vendored zipapp → PATH.
 * The vendored zipapp needs a Python interpreter; POSIX spawns it directly
 * via its shebang, Windows spawns it through `python`/`py`. */
export function resolveYtDlpPath(): string {
  if (config.ytDlpPath) return config.ytDlpPath;
  const isWin = process.platform === "win32";
  const candidates = [
    path.join(process.cwd(), "..", "vendor", "yt-dlp", isWin ? "yt-dlp.exe" : "yt-dlp"),
    path.join(process.cwd(), "vendor", "yt-dlp", isWin ? "yt-dlp.exe" : "yt-dlp"),
    path.join(process.cwd(), "..", "vendor", "yt-dlp", "yt-dlp.exe"),
    path.join(process.cwd(), "vendor", "yt-dlp", "yt-dlp.exe"),
    path.join(process.cwd(), "..", "vendor", "yt-dlp", "yt-dlp"),
    path.join(process.cwd(), "vendor", "yt-dlp", "yt-dlp"),
    "/usr/local/bin/yt-dlp",
    "/usr/bin/yt-dlp",
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).size > 100_000) {
        return c;
      }
    } catch {
      /* keep looking */
    }
  }
  return "yt-dlp";
}

function ytDlpSpawn(): { command: string; prefixArgs: string[] } {
  const bin = resolveYtDlpPath();
  // A vendored zipapp can't be executed natively on Windows — run it via Python.
  if (process.platform === "win32" && (bin.endsWith("yt-dlp") || bin.endsWith(".pyz")) && !bin.toLowerCase().endsWith(".exe")) {
    const py = process.env.PYTHON ?? "python";
    return { command: py, prefixArgs: [bin] };
  }
  return { command: bin, prefixArgs: [] };
}

interface RunResult {
  stdout: string;
  stderr: string;
}

function run(args: string[], timeoutMs: number, onStderr?: (chunk: string) => void): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const { command, prefixArgs } = ytDlpSpawn();
    let child;
    try {
      child = spawn(command, [...prefixArgs, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      reject(e);
      return;
    }
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`yt-dlp timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    child.stderr.on("data", (d: Buffer) => {
      const s = d.toString();
      stderr += s;
      onStderr?.(s);
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      const err = e as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        reject(
          new Error(
            "yt-dlp is not installed. Install it (`pip install yt-dlp`), set YTDLP_PATH, or keep the vendored vendor/yt-dlp/yt-dlp zipapp (requires python3).",
          ),
        );
      } else {
        reject(e);
      }
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(friendlyError(stderr)));
    });
  });
}

/** Turn yt-dlp's noisy stderr into a user-actionable message. */
function friendlyError(stderr: string): string {
  const s = stderr.toLowerCase();
  // Network failures first — substrings like "page" or "bot" appear in
  // unrelated messages and must not shadow the real cause.
  if (s.includes("timed out") || s.includes("tls/ssl") || s.includes("eof") || s.includes("connection") || s.includes("network") || s.includes("resolve"))
    return "The connection to YouTube failed. Check the server's network access and try again.";
  if (s.includes("sign in to confirm") || s.includes("not a bot"))
    return "YouTube asked for a sign-in check before serving this video. Try another video, or configure YTDLP_COOKIES (a cookies.txt export) to pass the check.";
  if (s.includes("video unavailable") || s.includes("private video"))
    return "This video is unavailable, private, or has been removed.";
  if (s.includes("age-restrict") || s.includes("age gate") || s.includes("age verif") || s.includes("confirm your age"))
    return "This video is age-restricted and requires account cookies (YTDLP_COOKIES).";
  if (s.includes("copyright")) return "This video can't be downloaded due to a copyright restriction.";
  if (s.includes("unsupported url") || s.includes("no suitable") || s.includes("unable to extract"))
    return "That URL doesn't look like a downloadable YouTube video.";
  const line = stderr
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("ERROR:"))
    .pop();
  return (line ?? stderr.trim().split("\n").pop() ?? "YouTube download failed").replace(/^ERROR:\s*/, "").slice(0, 300);
}

function baseArgs(): string[] {
  // --js-runtimes: yt-dlp only enables deno by default; Node is what ships
  // with the app, so opt in explicitly for signature/n-sig challenges.
  // player_client: try less bot-gated innertube clients first.
  const args = [
    "--no-playlist",
    "--no-warnings",
    "--ignore-config",
    "--restrict-filenames",
    // Comma-joined values are rejected; yt-dlp wants one flag per runtime.
    "--js-runtimes",
    "node",
    "--js-runtimes",
    "deno",
    // Prefer clients that clear the bot wall without cookies (yt-dlp.net guidance).
    "--extractor-args",
    "youtube:player_client=tv,web_safari",
  ];
  if (config.ytDlpCookies) args.push("--cookies", config.ytDlpCookies);
  return args;
}

/** Fetch title/duration without downloading — validates the video early. */
export async function fetchMetadata(url: string): Promise<YtMetadata> {
  const { stdout } = await run(
    [...baseArgs(), "--skip-download", "--print", "%(title)s\n%(duration)s\n%(webpage_url)s", url],
    Math.min(config.ytDlpTimeoutMs, 60_000),
  );
  const lines = stdout
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const [title, durationRaw, webpageUrl] = lines;
  if (!title) throw new Error("Could not read this YouTube video's details.");
  const duration = Number.parseFloat(durationRaw ?? "0");
  return {
    title: title.slice(0, 200),
    duration: Number.isFinite(duration) ? duration : 0,
    webpageUrl: webpageUrl ?? url,
  };
}

export interface YtDownloadResult {
  filePath: string;
  fileKey: string;
  ext: string;
  size: number;
}

/**
 * Download a video into the uploads dir as `<uuid>.<real-ext>`. Prefers
 * pre-merged MP4 ≤1080p, falls back to best muxed pair (needs ffmpeg for the
 * merge), then any best-effort format. Enforces `maxBytes` post-download.
 */
export async function downloadVideo(
  url: string,
  uuid: string,
  maxBytes: number,
  onProgress?: (pct: number) => void,
  downloadSections?: string,
  timeoutMs?: number,
): Promise<YtDownloadResult> {
  const dir = config.uploadsDir;
  fs.mkdirSync(dir, { recursive: true });
  const template = path.join(dir, `${uuid}.%(ext)s`);

  const args = [
    ...baseArgs(),
    "-f",
    "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080][ext=mp4]/bv*[height<=1080]+ba/b[height<=1080]/b",
    // Prefer merged MP4; needed when downloading time sections of DASH streams.
    "--merge-output-format", "mp4",
  ];
  if (downloadSections) {
    args.push("--download-sections", downloadSections);
    // Without this, section cuts snap to keyframes and often yield empty/broken files.
    args.push("--force-keyframes-at-cuts");
  }
  // Point yt-dlp at ffmpeg for stream-merging — but only when we have a real
  // path; a bare "ffmpeg" on PATH should be discovered by yt-dlp itself.
  const ffmpegDir = path.dirname(resolveFfmpegPath());
  if (ffmpegDir && ffmpegDir !== ".") args.push("--ffmpeg-location", ffmpegDir);
  // YouTube's innertube often requires a JS runtime for challenge signing.
  // Surface Node (bundled with the app) so yt-dlp can find it.
  const nodeDir = path.dirname(process.execPath || "");
  if (nodeDir && nodeDir !== ".") {
    const prev = process.env.PATH || "";
    if (!prev.split(path.delimiter).includes(nodeDir)) {
      process.env.PATH = `${nodeDir}${path.delimiter}${prev}`;
    }
  }
  args.push("--newline", "-o", template, url);

  const cleanup = () => {
    for (const f of fs.readdirSync(dir)) {
      if (f === uuid || f.startsWith(`${uuid}.`)) {
        try {
          fs.unlinkSync(path.join(dir, f));
        } catch {
          /* ignore */
        }
      }
    }
  };

  try {
    await run(args, timeoutMs ?? config.ytDlpTimeoutMs, (chunk) => {
      const m = chunk.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
      if (m) onProgress?.(Math.min(99, parseFloat(m[1]!)));
    });
  } catch (e) {
    cleanup();
    throw e;
  }

  const produced = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(`${uuid}.`) && !f.endsWith(".part") && !f.endsWith(".ytdl"));
  const name = produced[0];
  if (!name) {
    cleanup();
    throw new Error("YouTube download produced no file.");
  }
  const filePath = path.join(dir, name);
  const size = fs.statSync(filePath).size;
  if (size > maxBytes) {
    cleanup();
    const err = new Error(`The video is ${(size / 1024 / 1024).toFixed(0)}MB, which exceeds your plan limit.`);
    (err as { status?: number }).status = 413;
    (err as { code?: string }).code = "FILE_TOO_LARGE";
    throw err;
  }
  onProgress?.(100);
  return { filePath, fileKey: name, ext: name.slice(uuid.length + 1), size };
}
