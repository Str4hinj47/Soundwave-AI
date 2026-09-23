"""
Soundwave AI — Minecraft Parkour Background Clip Library (agent side)

Mirrors the server implementation in server/src/lib/backgroundClips.ts:

  1. ONE long REAL minecraft gameplay video is downloaded (or taken from a
     bundled local master in vendor/minecraft-backgrounds/).
  2. It is sliced into a library of 60-second clips.
  3. Each short consumes exactly one clip, which is then DELETED.
  4. When the library is empty the source is retired (big file deleted,
     never a bundled master), its URL is REMEMBERED so it is never picked
     again, and a NEW video is found — bundled masters, curated Orbital
     highlights, then the rest of the Orbital channel (newest first).

ALL automatic downloads come from the Orbital - No Copyright Gameplay
channel (https://www.youtube.com/@OrbitalNCG) — nothing else.

Nothing is ever handed out as a "minecraft parkour clip" unless it survives
two gates:
  * pre-download metadata gate — the video must be from the Orbital channel,
    its title must actually be Minecraft, and its duration must fit the
    library;
  * post-slice frame gate — sampled frames are analysed and the source is
    REJECTED when they look like a test pattern (SMPTE/testsrc color bars)
    or solid/blank footage. Synthetic placeholders can never masquerade as
    gameplay.

State lives in background_cache/minecraft_parkour/state.json so a restart
resumes the remaining clips instead of re-downloading the same hour of video.
"""

import json
import os
import random
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# ── Source: Orbital - No Copyright Gameplay (https://www.youtube.com/@OrbitalNCG)
# ALL automatic background downloads come from this one channel. Every video
# on it is public, no-copyright / free-to-use minecraft parkour gameplay, and
# the download gate additionally refuses anything whose channel/uploader does
# not match, so no other channel can ever slip in.
# Credits required by the channel: mention it in the video description and
# don't re-upload the footage as "No Copyright Gameplay" (see the CREDITS.txt
# written by scripts/fetch_background_master.py).
ORBITAL_CHANNEL_URL = "https://www.youtube.com/@OrbitalNCG/videos"
ORBITAL_CHANNEL_RE = re.compile(r"orbital", re.I)

# Curated highlights from the channel, verified live on 2026-09-23. Longest
# first; the vertical one needs no cropping for 9:16 shorts. The rest of the
# channel is walked automatically (newest first) once these are consumed.
CURATED_HIGH_QUALITY_MINECRAFT_PARKOUR = [
    "https://www.youtube.com/watch?v=fw_eWpb7uCE",  # 4:53:37 VERTICAL 9:16
    "https://www.youtube.com/watch?v=85z7jqGAGcc",  # 2:29:21
    "https://www.youtube.com/watch?v=_GxTLyLyIbs",  # 1:16:18 4K
    "https://www.youtube.com/watch?v=tiOl_mcAsF4",  # 1:10:24
    "https://www.youtube.com/watch?v=BXUA2FncVPI",  # 10:30 4K
    "https://www.youtube.com/watch?v=zdVQSm8bYu8",  # 10:02
]

BLACKLIST_URLS = ["dQw4w9WgXcQ", "NJ1VD4eCcD0", "rickroll", "rick roll"]

MINECRAFT_TITLE_RE = re.compile(r"minecraft", re.I)

# Every clip handed to the renderer is this long. Must match the server's
# CLIP_SECS (server/src/lib/backgroundClips.ts) so both sides share one library.
CLIP_DURATION = int(os.environ.get("BACKGROUND_CLIP_SECS", "60"))
# Backwards-compatible alias (older callers read CHUNK_DURATION).
CHUNK_DURATION = CLIP_DURATION

