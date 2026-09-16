# Soundwave AI — Mark LIII Plugins

**Teach JARVIS (Mark LIII) to use Soundwave AI** — production-grade TTS and video compositing studio.

These are drop-in plugins for [FatihMakes/Mark-LIII](https://github.com/FatihMakes/Mark-LIII) (MARK LIII, 1.2k★, Gemini 3.1 Flash Live). Drop a single `.py` file into `Mark-LIII/plugins/` — JARVIS learns a new skill on next launch, no core edits.

## What is Soundwave AI?

Soundwave AI is a production-grade, client-side AI text-to-speech and video compositing studio:

- **TTS**: Server-side Microsoft Neural voices via `node-edge-tts` (free, key-less Edge TTS, 24kHz mono MP3 + word timings) — 6 voices: Jenny, Ana, Sonia, Christopher, Guy, Ryan + cloned voices via OmniVoice sidecar
- **Frontend**: React 18, Vite, Tailwind, Zustand, Framer Motion
- **Backend**: Express 5 + TS, Prisma/Postgres or JSON-file fallback, JWT httpOnly cookies + CSRF, Stripe stubs, SSE export jobs
- **Media**: FFmpeg libx264/libvpx-vp9, libass subtitles + ASS watermark, volume/fades, media probing, portrait 9:16 (Shorts/TikTok/Reels)
- **Quotas**: Free 10k chars/mo, Pro 200k, Enterprise 2M; exports/hour 2/20/100
- **YouTube import**: vendored yt-dlp zipapp (needs python3)

Repo: https://github.com/Str4hinj47/Soundwave-AI (this repo)

## Plugins in this folder

| Plugin | What JARVIS learns | Example voice command |
|--------|-------------------|----------------------|
| `_soundwave_client.py` | Shared helper (NOT a plugin, starts with _) — voice metadata, Edge TTS direct synthesis, API client, SRT helpers | — |
| `soundwave_tts.py` | Generate speech with Soundwave's 6 Neural voices, speed/pitch/volume, save MP3 + auto-play | "Generate speech with Jenny: Hello world" |
| `soundwave_voices.py` | List/describe/recommend voices, play samples | "List Soundwave voices", "Recommend voice for TikTok" |
| `soundwave_studio.py` | Master studio control — TTS, list voices, create project, video export, YouTube import, status, help | "Use Soundwave studio to create voiceover" |
| `soundwave_projects.py` | Manage Soundwave projects (TTS/SUBTITLE/VIDEO) — list, create, show, duplicate, delete, stats | "List my Soundwave projects" |
| `soundwave_video.py` | Video compositing — burn subtitles into video, 16:9 + 9:16 portrait, FFmpeg workflow, YouTube import | "Make video with subtitles, portrait 9:16" |
| `soundwave_clone.py` | Voice cloning via OmniVoice sidecar — status, list, clone info, generate with cloned voice | "Clone my voice", "List cloned voices" |
| `soundwave_youtube.py` | YouTube import as video background via yt-dlp (now with paste_guide action + exact UI flow) | "Import YouTube video https://..." |
| `soundwave_youtube_paste.py` | ⭐ NEW: Paste YouTube link into Video Editor — exact UI flow, 3 methods api/browser/clipboard/auto | "Paste YouTube link https://youtube.com/watch?v=... into video editor" |

All plugins follow Mark LIII's self-describing skills architecture:
- `PLUGIN` dict with `name` (regex `^[a-zA-Z_][a-zA-Z0-9_]{0,63}$`), `description` (Gemini routing), `parameters` (type OBJECT)
- Optional `PLUGIN_SETTINGS` (namespace, title, fields) for UI settings form
- `run(parameters, player, session_memory) -> str` — returns spoken string, never raises, logs via `player.write_log()`
- Crash isolation via `core/plugin_loader.py`

## Installation

### 1. Install Mark LIII

```bash
git clone https://github.com/FatihMakes/Mark-LIII.git
cd Mark-LIII
python setup.py  # OS-aware, skips wrong-OS deps
# or
pip install -r requirements.txt
```

### 2. Install Soundwave plugin deps

```bash
pip install edge-tts requests
# Optional for YouTube import:
pip install yt-dlp
```

`edge-tts` is the Python equivalent of Soundwave's `node-edge-tts` — same free Microsoft Edge TTS service, 24kHz mono MP3, no API key.

### 3. Copy plugins to Mark LIII

```bash
# From this repo (Soundwave-AI/mark-liii-plugins/) to Mark-LIII/plugins/
cp mark-liii-plugins/soundwave_*.py /path/to/Mark-LIII/plugins/
cp mark-liii-plugins/_soundwave_client.py /path/to/Mark-LIII/plugins/

# Verify no leading underscore for actual plugins (except _soundwave_client.py which is helper)
ls /path/to/Mark-LIII/plugins/soundwave*.py
```

### 4. Configure (optional)

Set env vars for Soundwave API integration (cloud features):

```bash
export SOUNDWAVE_API_URL=http://localhost:4000  # or your deployed Soundwave URL
export SOUNDWAVE_API_KEY=swa_live_...  # Enterprise API key for cloud projects/export
```

Or store in Mark LIII's `config/api_keys.json`:

```json
{
  "gemini_api_key": "your_gemini_key",
  "soundwave_url": "http://localhost:4000",
  "soundwave_api_key": "swa_live_..."
}
```

For local use (direct Edge TTS), no Soundwave server needed — plugins work offline via `edge-tts` library.

### 5. Restart JARVIS

```bash
python main.py
```

Logs should show:

```
Action loaded: ... (existing)
Plugin loaded: soundwave_tts (soundwave_tts.py)
Plugin loaded: soundwave_voices (soundwave_voices.py)
Plugin loaded: soundwave_studio (soundwave_studio.py)
Plugin loaded: soundwave_projects (soundwave_projects.py)
Plugin loaded: soundwave_video (soundwave_video.py)
Plugin loaded: soundwave_clone (soundwave_clone.py)
Plugin loaded: soundwave_youtube (soundwave_youtube.py)
```

Enable/disable via ⚙ → Plugin Manager (stored in `config/api_keys.json` `plugin_enabled` dict, re-read every call, no restart needed).

## Usage — Voice Commands for JARVIS

### TTS Generation

- "Generate speech with Jenny: Hello world, welcome to Soundwave AI"
- "Say this with Guy voice: The quick brown fox jumps"
- "Create TTS with Sonia, speed 1.2: Welcome to our presentation"
- "Make an audio clip: ..."

→ Saves MP3 to `~/Soundwave/tts/` + auto-plays, also creates SRT cues.

### Voice Library

- "List Soundwave voices"
- "Describe Jenny voice"
- "Play sample of Guy"
- "Recommend voice for TikTok" / "Which voice for corporate video?"

→ Lists 6 voices with styles, recommends based on use case.

### Studio Master

- "Use Soundwave studio to create voiceover"
- "Soundwave studio status"
- "Create Soundwave project My First Video"
- "Make video with subtitles portrait"

→ Master control, explains workflows, creates projects.

### Projects

- "List my Soundwave projects"
- "Create Soundwave project My Podcast"
- "Show project my_podcast_123"
- "Stats for Soundwave projects"

→ Manages `~/Soundwave/projects/` folders + cloud via API.

### Video

- "Make video with subtitles"
- "Burn subtitles into video, aspect 9:16"
- "Workflow for video export"
- "Import YouTube video https://youtube.com/watch?v=... as background"

→ Explains FFmpeg export, prepares MP3+SRT, handles 16:9/9:16 portrait for Shorts/TikTok/Reels.

### Voice Cloning

- "Check Soundwave clone status"
- "List cloned voices"
- "How to clone my voice?"
- "Generate with cloned voice: Hello with my cloned voice, profile abc123"

→ Checks OmniVoice sidecar, lists profiles, explains 3-10s clean clip workflow.

### YouTube Import

- "Import YouTube video https://youtube.com/watch?v=... for Soundwave"
- "Download YouTube video https://..."

→ Downloads via yt-dlp directly or via Soundwave API POST /api/v1/upload/youtube.

## How JARVIS Uses Soundwave — Architecture

### Direct Edge TTS (no server)

Plugins default to direct synthesis via `edge-tts` library — same engine Soundwave uses server-side via `node-edge-tts`:

```python
# _soundwave_client.py
import edge_tts, asyncio
communicate = edge_tts.Communicate(text, voice, rate="+0%", pitch="+0Hz", volume="+0%")
await communicate.save(output_path)
```

- 6 voices, 24kHz mono MP3, free, no API key, 20s timeout
- Saves to `~/Soundwave/tts/` + auto-plays cross-platform (os.startfile Windows, open macOS, xdg-open/mpv/vlc Linux)
- Also creates SRT cues via `text_to_srt_cues()` + `save_srt()`

### Soundwave API (cloud features, optional)

If `SOUNDWAVE_API_URL` set, plugins can call Soundwave API:

- `GET /api/v1/voices` — no auth, lists 6 voices
- `POST /api/v1/tts/synthesize` — auth required, returns `{audioBase64, mimeType, duration, wordTimings, used, limit, resetDate}` + quota enforcement
- `POST /api/v1/tts/clone` — cloned voice synthesis
- `GET/POST /api/v1/projects` — cloud projects (Pro+ for save)
- `POST /api/v1/upload/video|audio|avatar` — magic-byte validated uploads, UUIDv7 keys
- `POST /api/v1/upload/youtube` — YouTube import via yt-dlp vendored zipapp, Range supported
- `POST /api/v1/export/video` — FFmpeg export job (16:9 or 9:16 portrait), SSE progress via `/jobs/:id/events`, download `/jobs/:id/download`
- Auth: JWT httpOnly cookies + CSRF (web), API keys `swa_live_...` SHA-256 hashed for Enterprise

### Subtitle & Video Workflow

1. TTS → MP3 + wordTimings → cues `{start, end, text}` → SRT
2. Style subtitles (presets: TikTok bold center, YouTube classic, minimal — `frontend/src/lib/subtitlePresets.ts`)
3. Background video: upload or solid color `0x0A0F1C`, YouTube via yt-dlp, loops if shorter than voice or cut via `videoEnd`
4. Export: `exportSettings` resolution 720p/1080p/1440p/4K (Free 720p watermark, Pro 1080p, Enterprise 4K no watermark), aspect 16:9/9:16, format mp4/webm, quality low/medium/high, fps 24-60, audioVolume, fadeIn/out
5. FFmpeg: libx264/libvpx-vp9, libass subtitles + ASS watermark, volume/fades, media probing

## Soundwave API for JARVIS — Quick Reference

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | /api/v1/voices | — | 6 voices metadata + sample URLs |
| GET | /voice-samples/:voiceId.mp3 | — | static sample audio |
| POST | /api/v1/tts/synthesize | ✓ | Edge TTS → MP3 base64 + word timings, enforces quota |
| POST | /api/v1/tts/clone | ✓ | Cloned voice synthesis |
| GET/POST | /api/v1/projects | ✓ | Cloud projects (Pro+ for save) |
| POST | /api/v1/upload/video\|audio\|avatar | ✓ | magic-byte validated uploads |
| POST | /api/v1/upload/youtube | ✓ | YouTube import via yt-dlp |
| GET | /api/v1/upload/file/:key | ✓ | Stream imported/uploaded video (Range) |
| POST | /api/v1/export/video | ✓ | Start FFmpeg export job (16:9 or 9:16) |
| GET | /api/v1/export/jobs/:id | ✓ | Job status (SSE stream) |
| GET | /api/v1/export/jobs/:id/download | ✓ | Download finished export |

State-changing requests require `X-CSRF-Token` header matching `csrf_token` cookie. Rate limiting: 300 req/min general, stricter on auth/upload.

## Troubleshooting

- `edge-tts not installed`: `pip install edge-tts`
- `requests not installed`: `pip install requests`
- `yt-dlp not found`: `pip install yt-dlp` or use vendored `vendor/yt-dlp/yt-dlp` (needs python3)
- JARVIS can't hear me: check ⚙ → 🎧 AUDIO DEVICES — likely listening to webcam, pick mic by name (filters 41→8 entries)
- Soundwave API 401: need auth — set `SOUNDWAVE_API_KEY` or login via Soundwave UI http://localhost:5173, copy JWT from cookies, or use Enterprise API key
- Clone status unavailable: set `VOICECLONE_URL` env in Soundwave server to OmniVoice sidecar URL, ensure sidecar running
- FFmpeg not found: `winget install ffmpeg` (Windows) or `sudo apt install ffmpeg` (Linux), or set `FFMPEG_PATH`
- No projects: `~/Soundwave/projects/` created on first use, or check Soundwave UI Dashboard

## Related

- Mark LIII repo: https://github.com/FatihMakes/Mark-LIII
- Soundwave AI repo: this repo, `server/src/routes/jarvis.ts` has expert API that teaches Soundwave to use Mark LIII (inverse)
- Soundwave JARVIS Expert UI: http://localhost:5173/jarvis — chat expert that knows Mark LIII inside-out + plugin generator
- Docs: `docs/JARVIS_MARK_LIII_EXPERT.md` — how Soundwave was made expert at Mark LIII

## License

Same as Mark LIII: CC BY-NC 4.0 (personal & non-commercial). Soundwave AI is MIT? Check main LICENSE.

---

**Made for JARVIS** — Now JARVIS can use Soundwave AI as its voice studio. Say "Generate speech with Jenny" and JARVIS creates studio-quality voiceover via Soundwave's Edge TTS engine.

## ⭐ NEW: Paste YouTube Link into Video Editor

**The #1 workflow**: User copies YouTube URL, wants it as background video in Soundwave's Video Compositor at `/studio/video`.

### Exact UI Flow (from `frontend/src/pages/VideoCompositor.tsx`)

**Page**: `/studio/video` — VideoCompositor, left column Video Background section

**Video Background Section** (`rounded-card border border-gray-800 bg-panel p-5`):
- Title: "Video Background" + Badge (YouTube violet or Uploaded green)
- If no video:
  - Drag & drop zone: "Drag & drop a video, or click to browse" + hidden file input
  - **Import from YouTube card**: `mt-4 rounded-card border border-gray-800 bg-gray-900/50 p-4`
    - Title: `<Youtube icon h-4 w-4 text-red-400> Import from YouTube`
    - Form: `mt-2.5 flex flex-col gap-2 sm:flex-row`, onSubmit importYouTube()
      - Input: value ytUrl, placeholder "Paste a link — youtube.com/watch?v=…, youtu.be/…, /shorts/…", aria-label "YouTube video URL", class `h-10 w-full rounded-input border border-gray-700 bg-gray-900`
      - Button: Import with Youtube icon h-10 size sm type submit loading ytImporting
    - When importing: ProgressBar indeterminate + "Downloading from YouTube — long videos can take a minute."
- If video exists: videoName truncate + Badge + Remove button

**importYouTube() function**:
```ts
const res = await http.post<{ fileKey: string; name: string; size: number }>("/upload/youtube", { url }, { timeout: 300_000 });
const streamUrl = `/api/v1/upload/file/${res.fileKey}`;
setVideoFileKey(res.fileKey); setVideoUrl(streamUrl); setVideoName(res.name);
studio.setVideo({ blob: null, url: streamUrl, name: res.name, fileKey: res.fileKey });
// Badge violet YouTube, videoFromYouTube = videoUrl.startsWith("/api/v1/upload/file/")
```

**Backend**: POST `/api/v1/upload/youtube` {url} → {fileKey UUIDv7, name, size}, yt-dlp vendored zipapp vendor/yt-dlp/yt-dlp needs python3, YTDLP_COOKIES, YTDLP_MAX_DURATION 1200s, timeout 240s, stream via GET `/api/v1/upload/file/:key` Range

### JARVIS 3 Methods

**A) API Direct (fastest, recommended, no UI)**:
```python
from _soundwave_client import api_request
res = api_request("POST", "/api/v1/upload/youtube", json_data={"url": "https://youtube.com/watch?v=..."}, timeout=300)
file_key = res["fileKey"]
```

