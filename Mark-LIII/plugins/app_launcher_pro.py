"""
App Launcher Pro — Intelligent App Launching for JARVIS (Mark LIII)
Makes JARVIS impeccable at launching apps — recent, frequent, search, pin, etc.

Inspired by ONEPUNCHMAN411/Jarvis app_launcher and FatihMakes open_app.

Free & open source.
"""

import platform
import os
import subprocess
import time
from pathlib import Path
import json

PLUGIN = {
    "name": "app_launcher_pro",
    "description": (
        "Intelligent app launcher pro — makes JARVIS impeccable at launching apps. Actions: launch, list, recent, frequent, pin, unpin, search, kill, help. "
        "Launches apps by name with per-OS map, tracks recent/frequent, pin favorites, search installed apps. "
        "Use when user wants to open app, launch app, start app, recent apps, frequent apps, pin app. "
        "Trigger phrases: open app, launch app, start app, app launcher, open application, launch application, recent apps, frequent apps, pin app, app launcher pro."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: launch, list, recent, frequent, pin, unpin, search, kill, help. Default launch.",
            },
            "app": {
                "type": "STRING",
                "description": "App name to launch/search/kill, e.g. chrome, vscode, notepad, spotify",
            },
        },
        "required": ["action"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "app_launcher_pro",
    "title": "App Launcher Pro",
    "description": "Intelligent app launching — recent, frequent, pin, search",
    "icon": "🚀",
    "color": "#EC4899",
    "order": 9,
    "default_enabled": True,
}

# Per-OS app map (from FatihMakes open_app.py)
APP_MAP = {
    "windows": {
        "chrome": "chrome.exe",
        "firefox": "firefox.exe",
        "edge": "msedge.exe",
        "vscode": "Code.exe",
        "code": "Code.exe",
        "notepad": "notepad.exe",
        "calculator": "calc.exe",
        "explorer": "explorer.exe",
        "spotify": "Spotify.exe",
        "discord": "Discord.exe",
        "slack": "slack.exe",
        "word": "WINWORD.EXE",
        "excel": "EXCEL.EXE",
        "powerpoint": "POWERPNT.EXE",
        "photoshop": "Photoshop.exe",
        "paint": "mspaint.exe",
        "cmd": "cmd.exe",
        "terminal": "wt.exe",
        "task manager": "Taskmgr.exe",
        "settings": "ms-settings:",
    },
    "darwin": {
        "chrome": "Google Chrome",
        "firefox": "Firefox",
        "vscode": "Visual Studio Code",
        "code": "Visual Studio Code",
        "notepad": "TextEdit",
        "calculator": "Calculator",
        "finder": "Finder",
        "spotify": "Spotify",
        "discord": "Discord",
        "slack": "Slack",
        "terminal": "Terminal",
        "settings": "System Settings",
    },
    "linux": {
        "chrome": "google-chrome",
        "firefox": "firefox",
        "vscode": "code",
        "code": "code",
        "notepad": "gedit",
        "calculator": "gnome-calculator",
        "files": "nautilus",
        "terminal": "gnome-terminal",
        "spotify": "spotify",
        "discord": "discord",
        "settings": "gnome-control-center",
    },
}

_recent_file = Path.home() / ".jarvis_recent_apps.json"
_frequent_file = Path.home() / ".jarvis_frequent_apps.json"
_pinned_file = Path.home() / ".jarvis_pinned_apps.json"

def _load_json(path, default):
    try:
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return default

def _save_json(path, data):
    try:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass

def _get_os_key():
    sys = platform.system().lower()
    if sys == "windows":
        return "windows"
    elif sys == "darwin":
        return "darwin"
    else:
        return "linux"