CLIP_BATCH = int(os.environ.get("BACKGROUND_CLIP_BATCH", "10"))
MIN_SOURCE_SECS = int(os.environ.get("BACKGROUND_MIN_SOURCE_SECS", "120"))
MAX_SOURCE_SECS = int(os.environ.get("BACKGROUND_MAX_SOURCE_SECS", str(6 * 3600)))
MAX_HEIGHT = int(os.environ.get("BACKGROUND_MAX_HEIGHT", "720"))
# How many of the channel's newest videos to look at once the curated list is
# exhausted.
CHANNEL_SCAN_LIMIT = int(os.environ.get("BACKGROUND_CHANNEL_SCAN_LIMIT", "40"))
MIN_CLIP_BYTES = 50 * 1024

# Set BACKGROUND_FOOTAGE_CHECK=false to bypass the frame gate (tests simulate
# downloads with synthetic footage).
FOOTAGE_CHECK = os.environ.get("BACKGROUND_FOOTAGE_CHECK", "true").lower() != "false"

# Frame-gate geometry (must mirror the server's verifyFootage()).
FW_W, FW_H, FW_SAMPLES = 160, 90, 5
FW_FLAT_DIFF = 2.5        # neighbouring profile points closer than this = flat
FW_SHARP_DIFF = 40.0      # jump above this = a colour-band boundary
FW_MIN_FLAT_RATIO = 0.55  # primary: mostly-flat profile...
FW_MIN_TRANSITIONS = 6    # ...with 6+ boundaries (7-bar pattern)
FW_MIN_FLAT_RATIO2 = 0.42  # secondary: many sharp boundaries (testsrc2-style)
FW_MIN_TRANSITIONS2 = 9
FW_SOLID_FRAME_STD = 3.0  # global per-channel RMS below this = blank frame


def is_blacklisted(url: str) -> bool:
    """Case-insensitive blacklist check (the URL is lowercased, so the
    blacklist entries must be compared lowercased too)."""
    url_lower = (url or "").lower()
    return any(b.lower() in url_lower for b in BLACKLIST_URLS)


# ── Paths ────────────────────────────────────────────────────────────────────
def _repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def get_cache_root() -> Path:
    """Root of the parkour library (shared with the server's DATA_DIR when set)."""
    env_dir = os.environ.get("DATA_DIR")
    if env_dir:
        return Path(env_dir) / "background_cache" / "minecraft_parkour"
    for c in (
        Path.cwd() / "background_cache" / "minecraft_parkour",
        _repo_root() / "background_cache" / "minecraft_parkour",
        Path.home() / ".soundwave" / "background_cache" / "minecraft_parkour",
    ):
        if c.exists():
            return c
    fallback = Path.cwd() / "background_cache" / "minecraft_parkour"
    fallback.mkdir(parents=True, exist_ok=True)
    return fallback


def get_cache_dir() -> Path:
    """Directory holding the ready-to-use 60s clips."""
    d = get_cache_root() / f"{CLIP_DURATION}s"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _source_dir() -> Path:
    d = get_cache_root() / "sources"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _state_file() -> Path:
    return get_cache_root() / "state.json"


def bundled_master_files() -> List[Path]:
    """Every *.mp4 in vendor/minecraft-backgrounds/ (fetched by the helper
    script scripts/fetch_background_master.py). These are the user's files —
    they are consumed from, but NEVER deleted."""
    dirs = [
        _repo_root() / "vendor" / "minecraft-backgrounds",
        Path.cwd() / "vendor" / "minecraft-backgrounds",
    ]
    out: List[Path] = []
    seen = set()
    for d in dirs:
        try:
            entries = list(d.iterdir())
        except OSError:
            continue
        for f in entries:
            if not f.name.lower().endswith(".mp4"):
                continue
            key = f.resolve()
            if key in seen:
                continue
            seen.add(key)
            try:
                if f.stat().st_size > 500_000:
                    out.append(f)
            except OSError:
                continue
    return out


# ── State (remembers which long videos have already been clipped) ────────────
def _empty_state() -> Dict[str, Any]:
    return {
        "version": 1,
        "source": None,
        "queue": [],
        "used_urls": [],
        "last_used_url": None,
        "clips_delivered": 0,
        "sources_consumed": 0,
    }


