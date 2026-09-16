"""
Soundwave AI YouTube Import — Mark LIII Plugin

Teaches JARVIS to use Soundwave AI's YouTube import for video backgrounds.

Soundwave YouTube import (server/src/lib/ytdlp.ts + routes/upload.ts):
- Vendored yt-dlp zipapp in vendor/yt-dlp/yt-dlp (needs python3), auto-detected, override via YTDLP_PATH env
- YTDLP_COOKIES optional cookies.txt for bot/age-gated videos, YTDLP_MAX_DURATION caps length (default 1200s), YTDLP_TIMEOUT_MS 240s
- Endpoint: POST /api/v1/upload/youtube with {url} → uses yt-dlp to download, returns fileKey, streams via GET /file/:key Range supported for previews
- Frontend: Video Compositor → Import from YouTube button
- Then used as background in export job, loops if shorter than voice, or cut via videoEnd

This plugin lets JARVIS:
- Explain YouTube import workflow
- Download YouTube video via yt-dlp directly (no Soundwave server)
- Prepare for Soundwave video export

Install: pip install yt-dlp requests (yt-dlp already vendored in Soundwave)
"""

PLUGIN = {
    "name": "soundwave_youtube",
    "description": (
        "Imports YouTube videos as background for Soundwave AI video compositing via yt-dlp. "
        "Use when user asks to import YouTube video, download YouTube, use YouTube as background, YouTube to video, import from YouTube. "
        "Soundwave uses vendored yt-dlp zipapp (needs python3) with cookies support for age/bot-gated, max duration cap. "
        "Trigger phrases: import YouTube, download YouTube video, YouTube background, YouTube to Soundwave, import from YouTube."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "url": {"type": "STRING", "description": "YouTube URL to import (e.g. https://youtube.com/watch?v=...)"},
            "action": {"type": "STRING", "description": "Action: info, download, soundwave_import. Default info."},
            "output_path": {"type": "STRING", "description": "Output path for download action (optional)"},
        },
        "required": ["url"],
    },
}

