# JARVIS PC Mastery — Make JARVIS Impeccable at Using Your PC

**User has anythingLLM for non-PC tasks, JARVIS focuses 100% on PC control.**

This guide makes JARVIS (Mark LIII) impeccable at using your PC — free & open source, zero external API for most actions, optimized for free-tier Gemini.

## Philosophy

- **JARVIS does PC**: volume, brightness, WiFi, files, windows, processes, clipboard, screenshots, browser, automation — 50+ actions, zero tokens, local OS APIs
- **anythingLLM does non-PC**: docs, PDFs, RAG, knowledge base, summarization — via AnythingLLM API bridge
- **Free & Open Source**: All plugins MIT, no subscriptions, uses pyautogui, pygetwindow, pycaw, psutil, mss, etc.
- **Zero Token Optimization**: Inspired by upgraderguy777/jarvis-plugins — uses Windows Runtime API, accessibility trees, Win32, local fallbacks, downscaled vision

## Plugins — Ultimate PC Control Suite (30 plugins after Phase 1 vision fix)

### Phase 1 Vision Fix — NEW (Fixes biggest weakness: accessibility tree first zero tokens, vision second low tokens)

| Plugin | Actions | Purpose | Install | Token |
|--------|---------|---------|---------|-------|
| **accessibility_master.py** | 10+ | **FOUNDATION** — Windows UI Automation tree master, reads name/type/value/bounds x,y,w,h/enabled via pywinauto UIA Desktop(backend="uia") — zero tokens, instant, no vision. Actions: list, find, click, type, focus, active_window (ctypes GetForegroundWindow), describe (active + mouse near center + focused + elements), tree, get_value, is_enabled | `pip install pywinauto pyautogui comtypes` | Zero |
| **screen_pro.py** | 5+ | Thread-safe screenshot with DPI awareness — fresh mss instance per call (fixes segfaults, mss uses GDI/COM not thread-safe), resize max_width LANCZOS, display_hint cached PRIMARY bitmap WxH virtual origin mouse same grid PNGs, DPI via GetDpiForSystem | `pip install mss Pillow` | Zero |
| **screen_reader_pro.py** | 8+ | Text-based screen description for non-vision providers — active window title/app/rect via ctypes, mouse position near center, focused element, visible UI elements top N, click_by_name, type_into, clipboard | `pip install pywinauto pyautogui` | Zero |
| **region_watcher_pro.py** | 5+ | Background screen change detection — daemon thread polling 1.5s, watches dict id→bbox label mode threshold stable_seconds last_sig was_changing stable_since fired, signature mss grab bbox RGB→L resize 24x24 np float32, process mean abs diff/255, change fires diff>=threshold stable fires was_changing+stable_seconds, plyer notification + emit_ui_event, stops when no watches | `pip install mss Pillow numpy plyer` | Zero |
| **vision_bridge.py** | 6+ | Tree first vision second — fixes biggest weakness, strategy: tree via pywinauto zero tokens instant, vision fallback screenshot downscale 1400px max LANCZOS + Gemini 2.0 Flash 2-pass micro-crop orange rings low tokens. Modes auto/tree/vision. Actions: find, click, describe, status, help | `pip install pywinauto pyautogui mss Pillow google-genai` | Zero-to-Low |

**Why vision fix matters:** LLMs can't see screen, need structured data. Accessibility tree gives name, type, bounds, enabled, value for every control — zero tokens, instant. Vision via 1400px downscale saves token bandwidth vs full-res. Fresh mss per call fixes segfaults. Display hint ties MSS captures (monitor 1) to pyautogui pixels — single line for system prompt, keeps model usage low. From ONEPUNCHMAN411/Jarvis control/accessibility.py 229 lines + screen_reader.py 331 lines + screen.py 106 lines + region_watcher.py 156 lines + upgraderguy777/jarvis-plugins screenshot_annotate.py 2-pass + discord_messenger.py 3-tier.

## Plugins — Ultimate PC Control Suite (30 plugins)

### Core PC Mastery (11 new ultimate plugins)

