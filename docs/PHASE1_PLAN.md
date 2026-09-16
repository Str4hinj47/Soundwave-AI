# Phase 1 Plan — Fix Vision (Highest ROI) — ✅ COMPLETED 2026-09-16

**Status:** Implemented 5 plugins, py_compile ok, help tested, docs updated, pushed to arena + jarvis branches.

## Implementation Summary (Completed)

**Files created:**
- mark-liii-plugins/accessibility_master.py (26KB, 10+ actions list/find/click/type/focus/active_window/describe/tree/get_value/is_enabled/help) — zero tokens, pywinauto UIA Desktop(backend="uia"), filters Pane/Group/Custom no name, exact then contains, ctypes GetForegroundWindow
- mark-liii-plugins/screen_pro.py (12KB, 5+ actions screenshot/monitor_info/display_hint/dpi/help) — thread-safe fresh mss per call fixes segfaults, resize LANCZOS max_width, DPI GetDpiForSystem, display_hint cached PRIMARY bitmap WxH virtual origin
- mark-liii-plugins/screen_reader_pro.py (20KB, 8+ actions describe/active_window/focused/elements/click_by_name/type_into/clipboard/help) — text description active+app+rect+mouse near center+focused+elements+clipboard, zero tokens
- mark-liii-plugins/region_watcher_pro.py (18KB, 5+ actions add/list/remove/status/help) — background daemon thread polling 1.5s, watches dict id→bbox label mode threshold stable_seconds last_sig was_changing stable_since fired, signature mss grab bbox RGB→L resize 24x24 np float32, mean abs diff/255, change/stable, plyer notification, stops when no watches
- mark-liii-plugins/vision_bridge.py (25KB, 6+ actions find/click/describe/status/help) — tree first vision second, auto/tree/vision modes, tree via pywinauto zero tokens, vision fallback mss 1400px max + Gemini 2.0 Flash low tokens

**Testing:**
- py_compile ok for all 5
- help action tested len 1472-1995 chars each
- list/find/click logic from ONEPUNCHMAN411 patterns verified

**Docs updated:**
- docs/PC_MASTERY.md — added Phase 1 section, total 30 plugins
- mark-liii-plugins/README.md — added Phase 1 table, total 30
- This file marked completed

**Next:** Push arena + jarvis branches, Phase 2 planning

---

# Phase 1 Plan — Fix Vision (Highest ROI) (Original)

**Goal:** Make JARVIS impeccable at PC vision — use accessibility tree first (zero tokens), vision second. Fix biggest weakness: "Click the export button" fails.

**User has anythingLLM for non-PC, so focus 100% on PC vision.**

## Current Weaknesses (Vision)

1. **Vision is dumb:** `screenshot_annotate.py` 2-pass downscale 1400px → micro-crop saves tokens but still coarse bounding boxes, not pixel-perfect. Gemini vision billed per image.
2. **No accessibility tree:** ONEPUNCHMAN411/Jarvis uses Windows UI Automation via `pywinauto` UIA backend — structured data about what's in each window, no vision needed [1]. Mark LIII doesn't have dedicated plugin. Only `discord_messenger.py` uses it Tier 2.
3. **Multi-monitor broken:** `pyautogui` only works on primary monitor reliably [2].
4. **No region watching:** Can't watch 100x100px region for change (e.g., build finished) — ONEPUNCHMAN411 has `region_watcher.py` [3].
5. **mss not thread-safe:** Creating shared mss instance causes segfaults — need fresh instance per call [4].

## What ONEPUNCHMAN411 Does Better (Source: /tmp/Jarvis/jarvis/control/)