**B) Browser Automation (opens UI and pastes)**:
- browser_control action=open url=http://localhost:5173/studio/video, wait 3-4s React SPA load
- Focus input `[aria-label="YouTube video URL"]` via playwright or computer_control
- Playwright exact:
```python
await page.goto("http://localhost:5173/studio/video")
await page.wait_for_selector('[aria-label="YouTube video URL"]', timeout=10000)
await page.fill('[aria-label="YouTube video URL"]', 'https://youtube.com/watch?v=...')
await page.click('button:has-text("Import")')
await page.wait_for_selector('text=YouTube', timeout=120000)  # Badge violet
```
- computer_control: type_text text=url or hotkey ctrl+v + press enter

**C) Clipboard**:
```python
import pyperclip
pyperclip.copy("https://youtube.com/watch?v=...")
# Then computer_control hotkey ctrl+v + enter, input aria-label="YouTube video URL"
```

### Plugin: soundwave_youtube_paste.py

- **Params**: url required (youtube.com/watch?v=…, youtu.be/…, /shorts/…), method api/browser/clipboard/auto default auto, auto_play bool
- **Auto**: tries api then clipboard fallback
- **Voice commands**:
  - "Paste YouTube link https://youtube.com/watch?v=dQw4w9WgXcQ into Soundwave video editor"
  - "Paste https://youtu.be/... into video editor"
  - "Import YouTube https://... as background in Soundwave video editor"

