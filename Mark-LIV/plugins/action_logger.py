"""
Action Logger — Audit Trail & Replay for JARVIS (Mark LIII)
Makes JARVIS accountable — logs all actions, search, stats, replay.

Inspired by Mark LIII memory_manager + undo journals + action_loader logs
+ ONEPUNCHMAN411 macro_executor.

Free & open source, zero tokens.
"""

import json
import time
from pathlib import Path
from datetime import datetime

PLUGIN = {
    "name": "action_logger",
    "description": (
        "Action audit trail & replay master — makes JARVIS accountable, logs all actions (zero tokens). "
        "Actions: log action=... params=... result=... [duration=...] [success=true/false] — log action to ~/.jarvis_action_log.jsonl JSON Lines timestamp action params result duration success, list [limit=20] [action=...] [success=true/false] — list recent logs filter by action success, search query=... [limit=20] — search logs by query in action/params/result fuzzy, stats — stats total actions success rate top actions failure reasons avg duration last 24h count, export path=... [format=json/csv] — export logs to file, clear [confirm=true] — clear logs with confirmation, replay id=... — replay action by log id re-run with same params via importlib, tail [n=20] — tail last N logs, failures [limit=20] — list only failures, help. "
        "Use when user wants to log action, list logs, search logs, stats, export logs, replay action, action history, audit trail. "
        "Trigger phrases: action logger, log action, list logs, search logs, stats, export logs, replay action, action history, audit trail, logger pro."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: log, list, search, stats, export, clear, replay, tail, failures, help. Default list.",
            },
            "log_action": {"type": "STRING", "description": "Action name to log for log action, e.g. pc_master, file_commander"},
            "params": {"type": "STRING", "description": "Params JSON string for log action, e.g. {\"action\": \"volume\", \"value\": 50}"},
            "result": {"type": "STRING", "description": "Result string for log action"},
            "duration": {"type": "NUMBER", "description": "Duration seconds for log action"},
            "success": {"type": "BOOLEAN", "description": "Success true/false for log action, default true"},
            "query": {"type": "STRING", "description": "Search query for search action"},
            "limit": {"type": "NUMBER", "description": "Limit for list/search/tail/failures, default 20"},
            "filter_action": {"type": "STRING", "description": "Filter by action name for list, e.g. pc_master"},
            "id": {"type": "STRING", "description": "Log ID or index for replay, e.g. 0 or timestamp"},
            "path": {"type": "STRING", "description": "Export path for export action, e.g. ~/action_logs.json"},
            "format": {"type": "STRING", "description": "Export format json/csv, default json"},
            "confirm": {"type": "BOOLEAN", "description": "Confirm clear true/false"},
            "n": {"type": "NUMBER", "description": "N for tail action, default 20"},
        },
        "required": ["action"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "action_logger",
    "title": "Action Logger — Audit Trail & Replay",
    "description": "Logs all JARVIS actions to JSONL, search, stats, replay — zero tokens",
    "icon": "📝",
    "color": "#3B82F6",
    "order": 40,
    "default_enabled": True,
    "fields": [
        {"key": "log_file", "label": "Log file path", "type": "text", "default": "~/.jarvis_action_log.jsonl"},
        {"key": "max_lines", "label": "Max lines to keep (auto-trim)", "type": "number", "default": 10000},
    ],
}

_log_file = Path.home() / ".jarvis_action_log.jsonl"
_max_lines = 10000

def _ensure_log_file():
    try:
        _log_file.parent.mkdir(parents=True, exist_ok=True)
        if not _log_file.exists():
            _log_file.touch()
    except Exception:
        pass

