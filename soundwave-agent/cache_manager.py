"""
Soundwave AI — Minecraft Parkour Background Clip Library (agent side)

Mirrors the server implementation in server/src/lib/backgroundClips.ts:

  1. ONE long parkour video is downloaded.
  2. It is sliced into a library of 60-second clips.
  3. Each short consumes exactly one clip, which is then DELETED.
  4. When the library is empty the source is retired (big file deleted), its
     URL is REMEMBERED so it is never picked again, and a NEW video is found —
     curated list first, then a live YouTube search via yt-dlp.

State lives in background_cache/minecraft_parkour/state.json so a restart
resumes the remaining clips instead of re-downloading the same hour of video.
"""

import json
import os
import random
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

CURATED_HIGH_QUALITY_MINECRAFT_PARKOUR = [
    "https://www.youtube.com/watch?v=tiOl_mcAsF4",  # High Quality 1-Hour Gameplay
    "https://www.youtube.com/watch?v=BXUA2FncVPI",  # 4K Parkour for Shorts
    "https://www.youtube.com/watch?v=71YeZAUS9NQ",  # 4K 60FPS Clean Gameplay
    "https://www.youtube.com/watch?v=85z7jqGAGcc",  # 2-Hour Smooth Runs
    "https://www.youtube.com/watch?v=FOX3lBXVeck",  # Free to Use / Drive
]

BLACKLIST_URLS = ["dQw4w9WgXcQ", "NJ1VD4eCcD0", "rickroll", "rick roll"]

# Every clip handed to the renderer is this long. Must match the server's
# CLIP_SECS (server/src/lib/backgroundClips.ts) so both sides share one library.
CLIP_DURATION = int(os.environ.get("BACKGROUND_CLIP_SECS", "60"))
# Backwards-compatible alias (older callers read CHUNK_DURATION).
CHUNK_DURATION = CLIP_DURATION

CLIP_BATCH = int(os.environ.get("BACKGROUND_CLIP_BATCH", "10"))
MIN_SOURCE_SECS = int(os.environ.get("BACKGROUND_MIN_SOURCE_SECS", "120"))
MAX_SOURCE_SECS = int(os.environ.get("BACKGROUND_MAX_SOURCE_SECS", str(3 * 3600)))
MAX_HEIGHT = int(os.environ.get("BACKGROUND_MAX_HEIGHT", "720"))
SEARCH_QUERY = os.environ.get(
    "BACKGROUND_SEARCH_QUERY", "minecraft parkour gameplay no copyright long"
)
MIN_CLIP_BYTES = 50 * 1024


def is_blacklisted(url: str) -> bool:
    """Case-insensitive blacklist check (the URL is lowercased, so the
    blacklist entries must be compared lowercased too)."""
    url_lower = (url or "").lower()
    return any(b.lower() in url_lower for b in BLACKLIST_URLS)


# ── Paths ────────────────────────────────────────────────────────────────────
def get_cache_root() -> Path:
    """Root of the parkour library (shared with the server's DATA_DIR when set)."""
    env_dir = os.environ.get("DATA_DIR")
    if env_dir:
        return Path(env_dir) / "background_cache" / "minecraft_parkour"
    for c in (
        Path.cwd() / "background_cache" / "minecraft_parkour",
        Path(__file__).parent.parent / "background_cache" / "minecraft_parkour",
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


# ── Discovery: find a NEW long video to clip ─────────────────────────────────
def discover_urls(used: List[str]) -> List[str]:
    """Curated videos first, then a live YouTube search. Anything already
    clipped or blacklisted is skipped."""
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

    # Curated list exhausted → actually go look for a new video online.
    _, ytdlp_bin = find_tools()
    if ytdlp_bin:
        try:
            proc = subprocess.run(
                _ytdlp_cmd(ytdlp_bin) + [
                    "--no-warnings", "--ignore-config", "--flat-playlist",
                    "--playlist-end", "15", "--print", "%(url)s",
                    f"ytsearch15:{SEARCH_QUERY}",
                ],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120,
            )
            for line in proc.stdout.decode("utf-8", "ignore").splitlines():
                push(line.strip())
        except Exception as e:
            print(f"[CacheManager] YouTube search failed: {e}")

    return out


# ── Download one LONG source video ───────────────────────────────────────────
def download_source(url: str, timeout: int = 900) -> Optional[Dict[str, Any]]:
    """Download a full long video to serve as the clip source."""
    _, ytdlp_bin = find_tools()
    ffmpeg_bin, _ = find_tools()
    if not ytdlp_bin:
        print("[CacheManager] yt-dlp not found; cannot download a background source.")
        return None

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
            return None
    except Exception as e:
        print(f"[CacheManager] download error for {url}: {e}")
        return None

    duration = probe_duration(ffmpeg_bin or "ffmpeg", out_file) if ffmpeg_bin else 0.0
    if duration and duration < MIN_SOURCE_SECS:
        print(f"[CacheManager] {url} is only {duration:.0f}s — too short for a clip library")
        out_file.unlink(missing_ok=True)
        return None
    if duration and duration > MAX_SOURCE_SECS:
        print(f"[CacheManager] {url} is {duration:.0f}s — over the {MAX_SOURCE_SECS}s cap")
        out_file.unlink(missing_ok=True)
        return None

    return {"url": url, "video_id": vid, "path": str(out_file),
            "duration": duration, "consumed": 0.0, "acquired_at": time.time()}


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
    """Delete the big source file and remember its URL permanently."""
    src = state.get("source")
    if not src:
        return
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


def acquire_clip() -> Optional[Path]:
    """Hand out the next unused 60s clip, downloading a new source if needed."""
    state = load_state()
    _prune_queue(state)

    # 1. Serve from the existing library.
    if not state["queue"] and state.get("source") and Path(state["source"]["path"]).exists():
        made = slice_batch(state["source"], CLIP_BATCH)
        state["queue"].extend(made)
        state["source"]["consumed"] += len(made) * CLIP_DURATION
        if not made or state["source"]["consumed"] >= state["source"]["duration"] - 1:
            _retire_source(state)
        save_state(state)

    # 2. Library empty → find a NEW video online and clip it.
    if not state["queue"]:
        for url in discover_urls(state["used_urls"]):
            src = download_source(url)
            if not src:
                continue
            state["source"] = src
            made = slice_batch(src, CLIP_BATCH)
            state["queue"] = made
            src["consumed"] += len(made) * CLIP_DURATION
            save_state(state)
            if made:
                break
            _retire_source(state)

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

    Passing `youtube_url` seeds the library from that specific video; otherwise
    the next unused clip is served (downloading a new long source if needed).
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
        made = slice_batch(src, CLIP_BATCH)
        state["queue"] = made
        src["consumed"] += len(made) * CLIP_DURATION
        save_state(state)
        return (get_cache_dir() / made[0]) if made else None
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
            "duration": src.get("duration"),
            "consumed": src.get("consumed"),
            "present": Path(src["path"]).exists(),
        },
        "clips_ready": len(state["queue"]),
        "used_urls": state["used_urls"],
        "last_used_url": state.get("last_used_url"),
        "clips_delivered": state.get("clips_delivered", 0),
        "sources_consumed": state.get("sources_consumed", 0),
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