| Plugin | Actions | Purpose | Install |
|--------|---------|---------|---------|
| **pc_master.py** | 50+ | Master PC control — volume, brightness, WiFi, Bluetooth, power, display, audio, keyboard, mouse, window snap, file search/organize, process list/kill, clipboard history, screenshot, network, startup, dark mode, etc. | `pip install pyautogui pygetwindow pycaw psutil screen-brightness-control` |
| **file_commander.py** | 15+ | Advanced file management — search, recent, organize by type, batch rename with {n}/{date}, duplicates (MD5), disk usage, largest/oldest, tree, stats, open/reveal | `pip install` (stdlib only) |
| **window_manager_pro.py** | 15+ | Window management — list, minimize/maximize/close, snap left/right/top/bottom/max, move x,y, resize w,h, always on top (Win32), focus, transparency, virtual desktop new/close, multi-monitor move, cascade, tile | `pip install pygetwindow pyautogui screeninfo` |
| **process_commander.py** | 12+ | Process management — list, top, search, kill, kill_all, start, restart, priority high/normal/low, affinity, monitor CPU/MEM, tree, stats | `pip install psutil` |
| **clipboard_master.py** | 13+ | Clipboard intelligence — history (50 entries, auto-tracked), get/set/clear, translate (Gemini), summarize, explain, fix, search, pin/unpin, save/load, OCR | `pip install pyperclip` |
| **automation_master.py** | 10+ | Macros & automation — record (pynput), stop, play (pyautogui), list, delete, hotkey, workflow template (JSON steps), schedule via OS scheduler | `pip install pynput pyautogui` |
| **browser_master.py** | 15+ | Browser automation — open, navigate, back/forward/refresh, new_tab/close_tab/switch_tab/list_tabs, bookmarks (Chrome), fill selector, click selector, screenshot, pdf, download, autofill, Playwright exact code | `pip install playwright && playwright install chromium` |
| **system_monitor_pro.py** | 12+ | Enhanced monitoring — status (CPU per core, RAM, disk partitions, battery, uptime, alerts), cpu, ram, disk, gpu (GPUtil/nvidia-smi), network IO, battery, temperature, processes, top, sensors | `pip install psutil GPUtil` |
| **app_launcher_pro.py** | 9+ | Intelligent app launcher — launch by name (per-OS map), list known apps, recent (20), frequent (count), pin/unpin favorites, search, kill | stdlib + json |
| **screen_master.py** | 10+ | Screen control — screenshot (mss), capture_window, capture_region, annotate (Gemini vision 2-pass), ocr (pytesseract), record_start/stop/status (delegates to screen_recorder), compare | `pip install mss Pillow pyautogui pytesseract opencv-python` |
| **network_commander.py** | 12+ | Network control — status (local+public IP), wifi_list, wifi_connect SSID password, wifi_disconnect, ip, speedtest, scan (nmap/arp), ping, traceroute, dns, hosts, firewall | `pip install requests speedtest-cli` |

### Community Plugins (5 from upgraderguy777/jarvis-plugins — free, MIT, zero-token optimized)

| Plugin | OS | Deps | Token Impact | Purpose |
|--------|----|------|--------------|---------|
| **notification_reader.py** | Windows 10 1607+ / 11 | winsdk (auto) | Zero | Reads Windows notification center — Discord, Slack, WhatsApp, Outlook, Teams, Gmail, etc. Actions: check, list, status, watch (background watcher for keyword), unwatch, watches |
| **screen_recorder.py** | Windows Full / macOS Linux Voice only | opencv-python, mss, sounddevice | Zero | Real screen recording video over time, not single screenshot. Voice: start/stop/pause/resume/status. Hotkeys Win+Alt+R (toggle start/stop), Win+Alt+P (pause/resume). Auto audio muxing via ffmpeg |
| **screenshot_annotate.py** | Cross-platform | mss, Pillow, google-genai | Low (2-pass) | Visual teaching — screenshot + Gemini finds UI element + draws numbered orange rings + spoken directions + opens image. 2-pass: downscale 1400px rough, micro-crop pinpoint |
| **discord_messenger.py** | Windows 10/11 | pyautogui, pywinauto, pyperclip | Zero-to-Low | Discord Desktop control — DMs, server channels, @everyone/@here/@mentions. 3-tier: saved aliases deep links, accessibility tree via pywinauto, vision fallback, 429/503 regex fallback |
| **magi_system.py** | Cross-platform | google-genai | Ultra-Low (Flash-Lite) | NGE MAGI supercomputer — 3 personas: MELCHIOR-1 (Scientist logic), BALTHASAR-2 (Mother safety), CASPER-3 (Woman desire). Modes: quick (parallel vote), thinking (3-round debate), max (deep debate with early consensus exit) |