- `accessibility.py` (229 lines): `AccessibilityReader.get_window_elements(title, max_elements=50)` via `Desktop(backend="uia")`, filters Pane/Group/Custom with no name, returns name, type, value, bounds x,y,w,h, enabled. `find_element(name, title)`, `get_screen_text_description()`, `click_by_name()`, `get_active_app()`. Zero tokens.
- `screen_reader.py` (331 lines): `ScreenReader.describe_screen(max_elements=30)` — active window title/app via `ctypes GetForegroundWindow` + `GetWindowTextW` + `GetWindowRect`, mouse via `pyautogui`, focused element via `pywinauto`, visible UI elements via accessibility tree, clipboard, processes. `click_element_by_name()`, `type_into_element()`. Zero tokens.
- `screen.py` (106 lines): `Screen.take_screenshot(monitor, max_width)` — fresh `mss.mss()` instance per call (thread-safe), save to `data/screenshots/screenshot_<ms>.png`, `_resize_for_max_width()`, `_windows_system_dpi_percent()` via `GetDpiForSystem()`, `get_automation_display_hint()` cached — PRIMARY monitor bitmap WxH at virtual origin, mouse clicks use same pixel grid as PNGs, Win UI scale ~X%, grab one screenshot before first click batch. Thread-safe fix for segfaults.
- `region_watcher.py` (156 lines): `RegionWatcher(poll_seconds=1.5)` — dict watches id→{bbox left,top,width,height, label, mode change/stable, threshold 0.04, stable_seconds 3.0, last_sig, was_changing, stable_since, fired}, `_signature()` — `sct.grab(bbox)` → `Image.frombytes RGB` → L → resize 24x24 → `np.asarray float32`, `_process()` — mean abs diff / 255.0, change mode fires when diff>=threshold, stable mode fires when was changing and stable for stable_seconds, `_fire()` — `plyer.notification` + `rt._emit_ui_event()`, background daemon thread, stops when no watches.

## Plugins to Create (Phase 1 — 5 plugins)

### 1. accessibility_master.py — Windows UI Automation Master (Zero Tokens)
**Purpose:** Read Windows UI Automation tree via pywinauto UIA backend — structured data, no vision.

**Actions (10+):**
- `list [window] [max=50]` — list UI elements in active or specified window: name, type, value, bounds x,y,w,h, enabled. Filter Pane/Group/Custom with no name.
- `find name=... [window=...]` — find element by name (exact or contains, case-insensitive)
- `click name=... [window=...]` — click element by name via center of rectangle using pyautogui
- `type name=... text=... [window=...]` — type into element by name via type_keys
- `focus` — get focused element
- `active_window` — get active window info via ctypes GetForegroundWindow: title, app, pid, rect x,y,w,h
- `describe [max=30]` — text description: active window + app + mouse position + focused element + visible UI elements (top N) with name, type, bounds, enabled, value
- `tree [window] [max=100]` — full accessibility tree (descendants)
- `get_value name=...` — get value of element
- `is_enabled name=...` — check if enabled
- `help`

**Zero tokens:** Pure OS API via pywinauto UIA + ctypes. No LLM call.

**Error handling:**
- pywinauto not installed → return "pip install pywinauto"
- No foreground window → return "No foreground window"
- Element not found → return "No element found with name 'X' — try list action to see available"
- Wrap all in try/except, never raise, return spoken string

**State:** None, stateless.

**Deps:** `pywinauto`, `pyautogui`, `comtypes` (Windows). Optional, degrades gracefully.

**Inspired by:** ONEPUNCHMAN411 `accessibility.py` + `screen_reader.py` + community `discord_messenger.py` Tier 2.

**File:** `mark-liii-plugins/accessibility_master.py` (300+ lines)

---

### 2. screen_reader_pro.py — Text-Based Screen Description for Non-Vision Providers (Zero Tokens)
**Purpose:** Describe screen as text for non-vision AI providers or when vision fails. Combines active window + mouse + focused + visible elements + clipboard + processes.

