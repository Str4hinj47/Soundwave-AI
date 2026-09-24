"""
Soundwave AI — Background Gameplay Cache Manager & Clip Pool
Maintains a rotating pool of 60-second Minecraft parkour clips.
- Chops long videos into 60-second clips.
- Consumes clips sequentially and deletes each clip upon use.
- When the pool empties, automatically downloads an unused long video.
- Persistently records used URLs in used_videos.json to prevent duplicates.
"""

import os
import sys
import json
import time
import shutil
import subprocess
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any

# Ensure yt_clipper is importable
repo_root = Path(__file__).resolve().parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

try:
    from yt_clipper.plugin import ParkourClippingPlugin
    from yt_clipper.config import ClippingConfig
    HAS_YT_CLIPPER = True
except Exception:
    HAS_YT_CLIPPER = False

# Orbital - No Copyright Gameplay (https://www.youtube.com/@OrbitalNCG/videos)
# All background sources come from this channel only.
ORBITAL_NCG_CHANNEL_URL = "https://www.youtube.com/@OrbitalNCG/videos"

CURATED_LONG_PARKOUR_VIDEOS = [
    "https://www.youtube.com/watch?v=fw_eWpb7uCE", # Orbital NCG — Vertical 4 HOURS
    "https://www.youtube.com/watch?v=zeyy5Yj-A4I", # Orbital NCG — 4 HOURS
    "https://www.youtube.com/watch?v=-qK8scH4UC8", # Orbital NCG — Vertical 2 Hours
    "https://www.youtube.com/watch?v=85z7jqGAGcc", # Orbital NCG — 2 Hours
    "https://www.youtube.com/watch?v=z84bmLDzIIk", # Orbital NCG — 4K (2 Hours)
    "https://www.youtube.com/watch?v=tiOl_mcAsF4", # Orbital NCG — 1 HOUR
    "https://www.youtube.com/watch?v=xU29hjgAg2w", # Orbital NCG — Vertical 1 HOUR
    "https://www.youtube.com/watch?v=_GxTLyLyIbs", # Orbital NCG — 4K (1 HOUR)
    "https://www.youtube.com/watch?v=s600FYgI5-s", # Orbital NCG — Vertical
    "https://www.youtube.com/watch?v=yve_DhR1F8s", # Orbital NCG — Vertical
    "https://www.youtube.com/watch?v=VwZO7Im_tAc", # Orbital NCG — 4K Horror Map
    "https://www.youtube.com/watch?v=FOX3lBXVeck", # Orbital NCG — Free2Use
    "https://www.youtube.com/watch?v=BXUA2FncVPI", # Orbital NCG — 4K
    "https://www.youtube.com/watch?v=zdVQSm8bYu8", # Orbital NCG — Minecraft Parkour
]

BLACKLIST_URLS = ["dQw4w9WgXcQ", "NJ1VD4eCcD0", "rickroll", "rick roll"]
CLIP_DURATION = 60  # seconds

def is_blacklisted(url: str) -> bool:
    url_lower = url.lower()
    return any(b in url_lower for b in BLACKLIST_URLS)

def get_base_dir() -> Path:
    """Return the primary background cache directory."""
    candidates = [
        Path.cwd() / "background_cache" / "minecraft_parkour",
        Path(__file__).parent.parent / "background_cache" / "minecraft_parkour",
        Path.home() / ".soundwave" / "background_cache" / "minecraft_parkour",
    ]
    for c in candidates:
        if c.exists():
            return c
    candidates[0].mkdir(parents=True, exist_ok=True)
    return candidates[0]

def get_pool_dir() -> Path:
    p = get_base_dir() / "pool"
    p.mkdir(parents=True, exist_ok=True)
    return p

def get_history_file() -> Path:
    return get_base_dir() / "used_videos.json"

def load_history() -> Dict[str, Any]:
    f = get_history_file()
    if f.exists():
        try:
            with open(f, "r", encoding="utf-8") as fp:
                return json.load(fp)
        except Exception:
            pass
    return {
        "usedUrls": [],
        "customUrls": [],
        "totalClipsGenerated": 0,
        "totalClipsConsumed": 0,
        "lastReplenishedAt": None,
        "currentSourceVideo": None,
    }

def save_history(hist: Dict[str, Any]) -> None:
    f = get_history_file()
    try:
        with open(f, "w", encoding="utf-8") as fp:
            json.dump(hist, fp, indent=2)
    except Exception as e:
        print(f"[CacheManager] Failed to write history: {e}")

