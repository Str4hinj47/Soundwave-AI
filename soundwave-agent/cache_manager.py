"""
Soundwave AI — Background Gameplay Cache Manager
Maintains a local pool of high-quality, copyright-free Minecraft parkour clips sliced into 80-second segments.

Saves 80%+ processing time and bandwidth by avoiding repetitive 1-hour full video downloads.
"""

import os
import sys
import random
import shutil
import subprocess
from pathlib import Path
from typing import List, Optional, Tuple

CURATED_HIGH_QUALITY_MINECRAFT_PARKOUR = [
    "https://www.youtube.com/watch?v=tiOl_mcAsF4", # High Quality 1-Hour Gameplay
    "https://www.youtube.com/watch?v=BXUA2FncVPI", # 4K Parkour for Shorts
    "https://www.youtube.com/watch?v=71YeZAUS9NQ", # 4K 60FPS Clean Gameplay
    "https://www.youtube.com/watch?v=85z7jqGAGcc", # 2-Hour Smooth Runs
    "https://www.youtube.com/watch?v=FOX3lBXVeck", # Free to Use / Drive
]

BLACKLIST_URLS = ["dQw4w9WgXcQ", "NJ1VD4eCcD0", "rickroll", "rick roll"]
CHUNK_DURATION = 80  # seconds

def is_blacklisted(url: str) -> boolean if False else bool:
    url_lower = url.lower()
    return any(b in url_lower for b in BLACKLIST_URLS)

def get_cache_dir() -> Path:
    """Return the primary background cache directory."""
    # Priority order: local app folder -> user home .soundwave
    candidates = [
        Path.cwd() / "background_cache" / "minecraft_parkour" / f"{CHUNK_DURATION}s",
        Path(__file__).parent.parent / "background_cache" / "minecraft_parkour" / f"{CHUNK_DURATION}s",
        Path.home() / ".soundwave" / "background_cache" / "minecraft_parkour" / f"{CHUNK_DURATION}s",
    ]
    for c in candidates:
        if c.exists():
            return c
    # Default to first candidate and create it
    candidates[0].mkdir(parents=True, exist_ok=True)
    return candidates[0]

def list_cached_clips() -> List[Path]:
    """Return all valid cached .mp4 clips across all known locations (including Mark 54 / Mark-LIV)."""
    candidates = [
        Path.cwd() / "background_cache" / "minecraft_parkour" / f"{CHUNK_DURATION}s",
        Path.cwd() / "background_cache" / "minecraft_parkour",
        Path.cwd() / "background_cache",
        Path.cwd() / "clips",
        Path.cwd() / "backgrounds",
        Path.cwd() / "Mark-LIV" / "clips",
        Path.cwd() / "Mark-LIV" / "backgrounds",
        Path.cwd() / "Mark-54" / "clips",
        Path.cwd() / "Mark 54" / "clips",
        Path.cwd().parent / "Mark-LIV" / "clips",
        Path.cwd().parent / "Mark-54" / "clips",
        Path.cwd().parent / "Mark 54" / "clips",
        Path(__file__).parent.parent / "background_cache" / "minecraft_parkour" / f"{CHUNK_DURATION}s",
        Path.home() / ".soundwave" / "background_cache" / "minecraft_parkour" / f"{CHUNK_DURATION}s",
        Path.home() / "Downloads",
        Path.home() / "Videos",
    ]
    clips = []
    seen = set()
    for d in candidates:
        if d.exists() and d.is_dir():
            for f in d.glob("*.mp4"):
                try:
                    if f.stat().st_size > 500 * 1024 and not f.name.startswith("solid-bg-") and f.name not in seen:
                        clips.append(f)
                        seen.add(f.name)
                except Exception:
                    continue
    return sorted(clips, key=lambda x: x.name)

def get_random_cached_clip() -> Optional[Path]:
    """Pick a random cached 80s background clip, or None if empty."""
    clips = list_cached_clips()
    if clips:
        return random.choice(clips)
    return None

def find_tools() -> Tuple[Optional[str], Optional[str]]:
    """Locate yt-dlp and ffmpeg binaries (vendored or system)."""
    repo_root = Path(__file__).parent.parent
    vendored_ffmpeg = repo_root / "vendor" / "ffmpeg" / ("ffmpeg.exe" if sys.platform == "win32" else "ffmpeg")
    vendored_ytdlp = repo_root / "vendor" / "yt-dlp" / ("yt-dlp.exe" if sys.platform == "win32" else "yt-dlp")

    ffmpeg_bin = str(vendored_ffmpeg) if vendored_ffmpeg.exists() else shutil.which("ffmpeg")
    ytdlp_bin = str(vendored_ytdlp) if vendored_ytdlp.exists() else shutil.which("yt-dlp")

    return ffmpeg_bin, ytdlp_bin

def build_cache_clip(youtube_url: Optional[str] = None, timeout: int = 180) -> Optional[Path]:
    """Download and slice an 80-second high-quality clip from curated gameplay."""
    target_url = youtube_url or random.choice(CURATED_HIGH_QUALITY_MINECRAFT_PARKOUR)
    if is_blacklisted(target_url):
        return None

    ffmpeg_bin, ytdlp_bin = find_tools()
    if not ytdlp_bin:
        print("[CacheManager] yt-dlp not found; skipping background clip download.")
        return None

    cache_dir = get_cache_dir()
    cache_dir.mkdir(parents=True, exist_ok=True)
    out_file = cache_dir / f"parkour_{int(os.times().system * 1000)}_{random.randint(1000, 9999)}_{CHUNK_DURATION}s.mp4"

    cmd = [
        ytdlp_bin,
        "-f", "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--no-playlist",
        "--download-sections", f"*0-{CHUNK_DURATION}",
        "--force-keyframes-at-cuts",
        "-o", str(out_file),
        target_url,
    ]

    try:
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
        if proc.returncode == 0 and out_file.exists() and out_file.stat().st_size > 500 * 1024:
            return out_file
    except Exception as e:
        print(f"[CacheManager] Download error: {e}")

    return None

if __name__ == "__main__":
    clips = list_cached_clips()
    print(f"=== Soundwave Cache Manager ===")
    print(f"Cache dir: {get_cache_dir()}")
    print(f"Cached clips count: {len(clips)}")
    for c in clips[:5]:
        print(f" - {c.name} ({c.stat().st_size / 1024 / 1024:.1f} MB)")