def load_state() -> Dict[str, Any]:
    try:
        raw = json.loads(_state_file().read_text(encoding="utf-8"))
        state = _empty_state()
        state.update({k: v for k, v in raw.items() if k in state})
        for key in ("queue", "used_urls"):
            if not isinstance(state[key], list):
                state[key] = []
        return state
    except Exception:
        return _empty_state()


def save_state(state: Dict[str, Any]) -> None:
    try:
        _state_file().parent.mkdir(parents=True, exist_ok=True)
        tmp = _state_file().with_suffix(".json.tmp")
        tmp.write_text(json.dumps(state, indent=2), encoding="utf-8")
        tmp.replace(_state_file())
    except Exception as e:
        print(f"[CacheManager] could not persist state: {e}")


# ── Helpers ──────────────────────────────────────────────────────────────────
def video_id(url: str) -> str:
    """Extract a YouTube video id from the common URL shapes."""
    if not url:
        return ""
    for marker in ("v=", "youtu.be/", "/shorts/", "/embed/", "/live/"):
        if marker in url:
            tail = url.split(marker, 1)[1]
            for sep in ("&", "?", "#", "/"):
                tail = tail.split(sep, 1)[0]
            return tail.strip()
    return ""


def find_tools() -> Tuple[Optional[str], Optional[str]]:
    """Locate yt-dlp and ffmpeg binaries (vendored or system)."""
    repo_root = Path(__file__).parent.parent
    vendored_ffmpeg = repo_root / "vendor" / "ffmpeg" / ("ffmpeg.exe" if sys.platform == "win32" else "ffmpeg")
    vendored_ytdlp = repo_root / "vendor" / "yt-dlp" / ("yt-dlp.exe" if sys.platform == "win32" else "yt-dlp")

    ffmpeg_bin = str(vendored_ffmpeg) if vendored_ffmpeg.exists() else shutil.which("ffmpeg")
    ytdlp_bin = str(vendored_ytdlp) if vendored_ytdlp.exists() else shutil.which("yt-dlp")

    return ffmpeg_bin, ytdlp_bin


def _ytdlp_cmd(ytdlp_bin: str) -> List[str]:
    """The vendored zipapp cannot be exec'd directly on Windows."""
    if sys.platform == "win32" and not ytdlp_bin.lower().endswith(".exe"):
        return [os.environ.get("PYTHON", "python"), ytdlp_bin]
    return [ytdlp_bin]


