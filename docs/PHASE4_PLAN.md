# Phase 4 Plan — File & System Deep Mastery (Deep System Admin) — ✅ COMPLETED 2026-09-16

**Status:** Implemented 5 plugins, py_compile ok, help tested, docs updated, ready to push.

## Implementation Summary (Completed)

**Files created:**
- file_organizer_pro.py (12+ actions, organize by type/date/content/size/project, organize_photos by exif_date, organize_by_date, find_duplicates by hash/content/size, clean_empty, largest, recent, rules list/add/remove)
- batch_renamer_pro.py (12+ actions, rename pattern {n}/{date}/{exif_date}/{name}/{ext}, regex find/replace $1 $2, exif rename, case lower/upper/title, trim, prefix/suffix, number padding, clean)
- system_services_pro.py (15+ actions, services list/start/stop/status via sc query/systemctl, startup list/add/remove via registry HKCU Run, registry get/set/list via winreg, env list/get/set, tasks list/run, info)
- audio_device_pro.py (12+ actions, devices output/input, volume get/set master, app_volume list/get/set per-app via pycaw, switch_output/input via PowerShell AudioDevice/pactl/SwitchAudioSource, mute, mic, sessions)
- power_manager_pro.py (12+ actions, battery status/health/cycles design/full capacity wear via WMI powercfg, power_plans list/get/set via powercfg, sleep/hibernate delay, wake list/set, performance balanced/performance/power_saver, brightness, uptime)

**Testing:** py_compile ok, help len 1860-2491 each.

**Total after Phase 4:** 45 plugins (44 + _soundwave_client) — 11 core + 5 community + 5 vision fix + 5 input/workspace + 5 intelligence + 5 file/system deep + 8 Soundwave + 1 bridge

---

# Phase 4 Plan — File & System Deep Mastery (Deep System Admin) — Original

**Goal:** Make JARVIS deep system admin — beyond basic file_commander, system_monitor, pc_master — smart file organization by content/date, batch rename with regex/EXIF/metadata, services/startup/registry/env vars control, per-app audio device switching, power/battery management.

**Why Phase 4?** Phase 1 vision (tree first zero tokens), Phase 2 input/workspace (keyboard/mouse/workspace/OCR/file watcher), Phase 3 intelligence (logger/recovery/workflows/learner/proactive). Now JARVIS can see, control, remember, self-heal, but still shallow on:
- File organization is basic by extension only (file_commander organize by type) — no smart by content, date, size, duplicate content, project type
- Batch rename is basic {n}/{date} — no regex, EXIF date, metadata, case conversion, trim
- System services/startup/registry/env vars — no dedicated plugin, pc_master has basic power/display but not services, startup, registry, env vars
- Audio is basic volume — no per-app volume, device switching, input/output device list, mic control
- Power is basic lock/shutdown — no battery deep, power plans, sleep/wake timers, performance modes

**Total after Phase 4:** 45 plugins (44 + _soundwave_client) — 11 core + 5 community + 5 vision fix + 5 input/workspace + 5 intelligence + 5 file/system deep + 8 Soundwave + 1 bridge

## Current Weaknesses After Phase 3

1. **File organizer basic:** file_commander organize by extension only (Images, Videos, Docs) — no smart by date (e.g., organize photos by year/month via EXIF), by content (e.g., move invoices by keyword), by size, by project (e.g., group files by git repo), duplicate detection only MD5 not content-aware, no auto-organize rules.
2. **Batch renamer basic:** file_commander batch rename supports {n}/{date} only — no regex find/replace, no EXIF date, no metadata (e.g., rename photos by EXIF date), no case conversion (lower/upper/title), no trim, no prefix/suffix, no numbering with padding.
3. **System services/startup/registry/env vars missing:** pc_master has power, display, audio basic, but no services list/start/stop/restart, no startup apps list/enable/disable, no registry read/write (Windows), no env vars list/set, no scheduled tasks.
4. **Audio deep missing:** pc_master volume is master only — no per-app volume (e.g., Chrome 50%, Spotify 80%), no device switching (e.g., switch output to headphones, input to mic), no device list, no mic mute/unmute, no audio session list.
5. **Power deep missing:** pc_master power has lock/shutdown/restart/sleep only — no battery deep (health, cycles, design capacity), no power plans list/switch (balanced/high performance/power saver), no sleep/wake timers, no performance modes, no brightness adaptive.

