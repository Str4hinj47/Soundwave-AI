# Mark LIII + Soundwave AI Integration — JARVIS Knows Soundwave

This folder is a full clone of https://github.com/FatihMakes/Mark-LIII with Soundwave AI plugins pre-installed.

## 8 Soundwave Plugins

| Plugin | Purpose | Voice Command |
|--------|---------|---------------|
| _soundwave_client.py | Shared helper | — |
| soundwave_tts.py | TTS 6 voices | "Generate speech with Jenny: Hello world" |
| soundwave_voices.py | Voice library | "List Soundwave voices" |
| soundwave_studio.py | Master control | "Use Soundwave studio to create voiceover" |
| soundwave_projects.py | Projects | "List my Soundwave projects" |
| soundwave_video.py | Video 16:9 + 9:16 | "Make video portrait 9:16" |
| soundwave_clone.py | Voice cloning | "Clone my voice" |
| soundwave_youtube.py | YouTube import | "Import YouTube video https://..." |
| soundwave_youtube_paste.py | ⭐ Paste YouTube into Video Editor | "Paste YouTube link https://... into video editor" |

## YouTube Paste Workflow

UI: /studio/video → Video Background → Import from YouTube card → input aria-label="YouTube video URL" placeholder "Paste a link — youtube.com/watch?v=…, youtu.be/…, /shorts/…" + Import button h-10

Backend: POST /api/v1/upload/youtube {url} timeout 300s → fileKey UUIDv7 → streamUrl /api/v1/upload/file/:key → Badge violet YouTube

JARVIS 3 Methods:
- API: api_request("POST", "/api/v1/upload/youtube", json_data={"url": url}, timeout=300)
- Browser: browser_control open + playwright [aria-label="YouTube video URL"] fill + click Import
- Clipboard: pyperclip.copy + pyautogui hotkey ctrl+v + enter

See docs/SOUNDWAVE_FOR_JARVIS.md for full guide.
