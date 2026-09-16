# Phase 3 Plan — Intelligence & Self-Healing (Makes JARVIS Self-Improving) — ✅ COMPLETED 2026-09-16

**Status:** Implemented 5 plugins, py_compile ok, help tested, docs updated, ready to push.

## Implementation Summary (Completed)

**Files created:**
- action_logger.py (12+ actions, log/list/search/stats/export/clear/replay/tail/failures, JSONL append-only max 10k auto-trim)
- error_recovery.py (10+ actions, retry exponential backoff, fallback tree→vision→ask, classify not_found/permission/timeout/invalid_params/missing_dependency/network/unknown, heal specific pip install, wrap auto recovery, history)
- workflow_engine.py (12+ actions, create name steps JSON array trigger manual/schedule/event, run vars, list/show/delete/edit/add_step/remove_step/export/import/triggers, conditionals file_exists, runs logged, success_rate)
- self_learner.py (10+ actions, correct original→correction context count 3+ threshold suggest, learn fact category, recall query, preferences, corrections, forget, suggest improved params, stats, export/import)
- proactive_assistant.py (10+ actions, check battery low disk full large files recent failures time-based learned, suggest, enable/disable/status background thread, history, feedback accept/dismiss, triggers)

**Testing:** py_compile ok, help len 1883-3134 each.

**Total after Phase 3:** 40 plugins (39 + _soundwave_client) — 11 core + 5 community + 5 vision fix + 5 input/workspace + 5 intelligence + 8 Soundwave + 1 bridge

---

# Phase 3 Plan — Intelligence & Self-Healing (Makes JARVIS Self-Improving) — Original

**Goal:** Make JARVIS self-improving — logs all actions, recovers from errors automatically, executes multi-step workflows, learns from corrections, proactively suggests actions.