def run(parameters: dict, player=None, session_memory=None) -> str:
    url = parameters.get("url", "").strip()
    action = (parameters.get("action", "info") or "info").lower()
    output_path = parameters.get("output_path", "") or ""

    if not url:
        return "Need YouTube URL: soundwave_youtube url=https://youtube.com/watch?v=..."

    try:
        from pathlib import Path
        import shutil
        import subprocess

        if action == "info":
            return (
                f"YouTube Import for Soundwave Video Background — URL: {url}\n"
                "\n"
                "Soundwave workflow:\n"
                "1. API: POST /api/v1/upload/youtube with {url} → server runs yt-dlp (vendored vendor/yt-dlp/yt-dlp zipapp, needs python3)\n"
                "   • Auto-detected, override via YTDLP_PATH env (e.g. /usr/bin/yt-dlp)\n"
                "   • YTDLP_COOKIES env accepts cookies.txt export for bot/age-gated videos\n"
                "   • YTDLP_MAX_DURATION (seconds, default 1200) caps importable length, refuses longer\n"
                "   • YTDLP_TIMEOUT_MS (default 240000) timeout\n"
                "   • Returns fileKey (UUIDv7), stored under uploads dir, served via GET /api/v1/upload/file/:key Range supported for previews\n"
                "2. Frontend: Video Compositor → 'Import from YouTube' button → paste URL → previews via file stream\n"
                "3. Export: Use fileKey as videoFileKey in POST /api/v1/export/video with audioFileKey + subtitleData + exportSettings (resolution, aspect 16:9 or 9:16 portrait)\n"
                "   • Video shorter than voice? Loops automatically so voiceover never cut off, or cut via videoEnd param\n"
                "   • FFmpeg libx264/libvpx-vp9 + libass burn-in\n"
                "\n"
                "Local download via JARVIS (no Soundwave server):\n"
                f"• soundwave_youtube url={url} action=download → downloads via yt-dlp to ~/Soundwave/youtube/ or output_path\n"
                "• Then use downloaded file as background in Soundwave UI upload or via soundwave_video action=prepare video_path=...\n"
                "\n"
                "Via Soundwave API:\n"
                f"• soundwave_youtube url={url} action=soundwave_import → calls POST /api/v1/upload/youtube via Soundwave API\n"
            )

        elif action == "download":
            # Direct yt-dlp download
            out_dir = Path(output_path).parent if output_path and Path(output_path).suffix else (Path(output_path) if output_path else Path.home() / "Soundwave" / "youtube")
            out_dir.mkdir(parents=True, exist_ok=True)

            # Find yt-dlp
            yt_dlp_bin = None
            # Check vendored in Soundwave repo if exists
            possible = [
                Path.home() / "Soundwave-AI" / "vendor" / "yt-dlp" / "yt-dlp",
                Path.cwd() / "vendor" / "yt-dlp" / "yt-dlp",
                Path(__file__).resolve().parent.parent / "vendor" / "yt-dlp" / "yt-dlp",
            ]
            for p in possible:
                if p.exists():
                    yt_dlp_bin = str(p)
                    break
            if not yt_dlp_bin:
                yt_dlp_bin = shutil.which("yt-dlp") or "yt-dlp"

            # Output template
            if output_path and Path(output_path).suffix:
                out_template = output_path
            else:
                out_template = str(out_dir / "%(title)s [%(id)s].%(ext)s")

            cmd = [yt_dlp_bin, "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best", "-o", out_template, url]
            # Use python if vendored is zipapp
            if yt_dlp_bin.endswith("yt-dlp") and Path(yt_dlp_bin).exists():
                # Check if it's zipapp (no extension, python)
                try:
                    # Try python3
                    cmd = ["python3", yt_dlp_bin, "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best", "-o", out_template, url]
                    subprocess.run(cmd, check=True, timeout=120, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                except Exception:
                    # Fallback to direct
                    cmd = [yt_dlp_bin, "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best", "-o", out_template, url]
                    subprocess.run(cmd, check=True, timeout=120)
            else:
                subprocess.run(cmd, check=True, timeout=120)

            # Find downloaded file
            downloaded = None
            if output_path and Path(output_path).exists():
                downloaded = output_path
            else:
                # Find newest file in out_dir
                files = sorted(out_dir.glob("*"), key=lambda p: p.stat().st_mtime, reverse=True)
                if files:
                    downloaded = str(files[0])

            result = f"Downloaded YouTube {url} → {downloaded or out_dir} via yt-dlp ({yt_dlp_bin}). Use as background in Soundwave: soundwave_video action=prepare video_path={downloaded or ''}"
            if player:
                try:
                    player.write_log(f"JARVIS: {result}")
                except Exception:
                    pass
            return result

        elif action == "soundwave_import":
            try:
                from _soundwave_client import api_request, resolve_api_url
                api_url = resolve_api_url()
                res = api_request("POST", "/api/v1/upload/youtube", json_data={"url": url}, timeout=180)
                file_key = res.get("fileKey") or res.get("key") or str(res)
                result = f"Imported YouTube via Soundwave API {api_url}/api/v1/upload/youtube: {url} → fileKey {file_key}. Use as videoFileKey in export job. Response: {res}"
                if player:
                    try:
                        player.write_log(f"JARVIS: {result}")
                    except Exception:
                        pass
                return result
            except Exception as e:
                return f"Soundwave YouTube import via API failed: {e}. Try action=download for direct yt-dlp download (no server needed). Ensure Soundwave server running and YTDLP configured."

        else:
            return f"Unknown action {action}. Use info, download, or soundwave_import."

    except Exception as e:
        return f"YouTube import failed: {e}. Install yt-dlp: pip install yt-dlp"
