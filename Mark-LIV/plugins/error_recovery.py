"""
Error Recovery — Auto-Retry & Fallback Strategies for JARVIS (Mark LIII)
Makes JARVIS self-healing — retry with backoff, fallback tree→vision→ask, classify, heal.

Inspired by vision_bridge tree first vision second + discord_messenger 3-tier + Mark LIII confirm gate + undo
+ action_logger failures.

Free & open source, zero to low tokens.
"""

import time
import json
from pathlib import Path
from datetime import datetime

PLUGIN = {
    "name": "error_recovery",
    "description": (
        "Error recovery auto-retry & fallback master — makes JARVIS self-healing (zero to low tokens). "
        "Actions: retry action=... params=... [retries=3] [backoff=1.0] — retry action with exponential backoff 1s 2s 4s, fallback action=... params=... [strategies=tree,vision,ask] — try fallback strategies in order e.g., find element via tree accessibility_master then vision vision_bridge then ask user then fail gracefully, classify error=... — classify error not_found/permission/timeout/invalid_params/unknown + suggested fix, heal error=... context=... — suggest self-heal e.g., pywinauto not installed → pip install pywinauto, window not found → try list windows, file not found → check path, wrap action=... params=... — wrap action with auto error recovery try action if fails classify retry backoff fallback heal suggestion return final result + recovery steps, history [limit=20] — recent recovery attempts success rate, help. "
        "Use when action fails, need retry, fallback, error classification, self-heal, error recovery. "
        "Trigger phrases: error recovery, retry action, fallback, classify error, heal error, wrap action, recovery history, self-healing, error handling."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: retry, fallback, classify, heal, wrap, history, help. Default help.",
            },
            "target_action": {"type": "STRING", "description": "Target action name to retry/fallback/wrap, e.g. pc_master, accessibility_master"},
            "params": {"type": "STRING", "description": "Params JSON string for target action, e.g. {\"action\": \"find\", \"name\": \"File\"}"},
            "retries": {"type": "NUMBER", "description": "Retries count for retry, default 3"},
            "backoff": {"type": "NUMBER", "description": "Backoff base seconds for retry, default 1.0, exponential 1s 2s 4s"},
            "strategies": {"type": "STRING", "description": "Fallback strategies comma-separated e.g. tree,vision,ask or pc_master,file_commander,ask, default tree,vision,ask"},
            "error": {"type": "STRING", "description": "Error message to classify/heal, e.g. window not found, pywinauto not installed"},
            "context": {"type": "STRING", "description": "Context for heal, e.g. Notepad, Chrome, file path"},
            "limit": {"type": "NUMBER", "description": "Limit for history, default 20"},
        },
        "required": ["action"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "error_recovery",
    "title": "Error Recovery — Auto-Retry & Fallback",
    "description": "Auto-retry with backoff, fallback tree→vision→ask, classify, heal — zero to low tokens",
    "icon": "🛠️",
    "color": "#EF4444",
    "order": 41,
    "default_enabled": True,
    "fields": [
        {"key": "default_retries", "label": "Default retries", "type": "number", "default": 3},
        {"key": "default_backoff", "label": "Default backoff base seconds", "type": "number", "default": 1.0},
    ],
}

_history_file = Path.home() / ".jarvis_error_recovery.json"
_history = []

def _load_history():
    global _history
    try:
        if _history_file.exists():
            data = json.loads(_history_file.read_text(encoding="utf-8"))
            _history = data if isinstance(data, list) else []
    except Exception:
        _history = []