## What ONEPUNCHMAN411 + Mark LIII + upgraderguy777 Have (Inspiration)

- ONEPUNCHMAN411 `file_organizer.py` (brain): file organization by type/date
- ONEPUNCHMAN411 `batch_renamer.py` (brain): batch rename with patterns
- ONEPUNCHMAN411 `system.py` (control): system control — services, startup, registry
- ONEPUNCHMAN411 `app_launcher.py` (control): app launcher with startup
- Mark LIII `computer_settings` (56 actions): volume, brightness, WiFi, Bluetooth, power, display, audio, etc. — but not per-app audio, not services, not registry
- Mark LIII `system_monitor`: CPU, RAM, disk, battery basic
- upgraderguy777 `notification_reader.py`: Windows Runtime API
- pycaw: per-app audio control via Windows Core Audio API
- screen-brightness-control: brightness
- psutil: services, battery, sensors

## Plugins to Create (Phase 4 — 5 plugins)

### 1. file_organizer_pro.py — Smart File Organizer by Content/Date/Project (Zero Tokens)
**Purpose:** Smart file organization beyond extension — by content, date, size, project, duplicate content.

**Actions (12+):**
- `organize path=... [by=type/date/content/size/project] [dest=...] [dry_run=true/false]` — organize files in path by type (extension), date (year/month via mtime or EXIF for photos), content (keyword in filename or text content for docs), size (small/medium/large), project (group by git repo or folder name). Dest optional, default path/Organized/{category}. Dry run true = preview without moving, false = actual move. Returns organized count + categories.
- `organize_photos path=... [by=exif_date/date] [dest=...] [dry_run=...]` — organize photos by EXIF date year/month, e.g., 2023/12/IMG_1234.jpg, via Pillow EXIF or file mtime fallback.
- `organize_by_date path=... [dest=...] [dry_run=...]` — organize by date year/month via mtime.
- `find_duplicates path=... [by=hash/content/size] [min_size=...]` — find duplicate files by hash MD5/SHA1, by content (first 1KB), by size, min size filter, returns groups of duplicates.
- `clean_empty path=... [dry_run=...]` — clean empty folders/files in path.
- `largest path=... [n=10]` — largest files in path (like file_commander but with more options).
- `recent path=... [n=20] [days=7]` — recent files in path last N days.
- `rules list/add/remove` — organize rules: e.g., rule "invoices" keyword "invoice" in filename → dest ~/Documents/Invoices, stored ~/.jarvis_organize_rules.json, auto-applied on organize.
- `help`

**Zero tokens:** Pure local via pathlib, hashlib, Pillow EXIF, mimetypes, os.stat, no LLM.

**State:** `~/.jarvis_organize_rules.json` with rules: [{name, keyword, dest, by, enabled}], `~/.jarvis_organize_history.jsonl` with organize history.

**Deps:** `Pillow` (for EXIF), stdlib. Optional.

**Inspired by:** ONEPUNCHMAN411 file_organizer.py + file_commander.py organize + batch_renamer + file_watcher_pro organize.

**File:** `mark-liii-plugins/file_organizer_pro.py` (500+ lines)

---

### 2. batch_renamer_pro.py — Advanced Batch Rename with Regex/EXIF/Metadata (Zero Tokens)
**Purpose:** Advanced batch rename beyond {n}/{date} — regex, EXIF date, metadata, case conversion.

**Actions (12+):**
- `rename path=... pattern=... [by=name/regex/exif/metadata] [dry_run=true/false] [start=1] [padding=3]` — batch rename files in path via pattern, by name (simple replace), regex (find/replace with groups), exif (use EXIF date for photos), metadata (use file metadata). Pattern supports {n} number with padding, {date} file mtime, {exif_date} EXIF date, {name} original name, {ext} extension, {size} size, {parent} parent folder, plus regex groups $1 $2. Dry run true = preview, false = actual rename. Returns renamed count + preview.
- `regex path=... find=... replace=... [dry_run=...]` — regex find/replace rename, e.g., find "IMG_(\d+)" replace "Photo_$1" — uses re.
- `exif path=... pattern=... [dry_run=...]` — rename photos by EXIF date, pattern e.g., "{exif_date}_{n}" → "2023-12-25_001.jpg", via Pillow EXIF DateTimeOriginal.
- `case path=... case=lower/upper/title/capitalize [dry_run=...]` — change case of filenames.
- `trim path=... [chars=...] [side=both/left/right] [dry_run=...]` — trim chars from filenames.
- `prefix path=... prefix=... [dry_run=...]` / `suffix path=... suffix=... [dry_run=...]` — add prefix/suffix.
- `number path=... [start=1] [padding=3] [prefix=...] [suffix=...] [dry_run=...]` — number files with padding, e.g., IMG_{n:03} → IMG_001.jpg.
- `clean path=... [dry_run=...]` — clean filenames: remove special chars, spaces to underscores, etc.
- `help`