def probe_duration(ffmpeg_bin: str, path: Path) -> float:
    """Read a media duration by parsing `ffmpeg -i` (no ffprobe required)."""
    try:
        proc = subprocess.run(
            [ffmpeg_bin, "-hide_banner", "-i", str(path)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30,
        )
        text = proc.stderr.decode("utf-8", "ignore")
        marker = "Duration:"
        if marker not in text:
            return 0.0
        chunk = text.split(marker, 1)[1].split(",")[0].strip()
        h, m, s = chunk.split(":")
        return int(h) * 3600 + int(m) * 60 + float(s)
    except Exception:
        return 0.0


# ── Gate 1: metadata — must BE minecraft footage FROM the Orbital channel ────
def fetch_youtube_meta(
    ytdlp_bin: Optional[str], url: str
) -> Optional[Dict[str, Any]]:
    """Cheap yt-dlp metadata fetch (no download).
    Returns {"title", "duration", "uploader", "channel"} or None."""
    if not ytdlp_bin:
        return None
    try:
        proc = subprocess.run(
            _ytdlp_cmd(ytdlp_bin) + [
                "--no-warnings", "--ignore-config", "--no-playlist",
                "--print", "%(title)s\t%(duration)s\t%(uploader)s\t%(channel)s", url,
            ],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60,
        )
        if proc.returncode != 0:
            return None
        for line in proc.stdout.decode("utf-8", "ignore").splitlines():
            line = line.strip()
            if not line:
                continue
            parts = line.split("\t")
            title = parts[0]
            dur = 0.0
            if len(parts) > 1:
                try:
                    dur = float(parts[1] or 0)
                except ValueError:
                    dur = 0.0
            return {
                "title": title,
                "duration": dur,
                "uploader": parts[2] if len(parts) > 2 else "",
                "channel": parts[3] if len(parts) > 3 else "",
            }
        return None
    except Exception as e:
        print(f"[CacheManager] metadata fetch failed: {e}")
        return None


def is_orbital_source(meta: Dict[str, Any]) -> bool:
    """The only channel automatic downloads may come from."""
    return bool(ORBITAL_CHANNEL_RE.search(f"{meta.get('uploader', '')} {meta.get('channel', '')}"))


# ── Gate 2: frames — reject test patterns and blank/solid footage ────────────
def _grab_frame(ffmpeg_bin: str, path: Path, t: float) -> Optional[bytes]:
    """One frame of `path` at time t, scaled to FW_W x FW_H as raw RGB24."""
    try:
        proc = subprocess.run(
            [ffmpeg_bin, "-hide_banner", "-loglevel", "error",
             "-ss", f"{t:.2f}", "-i", str(path), "-frames:v", "1",
             "-vf", f"scale={FW_W}:{FW_H}", "-f", "rawvideo",
             "-pix_fmt", "rgb24", "pipe:1"],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60,
        )
        data = proc.stdout
        size = FW_W * FW_H * 3
        if proc.returncode == 0 and len(data) >= size:
            return bytes(data[:size])
        return None
    except Exception:
        return None


def _analyze_profile(profile: List[Tuple[float, float, float]]) -> Dict[str, float]:
    """Fraction of flat neighbours + number of sharp jumps in a colour curve."""
    diffs = [
        ((profile[x][0] - profile[x - 1][0]) ** 2
         + (profile[x][1] - profile[x - 1][1]) ** 2
         + (profile[x][2] - profile[x - 1][2]) ** 2) ** 0.5
        for x in range(1, len(profile))
    ]
    if not diffs:
        return {"flat_ratio": 0.0, "transitions": 0.0}
    return {
        "flat_ratio": sum(1 for d in diffs if d < FW_FLAT_DIFF) / len(diffs),
        "transitions": float(sum(1 for d in diffs if d > FW_SHARP_DIFF)),
    }


def _is_band(a: Dict[str, float]) -> bool:
    return (
        (a["flat_ratio"] >= FW_MIN_FLAT_RATIO and a["transitions"] >= FW_MIN_TRANSITIONS)
        or (a["flat_ratio"] >= FW_MIN_FLAT_RATIO2 and a["transitions"] >= FW_MIN_TRANSITIONS2)
    )


def _is_band_profile(frame: bytes) -> bool:
    """Colour bars live in the upper 75% of the frame; testsrc's noise block
    sits bottom-right, so the column profile uses rows [0, 0.75H)."""
    col_top = int(FW_H * 0.75)
    col = []
    for x in range(FW_W):
        r = g = bl = 0
        for y in range(col_top):
            i = (y * FW_W + x) * 3
            r += frame[i]
            g += frame[i + 1]
            bl += frame[i + 2]
        col.append((r / col_top, g / col_top, bl / col_top))
    row = []
    for y in range(FW_H):
        off = y * FW_W * 3
        r = g = bl = 0
        for x in range(FW_W):
            r += frame[off + x * 3]
            g += frame[off + x * 3 + 1]
            bl += frame[off + x * 3 + 2]
        row.append((r / FW_W, g / FW_W, bl / FW_W))
    return _is_band(_analyze_profile(col)) or _is_band(_analyze_profile(row))


def _global_std(frame: bytes) -> float:
    n = FW_W * FW_H
    r = g = bl = 0
    for i in range(0, len(frame), 3):
        r += frame[i]
        g += frame[i + 1]
        bl += frame[i + 2]
    mr, mg, mb = r / n, g / n, bl / n
    v = 0.0
    for i in range(0, len(frame), 3):
        v += (frame[i] - mr) ** 2 + (frame[i + 1] - mg) ** 2 + (frame[i + 2] - mb) ** 2
    return (v / (3 * n)) ** 0.5


def verify_footage(ffmpeg_bin: str, path: Path) -> Tuple[bool, str]:
    """Sample frames across the clip and reject anything that is NOT real
    footage: a mostly-flat column/row colour curve with many sharp boundaries
    → test pattern (SMPTE/testsrc/testsrc2 — the synthetic pattern that
    slipped into the library); every sampled frame one colour → blank.
    Real gameplay (sky + textured terrain, moving camera) has no long flat
    profile with 6+ full-width colour boundaries, so it passes comfortably."""
    if not ffmpeg_bin:
        return True, "no ffmpeg — check skipped"
    dur = probe_duration(ffmpeg_bin, path)
    if dur <= 0:
        return False, "no readable video stream"

    band_frames = 0
    solid_frames = 0
    seen = 0
    for i in range(FW_SAMPLES):
        t = dur * (i + 0.5) / FW_SAMPLES
        frame = _grab_frame(ffmpeg_bin, path, t)
        if frame is None:
            continue
        seen += 1
        if _is_band_profile(frame):
            band_frames += 1
        if _global_std(frame) < FW_SOLID_FRAME_STD:
            solid_frames += 1

    if seen == 0:
        return False, "could not sample frames"
    if band_frames >= 3:
        return False, "synthetic test pattern (color bars) detected"
    if solid_frames >= 3 and solid_frames == seen:
        return False, "solid/blank footage"
    return True, "ok"


# ── Discovery: find a NEW long video to clip ─────────────────────────────────
def discover_urls(used: List[str]) -> List[str]:
    """Curated Orbital videos first, then the rest of the Orbital channel
    (newest first). Anything already clipped or blacklisted is skipped.
    Channel-walk results must at least claim to be Minecraft in the title —
    download_source() re-checks channel + title before any download."""
    used_ids = {u for u in used if u}
    out: List[str] = []
    seen = set()

    def push(url: str) -> None:
        if not url or is_blacklisted(url):
            return
        vid = video_id(url)
        if not vid or vid in seen or vid in used_ids:
            return
        seen.add(vid)
        out.append(url)

    for url in CURATED_HIGH_QUALITY_MINECRAFT_PARKOUR:
        push(url)

    # Curated list exhausted → walk the Orbital channel for newer uploads.
    _, ytdlp_bin = find_tools()
    if ytdlp_bin:
        try:
            proc = subprocess.run(
                _ytdlp_cmd(ytdlp_bin) + [
                    "--no-warnings", "--ignore-config", "--flat-playlist",
                    "--playlist-end", str(CHANNEL_SCAN_LIMIT),
                    "--print", "%(url)s\t%(title)s",
                    ORBITAL_CHANNEL_URL,
                ],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120,
            )
            for line in proc.stdout.decode("utf-8", "ignore").splitlines():
                line = line.strip()
                if not line:
                    continue
                url, _, title = line.partition("\t")
                if title and not MINECRAFT_TITLE_RE.search(title):
                    continue  # not minecraft
                push(url)
        except Exception as e:
            print(f"[CacheManager] Orbital channel list fetch failed: {e}")

    return out


# ── Download one LONG source video ───────────────────────────────────────────
def download_source(url: str, timeout: int = 900) -> Optional[Dict[str, Any]]:
    """Download a full long video to serve as the clip source. The video must
    be from the Orbital channel AND titled Minecraft gameplay (gate 1) before
    the download starts — no other channel is ever downloaded."""
    _, ytdlp_bin = find_tools()
    ffmpeg_bin, _ = find_tools()
    if not ytdlp_bin:
        print("[CacheManager] yt-dlp not found; cannot download a background source.")
        return None

    meta = fetch_youtube_meta(ytdlp_bin, url)
    if meta is not None:
        if not is_orbital_source(meta):
            print(f"[CacheManager] skipping {url} — from \"{meta.get('channel') or meta.get('uploader') or 'unknown'}\", not the Orbital channel")
            return None
        if not MINECRAFT_TITLE_RE.search(meta["title"]):
            print(f"[CacheManager] skipping {url} — title \"{meta['title']}\" is not Minecraft gameplay")
            return None
        if 0 < meta["duration"] < MIN_SOURCE_SECS:
            print(f"[CacheManager] skipping {url} — only {meta['duration']:.0f}s long")
            return None
        if meta["duration"] > MAX_SOURCE_SECS:
            print(f"[CacheManager] skipping {url} — {meta['duration']:.0f}s exceeds the {MAX_SOURCE_SECS}s cap")
            return None
    else:
        print(f"[CacheManager] no metadata for {url} — footage will still be verified after slicing")

    vid = video_id(url) or str(int(time.time()))
    out_file = _source_dir() / f"source_{vid}.mp4"
    cmd = _ytdlp_cmd(ytdlp_bin) + [
        "--no-playlist", "--no-warnings", "--ignore-config", "--restrict-filenames",
        "-f", f"bv*[height<={MAX_HEIGHT}][ext=mp4]+ba[ext=m4a]/b[height<={MAX_HEIGHT}][ext=mp4]/b",
        "--merge-output-format", "mp4",
        "-o", str(out_file), url,
    ]
    try:
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
        if proc.returncode != 0 or not out_file.exists():
            tail = proc.stderr.decode("utf-8", "ignore").strip().splitlines()
            print(f"[CacheManager] download failed for {url}: {tail[-1] if tail else 'unknown'}")
            out_file.unlink(missing_ok=True)
            return None
    except Exception as e:
        print(f"[CacheManager] download error for {url}: {e}")
        out_file.unlink(missing_ok=True)
        return None

    duration = probe_duration(ffmpeg_bin or "ffmpeg", out_file) if ffmpeg_bin else 0.0
    if meta is not None and meta["duration"] > 0:
        duration = meta["duration"]
    if duration and duration < MIN_SOURCE_SECS:
        print(f"[CacheManager] {url} is only {duration:.0f}s — too short for a clip library")
        out_file.unlink(missing_ok=True)
        return None
    if duration and duration > MAX_SOURCE_SECS:
        print(f"[CacheManager] {url} — over the {MAX_SOURCE_SECS}s cap")
        out_file.unlink(missing_ok=True)
        return None

    return {"url": url, "video_id": vid, "path": str(out_file),
            "title": meta["title"] if meta else None,
            "duration": duration, "consumed": 0.0, "acquired_at": time.time(), "local": False}


def adopt_bundled_master(file: Path, ffmpeg_bin: Optional[str]) -> Optional[Dict[str, Any]]:
    """Use a bundled local master without downloading (user-owned file)."""
    duration = probe_duration(ffmpeg_bin or "ffmpeg", file) if ffmpeg_bin else 0.0
    if duration < MIN_SOURCE_SECS:
        print(f"[CacheManager] bundled master {file.name} is only {duration:.0f}s — too short")
        return None
    return {"url": f"local:{file.name}", "video_id": f"local_{file.name}",
            "path": str(file), "title": f"bundled master {file.name}",
            "duration": duration, "consumed": 0.0, "acquired_at": time.time(), "local": True}


# ── Slicing: cut the next batch of 60s clips ─────────────────────────────────
def slice_batch(source: Dict[str, Any], count: int) -> List[str]:
    """Stream-copy `count` clips of CLIP_DURATION seconds out of the source."""
    ffmpeg_bin, _ = find_tools()
    if not ffmpeg_bin:
        print("[CacheManager] ffmpeg not found; cannot slice background clips.")
        return []

    clips = get_cache_dir()
    stamp = f"{int(time.time() * 1000)}_{int(source['consumed'])}"
    pattern = clips / f"clip_{stamp}_%03d.mp4"

    cmd = [ffmpeg_bin, "-hide_banner", "-loglevel", "error", "-y"]
    if source["consumed"] > 0:
        cmd += ["-ss", f"{source['consumed']:.3f}"]
    cmd += [
        "-i", str(source["path"]), "-map", "0:v:0", "-an",
        "-avoid_negative_ts", "make_zero", "-c:v", "copy",
        "-f", "segment", "-segment_time", str(CLIP_DURATION),
        "-segment_format", "mp4", "-reset_timestamps", "1",
        "-t", str(count * CLIP_DURATION), str(pattern),
    ]
    try:
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=600)
        if proc.returncode != 0:
            tail = proc.stderr.decode("utf-8", "ignore").strip().splitlines()
            print(f"[CacheManager] slice failed: {tail[-1] if tail else proc.returncode}")
            return []
    except Exception as e:
        print(f"[CacheManager] slice error: {e}")
        return []

    prefix = f"clip_{stamp}_"
    made = []
    for f in sorted(clips.glob(f"{prefix}*.mp4")):
        try:
            if f.stat().st_size > MIN_CLIP_BYTES:
                made.append(f.name)
        except OSError:
            continue
    return made