Supports youtube.com/watch?v=..., youtu.be/..., /shorts/..., m.youtube.com with &t=30s &list=...

### Existing soundwave_youtube.py Enhanced

Now supports 4 actions:
- info: classic workflow
- paste_guide: exact UI paste flow with selectors, importYouTube(), 3 methods, backend, supported URLs
- download: direct yt-dlp to ~/Soundwave/youtube/
- soundwave_import: via API POST /api/v1/upload/youtube

Use `soundwave_youtube url=... action=paste_guide` for full guide.


## 💻 PC Mastery Suite — Make JARVIS Impeccable at Using Your PC (NEW)

**User has anythingLLM for non-PC tasks, JARVIS focuses 100% on PC control — 50+ actions, free & open source, zero tokens.**

### Community Plugins (5 from upgraderguy777/jarvis-plugins — MIT, zero-token optimized)

| Plugin | OS | Token Impact | Purpose |
|--------|----|--------------|---------|
| `notification_reader.py` | Windows 10 1607+ / 11 | Zero | Reads Windows notification center — Discord, Slack, WhatsApp, Outlook, etc. Actions: check, list, status, watch (background watcher), unwatch, watches |
| `screen_recorder.py` | Windows Full / macOS Linux Voice only | Zero | Real screen recording video over time. Voice: start/stop/pause/resume/status. Hotkeys Win+Alt+R, Win+Alt+P. Auto audio muxing via ffmpeg |
| `screenshot_annotate.py` | Cross-platform | Low (2-pass) | Visual teaching — screenshot + Gemini finds UI element + draws orange rings + spoken directions. 2-pass: downscale 1400px + micro-crop |
| `discord_messenger.py` | Windows 10/11 | Zero-to-Low | Discord Desktop control — DMs, channels, @mentions. 3-tier: aliases deep links, accessibility tree via pywinauto, vision fallback |
| `magi_system.py` | Cross-platform | Ultra-Low (Flash-Lite) | NGE MAGI — 3 personas: MELCHIOR-1 (Scientist), BALTHASAR-2 (Mother), CASPER-3 (Woman). Modes: quick, thinking, max with early consensus exit |

