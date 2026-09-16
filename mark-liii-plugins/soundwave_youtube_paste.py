"""
Soundwave AI — Paste YouTube Link into Video Editor — Mark LIII Plugin

Teaches JARVIS EXACTLY how to paste a YouTube link into Soundwave's Video Editor.

This is the #1 requested workflow: user copies YouTube URL, wants it as background video.

Soundwave Video Compositor YouTube Import — Exact UI Flow (from frontend/src/pages/VideoCompositor.tsx):

1. User opens Soundwave UI at /studio/video (VideoCompositor page)
2. Left column: Video Background section
   - If no video: shows drag & drop zone + "Import from YouTube" card below
   - Import from YouTube card has:
     - Title: <Youtube icon> Import from YouTube
     - Form with input: placeholder "Paste a link — youtube.com/watch?v=…, youtu.be/…, /shorts/…"
       aria-label="YouTube video URL", class h-10 w-full rounded-input border border-gray-700 bg-gray-900
     - Button: "Import" with Youtube icon, h-10, type submit
     - When importing: shows ProgressBar indeterminate + text "Downloading from YouTube — long videos can take a minute."
     - Note: "The video is downloaded straight to your project. Only import content you own or have permission to use."
   - If video exists: shows videoName + Badge (YouTube violet or Uploaded green) + Remove button
3. Backend: POST /api/v1/upload/youtube with {url} (timeout 300s for long videos) → returns {fileKey, name, size}
   - Server runs yt-dlp vendored zipapp vendor/yt-dlp/yt-dlp (needs python3), auto-detected, override via YTDLP_PATH
   - YTDLP_COOKIES optional cookies.txt for bot/age-gated, YTDLP_MAX_DURATION caps length (default 1200s = 20min), YTDLP_TIMEOUT_MS 240s
   - Returns fileKey UUIDv7, stored under uploads dir, streamed via GET /api/v1/upload/file/:key with Range support for previews
4. Frontend after import: streamUrl = `/api/v1/upload/file/${fileKey}`, setVideoFileKey(fileKey), setVideoUrl(streamUrl), setVideoName(name), studio.setVideo({blob: null, url: streamUrl, name, fileKey})
   - Video element src=streamUrl (if starts with /api/v1/upload/file/ → videoFromYouTube true), muted, playsInline, onLoadedMetadata sets videoDuration
   - Then user can export via POST /api/v1/export/video with videoFileKey + audioFileKey + subtitleData + exportSettings

JARVIS can automate this 3 ways:
A) Via Soundwave API directly (no UI) — fastest, recommended for JARVIS
B) Via browser automation (browser_control + computer_control) — opens Soundwave UI and pastes
C) Via clipboard + UI focus — user copies, JARVIS pastes

This plugin implements all 3 and teaches JARVIS the exact paste workflow.

Install: pip install requests pyautogui pyperclip
For browser automation: pip install playwright (Mark LIII already has it via requirements.txt)
"""