**Why Phase 3?** Phase 1 fixed vision (tree first zero tokens), Phase 2 fixed input/workspace (keyboard/mouse/workspace/OCR/file watcher). Now JARVIS can see and control PC impeccably, but still fails when:
- Action fails and JARVIS gives up (no retry/fallback)
- User has to repeat same multi-step task (no workflows)
- JARVIS doesn't learn from corrections (same mistake repeatedly)
- JARVIS is reactive only, not proactive (waits for user, doesn't suggest)
- No audit trail of what JARVIS did (no logger)

**User selected:** Intelligence & Self-Healing for Phase 3.

**Total after Phase 3:** 40 plugins (39 + _soundwave_client) — 11 core + 5 community + 5 vision fix + 5 input/workspace + 5 intelligence + 8 Soundwave + 1 bridge

## Current Weaknesses After Phase 2

1. **No action logging:** Mark LIII has `player.write_log()` but no dedicated plugin to search logs, stats, export, replay. ONEPUNCHMAN411 has no logger either, but needs audit trail.
2. **No error recovery:** When action fails (e.g., window not found, file not found), JARVIS returns error and stops. No auto-retry with backoff, no fallback strategies (e.g., try accessibility tree, then vision, then ask user), no error classification.
3. **No workflow engine:** User says "Every morning, open Chrome to Gmail, open VS Code to MyProject, set volume to 50, organize Downloads" — JARVIS does one action per request. No multi-step workflows with conditionals, loops, variables, triggers.
4. **No self-learning:** When user corrects JARVIS ("No, click the other button"), JARVIS doesn't remember. No learning from corrections, no preference memory beyond Mark LIII's long_term.json.
5. **No proactive assistant:** JARVIS waits for user. Doesn't suggest "You have 5 large files in Downloads, organize?", "Battery low, enable power saver?", "You usually open Chrome at 9am, open now?".

## What ONEPUNCHMAN411 + Mark LIII Have (Inspiration)

- Mark LIII `memory_manager.py`: MEMORY_MAX_CHARS 200k guard, categories identity/preferences/projects/relationships/wishes/notes, format_memory_for_prompt, search_memory <1ms, update_memory truncates 380
- Mark LIII `undo.py`: push_undo closure, files move/rename/create/copy/write/delete/organize + settings volume/brightness/dark mode, reads current before, journals every move
- Mark LIII `confirm.py`: confirmation gate via UI banner, token issued by UI, cheaper than 2 round trips
- Mark LIII `action_loader.py`: TOOL shape, collision detection, never raises, crash isolation
- ONEPUNCHMAN411 `macro_executor.py` (brain): macro execution with timing
- ONEPUNCHMAN411 `process_watcher.py` (brain): watch processes
- ONEPUNCHMAN411 `file_organizer.py` (brain): file organization
- upgraderguy777 `notification_reader.py`: background watcher for keyword, status, watches
- upgraderguy777 `magi_system.py`: 3 personas debate for complex decisions

## Plugins to Create (Phase 3 — 5 plugins)

### 1. action_logger.py — Action Audit Trail & Replay (Zero Tokens)
**Purpose:** Log all JARVIS actions to file with search, stats, export, replay — audit trail for debugging and self-improvement.

**Actions (12+):**
- `log action=... params=... result=...` — log action (called internally by other plugins or manually), saves to ~/.jarvis_action_log.jsonl (JSON Lines, one JSON per line: timestamp, action, params, result, duration, success)
- `list [limit=20] [action=...] [success=true/false]` — list recent logs, filter by action name, success/failure
- `search query=... [limit=20]` — search logs by query in action/params/result (fuzzy)
- `stats` — stats: total actions, success rate, top actions, failure reasons, average duration, last 24h count
- `export path=... [format=json/csv]` — export logs to file JSON or CSV
- `clear` — clear logs (with confirmation via param confirm=true)
- `replay id=...` — replay action by log id (re-run with same params)
- `tail [n=20]` — tail last N logs (like tail -f)
- `failures [limit=20]` — list only failures with error messages
- `help`

**Zero tokens:** Pure local via json, pathlib, datetime, no LLM.

**State:** `~/.jarvis_action_log.jsonl` append-only JSON Lines, max 10k lines auto-trim oldest (like memory_manager). Also `~/.jarvis_action_log_index.json` for quick stats.

**Integration:** Other plugins can call `action_logger.log` via import? For Phase 3, manual logging via action, but future: hook into player.write_log.

**Deps:** stdlib only.

**Inspired by:** Mark LIII memory_manager + undo journals + action_loader logs + ONEPUNCHMAN411 macro_executor.

**File:** `mark-liii-plugins/action_logger.py` (400+ lines)

---

### 2. error_recovery.py — Auto-Retry & Fallback Strategies (Zero to Low Tokens)
**Purpose:** When action fails, auto-retry with backoff, try fallback strategies, classify errors, self-heal.

**Actions (10+):**
- `retry action=... params=... [retries=3] [backoff=1.0]` — retry action with exponential backoff, e.g., retry find window 3 times with 1s, 2s, 4s backoff
- `fallback action=... params=... [strategies=tree,vision,ask]` — try fallback strategies in order: e.g., find element via tree (accessibility_master), then vision (vision_bridge), then ask user, then fail gracefully
- `classify error=...` — classify error: not_found, permission, timeout, invalid_params, unknown — returns category + suggested fix
- `heal error=... context=...` — suggest self-heal: e.g., error "pywinauto not installed" → "pip install pywinauto", error "window not found" → "try list windows", error "file not found" → "check path"
- `wrap action=... params=...` — wrap action with auto error recovery: try action, if fails, classify, retry with backoff, fallback, heal suggestion, return final result + recovery steps taken
- `history [limit=20]` — recent recovery attempts, success rate
- `help`

**Zero to Low Tokens:** Local retry/fallback zero tokens, heal suggestions via local rules + optional Gemini for complex errors (low tokens).

**State:** `~/.jarvis_error_recovery.json` with history of recoveries, success rates per action, common errors.

**Strategies:**
- Tree first, vision second (like vision_bridge) for UI element errors
- Retry with backoff for transient errors (window not ready, file locked)
- Fallback to alternative plugin (e.g., file_commander search fails → try pc_master file_search)
- Ask user as last resort

**Deps:** stdlib + optional google-genai for complex heal.

**Inspired by:** vision_bridge tree first vision second + upgraderguy777 discord_messenger 3-tier + Mark LIII confirm gate + undo.

**File:** `mark-liii-plugins/error_recovery.py` (400+ lines)

---

### 3. workflow_engine.py — Multi-Step Workflows with Conditionals & Triggers (Zero Tokens)
**Purpose:** Execute multi-step workflows: "Every morning, open Chrome to Gmail, open VS Code to MyProject, set volume to 50, organize Downloads" — with conditionals, loops, variables, triggers.

**Actions (12+):**
- `create name=... steps=... [trigger=...]` — create workflow, steps JSON array: [{action: "app_launcher_pro", params: {action: "launch", name: "chrome"}}, {action: "browser_master", params: {action: "navigate", url: "https://gmail.com"}}, {action: "pc_master", params: {action: "volume", value: 50}}], trigger: manual, schedule (cron), event (file_created, time, etc.), stored ~/.jarvis_workflows/{name}.json
- `run name=... [vars=...]` — run workflow by name, with optional vars JSON e.g., {"project": "MyApp"}, returns step-by-step results, stops on failure unless continue_on_error true
- `list` — list workflows name, steps count, trigger, last run, success rate
- `show name=...` — show workflow steps detailed
- `delete name=...` — delete workflow
- `edit name=... steps=...` — edit workflow steps
- `add_step name=... step=... [position=...]` — add step to workflow at position (append if no position)
- `remove_step name=... index=...` — remove step by index
- `export name=... path=...` / `import path=...` — export/import workflow JSON
- `triggers` — list triggers and their workflows
- `help`

**Workflow JSON format:**
```json
{
  "name": "morning_routine",
  "description": "Open Chrome Gmail + VS Code MyProject + volume 50 + organize Downloads",
  "trigger": {"type": "manual"} or {"type": "schedule", "cron": "0 9 * * *"} or {"type": "event", "event": "file_created", "path": "~/Downloads"},
  "vars": {"project": "MyApp"},
  "steps": [
    {"action": "app_launcher_pro", "params": {"action": "launch", "name": "chrome"}, "continue_on_error": false, "condition": null},
    {"action": "browser_master", "params": {"action": "navigate", "url": "https://gmail.com"}, "delay": 2},
    {"action": "app_launcher_pro", "params": {"action": "launch", "name": "vscode"}},
    {"action": "pc_master", "params": {"action": "volume", "value": 50}},
    {"action": "file_commander", "params": {"action": "organize", "path": "~/Downloads"}}
  ],
  "created": "2026-09-16T10:00:00",
  "last_run": null,
  "runs": 0,
  "success_rate": 0
}
```

**Conditionals:** step.condition e.g., {"if": "file_exists", "path": "~/Downloads/report.pdf", "then": "continue", "else": "skip"} — simple for Phase 3.

**Loops:** step.loop e.g., {"for_each": "file in ~/Downloads/*.pdf", "steps": [...]}

**Zero tokens:** Pure local via json, pathlib, importlib to call other plugins' run().

**State:** `~/.jarvis_workflows/` dir with JSON per workflow, `~/.jarvis_workflow_runs.jsonl` for run history.

**Background:** Optional scheduler thread checking cron triggers every minute.

**Deps:** stdlib only.

**Inspired by:** ONEPUNCHMAN411 macro_executor.py + automation_master.py workflow JSON + Mark LIII dev_agent complex 3+ steps + upgraderguy777 magi_system max mode debate.

**File:** `mark-liii-plugins/workflow_engine.py` (500+ lines)

---

### 4. self_learner.py — Learn from Corrections & Preferences (Zero to Low Tokens)
**Purpose:** Learn from user corrections: "No, click the other button" → remember, adapt. Track preferences, corrections, feedback.

**Actions (10+):**
- `correct original=... correction=... [context=...]` — log correction: e.g., original "click File" → correction "click Edit", context "Notepad", stored ~/.jarvis_corrections.jsonl, used to adapt future actions
- `learn fact=... [category=...]` — learn fact e.g., "User prefers dark mode", "User's email is my@email.com", "Chrome is at 100,200", category preferences/projects/relationships/etc. like Mark LIII memory_manager but via plugin
- `recall query=...` — recall learned facts/corrections by query fuzzy search
- `preferences` — list preferences learned
- `corrections [limit=20]` — list recent corrections
- `forget query=...` — forget fact/correction by query
- `suggest action=... params=...` — suggest improved params based on past corrections: e.g., if user corrected "click File" to "click Edit" 3 times in Notepad, suggest Edit next time
- `stats` — stats: total corrections, top corrected actions, learning rate
- `export path=...` / `import path=...` — export/import learned data
- `help`

**Zero to Low Tokens:** Local storage zero tokens, suggest via local rules (count corrections) + optional Gemini for complex learning (low tokens).

**State:** `~/.jarvis_corrections.jsonl` (corrections), `~/.jarvis_learned_facts.json` (facts by category), `~/.jarvis_preferences.json` (preferences).

**Learning logic:**
- Count corrections per (action, original, correction, context) — if same correction 3+ times, suggest it proactively
- Track user preferences: volume level, brightness, favorite apps, window positions, etc.
- Adapt: if user always says "organize Downloads" after downloading, suggest workflow

**Deps:** stdlib + optional google-genai for suggest.

**Inspired by:** Mark LIII memory_manager.py + undo + self_learner concept + upgraderguy777 magi_system learning.

**File:** `mark-liii-plugins/self_learner.py` (400+ lines)

---

### 5. proactive_assistant.py — Proactive Suggestions & Checks (Zero to Low Tokens)
**Purpose:** Proactive assistant — suggest actions based on context, time, usage patterns, system status — like Mark LIII PROACTIVE_CHECK but as plugin.

**Actions (10+):**
- `check` — proactive check: battery low? disk full? large files in Downloads? recent failures? suggest actions, returns 1-3 sentences like Mark LIII PROACTIVE_CHECK
- `suggest` — suggest actions based on context: time of day, recent actions, system status, learned preferences, e.g., "You usually open Chrome at 9am, open now?", "5 large files in Downloads, organize?", "Battery 15%, enable power saver?"
- `enable [interval=30]` / `disable` / `status` — enable/disable proactive checks every N minutes via background thread, status shows enabled, interval, last check, suggestions count
- `history [limit=20]` — recent proactive suggestions and whether user accepted/dismissed
- `feedback id=... action=accept/dismiss` — feedback on suggestion, learns
- `triggers` — list proactive triggers: battery_low, disk_full, large_files, recent_failures, time_based, etc.
- `help`

**Proactive triggers (zero tokens, local checks):**
- Battery low (<20%) → suggest power saver
- Disk full (<10% free) → suggest cleanup largest files
- Large files in Downloads (>100MB) → suggest organize
- Recent failures (3+ failures in last hour) → suggest error_recovery history
- Time-based: morning 9am → suggest morning_routine workflow, evening → suggest backup
- File watcher: new file in Downloads → suggest organize
- Process watcher: high CPU process → suggest kill or monitor
- Learned: user usually does X at time Y → suggest X

**Zero to Low Tokens:** Local checks zero tokens, suggestions via local rules, optional Gemini for complex proactive reasoning (low tokens).

**State:** `~/.jarvis_proactive.json` with enabled, interval, history, feedback, last check.

**Background thread:** Proactive checks every N minutes (default 30), emits notification via plyer + logs via action_logger.

**Deps:** stdlib + psutil (for battery/disk) + plyer (optional) + optional google-genai.

**Inspired by:** Mark LIII prompt.txt PROACTIVE_CHECK + STARTUP_BRIEFING + system_monitor_pro alerts + file_watcher_pro + upgraderguy777 notification_reader.

**File:** `mark-liii-plugins/proactive_assistant.py` (400+ lines)

---

## Implementation Order

1. **action_logger.py** — foundation, zero tokens, no deps on other new plugins, logs all actions for other plugins to use. Implement first, test log/list/search/stats.
2. **error_recovery.py** — builds on action_logger (uses failure logs), implements retry/fallback/heal. Implement second, test retry/fallback/classify/heal.
3. **workflow_engine.py** — builds on action_logger + error_recovery (logs workflow runs, recovers from step failures), implements multi-step workflows. Implement third, test create/run/list/show.
4. **self_learner.py** — builds on action_logger + error_recovery (learns from corrections/failures), implements corrections/preferences. Implement fourth, test correct/learn/recall/suggest.
5. **proactive_assistant.py** — builds on all previous (uses logs, recovery history, workflows, learned preferences), implements proactive checks. Implement last, test check/suggest/enable/status.

## Dependencies to Install

```bash
pip install psutil plyer
# Optional for advanced:
pip install google-genai  # for heal/suggest complex reasoning low tokens
```

All deps optional — plugins degrade gracefully with "pip install X" message.

## Testing Plan

For each plugin:

1. **py_compile:** `python -m py_compile mark-liii-plugins/action_logger.py` etc.
2. **Help action:** `python -c "import action_logger; print(action_logger.run({'action':'help'}))"`
3. **Core actions:**
   - action_logger: log action=test params={} result=ok, list limit=5, search query=test, stats, failures
   - error_recovery: retry action=pc_master params={action: volume value: 50} retries=2, fallback action=accessibility_master params={action: find name: File}, classify error=window not found, heal error=pywinauto not installed
   - workflow_engine: create name=test steps=[{action: pc_master params: {action: volume value: 50}}], list, show name=test, run name=test, delete name=test
   - self_learner: correct original=click File correction=click Edit context=Notepad, learn fact=User prefers dark mode category=preferences, recall query=dark mode, preferences, corrections
   - proactive_assistant: check, suggest, status, enable interval=30, history, triggers
4. **Error handling:** Test without deps, ensure graceful message, never raise
5. **State persistence:** Test JSON files created, logs, workflows, corrections

**Manual testing:**
- Say "log action test", "list logs", "stats"
- Say "retry action find window", "fallback find element", "heal error window not found"
- Say "create workflow morning_routine with open Chrome Gmail + VS Code + volume 50", "run morning_routine", "list workflows"
- Say "correct click File to click Edit in Notepad", "learn user prefers dark mode", "recall dark mode"
- Say "proactive check", "suggest actions", "enable proactive every 30 minutes"

## Integration with Existing Plugins

- **pc_master.py** + all 34 existing plugins: action_logger logs all their actions, error_recovery wraps them, workflow_engine calls them, self_learner learns from corrections to them, proactive_assistant suggests them
- **action_logger.py**: Used by error_recovery (failure logs), workflow_engine (run history), self_learner (corrections), proactive_assistant (suggestion history)
- **error_recovery.py**: Used by workflow_engine (step failures), self_learner (learn from failures), proactive_assistant (suggest recovery)
- **workflow_engine.py**: Uses app_launcher_pro, browser_master, pc_master, file_commander, etc. for steps, logs via action_logger, recovers via error_recovery
- **self_learner.py**: Uses action_logger (corrections), error_recovery (failures), workflow_engine (learn workflows), proactive_assistant (feedback)
- **proactive_assistant.py**: Uses system_monitor_pro (battery/disk), file_watcher_pro (new files), process_commander (high CPU), action_logger (recent failures), self_learner (preferences), workflow_engine (suggest workflows)

## Documentation

- Update `docs/PC_MASTERY.md` with Phase 3 section: intelligence & self-healing
- Update `mark-liii-plugins/README.md` with 5 new plugins table
- Update `docs/PHASE3_PLAN.md` with completion status

## Files to Create/Modify

**New files (5):**
- `mark-liii-plugins/action_logger.py`
- `mark-liii-plugins/error_recovery.py`
- `mark-liii-plugins/workflow_engine.py`
- `mark-liii-plugins/self_learner.py`
- `mark-liii-plugins/proactive_assistant.py`

**Modify:**
- `docs/PC_MASTERY.md` — add Phase 3 section
- `mark-liii-plugins/README.md` — add 5 new plugins
- `Mark-LIII/plugins/` in jarvis branch — copy new plugins

**Total after Phase 3:** 40 plugins (39 + _soundwave_client) — 11 core + 5 community + 5 vision fix + 5 input/workspace + 5 intelligence + 8 Soundwave + 1 bridge

## Success Criteria

- [ ] All 5 new plugins py_compile ok
- [ ] action_logger log/list/search/stats/export works, JSONL append-only, max 10k trim
- [ ] error_recovery retry/fallback/classify/heal/wrap works, exponential backoff, 3-tier fallback
- [ ] workflow_engine create/run/list/show/delete/edit/add_step/remove_step/export/import works, JSON persistence, conditionals simple, scheduler optional
- [ ] self_learner correct/learn/recall/preferences/corrections/suggest/stats works, learns from 3+ corrections
- [ ] proactive_assistant check/suggest/enable/disable/status/history/feedback/triggers works, background thread, local checks battery/disk/large files/time-based
- [ ] Docs updated
- [ ] Copied to jarvis branch and pushed
- [ ] Arena branch pushed

## References

- Mark LIII memory_manager.py, undo.py, confirm.py, action_loader.py — https://github.com/FatihMakes/Mark-LIII
- ONEPUNCHMAN411/Jarvis brain/macro_executor.py, process_watcher.py, file_organizer.py — https://github.com/ONEPUNCHMAN411/Jarvis
- upgraderguy777/jarvis-plugins notification_reader.py background watcher, magi_system.py 3 personas — https://github.com/upgraderguy777/jarvis-plugins
- Phase 1: docs/PHASE1_PLAN.md — vision fix completed 2026-09-16
- Phase 2: docs/PHASE2_PLAN.md — input & workspace mastery completed 2026-09-16
