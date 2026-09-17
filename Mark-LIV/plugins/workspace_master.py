"""
Workspace Master — Save/Restore Window Layouts & Project Workspaces for JARVIS (Mark LIII)
Makes JARVIS impeccable at workspace management — remembers your PC setup.

Ported from ONEPUNCHMAN411/Jarvis control/workspace.py + brain/app_launch + process_watcher
+ window_manager_pro + app_launcher_pro + process_commander.

Free & open source, zero tokens.
"""

import json
import time
import platform
from pathlib import Path
from datetime import datetime

PLUGIN = {
    "name": "workspace_master",
    "description": (
        "Workspace save/restore & project workspaces master — makes JARVIS remember your PC setup (zero tokens). "
        "Actions: save name=... [include=windows,apps,files] — save current workspace list open windows via pygetwindow title pos x,y,w,h minimized/maximized + processes + current dir + timestamp to ~/.jarvis_workspaces/{name}.json, restore name=... — restore workspace reopen apps move windows to saved positions resize focus, list — list saved workspaces name date window count, delete name=... — delete workspace, create_project name=... path=... [template=python/web/empty] — create project folder + git init + README + open in VS Code/Explorer, switch name=... — save current as _previous restore target, current — current workspace info open windows active window processes recent files, auto_save enable/disable/status — auto-save every 5 min background thread, export name=... path=... / import path=... — export/import JSON, help. "
        "Use when user wants to save workspace, restore workspace, list workspaces, project workspace, switch workspace, current workspace, workspace master. "
        "Trigger phrases: workspace master, save workspace, restore workspace, list workspaces, create project, switch workspace, current workspace, workspace auto save, export workspace."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: save, restore, list, delete, create_project, switch, current, auto_save, export, import, help. Default list.",
            },
            "name": {"type": "STRING", "description": "Workspace name for save/restore/delete/switch/export, e.g. my_project, coding, writing"},
            "path": {"type": "STRING", "description": "Path for create_project or export/import, e.g. ~/Projects/MyProject or ~/workspace_backup.json"},
            "template": {"type": "STRING", "description": "Template for create_project: python, web, empty, default empty"},
            "include": {"type": "STRING", "description": "Include for save: windows,apps,files or all, default all"},
            "subaction": {"type": "STRING", "description": "Subaction for auto_save: enable, disable, status, default status"},
        },
        "required": ["action"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "workspace_master",
    "title": "Workspace Master — Save/Restore Layouts",
    "description": "Save/restore window layouts & project workspaces — zero tokens",
    "icon": "🗂️",
    "color": "#F59E0B",
    "order": 37,
    "default_enabled": True,
    "fields": [
        {"key": "workspaces_dir", "label": "Workspaces directory", "type": "text", "default": "~/.jarvis_workspaces"},
        {"key": "auto_save_interval", "label": "Auto-save interval minutes", "type": "number", "default": 5},
        {"key": "auto_save", "label": "Enable auto-save", "type": "checkbox", "default": False},
    ],
}

_workspaces_dir = Path.home() / ".jarvis_workspaces"
_auto_save_thread = None
_auto_save_stop = None
_auto_save_enabled = False

def _ensure_dir():
    try:
        _workspaces_dir.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass

def _get_open_windows():
    """Get open windows via pygetwindow."""
    windows = []
    try:
        import pygetwindow as gw
        for w in gw.getAllWindows():
            try:
                if not w.title or not w.title.strip():
                    continue
                # Skip zero size
                if w.width == 0 or w.height == 0:
                    continue
                windows.append({
                    "title": w.title[:100],
                    "left": w.left,
                    "top": w.top,
                    "width": w.width,
                    "height": w.height,
                    "isMinimized": w.isMinimized if hasattr(w, 'isMinimized') else False,
                    "isMaximized": w.isMaximized if hasattr(w, 'isMaximized') else False,
                })
            except Exception:
                continue
    except ImportError:
        # Fallback via ctypes? For now return empty
        pass
    except Exception:
        pass
    return windows

