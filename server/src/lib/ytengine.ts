import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { config, resolveFfmpegPath } from "../config.js";

// ── YouTube import via the vendored yt-download engine ──────────────────────
// Custom Innertube engine (https://github.com/Str4hinj47/yt-download, pinned at
// c93903c) — it talks to YouTube's player API with the Android/iOS app client
// contexts, so datacenter IPs are not met with the web client's
// "Sign in to confirm you're not a bot" wall. Vendored under
// vendor/yt-download/; bridge.py exposes a small JSON-over-stdio interface
// (`info` / `download`) that this module wraps. Requires python3 + `requests`
// on the host and ffmpeg for muxing/section cuts (vendored static ffmpeg is
// auto-detected via resolveFfmpegPath).

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

export interface PyLaunch {
  command: string;
  prefixArgs: string[];
}

const PYTHON_INSTALL_HINT =
  "Python 3 was not found on this machine. It is required for YouTube imports " +
  "and background downloads. Install it from https://www.python.org/downloads/ " +
  "or run: winget install Python.Python.3.12 — then restart the server. " +
  "(On Windows 11, the python.exe Microsoft Store alias does NOT count.)";

/**
 * Probe for a real Python interpreter, most trustworthy first:
 * PYTHON env → `py -3` (python.org launcher; never the Microsoft Store stub)
 * → python3/python on PATH. Result is cached after the first call.
 */
let cachedPython: PyLaunch | null | undefined;

function detectPython(): PyLaunch | null {
  const candidates: PyLaunch[] = [];
  if (process.env.PYTHON) candidates.push({ command: process.env.PYTHON, prefixArgs: [] });
  if (process.platform === "win32") {
    candidates.push(
      { command: "py", prefixArgs: ["-3"] },
      { command: "python", prefixArgs: [] },
      { command: "python3", prefixArgs: [] },
    );
  } else {
    candidates.push(
      { command: "python3", prefixArgs: [] },
      { command: "python", prefixArgs: [] },
    );
  }
  for (const c of candidates) {
    try {
      // A working interpreter exits 0 on --version; the Win11 Store stub does not.
      execFileSync(c.command, [...c.prefixArgs, "--version"], { stdio: "ignore", timeout: 10_000 });
      return c;
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

/** Resolve the Python launcher used to run the vendored engine, or null. */
export function resolvePythonCommand(): PyLaunch | null {
  if (cachedPython === undefined) cachedPython = detectPython();
  return cachedPython;
}

export function isPythonAvailable(): boolean {
  return resolvePythonCommand() !== null;
}

/** Locate bridge.py: YT_ENGINE_PATH override (file or dir) → vendored copy. */
export function resolveYtEnginePath(): string | null {
  const fromEnv = config.ytEnginePath;
  if (fromEnv) {
    if (fs.existsSync(fromEnv) && fs.statSync(fromEnv).isFile()) return fromEnv;
    const asDir = path.join(fromEnv, "bridge.py");
    if (fs.existsSync(asDir)) return asDir;
  }
  const candidates = [
    path.join(process.cwd(), "vendor", "yt-download", "bridge.py"),
    path.join(process.cwd(), "..", "vendor", "yt-download", "bridge.py"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

/** True when the vendored engine is present and a Python interpreter exists. */
export function isYtEngineAvailable(): boolean {
  return resolveYtEnginePath() !== null;
}

interface RunResult {
  stdout: string;
  stderr: string;
}

const INSTALL_HINT =
  "The YouTube download engine is unavailable: vendor/yt-download is missing. " +
  "It needs python3 with `pip install requests` and ffmpeg on the host.";

function run(args: string[], timeoutMs: number, onStderr?: (chunk: string) => void): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const bridge = resolveYtEnginePath();
    if (!bridge) {
      reject(new Error(INSTALL_HINT));
      return;
    }
    const py = resolvePythonCommand();
    if (!py) {
      reject(new Error(PYTHON_INSTALL_HINT));
      return;
    }
    let child;
    try {
      child = spawn(py.command, [...py.prefixArgs, bridge, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      reject(e);
      return;
    }
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`YouTube download timed out after ${Math.round(timeoutMs / 1000)}s`));
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
        reject(new Error(PYTHON_INSTALL_HINT));
      } else {
        reject(e);
      }
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        // Some launchers (Windows Store python stub) fail silently on stderr —
        // fall back to the stdout tail so the user still sees the real cause.
        reject(new Error(friendlyError(stderr.trim() ? stderr : stdout)));
      }
    });
  });
}

/** Turn the engine's stderr into a user-actionable message. */
function friendlyError(stderr: string): string {
  const line = stderr
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("ERROR:"))
    .pop();
  const raw = (line ?? stderr.trim().split("\n").pop() ?? "YouTube download failed").replace(/^ERROR:\s*/, "");
  const s = raw.toLowerCase();
  if (s.includes("no module named 'requests'") || s.includes('no module named "requests"') || s.includes("missing a dependency"))
    return "The Python package 'requests' is missing. Install it with: py -m pip install requests — then restart the server.";
  if (s.includes("python was not found"))
    return PYTHON_INSTALL_HINT;
  // Network failures first — substrings like "login" appear in unrelated text.
  if (
    s.includes("network error") ||
    s.includes("timed out") ||
    s.includes("tls/ssl") ||
    s.includes("eof") ||
    s.includes("connection") ||
    s.includes("resolve")
  )
    return "The connection to YouTube failed. Check the server's network access and try again.";
  if (s.includes("demands a login") || s.includes("sign in") || s.includes("not a bot"))
    return (
      "YouTube asked for a sign-in check before serving this video (age restriction or an IP block). " +
      "Try another video, or route the engine through a proxy with YT_DOWNLOADER_PROXY."
    );
  if (s.includes("cdn keeps refusing"))
    return "YouTube's CDN refused the stream repeatedly. Retry in a minute, or set YT_DOWNLOADER_PROXY.";
  if (s.includes("live stream")) return "This is a live stream — there is nothing to download yet.";
  if (s.includes("refused this video") || s.includes("unavailable") || s.includes("private"))
    return `This video can't be downloaded: ${raw}`.slice(0, 300);
  if (s.includes("doesn't look like a youtube")) return "That URL doesn't look like a downloadable YouTube video.";
  if (s.includes("ffmpeg is not installed")) return "ffmpeg is required to finish YouTube downloads but was not found.";
  return raw.slice(0, 300);
}