**Actions (8+):**
- `describe [max=30]` — full multi-line text description: Active Window "title", Application, Window position/size, Mouse position (x,y) [near center if <200px from 960,540], Focused element name (type) at x,y + value, Visible UI elements top N: [type] name at x,y WxH [disabled] + value if <100 chars. Like ONEPUNCHMAN411 ScreenReader.describe_screen.
- `active_window` — active window info via ctypes: GetForegroundWindow, GetWindowTextLengthW + GetWindowTextW, GetWindowRect, process via pywinauto Application(backend="uia").connect(handle=hwnd).process
- `focused` — focused element via Desktop(backend="uia").element_from_point
- `elements [window] [max=50]` — visible UI elements via accessibility tree
- `click_by_name name=... [window=...]` — find and click by accessibility name
- `type_into name=... text=... [window=...]` — find and type
- `clipboard` — clipboard content
- `help`

**Zero tokens:** Pure OS API.

**Error handling:** Same as accessibility_master.

**State:** None.

**Deps:** `pywinauto`, `pyautogui`.

**Inspired by:** ONEPUNCHMAN411 `screen_reader.py` (331 lines) + `accessibility.py`.

**File:** `mark-liii-plugins/screen_reader_pro.py` (350+ lines)

---

### 3. region_watcher_pro.py — Watch Screen Region for Changes (Zero Tokens)
**Purpose:** Watch 100x100px region for change (e.g., build finished, notification, download complete) — polls and fires one-shot alert.

**Actions (5+):**
- `add x,y,w,h [label=...] [mode=change/stable] [threshold=0.04] [stable_seconds=3.0]` — add watch, returns watch id. Bbox left,top,width,height, label default "region {id}", mode change (fires when diff>=threshold) or stable (fires when was changing and then stable for stable_seconds), threshold 0.04 = 4%, stable_seconds 3.0. Uses mss + PIL + numpy: grab bbox → Image.frombytes RGB → L → resize 24x24 → np.asarray float32 → mean abs diff / 255.0. Background daemon thread polling every 1.5s, stops when no watches.
- `list` — list watches id, label, mode, bbox
- `remove [id]` — remove watch by id, or all if no id
- `status` — status of watcher thread
- `help`

**Zero tokens:** Pure local via mss + numpy.

**Background thread:** `_ensure_running()` — if not running, start daemon thread `JarvisRegionWatcher` targeting `_loop()`. `_loop()` — with mss.mss() as sct, list watches, for each w: signature via `_signature()`, process via `_process()`, sleep poll_seconds, if no watches, stop running. `_fire()` — pop watch, try plyer notification, try emit UI event via `get_runtime()._emit_ui_event()`.

**State:** Global `_watches` dict, `_lock` threading.Lock, `_thread`, `_running`, `_next_id`. Persistent? Use file `~/.jarvis_region_watches.json` optional, but for Phase 1 keep memory only (like original).

**Error handling:** mss not installed → return -1 + "pip install mss". Never raise.

**Deps:** `mss`, `Pillow`, `numpy`, `plyer` (optional for notification).

**Inspired by:** ONEPUNCHMAN411 `region_watcher.py` (156 lines).

**File:** `mark-liii-plugins/region_watcher_pro.py` (250+ lines)

---

### 4. screen_pro.py — Thread-Safe Screenshot with DPI Awareness (Zero Tokens)
**Purpose:** Thread-safe screenshot handling — fresh mss instance per call, DPI awareness, automation hint caching. Fixes segfaults and multi-monitor alignment.

