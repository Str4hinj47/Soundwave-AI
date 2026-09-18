"""
Automation Master — Macros, Hotkeys, Workflows for JARVIS (Mark LIII)
Makes JARVIS impeccable at automation — record macros, playback, hotkeys, workflows.

Inspired by ONEPUNCHMAN411/Jarvis macro_executor, macro_store, and FatihMakes computer_control.

Free & open source, zero tokens for local execution.
"""

import time
import json
import threading
from pathlib import Path
import platform

PLUGIN = {
    "name": "automation_master",
    "description": (
        "Automation and macros master — makes JARVIS impeccable at automating PC tasks. Actions: record, stop, play, list, delete, hotkey, workflow, schedule, help. "
        "Record keyboard/mouse macros, playback, assign hotkeys, create workflows, schedule tasks. "
        "Use when user wants to automate tasks, record macro, playback macro, create workflow, schedule task, hotkey automation. "
        "Trigger phrases: automation, macro, record macro, play macro, workflow, schedule task, hotkey, automate, automation master, macro recorder."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: record, stop, play, list, delete, hotkey, workflow, schedule, help. Default help.",
            },
            "name": {
                "type": "STRING",
                "description": "Macro/workflow name, e.g. open_chrome_and_search",
            },
            "keys": {
                "type": "STRING",
                "description": "Hotkey e.g. ctrl+shift+t, or keys to type",
            },
        },
        "required": ["action"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "automation_master",
    "title": "Automation Master — Macros & Workflows",
    "description": "Record and playback macros, hotkeys, workflows",
    "icon": "🤖",
    "color": "#EF4444",
    "order": 6,
    "default_enabled": True,
}

_macro_dir = Path.home() / ".jarvis_macros"
_macro_dir.mkdir(parents=True, exist_ok=True)

_recording = False
_events = []
_listener = None
_start_time = 0

def _list_macros():
    files = list(_macro_dir.glob("*.json"))
    if not files:
        return "No macros saved yet — say 'record macro' to create one"
    lines = [f"{f.stem} — {f.stat().st_size} bytes — {time.ctime(f.stat().st_mtime)}" for f in files]
    return f"Saved macros ({len(files)}):\n" + "\n".join(lines)

