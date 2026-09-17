# Full Guide — From ZIP `arena/01a0a795-soundwave-ai` to Running JARVIS Mark LIV (54) with 45 Plugins

**You downloaded:** `Soundwave-AI-arena-01a0a795-soundwave-ai.zip` from branch `arena/01a0a795-soundwave-ai`
**Goal:** Run Mark LIV with holographic head + lip-sync + 45 PC Mastery plugins (0 rejected)
**OS:** Windows 10/11 (your path `C:\Users\Strahinja\Downloads\...`), works also macOS/Linux
**Time:** ~10 minutes

---

## 0. What’s Inside This ZIP?

You are on `arena/01a0a795-soundwave-ai` branch — it contains:

- `Mark-LIV/` — **Mark LIV (54) newest** from FatihMakes/Mark-LIV, with **45 plugins pre-installed** (48 files: 45 + `_soundwave_client.py` + `_template.py` + `__init__.py`). Ready to run.
- `mark-liii-plugins/` — source of 45 plugins (46 files) + README, for copying to fresh Mark installs.
- `docs/PC_MASTERY.md` — 500+ line PC Mastery guide (voice commands, troubleshooting).
- `docs/MARK_LIV_MIGRATION.md` — LIII → LIV transfer proof, compatibility 100%.
- `frontend/` + `server/` — Soundwave AI TTS + video studio (separate, optional).
- No `Mark-LIII/` in this branch (jarvis branch has both LIII + LIV). Arena branch focuses on LIV.

**If you want both LIII + LIV:** download `jarvis` branch ZIP `https://github.com/Str4hinj47/Soundwave-AI/archive/refs/heads/jarvis.zip` — it has `Mark-LIII/` and `Mark-LIV/` each 48 files. Steps below identical, just pick folder.

---

## 1. Download

1. Go to: `https://github.com/Str4hinj47/Soundwave-AI/tree/arena/01a0a795-soundwave-ai`
2. Click **Code → Download ZIP** or direct: `https://github.com/Str4hinj47/Soundwave-AI/archive/refs/heads/arena/01a0a795-soundwave-ai.zip`
3. Save to `C:\Users\Strahinja\Downloads\`

You will have `Soundwave-AI-arena-01a0a795-soundwave-ai.zip` (~50-80 MB).

---

## 2. Extract — IMPORTANT: Real Folder Name

GitHub ZIP extracts as `Soundwave-AI-arena-01a0a795-soundwave-ai`, **NOT** `Soundwave-AI`. This was your earlier bug (`Count:2` because path `C:\Users\Strahinja\Soundwave-AI\mark-liii-plugins` does not exist).

**PowerShell (recommended):**
```powershell
cd $HOME\Downloads
# Remove old if exists
Remove-Item -Recurse -Force Soundwave-AI-arena-01a0a795-soundwave-ai -ErrorAction SilentlyContinue
Expand-Archive -Path Soundwave-AI-arena-01a0a795-soundwave-ai.zip -DestinationPath . -Force
dir Soundwave-AI-arena-01a0a795-soundwave-ai
```

**File Explorer:** Right-click ZIP → Extract All → `C:\Users\Strahinja\Downloads\Soundwave-AI-arena-01a0a795-soundwave-ai\`

Result:
```
C:\Users\Strahinja\Downloads\Soundwave-AI-arena-01a0a795-soundwave-ai\
  Mark-LIV\
    plugins\  <- 48 files, 45 active
    core\
    actions\
    main.py
    ui.py
    requirements.txt
  mark-liii-plugins\  <- 46 files source
  docs\
  frontend\
  server\
```

---

## 3. Prerequisites

### Python
Mark LIV needs **Python 3.11, 3.12 or 3.13** (not 3.14).

Check:
```powershell
python --version
# or
py --version
```

If not installed: https://www.python.org/downloads/ → install, **check "Add python to PATH"**.

### Git (optional)
Only if you want to clone instead of ZIP.

### Gemini API Key (free)
1. Go to https://aistudio.google.com/app/apikey
2. Create API key
3. Copy — you will paste on first launch. Stored in `Mark-LIV/config/api_keys.json` (git-ignored, plaintext).

---

## 4. Install Mark LIV Base Dependencies

**PowerShell, inside Mark-LIV folder:**

```powershell
cd C:\Users\Strahinja\Downloads\Soundwave-AI-arena-01a0a795-soundwave-ai\Mark-LIV

# Option A: OS-aware installer (recommended)
python setup.py
# It skips wrong-OS deps, checks Python version, installs browser engine