### Ultimate PC Control (11 new — makes JARVIS impeccable)

| Plugin | Actions | Purpose | Install |
|--------|---------|---------|---------|
| `pc_master.py` | 50+ | **MASTER** — volume, brightness, WiFi, Bluetooth, power, display, audio, keyboard, mouse, window snap, file search/organize, process list/kill, clipboard history, screenshot, network, startup, dark mode | `pip install pyautogui pygetwindow pycaw psutil screen-brightness-control` |
| `file_commander.py` | 15+ | File management — search, recent, organize by type, batch rename {n}/{date}, duplicates MD5, disk usage, largest/oldest, tree, stats, open/reveal | stdlib |
| `window_manager_pro.py` | 15+ | Window management — list, minimize/maximize/close, snap left/right/top/bottom/max, move x,y, resize w,h, always on top (Win32), focus, transparency, virtual desktop, multi-monitor, cascade, tile | `pip install pygetwindow pyautogui screeninfo` |
| `process_commander.py` | 12+ | Process management — list, top, search, kill, kill_all, start, restart, priority, affinity, monitor, tree, stats | `pip install psutil` |
| `clipboard_master.py` | 13+ | Clipboard intelligence — history 50 auto-tracked, get/set/clear, translate (Gemini), summarize, explain, fix, search, pin/unpin, save/load, OCR | `pip install pyperclip` |
| `automation_master.py` | 10+ | Macros & automation — record (pynput), stop, play (pyautogui), list, delete, hotkey, workflow JSON, schedule via OS scheduler | `pip install pynput pyautogui` |
| `browser_master.py` | 15+ | Browser automation — open, navigate, back/forward/refresh, new_tab/close_tab/switch_tab/list_tabs, bookmarks (Chrome JSON), fill selector, click selector, screenshot, pdf, download, autofill, Playwright exact | `pip install playwright && playwright install chromium` |
| `system_monitor_pro.py` | 12+ | Enhanced monitoring — status (CPU per core, RAM, disk partitions, battery, uptime, alerts), cpu, ram, disk, gpu (GPUtil/nvidia-smi), network IO, battery, temperature, processes, top, sensors | `pip install psutil GPUtil` |
| `app_launcher_pro.py` | 9+ | Intelligent app launcher — launch by name (per-OS map), list, recent 20, frequent count, pin/unpin favorites, search, kill | stdlib |
| `screen_master.py` | 10+ | Screen control — screenshot (mss), capture_window, capture_region, annotate (Gemini vision 2-pass), ocr (pytesseract), record_start/stop/status, compare | `pip install mss Pillow pyautogui pytesseract opencv-python` |
| `network_commander.py` | 12+ | Network control — status (local+public IP), wifi_list, wifi_connect SSID password, wifi_disconnect, ip, speedtest, scan (nmap/arp), ping, traceroute, dns, hosts, firewall | `pip install requests speedtest-cli` |