### Soundwave AI Plugins (8 — TTS + video studio)

| Plugin | Purpose |
|--------|---------|
| **soundwave_tts.py** | Generate speech with 6 Neural voices (Jenny, Ana, Sonia, Christopher, Guy, Ryan) via Edge TTS free, no API key, save MP3 + auto-play |
| **soundwave_voices.py** | List/describe/recommend voices, sample |
| **soundwave_studio.py** | Master studio — TTS, projects, video export, YouTube import |
| **soundwave_projects.py** | Manage projects ~/Soundwave/projects/ |
| **soundwave_video.py** | Video compositing 16:9 + 9:16 portrait |
| **soundwave_clone.py** | Voice cloning via OmniVoice |
| **soundwave_youtube.py** | YouTube import + paste_guide |
| **soundwave_youtube_paste.py** | Paste YouTube link into Video Editor — exact UI flow, 3 methods api/browser/clipboard/auto |

### Bridge

| Plugin | Purpose |
|--------|---------|
| **anything_llm_bridge.py** | Delegate non-PC tasks to AnythingLLM — status, chat, list_workspaces, list_docs. JARVIS does PC, AnythingLLM does docs/RAG |

**Total: 30 plugins (29 + _soundwave_client helper) after Phase 1 — 11 core + 5 community + 5 vision fix + 8 Soundwave + 1 bridge — makes JARVIS impeccable at PC**

## Installation — One Command

```bash
# Clone Mark LIII
git clone https://github.com/FatihMakes/Mark-LIII.git
cd Mark-LIII

# Install Mark LIII base
python setup.py

# Install PC Mastery suite (free & open source)
pip install pyautogui pygetwindow pycaw comtypes psutil screen-brightness-control mss Pillow pyperclip pynput screeninfo GPUtil requests speedtest-cli opencv-python sounddevice winsdk pywinauto pytesseract

# For browser automation
pip install playwright
playwright install chromium

# For community plugins (auto-install winsdk on first run)
# notification_reader auto-installs winsdk

# Copy PC Mastery plugins
cp /path/to/Soundwave-AI/mark-liii-plugins/*.py ./plugins/
# Exclude _soundwave_client.py if you don't need Soundwave TTS, or keep it for voiceovers

# Optional: AnythingLLM bridge
# Set env:
export ANYTHING_LLM_API_URL=http://localhost:3001
export ANYTHING_LLM_API_KEY=your_key
export ANYTHING_LLM_WORKSPACE=your_workspace_slug
# Or in config/api_keys.json:
# {
#   "anything_llm_url": "http://localhost:3001",
#   "anything_llm_api_key": "...",
#   "anything_llm_workspace": "..."
# }

# Run JARVIS
python main.py
# Logs: Plugin loaded: pc_master, file_commander, window_manager_pro, etc.
```

## Voice Commands — PC Mastery

**System:**
- "Set volume to 50"
- "Set brightness to 80"
- "Turn WiFi off"
- "Lock my PC"
- "System status"
- "CPU usage"
- "Disk space"
- "Battery status"

**Files:**
- "Find file report in Documents"
- "Organize my Downloads"
- "Batch rename files in Pictures to IMG_{n}"
- "Find duplicate files in Downloads"
- "Show largest files"
- "Recent files"

**Windows:**
- "List open windows"
- "Snap Chrome to left"
- "Move Notepad to 100,200"
- "Make YouTube always on top"
- "Minimize all windows"
- "Tile windows side by side"
- "Switch to Visual Studio Code"

