"""
Soundwave AI Studio — Mark LIII Master Plugin

Teaches JARVIS to use Soundwave AI as a full production studio:
- TTS generation (6 Neural voices + cloned voices)
- Subtitle creation and styling
- Video compositing (burn subtitles into video, 16:9 and 9:16 portrait)
- YouTube import
- Project management
- Export via FFmpeg

This is the master plugin — like computer_settings which handles 56 OS actions,
this handles multiple Soundwave actions via sub-commands.

Soundwave architecture (from README):
- Frontend: React 18, Vite, Tailwind, Zustand, Edge TTS API call + offline fallback
- Backend: Express 5 + TS, Prisma/Postgres or JSON-file fallback, JWT sessions, Stripe stubs, SSE export jobs
- Media: FFmpeg libx264/libvpx-vp9, libass subtitles, volume/fades, media probing
- TTS: server-side Microsoft Neural via node-edge-tts 24kHz mono MP3 + word timings
- Quotas: Free 10k chars, Pro 200k, Enterprise 2M; exports/hour 2/20/100

Install: pip install edge-tts requests
"""

PLUGIN = {
    "name": "soundwave_studio",
    "description": (
        "Master control for Soundwave AI studio — production-grade TTS and video compositing. "
        "Use when user wants to use Soundwave: create voiceover, generate TTS, make video with subtitles, burn subtitles, export video, create project, YouTube import, subtitle styling, video compositing. "
        "This is the main Soundwave integration — handles TTS, subtitles, video export, projects. "
        "Trigger phrases: soundwave studio, create voiceover, make video with subtitles, burn subtitles, export video, soundwave project, use soundwave, generate with soundwave."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {"type": "STRING", "description": "Action: tts, list_voices, create_project, subtitles, video_export, youtube_import, status, help. Default tts."},
            "text": {"type": "STRING", "description": "Text for TTS (for tts action)"},
            "voice": {"type": "STRING", "description": "Voice: Jenny, Ana, Sonia, Christopher, Guy, Ryan or full id"},
            "speed": {"type": "NUMBER", "description": "Speed 0.5-2.0"},
            "project_title": {"type": "STRING", "description": "Project title for create_project"},
            "video_path": {"type": "STRING", "description": "Path to background video for video_export"},
            "youtube_url": {"type": "STRING", "description": "YouTube URL for youtube_import"},
            "aspect": {"type": "STRING", "description": "Aspect: 16:9 or 9:16 (portrait for Shorts/TikTok)"},
        },
        "required": [],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "soundwave",
    "title": "Soundwave Studio",
    "fields": [
        {"key": "api_url", "label": "Soundwave API URL", "type": "text", "default": "http://localhost:4000"},
        {"key": "default_voice", "label": "Default Voice", "type": "text", "default": "en-US-JennyNeural"},
        {"key": "auto_export", "label": "Auto-export video after TTS", "type": "checkbox", "default": False},
    ],
}