def _save_history():
    try:
        _history_file.parent.mkdir(parents=True, exist_ok=True)
        # Keep last 100
        trimmed = _history[-100:]
        _history_file.write_text(json.dumps(trimmed, indent=2, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass

def _classify_error(error_msg):
    """Classify error into category + suggested fix."""
    err_lower = error_msg.lower()
    if any(k in err_lower for k in ["not found", "no window", "no element", "no file", "not exist", "could not find"]):
        return "not_found", "Check if target exists — try list action to see available windows/elements/files, check spelling, check path"
    elif any(k in err_lower for k in ["permission", "access denied", "admin", "elevation", "unauthorized"]):
        return "permission", "Run as admin or check permissions — right-click Mark LIII → Run as administrator, or check file permissions"
    elif any(k in err_lower for k in ["timeout", "timed out", "took too long"]):
        return "timeout", "Retry with longer timeout or check if target is slow — try retry with backoff, or increase timeout param"
    elif any(k in err_lower for k in ["invalid", "wrong", "bad", "parse", "json", "param"]):
        return "invalid_params", "Check params JSON format and required fields — say help for action to see required params"
    elif any(k in err_lower for k in ["not installed", "no module", "import", "pip install"]):
        return "missing_dependency", f"Install dependency — {error_msg.split('pip install')[-1] if 'pip install' in error_msg else 'pip install missing package'}"
    elif any(k in err_lower for k in ["network", "connection", "internet", "offline"]):
        return "network", "Check internet connection — ping 8.8.8.8, check WiFi, try again"
    else:
        return "unknown", "Try retry with backoff, fallback to alternative action, or check logs via action_logger"

def _heal_suggestion(error_msg, context=""):
    """Suggest self-heal based on error."""
    category, fix = _classify_error(error_msg)
    suggestions = [f"Category: {category}", f"Suggested fix: {fix}"]

    # Specific heals
    err_lower = error_msg.lower()
    if "pywinauto" in err_lower:
        suggestions.append("Heal: pip install pywinauto — Windows UI Automation tree, zero tokens")
    elif "pyautogui" in err_lower:
        suggestions.append("Heal: pip install pyautogui — mouse/keyboard control")
    elif "mss" in err_lower:
        suggestions.append("Heal: pip install mss — screenshots")
    elif "pytesseract" in err_lower or "tesseract" in err_lower:
        suggestions.append("Heal: pip install pytesseract + binary tesseract — winget install tesseract")
    elif "winsdk" in err_lower:
        suggestions.append("Heal: pip install winsdk — Windows OCR/notifications, auto-installs on first use")
    elif "window not found" in err_lower or "no window" in err_lower:
        suggestions.append("Heal: Try window_manager_pro action=list to see open windows, or accessibility_master action=list to see UI elements")
    elif "element not found" in err_lower or "no element" in err_lower:
        suggestions.append("Heal: Try accessibility_master action=list or screen_reader_pro action=elements to see available elements, or vision_bridge action=find with mode=vision")
    elif "file not found" in err_lower:
        suggestions.append(f"Heal: Check path exists — context {context}, try file_commander action=search to find file")
    elif "chrome" in err_lower and "not found" in err_lower:
        suggestions.append("Heal: Install Chrome or try browser_master action=open url=https://google.com")

    if context:
        suggestions.append(f"Context: {context} — check if {context} is open and visible")

    return "\n".join(suggestions)

def _run_plugin_action(action_name, params):
    """Run plugin action via importlib."""
    try:
        import importlib.util
        # Find plugin file
        possible_paths = [
            Path(__file__).parent / f"{action_name}.py",
            Path.home() / "Mark-LIII" / "plugins" / f"{action_name}.py",
        ]
        plugin_path = None
        for p in possible_paths:
            if p.exists():
                plugin_path = p
                break
        if not plugin_path:
            return None, f"Plugin file {action_name}.py not found"

        spec = importlib.util.spec_from_file_location(action_name, plugin_path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        if not hasattr(mod, 'run'):
            return None, f"Plugin {action_name} has no run()"

        result = mod.run(params)
        # Consider result containing "failed" or "not found" or "error" as failure?
        # For simplicity, if result contains "failed" or "not found" or "error" and not success keyword, treat as failure?
        # Actually, many plugins return error message as string, not raise — we need to detect failure by keywords
        result_lower = str(result).lower()
        if any(k in result_lower for k in ["failed", "not found", "no element", "no window", "error", "not installed"]) and "success" not in result_lower:
            # Check if it's actually success message containing "failed" as part of explanation? Heuristic: if contains "not found" or "failed" it's failure
            return result, f"Action returned failure: {result[:200]}"
        return result, None
    except Exception as e:
        return None, f"Run plugin {action_name} failed: {e}"

def run(parameters: dict, player=None, session_memory=None) -> str:
    action = (parameters.get("action", "help") or "help").lower().strip()
    target_action = parameters.get("target_action", "") or ""
    params_str = parameters.get("params", "") or ""
    retries = parameters.get("retries", 3)
    try:
        retries = int(retries)
    except Exception:
        retries = 3
    retries = max(1, min(10, retries))
    backoff = parameters.get("backoff", 1.0)
    try:
        backoff = float(backoff)
    except Exception:
        backoff = 1.0
    strategies_str = parameters.get("strategies", "tree,vision,ask") or "tree,vision,ask"
    strategies = [s.strip() for s in strategies_str.split(",") if s.strip()]
    error_msg = parameters.get("error", "") or ""
    context = parameters.get("context", "") or ""
    limit = parameters.get("limit", 20)
    try:
        limit = int(limit)
    except Exception:
        limit = 20
    limit = max(1, min(100, limit))

    try:
        if player:
            try:
                player.write_log(f"Error Recovery: {action} target={target_action} retries={retries}")
            except Exception:
                pass

        _load_history()

        if action in ("help", "?", "h"):
            return (
                "Error Recovery — Auto-Retry & Fallback Strategies (Zero to Low Tokens, from vision_bridge tree first vision second + discord_messenger 3-tier):\n"
                "\n"
                "Makes JARVIS self-healing — when action fails, auto-retry with backoff, fallback to alternative strategies, classify error, suggest heal.\n"
                "\n"
                "• retry target_action=... params=... [retries=3] [backoff=1.0] — retry action with exponential backoff 1s 2s 4s, e.g., retry find window 3 times, returns last result + retry history\n"
                "• fallback target_action=... params=... [strategies=tree,vision,ask] — try fallback strategies in order: tree (accessibility_master), vision (vision_bridge), ask (ask user), or pc_master,file_commander,ask etc., returns first success + strategies tried\n"
                "• classify error=... — classify error into not_found/permission/timeout/invalid_params/missing_dependency/network/unknown + suggested fix\n"
                "• heal error=... [context=...] — suggest self-heal: pywinauto not installed → pip install pywinauto, window not found → try list windows, file not found → check path, with specific heals for common errors\n"
                "• wrap target_action=... params=... [retries=3] [backoff=1.0] [strategies=...] — wrap action with auto error recovery: try action, if fails classify retry backoff fallback heal suggestion return final result + recovery steps taken\n"
                "• history [limit=20] — recent recovery attempts timestamp target_action success retries strategies error classification\n"
                "\n"
                "Examples:\n"
                "• error_recovery action=retry target_action=accessibility_master params={\"action\":\"find\",\"name\":\"File\"} retries=3 backoff=1.0\n"
                "• error_recovery action=fallback target_action=accessibility_master params={\"action\":\"find\",\"name\":\"Export\"} strategies=tree,vision,ask\n"
                "• error_recovery action=classify error=window not found\n"
                "• error_recovery action=heal error=pywinauto not installed context=Notepad\n"
                "• error_recovery action=wrap target_action=accessibility_master params={\"action\":\"click\",\"name\":\"File\"} retries=2 strategies=tree,vision\n"
                "\n"
                "Zero to low tokens — local retry/fallback zero tokens, heal via local rules + optional Gemini low tokens.\n"
                "History: ~/.jarvis_error_recovery.json, last 100.\n"
            )

        if action == "retry":
            if not target_action:
                return "Need target_action: retry target_action=accessibility_master params={\"action\":\"find\",\"name\":\"File\"} retries=3 backoff=1.0"
            try:
                params = json.loads(params_str) if params_str else {}
            except Exception:
                return f"Invalid params JSON: {params_str} — must be valid JSON e.g., {{\"action\":\"find\",\"name\":\"File\"}}"

            attempts = []
            last_result = None
            last_error = None
            for attempt in range(retries):
                result, error = _run_plugin_action(target_action, params)
                attempts.append({"attempt": attempt+1, "result": str(result)[:200] if result else "", "error": error, "backoff": backoff * (2 ** attempt) if attempt > 0 else 0})
                if not error:
                    last_result = result
                    # Success — log history
                    _history.append({
                        "timestamp": datetime.now().isoformat(),
                        "target_action": target_action,
                        "params": params,
                        "action": "retry",
                        "retries": attempt+1,
                        "success": True,
                        "result": str(result)[:500],
                        "attempts": attempts,
                    })
                    _save_history()
                    return f"Retry succeeded on attempt {attempt+1}/{retries} for '{target_action}' with backoff {backoff}s exponential — result: {result}\nAttempts: {attempts}"
                last_result = result
                last_error = error
                if attempt < retries - 1:
                    sleep_time = backoff * (2 ** attempt)
                    time.sleep(sleep_time)

            # All retries failed
            _history.append({
                "timestamp": datetime.now().isoformat(),
                "target_action": target_action,
                "params": params,
                "action": "retry",
                "retries": retries,
                "success": False,
                "result": str(last_result)[:500],
                "error": last_error,
                "attempts": attempts,
            })
            _save_history()
            return f"Retry failed after {retries} attempts for '{target_action}' backoff {backoff}s exponential — last error: {last_error} — last result: {last_result}\nAttempts: {attempts}\nTry fallback action with strategies tree,vision,ask"

        if action == "fallback":
            if not target_action:
                return "Need target_action: fallback target_action=accessibility_master params={...} strategies=tree,vision,ask"
            try:
                params = json.loads(params_str) if params_str else {}
            except Exception:
                return f"Invalid params JSON: {params_str}"

            tried = []
            for strategy in strategies:
                strategy = strategy.lower().strip()
                if strategy == "tree":
                    # Try accessibility_master
                    result, error = _run_plugin_action("accessibility_master", params)
                    tried.append({"strategy": "tree (accessibility_master)", "result": str(result)[:200] if result else "", "error": error})
                    if not error:
                        _history.append({
                            "timestamp": datetime.now().isoformat(),
                            "target_action": target_action,
                            "params": params,
                            "action": "fallback",
                            "strategies": strategies,
                            "success": True,
                            "winning_strategy": "tree",
                            "result": str(result)[:500],
                            "tried": tried,
                        })
                        _save_history()
                        return f"Fallback succeeded via tree (accessibility_master) — strategy {strategy} — result: {result}\nTried: {tried}"
                elif strategy == "vision":
                    # Try vision_bridge
                    # Map params: if target_action is accessibility_master find, map to vision_bridge find
                    vision_params = {"action": "find", "target": params.get("name", "") or params.get("target", ""), "mode": "vision"}
                    if "window" in params:
                        vision_params["window"] = params["window"]
                    result, error = _run_plugin_action("vision_bridge", vision_params)
                    tried.append({"strategy": "vision (vision_bridge)", "result": str(result)[:200] if result else "", "error": error})
                    if not error:
                        _history.append({
                            "timestamp": datetime.now().isoformat(),
                            "target_action": target_action,
                            "params": params,
                            "action": "fallback",
                            "strategies": strategies,
                            "success": True,
                            "winning_strategy": "vision",
                            "result": str(result)[:500],
                            "tried": tried,
                        })
                        _save_history()
                        return f"Fallback succeeded via vision (vision_bridge) — strategy {strategy} — result: {result}\nTried: {tried}"
                elif strategy == "ask":
                    tried.append({"strategy": "ask (ask user)", "result": "Ask user for help", "error": None})
                    _history.append({
                        "timestamp": datetime.now().isoformat(),
                        "target_action": target_action,
                        "params": params,
                        "action": "fallback",
                        "strategies": strategies,
                        "success": False,
                        "winning_strategy": "ask",
                        "result": "Need user help",
                        "tried": tried,
                    })
                    _save_history()
                    return f"Fallback reached ask strategy — all previous failed, need user help — tried: {tried}\nPlease provide more info or try manually"
                else:
                    # Try strategy as action name
                    result, error = _run_plugin_action(strategy, params)
                    tried.append({"strategy": f"{strategy} (plugin {strategy})", "result": str(result)[:200] if result else "", "error": error})
                    if not error:
                        _history.append({
                            "timestamp": datetime.now().isoformat(),
                            "target_action": target_action,
                            "params": params,
                            "action": "fallback",
                            "strategies": strategies,
                            "success": True,
                            "winning_strategy": strategy,
                            "result": str(result)[:500],
                            "tried": tried,
                        })
                        _save_history()
                        return f"Fallback succeeded via {strategy} — result: {result}\nTried: {tried}"

            # All fallback failed
            _history.append({
                "timestamp": datetime.now().isoformat(),
                "target_action": target_action,
                "params": params,
                "action": "fallback",
                "strategies": strategies,
                "success": False,
                "result": "All fallback failed",
                "tried": tried,
            })
            _save_history()
            return f"Fallback failed — all strategies {strategies} failed — tried: {tried}\nTry heal action for suggestions"

        if action == "classify":
            if not error_msg:
                return "Need error: classify error=window not found"
            category, fix = _classify_error(error_msg)
            return f"Error classification:\n• Error: {error_msg}\n• Category: {category}\n• Suggested fix: {fix}"

        if action == "heal":
            if not error_msg:
                return "Need error: heal error=pywinauto not installed context=Notepad"
            suggestion = _heal_suggestion(error_msg, context=context)
            return f"Heal suggestion for error '{error_msg}' context '{context}':\n{suggestion}"

        if action == "wrap":
            if not target_action:
                return "Need target_action: wrap target_action=accessibility_master params={...} retries=3 strategies=tree,vision,ask"
            try:
                params = json.loads(params_str) if params_str else {}
            except Exception:
                return f"Invalid params JSON: {params_str}"

            steps = []
            # Try original
            result, error = _run_plugin_action(target_action, params)
            steps.append(f"Try {target_action}: {'success' if not error else f'failed {error}'}")
            if not error:
                _history.append({
                    "timestamp": datetime.now().isoformat(),
                    "target_action": target_action,
                    "params": params,
                    "action": "wrap",
                    "success": True,
                    "result": str(result)[:500],
                    "steps": steps,
                })
                _save_history()
                return f"Wrap succeeded first try for '{target_action}' — result: {result}\nSteps: {steps}"

            # Classify
            category, fix = _classify_error(error or str(result))
            steps.append(f"Classify error: {category} — {fix}")

            # Retry
            for attempt in range(retries):
                if attempt > 0:
                    sleep_time = backoff * (2 ** (attempt-1))
                    time.sleep(sleep_time)
                    steps.append(f"Retry attempt {attempt+1}/{retries} backoff {sleep_time}s")
                result, error = _run_plugin_action(target_action, params)
                if not error:
                    steps.append(f"Retry succeeded attempt {attempt+1}")
                    _history.append({
                        "timestamp": datetime.now().isoformat(),
                        "target_action": target_action,
                        "params": params,
                        "action": "wrap",
                        "success": True,
                        "result": str(result)[:500],
                        "steps": steps,
                    })
                    _save_history()
                    return f"Wrap succeeded via retry attempt {attempt+1}/{retries} for '{target_action}' — result: {result}\nSteps: {steps}"
                steps.append(f"Retry attempt {attempt+1} failed: {error}")

            # Fallback
            for strategy in strategies:
                strategy = strategy.lower().strip()
                if strategy == "tree":
                    result, error = _run_plugin_action("accessibility_master", params)
                    steps.append(f"Fallback tree: {'success' if not error else f'failed {error}'}")
                    if not error:
                        _history.append({
                            "timestamp": datetime.now().isoformat(),
                            "target_action": target_action,
                            "params": params,
                            "action": "wrap",
                            "success": True,
                            "result": str(result)[:500],
                            "steps": steps,
                        })
                        _save_history()
                        return f"Wrap succeeded via fallback tree for '{target_action}' — result: {result}\nSteps: {steps}"
                elif strategy == "vision":
                    vision_params = {"action": "find", "target": params.get("name", "") or params.get("target", ""), "mode": "vision"}
                    if "window" in params:
                        vision_params["window"] = params["window"]
                    result, error = _run_plugin_action("vision_bridge", vision_params)
                    steps.append(f"Fallback vision: {'success' if not error else f'failed {error}'}")
                    if not error:
                        _history.append({
                            "timestamp": datetime.now().isoformat(),
                            "target_action": target_action,
                            "params": params,
                            "action": "wrap",
                            "success": True,
                            "result": str(result)[:500],
                            "steps": steps,
                        })
                        _save_history()
                        return f"Wrap succeeded via fallback vision for '{target_action}' — result: {result}\nSteps: {steps}"
                else:
                    result, error = _run_plugin_action(strategy, params)
                    steps.append(f"Fallback {strategy}: {'success' if not error else f'failed {error}'}")
                    if not error:
                        _history.append({
                            "timestamp": datetime.now().isoformat(),
                            "target_action": target_action,
                            "params": params,
                            "action": "wrap",
                            "success": True,
                            "result": str(result)[:500],
                            "steps": steps,
                        })
                        _save_history()
                        return f"Wrap succeeded via fallback {strategy} for '{target_action}' — result: {result}\nSteps: {steps}"

            # Heal suggestion
            heal = _heal_suggestion(error or str(result), context=context)
            steps.append(f"Heal suggestion: {heal}")

            _history.append({
                "timestamp": datetime.now().isoformat(),
                "target_action": target_action,
                "params": params,
                "action": "wrap",
                "success": False,
                "result": str(result)[:500],
                "error": error,
                "steps": steps,
            })
            _save_history()
            return f"Wrap failed after all recovery for '{target_action}' — last error: {error} — result: {result}\nSteps:\n" + "\n".join([f"  {s}" for s in steps]) + f"\n\nHeal:\n{heal}"

        if action == "history":
            _load_history()
            if not _history:
                return "No recovery history — try retry/fallback/wrap actions"
            recent = _history[-limit:][::-1]
            lines = []
            for i, h in enumerate(recent, 1):
                ts = h.get("timestamp", "")[:19]
                act = h.get("target_action", "")
                succ = "✓" if h.get("success") else "✗"
                rec_act = h.get("action", "")
                lines.append(f"{i}. [{ts}] {succ} {rec_act} {act} — {h.get('result','')[:80]}")
            total = len(_history)
            successes = sum(1 for h in _history if h.get("success"))
            rate = (successes / total * 100) if total > 0 else 0
            return f"Recovery history ({len(recent)} of {total} total, success rate {rate:.1f}%):\n" + "\n".join(lines)

        return f"Unknown action {action}. Say 'error_recovery action=help'"

    except Exception as e:
        return f"Error Recovery failed: {e}"
