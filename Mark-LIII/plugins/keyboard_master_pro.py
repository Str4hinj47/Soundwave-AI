"""
Keyboard Master Pro — Advanced Keyboard Mastery for JARVIS (Mark LIII)
Makes JARVIS impeccable at keyboard — beyond basic pyautogui type/press/hotkey.

Ported from ONEPUNCHMAN411/Jarvis control/keyboard.py + clipboard.py
+ pc_master keyboard actions, enhanced with humanize, layout, text expansion.

Free & open source, zero tokens.
"""

import json
import time
import random
import platform
import ctypes
from pathlib import Path

PLUGIN = {
    "name": "keyboard_master_pro",
    "description": (
        "Advanced keyboard mastery pro — makes JARVIS impeccable at keyboard beyond basic type/press (zero tokens). "
        "Actions: type text=... [delay=0.02] [humanize=true] — type with per-char delay + humanize random variation, press key=... [count=1] [interval=0.1] — press key enter/esc/f1-f12/tab/space/backspace/delete/up/down/left/right, hotkey keys=... — ctrl+c ctrl+shift+t alt+tab win+d win+l win+ctrl+d, hold key=... / release key=... — keyDown/keyUp for drag modifiers, layout [set=...] — get/set keyboard layout list layouts Windows GetKeyboardLayout PowerShell macOS input sources Linux setxkbmap, language — current input language, text_expansion action=add/list/remove trigger=... expansion=... — add text expansion @@→email ;sig→signature stored ~/.jarvis_text_expansions.json, type_file path=... — type file contents, clear — clear field ctrl+a delete, help. "
        "Use when user wants to type, press key, hotkey, keyboard layout, text expansion, type file, clear field. "
        "Trigger phrases: keyboard master, type text, press key, hotkey, keyboard layout, text expansion, type file, clear field, keyboard pro, advanced keyboard."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: type, press, hotkey, hold, release, layout, language, text_expansion, type_file, clear, help. Default help.",
            },
            "text": {"type": "STRING", "description": "Text to type for type action, or trigger/expansion for text_expansion"},
            "key": {"type": "STRING", "description": "Key name for press/hold/release, e.g. enter, esc, f1, tab, space, backspace, delete, up, down, left, right, ctrl, shift, alt, win"},
            "keys": {"type": "STRING", "description": "Hotkey combo e.g. ctrl+c, ctrl+shift+t, alt+tab, win+d"},
            "delay": {"type": "NUMBER", "description": "Delay per char seconds for type, default 0.02"},
            "count": {"type": "NUMBER", "description": "Count for press, default 1"},
            "interval": {"type": "NUMBER", "description": "Interval between presses, default 0.1"},
            "humanize": {"type": "BOOLEAN", "description": "Humanize random variation for type, default true"},
            "set": {"type": "STRING", "description": "Layout to set for layout action, e.g. en, de, fr"},
            "trigger": {"type": "STRING", "description": "Trigger for text_expansion, e.g. @@, ;sig"},
            "expansion": {"type": "STRING", "description": "Expansion text for text_expansion add"},
            "path": {"type": "STRING", "description": "File path for type_file action"},
            "subaction": {"type": "STRING", "description": "Subaction for text_expansion: add, list, remove, default list"},
        },
        "required": ["action"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "keyboard_master_pro",
    "title": "Keyboard Master Pro — Advanced Keyboard",
    "description": "Advanced keyboard with humanize, layout, text expansion — zero tokens",
    "icon": "⌨️",
    "color": "#A855F7",
    "order": 35,
    "default_enabled": True,
    "fields": [
        {"key": "default_delay", "label": "Default type delay", "type": "number", "default": 0.02},
        {"key": "humanize", "label": "Humanize typing by default", "type": "checkbox", "default": True},
        {"key": "expansions_file", "label": "Expansions file", "type": "text", "default": "~/.jarvis_text_expansions.json"},
    ],
}

_expansions_file = Path.home() / ".jarvis_text_expansions.json"

def _load_expansions():
    try:
        if _expansions_file.exists():
            return json.loads(_expansions_file.read_text(encoding="utf-8"))
    except Exception:
        pass
    return {}

def _save_expansions(data):
    try:
        _expansions_file.parent.mkdir(parents=True, exist_ok=True)
        _expansions_file.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        return True
    except Exception:
        return False

