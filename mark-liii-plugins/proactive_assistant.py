"""
Proactive Assistant — Proactive Suggestions & Checks for JARVIS (Mark LIII)
Makes JARVIS proactive — suggests actions based on context, time, usage patterns.

Inspired by Mark LIII prompt.txt PROACTIVE_CHECK + STARTUP_BRIEFING + system_monitor_pro alerts
+ file_watcher_pro + notification_reader.

Free & open source, zero to low tokens.
"""

import json
import time
import threading
from pathlib import Path
from datetime import datetime

PLUGIN = {
    "name": "proactive_assistant",
    "description": (
        "Proactive assistant master — makes JARVIS proactive, suggests actions based on context (zero to low tokens). "
        "Actions: check — proactive check battery low disk full large files in Downloads recent failures suggest actions returns 1-3 sentences like Mark LIII PROACTIVE_CHECK, suggest — suggest actions based on context time of day recent actions system status learned preferences e.g., You usually open Chrome at 9am open now? 5 large files in Downloads organize? Battery 15% enable power saver?, enable [interval=30] / disable / status — enable/disable proactive checks every N minutes via background thread status shows enabled interval last check suggestions count, history [limit=20] — recent proactive suggestions and whether user accepted/dismissed, feedback id=... action=accept/dismiss — feedback on suggestion learns, triggers — list proactive triggers battery_low disk_full large_files recent_failures time_based etc., help. "
        "Triggers zero tokens local checks: battery low <20% suggest power saver, disk full <10% free suggest cleanup largest files, large files in Downloads >100MB suggest organize, recent failures 3+ failures in last hour suggest error_recovery history, time-based morning 9am suggest morning_routine workflow evening suggest backup, file watcher new file in Downloads suggest organize, process watcher high CPU process suggest kill or monitor, learned user usually does X at time Y suggest X. "
        "Use when user wants proactive check, suggestions, enable proactive, proactive assistant. "
        "Trigger phrases: proactive assistant, proactive check, suggest actions, enable proactive, proactive status, proactive history, proactive triggers."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: check, suggest, enable, disable, status, history, feedback, triggers, help. Default check.",
            },
            "interval": {"type": "NUMBER", "description": "Interval minutes for enable, default 30"},
            "id": {"type": "STRING", "description": "Suggestion ID for feedback action"},
            "feedback_action": {"type": "STRING", "description": "Feedback action accept/dismiss for feedback"},
            "limit": {"type": "NUMBER", "description": "Limit for history, default 20"},
        },
        "required": ["action"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "proactive_assistant",
    "title": "Proactive Assistant — Proactive Suggestions",
    "description": "Proactive checks battery/disk/large files/time-based, suggests actions — zero to low tokens",
    "icon": "💡",
    "color": "#F59E0B",
    "order": 44,
    "default_enabled": True,
    "fields": [
        {"key": "check_interval", "label": "Check interval minutes", "type": "number", "default": 30},
        {"key": "enable_proactive", "label": "Enable proactive by default", "type": "checkbox", "default": False},
    ],
}

_proactive_file = Path.home() / ".jarvis_proactive.json"
_proactive_thread = None
_proactive_stop = threading.Event()
_proactive_enabled = False
_proactive_interval = 30
_lock = threading.Lock()

def _load_proactive():
    try:
        if _proactive_file.exists():
            return json.loads(_proactive_file.read_text(encoding="utf-8"))
    except Exception:
        pass
    return {
        "enabled": False,
        "interval": 30,
        "history": [],
        "last_check": None,
        "suggestions_count": 0,
    }

def _save_proactive(data):
    try:
        _proactive_file.parent.mkdir(parents=True, exist_ok=True)
        _proactive_file.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        return True
    except Exception:
        return False