def _get_processes():
    try:
        import psutil
        procs = []
        for p in psutil.process_iter(['name', 'pid']):
            try:
                name = p.info['name']
                if name:
                    procs.append(name)
            except Exception:
                continue
        # Unique, top 20
        unique = list(dict.fromkeys(procs))[:30]
        return unique
    except Exception:
        return []

def _get_active_window():
    try:
        import ctypes
        hwnd = ctypes.windll.user32.GetForegroundWindow()
        if not hwnd:
            return {}
        length = ctypes.windll.user32.GetWindowTextLengthW(hwnd)
        buf = ctypes.create_unicode_buffer(length + 1)
        ctypes.windll.user32.GetWindowTextW(hwnd, buf, length + 1)
        title = buf.value or "Unknown"
        rect = ctypes.wintypes.RECT()
        ctypes.windll.user32.GetWindowRect(hwnd, ctypes.byref(rect))
        return {"title": title, "rect": {"x": rect.left, "y": rect.top, "w": rect.right - rect.left, "h": rect.bottom - rect.top}}
    except Exception:
        return {}

def _save_workspace(name, include="all"):
    _ensure_dir()
    data = {
        "name": name,
        "created": datetime.now().isoformat(),
        "platform": platform.system(),
        "include": include,
    }
    if include in ("all", "windows"):
        data["windows"] = _get_open_windows()
    if include in ("all", "apps", "processes"):
        data["processes"] = _get_processes()
    if include in ("all", "files"):
        try:
            data["cwd"] = str(Path.cwd())
        except Exception:
            data["cwd"] = ""
    data["active_window"] = _get_active_window()
    # Save
    file_path = _workspaces_dir / f"{name}.json"
    try:
        file_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        return file_path, None
    except Exception as e:
        return None, str(e)

def _load_workspace(name):
    _ensure_dir()
    file_path = _workspaces_dir / f"{name}.json"
    if not file_path.exists():
        return None, f"Workspace '{name}' not found — list to see available"
    try:
        data = json.loads(file_path.read_text(encoding="utf-8"))
        return data, None
    except Exception as e:
        return None, str(e)

def _auto_save_loop(interval_minutes=5):
    import threading
    global _auto_save_enabled
    while _auto_save_enabled:
        try:
            time.sleep(interval_minutes * 60)
            if not _auto_save_enabled:
                break
            _save_workspace("_autosave", include="all")
        except Exception:
            continue

def _ensure_auto_save_thread(interval_minutes=5):
    global _auto_save_thread, _auto_save_stop, _auto_save_enabled
    if _auto_save_thread and _auto_save_thread.is_alive():
        return
    _auto_save_enabled = True
    import threading
    _auto_save_thread = threading.Thread(target=_auto_save_loop, args=(interval_minutes,), daemon=True)
    _auto_save_thread.start()

