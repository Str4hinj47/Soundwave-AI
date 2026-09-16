# Soundwave AI — JARVIS Branch

This branch `jarvis` contains Soundwave AI + cloned Mark LIII JARVIS with Soundwave plugins.

Quick Start:
- Soundwave: cd server && npm run dev & cd frontend && npm run dev → http://localhost:5173/studio/video
- JARVIS: cd Mark-LIII && python setup.py && pip install edge-tts requests pyperclip pyautogui yt-dlp && python main.py

YouTube Paste: /studio/video → Video Background → Import from YouTube → input aria-label="YouTube video URL" + Import button → POST /api/v1/upload/youtube

JARVIS: soundwave_youtube_paste url=... method=auto (api/browser/clipboard)

See docs/SOUNDWAVE_FOR_JARVIS.md