def _prune_queue(state: Dict[str, Any]) -> None:
    """Drop queued clips whose files are gone (manual cleanup, reboots)."""
    clips = get_cache_dir()
    kept = []
    for name in state["queue"]:
        f = clips / name
        try:
            if f.exists() and f.stat().st_size > MIN_CLIP_BYTES:
                kept.append(name)
        except OSError:
            continue
    state["queue"] = kept


def _retire_source(state: Dict[str, Any]) -> None:
    """Delete a DOWNLOADED source's big file and remember its URL permanently.
    Bundled local masters are the user's files — remembered but NEVER deleted."""
    src = state.get("source")
    if not src:
        return
    if not src.get("local"):
        try:
            Path(src["path"]).unlink(missing_ok=True)
        except Exception:
            pass
    vid = src.get("video_id")
    if vid and vid not in state["used_urls"]:
        state["used_urls"].append(vid)
    state["last_used_url"] = src.get("url") or state.get("last_used_url")
    state["sources_consumed"] = int(state.get("sources_consumed", 0)) + 1
    state["source"] = None


def _fill_verified_batch(state: Dict[str, Any], src: Dict[str, Any]) -> bool:
    """Slice one batch from `src` and verify it is REAL gameplay footage
    (gate 2). Retires the source — deleting its clips — when verification
    fails. True when a verified batch is queued."""
    ffmpeg_bin, _ = find_tools()
    made = slice_batch(src, CLIP_BATCH)
    state["queue"].extend(made)
    src["consumed"] += len(made) * CLIP_DURATION
    if not made:
        _retire_source(state)
        return False
    if FOOTAGE_CHECK:
        ok, reason = verify_footage(ffmpeg_bin or "", get_cache_dir() / made[0])
        if not ok:
            print(f"[CacheManager] {src.get('video_id')} REJECTED ({reason}) — retiring source")
            for name in made:
                (get_cache_dir() / name).unlink(missing_ok=True)
            state["queue"] = [q for q in state["queue"] if q not in made]
            _retire_source(state)
            return False
    return True