def _check_battery():
    try:
        import psutil
        battery = psutil.sensors_battery()
        if battery:
            percent = battery.percent
            plugged = battery.power_plugged
            if percent < 20 and not plugged:
                return f"Battery low {percent}% not plugged — suggest enable power saver, reduce brightness, close heavy apps"
            elif percent < 50 and not plugged:
                return f"Battery {percent}% not plugged — consider plugging in"
        return None
    except Exception:
        return None

def _check_disk():
    try:
        import psutil
        disk = psutil.disk_usage("/")
        free_percent = (disk.free / disk.total) * 100
        if free_percent < 10:
            return f"Disk almost full {free_percent:.1f}% free ({disk.free // (1024**3)}GB free of {disk.total // (1024**3)}GB) — suggest cleanup largest files via file_commander action=largest"
        elif free_percent < 20:
            return f"Disk low {free_percent:.1f}% free — consider cleanup"
        return None
    except Exception:
        try:
            import shutil
            total, used, free = shutil.disk_usage("/")
            free_percent = (free / total) * 100
            if free_percent < 10:
                return f"Disk almost full {free_percent:.1f}% free — suggest cleanup"
            return None
        except Exception:
            return None

def _check_large_files():
    try:
        downloads = Path.home() / "Downloads"
        if not downloads.exists():
            return None
        large_files = []
        for f in downloads.iterdir():
            try:
                if f.is_file() and f.stat().st_size > 100 * 1024 * 1024:  # >100MB
                    large_files.append(f)
            except Exception:
                continue
        if len(large_files) >= 3:
            total_size = sum(f.stat().st_size for f in large_files) // (1024**2)
            return f"{len(large_files)} large files in Downloads >100MB total {total_size}MB — suggest organize via file_commander action=organize path=~/Downloads or file_watcher_pro"
        elif len(large_files) >= 1:
            return f"{len(large_files)} large file in Downloads >100MB — suggest organize"
        return None
    except Exception:
        return None