def run(parameters: dict, player=None, session_memory=None) -> str:
    action = (parameters.get("action", "help") or "help").lower().strip()
    text = parameters.get("text", "") or ""
    voice = parameters.get("voice", "Jenny") or "Jenny"
    speed = float(parameters.get("speed", 1.0) or 1.0)
    project_title = parameters.get("project_title", "") or "JARVIS Project"
    video_path = parameters.get("video_path", "") or ""
    youtube_url = parameters.get("youtube_url", "") or ""
    aspect = parameters.get("aspect", "16:9") or "16:9"

    try:
        from _soundwave_client import (
            SOUNDWAVE_VOICES, get_voice, synthesize_edge_tts, play_audio,
            resolve_api_url, text_to_srt_cues, save_srt
        )
        from pathlib import Path
        import time

        api_url = resolve_api_url()

        if action == "tts" and text:
            v = get_voice(voice)
            voice_id = v["id"] if v else "en-US-JennyNeural"
            display = v["displayName"] if v else voice_id
            mp3_path = synthesize_edge_tts(text, voice=voice_id, speed=speed)
            play_audio(mp3_path)

            # Also create SRT cues for subtitle workflow
            # Estimate duration from file size (96kbps) or use 150 wpm
            words = len(text.split())
            est_duration = max(1.0, words / 2.5)  # ~150 wpm = 2.5 wps
            cues = text_to_srt_cues(text, est_duration)
            srt_path = str(Path(mp3_path).with_suffix(".srt"))
            save_srt(cues, srt_path)

            result = f"Soundwave TTS: Generated {words} words / {len(text)} chars with {display} ({voice_id}) at {speed}x. MP3: {mp3_path}, SRT: {srt_path} with {len(cues)} cues. API: {api_url}"

            if player:
                try:
                    player.write_log(f"JARVIS: {result}")
                    player.write_log(f"📤 soundwave_studio → TTS {display} → {Path(mp3_path).name} + {len(cues)} subtitles")
                except Exception:
                    pass
            return result

        elif action == "list_voices":
            lines = [f"Soundwave Studio — {len(SOUNDWAVE_VOICES)} voices, API {api_url}:"]
            for v in SOUNDWAVE_VOICES:
                lines.append(f"• {v['displayName']} ({v['id']}): {v['style']}")
            return "\n".join(lines)

        elif action == "create_project":
            # Create local project structure mimicking Soundwave's project
            proj_dir = Path.home() / "Soundwave" / "projects" / f"{project_title.replace(' ', '_')}_{int(time.time())}"
            proj_dir.mkdir(parents=True, exist_ok=True)
            info = {
                "title": project_title,
                "type": "TTS",
                "voice": voice,
                "aspect": aspect,
                "created": time.strftime("%Y-%m-%d %H:%M:%S"),
                "api_url": api_url,
                "text": text[:500] if text else "",
            }
            import json
            (proj_dir / "project.json").write_text(json.dumps(info, indent=2), encoding="utf-8")
            result = f"Created Soundwave project '{project_title}' at {proj_dir}. Aspect {aspect}, voice {voice}. Add text via tts action, then video_export."
            if player:
                try:
                    player.write_log(f"JARVIS: {result}")
                except Exception:
                    pass
            return result

        elif action == "video_export":
            # Explain video export workflow, and if video_path exists, prepare FFmpeg command
            if not video_path:
                return (
                    f"Soundwave Video Export — burns subtitles into video with FFmpeg (libx264/libvpx-vp9, libass, 16:9 or 9:16 portrait).\n"
                    f"Workflow:\n"
                    f"1. Generate TTS via 'soundwave_studio action=tts text=\"...\"' — creates MP3 + SRT\n"
                    f"2. Provide background video path or leave empty for solid color (0x0A0F1C)\n"
                    f"3. Call video_export with video_path and aspect (16:9 or 9:16 for Shorts/TikTok)\n"
                    f"4. In Soundwave app: Studio → Subtitles → style, then Video → Export (1080p, MP4/WebM)\n"
                    f"API: POST /api/v1/export/video with videoFileKey, audioFileKey, subtitleData, exportSettings (resolution, aspect, format, quality, fps)\n"
                    f"Current API: {api_url} — open {api_url.replace(':4000', ':5173')} for UI"
                )
            else:
                vp = Path(video_path)
                if not vp.exists():
                    return f"Video not found: {video_path}. Provide absolute path to background video."
                result = (
                    f"Video export ready: background {vp.name}, aspect {aspect}. "
                    f"In Soundwave UI: upload video via /api/v1/upload/video, upload audio from previous TTS, "
                    f"add subtitles from SRT, choose {aspect} {'portrait (1080x1920 for Shorts/TikTok/Reels)' if aspect=='9:16' else 'landscape (1920x1080)'} and export. "
                    f"FFmpeg will handle libass burn-in, volume/fades, looping if video shorter than voice."
                )
                if player:
                    try:
                        player.write_log(f"JARVIS: {result}")
                    except Exception:
                        pass
                return result

        elif action == "youtube_import":
            if not youtube_url:
                return "Provide youtube_url: soundwave_studio action=youtube_import youtube_url=https://youtube.com/watch?v=... — Soundwave uses yt-dlp vendored zipapp (needs python3) to import background video straight from YouTube URL."
            return (
                f"YouTube import: {youtube_url}\n"
                f"Soundwave flow: POST /api/v1/upload/youtube with {{url}} → streams via yt-dlp, Range supported for previews. "
                f"YTDLP_COOKIES optional for age/bot-gated, YTDLP_MAX_DURATION caps length. "
                f"In UI: Video Compositor → Import from YouTube. Then export with subtitles."
            )

        elif action == "status":
            return (
                f"Soundwave AI Studio Status:\n"
                f"• API URL: {api_url}\n"
                f"• Voices: {len(SOUNDWAVE_VOICES)} Microsoft Neural (Edge TTS, free, 24kHz mono MP3)\n"
                f"• TTS: Direct Edge TTS (no server) + optional API /api/v1/tts/synthesize (auth, quota)\n"
                f"• Projects: Local ~/Soundwave/projects/ + cloud /api/v1/projects (Pro+ for save)\n"
                f"• Video: FFmpeg libx264/libvpx-vp9, libass subtitles, 16:9 + 9:16 portrait, 720p-4K\n"
                f"• Uploads: magic-byte validated, UUIDv7 keys, YouTube via yt-dlp\n"
                f"• Quotas: Free 10k chars/mo, Pro 200k, Enterprise 2M; exports/hour 2/20/100\n"
                f"• Frontend: React 18 Vite Tailwind Zustand, Backend: Express 5 Prisma/JSON fallback, JWT httpOnly + CSRF\n"
                f"Open UI at {api_url.replace(':4000', ':5173')} or {api_url}/api/health"
            )

        else:  # help
            return (
                "Soundwave AI Studio — Production-grade client-side TTS + video compositing.\n"
                "\n"
                "Actions:\n"
                "• tts: text + voice (Jenny/Ana/Sonia/Christopher/Guy/Ryan) + speed → MP3 + SRT, auto-play\n"
                "  Example: soundwave_studio action=tts text=\"Hello world\" voice=Jenny speed=1.0\n"
                "• list_voices: show 6 Neural voices with styles\n"
                "• create_project: project_title + aspect (16:9 or 9:16) → local ~/Soundwave/projects/\n"
                "• video_export: video_path (optional) + aspect → explains FFmpeg export workflow\n"
                "• youtube_import: youtube_url → explains yt-dlp import flow\n"
                "• status: API URL, voices, quotas, architecture\n"
                "• help: this help\n"
                "\n"
                "Voice mapping:\n"
                "  Jenny warm friendly (YouTube), Ana young energetic (TikTok), Sonia British elegant (corporate),\n"
                "  Christopher deep authoritative (trailer), Guy casual (vlog), Ryan British clear (news)\n"
                "\n"
                "Full API: /api/v1/voices (no auth), /api/v1/tts/synthesize (auth, MP3 base64 + wordTimings), "
                "/api/v1/projects (Pro+), /api/v1/upload/video|audio|youtube, /api/v1/export/video (FFmpeg job, SSE progress)\n"
                f"\nCurrent API URL: {api_url} — set SOUNDWAVE_API_URL env to override."
            )

    except Exception as e:
        return f"Soundwave Studio failed: {e}. Install deps: pip install edge-tts requests"
