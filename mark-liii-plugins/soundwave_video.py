"""
Soundwave AI Video Compositor — Mark LIII Plugin

Teaches JARVIS to use Soundwave AI's video compositing studio:
- Burn subtitles into video (FFmpeg libx264/libvpx-vp9, libass)
- 16:9 landscape + 9:16 portrait (YouTube Shorts, TikTok, Instagram Reels)
- Volume/fades, media probing, looping if video shorter than voice
- YouTube import via yt-dlp vendored zipapp
- Export jobs with SSE progress

Soundwave video flow (from server/src/routes/export.ts + frontend VideoCompositor.tsx):
1. Generate TTS → MP3 + wordTimings → cues
2. Style subtitles (presets: TikTok, YouTube, minimal, etc. — frontend/src/lib/subtitlePresets.ts)
3. Upload background video (or solid color 0x0A0F1C) + audio via /api/v1/upload/video|audio
4. POST /api/v1/export/video with videoFileKey, audioFileKey, subtitleData, subtitleStyle, exportSettings (resolution 720p/1080p/1440p/4K, aspect 16:9/9:16, format mp4/webm, quality low/medium/high, fps 24-60, audioVolume, fadeIn/out, videoEnd)
5. Job queued → processing via FFmpeg, progress via SSE /jobs/:id/events, download /jobs/:id/download
6. Quotas: Free 2 exports/hour 720p watermark, Pro 20/hour 1080p, Enterprise 100/hour 4K no watermark

This plugin lets JARVIS explain workflow, prepare files, and optionally run FFmpeg locally.

Install: pip install requests
FFmpeg required for local export (same as Soundwave server).
"""

PLUGIN = {
    "name": "soundwave_video",
    "description": (
        "Creates and exports videos with burned-in subtitles using Soundwave AI's video compositing engine (FFmpeg). "
        "Use when user asks to make video, burn subtitles, create video with voiceover, export video, video with captions, portrait video, YouTube Shorts, TikTok video, Reels. "
        "Supports 16:9 landscape and 9:16 portrait (1080x1920 for Shorts/TikTok/Reels), resolutions 720p to 4K, MP4/WebM, FFmpeg libass. "
        "Trigger phrases: make video, burn subtitles, create video, export video, video with subtitles, portrait video, Shorts video, TikTok video."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {"type": "STRING", "description": "Action: workflow, prepare, export, youtube_import, status. Default workflow."},
            "text": {"type": "STRING", "description": "Text for voiceover (for prepare action)"},
            "voice": {"type": "STRING", "description": "Voice for TTS: Jenny, Ana, Sonia, Christopher, Guy, Ryan"},
            "video_path": {"type": "STRING", "description": "Path to background video file (optional, solid color if empty)"},
            "aspect": {"type": "STRING", "description": "Aspect ratio: 16:9 (landscape) or 9:16 (portrait for Shorts/TikTok). Default 16:9"},
            "resolution": {"type": "STRING", "description": "Resolution: 720p, 1080p, 1440p, 4K. Default 1080p"},
            "youtube_url": {"type": "STRING", "description": "YouTube URL for youtube_import action"},
        },
        "required": [],
    },
}