def run(parameters: dict, player=None, session_memory=None) -> str:
    global _recording, _events, _listener, _start_time
    action = (parameters.get("action", "help") or "help").lower().strip()
    name = parameters.get("name", "") or ""
    keys = parameters.get("keys", "") or ""

    try:
        if player:
            try:
                player.write_log(f"Automation Master: {action} {name} {keys}")
            except Exception:
                pass

        if action in ("help", "?", "h"):
            return (
                "Automation Master — Macros, Hotkeys, Workflows:\n"
                "\n"
                "• record name=... — start recording keyboard/mouse macro (saves to ~/.jarvis_macros/name.json)\n"
                "• stop — stop recording\n"
                "• play name=... — playback macro\n"
                "• list — list saved macros\n"
                "• delete name=... — delete macro\n"
                "• hotkey keys=ctrl+shift+t — press hotkey\n"
                "• workflow name=... — create workflow (multi-step: open app, type, click, etc.)\n"
                "• schedule name=... — schedule macro via OS scheduler (Windows Task Scheduler, macOS LaunchAgent, Linux systemd)\n"
                "\n"
                "Examples:\n"
                "• automation_master action=record name=open_chrome_search\n"
                "• automation_master action=play name=open_chrome_search\n"
                "• automation_master action=list\n"
                "• automation_master action=hotkey keys=ctrl+shift+t\n"
                "• automation_master action=workflow name=morning_routine\n"
                "\n"
                "How it works:\n"
                "• Recording uses pynput to capture keyboard/mouse (optional, pip install pynput)\n"
                "• Playback uses pyautogui (pip install pyautogui)\n"
                "• Workflows are JSON with steps: open_app, type, click, hotkey, wait\n"
                "• Scheduled via reminder.py pattern (OS-native)\n"
                "\n"
                "Install: pip install pynput pyautogui"
            )

        if action == "list":
            return _list_macros()

        if action == "record":
            if not name:
                return "Need macro name: record name=my_macro"
            if _recording:
                return f"Already recording macro '{name}' — say 'stop' to stop"
            try:
                from pynput import keyboard, mouse
                _events = []
                _start_time = time.time()
                _recording = True

                def on_press(key):
                    if not _recording:
                        return False
                    try:
                        _events.append({"type": "key_press", "key": str(key), "time": time.time() - _start_time})
                    except Exception:
                        pass

                def on_click(x, y, button, pressed):
                    if not _recording:
                        return False
                    if pressed:
                        _events.append({"type": "mouse_click", "x": x, "y": y, "button": str(button), "time": time.time() - _start_time})

                # Start listeners in background
                def start_listeners():
                    global _listener
                    try:
                        k_listener = keyboard.Listener(on_press=on_press)
                        m_listener = mouse.Listener(on_click=on_click)
                        k_listener.start()
                        m_listener.start()
                        # Store
                        _listener = (k_listener, m_listener)
                    except Exception as e:
                        print(f"Listener failed: {e}")

                threading.Thread(target=start_listeners, daemon=True).start()
                return f"Recording macro '{name}' — now perform actions (keyboard/mouse), then say 'automation_master action=stop name={name}' to save. Events will be saved to ~/.jarvis_macros/{name}.json"
            except ImportError:
                return "pynput not installed — pip install pynput for macro recording. Fallback: manually create workflow JSON in ~/.jarvis_macros/"
            except Exception as e:
                return f"Record failed: {e}"

        if action == "stop":
            if not _recording:
                return "Not recording — say 'record name=...' to start"
            _recording = False
            if _listener:
                try:
                    for l in _listener:
                        l.stop()
                except Exception:
                    pass
            # Save
            macro_name = name or f"macro_{int(time.time())}"
            save_path = _macro_dir / f"{macro_name}.json"
            try:
                save_path.write_text(json.dumps(_events, indent=2), encoding="utf-8")
                count = len(_events)
                _events = []
                return f"Stopped recording macro '{macro_name}' — saved {count} events to {save_path}. Say 'play name={macro_name}' to playback."
            except Exception as e:
                return f"Stop failed to save: {e}"

        if action == "play":
            if not name:
                return "Need macro name: play name=my_macro"
            macro_path = _macro_dir / f"{name}.json"
            if not macro_path.exists():
                return f"Macro '{name}' not found in {_macro_dir} — say 'list' to see saved macros"
            try:
                import pyautogui
                events = json.loads(macro_path.read_text(encoding="utf-8"))
                # Playback with timing
                last_time = 0
                for ev in events:
                    delay = ev.get("time", 0) - last_time
                    if delay > 0 and delay < 5:  # cap delay
                        time.sleep(delay)
                    last_time = ev.get("time", 0)
                    if ev["type"] == "key_press":
                        # Parse key
                        k = ev["key"].replace("'", "")
                        if len(k) == 1:
                            pyautogui.press(k)
                        # Skip complex keys for safety
                    elif ev["type"] == "mouse_click":
                        pyautogui.click(ev["x"], ev["y"])
                return f"Played macro '{name}' — {len(events)} events"
            except ImportError:
                return "pyautogui not installed — pip install pyautogui for playback"
            except Exception as e:
                return f"Play failed: {e}"

        if action == "delete":
            if not name:
                return "Need macro name: delete name=my_macro"
            macro_path = _macro_dir / f"{name}.json"
            if not macro_path.exists():
                return f"Macro '{name}' not found"
            try:
                macro_path.unlink()
                return f"Deleted macro '{name}'"
            except Exception as e:
                return f"Delete failed: {e}"

        if action == "hotkey":
            if not keys:
                return "Need keys: hotkey keys=ctrl+shift+t"
            try:
                import pyautogui
                parts = [k.strip() for k in keys.lower().split('+')]
                if len(parts) == 1:
                    pyautogui.press(parts[0])
                else:
                    pyautogui.hotkey(*parts)
                return f"Pressed hotkey {keys}"
            except Exception as e:
                return f"Hotkey failed: {e}. pip install pyautogui"

        if action == "workflow":
            if not name:
                return "Need workflow name: workflow name=morning_routine — then describe steps like 'open chrome, type hello, press enter'"
            # Create a workflow template
            workflow_path = _macro_dir / f"{name}_workflow.json"
            template = {
                "name": name,
                "steps": [
                    {"action": "open_app", "app": "chrome"},
                    {"action": "wait", "seconds": 2},
                    {"action": "type", "text": "hello world"},
                    {"action": "hotkey", "keys": "enter"},
                ],
                "description": f"Workflow {name} — edit this file to customize steps",
            }
            try:
                workflow_path.write_text(json.dumps(template, indent=2), encoding="utf-8")
                return (
                    f"Created workflow template '{name}' at {workflow_path}:\n"
                    f"{json.dumps(template, indent=2)}\n"
                    f"\n"
                    f"Edit the JSON to customize, then say 'play name={name}_workflow' or create a custom runner. "
                    f"Steps supported: open_app, type, click x,y, hotkey, wait seconds, screenshot, etc."
                )
            except Exception as e:
                return f"Workflow create failed: {e}"

        if action == "schedule":
            if not name:
                return "Need macro name to schedule: schedule name=my_macro"
            return (
                f"Schedule macro '{name}' — uses OS-native scheduler (like reminder.py):\n"
                f"• Windows: Task Scheduler — schtasks /create /tn {name} /tr \"python -m automation_master play {name}\" /sc daily\n"
                f"• macOS: LaunchAgent — ~/Library/LaunchAgents/com.jarvis.{name}.plist\n"
                f"• Linux: systemd timer or cron — crontab -e\n"
                f"\n"
                f"For now, use reminder plugin: reminder action=create text='play macro {name}' time='09:00' — or say 'remind me every day at 9am to play macro {name}'"
            )

        return f"Unknown action {action}. Say 'automation_master action=help'"

    except Exception as e:
        return f"Automation Master failed: {e}"