**Zero tokens:** Pure local via pathlib, re, Pillow EXIF, datetime, no LLM.

**State:** `~/.jarvis_rename_history.jsonl` with rename history for undo.

**Deps:** `Pillow` (for EXIF), stdlib.

**Inspired by:** ONEPUNCHMAN411 batch_renamer.py + file_commander batch rename {n}/{date}.

**File:** `mark-liii-plugins/batch_renamer_pro.py` (500+ lines)

---

### 3. system_services_pro.py — System Services/Startup/Registry/Env Vars Control (Zero Tokens)
**Purpose:** Deep system control — services, startup apps, registry (Windows), env vars, scheduled tasks.

**Actions (15+):**
- `services [action=list/start/stop/restart/status] [name=...]` — list services via psutil or sc query (Windows) or systemctl (Linux) or launchctl (macOS), start/stop/restart/status service by name, e.g., services action=list, services action=status name=wuauserv (Windows Update).
- `startup [action=list/enable/disable/add/remove] [name=...] [path=...]` — list startup apps via registry HKCU\Software\Microsoft\Windows\CurrentVersion\Run (Windows) or ~/Library/LaunchAgents (macOS) or ~/.config/autostart (Linux), enable/disable/add/remove startup app, e.g., startup action=list, startup action=add name=MyApp path=C:\MyApp.exe.
- `registry [action=get/set/list/delete] [key=...] [value=...] [data=...]` — Windows registry control via winreg, e.g., registry action=get key=HKCU\Software\Microsoft\Windows\CurrentVersion\Run value=MyApp, registry action=list key=HKCU\Software\...\Run. macOS/Linux degraded (return not supported).
- `env [action=list/get/set/delete] [key=...] [value=...]` — env vars list/get/set/delete, e.g., env action=list, env action=get key=PATH, env action=set key=MY_VAR value=123. Set via os.environ + setx (Windows) or export (Linux/macOS) note.
- `tasks [action=list/run] [name=...]` — scheduled tasks list/run via schtasks (Windows) or crontab -l (Linux) or launchctl list (macOS).
- `info` — system info: OS, version, uptime, boot time, user, hostname, etc.
- `help`

**Zero tokens:** Pure local via psutil, winreg (Windows), subprocess, os, pathlib.

**State:** None, stateless, but logs to action_logger.

**Deps:** `psutil`, stdlib, winreg (Windows stdlib).

**Inspired by:** ONEPUNCHMAN411 system.py + app_launcher.py + pc_master system actions + process_commander.

**File:** `mark-liii-plugins/system_services_pro.py` (500+ lines)

---

### 4. audio_device_pro.py — Per-App Audio & Device Switching (Zero Tokens)
**Purpose:** Deep audio control — per-app volume, device switching, input/output list, mic control.

**Actions (12+):**
- `devices [type=output/input/all]` — list audio devices output/input via pycaw (Windows) or sounddevice or pulsectl (Linux) or system_profiler (macOS), returns name, id, default, volume, etc.
- `volume [action=get/set] [value=0-100] [device=...]` — master volume get/set via pycaw or sounddevice, value 0-100, device optional name or id.
- `app_volume [action=list/get/set] [app=...] [value=0-100]` — per-app volume list/get/set via pycaw AudioUtilities.GetAllSessions (Windows), e.g., app_volume action=list, app_volume action=set app=chrome value=50. Windows only, degraded on macOS/Linux.
- `switch_output device=...` / `switch_input device=...` — switch default output/input device via pycaw or sounddevice or PowerShell Set-AudioDevice (Windows) or pactl (Linux) or SwitchAudioSource (macOS).
- `mute [action=get/set] [value=true/false] [device=...] [app=...]` — mute/unmute master or device or per-app, get mute status.
- `mic [action=get/set/mute/unmute] [value=...]` — mic control get/set volume mute/unmute.
- `sessions` — list audio sessions via pycaw (Windows) — app name, pid, volume, mute, state.
- `help`