def _get_keyboard_layout():
    """Get current keyboard layout."""
    try:
        if platform.system() == "Windows":
            # GetKeyboardLayout via ctypes
            hwnd = ctypes.windll.user32.GetForegroundWindow()
            thread_id = ctypes.windll.user32.GetWindowThreadProcessId(hwnd, None)
            layout_id = ctypes.windll.user32.GetKeyboardLayout(thread_id)
            # Low word is language ID
            lang_id = layout_id & 0xFFFF
            # Map common lang IDs
            lang_map = {0x0409: "en-US", 0x0407: "de-DE", 0x040C: "fr-FR", 0x0419: "ru-RU", 0x041B: "sk-SK", 0x0C1A: "sr-SP", 0x0424: "sl-SI"}
            return lang_map.get(lang_id, f"0x{lang_id:04X}"), f"Layout ID {layout_id} lang 0x{lang_id:04X}"
        elif platform.system() == "Darwin":
            import subprocess
            result = subprocess.run(["defaults", "read", "com.apple.HIToolbox", "AppleSelectedInputSources"], capture_output=True, text=True, timeout=5)
            return "macOS", result.stdout[:200] if result.returncode == 0 else "Unknown"
        else:
            import subprocess
            result = subprocess.run(["setxkbmap", "-query"], capture_output=True, text=True, timeout=5)
            return "Linux", result.stdout[:300] if result.returncode == 0 else "Unknown"
    except Exception as e:
        return "Unknown", str(e)