def acquire_clip() -> Optional[Path]:
    """Hand out the next unused 60s clip, downloading a new source if needed."""
    state = load_state()
    _prune_queue(state)
    ffmpeg_bin, _ = find_tools()

    # 1. Serve from the existing library.
    if not state["queue"] and state.get("source") and Path(state["source"]["path"]).exists():
        good = _fill_verified_batch(state, state["source"])
        if good and state["source"]["consumed"] >= state["source"]["duration"] - 1:
            _retire_source(state)  # exhausted → next call finds a new video
        save_state(state)

    # 2a. Bundled local masters — real footage, no download needed.
    if not state["queue"]:
        for file in bundled_master_files():
            vid = f"local_{file.name}"
            if vid in state["used_urls"]:
                continue
            src = adopt_bundled_master(file, ffmpeg_bin)
            if not src:
                continue
            state["source"] = src
            if _fill_verified_batch(state, src):
                break
            continue  # verification failed → try the next candidate

    # 2b. Orbital channel: curated highlights first, then newest uploads.
    if not state["queue"]:
        for url in discover_urls(state["used_urls"]):
            src = download_source(url)
            if not src:
                continue
            state["source"] = src
            if _fill_verified_batch(state, src):
                save_state(state)
                break
            # unusable source (failed verification) — try the next candidate

    _prune_queue(state)
    if not state["queue"]:
        save_state(state)
        return None

    name = state["queue"].pop(0)
    state["clips_delivered"] = int(state.get("clips_delivered", 0)) + 1
    save_state(state)
    return get_cache_dir() / name


