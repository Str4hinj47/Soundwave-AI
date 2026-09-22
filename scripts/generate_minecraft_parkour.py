#!/usr/bin/env python3
"""
Generate a continuous 80-second, 60fps 1080x1920 vertical Minecraft Parkour
background video with dynamic camera sprinting, jump arcs, head bob,
and authentic Minecraft HUD (crosshair, hotbar, hearts, experience bar).
No external network required. 100% copyright-free and clean.
"""
import os
import sys
import subprocess
import glob

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(ROOT_DIR, "background_cache", "minecraft_parkour", "80s")
DATA_CACHE_DIR = os.path.join(ROOT_DIR, "data", "background_cache", "minecraft_parkour", "80s")

# Stages and assets priority: bundled scripts/assets first, then background_cache
BUNDLED_STAGES = os.path.join(ROOT_DIR, "scripts", "assets", "stages")
BUNDLED_HUD = os.path.join(ROOT_DIR, "scripts", "assets", "hud", "hud_overlay.png")
BUNDLED_MUSIC = os.path.join(ROOT_DIR, "scripts", "assets", "music", "epic-motivation.mp3")

STAGES_DIR = BUNDLED_STAGES if os.path.exists(BUNDLED_STAGES) else os.path.join(ROOT_DIR, "background_cache", "minecraft_parkour", "stages")
OVERLAY_PNG = BUNDLED_HUD if os.path.exists(BUNDLED_HUD) else os.path.join(ROOT_DIR, "background_cache", "minecraft_parkour", "assets", "hud_overlay.png")
MUSIC_FILE = BUNDLED_MUSIC if os.path.exists(BUNDLED_MUSIC) else os.path.join(ROOT_DIR, "background_cache", "music", "epic-motivation.mp3")

OUTPUT_FILE = os.path.join(CACHE_DIR, "parkour_master_80s.mp4")
DATA_OUTPUT_FILE = os.path.join(DATA_CACHE_DIR, "parkour_master_80s.mp4")

FFMPEG = os.path.join(ROOT_DIR, "vendor", "ffmpeg", "ffmpeg")
if not os.path.exists(FFMPEG):
    FFMPEG = "ffmpeg"

def main():
    os.makedirs(CACHE_DIR, exist_ok=True)
    os.makedirs(DATA_CACHE_DIR, exist_ok=True)
    os.makedirs(STAGES_DIR, exist_ok=True)

    stages = sorted(glob.glob(os.path.join(STAGES_DIR, "*-thumb.jpg")))
    if not stages:
        print("[generate_minecraft_parkour] No stages found in", STAGES_DIR)
        return 1

    print(f"[generate_minecraft_parkour] Found {len(stages)} Minecraft parkour stages.")

    # Render each stage into a 8-second 60fps dynamic clip
    stage_clips = []
    tmp_dir = "/tmp/mc_stages"
    os.makedirs(tmp_dir, exist_ok=True)

    for idx, stage_img in enumerate(stages):
        clip_path = os.path.join(tmp_dir, f"stage_{idx}.mp4")
        stage_clips.append(clip_path)

        # Dynamic zoompan:
        # z: zooms from 1.0 to 1.30 over 480 frames (8 seconds at 60fps)
        # x: center with slight sprint sway
        # y: center with running bob + jump arcs
        # fps: 60, size: 1080x1920
        zoom_expr = "min(zoom+0.00065,1.30)"
        x_expr = "iw/2-(iw/zoom/2)+sin(on/8)*14"
        y_expr = "ih/2-(ih/zoom/2)+abs(cos(on/8))*10"
        filter_str = f"zoompan=z='{zoom_expr}':x='{x_expr}':y='{y_expr}':d=480:s=1080x1920:fps=60"

        if os.path.exists(OVERLAY_PNG):
            full_filter = f"[0:v]{filter_str}[bg];[bg][1:v]overlay=0:0[v]"
            cmd = [
                FFMPEG, "-y",
                "-loop", "1", "-i", stage_img,
                "-loop", "1", "-i", OVERLAY_PNG,
                "-filter_complex", full_filter,
                "-map", "[v]",
                "-t", "8",
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22", "-pix_fmt", "yuv420p",
                clip_path
            ]
        else:
            cmd = [
                FFMPEG, "-y",
                "-loop", "1", "-i", stage_img,
                "-vf", filter_str,
                "-t", "8",
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22", "-pix_fmt", "yuv420p",
                clip_path
            ]

        print(f" -> Rendering stage {idx + 1}/{len(stages)}: {os.path.basename(stage_img)}...")
        ret = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        if ret.returncode != 0:
            print("FFmpeg error:", ret.stderr.decode("utf-8")[-400:], file=sys.stderr)
            return 1

    # Concatenate all stage clips into one master 80-second loop
    concat_list_path = os.path.join(tmp_dir, "concat_list.txt")
    with open(concat_list_path, "w") as f:
        for c in stage_clips:
            f.write(f"file '{c}'\n")

    # Add background audio track if available
    music_track = os.path.join(ROOT_DIR, "background_cache", "music", "epic-motivation.mp3")
    print(" -> Merging all stages into final parkour video...")

    if os.path.exists(music_track):
        cmd_concat = [
            FFMPEG, "-y",
            "-f", "concat", "-safe", "0", "-i", concat_list_path,
            "-stream_loop", "-1", "-i", music_track,
            "-c:v", "copy",
            "-c:a", "libmp3lame", "-b:a", "128k",
            "-filter:a", "volume=0.25",
            "-shortest",
            OUTPUT_FILE
        ]
    else:
        cmd_concat = [
            FFMPEG, "-y",
            "-f", "concat", "-safe", "0", "-i", concat_list_path,
            "-c:v", "copy",
            OUTPUT_FILE
        ]

    subprocess.run(cmd_concat, check=True)

    # Copy to data cache dir as well
    import shutil
    shutil.copyfile(OUTPUT_FILE, DATA_OUTPUT_FILE)

    size_mb = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
    print(f"✓ Generated high-quality Minecraft parkour background: {OUTPUT_FILE} ({size_mb:.2f} MB)")
    return 0

if __name__ == "__main__":
    sys.exit(main())