def find_tools() -> Tuple[Optional[str], Optional[str]]:
    """Locate yt-dlp and ffmpeg binaries."""
    repo_root = Path(__file__).parent.parent
    vendored_ffmpeg = repo_root / "vendor" / "ffmpeg" / ("ffmpeg.exe" if sys.platform == "win32" else "ffmpeg")
    vendored_ytdlp = repo_root / "vendor" / "yt-dlp" / ("yt-dlp.exe" if sys.platform == "win32" else "yt-dlp")

    ffmpeg_bin = str(vendored_ffmpeg) if vendored_ffmpeg.exists() else shutil.which("ffmpeg")
    ytdlp_bin = str(vendored_ytdlp) if vendored_ytdlp.exists() else shutil.which("yt-dlp")

    return ffmpeg_bin, ytdlp_bin

def list_pool_clips() -> List[Path]:
    """Return all remaining 60-second clips in pool directory sorted in order."""
    pool = get_pool_dir()
    clips = []
    if pool.exists():
        for f in sorted(pool.glob("*.mp4")):
            try:
                if f.stat().st_size > 200 * 1024:
                    clips.append(f)
            except Exception:
                continue
    return clips

def slice_video_into_pool(source_path: Path, source_label: str) -> int:
    """Slice long video file into 60s clips and add to pool directory."""
    ffmpeg_bin, _ = find_tools()
    if not ffmpeg_bin:
        print("[CacheManager] ffmpeg not found!")
        return 0

    pool = get_pool_dir()
    ts = int(time.time() * 1000)

    # 1. Use high-precision yt_clipper engine if available
    if HAS_YT_CLIPPER:
        try:
            print(f"[CacheManager] Using yt_clipper engine to cut: {source_path.name}")
            plugin = ParkourClippingPlugin(output_dir=str(get_base_dir()), ffmpeg_path=ffmpeg_bin)
            clips_meta = plugin.clip_local(str(source_path), clip_length=CLIP_DURATION, overlap=0.0)
            if clips_meta:
                copied = 0
                for c in clips_meta:
                    src_f = Path(c["file"])
                    if src_f.exists() and src_f.stat().st_size > 200 * 1024:
                        dest_f = pool / f"mc_clip_{ts}_{src_f.name}"
                        shutil.copy2(src_f, dest_f)
                        copied += 1
                if copied > 0:
                    hist = load_history()
                    hist["totalClipsGenerated"] = hist.get("totalClipsGenerated", 0) + copied
                    hist["lastReplenishedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                    hist["currentSourceVideo"] = source_label
                    save_history(hist)
                    print(f"[CacheManager] yt_clipper sliced {copied} 60s clips into pool.")
                    return copied
        except Exception as e:
            print(f"[CacheManager] yt_clipper local slicing fallback ({e}); using direct ffmpeg...")

    segment_pattern = str(pool / f"mc_clip_{ts}_%03d.mp4")

    print(f"[CacheManager] Slicing long video into 60s clips: {source_path.name}")
    cmd = [
        ffmpeg_bin,
        "-y",
        "-i", str(source_path),
        "-c:v", "copy",
        "-c:a", "copy",
        "-f", "segment",
        "-segment_time", str(CLIP_DURATION),
        "-reset_timestamps", "1",
        segment_pattern,
    ]

    res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    if res.returncode != 0:
        # Fallback to ultrafast transcoded segment
        cmd_fallback = [
            ffmpeg_bin,
            "-y",
            "-i", str(source_path),
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "22",
            "-c:a", "aac",
            "-f", "segment",
            "-segment_time", str(CLIP_DURATION),
            "-reset_timestamps", "1",
            segment_pattern,
        ]
        subprocess.run(cmd_fallback, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    created = [f for f in list_pool_clips() if f"mc_clip_{ts}" in f.name]
    hist = load_history()
    hist["totalClipsGenerated"] = hist.get("totalClipsGenerated", 0) + len(created)
    hist["lastReplenishedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    hist["currentSourceVideo"] = source_label
    save_history(hist)

    print(f"[CacheManager] Created {len(created)} 60s clips in pool.")
    return len(created)

def replenish_pool(specific_url: Optional[str] = None) -> bool:
    """Find a new unused long Minecraft parkour video, download, and slice into 60s clips."""
    hist = load_history()
    used = set(hist.get("usedUrls", []))

    target_url = None
    if specific_url and specific_url not in used:
        target_url = specific_url
    else:
        # Check custom URLs first
        for u in hist.get("customUrls", []):
            if u not in used:
                target_url = u
                break
        # Then discover with yt_clipper (Orbital NCG channel) or use curated URLs
        if not target_url and HAS_YT_CLIPPER:
            try:
                ffmpeg_bin, _ = find_tools()
                plugin = ParkourClippingPlugin(output_dir=str(get_base_dir()), ffmpeg_path=ffmpeg_bin)
                top_vids = plugin.find_videos(limit=5)
                for tv in top_vids:
                    u = tv.get("url") or f"https://www.youtube.com/watch?v={tv.get('video_id')}"
                    channel = (tv.get("channel") or "").lower()
                    # Only accept uploads from Orbital - No Copyright Gameplay
                    if "orbital" not in channel:
                        continue
                    if u and u not in used and not is_blacklisted(u):
                        target_url = u
                        print(f"[CacheManager] Orbital NCG source: {tv.get('title')} (score: {tv.get('score')})")
                        break
            except Exception as e:
                print(f"[CacheManager] yt_clipper discovery fallback: {e}")

        if not target_url:
            for u in CURATED_LONG_PARKOUR_VIDEOS:
                if u not in used:
                    target_url = u
                    break
        # If all used, cycle from beginning
        if not target_url:
            print("[CacheManager] All curated parkour videos used! Cycling from start.")
            target_url = CURATED_LONG_PARKOUR_VIDEOS[0]
            used.clear()
            hist["usedUrls"] = []

    print(f"[CacheManager] Selected new long video: {target_url}")

    ffmpeg_bin, ytdlp_bin = find_tools()
    long_video = None
    download_ok = False
    downloads_dir = get_base_dir() / "downloads"
    downloads_dir.mkdir(parents=True, exist_ok=True)

    if ytdlp_bin and target_url:
        dl_target = downloads_dir / f"long_{int(time.time())}.mp4"
        cmd = [
            ytdlp_bin,
            "-f", "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "--no-playlist",
            "--js-runtimes", "node",
            "--js-runtimes", "deno",
            "--extractor-args", "youtube:player_client=tv,web_safari",
            "--download-sections", "*0-600",
            "--force-keyframes-at-cuts",
            "-o", str(dl_target),
            target_url,
        ]
        try:
            p = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=180)
            if p.returncode == 0 and dl_target.exists() and dl_target.stat().st_size > 1_000_000:
                long_video = dl_target
                download_ok = True
        except Exception as e:
            print(f"[CacheManager] yt-dlp download skipped: {e}")

    # Fallback to local master file if offline or download failed
    # (download_ok stays True only when yt-dlp produced a real file above)
    if not long_video:
        master = get_base_dir() / "80s" / "parkour_master_80s.mp4"
        if master.exists() and master.stat().st_size > 1_000_000:
            long_video = master

    if not long_video:
        print("[CacheManager] No source long video available.")
        return False

    # Only mark the URL used when yt-dlp actually produced a file.
    # Failed downloads stay eligible for retry.
    count = slice_video_into_pool(long_video, target_url or "master_parkour")

    if download_ok and target_url and target_url not in hist.get("usedUrls", []):
        hist.setdefault("usedUrls", []).append(target_url)
        save_history(hist)
        print(f"[CacheManager] Recorded video URL to persistent history. Total unique used: {len(hist['usedUrls'])}")
    elif target_url and not download_ok:
        print(f"[CacheManager] Download failed for {target_url}; leaving it unused for retry.")

    # Clean up temp downloaded long file
    if long_video and long_video != get_base_dir() / "80s" / "parkour_master_80s.mp4":
        try:
            long_video.unlink(missing_ok=True)
        except Exception:
            pass

    return count > 0

def consume_next_clip() -> Optional[Path]:
    """
    Get the next 60s clip in the pool, DELETE it upon consumption,
    and return the path to the working copy.
    """
    clips = list_pool_clips()
    if not clips:
        print("[CacheManager] Pool is empty! Fetching new unused long video...")
        replenish_pool()
        clips = list_pool_clips()

    if not clips:
        master = get_base_dir() / "80s" / "parkour_master_80s.mp4"
        return master if master.exists() else None

    clip_to_use = clips[0]
    clip_name = clip_to_use.name

    # Create a working copy for rendering
    working_dir = get_base_dir() / "active_bg"
    working_dir.mkdir(parents=True, exist_ok=True)
    working_path = working_dir / f"used_{int(time.time())}_{clip_name}"
    shutil.copy2(clip_to_use, working_path)

    # DELETE the consumed clip from the pool!
    try:
        clip_to_use.unlink()
        print(f"[CacheManager] Consumed and DELETED: {clip_name}. Remaining clips in pool: {len(clips) - 1}")
        hist = load_history()
        hist["totalClipsConsumed"] = hist.get("totalClipsConsumed", 0) + 1
        save_history(hist)
    except Exception as e:
        print(f"[CacheManager] Warning: could not delete clip {clip_name}: {e}")

    return working_path

if __name__ == "__main__":
    clips = list_pool_clips()
    hist = load_history()
    print("=== Soundwave Background Pool ===")
    print(f"Pool directory: {get_pool_dir()}")
    print(f"Clips remaining: {len(clips)}")
    print(f"Used source videos: {len(hist.get('usedUrls', []))}")
    print(f"Total clips consumed: {hist.get('totalClipsConsumed', 0)}")