# Option B: manual
pip install -r requirements.txt
```

`requirements.txt` includes:
- PyQt6 (HUD + holographic head QPainter, no GPU)
- sounddevice, numpy (face posing)
- google-genai (Gemini Live)
- requests, beautifulsoup4, playwright (web search, browser)
- pyautogui, pyperclip, pygetwindow (automation)
- pillow, opencv-python (vision)

If `ModuleNotFoundError` for OS-specific package:
```powershell
pip install <module_name>
```

**Wake word engine** (optional, "Hey Jarvis" local): not installed via setup.py, get inside app: ⚙ → WAKE WORD → one-click download `openwakeword` (few MB, fully local).

---

## 5. Install 45 PC Mastery Plugins Dependencies (Makes JARVIS Impeccable)

Base Mark LIV works without these, but 45 plugins need them for zero-token OS APIs. All free, MIT.

**One command (copy-paste):**
```powershell
pip install pyautogui pygetwindow pycaw comtypes psutil screen-brightness-control mss Pillow pyperclip pynput screeninfo GPUtil requests speedtest-cli opencv-python sounddevice winsdk pywinauto pytesseract
pip install playwright
playwright install chromium
```

Breakdown:
- `pycaw comtypes` — volume, per-app audio, device switching
- `pygetwindow pyautogui screeninfo` — window management, snap, always-on-top, multi-monitor
- `psutil GPUtil` — CPU/RAM/disk/battery/GPU, power plans
- `screen-brightness-control` — brightness
- `mss Pillow` — thread-safe screenshot, DPI awareness
- `pyperclip` — clipboard history
- `pynput` — macro recording
- `screeninfo` — monitor info
- `requests speedtest-cli` — network, IP, speedtest
- `opencv-python` — screen recorder
- `sounddevice` — audio device measurement
- `winsdk` — Windows notifications (auto-installs on first use via notification_reader)
- `pywinauto comtypes` — accessibility tree (zero tokens vision)
- `pytesseract` — OCR fallback (needs Tesseract binary https://github.com/UB-Mannheim/tesseract/wiki)
- `playwright` — real browser automation

All plugins degrade gracefully if missing — they log "not installed" and continue.

**Verify plugins compile:**
```powershell
python -m py_compile plugins\*.py
# Should print nothing = ok
dir plugins\*.py | Measure-Object
# Should be Count: 48
```

Expected 48:
- 45 plugins (11 core + 5 community + 5 vision fix + 5 input/workspace + 5 intelligence + 5 file/system deep + 8 Soundwave + 1 bridge)
- `_soundwave_client.py` (helper, not plugin, starts with _)
- `_template.py` (template)
- `__init__.py`

---

## 6. First Launch — Configure JARVIS

```powershell
cd C:\Users\Strahinja\Downloads\Soundwave-AI-arena-01a0a795-soundwave-ai\Mark-LIV
python main.py
```

First run:

1. **API Key prompt:** Paste Gemini API key from aistudio.google.com → saves to `config/api_keys.json`
2. **Console boot transcript:** You should see:
   ```
   Action loaded: web_search, screen_processor, computer_settings (56 actions), ...
   Plugin loaded: pc_master (pc_master.py)
   Plugin loaded: file_commander (file_commander.py)
   Plugin loaded: window_manager_pro
   Plugin loaded: process_commander
   Plugin loaded: clipboard_master
   Plugin loaded: automation_master
   Plugin loaded: browser_master
   Plugin loaded: system_monitor_pro
   Plugin loaded: app_launcher_pro
   Plugin loaded: screen_master
   Plugin loaded: network_commander
   Plugin loaded: notification_reader
   Plugin loaded: screen_recorder
   Plugin loaded: screenshot_annotate
   Plugin loaded: discord_messenger
   Plugin loaded: magi_system
   Plugin loaded: accessibility_master
   Plugin loaded: screen_pro
   Plugin loaded: screen_reader_pro
   Plugin loaded: region_watcher_pro
   Plugin loaded: vision_bridge
   Plugin loaded: keyboard_master_pro
   Plugin loaded: mouse_master_pro
   Plugin loaded: workspace_master
   Plugin loaded: ocr_master_pro
   Plugin loaded: file_watcher_pro
   Plugin loaded: action_logger
   Plugin loaded: error_recovery
   Plugin loaded: workflow_engine
   Plugin loaded: self_learner
   Plugin loaded: proactive_assistant
   Plugin loaded: file_organizer_pro
   Plugin loaded: batch_renamer_pro
   Plugin loaded: system_services_pro
   Plugin loaded: audio_device_pro
   Plugin loaded: power_manager_pro
   Plugin loaded: soundwave_tts
   Plugin loaded: soundwave_voices
   Plugin loaded: soundwave_studio
   Plugin loaded: soundwave_projects
   Plugin loaded: soundwave_video
   Plugin loaded: soundwave_clone
   Plugin loaded: soundwave_youtube
   Plugin loaded: soundwave_youtube_paste
   Plugin loaded: anything_llm_bridge
   ```
   **45 active, 0 rejected** — same as your screenshot for LIII.

3. **HUD appears:** 
   - Center: holographic head (real measured human geometry, 25KB face_model.obj, QPainter software, no GPU)
   - It breathes, blinks, brows ride phrase, eyes saccade
   - Waveform pulses to your mic / JARVIS voice
   - Activity log below (amber → follows theme in LIV)

4. **Audio device picker (FIX for "JARVIS can't hear me"):** 
   - Click ⚙ → 🎧 AUDIO DEVICES
   - Before fix: 41 entries (same mic × MME/DirectSound/WASAPI/WDM-KS)
   - After fix: 8 entries (filtered, measured)
   - Pick mic by name (not webcam), speakers by name
   - Stored by name not index, falls back to default if gone

---

## 7. Test Voice Commands — 45 Plugins

**System:**
- "Set volume to 50"
- "Set brightness to 80"
- "System status" / "CPU usage" / "Battery status" / "Battery health"
- "Power plans list" / "Set power plan to performance"
- "Uptime"

**File & System Deep (Phase 4 NEW):**
- "Organize my Downloads by type" → `file_organizer_pro` → Images/Videos/Audio/Docs/Sheets/Presentations/Archives/Code/Executables/Others
- "Organize photos by EXIF date" → year/month via Pillow EXIF
- "Find duplicates in Downloads" → hash/content/size
- "Batch rename files in Pictures to IMG_{n}" / "Rename with pattern {exif_date}_{n}"
- "Regex rename IMG_(\d+) to Photo_$1"
- "List services" / "Start service spooler" / "Status service wuauserv"
- "List startup apps" / "Add startup app MyApp path C:\..."
- "Get registry key HKCU\Software\Microsoft\Windows\CurrentVersion\Run value MyApp"
- "List audio devices" / "Set app volume chrome 50" / "Switch output to headphones"
- "Mic mute" / "List audio sessions"

**Window/Process/Clipboard/Screen/Network (Core 11):**
- "List open windows" / "Snap Chrome to left" / "Make YouTube always on top"
- "List processes" / "Top processes" / "Kill Chrome"
- "Clipboard history" / "Translate clipboard to Serbian"
- "Take screenshot" / "Where is the export button" → orange rings
- "Network status" / "List WiFi networks" / "Speed test"

**Vision Fix (Phase 1):**
- "Find File menu" → accessibility tree first (zero tokens), vision second (1400px downscale + Gemini 2-pass)
- Tree gives name/type/value/bounds x,y,w,h/enabled via pywinauto UIA

**Input & Workspace (Phase 2):**
- "Type hello with humanize" / "Press ctrl+shift+t"
- "Move mouse to 100,200 with easing"
- "Save workspace myproject" / "Restore workspace myproject"
- "OCR this region" / "Find text Submit on screen"

**Intelligence (Phase 3):**
- "Log my actions" / "Show failures"
- "Create workflow morning_routine steps..." / "Run workflow morning_routine"
- "Learn fact my project is Soundwave AI"
- "Check proactive" → battery low, disk full, large files

**Mark LIV Exclusive:**
- Toggle HUD: ⚙ → HUD → head vs reactor core
- Push-to-talk: ⚙ → PUSH-TO-TALK → hold Ctrl+Space (global on Windows, window-scoped elsewhere)
- Face as status: looks away thinking, meets eyes listening, lids fall asleep, glances down at new content
- Self-echo guard: never answers own tail (mic not muted, band energies subtracted using device latency)
- Runtime self-knowledge: rename it in UI → knows instantly, add plugin → knows gained ability

---

## 8. Optional — Run Soundwave AI Studio (TTS + Video)

Arena branch also contains Soundwave AI (your original project).

```powershell
cd C:\Users\Strahinja\Downloads\Soundwave-AI-arena-01a0a795-soundwave-ai