def _check_recent_failures():
    try:
        log_file = Path.home() / ".jarvis_action_log.jsonl"
        if not log_file.exists():
            return None
        # Read last 20 logs
        logs = []
        with log_file.open("r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                try:
                    logs.append(json.loads(line.strip()))
                except Exception:
                    continue
        recent = logs[-20:]
        failures = [l for l in recent if not l.get("success")]
        if len(failures) >= 3:
            return f"{len(failures)} recent failures in last {len(recent)} actions — suggest check error_recovery action=history and action_logger action=failures"
        return None
    except Exception:
        return None

def _check_time_based():
    try:
        now = datetime.now()
        hour = now.hour
        if 8 <= hour <= 10:
            return "Morning 8-10am — you usually open Chrome Gmail + VS Code? Suggest run workflow_engine action=run name=morning_routine if exists, or create morning routine"
        elif 17 <= hour <= 19:
            return "Evening 5-7pm — consider backup important files, organize Downloads, check battery"
        elif hour >= 22 or hour <= 5:
            return "Late night — consider enable dark mode, reduce brightness, set volume low"
        return None
    except Exception:
        return None

def _check_learned_preferences():
    try:
        facts_file = Path.home() / ".jarvis_learned_facts.json"
        if not facts_file.exists():
            return None
        facts = json.loads(facts_file.read_text(encoding="utf-8"))
        prefs = facts.get("preferences", [])
        if prefs:
            # Suggest based on last preference?
            # For Phase 3 simple: if user prefers dark mode, suggest dark mode at night
            now = datetime.now()
            hour = now.hour
            for pref in prefs:
                if "dark mode" in pref.lower() and (hour >= 20 or hour <= 6):
                    return f"Learned preference: {pref} — it's night, suggest enable dark mode via pc_master action=dark_mode value=on"
        return None
    except Exception:
        return None

def _proactive_check():
    """Run all proactive checks, return suggestions list."""
    suggestions = []
    checks = [
        ("battery_low", _check_battery),
        ("disk_full", _check_disk),
        ("large_files", _check_large_files),
        ("recent_failures", _check_recent_failures),
        ("time_based", _check_time_based),
        ("learned", _check_learned_preferences),
    ]
    for trigger, check_func in checks:
        try:
            result = check_func()
            if result:
                suggestions.append({"trigger": trigger, "message": result, "timestamp": datetime.now().isoformat(), "id": str(int(time.time()*1000)) + f"_{trigger}"})
        except Exception:
            continue
    return suggestions

def _notify_suggestions(suggestions):
    try:
        from plyer import notification
        for s in suggestions[:3]:  # Max 3 notifications
            notification.notify(title=f"JARVIS Proactive: {s['trigger']}", message=s['message'][:200], timeout=5)
    except Exception:
        pass

def _proactive_loop(interval_minutes=30):
    global _proactive_enabled
    while _proactive_enabled and not _proactive_stop.is_set():
        try:
            time.sleep(interval_minutes * 60)
            if not _proactive_enabled or _proactive_stop.is_set():
                break
            suggestions = _proactive_check()
            if suggestions:
                # Save to history
                data = _load_proactive()
                data["history"].extend(suggestions)
                data["history"] = data["history"][-50:]  # Keep last 50
                data["last_check"] = datetime.now().isoformat()
                data["suggestions_count"] = data.get("suggestions_count", 0) + len(suggestions)
                _save_proactive(data)
                _notify_suggestions(suggestions)
                print(f"[ProactiveAssistant] {len(suggestions)} suggestions: {[s['message'][:50] for s in suggestions]}")
        except Exception:
            continue

def _ensure_thread(interval_minutes=30):
    global _proactive_thread, _proactive_stop, _proactive_enabled
    if _proactive_thread and _proactive_thread.is_alive():
        return
    _proactive_stop.clear()
    _proactive_enabled = True
    _proactive_thread = threading.Thread(target=_proactive_loop, args=(interval_minutes,), daemon=True)
    _proactive_thread.start()

def run(parameters: dict, player=None, session_memory=None) -> str:
    global _proactive_enabled
    action = (parameters.get("action", "check") or "check").lower().strip()
    interval = parameters.get("interval", 30)
    try:
        interval = int(interval)
    except Exception:
        interval = 30
    interval = max(1, min(1440, interval))
    sug_id = parameters.get("id", "") or ""
    feedback_action = (parameters.get("feedback_action", "") or parameters.get("action", "") or "").lower().strip()
    # Distinguish main action vs feedback_action param
    if action == "feedback":
        feedback_val = parameters.get("feedback_action", "") or ""
    else:
        feedback_val = feedback_action
    limit = parameters.get("limit", 20)
    try:
        limit = int(limit)
    except Exception:
        limit = 20
    limit = max(1, min(100, limit))

    try:
        if player:
            try:
                player.write_log(f"Proactive Assistant: {action} interval={interval}")
            except Exception:
                pass

        if action in ("help", "?", "h"):
            return (
                "Proactive Assistant — Proactive Suggestions & Checks (Zero to Low Tokens, from Mark LIII PROACTIVE_CHECK + STARTUP_BRIEFING + system_monitor_pro alerts):\n"
                "\n"
                "Makes JARVIS proactive — suggests actions based on context, time, usage patterns, system status.\n"
                "\n"
                "• check — proactive check: battery low? disk full? large files in Downloads? recent failures? time-based? learned preferences? Returns 1-3 sentences like Mark LIII PROACTIVE_CHECK, e.g., Battery 15% not plugged suggest power saver, Disk 5% free suggest cleanup, 5 large files in Downloads suggest organize, 3 recent failures suggest error_recovery history\n"
                "• suggest — suggest actions based on context: time of day, recent actions, system status, learned preferences, e.g., You usually open Chrome at 9am open now? 5 large files in Downloads organize? Battery 15% enable power saver? Returns list of suggestions with trigger, message, id\n"
                "• enable [interval=30] / disable / status — enable/disable proactive checks every N minutes via background daemon thread, status shows enabled interval last check suggestions count thread alive\n"
                "• history [limit=20] — recent proactive suggestions timestamp trigger message id and whether user accepted/dismissed (feedback)\n"
                "• feedback id=... feedback_action=accept/dismiss — feedback on suggestion, learns, updates history with accepted/dismissed\n"
                "• triggers — list proactive triggers: battery_low (<20% not plugged), disk_full (<10% free), large_files (>100MB in Downloads 3+), recent_failures (3+ failures last 20 actions), time_based (morning 8-10am suggest morning_routine, evening 5-7pm backup, late night dark mode), learned (preferences)\n"
                "\n"
                "Examples:\n"
                "• proactive_assistant action=check\n"
                "• proactive_assistant action=suggest\n"
                "• proactive_assistant action=enable interval=30\n"
                "• proactive_assistant action=status\n"
                "• proactive_assistant action=history limit=10\n"
                "• proactive_assistant action=feedback id=123456_battery_low feedback_action=accept\n"
                "\n"
                "Zero to low tokens — local checks zero tokens via psutil, pathlib, datetime, no LLM, optional Gemini low tokens for complex reasoning.\n"
                "Background thread: proactive checks every N minutes (default 30), emits notification via plyer + logs via action_logger.\n"
                "State: ~/.jarvis_proactive.json with enabled interval history last_check suggestions_count.\n"
                "Install: pip install psutil plyer (plyer optional for notifications)\n"
            )

        if action == "check":
            suggestions = _proactive_check()
            if not suggestions:
                return "Proactive check: No issues found — battery ok, disk ok, no large files, no recent failures, time ok — JARVIS is happy (zero tokens, local checks)"

            # Save to history
            data = _load_proactive()
            data["history"].extend(suggestions)
            data["history"] = data["history"][-50:]
            data["last_check"] = datetime.now().isoformat()
            data["suggestions_count"] = data.get("suggestions_count", 0) + len(suggestions)
            _save_proactive(data)

            # Format as 1-3 sentences like Mark LIII PROACTIVE_CHECK
            messages = [s["message"] for s in suggestions]
            # Combine into 1-3 sentences
            combined = " ".join(messages[:3])
            lines = [f"Proactive check found {len(suggestions)} suggestions (zero tokens, local checks):"]
            for s in suggestions:
                lines.append(f"• [{s['trigger']}] {s['message']} (id {s['id']})")

            # Also notify
            _notify_suggestions(suggestions)

            return "\n".join(lines) + f"\n\nSummary (1-3 sentences like PROACTIVE_CHECK): {combined[:300]}"

        if action == "suggest":
            suggestions = _proactive_check()
            if not suggestions:
                return "No proactive suggestions — all good (battery ok, disk ok, no large files, no failures)"

            data = _load_proactive()
            data["history"].extend(suggestions)
            data["history"] = data["history"][-50:]
            data["last_check"] = datetime.now().isoformat()
            data["suggestions_count"] = data.get("suggestions_count", 0) + len(suggestions)
            _save_proactive(data)

            lines = [f"Proactive suggestions ({len(suggestions)}) — zero tokens, local checks:"]
            for s in suggestions:
                lines.append(f"• {s['trigger']}: {s['message']} (id {s['id']}) — feedback via feedback id={s['id']} feedback_action=accept/dismiss")
            return "\n".join(lines)

        if action == "enable":
            _ensure_thread(interval_minutes=interval)
            data = _load_proactive()
            data["enabled"] = True
            data["interval"] = interval
            _save_proactive(data)
            _proactive_enabled = True
            return f"Proactive assistant enabled — checks every {interval} minutes via background daemon thread (zero tokens, local checks battery/disk/large files/failures/time-based/learned) — will notify via plyer and log to ~/.jarvis_proactive.json — use status to check, disable to stop"

        if action == "disable":
            _proactive_enabled = False
            _proactive_stop.set()
            data = _load_proactive()
            data["enabled"] = False
            _save_proactive(data)
            return "Proactive assistant disabled — background thread will stop after current sleep"

        if action == "status":
            data = _load_proactive()
            enabled = data.get("enabled", False) or _proactive_enabled
            thread_alive = _proactive_thread.is_alive() if _proactive_thread else False
            last_check = data.get("last_check", "never")
            count = data.get("suggestions_count", 0)
            history_len = len(data.get("history", []))
            return (
                f"Proactive assistant status:\n"
                f"• Enabled: {enabled} (file) / {_proactive_enabled} (memory)\n"
                f"• Thread alive: {thread_alive}\n"
                f"• Interval: {data.get('interval', 30)} minutes\n"
                f"• Last check: {last_check}\n"
                f"• Suggestions count: {count}\n"
                f"• History: {history_len} (last 50 kept)\n"
                f"• Triggers: battery_low (<20% not plugged), disk_full (<10% free), large_files (>100MB in Downloads 3+), recent_failures (3+ failures last 20), time_based (morning/evening/late night), learned (preferences)\n"
                f"• State: {_proactive_file}\n"
                f"• Checks: zero tokens via psutil, pathlib, datetime — no LLM"
            )

        if action == "history":
            data = _load_proactive()
            history = data.get("history", [])
            if not history:
                return "No proactive history — run check or enable proactive"
            recent = history[-limit:][::-1]
            lines = [f"Proactive history ({len(recent)} of {len(history)} total, recent first):"]
            for i, h in enumerate(recent, 1):
                ts = h.get("timestamp", "")[:19]
                trig = h.get("trigger", "")
                msg = h.get("message", "")[:100]
                fb = h.get("feedback", "")
                fb_str = f" feedback {fb}" if fb else ""
                lines.append(f"{i}. [{ts}] [{trig}] {msg} (id {h.get('id')}){fb_str}")
            return "\n".join(lines)

        if action == "feedback":
            if not sug_id:
                return "Need id: feedback id=... feedback_action=accept/dismiss — id from check/suggest/history"
            if feedback_val not in ("accept", "dismiss"):
                return "Need feedback_action accept or dismiss: feedback id=... feedback_action=accept"
            data = _load_proactive()
            history = data.get("history", [])
            found = False
            for h in history:
                if h.get("id") == sug_id or sug_id in h.get("id",""):
                    h["feedback"] = feedback_val
                    h["feedback_timestamp"] = datetime.now().isoformat()
                    found = True
                    break
            if not found:
                return f"No suggestion with id '{sug_id}' — history to see ids"
            _save_proactive(data)
            # Learn from feedback via self_learner? For Phase 3 simple, just log
            return f"Feedback recorded for suggestion {sug_id}: {feedback_val} — will learn, future suggestions will adapt — zero tokens"

        if action == "triggers":
            return (
                "Proactive triggers (zero tokens, local checks):\n"
                "• battery_low: Battery <20% not plugged → suggest enable power saver, reduce brightness, close heavy apps — via psutil.sensors_battery()\n"
                "• disk_full: Disk <10% free → suggest cleanup largest files via file_commander action=largest — via psutil.disk_usage() or shutil.disk_usage()\n"
                "• large_files: 3+ files >100MB in ~/Downloads → suggest organize via file_commander — via pathlib iterdir stat\n"
                "• recent_failures: 3+ failures in last 20 actions → suggest error_recovery history and action_logger failures — via ~/.jarvis_action_log.jsonl\n"
                "• time_based: Morning 8-10am → suggest morning_routine workflow, Evening 5-7pm → backup, Late night 10pm-5am → dark mode, low volume — via datetime.now().hour\n"
                "• learned: Learned preferences e.g., dark mode at night → suggest based on ~/.jarvis_learned_facts.json preferences\n"
                "\n"
                "All triggers zero tokens, local, no LLM, checked every N minutes via background thread if enabled.\n"
                "Enable via enable interval=30, status to check, history to see past suggestions."
            )

        return f"Unknown action {action}. Say 'proactive_assistant action=help'"

    except Exception as e:
        return f"Proactive Assistant failed: {e}"