def _read_logs():
    _ensure_log_file()
    logs = []
    try:
        with _log_file.open("r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    logs.append(json.loads(line))
                except Exception:
                    continue
    except Exception:
        pass
    return logs

def _write_log(entry):
    _ensure_log_file()
    try:
        with _log_file.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        # Auto-trim if too many lines
        try:
            logs = _read_logs()
            if len(logs) > _max_lines:
                # Keep last _max_lines
                trimmed = logs[-_max_lines:]
                with _log_file.open("w", encoding="utf-8") as f:
                    for e in trimmed:
                        f.write(json.dumps(e, ensure_ascii=False) + "\n")
        except Exception:
            pass
        return True
    except Exception:
        return False

def run(parameters: dict, player=None, session_memory=None) -> str:
    action = (parameters.get("action", "list") or "list").lower().strip()
    log_action = parameters.get("log_action", "") or parameters.get("action", "") or ""
    # Distinguish main action vs log_action param — if user passed log_action param use it, else if main action is log, use log_action param
    # For log action, main action is "log", and log_action param is actual action name
    if action == "log":
        actual_action = parameters.get("log_action", "") or parameters.get("filter_action", "") or "unknown"
    else:
        actual_action = log_action

    params_str = parameters.get("params", "") or ""
    result_str = parameters.get("result", "") or ""
    duration = parameters.get("duration", 0)
    try:
        duration = float(duration)
    except Exception:
        duration = 0
    success = parameters.get("success", True)
    if isinstance(success, str):
        success = success.lower() in ("true", "1", "yes")
    query = parameters.get("query", "") or ""
    limit = parameters.get("limit", 20)
    try:
        limit = int(limit)
    except Exception:
        limit = 20
    limit = max(1, min(100, limit))
    filter_action = parameters.get("filter_action", "") or ""
    log_id = parameters.get("id", "") or ""
    path_str = parameters.get("path", "") or ""
    fmt = (parameters.get("format", "json") or "json").lower().strip()
    confirm = parameters.get("confirm", False)
    if isinstance(confirm, str):
        confirm = confirm.lower() in ("true", "1", "yes")
    n = parameters.get("n", 20)
    try:
        n = int(n)
    except Exception:
        n = 20
    n = max(1, min(100, n))

    try:
        if player:
            try:
                player.write_log(f"Action Logger: {action} query={query} filter={filter_action}")
            except Exception:
                pass

        if action in ("help", "?", "h"):
            return (
                "Action Logger — Audit Trail & Replay (Zero Tokens, from Mark LIII memory_manager + undo journals):\n"
                "\n"
                "Logs all JARVIS actions to ~/.jarvis_action_log.jsonl JSON Lines append-only, max 10k lines auto-trim oldest, for audit trail, debugging, self-improvement.\n"
                "\n"
                "• log log_action=... params=... result=... [duration=...] [success=true/false] — log action, e.g., log log_action=pc_master params={\"action\":\"volume\",\"value\":50} result=Volume set to 50 duration=0.5 success=true, saves timestamp, action, params, result, duration, success, id via timestamp\n"
                "• list [limit=20] [filter_action=...] [success=true/false] — list recent logs, filter by action name e.g., pc_master, filter by success true/false\n"
                "• search query=... [limit=20] — search logs by query in action/params/result fuzzy case-insensitive\n"
                "• stats — stats: total actions, success rate, top actions count, failure reasons, avg duration, last 24h count, last failure\n"
                "• export path=... [format=json/csv] — export logs to file JSON array or CSV, path e.g., ~/action_logs.json\n"
                "• clear [confirm=true] — clear logs, needs confirm=true to actually clear\n"
                "• replay id=... — replay action by log id (timestamp or index), re-runs via importlib calling plugin's run() with saved params, returns result\n"
                "• tail [n=20] — tail last N logs like tail -f, most recent first\n"
                "• failures [limit=20] — list only failures with error messages\n"
                "\n"
                "Examples:\n"
                "• action_logger action=log log_action=pc_master params={\"action\":\"volume\",\"value\":50} result=Volume set to 50 success=true\n"
                "• action_logger action=list limit=10 filter_action=pc_master\n"
                "• action_logger action=search query=volume limit=10\n"
                "• action_logger action=stats\n"
                "• action_logger action=export path=~/logs.json format=json\n"
                "• action_logger action=replay id=2026-09-16T10:00:00\n"
                "\n"
                "Zero tokens, pure local via json, pathlib, datetime, JSONL.\n"
                "Log file: ~/.jarvis_action_log.jsonl, max 10k lines auto-trim.\n"
            )

        if action == "log":
            if not parameters.get("log_action"):
                return "Need log_action: log log_action=pc_master params={...} result=... — log_action is actual action name to log"
            try:
                params_json = {}
                if params_str:
                    try:
                        params_json = json.loads(params_str) if isinstance(params_str, str) else params_str
                    except Exception:
                        params_json = {"raw": params_str}
                entry = {
                    "timestamp": datetime.now().isoformat(),
                    "id": str(int(time.time()*1000)),
                    "action": parameters.get("log_action", "unknown"),
                    "params": params_json,
                    "result": result_str[:1000] if result_str else "",
                    "duration": duration,
                    "success": bool(success),
                }
                if _write_log(entry):
                    return f"Logged action '{entry['action']}' id {entry['id']} success {entry['success']} duration {duration}s to {_log_file} — zero tokens"
                return "Failed to write log"
            except Exception as e:
                return f"Log failed: {e}"

        if action == "list":
            logs = _read_logs()
            if not logs:
                return "No action logs — log via log action"
            # Filter
            filtered = logs
            if filter_action:
                filtered = [l for l in filtered if filter_action.lower() in l.get("action", "").lower()]
            if parameters.get("success") is not None:
                # Only filter if success param explicitly passed
                succ_filter = parameters.get("success")
                if isinstance(succ_filter, bool) or (isinstance(succ_filter, str) and succ_filter.lower() in ("true", "false")):
                    if isinstance(succ_filter, str):
                        succ_val = succ_filter.lower() == "true"
                    else:
                        succ_val = bool(succ_filter)
                    filtered = [l for l in filtered if l.get("success") == succ_val]
            # Recent first
            filtered = filtered[-limit:][::-1]
            lines = []
            for i, log in enumerate(filtered, 1):
                ts = log.get("timestamp", "")[:19]
                act = log.get("action", "unknown")
                succ = "✓" if log.get("success") else "✗"
                res = log.get("result", "")[:80]
                lines.append(f"{i}. [{ts}] {succ} {act} — {res} (id {log.get('id','')})")
            return f"Action logs ({len(filtered)} of {len(logs)} total, recent first):\n" + "\n".join(lines)

        if action == "search":
            if not query:
                return "Need query: search query=volume"
            logs = _read_logs()
            if not logs:
                return "No logs"
            q_lower = query.lower()
            matched = []
            for log in logs:
                # Search in action, params, result
                hay = f"{log.get('action','')} {json.dumps(log.get('params',{}))} {log.get('result','')}".lower()
                if q_lower in hay:
                    matched.append(log)
            matched = matched[-limit:][::-1]
            if not matched:
                return f"No logs matching query '{query}'"
            lines = []
            for i, log in enumerate(matched, 1):
                ts = log.get("timestamp", "")[:19]
                act = log.get("action", "")
                res = log.get("result", "")[:80]
                lines.append(f"{i}. [{ts}] {act} — {res} (id {log.get('id','')})")
            return f"Search '{query}' matched {len(matched)} logs:\n" + "\n".join(lines)

        if action == "stats":
            logs = _read_logs()
            if not logs:
                return "No logs — stats empty"
            total = len(logs)
            successes = sum(1 for l in logs if l.get("success"))
            failures = total - successes
            success_rate = (successes / total * 100) if total > 0 else 0
            # Top actions
            from collections import Counter
            actions = [l.get("action", "unknown") for l in logs]
            top = Counter(actions).most_common(5)
            # Avg duration
            durations = [l.get("duration", 0) for l in logs if l.get("duration", 0) > 0]
            avg_dur = sum(durations) / len(durations) if durations else 0
            # Last 24h
            now = datetime.now()
            last_24h = 0
            for l in logs:
                try:
                    ts = datetime.fromisoformat(l.get("timestamp", ""))
                    if (now - ts).total_seconds() < 24*3600:
                        last_24h += 1
                except Exception:
                    continue
            # Last failure
            last_failure = None
            for l in reversed(logs):
                if not l.get("success"):
                    last_failure = l
                    break

            lines = [
                f"Action Logger stats (zero tokens, local {len(logs)} logs):",
                f"• Total actions: {total}",
                f"• Success: {successes} ({success_rate:.1f}%), Failures: {failures} ({100-success_rate:.1f}%)",
                f"• Avg duration: {avg_dur:.2f}s",
                f"• Last 24h: {last_24h} actions",
                f"• Top actions:",
            ]
            for act, cnt in top:
                lines.append(f"  - {act}: {cnt}")
            if last_failure:
                lines.append(f"• Last failure: [{last_failure.get('timestamp','')[:19]}] {last_failure.get('action')} — {last_failure.get('result','')[:100]}")
            lines.append(f"• Log file: {_log_file}, max {_max_lines} lines auto-trim")
            return "\n".join(lines)

        if action == "export":
            if not path_str:
                return "Need path: export path=~/logs.json format=json/csv"
            logs = _read_logs()
            if not logs:
                return "No logs to export"
            try:
                export_path = Path(path_str).expanduser()
                export_path.parent.mkdir(parents=True, exist_ok=True)
                if fmt == "csv":
                    import csv
                    with export_path.open("w", newline="", encoding="utf-8") as f:
                        writer = csv.DictWriter(f, fieldnames=["timestamp", "id", "action", "params", "result", "duration", "success"])
                        writer.writeheader()
                        for log in logs:
                            row = dict(log)
                            row["params"] = json.dumps(row.get("params", {}))
                            writer.writerow(row)
                else:
                    export_path.write_text(json.dumps(logs, indent=2, ensure_ascii=False), encoding="utf-8")
                return f"Exported {len(logs)} logs to {export_path} format {fmt} — {export_path.stat().st_size} bytes"
            except Exception as e:
                return f"Export failed: {e}"

        if action == "clear":
            if not confirm:
                return "Need confirm=true to clear logs — this will delete all logs: clear confirm=true"
            try:
                _ensure_log_file()
                _log_file.write_text("", encoding="utf-8")
                return f"Cleared all logs in {_log_file}"
            except Exception as e:
                return f"Clear failed: {e}"

        if action == "replay":
            if not log_id:
                return "Need id: replay id=... — id from list action, timestamp or id field"
            logs = _read_logs()
            if not logs:
                return "No logs"
            # Find by id or timestamp or index
            target = None
            for log in logs:
                if log.get("id") == log_id or log.get("timestamp") == log_id or log_id in log.get("timestamp", ""):
                    target = log
                    break
            # Try index
            if not target:
                try:
                    idx = int(log_id)
                    if 0 <= idx < len(logs):
                        target = logs[idx]
                except Exception:
                    pass
            if not target:
                return f"No log found with id '{log_id}' — list to see ids"

            # Replay via importlib
            try:
                import importlib.util
                action_name = target.get("action", "")
                params = target.get("params", {})
                if not action_name:
                    return "Log has no action name to replay"

                # Try find plugin file
                # Search mark-liii-plugins and Mark-LIII/plugins
                possible_paths = [
                    Path(__file__).parent / f"{action_name}.py",
                    Path.home() / "Mark-LIII" / "plugins" / f"{action_name}.py",
                    Path(__file__).parent.parent / "Mark-LIII" / "plugins" / f"{action_name}.py",
                ]
                plugin_path = None
                for p in possible_paths:
                    if p.exists():
                        plugin_path = p
                        break
                if not plugin_path:
                    # Try current dir
                    import pathlib
                    for p in pathlib.Path(".").rglob(f"{action_name}.py"):
                        if p.exists():
                            plugin_path = p
                            break

                if not plugin_path or not plugin_path.exists():
                    return f"Cannot replay — plugin file {action_name}.py not found in mark-liii-plugins/ or Mark-LIII/plugins/"

                spec = importlib.util.spec_from_file_location(action_name, plugin_path)
                mod = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(mod)
                if not hasattr(mod, 'run'):
                    return f"Plugin {action_name} has no run() function"

                result = mod.run(params)
                # Log replay
                _write_log({
                    "timestamp": datetime.now().isoformat(),
                    "id": str(int(time.time()*1000)),
                    "action": f"{action_name} (replay of {target.get('id')})",
                    "params": params,
                    "result": str(result)[:1000],
                    "duration": 0,
                    "success": True,
                })
                return f"Replayed action '{action_name}' id {target.get('id')} with params {params} — result: {result}"
            except Exception as e:
                return f"Replay failed: {e}"

        if action == "tail":
            logs = _read_logs()
            if not logs:
                return "No logs"
            tail_logs = logs[-n:][::-1]
            lines = []
            for i, log in enumerate(tail_logs, 1):
                ts = log.get("timestamp", "")[:19]
                act = log.get("action", "")
                succ = "✓" if log.get("success") else "✗"
                res = log.get("result", "")[:80]
                lines.append(f"{i}. [{ts}] {succ} {act} — {res}")
            return f"Tail last {len(tail_logs)} logs (recent first):\n" + "\n".join(lines)

        if action == "failures":
            logs = _read_logs()
            failures = [l for l in logs if not l.get("success")]
            if not failures:
                return "No failures — all actions succeeded"
            failures = failures[-limit:][::-1]
            lines = []
            for i, log in enumerate(failures, 1):
                ts = log.get("timestamp", "")[:19]
                act = log.get("action", "")
                res = log.get("result", "")[:150]
                lines.append(f"{i}. [{ts}] {act} — {res} (id {log.get('id')})")
            return f"Failures ({len(failures)} of {len([l for l in logs if not l.get('success')])} total):\n" + "\n".join(lines)

        return f"Unknown action {action}. Say 'action_logger action=help'"

    except Exception as e:
        return f"Action Logger failed: {e}"
