#!/usr/bin/env python3
"""Fetch a REAL long Minecraft gameplay background master (one-time, offline fallback).

The short pipeline auto-downloads from the Orbital - No Copyright Gameplay
channel (https://www.youtube.com/@OrbitalNCG) every time the clip library
runs dry. This script does the same download ONCE and keeps the master file
in vendor/minecraft-backgrounds/, so:

  * the pipeline works even if YouTube/yt-dlp is blocked or flaky later,
  * you can inspect the actual footage before any short is built.

Both the server (backgroundClips.ts) and the agent (cache_manager.py) pick
up every *.mp4 in vendor/minecraft-backgrounds/ automatically — no config
needed. The files are consumed from but never deleted.

Usage (from anywhere; run with the repo's python3 / python):
    python3 scripts/fetch_background_master.py                # default: 2h29m master
    python3 scripts/fetch_background_master.py fw_eWpb7uCE    # 4h53m VERTICAL 9:16
    python3 scripts/fetch_background_master.py <full watch URL>

Only Orbital-channel Minecraft videos pass — anything else is refused,
exactly like the live pipeline.
"""

import sys
import time
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "soundwave-agent"))

import cache_manager as cm  # noqa: E402  (single source of truth for the gates)

DEFAULT_VIDEO_ID = "85z7jqGAGcc"  # "Minecraft Parkour Gameplay No Copyright (2 Hours)"

# Vertical 4h53m — best quality for 9:16 shorts (no cropping), biggest file.
VERTICAL_VIDEO_ID = "fw_eWpb7uCE"


def main() -> int:
    arg = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_VIDEO_ID
    url = arg if arg.startswith("http") else f"https://www.youtube.com/watch?v={arg}"

    _, ytdlp_bin = cm.find_tools()
    ffmpeg_bin, _ = cm.find_tools()
    if not ytdlp_bin:
        print("error: yt-dlp not found (vendor/yt-dlp/yt-dlp or PATH)")
        return 1
    if not ffmpeg_bin:
        print("error: ffmpeg not found (vendor/ffmpeg/ffmpeg or PATH)")
        return 1

    # Same gates as the live pipeline: Orbital channel + Minecraft title + duration fit.
    meta = cm.fetch_youtube_meta(ytdlp_bin, url)
    if meta is None:
        print(f"error: could not fetch metadata for {url}")
        return 1
    if not cm.is_orbital_source(meta):
        print(f"error: {url} is from \"{meta.get('channel') or meta.get('uploader')}\" — "
              "only the Orbital channel is allowed")
        return 1
    if not cm.MINECRAFT_TITLE_RE.search(meta["title"]):
        print(f'error: title "{meta["title"]}" is not Minecraft gameplay')
        return 1
    dur = meta["duration"]
    if dur and (dur < cm.MIN_SOURCE_SECS or dur > cm.MAX_SOURCE_SECS):
        print(f"error: {dur:.0f}s is outside the {cm.MIN_SOURCE_SECS}s–{cm.MAX_SOURCE_SECS}s range")
        return 1

    out_dir = REPO_ROOT / "vendor" / "minecraft-backgrounds"
    out_dir.mkdir(parents=True, exist_ok=True)
    vid = cm.video_id(url) or str(int(time.time()))
    out_file = out_dir / f"master_{vid}.mp4"
    if out_file.exists():
        print(f"already present: {out_file} ({out_file.stat().st_size / 1e6:.0f} MB) — delete it first to re-fetch")
        return 0

    print(f"downloading: {meta['title']}")
    print(f"channel:     {meta.get('channel') or meta.get('uploader')}")
    print(f"duration:    {dur:.0f}s  →  {out_file}")
    src = cm.download_source(url, timeout=3600)
    if not src:
        print("error: download failed (see messages above)")
        return 1

    # Move the downloaded source next to the other masters.
    src_file = Path(src["path"])
    src_file.replace(out_file)
    final = cm.probe_duration(ffmpeg_bin, out_file)
    clips_expected = int(final // cm.CLIP_DURATION) if final else 0

    credits = out_dir / "CREDITS.txt"
    credits.write_text(
        "Minecraft background footage — credits required by the source channel\n"
        "========================================================================\n\n"
        f"Video:      {meta['title']}\n"
        f"Channel:    {meta.get('channel') or meta.get('uploader')}\n"
        f"URL:        {url}\n"
        f"Duration:   {dur:.0f}s\n"
        f"Fetched:    {datetime.now(timezone.utc).isoformat(timespec='seconds')} "
        f"(scripts/fetch_background_master.py)\n\n"
        "License:    No copyright / free to use / royalty free (per channel)\n"
        "Conditions: 1) Credit this channel in your video description.\n"
        "            2) Do NOT re-upload the footage as 'No Copyright Gameplay'.\n\n"
        "If you also use other Orbital videos from this channel, list them here.\n",
        encoding="utf-8",
    )

    print(f"\nOK — real footage ready: {out_file.name} "
          f"({out_file.stat().st_size / 1e6:.0f} MB, ~{clips_expected} x 60s clips)")
    print(f"credits written:  {credits}")
    print("The pipeline will use this master automatically (no config needed).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