def _list_layouts():
    try:
        if platform.system() == "Windows":
            import subprocess
            result = subprocess.run(["powershell", "-Command", "Get-WinUserLanguageList | Format-Table -Property LanguageTag, Autonym -AutoSize"], capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                return result.stdout
            return "Windows layouts via Get-WinUserLanguageList"
        elif platform.system() == "Darwin":
            return "macOS: System Settings → Keyboard → Input Sources"
        else:
            import subprocess
            result = subprocess.run(["localectl", "list-keymaps"], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                return result.stdout[:1000]
            return "Linux: use setxkbmap -layout us,de etc."
    except Exception as e:
        return f"List layouts failed: {e}"

def run(parameters: dict, player=None, session_memory=None) -> str:
    action = (parameters.get("action", "help") or "help").lower().strip()
    text = parameters.get("text", "") or ""
    key = parameters.get("key", "") or ""
    keys = parameters.get("keys", "") or ""
    delay = parameters.get("delay", 0.02)
    try:
        delay = float(delay)
    except Exception:
        delay = 0.02
    count = parameters.get("count", 1)
    try:
        count = int(count)
    except Exception:
        count = 1
    interval = parameters.get("interval", 0.1)
    try:
        interval = float(interval)
    except Exception:
        interval = 0.1
    humanize = parameters.get("humanize", True)
    if isinstance(humanize, str):
        humanize = humanize.lower() in ("true", "1", "yes")
    layout_set = parameters.get("set", "") or ""
    trigger = parameters.get("trigger", "") or ""
    expansion = parameters.get("expansion", "") or ""
    path_str = parameters.get("path", "") or ""
    subaction = (parameters.get("subaction", "list") or "list").lower().strip()

    try:
        if player:
            try:
                player.write_log(f"Keyboard Master Pro: {action} text={text[:20]} key={key} keys={keys}")
            except Exception:
                pass

        if action in ("help", "?", "h"):
            return (
                "Keyboard Master Pro — Advanced Keyboard Mastery (Zero Tokens, from ONEPUNCHMAN411/Jarvis control/keyboard.py):\n"
                "\n"
                "Beyond basic pyautogui type/press — humanize, layout, text expansion, file typing.\n"
                "\n"
                "• type text=... [delay=0.02] [humanize=true] — type with per-char delay + humanize random variation (real typing), supports \\n unicode, checks text_expansion triggers (e.g., @@→email)\n"
                "• press key=... [count=1] [interval=0.1] — press key enter/esc/f1-f12/tab/space/backspace/delete/up/down/left/right/ctrl/shift/alt/win with count interval\n"
                "• hotkey keys=... — hotkey ctrl+c ctrl+shift+t alt+tab win+d win+l win+ctrl+d etc.\n"
                "• hold key=... / release key=... — keyDown/keyUp for drag modifiers e.g., hold shift + click + release shift\n"
                "• layout [set=...] — get current layout via GetKeyboardLayout (Windows) or defaults/setxkbmap, list layouts via Get-WinUserLanguageList / localectl, set via PowerShell Set-WinUserLanguageList or setxkbmap -layout\n"
                "• language — current input language\n"
                "• text_expansion subaction=add/list/remove trigger=... expansion=... — add text expansion @@→my@email.com ;sig→Best regards, stored ~/.jarvis_text_expansions.json, list shows all, remove trigger\n"
                "• type_file path=... — type file contents with delay/humanize, for pasting large text\n"
                "• clear — clear current field via ctrl+a + delete (or cmd+a on macOS)\n"
                "\n"
                "Examples:\n"
                "• keyboard_master_pro action=type text=Hello World delay=0.02 humanize=true\n"
                "• keyboard_master_pro action=press key=enter count=1\n"
                "• keyboard_master_pro action=hotkey keys=ctrl+c\n"
                "• keyboard_master_pro action=layout\n"
                "• keyboard_master_pro action=text_expansion subaction=add trigger=@@ expansion=my@email.com\n"
                "• keyboard_master_pro action=text_expansion subaction=list\n"
                "• keyboard_master_pro action=type_file path=~/notes.txt\n"
                "\n"
                "Zero tokens, pure local via pyautogui + pynput + ctypes.\n"
                "Install: pip install pyautogui pynput\n"
                "Text expansions stored ~/.jarvis_text_expansions.json\n"
            )

        if action == "type":
            if not text:
                return "Need text: type text=Hello World"
            # Check expansions
            expansions = _load_expansions()
            for trig, exp in expansions.items():
                if trig in text:
                    text = text.replace(trig, exp)

            try:
                import pyautogui
                if delay <= 0:
                    pyautogui.typewrite(text)
                else:
                    for char in text:
                        pyautogui.typewrite(char)
                        d = delay
                        if humanize:
                            d += random.uniform(-delay*0.5, delay*0.5)
                            d = max(0.005, d)
                        time.sleep(d)
                return f"Typed '{text[:100]}' with delay {delay}s humanize {humanize} — {len(text)} chars via keyboard_master_pro (zero tokens)"
            except ImportError:
                return "pyautogui not installed — pip install pyautogui"
            except Exception as e:
                return f"Type failed: {e}"

        if action == "press":
            if not key:
                return "Need key: press key=enter — keys: enter, esc, f1-f12, tab, space, backspace, delete, up, down, left, right, ctrl, shift, alt, win, etc."
            try:
                import pyautogui
                for i in range(max(1, count)):
                    pyautogui.press(key)
                    if i < count - 1:
                        time.sleep(interval)
                return f"Pressed key '{key}' {count} times interval {interval}s via keyboard_master_pro (zero tokens)"
            except ImportError:
                return "pyautogui not installed — pip install pyautogui"
            except Exception as e:
                return f"Press failed: {e} — try key names: enter, esc, tab, space, backspace, delete, up, down, left, right, f1-f12"

        if action == "hotkey":
            if not keys:
                return "Need keys: hotkey keys=ctrl+c — e.g., ctrl+c, ctrl+shift+t, alt+tab, win+d, win+l"
            try:
                import pyautogui
                # Split by +
                parts = [k.strip() for k in keys.split("+") if k.strip()]
                if len(parts) == 1:
                    pyautogui.press(parts[0])
                else:
                    pyautogui.hotkey(*parts)
                return f"Hotkey '{keys}' pressed via keyboard_master_pro (zero tokens)"
            except ImportError:
                return "pyautogui not installed — pip install pyautogui"
            except Exception as e:
                return f"Hotkey failed: {e}"

        if action == "hold":
            if not key:
                return "Need key: hold key=shift — for drag modifiers"
            try:
                import pyautogui
                pyautogui.keyDown(key)
                return f"Held key '{key}' down — use release action to release"
            except ImportError:
                return "pyautogui not installed — pip install pyautogui"
            except Exception as e:
                return f"Hold failed: {e}"

        if action == "release":
            if not key:
                return "Need key: release key=shift"
            try:
                import pyautogui
                pyautogui.keyUp(key)
                return f"Released key '{key}'"
            except ImportError:
                return "pyautogui not installed — pip install pyautogui"
            except Exception as e:
                return f"Release failed: {e}"

        if action == "layout":
            if layout_set:
                # Try set layout
                try:
                    if platform.system() == "Windows":
                        import subprocess
                        # PowerShell Set-WinUserLanguageList — needs admin? Try simple
                        result = subprocess.run(["powershell", "-Command", f"Set-WinUserLanguageList -LanguageList {layout_set} -Force"], capture_output=True, text=True, timeout=15)
                        if result.returncode == 0:
                            return f"Set layout to {layout_set} via PowerShell"
                        return f"Set layout failed: {result.stderr[:500]} — try manually: Settings → Time & Language → Language"
                    elif platform.system() == "Linux":
                        import subprocess
                        result = subprocess.run(["setxkbmap", "-layout", layout_set], capture_output=True, text=True, timeout=5)
                        if result.returncode == 0:
                            return f"Set layout to {layout_set} via setxkbmap"
                        return f"Set layout failed: {result.stderr[:200]}"
                    else:
                        return f"Set layout {layout_set} on macOS: System Settings → Keyboard → Input Sources → add {layout_set}"
                except Exception as e:
                    return f"Set layout failed: {e}"
            else:
                layout, detail = _get_keyboard_layout()
                layouts = _list_layouts()
                return f"Current keyboard layout: {layout}\nDetail: {detail}\n\nAvailable layouts:\n{layouts[:1000]}"

        if action == "language":
            layout, detail = _get_keyboard_layout()
            return f"Current input language: {layout} — {detail}"

        if action == "text_expansion":
            if subaction == "add":
                if not trigger or not expansion:
                    return "Need trigger and expansion: text_expansion subaction=add trigger=@@ expansion=my@email.com"
                exps = _load_expansions()
                exps[trigger] = expansion
                if _save_expansions(exps):
                    return f"Added text expansion '{trigger}' → '{expansion}' — stored ~/.jarvis_text_expansions.json, will auto-expand on type action"
                return "Failed to save expansion"
            elif subaction == "remove":
                if not trigger:
                    return "Need trigger: text_expansion subaction=remove trigger=@@"
                exps = _load_expansions()
                if trigger in exps:
                    del exps[trigger]
                    _save_expansions(exps)
                    return f"Removed expansion '{trigger}'"
                return f"No expansion with trigger '{trigger}' — list to see all"
            else:  # list
                exps = _load_expansions()
                if not exps:
                    return "No text expansions — add via text_expansion subaction=add trigger=@@ expansion=my@email.com"
                lines = [f"'{k}' → '{v}'" for k, v in exps.items()]
                return f"Text expansions ({len(exps)}):\n" + "\n".join(lines)

        if action == "type_file":
            if not path_str:
                return "Need path: type_file path=~/notes.txt"
            try:
                p = Path(path_str).expanduser()
                if not p.exists():
                    return f"File not found: {p}"
                content = p.read_text(encoding="utf-8", errors="ignore")
                if len(content) > 10000:
                    return f"File too large {len(content)} chars — max 10000 for type_file, use clipboard_master for larger"
                # Type with delay
                import pyautogui
                for char in content:
                    pyautogui.typewrite(char)
                    d = delay
                    if humanize:
                        d += random.uniform(-delay*0.5, delay*0.5)
                        d = max(0.005, d)
                    time.sleep(d)
                return f"Typed file '{p}' {len(content)} chars with delay {delay}s humanize {humanize}"
            except ImportError:
                return "pyautogui not installed — pip install pyautogui"
            except Exception as e:
                return f"Type file failed: {e}"

        if action == "clear":
            try:
                import pyautogui
                if platform.system() == "Darwin":
                    pyautogui.hotkey("command", "a")
                else:
                    pyautogui.hotkey("ctrl", "a")
                time.sleep(0.1)
                pyautogui.press("delete")
                return "Cleared current field via ctrl+a + delete (zero tokens)"
            except ImportError:
                return "pyautogui not installed — pip install pyautogui"
            except Exception as e:
                return f"Clear failed: {e}"

        return f"Unknown action {action}. Say 'keyboard_master_pro action=help'"

    except Exception as e:
        return f"Keyboard Master Pro failed: {e}"