# Backend
cd server
npm install
# Set env: copy .env.example to .env, set DATABASE_URL, JWT_SECRET
npm run dev  # runs on http://localhost:4000

# Frontend (new terminal)
cd ..\frontend
npm install
npm run dev  # runs on http://localhost:5173

# Open http://localhost:5173/jarvis — JARVIS Expert UI that knows Mark LIII/LIV inside-out + plugin generator
```

JARVIS plugins `soundwave_*` can call Soundwave API via `_soundwave_client.py` (Edge TTS direct if no server).

---

## 9. Troubleshooting

**Count:2 instead of 45:**
- Cause: wrong path `C:\Users\Strahinja\Soundwave-AI\mark-liii-plugins` (does not exist). ZIP extracts as `Soundwave-AI-arena-01a0a795-soundwave-ai` or `Soundwave-AI-jarvis` or `Soundwave-AI-main`.
- Fix: use actual path:
  ```powershell
  dir C:\Users\Strahinja\Downloads\Soundwave-AI-arena-01a0a795-soundwave-ai\Mark-LIV\plugins\*.py | Measure-Object
  # Should be 48
  ```

**Plugins rejected:**
- Check console for `Plugin ... failed: ...`
- Most common: missing dep → `pip install <dep>` from step 5
- All plugins have graceful fallback, should still load

**JARVIS can't hear me:**
- ⚙ → 🎧 AUDIO DEVICES → pick mic by name, not "Primary Sound Driver" or webcam
- Before fix 41 entries, after fix 8 entries (your screenshot shows filter working)

**ModuleNotFoundError winsdk / pycaw etc.:**
- Run step 5 one-command install
- notification_reader auto-installs winsdk on first run

**Python not found:**
- Install Python 3.11/3.12/3.13, check "Add to PATH", restart PowerShell

**API key invalid:**
- Regenerate at https://aistudio.google.com/app/apikey, paste in `Mark-LIV/config/api_keys.json` → `gemini_api_key`

**HUD not showing head:**
- ⚙ → HUD → toggle head vs reactor core
- Head needs PyQt6 + numpy (already in requirements.txt), no GPU needed

**Want both LIII and LIV:**
- Download jarvis branch ZIP: `https://github.com/Str4hinj47/Soundwave-AI/archive/refs/heads/jarvis.zip`
- Extract, you get `Mark-LIII\` and `Mark-LIV\` each 48 files
- Both share same config, same 45 plugins, same `config/api_keys.json`

---

## 10. What You Have Now

- **Mark LIV (54):** holographic head, real lip-sync ~50 shapes/sec (formants + transcript m/b/p closure), language-free (Turkish/English/German/French/Spanish/Polish/Vietnamese/Czech/Russian/Ukrainian/Greek same rules), facial acting brows/saccades/blinks/nod, face as status, push-to-talk Ctrl+Space global Windows, self-echo guard, runtime self-knowledge, instant acknowledgment, Gemini 3.1 Flash Live 2x faster, recallable memory unlimited, undo, real confirmation, audio picker 41→8, session continuity.
- **45 plugins:** 11 core + 5 community (MIT zero-token) + 5 vision fix (accessibility tree first) + 5 input/workspace + 5 intelligence/self-healing + 5 file/system deep + 8 Soundwave + 1 bridge — zero tokens for most, free & open source.
- **Ready to:** control PC impeccably by voice, organize files by EXIF/content/size/project, batch rename regex/EXIF, manage services/startup/registry/env, per-app audio, battery health/power plans, save/restore workspaces, OCR multi-engine, file watcher auto-organize, action logger, error recovery retry/fallback, workflows, self-learner corrections, proactive suggestions.

**Next:** Say "Hey Jarvis" or hold Ctrl+Space, then "System status" or "Organize my Downloads".

---

## Quick Reference — Exact Commands for Your PC

```powershell
# 1. Download & Extract
cd $HOME\Downloads
Expand-Archive -Path Soundwave-AI-arena-01a0a795-soundwave-ai.zip -DestinationPath . -Force
cd Soundwave-AI-arena-01a0a795-soundwave-ai\Mark-LIV

# 2. Install
python setup.py
pip install pyautogui pygetwindow pycaw comtypes psutil screen-brightness-control mss Pillow pyperclip pynput screeninfo GPUtil requests speedtest-cli opencv-python sounddevice winsdk pywinauto pytesseract
pip install playwright; playwright install chromium

# 3. Verify
python -m py_compile plugins\*.py
dir plugins\*.py | Measure-Object  # Count: 48

# 4. Run
python main.py
# Paste Gemini API key on first launch, check logs: 45 active 0 rejected, JARVIS online, head visible

# 5. Test
# Say: "Set volume to 50" / "Organize my Downloads" / "List services" / "Battery health"
```

Enjoy — you now have Mark LIV with full PC Mastery, same as your verified 45 active screenshot but with holographic head.