**Processes:**
- "List processes"
- "Top processes"
- "Kill Chrome"
- "Start notepad"
- "Monitor process 1234"

**Clipboard:**
- "Clipboard history"
- "Translate clipboard to Serbian"
- "Summarize clipboard"
- "Save clipboard to file"

**Screen:**
- "Take screenshot"
- "Where is the export button" → annotates screen with orange rings
- "Record my screen"
- "Stop recording"
- "OCR this image"

**Browser:**
- "Open YouTube"
- "New tab GitHub"
- "Fill search with hello world"
- "Click login button"
- "Take browser screenshot"

**Network:**
- "Network status"
- "List WiFi networks"
- "My IP address"
- "Speed test"
- "Ping 8.8.8.8"

**Automation:**
- "Record macro open_chrome_search"
- "Play macro open_chrome_search"
- "List macros"
- "Press ctrl+shift+t"

**Notifications (Windows):**
- "Check my notifications"
- "Any new Discord messages"
- "Watch for Slack messages about meeting"
- "List notification watches"

**Discord (Windows):**
- "Send Discord message to John hello"
- "Discord message in general channel"

**MAGI System:**
- "Ask MAGI should I deploy this"
- "MAGI quick decision about X"
- "MAGI thinking mode for Y"

**AnythingLLM (non-PC):**
- "Ask AnythingLLM summarize my pdf"
- "AnythingLLM status"
- "List AnythingLLM workspaces"

**Soundwave (TTS/Video):**
- "Generate speech with Jenny: Hello world"
- "Paste YouTube link https://... into video editor"

## How It Works — Zero Token Optimization

From upgraderguy777/jarvis-plugins philosophy:

- **Zero Tokens**: notification_reader uses Windows Runtime API (WinRT) — no LLM call, pure OS API. screen_recorder uses OpenCV + mss — no vision. discord_messenger Tier 1 uses saved aliases deep links + Tier 2 accessibility tree via pywinauto — zero search.
- **Low Tokens**: screenshot_annotate 2-pass — downscale 1400px rough coordinate, micro-crop pinpoint — saves token bandwidth vs full-res vision.
- **Ultra-Low**: magi_system uses gemini-2.5-flash-lite — cheapest tier, early consensus exit in max mode.
- **Local Fallbacks**: All PC control uses pyautogui, pygetwindow, pycaw, psutil, etc. — no API needed. Only translate/summarize/explain use Gemini, and even those have local fallbacks (first 3 sentences, trim, etc.).
- **Accessibility Tree**: ONEPUNCHMAN411/Jarvis uses Windows UI Automation accessibility tree instead of pixel coordinates — LLMs can't see screen, need structured data. pywinauto reads Discord sidebar directly.

## Architecture — Why JARVIS is Now Impeccable

**Before:**
- Mark LIII had 19 bundled actions: web_search, screen_processor, computer_settings (56 actions), computer_control, file_controller, etc.
- Good but not exhaustive — missing advanced file ops, window transparency, virtual desktops, clipboard history, macros, network scanner, etc.