### Bridge

| Plugin | Purpose |
|--------|---------|
| `anything_llm_bridge.py` | Delegate non-PC tasks to AnythingLLM — status, chat, list_workspaces, list_docs. JARVIS does PC, AnythingLLM does docs/RAG. Config via ANYTHING_LLM_API_URL, ANYTHING_LLM_API_KEY |

**Total: 30 plugins (29 + _soundwave_client) after Phase 1 vision fix — makes JARVIS impeccable at PC + Soundwave TTS/video**

### Phase 1 Vision Fix — NEW (5 plugins, fixes biggest weakness)

| Plugin | Actions | Purpose | Token |
|--------|---------|---------|-------|
| `accessibility_master.py` | 10+ | Windows UI Automation tree master — list/find/click/type/focus/active_window/describe/tree/get_value/is_enabled — zero tokens foundation | Zero |
| `screen_pro.py` | 5+ | Thread-safe screenshot pro — fresh mss per call fixes segfaults, DPI awareness GetDpiForSystem, display_hint cached, resize max_width LANCZOS | Zero |
| `screen_reader_pro.py` | 8+ | Text-based screen description for non-vision — active window, mouse near center, focused, visible elements, click_by_name, type_into | Zero |
| `region_watcher_pro.py` | 5+ | Background region watcher — daemon thread 1.5s, signature 24x24 grayscale mean abs diff, change/stable modes, plyer notification, stops when empty | Zero |
| `vision_bridge.py` | 6+ | Tree first vision second — tree via pywinauto zero tokens, vision fallback 1400px + Gemini 2-pass low tokens, modes auto/tree/vision | Zero-to-Low |

### One-Command Install for PC Mastery

```bash
pip install pyautogui pygetwindow pycaw comtypes psutil screen-brightness-control mss Pillow pyperclip pynput screeninfo GPUtil requests speedtest-cli opencv-python sounddevice winsdk pywinauto pytesseract
pip install playwright && playwright install chromium
# notification_reader auto-installs winsdk
cp mark-liii-plugins/*.py /path/to/Mark-LIII/plugins/
python main.py
```

### Voice Commands — PC Mastery

- "Set volume to 50", "Set brightness to 80", "System status", "CPU usage"
- "Find file report in Documents", "Organize my Downloads", "Batch rename files to IMG_{n}"
- "List open windows", "Snap Chrome to left", "Make YouTube always on top"
- "List processes", "Kill Chrome", "Start notepad"
- "Clipboard history", "Translate clipboard to Serbian", "Take screenshot"
- "Open YouTube", "New tab GitHub", "Where is the export button"
- "Network status", "List WiFi networks", "Speed test"
- "Record macro open_chrome_search", "Play macro", "Press ctrl+shift+t"
- "Check my notifications", "Any new Discord messages"
- "Ask MAGI should I deploy this"

See `docs/PC_MASTERY.md` for full 500+ line guide.