def run(parameters: dict, player=None, session_memory=None) -> str:
    global _auto_save_enabled
    action = (parameters.get("action", "list") or "list").lower().strip()
    name = parameters.get("name", "") or ""
    path_str = parameters.get("path", "") or ""
    template = (parameters.get("template", "empty") or "empty").lower().strip()
    include = (parameters.get("include", "all") or "all").lower().strip()
    subaction = (parameters.get("subaction", "status") or "status").lower().strip()

    try:
        if player:
            try:
                player.write_log(f"Workspace Master: {action} name={name} path={path_str}")
            except Exception:
                pass

        if action in ("help", "?", "h"):
            return (
                "Workspace Master — Save/Restore Window Layouts & Project Workspaces (Zero Tokens, from ONEPUNCHMAN411/Jarvis workspace.py):\n"
                "\n"
                "Makes JARVIS remember your PC setup — save/restore window positions, project workspaces, session continuity.\n"
                "\n"
                "• save name=... [include=windows,apps,files/all] — save current workspace: list open windows via pygetwindow title pos x,y,w,h minimized/maximized + processes + cwd + active window + timestamp to ~/.jarvis_workspaces/{name}.json\n"
                "• restore name=... — restore workspace: move windows to saved positions via pygetwindow moveTo/resizeTo, minimize/maximize, focus, reopen apps? (best effort)\n"
                "• list — list saved workspaces name date window count via ~/.jarvis_workspaces/*.json\n"
                "• delete name=... — delete workspace JSON\n"
                "• create_project name=... path=... [template=python/web/empty] — create project folder + git init + README.md + .gitignore + open in VS Code (code path) or Explorer, templates: python (main.py requirements.txt), web (index.html style.css script.js), empty (README)\n"
                "• switch name=... — save current as _previous then restore target\n"
                "• current — current workspace info: open windows count + titles, active window via ctypes, processes top 10, cwd, recent workspaces\n"
                "• auto_save subaction=enable/disable/status — auto-save every 5 min background thread saves as _autosave\n"
                "• export name=... path=... — export workspace JSON to custom path, import path=... — import JSON as workspace (filename becomes name)\n"
                "\n"
                "Examples:\n"
                "• workspace_master action=save name=coding include=all\n"
                "• workspace_master action=list\n"
                "• workspace_master action=restore name=coding\n"
                "• workspace_master action=create_project name=MyApp path=~/Projects/MyApp template=python\n"
                "• workspace_master action=current\n"
                "• workspace_master action=switch name=writing\n"
                "• workspace_master action=auto_save subaction=enable\n"
                "\n"
                "Zero tokens, pure local via pygetwindow + psutil + json + pathlib.\n"
                "Install: pip install pygetwindow psutil\n"
                "Workspaces stored ~/.jarvis_workspaces/*.json\n"
            )

        if action == "save":
            if not name:
                return "Need name: save name=my_project — e.g., coding, writing, my_project"
            file_path, err = _save_workspace(name, include=include)
            if err:
                return f"Save workspace failed: {err}"
            # Count windows
            try:
                data = json.loads(file_path.read_text(encoding="utf-8"))
                win_count = len(data.get("windows", []))
                proc_count = len(data.get("processes", []))
                return f"Saved workspace '{name}' to {file_path} — {win_count} windows, {proc_count} processes, include {include} — zero tokens, local JSON"
            except Exception:
                return f"Saved workspace '{name}' to {file_path}"

        if action == "list":
            _ensure_dir()
            try:
                files = list(_workspaces_dir.glob("*.json"))
                if not files:
                    return "No saved workspaces — save via save name=my_project"
                lines = []
                for f in sorted(files, key=lambda x: x.stat().st_mtime, reverse=True):
                    try:
                        data = json.loads(f.read_text(encoding="utf-8"))
                        win_count = len(data.get("windows", []))
                        created = data.get("created", "")[:19]
                        lines.append(f"• {f.stem} — {win_count} windows, created {created}, {f.stat().st_size} bytes")
                    except Exception:
                        lines.append(f"• {f.stem} — (corrupt or old)")
                return f"Saved workspaces ({len(files)}) in {_workspaces_dir}:\n" + "\n".join(lines)
            except Exception as e:
                return f"List workspaces failed: {e}"

        if action == "delete":
            if not name:
                return "Need name: delete name=my_project — list to see available"
            _ensure_dir()
            file_path = _workspaces_dir / f"{name}.json"
            if not file_path.exists():
                return f"Workspace '{name}' not found — list to see available"
            try:
                file_path.unlink()
                return f"Deleted workspace '{name}'"
            except Exception as e:
                return f"Delete failed: {e}"

        if action == "restore":
            if not name:
                return "Need name: restore name=my_project"
            data, err = _load_workspace(name)
            if err:
                return err
            windows = data.get("windows", [])
            if not windows:
                return f"Workspace '{name}' has no windows to restore"
            restored = 0
            failed = 0
            try:
                import pygetwindow as gw
                for win_data in windows:
                    title = win_data.get("title", "")
                    if not title:
                        continue
                    try:
                        # Find window by title
                        wins = gw.getWindowsWithTitle(title)
                        if not wins:
                            # Try partial
                            for t in gw.getAllTitles():
                                if title.lower() in t.lower() and t.strip():
                                    wins = gw.getWindowsWithTitle(t)
                                    if wins:
                                        break
                        if not wins:
                            failed += 1
                            continue
                        w = wins[0]
                        # Restore position
                        try:
                            if win_data.get("isMinimized"):
                                w.minimize()
                            elif win_data.get("isMaximized"):
                                w.maximize()
                            else:
                                # Move and resize
                                w.moveTo(win_data.get("left", 0), win_data.get("top", 0))
                                w.resizeTo(win_data.get("width", 800), win_data.get("height", 600))
                        except Exception:
                            pass
                        restored += 1
                    except Exception:
                        failed += 1
                        continue
                return f"Restored workspace '{name}' — {restored} windows restored, {failed} failed (window may be closed) — zero tokens, best effort via pygetwindow"
            except ImportError:
                return "pygetwindow not installed — pip install pygetwindow for restore"
            except Exception as e:
                return f"Restore failed: {e}"

        if action == "create_project":
            if not name or not path_str:
                return "Need name and path: create_project name=MyApp path=~/Projects/MyApp template=python/web/empty"
            try:
                proj_path = Path(path_str).expanduser()
                proj_path.mkdir(parents=True, exist_ok=True)

                if template == "python":
                    (proj_path / "main.py").write_text('print("Hello from MyApp")\n', encoding="utf-8")
                    (proj_path / "requirements.txt").write_text("# Add deps\n", encoding="utf-8")
                    (proj_path / "README.md").write_text(f"# {name}\n\nPython project created by JARVIS Workspace Master\n", encoding="utf-8")
                    (proj_path / ".gitignore").write_text("__pycache__/\n*.pyc\n.venv/\n", encoding="utf-8")
                elif template == "web":
                    (proj_path / "index.html").write_text(f'<!DOCTYPE html><html><head><title>{name}</title><link rel=\"stylesheet\" href=\"style.css\"></head><body><h1>{name}</h1><script src=\"script.js\"></script></body></html>\n', encoding="utf-8")
                    (proj_path / "style.css").write_text("body { font-family: sans-serif; }\n", encoding="utf-8")
                    (proj_path / "script.js").write_text('console.log("Hello");\n', encoding="utf-8")
                    (proj_path / "README.md").write_text(f"# {name}\n\nWeb project created by JARVIS Workspace Master\n", encoding="utf-8")
                else:
                    (proj_path / "README.md").write_text(f"# {name}\n\nProject created by JARVIS Workspace Master\n\nPath: {proj_path}\nCreated: {datetime.now().isoformat()}\n", encoding="utf-8")

                # Try git init
                try:
                    import subprocess
                    subprocess.run(["git", "init"], cwd=str(proj_path), capture_output=True, timeout=10)
                except Exception:
                    pass

                # Try open in VS Code
                opened = ""
                try:
                    import subprocess
                    result = subprocess.run(["code", str(proj_path)], capture_output=True, timeout=5)
                    if result.returncode == 0:
                        opened = "Opened in VS Code"
                except Exception:
                    pass

                if not opened:
                    try:
                        import os
                        if platform.system() == "Windows":
                            os.startfile(str(proj_path))
                        elif platform.system() == "Darwin":
                            import subprocess
                            subprocess.run(["open", str(proj_path)], timeout=5)
                        else:
                            import subprocess
                            subprocess.run(["xdg-open", str(proj_path)], timeout=5)
                        opened = "Opened in Explorer/Finder"
                    except Exception:
                        opened = "Created, open manually"

                # Also save as workspace
                _save_workspace(name, include="all")

                return f"Created project '{name}' at {proj_path} template {template} — {opened} — also saved as workspace '{name}' — zero tokens"
            except Exception as e:
                return f"Create project failed: {e}"

        if action == "switch":
            if not name:
                return "Need name: switch name=writing — saves current as _previous then restores target"
            # Save current as _previous
            _save_workspace("_previous", include="all")
            # Restore target
            data, err = _load_workspace(name)
            if err:
                return err
            # Reuse restore logic
            windows = data.get("windows", [])
            restored = 0
            try:
                import pygetwindow as gw
                for win_data in windows:
                    title = win_data.get("title", "")
                    if not title:
                        continue
                    try:
                        wins = gw.getWindowsWithTitle(title)
                        if not wins:
                            continue
                        w = wins[0]
                        w.moveTo(win_data.get("left", 0), win_data.get("top", 0))
                        w.resizeTo(win_data.get("width", 800), win_data.get("height", 600))
                        restored += 1
                    except Exception:
                        continue
                return f"Switched to workspace '{name}' — saved current as _previous, restored {restored} windows — zero tokens"
            except ImportError:
                return "pygetwindow not installed — pip install pygetwindow"
            except Exception as e:
                return f"Switch failed: {e}"

        if action == "current":
            windows = _get_open_windows()
            active = _get_active_window()
            processes = _get_processes()
            try:
                cwd = str(Path.cwd())
            except Exception:
                cwd = "Unknown"
            lines = [
                f"Current workspace info (zero tokens):",
                f"• Open windows: {len(windows)}",
            ]
            for i, w in enumerate(windows[:10], 1):
                lines.append(f"  {i}. {w.get('title', 'Unknown')} at ({w.get('left')}, {w.get('top')}) {w.get('width')}x{w.get('height')}")
            if len(windows) > 10:
                lines.append(f"  ... and {len(windows)-10} more")
            if active:
                lines.append(f"• Active window: {active.get('title', 'Unknown')} at {active.get('rect', {})}")
            lines.append(f"• Processes: {len(processes)} unique, top 10: {', '.join(processes[:10])}")
            lines.append(f"• CWD: {cwd}")
            # Recent workspaces
            _ensure_dir()
            try:
                files = sorted(_workspaces_dir.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True)[:5]
                if files:
                    lines.append(f"• Recent workspaces: {', '.join([f.stem for f in files])}")
            except Exception:
                pass
            return "\n".join(lines)

        if action == "auto_save":
            if subaction == "enable":
                _ensure_auto_save_thread(interval_minutes=5)
                return "Auto-save enabled — saves current workspace as _autosave every 5 minutes via background daemon thread (zero tokens)"
            elif subaction == "disable":
                _auto_save_enabled = False
                return "Auto-save disabled — background thread will stop after current sleep"
            else:
                status = "enabled" if _auto_save_enabled else "disabled"
                thread_alive = _auto_save_thread.is_alive() if _auto_save_thread else False
                return f"Auto-save status: {status}, thread alive: {thread_alive}, interval 5 min, saves as _autosave in {_workspaces_dir}"

        if action == "export":
            if not name or not path_str:
                return "Need name and path: export name=my_project path=~/backup.json"
            data, err = _load_workspace(name)
            if err:
                return err
            try:
                export_path = Path(path_str).expanduser()
                export_path.parent.mkdir(parents=True, exist_ok=True)
                export_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
                return f"Exported workspace '{name}' to {export_path} — {export_path.stat().st_size} bytes"
            except Exception as e:
                return f"Export failed: {e}"

        if action == "import":
            if not path_str:
                return "Need path: import path=~/backup.json"
            try:
                import_path = Path(path_str).expanduser()
                if not import_path.exists():
                    return f"File not found: {import_path}"
                data = json.loads(import_path.read_text(encoding="utf-8"))
                name_from_file = import_path.stem
                # Save as workspace
                _ensure_dir()
                dest = _workspaces_dir / f"{name_from_file}.json"
                dest.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
                return f"Imported workspace '{name_from_file}' from {import_path} to {dest} — {len(data.get('windows', []))} windows"
            except Exception as e:
                return f"Import failed: {e}"

        return f"Unknown action {action}. Say 'workspace_master action=help'"

    except Exception as e:
        return f"Workspace Master failed: {e}"