**After PC Mastery Suite:**
- **pc_master**: 50+ actions in one file — master control like computer_settings but more (adds multi-monitor, night light, dark mode, file search, process, clipboard, screenshot, network, startup)
- **file_commander**: Dedicated file manager — organize, batch rename with {n}/{date}, duplicates MD5, disk usage, largest/oldest, tree, stats — inspired by file_manager_plugin, file_organizer, batch_renamer
- **window_manager_pro**: Dedicated window manager — always on top via Win32 SetWindowPos, transparency via SetLayeredWindowAttributes, virtual desktops via Win+Ctrl+D, multi-monitor via screeninfo, cascade/tile
- **process_commander**: Dedicated process manager — priority, affinity, monitor, tree — inspired by process_watcher
- **clipboard_master**: Clipboard history auto-tracked to ~/.jarvis_clipboard_history.json, pin, search, save/load, translate/summarize via Gemini Lite with local fallbacks
- **automation_master**: Macro recorder via pynput (keyboard.Listener, mouse.Listener), playback via pyautogui with timing, workflow JSON templates, schedule via OS scheduler pattern
- **browser_master**: Browser automation via Playwright (real browser, not scraping wrapper) — exact code for JARVIS, plus bookmarks parsing from Chrome Bookmarks JSON, download via requests
- **system_monitor_pro**: Enhanced monitoring — per-core CPU, frequency, load avg, swap, disk partitions IO, GPU via GPUtil/nvidia-smi, network IO, battery, temperature, alerts for high CPU/low disk/low battery
- **app_launcher_pro**: Intelligent launcher — per-OS map, recent 20, frequent count, pin/unpin favorites, search, kill — tracks to ~/.jarvis_recent_apps.json
- **screen_master**: Screen control — mss screenshot, window capture via pygetwindow + mss, annotate via Gemini vision 2-pass, OCR via pytesseract, delegates recording to screen_recorder
- **network_commander**: Network control — local IP via socket, public IP via ipify, WiFi list via netsh/nmcli/airport, connect with XML profile on Windows, speedtest via speedtest-cli, scan via nmap/arp, ping/traceroute/dns/hosts/firewall
- **Community 5**: notification_reader (WinRT), screen_recorder (OpenCV + mss + ffmpeg audio muxing), screenshot_annotate (2-pass), discord_messenger (3-tier zero-token), magi_system (3 personas debate)
- **anything_llm_bridge**: Delegates non-PC to AnythingLLM API — status, chat, list_workspaces, list_docs — config via env or api_keys.json

**Result: JARVIS can now:**
- Control every PC setting by voice
- Manage files like a pro (search, organize, batch rename, dedup, disk usage)
- Manage windows impeccably (snap, always on top, transparency, virtual desktops, multi-monitor)
- Manage processes (list, kill, start, priority, monitor)
- Clipboard intelligence (history, translate, summarize)
- Automate anything (record/play macros, workflows, hotkeys)
- Control browser via Playwright (real automation)
- Monitor system proactively (alerts for high CPU, low disk, low battery)
- Launch apps intelligently (recent, frequent, pinned)
- Screen mastery (screenshot, annotate where button is, OCR, record)
- Network mastery (WiFi, IP, speedtest, scan)
- Read notifications (Discord, Slack, etc. without violating ToS)
- Discord messaging hands-free
- MAGI deliberation for complex decisions
- Delegate non-PC to AnythingLLM, focus on PC

All free & open source, MIT, no subscriptions.

## Related

- Mark LIII: https://github.com/FatihMakes/Mark-LIII
- Community plugins: https://github.com/upgraderguy777/jarvis-plugins (MIT, 5 plugins, zero-token optimized)
- ONEPUNCHMAN411/Jarvis: https://github.com/ONEPUNCHMAN411/Jarvis (50+ tools, accessibility tree, Playwright, pywinauto)
- AnythingLLM: https://anythingllm.com (open source RAG, Docker)
- This repo's Soundwave AI: TTS + video studio, 6 Neural voices, FFmpeg export

## Troubleshooting

- `pycaw not installed`: pip install pycaw comtypes (Windows volume)
- `pygetwindow not installed`: pip install pygetwindow (window management)
- `psutil not installed`: pip install psutil (process, system monitor)
- `mss not installed`: pip install mss (screenshots)
- `pyautogui not installed`: pip install pyautogui (mouse/keyboard)
- `pynput not installed`: pip install pynput (macro recording)
- `playwright not found`: pip install playwright && playwright install chromium
- `winsdk not found`: notification_reader auto-installs via pip on first run, or pip install winsdk
- `pytesseract not found`: pip install pytesseract and install Tesseract binary
- `GPUtil not found`: pip install GPUtil (GPU monitoring)
- `speedtest not installed`: pip install speedtest-cli
- AnythingLLM not reachable: docker run -p 3001:3001 mintplexlabs/anythingllm, check ANYTHING_LLM_API_URL

---

**JARVIS + PC Mastery + AnythingLLM = Impeccable PC Assistant + Knowledge Base**

JARVIS now controls your PC impeccably via 50+ local actions (zero tokens), while AnythingLLM handles docs/RAG. No more switching between tools.