def release_clip(clip: Optional[Path]) -> None:
    """The clip has been used — delete it and forget it."""
    if clip is None:
        return
    try:
        Path(clip).unlink(missing_ok=True)
    except Exception as e:
        print(f"[CacheManager] failed to delete used clip: {e}")
    state = load_state()
    name = Path(clip).name
    state["queue"] = [q for q in state["queue"] if q != name]
    save_state(state)


# ── Legacy helpers (kept for main.py / cache_plugin.py) ──────────────────────
def list_cached_clips() -> List[Path]:
    """Every ready-to-use clip in the managed library."""
    clips = get_cache_dir()
    out = []
    for f in sorted(clips.glob("*.mp4")):
        try:
            if f.stat().st_size > MIN_CLIP_BYTES:
                out.append(f)
        except OSError:
            continue
    return out


def get_random_cached_clip() -> Optional[Path]:
    """Pick a random cached clip, or None if the library is empty."""
    clips = list_cached_clips()
    return random.choice(clips) if clips else None


def build_cache_clip(youtube_url: Optional[str] = None, timeout: int = 900) -> Optional[Path]:
    """Ensure the library has clips and return the next one.

    Passing `youtube_url` seeds the library from that specific video (it must
    still pass both verification gates); otherwise the next unused clip is
    served (downloading a new long source if needed).
    """
    if youtube_url:
        if is_blacklisted(youtube_url):
            print("[CacheManager] that URL is blacklisted.")
            return None
        src = download_source(youtube_url, timeout=timeout)
        if not src:
            return None
        state = load_state()
        _retire_source(state)
        vid = src["video_id"]
        state["used_urls"] = [u for u in state["used_urls"] if u != vid]
        state["source"] = src
        if not _fill_verified_batch(state, src):
            print(f"[CacheManager] seeded source {vid} failed verification — library stays empty")
            state["source"] = None
            state["queue"] = []
            save_state(state)
            return None
        save_state(state)
        return (get_cache_dir() / state["queue"][0]) if state["queue"] else None
    return acquire_clip()