def _launch_app(app_name):
    os_key = _get_os_key()
    app_map = APP_MAP.get(os_key, {})
    # Resolve app name
    app_lower = app_name.lower().strip()
    exe = app_map.get(app_lower, app_name)

    try:
        if platform.system() == "Windows":
            # Try os.startfile, then subprocess
            if Path(exe).exists():
                os.startfile(str(exe))
            else:
                # Try start via shell
                subprocess.Popen(f'start "" "{exe}"', shell=True)
        elif platform.system() == "Darwin":
            subprocess.Popen(["open", "-a", exe])
        else:
            subprocess.Popen([exe], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # Track recent and frequent
        recent = _load_json(_recent_file, [])
        recent = [app_lower] + [a for a in recent if a != app_lower]
        recent = recent[:20]
        _save_json(_recent_file, recent)

        frequent = _load_json(_frequent_file, {})
        frequent[app_lower] = frequent.get(app_lower, 0) + 1
        _save_json(_frequent_file, frequent)

        return f"Launched {app_name} ({exe})"
    except Exception as e:
        return f"Failed to launch {app_name} ({exe}): {e}. Try full path or install app."

def _list_installed():
    os_key = _get_os_key()
    app_map = APP_MAP.get(os_key, {})
    lines = [f"{name} → {exe}" for name, exe in app_map.items()]
    return f"Known apps for {os_key} ({len(lines)}):\n" + "\n".join(sorted(lines))

def _search_apps(query):
    os_key = _get_os_key()
    app_map = APP_MAP.get(os_key, {})
    matches = [f"{name} → {exe}" for name, exe in app_map.items() if query.lower() in name.lower() or query.lower() in exe.lower()]
    if not matches:
        return f"No apps found for '{query}' in known map — try full executable name or path"
    return f"Found {len(matches)} apps for '{query}':\n" + "\n".join(matches)

def run(parameters: dict, player=None, session_memory=None) -> str:
    action = (parameters.get("action", "launch") or "launch").lower().strip()
    app = parameters.get("app", "") or ""

    try:
        if player:
            try:
                player.write_log(f"App Launcher Pro: {action} {app}")
            except Exception:
                pass

        if action in ("help", "?", "h"):
            return (
                "App Launcher Pro — Intelligent App Launching:\n"
                "\n"
                "• launch app=chrome — launch app by name (per-OS map)\n"
                "• list — list known apps for your OS\n"
                "• recent — recent launched apps\n"
                "• frequent — frequent apps (most launched)\n"
                "• pin app=... — pin favorite app\n"
                "• unpin app=... — unpin\n"
                "• search app=query — search installed apps\n"
                "• kill app=... — kill app process\n"
                "\n"
                "Known apps (per OS):\n"
                "• Windows: chrome, firefox, edge, vscode, notepad, calculator, explorer, spotify, discord, slack, word, excel, paint, cmd, terminal, task manager, settings\n"
                "• macOS: chrome, firefox, vscode, textedit, calculator, finder, spotify, discord, terminal, settings\n"
                "• Linux: chrome, firefox, vscode, gedit, calculator, nautilus, terminal, spotify, discord, settings\n"
                "\n"
                "Examples:\n"
                "• app_launcher_pro action=launch app=chrome\n"
                "• app_launcher_pro action=launch app=vscode\n"
                "• app_launcher_pro action=recent\n"
                "• app_launcher_pro action=search app=code\n"
            )

        if action == "launch":
            if not app:
                return "Need app name: launch app=chrome"
            return _launch_app(app)

        if action == "list":
            return _list_installed()

        if action == "recent":
            recent = _load_json(_recent_file, [])
            if not recent:
                return "No recent apps yet — launch some apps first"
            return f"Recent apps ({len(recent)}):\n" + "\n".join([f"{i+1}. {a}" for i, a in enumerate(recent)])

        if action == "frequent":
            frequent = _load_json(_frequent_file, {})
            if not frequent:
                return "No frequent apps yet"
            sorted_freq = sorted(frequent.items(), key=lambda x: x[1], reverse=True)[:10]
            return f"Frequent apps:\n" + "\n".join([f"{name}: {count} times" for name, count in sorted_freq])

        if action == "pin":
            if not app:
                return "Need app name: pin app=chrome"
            pinned = _load_json(_pinned_file, [])
            if app.lower() not in pinned:
                pinned.append(app.lower())
                _save_json(_pinned_file, pinned)
            return f"Pinned {app} — pinned apps: {', '.join(pinned)}"

        if action == "unpin":
            if not app:
                return "Need app name: unpin app=chrome"
            pinned = _load_json(_pinned_file, [])
            pinned = [p for p in pinned if p != app.lower()]
            _save_json(_pinned_file, pinned)
            return f"Unpinned {app} — remaining: {', '.join(pinned) or 'none'}"

        if action == "search":
            if not app:
                return "Need query: search app=code"
            return _search_apps(app)

        if action == "kill":
            if not app:
                return "Need app name: kill app=chrome"
            try:
                import psutil
                killed = 0
                for p in psutil.process_iter(['name']):
                    try:
                        if app.lower() in (p.info['name'] or "").lower():
                            p.terminate()
                            killed += 1
                    except Exception:
                        continue
                return f"Killed {killed} processes for {app}"
            except ImportError:
                return "psutil not installed — pip install psutil"
            except Exception as e:
                return f"Kill failed: {e}"

        return f"Unknown action {action}. Say 'app_launcher_pro action=help'"

    except Exception as e:
        return f"App Launcher Pro failed: {e}"