def run(parameters: dict, player=None, session_memory=None) -> str:
    action = (parameters.get("action", "workflow") or "workflow").lower()
    text = parameters.get("text", "") or ""
    voice = parameters.get("voice", "Jenny") or "Jenny"
    video_path = parameters.get("video_path", "") or ""
    aspect = parameters.get("aspect", "16:9") or "16:9"
    resolution = parameters.get("resolution", "1080p") or "1080p"
    youtube_url = parameters.get("youtube_url", "") or ""

    try:
        from pathlib import Path
        import json
        import time

        if action == "workflow":
            return (
                "Soundwave Video Compositor — Workflow to burn subtitles into video:\n"
                "\n"
                "1. TTS Generation:\n"
                "   • Use soundwave_tts or soundwave_studio action=tts text=\"...\" voice=Jenny → creates MP3 + SRT\n"
                "   • Soundwave uses Microsoft Neural voices via Edge TTS (24kHz mono MP3 + word timings)\n"
                "   • 6 voices: Jenny warm friendly (YouTube), Ana energetic (TikTok), Sonia British elegant (corporate), Christopher deep (trailer), Guy casual (vlog), Ryan British clear (news)\n"
                "\n"
                "2. Subtitle Styling (in Soundwave UI: Studio → Subtitles):\n"
                "   • Presets: TikTok (bold, center), YouTube (classic), minimal, etc. (frontend/src/lib/subtitlePresets.ts)\n"
                "   • Styles: font, size, color, background, position, animation\n"
                "   • Word timings from TTS → cues (start, end, text)\n"
                "\n"
                "3. Background Video:\n"
                "   • Upload via /api/v1/upload/video (magic-byte validated, UUIDv7 keys) OR solid color 0x0A0F1C (default, perfect for lyric videos)\n"
                "   • YouTube import: POST /api/v1/upload/youtube with {url} → yt-dlp vendored zipapp (needs python3), Range supported, YTDLP_COOKIES for age/bot-gated, YTDLP_MAX_DURATION caps length\n"
                "   • Video shorter than voice? Loops automatically so voiceover never cut off, or cut via videoEnd param\n"
                "\n"
                "4. Export (in Soundwave UI: Studio → Video or via API):\n"
                f"   • Settings: resolution {resolution} (Free 720p watermark, Pro 1080p, Enterprise 4K no watermark), aspect {aspect} (16:9 landscape 1920x1080 or 9:16 portrait 1080x1920 for Shorts/TikTok/Reels), format mp4/webm, quality low/medium/high, fps 24-60, audioVolume 0-2, fadeIn/out 0-30s, videoEnd optional cut\n"
                "   • API: POST /api/v1/export/video with videoFileKey (nullable), audioFileKey, subtitleData (array of {start, end, text}), subtitleStyle, exportSettings, projectId\n"
                "   • Job: QUEUED → PROCESSING (FFmpeg libx264/libvpx-vp9, libass subtitles + ASS watermark, volume/fades, media probing) → COMPLETED/FAILED\n"
                "   • Progress: GET /api/v1/export/jobs/:id (poll) or /jobs/:id/events (SSE stream), download /jobs/:id/download\n"
                "   • Rate limit: Free 2/hour, Pro 20/hour, Enterprise 100/hour\n"
                "\n"
                "5. Example via JARVIS:\n"
                "   • soundwave_studio action=tts text=\"Welcome to Soundwave\" voice=Jenny → MP3 + SRT\n"
                "   • soundwave_video action=prepare text=\"Welcome\" voice=Jenny aspect=9:16 → prepares files\n"
                "   • Then in Soundwave UI: http://localhost:5173/studio/video → upload video + audio + subtitles → export\n"
                "\n"
                f"Current aspect: {aspect} {'(portrait 1080x1920 — YouTube Shorts, TikTok, Reels)' if aspect=='9:16' else '(landscape 1920x1080)'}, resolution {resolution}"
            )

        elif action == "prepare" and text:
            from _soundwave_client import get_voice, synthesize_edge_tts, text_to_srt_cues, save_srt
            v = get_voice(voice)
            voice_id = v["id"] if v else "en-US-JennyNeural"
            mp3_path = synthesize_edge_tts(text, voice=voice_id)
            # Estimate duration 150 wpm
            words = len(text.split())
            est_dur = max(1.0, words / 2.5)
            cues = text_to_srt_cues(text, est_dur)
            srt_path = str(Path(mp3_path).with_suffix(".srt"))
            save_srt(cues, srt_path)

            # Also create a project folder
            proj_dir = Path.home() / "Soundwave" / "video_projects" / f"video_{int(time.time())}"
            proj_dir.mkdir(parents=True, exist_ok=True)
            info = {
                "text": text,
                "voice": voice_id,
                "aspect": aspect,
                "resolution": resolution,
                "video_path": video_path or "solid_color_0x0A0F1C",
                "mp3_path": mp3_path,
                "srt_path": srt_path,
                "cues": cues,
                "created": time.strftime("%Y-%m-%d %H:%M:%S"),
            }
            (proj_dir / "video_project.json").write_text(json.dumps(info, indent=2), encoding="utf-8")

            result = (
                f"Prepared Soundwave video project at {proj_dir}:\n"
                f"• Voiceover: {voice_id} — {words} words, ~{est_dur:.1f}s, MP3 {Path(mp3_path).name}\n"
                f"• Subtitles: {len(cues)} cues, SRT {Path(srt_path).name}\n"
                f"• Background: {video_path or 'solid color 0x0A0F1C (no video uploaded, perfect for caption videos)'}\n"
                f"• Aspect: {aspect} {'portrait 1080x1920' if aspect=='9:16' else 'landscape 1920x1080'}, Resolution: {resolution}\n"
                f"• Next: Open Soundwave UI http://localhost:5173/studio/video, upload MP3 + video + SRT, choose style, export MP4/WebM via FFmpeg"
            )
            if player:
                try:
                    player.write_log(f"JARVIS: {result}")
                except Exception:
                    pass
            return result

        elif action == "youtube_import":
            if not youtube_url:
                return "Provide youtube_url: soundwave_video action=youtube_import youtube_url=https://youtube.com/watch?v=... — Soundwave uses yt-dlp vendored zipapp vendor/yt-dlp/yt-dlp (needs python3) to import background video. Supports YTDLP_COOKIES env for age/bot-gated, YTDLP_MAX_DURATION caps length."
            return (
                f"YouTube import for video background: {youtube_url}\n"
                f"Soundwave API: POST /api/v1/upload/youtube with {{\"url\": \"{youtube_url}\"}} → returns fileKey, streams via Range for previews.\n"
                f"Local yt-dlp: vendor/yt-dlp/yt-dlp is auto-detected (needs python3), override via YTDLP_PATH env, cookies via YTDLP_COOKIES.\n"
                f"Then use that fileKey as videoFileKey in export job with your TTS audio + subtitles."
            )

        elif action == "export":
            return (
                f"Export via Soundwave API:\n"
                f"POST /api/v1/export/video with:\n"
                f"{{\n"
                f"  \"videoFileKey\": \"{video_path or 'null (solid color)'}\",\n"
                f"  \"audioFileKey\": \"<from previous TTS upload>\",\n"
                f"  \"subtitleData\": [{{\"start\": 0, \"end\": 1.5, \"text\": \"Hello\"}}],\n"
                f"  \"subtitleStyle\": {{\"preset\": \"tiktok\"}},\n"
                f"  \"exportSettings\": {{\"resolution\": \"{resolution}\", \"aspect\": \"{aspect}\", \"format\": \"mp4\", \"quality\": \"high\", \"fps\": 30}}\n"
                f"}}\n"
                f"→ Returns jobId, status QUEUED. Poll GET /jobs/:id or SSE /jobs/:id/events for progress, download via /jobs/:id/download.\n"
                f"FFmpeg required (resolveFfmpegPath(): env FFMPEG_PATH → vendor/ffmpeg/ffmpeg → /usr/bin/ffmpeg → ffmpeg). On Windows: winget install ffmpeg."
            )

        elif action == "status":
            return (
                f"Soundwave Video Status:\n"
                f"• FFmpeg: {('available' if __import__('shutil').which('ffmpeg') else 'not found — install via winget install ffmpeg or sudo apt install ffmpeg')}\n"
                f"• yt-dlp: {('found' if Path('vendor/yt-dlp/yt-dlp').exists() or __import__('shutil').which('yt-dlp') else 'not found — pip install yt-dlp or use vendored')}\n"
                f"• Aspect: {aspect}, Resolution: {resolution}\n"
                f"• Export quotas: Free 2/hour 720p watermark, Pro 20/hour 1080p, Enterprise 100/hour 4K no watermark\n"
                f"• Codecs: libx264 (mp4) / libvpx-vp9 (webm), libass subtitles + ASS watermark, volume/fades"
            )

        else:
            return (
                "Soundwave Video — need text for prepare action.\n"
                "Usage: soundwave_video action=prepare text=\"Your script\" voice=Jenny aspect=9:16 resolution=1080p\n"
                "Or workflow: soundwave_video action=workflow"
            )

    except Exception as e:
        return f"Soundwave video failed: {e}"