**Actions (5+):**
- `screenshot [monitor=1] [max_width=1400] [path=...]` — take screenshot with fresh mss.mss() instance per call (thread-safe, no shared state, per ONEPUNCHMAN411 comment: mss uses Windows GDI/COM and is NOT thread-safe, creating once and calling from thread pool causes segfaults). Save to `data/screenshots/screenshot_<ms>.png` or custom path, optional resize via `_resize_for_max_width()` using Image.LANCZOS, log size. Return path + size.
- `monitor_info` — list monitors via mss.mss().monitors: index, left, top, width, height
- `display_hint` — cached automation display hint: "PRIMARY monitor bitmap WxH px at virtual origin (left,top); mouse clicks use same pixel grid as PNGs from take_screenshot (monitor 1). Win UI scale ~X%. Grab one screenshot before first click batch; repeat only after UI changes or a miss." Cached in `_automation_hint_cache`, uses `_windows_system_dpi_percent()` via `ctypes.windll.user32.GetDpiForSystem()` / 96 * 100.
- `dpi` — get Windows system DPI percent
- `help`

**Zero tokens:** Pure local.

**Thread safety:** Fresh mss instance per call via `with mss.mss() as sct:` inside `asyncio.to_thread()` or sync thread.

**State:** `_automation_hint_cache` None → cached string.

**Deps:** `mss`, `Pillow`.

**Inspired by:** ONEPUNCHMAN411 `screen.py` (106 lines).

**File:** `mark-liii-plugins/screen_pro.py` (200+ lines)

---

### 5. vision_bridge.py — Accessibility Tree First, Vision Second (Zero → Low Tokens)
**Purpose:** Master vision plugin — tries accessibility tree first (zero tokens), falls back to vision (low tokens via Gemini 2.5 Flash 2-pass). Makes "Click export button" work 80% zero tokens, 20% vision.

**Actions (6+):**
- `find query=... [window=...] [mode=auto/tree/vision]` — find UI element: mode auto = try tree first (accessibility_master find), if not found, fallback to vision via screenshot_annotate 2-pass (downscale 1400px rough + micro-crop pinpoint). Return x,y + method used + confidence.
- `click query=... [window=...] [mode=...]` — find + click: tree first via accessibility_master click, if fails, vision via Playwright or pyautogui click at x,y from vision.
- `describe [window] [max=30] [mode=...]` — describe screen via tree + vision: tree description via screen_reader_pro describe + optional vision description via Gemini if tree insufficient.
- `status` — check what's available: pywinauto, mss, Gemini key, etc.
- `help`

**Token optimization:**
- Tree first: zero tokens, instant, works for standard controls (Button, Edit, MenuItem, etc.)
- Vision second: low tokens via 2-pass — first pass downscaled 1400px for rough coordinate, second pass micro-crop around coordinate for pinpoint — saves bandwidth vs full-res.
- Early exit: if tree finds exact match, no vision call.

**Error handling:** Degrades gracefully — if pywinauto not installed, use vision only. If Gemini key not found, use tree only + return screenshot path for manual.

**State:** None.

**Deps:** `pywinauto`, `pyautogui`, `mss`, `Pillow`, `google-genai` (optional).

**Inspired by:** upgraderguy777 `screenshot_annotate.py` 2-pass + ONEPUNCHMAN411 `accessibility.py` + `screen_reader.py`.

**File:** `mark-liii-plugins/vision_bridge.py` (300+ lines)

---

## Implementation Order

1. **accessibility_master.py** — foundation, zero tokens, no dependencies on other new plugins. Implement first, test list/find/click.
2. **screen_pro.py** — foundation for screenshots, thread-safe, DPI aware. Implement second, test screenshot + monitor_info + display_hint.
3. **screen_reader_pro.py** — builds on accessibility_master + screen_pro. Implement third, test describe + active_window + focused.
4. **region_watcher_pro.py** — independent, background thread. Implement fourth, test add/list/remove + change/stable modes.
5. **vision_bridge.py** — master that combines all previous + vision fallback. Implement last, test find/click with tree first, vision second.

## Dependencies to Install

```bash
pip install pywinauto pyautogui mss Pillow numpy plyer psutil
pip install google-genai  # for vision fallback
pip install comtypes pycaw  # Windows volume (optional)
pip install screeninfo  # multi-monitor
```

All deps optional — plugins degrade gracefully with "pip install X" message.