/** Fetch title/duration without downloading — validates the video early. */
export async function fetchMetadata(url: string): Promise<YtMetadata> {
  const args = ["info", url];
  if (config.ytDownloaderProxy) args.push("--proxy", config.ytDownloaderProxy);
  const { stdout } = await run(args, Math.min(config.ytDownloadTimeoutMs, 60_000));
  const jsonLine = stdout
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("{"))
    .pop();
  if (!jsonLine) throw new Error("Could not read this YouTube video's details.");
  let info: { title?: string; duration?: number; url?: string };
  try {
    info = JSON.parse(jsonLine);
  } catch {
    throw new Error("Could not read this YouTube video's details.");
  }
  if (!info.title) throw new Error("Could not read this YouTube video's details.");
  return {
    title: String(info.title).slice(0, 200),
    duration: Number.isFinite(info.duration) ? Number(info.duration) : 0,
    webpageUrl: info.url ?? url,
  };
}

/** Parse yt-dlp-style "*start-end" sections (HH:MM:SS | MM:SS | seconds). */
export function parseDownloadSections(spec: string): { start?: number; end?: number } | null {
  const m = spec.trim().match(/^\*([0-9:.]*)-([0-9:.]*)$/);
  if (!m) return null;
  const toSec = (t: string): number | undefined => {
    if (!t) return undefined;
    const parts = t.split(":").map(Number);
    if (parts.some((n) => !Number.isFinite(n) || n < 0)) return undefined;
    return parts.reduce((acc, n) => acc * 60 + n, 0);
  };
  const start = toSec(m[1] ?? "");
  const end = toSec(m[2] ?? "");
  if (start === undefined && end === undefined) return null;
  return { start, end };
}

export interface YtDownloadResult {
  filePath: string;
  fileKey: string;
  ext: string;
  size: number;
}

/**
 * Download a video into the uploads dir as `<uuid>.<real-ext>` via the vendored
 * Innertube engine (parallel ranged streams, ≤1080p H.264 preferred, muxed with
 * ffmpeg). `downloadSections` accepts the old yt-dlp "*start-end" syntax — the
 * bridge then fetches only that range. Enforces `maxBytes` post-download.
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

  const args = ["download", url, "-q", "1080", "-o", dir, "--basename", uuid];
  const ffmpeg = resolveFfmpegPath();
  if (ffmpeg) args.push("--ffmpeg", ffmpeg);
  if (config.ytDownloaderProxy) args.push("--proxy", config.ytDownloaderProxy);
  if (downloadSections) {
    const section = parseDownloadSections(downloadSections);
    if (section?.start !== undefined) args.push("--start", String(section.start));
    if (section?.end !== undefined) args.push("--end", String(section.end));
  }

  const cleanup = () => {
    for (const f of fs.readdirSync(dir)) {
      if (f === uuid || f.startsWith(`${uuid}.`) || f.startsWith(`.parts_${uuid}`) || f.startsWith(`.tmp_${uuid}`)) {
        try {
          fs.rmSync(path.join(dir, f), { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      }
    }
  };

  let jsonLine: string | undefined;
  try {
    const { stdout } = await run(args, timeoutMs ?? config.ytDownloadTimeoutMs, (chunk) => {
      for (const line of chunk.split("\n")) {
        const m = line.trim().match(/^PROGRESS\s+(\d+(?:\.\d+)?)/);
        if (m) onProgress?.(Math.min(99, parseFloat(m[1]!)));
      }
    });
    jsonLine = stdout
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("{"))
      .pop();
  } catch (e) {
    cleanup();
    throw e;
  }

  if (!jsonLine) {
    cleanup();
    throw new Error("YouTube download produced no file.");
  }
  let result: { file?: string; ext?: string; size?: number };
  try {
    result = JSON.parse(jsonLine);
  } catch {
    cleanup();
    throw new Error("YouTube download produced no file.");
  }
  const name = result.file;
  // Guard against path tricks — the bridge must drop files flat in uploads.
  if (!name || name.includes("/") || name.includes("\\") || !name.startsWith(`${uuid}.`)) {
    cleanup();
    throw new Error("YouTube download produced an unexpected file.");
  }
  const filePath = path.join(dir, name);
  const size = fs.existsSync(filePath) ? fs.statSync(filePath).size : Number(result.size ?? 0);
  if (!size) {
    cleanup();
    throw new Error("YouTube download produced no file.");
  }
  if (size > maxBytes) {
    cleanup();
    const err = new Error(`The video is ${(size / 1024 / 1024).toFixed(0)}MB, which exceeds your plan limit.`);
    (err as { status?: number }).status = 413;
    (err as { code?: string }).code = "FILE_TOO_LARGE";
    throw err;
  }
  onProgress?.(100);
  return { filePath, fileKey: name, ext: result.ext ?? name.slice(uuid.length + 1), size };
}
