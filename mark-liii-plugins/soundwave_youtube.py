"""
Soundwave AI YouTube Import + Paste into Video Editor — Mark LIII Plugin

Teaches JARVIS to use Soundwave AI's YouTube import for video backgrounds.

Soundwave YouTube import (server/src/lib/ytdlp.ts + routes/upload.ts):
- Vendored yt-dlp zipapp in vendor/yt-dlp/yt-dlp (needs python3), auto-detected, override via YTDLP_PATH env
- YTDLP_COOKIES optional cookies.txt for bot/age-gated videos, YTDLP_MAX_DURATION caps length (default 1200s), YTDLP_TIMEOUT_MS 240s
- Endpoint: POST /api/v1/upload/youtube with {url} → uses yt-dlp to download, returns fileKey, streams via GET /file/:key Range supported for previews

PASTE WORKFLOW (NEW — exact UI flow in VideoCompositor.tsx /studio/video):
- Page: /studio/video — VideoCompositor, left column Video Background section (rounded-card border border-gray-800 bg-panel p-5)
- Title: "Video Background" + Badge YouTube violet (if from YouTube) or Uploaded green
- If NO video:
  - Drag & drop zone: "Drag & drop a video, or click to browse" + hidden file input
  - **Import from YouTube card**: mt-4 rounded-card border border-gray-800 bg-gray-900/50 p-4
    - Title: <Youtube icon h-4 w-4 text-red-400> Import from YouTube
    - Form: flex flex-col gap-2 sm:flex-row, onSubmit importYouTube()
      - Input: value ytUrl, onChange setYtUrl, placeholder "Paste a link — youtube.com/watch?v=…, youtu.be/…, /shorts/…", aria-label "YouTube video URL", class h-10 w-full rounded-input border-gray-700 bg-gray-900
      - Button: Import with Youtube icon h-10 size sm type submit loading ytImporting
    - When importing: ProgressBar indeterminate + "Downloading from YouTube — long videos can take a minute."
    - Note: "The video is downloaded straight to your project. Only import content you own or have permission to use."
- If video exists: videoName truncate + Badge + Remove button (Trash2)
- importYouTube() function:
  const res = await http.post<{ fileKey, name, size }>("/upload/youtube", { url }, { timeout: 300_000 })
  const streamUrl = `/api/v1/upload/file/${res.fileKey}`
  setVideoFileKey(res.fileKey); setVideoUrl(streamUrl); setVideoName(res.name)
  studio.setVideo({ blob: null, url: streamUrl, name: res.name, fileKey: res.fileKey })
- After: Badge violet YouTube, video element src=streamUrl Range, videoFromYouTube = videoUrl.startsWith("/api/v1/upload/file/")

JARVIS 3 METHODS FOR PASTING:
A) API Direct (fastest, recommended, no UI):
  from _soundwave_client import api_request
  res = api_request("POST", "/api/v1/upload/youtube", json_data={"url": "https://youtube.com/watch?v=..."}, timeout=300)
  fileKey = res["fileKey"]
B) Browser Automation (opens UI and pastes):
  browser_control action=open url=http://localhost:5173/studio/video, wait 3-4s React load
  Focus input [aria-label="YouTube video URL"] via playwright or computer_control
  Playwright: await page.goto("http://localhost:5173/studio/video"); await page.wait_for_selector('[aria-label="YouTube video URL"]'); await page.fill(..., url); await page.click('button:has-text("Import")'); await page.wait_for_selector('text=YouTube', timeout=120000)
  computer_control: type_text text=url or hotkey ctrl+v + press enter
C) Clipboard:
  pyperclip.copy(url) + pyautogui.hotkey('ctrl','v') + press enter, input aria-label="YouTube video URL"

This plugin lets JARVIS:
- Explain YouTube import workflow + exact paste UI flow
- Download YouTube video via yt-dlp directly (no Soundwave server)
- Import via Soundwave API (fastest)
- Guide user to paste link in Video Editor

Install: pip install yt-dlp requests pyperclip pyautogui (yt-dlp already vendored in Soundwave)
See also: soundwave_youtube_paste.py for dedicated paste plugin with 3 methods auto fallback
"""