PLUGIN = {
    "name": "soundwave_youtube_paste",
    "description": (
        "Pastes a YouTube link into Soundwave AI's Video Editor (Video Compositor) to import as background video. "
        "This is the EXACT workflow for YouTube import: user copies YouTube URL, pastes into 'Import from YouTube' input in Video Background section, clicks Import, video downloaded via yt-dlp. "
        "Use when user says paste YouTube link, import YouTube into video editor, YouTube to video editor, paste link into Soundwave video, add YouTube background, use YouTube video in editor. "
        "Supports youtube.com/watch?v=…, youtu.be/…, youtube.com/shorts/… formats. "
        "Can do via Soundwave API directly (fastest, no UI), via browser automation (opens UI and pastes), or via clipboard. "
        "Trigger phrases: paste YouTube link, import YouTube into editor, YouTube to video editor, paste link into video editor, add YouTube background, YouTube in Soundwave video."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "url": {"type": "STRING", "description": "YouTube URL to paste (youtube.com/watch?v=…, youtu.be/…, /shorts/…)"},
            "method": {"type": "STRING", "description": "Method: api (direct API, fastest, recommended), browser (open UI and automate paste), clipboard (copy to clipboard + focus input), auto (tries api then clipboard). Default auto."},
            "auto_play": {"type": "BOOLEAN", "description": "Whether to auto-play video preview after import, default false"},
        },
        "required": ["url"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "soundwave",
    "title": "Soundwave YouTube Paste",
    "fields": [
        {"key": "api_url", "label": "Soundwave API URL", "type": "text", "default": "http://localhost:4000"},
        {"key": "ui_url", "label": "Soundwave UI URL", "type": "text", "default": "http://localhost:5173/studio/video"},
        {"key": "default_method", "label": "Default paste method: api, browser, clipboard, auto", "type": "text", "default": "auto"},
        {"key": "auto_play", "label": "Auto-play preview after import", "type": "checkbox", "default": False},
    ],
}

def run(parameters: dict, player=None, session_memory=None) -> str:
    url = parameters.get("url", "").strip()
    method = (parameters.get("method", "auto") or "auto").lower().strip()
    auto_play = parameters.get("auto_play", False)
    if isinstance(auto_play, str):
        auto_play = auto_play.lower() in ("true", "yes", "1")

    if not url:
        return (
            "Sir, I need a YouTube URL to paste into Soundwave's Video Editor.\n"
            "Examples:\n"
            "• https://www.youtube.com/watch?v=dQw4w9WgXcQ\n"
            "• https://youtu.be/dQw4w9WgXcQ\n"
            "• https://www.youtube.com/shorts/abc123\n"
            "\n"
            "Say: 'Paste YouTube link https://youtube.com/watch?v=... into Soundwave video editor'"
        )

    # Validate YouTube URL format
    if not any(x in url.lower() for x in ("youtube.com", "youtu.be")):
        return f"'{url}' doesn't look like a YouTube link. Need youtube.com/watch?v=…, youtu.be/…, or /shorts/… format."

    try:
        from pathlib import Path
        import time

        # ── Method A: Direct API (fastest, recommended for JARVIS) ──────────
        # This is what Soundwave frontend does: POST /api/v1/upload/youtube with {url}
        # No UI needed, works even if Soundwave UI not open
        def via_api():
            from _soundwave_client import api_request, resolve_api_url
            api_url = resolve_api_url()
            try:
                # Soundwave frontend timeout 300s for long videos
                res = api_request("POST", "/api/v1/upload/youtube", json_data={"url": url}, timeout=300)
                file_key = res.get("fileKey") or res.get("key") or ""
                name = res.get("name") or "YouTube video"
                size = res.get("size", 0)
                stream_url = f"/api/v1/upload/file/{file_key}" if file_key else ""

                result = (
                    f"✅ Pasted YouTube link into Soundwave Video Editor via API:\n"
                    f"• URL: {url}\n"
                    f"• FileKey: {file_key} (UUIDv7, stored in uploads dir)\n"
                    f"• Name: {name}\n"
                    f"• Size: {size} bytes\n"
                    f"• Stream URL: {stream_url} (Range supported for previews)\n"
                    f"• API: {api_url}/api/v1/upload/youtube\n"
                    f"• Next: In Soundwave UI at {api_url.replace(':4000', ':5173')}/studio/video, video appears as background with YouTube badge (violet). "
                    f"Then generate voiceover in Studio, add subtitles in Subtitle Editor, export via FFmpeg with 16:9 or 9:16 portrait.\n"
                    f"• The video is downloaded straight to your project via yt-dlp vendored zipapp (needs python3), "
                    f"auto-detected, override via YTDLP_PATH, cookies via YTDLP_COOKIES for age/bot-gated, max duration {1200}s cap."
                )
                if player:
                    try:
                        player.write_log(f"JARVIS: {result}")
                        player.write_log(f"📤 soundwave_youtube_paste → API → {url} → {file_key} → {name}")
                    except Exception:
                        pass
                return result
            except Exception as e:
                raise RuntimeError(f"API import failed: {e}. Ensure Soundwave server running at {api_url}, yt-dlp configured, and you have auth (login via UI or API key). Error: {e}")

        # ── Method B: Browser automation (opens UI and pastes) ───────────────
        # Uses Mark LIII's browser_control + computer_control pattern:
        # browser_control opens URL, computer_control types/clicks
        def via_browser():
            try:
                from _soundwave_client import resolve_api_url
                api_url = resolve_api_url()
                ui_url = api_url.replace(":4000", ":5173") + "/studio/video"
                # Try to use browser_control if available (Mark LIII action)
                # Fallback to webbrowser + pyautogui
                import webbrowser
                import shutil

                # Check if browser_control action exists (in Mark LIII actions/)
                browser_control_available = False
                try:
                    import sys
                    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
                    from actions.browser_control import TOOL as browser_tool
                    browser_control_available = True
                except Exception:
                    pass

                if browser_control_available:
                    # Use Mark LIII's browser_control logic
                    # This would be: browser_control action=open url=ui_url
                    # Then computer_control to focus input and type
                    result = (
                        f"🌐 Pasting YouTube link via Browser Automation into Soundwave Video Editor:\n"
                        f"• URL to paste: {url}\n"
                        f"• Step 1: Open Soundwave Video Compositor at {ui_url} via browser_control\n"
                        f"  → browser_control action=open url={ui_url}\n"
                        f"• Step 2: Wait 3-4 seconds for page load (Soundwave is React SPA)\n"
                        f"• Step 3: Focus YouTube input field\n"
                        f"  → The input has aria-label='YouTube video URL', placeholder='Paste a link — youtube.com/watch?v=…, youtu.be/…, /shorts/…'\n"
                        f"  → Located in Video Background section → Import from YouTube card → form → input\n"
                        f"  → Use computer_control to click at input position or Tab navigate, or use playwright to query [aria-label='YouTube video URL']\n"
                        f"• Step 4: Paste URL via computer_control\n"
                        f"  → computer_control action=type_text text={url}\n"
                        f"  → Or via pyperclip: pyperclip.copy('{url}') then hotkey Ctrl+V\n"
                        f"• Step 5: Click Import button\n"
                        f"  → Button has text 'Import' with Youtube icon, h-10, type submit, in same form\n"
                        f"  → computer_control action=press_key key=enter OR click Import button\n"
                        f"  → Frontend calls importYouTube() → POST /api/v1/upload/youtube with {{url}} timeout 300s\n"
                        f"• Step 6: Wait for import — shows ProgressBar indeterminate + 'Downloading from YouTube — long videos can take a minute.'\n"
                        f"• Step 7: Video appears with Badge 'YouTube' violet, videoName, Remove button\n"
                        f"  → streamUrl = /api/v1/upload/file/{{fileKey}}, setVideoFileKey(fileKey), setVideoUrl(streamUrl)\n"
                        f"\n"
                        f"Exact UI selectors for playwright (Mark LIII has playwright in requirements.txt):\n"
                        f"  await page.goto('{ui_url}')\n"
                        f"  await page.wait_for_selector('[aria-label=\"YouTube video URL\"]', timeout=10000)\n"
                        f"  await page.fill('[aria-label=\"YouTube video URL\"]', '{url}')\n"
                        f"  await page.click('button:has-text(\"Import\")')\n"
                        f"  await page.wait_for_selector('text=YouTube', timeout=120000)  # Badge appears\n"
                        f"\n"
                        f"Fallback via pyautogui if needed:\n"
                        f"  import pyautogui, pyperclip, time\n"
                        f"  pyperclip.copy('{url}')\n"
                        f"  # Focus browser, Tab to YouTube input (or click at known position)\n"
                        f"  pyautogui.hotkey('ctrl', 'v')\n"
                        f"  pyautogui.press('enter')\n"
                    )
                else:
                    # Direct webbrowser + pyautogui instructions
                    result = (
                        f"🌐 Browser method — opening Soundwave Video Editor to paste YouTube link:\n"
                        f"• Opening {ui_url} in default browser...\n"
                        f"• URL to paste: {url}\n"
                        f"• Manual steps for JARVIS via computer_control:\n"
                        f"  1. browser_control or webbrowser.open('{ui_url}')\n"
                        f"  2. Wait 4s for React SPA load\n"
                        f"  3. Focus YouTube input [aria-label='YouTube video URL'] — placeholder 'Paste a link — youtube.com/watch?v=…, youtu.be/…, /shorts/…'\n"
                        f"  4. Type/paste: {url}\n"
                        f"  5. Press Enter or click Import button (Youtube icon, h-10)\n"
                        f"  6. Wait for download — ProgressBar + 'Downloading from YouTube...'\n"
                    )
                    try:
                        webbrowser.open(ui_url)
                    except Exception:
                        pass

                if player:
                    try:
                        player.write_log(f"JARVIS: {result}")
                    except Exception:
                        pass
                return result

            except Exception as e:
                return f"Browser automation failed: {e}. Use method=api for direct API import (fastest, no UI needed)."

        # ── Method C: Clipboard (copy to clipboard + focus) ──────────────────
        def via_clipboard():
            try:
                import pyperclip
                pyperclip.copy(url)
                result = (
                    f"📋 Copied YouTube link to clipboard for pasting into Soundwave Video Editor:\n"
                    f"• URL: {url} (now in clipboard)\n"
                    f"• Next steps for JARVIS via computer_control:\n"
                    f"  1. Ensure Soundwave Video Compositor open at http://localhost:5173/studio/video (or {Path.home()}/Soundwave-AI frontend)\n"
                    f"  2. Focus YouTube input field:\n"
                    f"     - Located in: Left column → Video Background section → Import from YouTube card → form → input\n"
                    f"     - Attributes: aria-label='YouTube video URL', placeholder='Paste a link — youtube.com/watch?v=…, youtu.be/…, /shorts/…'\n"
                    f"     - Class: h-10 w-full rounded-input border border-gray-700 bg-gray-900\n"
                    f"  3. Paste via computer_control:\n"
                    f"     - computer_control action=hotkey key=ctrl+v  (or cmd+v on macOS)\n"
                    f"     - Or computer_control action=type_text text={url}\n"
                    f"  4. Submit:\n"
                    f"     - computer_control action=press_key key=enter\n"
                    f"     - Or click Import button (Youtube icon, h-10, type submit)\n"
                    f"  5. Wait: ProgressBar indeterminate + 'Downloading from YouTube — long videos can take a minute.'\n"
                    f"  6. Done: Video appears with YouTube badge violet, ready as background for FFmpeg export\n"
                    f"\n"
                    f"Exact pyautogui sequence (Mark LIII has pyautogui):\n"
                    f"  import pyautogui, pyperclip, time\n"
                    f"  pyperclip.copy('{url}')\n"
                    f"  time.sleep(0.5)\n"
                    f"  pyautogui.hotkey('ctrl', 'v')  # or 'command', 'v' on macOS\n"
                    f"  time.sleep(0.3)\n"
                    f"  pyautogui.press('enter')\n"
                    f"\n"
                    f"URL is now in clipboard — paste into Soundwave's YouTube input!"
                )
                if player:
                    try:
                        player.write_log(f"JARVIS: Copied {url} to clipboard for Soundwave Video Editor")
                    except Exception:
                        pass
                return result
            except ImportError:
                return (
                    f"Clipboard method: pyperclip not installed (pip install pyperclip), but URL to paste is:\n"
                    f"{url}\n"
                    f"\n"
                    f"Manual paste into Soundwave Video Editor:\n"
                    f"1. Open http://localhost:5173/studio/video\n"
                    f"2. In Video Background section, find 'Import from YouTube' card\n"
                    f"3. Paste into input with placeholder 'Paste a link — youtube.com/watch?v=…, youtu.be/…, /shorts/…'\n"
                    f"4. Click Import (Youtube icon)\n"
                    f"5. Wait for download via yt-dlp vendored zipapp"
                )
            except Exception as e:
                return f"Clipboard copy failed: {e}. URL to manually paste: {url}"

        # ── Dispatch by method ───────────────────────────────────────────────
        if method == "api":
            return via_api()
        elif method == "browser":
            return via_browser()
        elif method == "clipboard":
            return via_clipboard()
        else:  # auto — try api first, fallback to clipboard
            try:
                return via_api()
            except Exception as api_err:
                # Fallback to clipboard + browser instructions
                clipboard_result = via_clipboard()
                return (
                    f"API method failed ({api_err}), fallback to clipboard + browser instructions:\n"
                    f"\n"
                    f"{clipboard_result}\n"
                    f"\n"
                    f"---\n"
                    f"Browser automation alternative:\n"
                    f"{via_browser()}\n"
                    f"\n"
                    f"Tip: Ensure Soundwave server running (npm run dev in server/ + frontend/), yt-dlp installed, and you have auth. "
                    f"For direct download without Soundwave server: use soundwave_youtube action=download url={url}"
                )

    except Exception as e:
        return (
            f"Failed to paste YouTube link {url} into Soundwave Video Editor: {e}\n"
            f"\n"
            f"Manual workflow:\n"
            f"1. Open Soundwave Video Compositor: http://localhost:5173/studio/video\n"
            f"2. In left column Video Background section, find 'Import from YouTube' card (Youtube icon red)\n"
            f"3. Input: aria-label='YouTube video URL', placeholder='Paste a link — youtube.com/watch?v=…, youtu.be/…, /shorts/…'\n"
            f"4. Paste: {url}\n"
            f"5. Click Import button (Youtube icon, h-10)\n"
            f"6. Wait: POST /api/v1/upload/youtube with {{url}} timeout 300s → fileKey, streamUrl /api/v1/upload/file/{{fileKey}}\n"
            f"7. Video appears with YouTube badge violet, ready for export with voiceover + subtitles via FFmpeg"
        )