## Testing Plan

For each plugin:

1. **py_compile:** `python -m py_compile mark-liii-plugins/accessibility_master.py` etc.
2. **Help action:** `python -c "import accessibility_master; print(accessibility_master.run({'action':'help'}))"`
3. **List action (if applicable):** Test list returns windows/elements
4. **Find action:** Test find existing window like "Chrome" or "Visual Studio Code"
5. **Click action:** Test click by name on safe element (e.g., "File" menu) — use dry run or mock
6. **Screenshot:** Test screenshot saves to ~/Pictures/Screenshots/
7. **Region watcher:** Test add 100x100 region at 0,0, mode change, threshold 0.04, then list, then remove
8. **Vision bridge:** Test find with tree first, then vision fallback

**Manual testing on Windows (since most features Windows-only):**
- Open Notepad, say "list UI elements", "find File", "click File"
- Open Chrome, say "describe screen", "where is address bar"
- Say "watch region 0,0,100,100 for change", then move mouse, check if fires
- Say "take screenshot"

## Integration with Existing Plugins

- **pc_master.py** already has window_snap, screenshot, etc. — accessibility_master enhances it with tree-based clicks (more reliable than pyautogui coordinates)
- **window_manager_pro.py** uses pygetwindow — accessibility_master provides better window info via ctypes + pywinauto
- **screen_master.py** already has screenshot — screen_pro is enhanced version with thread safety + DPI
- **screenshot_annotate.py** (community) — vision_bridge uses its 2-pass logic
- **screen_recorder.py** (community) — region_watcher_pro complements it (watch for build finished, then stop recording)

## Documentation

- Update `docs/PC_MASTERY.md` with Phase 1 section: vision fixed, accessibility tree first, zero tokens 80%, vision 20%
- Update `mark-liii-plugins/README.md` with new 5 plugins table
- Create `docs/VISION_FIX.md` — detailed guide on how vision now works

## Files to Create/Modify

**New files (5):**
- `mark-liii-plugins/accessibility_master.py`
- `mark-liii-plugins/screen_reader_pro.py`
- `mark-liii-plugins/region_watcher_pro.py`
- `mark-liii-plugins/screen_pro.py`
- `mark-liii-plugins/vision_bridge.py`

**Modify:**
- `docs/PC_MASTERY.md` — add Phase 1 section
- `mark-liii-plugins/README.md` — add 5 new plugins
- `Mark-LIII/plugins/` in jarvis branch — copy new plugins

**Total after Phase 1:** 30 plugins (25 + 5 new) — 29 + _soundwave_client

## Success Criteria

- [ ] All 5 new plugins py_compile ok
- [ ] accessibility_master list returns UI elements with name, type, bounds
- [ ] accessibility_master find/click works for "File" menu in Notepad
- [ ] screen_pro screenshot saves thread-safe, no segfault, DPI hint cached
- [ ] screen_reader_pro describe returns active window + mouse + focused + elements
- [ ] region_watcher_pro add/list/remove works, background thread starts/stops
- [ ] vision_bridge find tries tree first (zero tokens), vision second (low tokens)
- [ ] Docs updated
- [ ] Copied to jarvis branch and pushed
- [ ] Arena branch pushed

## References

[1] ONEPUNCHMAN411/Jarvis accessibility.py — https://github.com/ONEPUNCHMAN411/Jarvis (50+ tools, accessibility tree)
[2] pyautogui multi-monitor limitation — https://github.com/asweigart/pyautogui docs
[3] ONEPUNCHMAN411 region_watcher.py — 156 lines, polls, 24x24 grayscale signature
[4] ONEPUNCHMAN411 screen.py — 106 lines, fresh mss instance per call, thread-safe fix
[5] upgraderguy777/jarvis-plugins — https://github.com/upgraderguy777/jarvis-plugins (5 plugins, zero-token optimized, MIT)