**Zero tokens:** Pure local via pycaw, comtypes, sounddevice, psutil, no LLM.

**State:** None, stateless.

**Deps:** `pycaw`, `comtypes`, `sounddevice`, `psutil`, stdlib. All optional, degrade gracefully.

**Inspired by:** pc_master volume + system_monitor_pro + pycaw per-app volume + sounddevice.

**File:** `mark-liii-plugins/audio_device_pro.py` (500+ lines)

---

### 5. power_manager_pro.py — Battery Deep & Power Plans & Sleep/Wake (Zero Tokens)
**Purpose:** Deep power management — battery health, power plans, sleep/wake timers, performance modes.

**Actions (12+):**
- `battery [action=status/health/cycles]` — battery status via psutil.sensors_battery() + WMI Win32_Battery (Windows) for health, cycles, design capacity, full capacity, wear level, e.g., battery action=status, battery action=health. Returns percent, plugged, time left, health, cycles, design/full capacity.
- `power_plans [action=list/get/set] [name=...]` — power plans list/get/set via powercfg /list (Windows) or system_profiler SPPowerDataType (macOS) or upower (Linux), e.g., power_plans action=list, power_plans action=set name=High performance.
- `sleep [action=sleep/hibernate] [delay=...]` — sleep/hibernate now or after delay seconds, e.g., sleep action=sleep delay=60.
- `wake [action=list/set/delete] [time=...]` — wake timers list/set/delete via powercfg /waketimers (Windows) or pmset (macOS) or rtcwake (Linux), e.g., wake action=set time=2026-09-17T08:00:00.
- `performance [action=get/set] [mode=balanced/performance/power_saver]` — performance mode get/set via powercfg or Windows 11 power mode API or cpufreq (Linux).
- `brightness [action=get/set] [value=0-100]` — brightness get/set via screen-brightness-control or WMI.
- `uptime` — uptime and boot time via psutil.boot_time().
- `help`

**Zero tokens:** Pure local via psutil, WMI, powercfg, screen-brightness-control, no LLM.

**State:** None, stateless.

**Deps:** `psutil`, `screen-brightness-control`, `wmi` (optional Windows), stdlib.

**Inspired by:** pc_master power + system_monitor_pro battery + power + display.

**File:** `mark-liii-plugins/power_manager_pro.py` (500+ lines)

---

## Implementation Order

1. **file_organizer_pro.py** — foundation, zero tokens, no deps on other new plugins, smart organize by content/date/project. Implement first, test organize/find_duplicates.
2. **batch_renamer_pro.py** — builds on file_organizer_pro (organize + rename), advanced rename regex/EXIF/metadata. Implement second, test rename/regex/exif/case.
3. **system_services_pro.py** — independent, deep system control services/startup/registry/env. Implement third, test services/startup/registry/env/tasks.
4. **audio_device_pro.py** — independent, per-app audio device switching. Implement fourth, test devices/volume/app_volume/switch/mute/mic.
5. **power_manager_pro.py** — independent, battery deep power plans sleep/wake. Implement last, test battery/power_plans/sleep/wake/performance.

## Dependencies to Install

```bash
pip install psutil pycaw comtypes sounddevice screen-brightness-control Pillow wmi
# Windows: pip install pycaw comtypes wmi
# Linux: pip install pulsectl
# macOS: brew install SwitchAudioSource
```

All deps optional — plugins degrade gracefully with "pip install X" message.

## Testing Plan

For each plugin:

1. **py_compile:** `python -m py_compile mark-liii-plugins/file_organizer_pro.py` etc.
2. **Help action:** `python -c "import file_organizer_pro; print(file_organizer_pro.run({'action':'help'}))"`
3. **Core actions:**
   - file_organizer_pro: organize path=~/Downloads by=type dry_run=true, organize_photos path=~/Pictures by=exif_date dry_run=true, find_duplicates path=~/Downloads by=hash, largest path=~/Downloads n=5
   - batch_renamer_pro: rename path=~/Downloads pattern={name}_{n} dry_run=true, regex path=~/Downloads find=IMG_(\d+) replace=Photo_$1 dry_run=true, exif path=~/Pictures pattern={exif_date}_{n} dry_run=true, case path=~/Downloads case=lower dry_run=true
   - system_services_pro: services action=list, startup action=list, env action=list, info
   - audio_device_pro: devices type=all, volume action=get, app_volume action=list, sessions
   - power_manager_pro: battery action=status, power_plans action=list, uptime, brightness action=get