def get_status() -> Dict[str, Any]:
    """Snapshot of the library — what is clipped, what is left, what is used."""
    state = load_state()
    _prune_queue(state)
    src = state.get("source")
    return {
        "clip_seconds": CLIP_DURATION,
        "source": None if not src else {
            "url": src.get("url"),
            "video_id": src.get("video_id"),
            "title": src.get("title"),
            "duration": src.get("duration"),
            "consumed": src.get("consumed"),
            "present": Path(src["path"]).exists(),
            "local": bool(src.get("local")),
        },
        "clips_ready": len(state["queue"]),
        "used_urls": state["used_urls"],
        "last_used_url": state.get("last_used_url"),
        "clips_delivered": state.get("clips_delivered"),
        "sources_consumed": state.get("sources_consumed", 0),
        "footage_check_enabled": FOOTAGE_CHECK,
        "dirs": {"root": str(get_cache_root()), "clips": str(get_cache_dir())},
    }


def reset_library() -> None:
    """Wipe the library so the next short downloads a brand-new source."""
    shutil.rmtree(get_cache_root(), ignore_errors=True)


if __name__ == "__main__":
    status = get_status()
    print("=== Soundwave Parkour Clip Library ===")
    print(f"Clip length:   {status['clip_seconds']}s")
    print(f"Clips ready:   {status['clips_ready']}")
    print(f"Source:        {status['source']}")
    print(f"Used sources:  {status['used_urls']}")
    print(f"Delivered:     {status['clips_delivered']}")
    for c in list_cached_clips()[:5]:
        print(f" - {c.name} ({c.stat().st_size / 1024 / 1024:.1f} MB)")
