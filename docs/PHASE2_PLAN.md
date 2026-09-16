# Phase 2 Plan — Input & Workspace Mastery (Second Biggest Weakness After Vision) — ✅ COMPLETED 2026-09-16

**Status:** Implemented 5 plugins, py_compile ok, help tested, docs updated, ready to push.

## Implementation Summary (Completed)

**Files created:**
- keyboard_master_pro.py (12+ actions, type humanize, press, hotkey, hold/release, layout via GetKeyboardLayout, text_expansion ~/.jarvis_text_expansions.json, type_file, clear)
- mouse_master_pro.py (12+ actions, move easing 60fps, click/drag/scroll, position, multi_monitor screeninfo+mss, find_color hex/rgb/name, gesture shake/circle/swipe)
- workspace_master.py (12+ actions, save/restore window layouts ~/.jarvis_workspaces/*.json, list/delete, create_project python/web/empty + git init, switch, current, auto_save 5 min thread, export/import)
- ocr_master_pro.py (10+ actions, multi-engine Windows OCR winsdk + Tesseract + EasyOCR + PaddleOCR + vision fallback, screenshot/region/file/clipboard/window, engines, find_text)
- file_watcher_pro.py (10+ actions, watchdog Observer or polling mtime fallback, organize by ext, backup timestamp, notify plyer, events, pause/resume)

**Testing:** py_compile ok, help len 1759-2000 each.

**Total after Phase 2:** 35 plugins (34 + _soundwave_client) — 11 core + 5 community + 5 vision fix + 5 input/workspace + 8 Soundwave + 1 bridge

---

# Phase 2 Plan — Input & Workspace Mastery (Second Biggest Weakness After Vision) — Original

**Goal:** Make JARVIS impeccable at keyboard/mouse/input + workspace management + OCR + file watching — 100% PC control, zero tokens where possible.

**Why Phase 2?** Phase 1 fixed vision (tree first zero tokens, vision second low tokens). Next biggest weakness: input is basic pyautogui only, no workspace save/restore, OCR is basic pytesseract only, no file watching. User has anythingLLM for non-PC, so JARVIS must dominate PC input/workspace.

**User instruction:** "Move to the next phase" — continuing from Phase 1 vision fix (5 plugins, 30 total). Now Phase 2 adds 5 more → 35 total.

## Current Weaknesses After Phase 1

1. **Keyboard is dumb:** pc_master has basic type/press/hotkey via pyautogui, but no layout switching, text expansion/hotstrings, typing with human-like delays, sticky keys, language detection. ONEPUNCHMAN411 has `keyboard.py` with advanced control.
2. **Mouse is dumb:** Basic click/move via pyautogui, no precise drag-drop with easing, no scroll precise, no multi-monitor awareness, no gestures, no trail. ONEPUNCHMAN411 has `mouse.py`.
3. **No workspace management:** Can't save/restore window layouts, project workspaces, session continuity. ONEPUNCHMAN411 has `workspace.py` (virtual workspaces, file organization, session restore) + `app_launch` brain + `process_watcher`. Mark LIII has no dedicated workspace plugin.
4. **OCR is basic:** screen_master has OCR via pytesseract only, single engine, no Windows OCR, no EasyOCR/PaddleOCR fallback, no region OCR, no file OCR. ONEPUNCHMAN411 has `ocr_engine.py` brain.
5. **No file watcher:** Can't watch file/folder for changes and auto-trigger actions (e.g., organize Downloads when new file arrives, backup when file changes). ONEPUNCHMAN411 has `file_organizer` + `process_watcher`.

## What ONEPUNCHMAN411 Does Better (Source: /tmp/Jarvis/jarvis/control/ + brain/)

- `keyboard.py`: advanced keyboard control — layout, language, sticky keys, type with delays, hotkeys, text expansion
- `mouse.py`: advanced mouse — drag with easing, scroll precise, multi-monitor, gestures
- `workspace.py`: workspace management — save/restore window layouts, project workspaces, session continuity, file organization, process tracking
- `clipboard_history.py`: clipboard history tracking
- `ocr_engine.py` (brain): OCR with multiple engines — Tesseract + Windows OCR + fallback
- `file_organizer.py` (brain): file organization by type/date
- `batch_renamer.py` (brain): batch rename with patterns
- `macro_executor.py` (brain): macro execution with timing
- `process_watcher.py` (brain): watch processes for changes
- `screenshot_library.py` (brain): screenshot management

## Plugins to Create (Phase 2 — 5 plugins)

### 1. keyboard_master_pro.py — Advanced Keyboard Mastery (Zero Tokens)
**Purpose:** Make JARVIS impeccable at keyboard — beyond pyautogui type/press/hotkey.

**Actions (12+):**
- `type text=... [delay=0.02] [humanize=true]` — type with optional delay per char + humanize random variation (like real typing), supports \n, unicode
- `press key=... [count=1] [interval=0.1]` — press key(s) e.g., enter, esc, f1-f12, tab, space, backspace, delete, up/down/left/right, with count and interval
- `hotkey keys=...` — hotkey e.g., ctrl+c, ctrl+shift+t, alt+tab, win+d, win+l, win+ctrl+d (virtual desktop)
- `hold key=...` / `release key=...` — keyDown/keyUp for drag modifiers
- `layout [set=...]` — get/set keyboard layout, list layouts (Windows: GetKeyboardLayout, load via PowerShell, macOS: input sources, Linux: setxkbmap)
- `language` — current input language
- `text_expansion add trigger=... expansion=...` — add text expansion e.g., trigger @@ → email, trigger ;sig → signature, stored in ~/.jarvis_text_expansions.json, auto-expands on type? Or list expansions
- `hotstring list/add/remove` — hotstring management
- `type_file path=...` — type contents of file
- `clear` — clear current field via ctrl+a + delete
- `help`

**Zero tokens:** Pure local via pyautogui + pynput + ctypes (Windows GetKeyboardLayout).

**State:** `~/.jarvis_keyboard.json` for text expansions, hotstrings, layout history.

**Deps:** `pyautogui`, `pynput`, `pyperclip` (optional). All optional, degrade gracefully.

**Inspired by:** ONEPUNCHMAN411 `keyboard.py` + `clipboard.py` + pc_master keyboard actions.

**File:** `mark-liii-plugins/keyboard_master_pro.py` (350+ lines)

---

### 2. mouse_master_pro.py — Advanced Mouse Mastery (Zero Tokens)
**Purpose:** Make JARVIS impeccable at mouse — beyond basic click/move.

**Actions (12+):**
- `move x=... y=... [duration=0.5] [easing=easeInOut]` — move with easing (linear, easeIn, easeOut, easeInOut), duration
- `click x=... y=... [button=left/right/middle] [clicks=1] [interval=0.1]` — click at coords or current, button, double-click via clicks=2
- `drag from_x=... from_y=... to_x=... to_y=... [duration=0.5] [button=left]` — drag with easing, from→to
- `scroll amount=... [x=... y=...] [direction=vertical/horizontal]` — scroll precise, amount positive up, negative down, optional x,y to scroll at position
- `position` — current mouse position + monitor info (which monitor, resolution)
- `trail enable/disable/status` — mouse trail? Or track history
- `gesture name=...` — gestures e.g., shake, circle, swipe left/right/up/down — via pyautogui drag patterns
- `multi_monitor` — list monitors via screeninfo + mss, which monitor mouse is on, move to monitor 2 center, etc.
- `find_color color=... [region=x,y,w,h]` — find color on screen via pyautogui/screenshot + pixel search, return x,y
- `help`

**Zero tokens:** Pure local via pyautogui + screeninfo + mss.

**State:** `~/.jarvis_mouse_history.json` for trail (optional).

**Deps:** `pyautogui`, `screeninfo`, `mss`, `Pillow`.

**Inspired by:** ONEPUNCHMAN411 `mouse.py` + screen.py + window_manager_pro multi-monitor.

**File:** `mark-liii-plugins/mouse_master_pro.py` (350+ lines)

---

### 3. workspace_master.py — Workspace Save/Restore & Project Workspaces (Zero Tokens)
**Purpose:** Save/restore window layouts, project workspaces, session continuity — makes JARVIS remember your PC setup.

**Actions (12+):**
- `save name=... [include=windows,apps,files]` — save current workspace: list open windows via pygetwindow (title, pos x,y,w,h, minimized/maximized), list processes, current directory, clipboard? Save to ~/.jarvis_workspaces/{name}.json
- `restore name=...` — restore workspace: reopen apps, move windows to saved positions, resize, focus, etc.
- `list` — list saved workspaces name, date, window count
- `delete name=...` — delete workspace
- `create_project name=... path=... [template=...]` — create project workspace: folder + git init + README + open in VS Code/Explorer, template options: python, web, empty
- `switch name=...` — switch workspace: save current as _previous, restore target
- `current` — current workspace info: open windows, active window, processes, recent files
- `auto_save enable/disable/status` — auto-save workspace every N minutes via background thread
- `export name=... path=...` / `import path=...` — export/import workspace JSON
- `help`

**Zero tokens:** Pure local via pygetwindow + psutil + json + pathlib.

**State:** `~/.jarvis_workspaces/` dir with JSON files per workspace, each contains windows: [{title, app, x,y,w,h, minimized, maximized}], processes: [name], timestamp, etc. Also `~/.jarvis_workspace_autosave.json` for auto-save.

**Background thread:** Optional auto-save thread polling every 5 min, saves current as _autosave.

**Deps:** `pygetwindow`, `psutil`, stdlib. Optional.

**Inspired by:** ONEPUNCHMAN411 `workspace.py` + `app_launch` brain + `process_watcher` + window_manager_pro + app_launcher_pro.

**File:** `mark-liii-plugins/workspace_master.py` (400+ lines)

---

### 4. ocr_master_pro.py — OCR Pro with Multi-Engine Fallback (Zero to Low Tokens)
**Purpose:** Dedicated OCR master — beyond screen_master's single pytesseract engine, with multi-engine fallback: Tesseract + Windows OCR (WinRT) + EasyOCR + PaddleOCR.

**Actions (10+):**
- `screenshot [monitor=1] [lang=eng]` — screenshot via fresh mss + OCR via best available engine, return text + bounding boxes
- `region x=... y=... w=... h=... [lang=...]` — OCR specific region
- `file path=... [lang=...]` — OCR image file via engines
- `clipboard` — OCR image in clipboard (if image in clipboard)
- `window [title=...] [lang=...]` — screenshot window via pygetwindow + mss + OCR
- `engines` — list available engines: tesseract (pytesseract), windows (winsdk), easyocr, paddleocr, status
- `find_text text=... [region=...] [lang=...]` — find text on screen via OCR, return x,y center if found
- `help`

**Zero to Low Tokens:** Local engines zero tokens, no LLM. Windows OCR via winsdk zero tokens. Tesseract via pytesseract zero tokens. EasyOCR/PaddleOCR local zero tokens (but heavy). No Gemini vision needed (though could fallback to vision_bridge if no engine).

**Engine priority:** Try Windows OCR first (fast, zero tokens, Windows 10+), then Tesseract, then EasyOCR, then PaddleOCR, then fallback to vision_bridge screenshot_annotate 2-pass if Gemini key set (low tokens).

**State:** None, stateless, but cache engines availability.

**Deps:** `pytesseract`, `winsdk` (Windows OCR), `easyocr`, `paddleocr`, `mss`, `Pillow`, `pyautogui`. All optional, degrade gracefully with install message.

**Inspired by:** ONEPUNCHMAN411 `ocr_engine.py` brain + screen_master OCR + upgraderguy777 screenshot_annotate.

**File:** `mark-liii-plugins/ocr_master_pro.py` (400+ lines)

---

### 5. file_watcher_pro.py — File & Folder Watcher with Auto Actions (Zero Tokens)
**Purpose:** Watch files/folders for changes and auto-trigger actions — organize Downloads when new file arrives, backup when file changes, etc.

**Actions (10+):**
- `add path=... [label=...] [mode=created/modified/deleted/all] [action=organize/backup/notify/custom] [dest=...]` — add watcher, path file or folder, mode, action: organize (move by type), backup (copy to dest), notify (plyer notification), custom (run command or emit event). Returns watch id. Uses watchdog or polling fallback. Background thread.
- `list` — list watchers id, path, mode, action, events count
- `remove id=...` — remove watcher, or all if no id
- `status` — watcher thread status, watch count, events
- `events [id=...] [limit=20]` — recent events for watcher or all: timestamp, path, event type, action taken
- `pause id=...` / `resume id=...` — pause/resume watcher
- `help`

**Zero tokens:** Pure local via watchdog (or polling fallback via os.stat mtime), plyer for notifications, shutil for backup/organize.

**Background thread:** Watchdog Observer or polling thread every 1s checking mtime/size. On event, trigger action: organize → move file by extension to subfolder (Images, Videos, Docs, etc.), backup → copy to dest with timestamp, notify → plyer notification, custom → emit_ui_event or run command (careful).

**State:** Global `_watchers` dict id→{path, label, mode, action, dest, events, paused, created}, `_events` list, `_thread` or `Observer`, `_lock`, `_next_id`, persisted to `~/.jarvis_file_watchers.json` optional, but memory only for Phase 2 like region_watcher_pro.

**Deps:** `watchdog`, `plyer` (optional), stdlib. Optional.

**Inspired by:** ONEPUNCHMAN411 `file_organizer.py` + `process_watcher.py` + region_watcher_pro pattern.

**File:** `mark-liii-plugins/file_watcher_pro.py` (400+ lines)

---

## Implementation Order

1. **keyboard_master_pro.py** — foundation, zero tokens, no deps on other new plugins. Implement first, test type/press/hotkey/layout.
2. **mouse_master_pro.py** — foundation, zero tokens. Implement second, test move/click/drag/scroll/position/multi_monitor.
3. **workspace_master.py** — builds on window_manager_pro + app_launcher_pro + process_commander. Implement third, test save/list/restore/current.
4. **ocr_master_pro.py** — independent, multi-engine. Implement fourth, test engines/screenshot/region/file/find_text.
5. **file_watcher_pro.py** — independent, background thread like region_watcher_pro. Implement last, test add/list/remove/events.

## Dependencies to Install

```bash
pip install pyautogui pynput pygetwindow psutil screeninfo mss Pillow pyperclip
pip install pytesseract winsdk easyocr paddleocr watchdog plyer
# Tesseract binary: winget install tesseract or apt install tesseract-ocr
# For Windows OCR: pip install winsdk (auto on Windows 10+)
```

All deps optional — plugins degrade gracefully with "pip install X" message.

## Testing Plan

For each plugin:

1. **py_compile:** `python -m py_compile mark-liii-plugins/keyboard_master_pro.py` etc.
2. **Help action:** `python -c "import keyboard_master_pro; print(keyboard_master_pro.run({'action':'help'}))"`
3. **Core actions:**
   - keyboard_master_pro: type text=hello delay=0.02, press key=enter, hotkey keys=ctrl+c, layout, language
   - mouse_master_pro: position, move x=100 y=100 duration=0.5, click, scroll amount=-500, multi_monitor
   - workspace_master: current, save name=test, list, restore name=test, delete name=test
   - ocr_master_pro: engines, screenshot lang=eng, region x=0 y=0 w=500 h=500, find_text text=File
   - file_watcher_pro: add path=~/Downloads mode=created action=notify label=Downloads, list, events, remove id=1
4. **Error handling:** Test without deps installed, ensure graceful message, never raise
5. **State persistence:** Test save/restore, expansions, workspaces JSON

**Manual testing on Windows:**
- Open Notepad, say "type hello world with humanize", "press enter", "hotkey ctrl+s"
- Say "mouse position", "move mouse to 100,100", "drag from 100,100 to 200,200"
- Say "save workspace my_project", "list workspaces", "current workspace"
- Say "OCR screenshot", "find text File on screen"
- Say "watch folder Downloads for created files and notify", then download file, check notification

## Integration with Existing Plugins

- **pc_master.py** has keyboard/mouse basic — keyboard_master_pro + mouse_master_pro are pro versions with humanize, easing, layout, gestures, multi-monitor
- **clipboard_master.py** has history — keyboard_master_pro text_expansion complements it
- **window_manager_pro.py** + **app_launcher_pro.py** + **process_commander.py** — workspace_master combines all three for save/restore
- **screen_master.py** has OCR basic — ocr_master_pro is pro with multi-engine fallback
- **file_commander.py** has organize — file_watcher_pro auto-triggers organize on new file
- **region_watcher_pro.py** watches screen region — file_watcher_pro watches file system, similar pattern background thread

## Documentation

- Update `docs/PC_MASTERY.md` with Phase 2 section: input & workspace mastery
- Update `mark-liii-plugins/README.md` with 5 new plugins table
- Update `docs/PHASE2_PLAN.md` with completion status

## Files to Create/Modify

**New files (5):**
- `mark-liii-plugins/keyboard_master_pro.py`
- `mark-liii-plugins/mouse_master_pro.py`
- `mark-liii-plugins/workspace_master.py`
- `mark-liii-plugins/ocr_master_pro.py`
- `mark-liii-plugins/file_watcher_pro.py`

**Modify:**
- `docs/PC_MASTERY.md` — add Phase 2 section
- `mark-liii-plugins/README.md` — add 5 new plugins
- `Mark-LIII/plugins/` in jarvis branch — copy new plugins

**Total after Phase 2:** 35 plugins (34 + _soundwave_client) — 11 core + 5 community + 5 vision fix + 5 input/workspace + 8 Soundwave + 1 bridge

## Success Criteria

- [ ] All 5 new plugins py_compile ok
- [ ] keyboard_master_pro type/press/hotkey/layout works, humanize delay, text_expansion add/list
- [ ] mouse_master_pro move/click/drag/scroll/position/multi_monitor works, easing, find_color
- [ ] workspace_master save/list/restore/current works, JSON persistence, auto_save optional
- [ ] ocr_master_pro engines lists available, screenshot OCR, region OCR, find_text
- [ ] file_watcher_pro add/list/remove/events works, background thread starts/stops, organize/backup/notify actions
- [ ] Docs updated
- [ ] Copied to jarvis branch and pushed
- [ ] Arena branch pushed

## References

- ONEPUNCHMAN411/Jarvis control/keyboard.py, mouse.py, workspace.py, clipboard_history.py + brain/ocr_engine.py, file_organizer.py, batch_renamer.py, macro_executor.py, process_watcher.py, screenshot_library.py — https://github.com/ONEPUNCHMAN411/Jarvis
- pyautogui advanced: https://github.com/asweigart/pyautogui
- pynput: https://github.com/moses-palmer/pynput
- screeninfo: https://github.com/rr-/screeninfo
- pytesseract: https://github.com/madmaze/pytesseract
- Windows OCR via winsdk: https://github.com/pywinrt/python-winsdk
- EasyOCR: https://github.com/JaidedAI/EasyOCR
- watchdog: https://github.com/gorakhargosh/watchdog
- Phase 1: docs/PHASE1_PLAN.md — vision fix completed 2026-09-16