4. **Error handling:** Test without deps, ensure graceful message, never raise
5. **Dry run:** All organize/rename actions support dry_run=true preview before actual

**Manual testing on Windows:**
- Say "organize Downloads by type dry run", "find duplicates in Downloads"
- Say "rename files in Downloads pattern Photo_{n} dry run", "regex rename IMG_(\d+) to Photo_$1"
- Say "list services", "list startup apps", "list env vars"
- Say "list audio devices", "per-app volume list", "switch output to headphones"
- Say "battery status", "list power plans", "uptime"

## Integration with Existing Plugins

- **file_commander.py** has organize by type basic, batch rename {n}/{date} — file_organizer_pro + batch_renamer_pro are pro versions with smart by content/date/EXIF/regex/metadata
- **file_watcher_pro.py** watches files and auto organizes — file_organizer_pro provides smart organize logic for file_watcher_pro action=organize
- **pc_master.py** has volume, brightness, power basic — audio_device_pro + power_manager_pro are pro versions with per-app volume, device switching, battery health, power plans, sleep/wake timers
- **system_monitor_pro.py** has battery, uptime basic — power_manager_pro is pro with health, cycles, power plans, performance modes
- **process_commander.py** has process list — system_services_pro adds services list/start/stop
- **app_launcher_pro.py** has launch — system_services_pro adds startup apps list/enable/disable

## Documentation

- Update `docs/PC_MASTERY.md` with Phase 4 section: file & system deep mastery
- Update `mark-liii-plugins/README.md` with 5 new plugins table
- Update `docs/PHASE4_PLAN.md` with completion status

## Files to Create/Modify

**New files (5):**
- `mark-liii-plugins/file_organizer_pro.py`
- `mark-liii-plugins/batch_renamer_pro.py`
- `mark-liii-plugins/system_services_pro.py`
- `mark-liii-plugins/audio_device_pro.py`
- `mark-liii-plugins/power_manager_pro.py`

**Modify:**
- `docs/PC_MASTERY.md` — add Phase 4 section
- `mark-liii-plugins/README.md` — add 5 new plugins
- `Mark-LIII/plugins/` in jarvis branch — copy new plugins

**Total after Phase 4:** 45 plugins (44 + _soundwave_client) — 11 core + 5 community + 5 vision fix + 5 input/workspace + 5 intelligence + 5 file/system deep + 8 Soundwave + 1 bridge

## Success Criteria

- [ ] All 5 new plugins py_compile ok
- [ ] file_organizer_pro organize by type/date/content/size/project dry_run works, organize_photos by exif_date, find_duplicates by hash, largest, recent, rules list/add
- [ ] batch_renamer_pro rename pattern {n}/{date}/{exif_date}/{name}/{ext} dry_run, regex find/replace, exif, case lower/upper/title, trim, prefix/suffix, number padding, clean
- [ ] system_services_pro services list/start/stop/status, startup list/enable/disable/add, registry get/set/list (Windows), env list/get/set, tasks list, info
- [ ] audio_device_pro devices type all/output/input, volume get/set, app_volume list/get/set per-app via pycaw, switch_output/input, mute get/set, mic get/set/mute, sessions
- [ ] power_manager_pro battery status/health/cycles design/full capacity wear, power_plans list/get/set, sleep/hibernate delay, wake list/set, performance get/set balanced/performance/power_saver, brightness get/set, uptime
- [ ] Docs updated
- [ ] Copied to jarvis branch and pushed
- [ ] Arena branch pushed

## References

- ONEPUNCHMAN411/Jarvis brain/file_organizer.py, batch_renamer.py + control/system.py, app_launcher.py — https://github.com/ONEPUNCHMAN411/Jarvis
- Mark LIII computer_settings 56 actions, system_monitor — https://github.com/FatihMakes/Mark-LIII
- pycaw per-app audio: https://github.com/AndreMiras/pycaw
- screen-brightness-control: https://github.com/Crozzers/screen-brightness-control
- psutil services/battery: https://github.com/giampaolo/psutil
- Pillow EXIF: https://pillow.readthedocs.io/en/stable/reference/ExifTags.html
- Phase 1: docs/PHASE1_PLAN.md — vision fix completed 2026-09-16
- Phase 2: docs/PHASE2_PLAN.md — input & workspace mastery completed 2026-09-16
- Phase 3: docs/PHASE3_PLAN.md — intelligence & self-healing completed 2026-09-16