PLUGIN = {
    "name": "soundwave_youtube",
    "description": (
        "Imports YouTube videos as background for Soundwave AI video compositing via yt-dlp + paste into video editor. "
        "Use when user asks to import YouTube video, download YouTube, use YouTube as background, YouTube to video, import from YouTube, "
        "paste YouTube link into video editor, add YouTube background. "
        "Soundwave uses vendored yt-dlp zipapp (needs python3) with cookies support for age/bot-gated, max duration cap. "
        "Paste workflow: /studio/video → Video Background section → Import from YouTube card → input aria-label=\"YouTube video URL\" placeholder "
        "\"Paste a link — youtube.com/watch?v=…, youtu.be/…, /shorts/…\" + Import button → POST /upload/youtube timeout 300s → fileKey → streamUrl /api/v1/upload/file/:key → Badge violet YouTube. "
        "3 methods: API direct (fastest), browser automation (open UI + paste), clipboard (copy + focus). "
        "Trigger phrases: import YouTube, download YouTube video, YouTube background, YouTube to Soundwave, import from YouTube, paste YouTube link, YouTube into video editor, add YouTube to editor."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "url": {"type": "STRING", "description": "YouTube URL to import (e.g. https://youtube.com/watch?v=... youtube.com, youtu.be, /shorts/)"},
            "action": {"type": "STRING", "description": "Action: info, download, soundwave_import, paste_guide. Default info. paste_guide explains exact UI paste flow."},
            "output_path": {"type": "STRING", "description": "Output path for download action (optional)"},
        },
        "required": ["url"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "soundwave",
    "title": "Soundwave YouTube Import + Paste",
    "description": "Import YouTube as video background + teach JARVIS exact paste flow into Video Editor",
    "icon": "🎬",
    "color": "#EF4444",
    "order": 48,
    "default_enabled": True,
}

def run(parameters: dict, player=None, session_memory=None) -> str:
    url = parameters.get("url", "").strip()
    action = (parameters.get("action", "info") or "info").lower()
    output_path = parameters.get("output_path", "") or ""

    if not url:
        return "Need YouTube URL: soundwave_youtube url=https://youtube.com/watch?v=... Try also paste_guide action for exact UI flow."

    # Basic validation
    url_l = url.lower()
    if not any(x in url_l for x in ["youtube.com", "youtu.be"]):
        return f"Invalid YouTube URL '{url}': must contain youtube.com or youtu.be (supports youtube.com/watch?v=…, youtu.be/…, /shorts/…)."

    try:
        from pathlib import Path
        import shutil
        import subprocess

        if action in ("info", "paste_guide"):
            base = (
                f"YouTube Import for Soundwave Video Background — URL: {url}\n"
                "\n"
                "=== EXACT PASTE WORKFLOW INTO VIDEO EDITOR (NEW) ===\n"
                "Page: /studio/video — VideoCompositor.tsx, left column Video Background section\n"
                "UI:\n"
                "- If NO video: drag & drop zone + Import from YouTube card (Youtube icon red)\n"
                "  - Card: mt-4 rounded-card border border-gray-800 bg-gray-900/50 p-4\n"
                "  - Title: <Youtube icon h-4 w-4 text-red-400> Import from YouTube text-sm font-medium\n"
                "  - Form: mt-2.5 flex flex-col gap-2 sm:flex-row onSubmit importYouTube()\n"
                "    - Input: value ytUrl, placeholder \"Paste a link — youtube.com/watch?v=…, youtu.be/…, /shorts/…\" aria-label \"YouTube video URL\" class h-10 w-full rounded-input border-gray-700 bg-gray-900\n"
                "    - Button: Import with Youtube icon h-10 size sm type submit loading ytImporting\n"
                "  - Importing: ProgressBar indeterminate + \"Downloading from YouTube — long videos can take a minute.\"\n"
                "  - Note: \"The video is downloaded straight to your project. Only import content you own or have permission to use.\"\n"
                "- If video exists: videoName truncate + Badge YouTube violet / Uploaded green + Remove button Trash2\n"
                "\n"
                "importYouTube() function:\n"
                "  const res = await http.post<{ fileKey, name, size }>(\"/upload/youtube\", { url }, { timeout: 300_000 })\n"
                "  const streamUrl = `/api/v1/upload/file/${res.fileKey}`\n"
                "  setVideoFileKey(res.fileKey); setVideoUrl(streamUrl); setVideoName(res.name)\n"
                "  studio.setVideo({ blob: null, url: streamUrl, name: res.name, fileKey: res.fileKey })\n"
                "\n"
                "=== 3 METHODS FOR JARVIS ===\n"
                "A) API Direct (fastest, recommended, no UI):\n"
                "  from _soundwave_client import api_request, resolve_api_url\n"
                f"  res = api_request(\"POST\", \"/api/v1/upload/youtube\", json_data={{\"url\": \"{url}\"}}, timeout=300)\n"
                "  fileKey = res[\"fileKey\"]; name = res[\"name\"]; streamUrl = f\"/api/v1/upload/file/{fileKey}\"\n"
                "\n"
                "B) Browser Automation (opens UI and pastes):\n"
                "  - browser_control action=open url=http://localhost:5173/studio/video (or http://localhost:4000 for prod)\n"
                "  - Wait 3-4s React SPA load\n"
                "  - Focus input [aria-label=\"YouTube video URL\"] via playwright or computer_control\n"
                "  - Playwright exact:\n"
                "    await page.goto(\"http://localhost:5173/studio/video\")\n"
                "    await page.wait_for_selector('[aria-label=\"YouTube video URL\"]', timeout=10000)\n"
                f"    await page.fill('[aria-label=\"YouTube video URL\"]', '{url}')\n"
                "    await page.click('button:has-text(\"Import\")')\n"
                "    await page.wait_for_selector('text=YouTube', timeout=120000)  # Badge violet appears\n"
                "  - computer_control:\n"
                "    action=type_text text=https://... OR hotkey ctrl+v (if copied) + press_key enter\n"
                "\n"
                "C) Clipboard:\n"
                "  import pyperclip\n"
                f"  pyperclip.copy(\"{url}\")\n"
                "  # Then computer_control action=hotkey key=ctrl+v + press_key enter\n"
                "  # Input has aria-label=\"YouTube video URL\"\n"
                "\n"
                "=== BACKEND ===\n"
                "POST /api/v1/upload/youtube {url} → {fileKey UUIDv7, name, size}\n"
                "Server runs yt-dlp vendored zipapp vendor/yt-dlp/yt-dlp needs python3, auto-detected, override via YTDLP_PATH, YTDLP_COOKIES cookies.txt for bot/age-gated, YTDLP_MAX_DURATION 1200s cap, YTDLP_TIMEOUT_MS 240s\n"
                "Stream via GET /api/v1/upload/file/:key Range supported, videoFromYouTube = videoUrl.startsWith(\"/api/v1/upload/file/\") → Badge violet YouTube\n"
                "\n"
                "=== SUPPORTED URLs ===\n"
                "youtube.com/watch?v=..., youtu.be/..., /shorts/..., m.youtube.com/watch?v=... with &t=30s &list=...\n"
                "\n"
                "=== PLUGINS ===\n"
                "• soundwave_youtube_paste.py — dedicated paste plugin with 3 methods auto fallback (api/browser/clipboard), params url + method + auto_play, recommended for paste tasks\n"
                "• soundwave_youtube.py (this) — info/download/soundwave_import/paste_guide\n"
                "\n"
                "=== ACTIONS ===\n"
                f"• soundwave_youtube url={url} action=soundwave_import → calls API POST /api/v1/upload/youtube (fastest)\n"
                f"• soundwave_youtube url={url} action=download → direct yt-dlp to ~/Soundwave/youtube/ or output_path, then use as background\n"
                f"• soundwave_youtube url={url} action=paste_guide → this exact guide\n"
                "• For auto paste with UI: use soundwave_youtube_paste url=... method=auto\n"
            )
            if action == "paste_guide":
                return base
            # info also includes classic workflow
            classic = (
                "\n"
                "=== CLASSIC WORKFLOW ===\n"
                "1. API: POST /api/v1/upload/youtube with {url} → server runs yt-dlp (vendored)\n"
                "   • YTDLP_COOKIES env for bot/age-gated, YTDLP_MAX_DURATION 1200s, YTDLP_TIMEOUT_MS 240000\n"
                "   • Returns fileKey UUIDv7, stored uploads, served via GET /api/v1/upload/file/:key Range\n"
                "2. Frontend: Video Compositor → 'Import from YouTube' card → paste URL → previews via file stream\n"
                "3. Export: fileKey as videoFileKey in POST /api/v1/export/video with audioFileKey + subtitleData + exportSettings\n"
                "   • Video shorter than voice? Loops auto, or cut via videoEnd param, FFmpeg libx264/libvpx-vp9 + libass\n"
            )
            return base + classic

        elif action == "download":
            out_dir = Path(output_path).parent if output_path and Path(output_path).suffix else (Path(output_path) if output_path else Path.home() / "Soundwave" / "youtube")
            out_dir.mkdir(parents=True, exist_ok=True)

            yt_dlp_bin = None
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

            if output_path and Path(output_path).suffix:
                out_template = output_path
            else:
                out_template = str(out_dir / "%(title)s [%(id)s].%(ext)s")

            cmd = [yt_dlp_bin, "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best", "-o", out_template, url]
            if yt_dlp_bin.endswith("yt-dlp") and Path(yt_dlp_bin).exists():
                try:
                    cmd = ["python3", yt_dlp_bin, "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best", "-o", out_template, url]
                    subprocess.run(cmd, check=True, timeout=180, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                except Exception:
                    cmd = [yt_dlp_bin, "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best", "-o", out_template, url]
                    subprocess.run(cmd, check=True, timeout=180)
            else:
                subprocess.run(cmd, check=True, timeout=180)

            downloaded = None
            if output_path and Path(output_path).exists():
                downloaded = output_path
            else:
                files = sorted(out_dir.glob("*"), key=lambda p: p.stat().st_mtime, reverse=True)
                if files:
                    downloaded = str(files[0])

            result = f"Downloaded YouTube {url} → {downloaded or out_dir} via yt-dlp ({yt_dlp_bin}). Use as background in Soundwave: soundwave_video action=prepare video_path={downloaded or ''} OR paste into editor at /studio/video → Video Background → Import from YouTube card → input [aria-label=\"YouTube video URL\"]"
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
                res = api_request("POST", "/api/v1/upload/youtube", json_data={"url": url}, timeout=300)
                file_key = res.get("fileKey") or res.get("key") or str(res)
                name = res.get("name", "")
                result = (
                    f"✅ Imported YouTube via Soundwave API {api_url}/api/v1/upload/youtube: {url} → fileKey {file_key} name {name}\n"
                    f"Stream: /api/v1/upload/file/{file_key} Range supported\n"
                    "Next: In Soundwave UI /studio/video, video appears in Video Background section with YouTube badge violet, videoName, Remove button, preview via video element src=streamUrl.\n"
                    "Or use as videoFileKey in export: POST /api/v1/export/video with videoFileKey + audioFileKey + subtitleData\n"
                    "Paste UI: Video Background → Import from YouTube card → input aria-label=\"YouTube video URL\" placeholder \"Paste a link — youtube.com/watch?v=…, youtu.be/…, /shorts/…\" + Import button → this API call with timeout 300s"
                )
                if player:
                    try:
                        player.write_log(f"JARVIS: {result}")
                    except Exception:
                        pass
                return result
            except Exception as e:
                return (
                    f"Soundwave YouTube import via API failed: {e}. "
                    "Try action=download for direct yt-dlp download (no server needed). "
                    "Ensure Soundwave server running at http://localhost:4000 and YTDLP configured. "
                    "For exact paste UI flow, use action=paste_guide or plugin soundwave_youtube_paste."
                )

        else:
            return f"Unknown action {action}. Use info, paste_guide, download, or soundwave_import. For paste into editor specifically, use paste_guide or soundwave_youtube_paste plugin."

    except Exception as e:
        return f"YouTube import failed: {e}. Install yt-dlp: pip install yt-dlp. For paste guide, try action=paste_guide."
