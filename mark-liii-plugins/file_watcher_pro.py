"""
File Watcher Pro — File & Folder Watcher with Auto Actions for JARVIS (Mark LIII)
Makes JARVIS impeccable at watching file system — organize Downloads when new file arrives, backup when file changes.

Ported from ONEPUNCHMAN411/Jarvis brain/file_organizer.py + process_watcher.py + region_watcher_pro pattern
+ watchdog library.

Free & open source, zero tokens.
"""

import time
import threading
import json
import shutil
from pathlib import Path
from datetime import datetime

PLUGIN = {
    "name": "file_watcher_pro",
    "description": (
        "File & folder watcher pro with auto actions — makes JARVIS impeccable at watching file system (zero tokens). "
        "Background thread via watchdog Observer or polling fallback mtime, watches dict id→path label mode created/modified/deleted/all action organize/backup/notify/custom dest events paused created. "
        "Actions: add path=... [label=...] [mode=created/modified/deleted/all] [action=organize/backup/notify/custom] [dest=...] — add watcher returns id, list — list watchers id path mode action events count, remove id=... — remove watcher or all if no id, status — watcher thread status watch count events, events [id=...] [limit=20] — recent events timestamp path event type action taken, pause id=... / resume id=... — pause/resume watcher, help. "
        "Organize moves file by extension to subfolder Images/Videos/Docs/etc, backup copies to dest with timestamp, notify via plyer notification, custom emits ui event. "
        "Use when user wants to watch file, watch folder, auto organize Downloads, backup file, file watcher. "
        "Trigger phrases: file watcher, watch file, watch folder, auto organize, backup file, file watcher pro, watch Downloads, file system watcher."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: add, list, remove, status, events, pause, resume, help. Default list.",
            },
            "id": {"type": "STRING", "description": "Watcher ID for remove/pause/resume/events"},
            "path": {"type": "STRING", "description": "File or folder path to watch, e.g. ~/Downloads, ~/Documents/report.docx"},
            "label": {"type": "STRING", "description": "Label for watcher, e.g. Downloads Watcher"},
            "mode": {"type": "STRING", "description": "Mode: created, modified, deleted, all, default all"},
            "watch_action": {"type": "STRING", "description": "Auto action: organize, backup, notify, custom, default notify"},
            "dest": {"type": "STRING", "description": "Destination for backup/organize, e.g. ~/Backups, ~/Downloads/Organized"},
            "limit": {"type": "NUMBER", "description": "Limit for events action, default 20"},
        },
        "required": ["action"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "file_watcher_pro",
    "title": "File Watcher Pro — File System Watcher",
    "description": "Watch files/folders for changes and auto organize/backup/notify — zero tokens",
    "icon": "👁️",
    "color": "#EF4444",
    "order": 39,
    "default_enabled": True,
    "fields": [
        {"key": "poll_interval", "label": "Poll interval seconds if no watchdog", "type": "number", "default": 1.0},
        {"key": "organize_map", "label": "Organize map JSON", "type": "text", "default": "{\"Images\": [\".jpg\", \".png\", \".gif\"], \"Videos\": [\".mp4\", \".mov\"], \"Docs\": [\".pdf\", \".docx\"]}"},
    ],
}

# Global state
_watchers = {}  # id → dict path label mode action dest events paused created
_events = []  # list of events {timestamp, watcher_id, path, event_type, action_taken}
_observer = None
_poll_thread = None
_stop_event = threading.Event()
_lock = threading.Lock()
_next_id = 1

_organize_map = {
    "Images": [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"],
    "Videos": [".mp4", ".mov", ".avi", ".mkv", ".webm", ".flv"],
    "Audio": [".mp3", ".wav", ".flac", ".m4a", ".ogg"],
    "Docs": [".pdf", ".docx", ".doc", ".txt", ".md", ".rtf"],
    "Sheets": [".xlsx", ".xls", ".csv"],
    "Archives": [".zip", ".rar", ".7z", ".tar", ".gz"],
    "Code": [".py", ".js", ".ts", ".html", ".css", ".json"],
}

def _notify(title, message):
    try:
        from plyer import notification
        notification.notify(title=title, message=message, timeout=5)
    except Exception:
        pass

def _organize_file(file_path, dest_base=None):
    """Organize file by extension to subfolder."""
    try:
        p = Path(file_path)
        if not p.exists() or not p.is_file():
            return None
        ext = p.suffix.lower()
        category = "Others"
        for cat, exts in _organize_map.items():
            if ext in exts:
                category = cat
                break
        if dest_base:
            dest_dir = Path(dest_base).expanduser() / category
        else:
            dest_dir = p.parent / category
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_path = dest_dir / p.name
        # Avoid overwrite
        if dest_path.exists():
            dest_path = dest_dir / f"{p.stem}_{int(time.time())}{p.suffix}"
        shutil.move(str(p), str(dest_path))
        return str(dest_path)
    except Exception as e:
        return f"Organize failed: {e}"

def _backup_file(file_path, dest_base):
    try:
        p = Path(file_path)
        if not p.exists():
            return None
        dest_dir = Path(dest_base).expanduser()
        dest_dir.mkdir(parents=True, exist_ok=True)
        # With timestamp
        dest_path = dest_dir / f"{p.stem}_{int(time.time())}{p.suffix}"
        shutil.copy2(str(p), str(dest_path))
        return str(dest_path)
    except Exception as e:
        return f"Backup failed: {e}"

def _handle_event(watcher_id, event_path, event_type):
    """Handle file event per watcher action."""
    with _lock:
        watcher = _watchers.get(watcher_id)
        if not watcher or watcher.get("paused"):
            return
        action = watcher.get("action", "notify")
        dest = watcher.get("dest", "")

    action_taken = ""
    if action == "organize":
        if event_type in ("created", "modified") and Path(event_path).is_file():
            result = _organize_file(event_path, dest_base=dest if dest else None)
            action_taken = f"organized to {result}" if result else "organize skipped (not file)"
    elif action == "backup":
        if event_type in ("created", "modified"):
            if dest:
                result = _backup_file(event_path, dest_base=dest)
                action_taken = f"backed up to {result}" if result else "backup failed"
            else:
                action_taken = "backup skipped — no dest"
    elif action == "notify":
        _notify(f"JARVIS File Watcher: {watcher.get('label', watcher_id)}", f"{event_type}: {Path(event_path).name}")
        action_taken = f"notified {event_type}"
    elif action == "custom":
        action_taken = f"custom event {event_type} at {event_path}"
        print(f"[FileWatcherPro] Custom event watcher {watcher_id} {event_type} {event_path}")

    # Record event
    with _lock:
        _events.append({
            "timestamp": datetime.now().isoformat(),
            "watcher_id": watcher_id,
            "path": str(event_path),
            "event_type": event_type,
            "action_taken": action_taken,
        })
        # Keep last 100 events
        if len(_events) > 100:
            _events.pop(0)
        # Increment watcher events count
        if watcher_id in _watchers:
            _watchers[watcher_id]["events"] = _watchers[watcher_id].get("events", 0) + 1

# Watchdog handler
class _WatchdogHandler:
    def __init__(self):
        pass

    def dispatch(self, event):
        # event is watchdog event
        try:
            # Find watcher(s) matching path
            event_path = event.src_path
            event_type = "unknown"
            if event.event_type == "created":
                event_type = "created"
            elif event.event_type == "modified":
                event_type = "modified"
            elif event.event_type == "deleted":
                event_type = "deleted"
            elif event.event_type == "moved":
                event_type = "moved"

            with _lock:
                watchers_snapshot = dict(_watchers)

            for wid, watcher in watchers_snapshot.items():
                try:
                    watch_path = watcher.get("path", "")
                    if not watch_path:
                        continue
                    # Check if event path is inside watch path (if watch path is dir) or equals (if file)
                    wp = Path(watch_path)
                    ep = Path(event_path)
                    if wp.is_dir():
                        # Check if ep is inside wp
                        try:
                            ep.relative_to(wp)
                            match = True
                        except ValueError:
                            match = False
                    else:
                        match = str(ep) == str(wp) or str(ep).startswith(str(wp))

                    if not match:
                        continue

                    mode = watcher.get("mode", "all")
                    if mode != "all" and mode != event_type:
                        continue

                    if watcher.get("paused"):
                        continue

                    _handle_event(wid, event_path, event_type)
                except Exception:
                    continue
        except Exception:
            pass

    def on_created(self, event):
        self.dispatch(event)

    def on_modified(self, event):
        self.dispatch(event)

    def on_deleted(self, event):
        self.dispatch(event)

    def on_moved(self, event):
        self.dispatch(event)

def _polling_loop(poll_interval=1.0):
    """Polling fallback if watchdog not available — check mtime."""
    # Snapshot mtimes
    last_mtimes = {}
    while not _stop_event.is_set():
        try:
            time.sleep(poll_interval)
            if _stop_event.is_set():
                break
            with _lock:
                watchers_snapshot = dict(_watchers)
            if not watchers_snapshot:
                break

            for wid, watcher in watchers_snapshot.items():
                try:
                    if watcher.get("paused"):
                        continue
                    watch_path = watcher.get("path", "")
                    if not watch_path:
                        continue
                    p = Path(watch_path)
                    if not p.exists():
                        continue

                    mode = watcher.get("mode", "all")

                    if p.is_file():
                        # Check file mtime
                        mtime = p.stat().st_mtime
                        last = last_mtimes.get(wid)
                        if last is None:
                            last_mtimes[wid] = mtime
                            continue
                        if mtime != last:
                            last_mtimes[wid] = mtime
                            if mode in ("all", "modified"):
                                _handle_event(wid, str(p), "modified")
                    else:
                        # Dir — list files and check
                        try:
                            current_files = {str(f): f.stat().st_mtime for f in p.iterdir() if f.is_file()}
                            last_files = last_mtimes.get(wid, {})
                            if not isinstance(last_files, dict):
                                last_files = {}
                                last_mtimes[wid] = current_files
                                continue

                            # Created
                            for f_path, mtime in current_files.items():
                                if f_path not in last_files:
                                    if mode in ("all", "created"):
                                        _handle_event(wid, f_path, "created")
                                else:
                                    if mtime != last_files[f_path]:
                                        if mode in ("all", "modified"):
                                            _handle_event(wid, f_path, "modified")

                            # Deleted
                            for f_path in last_files:
                                if f_path not in current_files:
                                    if mode in ("all", "deleted"):
                                        _handle_event(wid, f_path, "deleted")

                            last_mtimes[wid] = current_files
                        except Exception:
                            continue
                except Exception:
                    continue
        except Exception:
            continue

def _ensure_watcher():
    global _observer, _poll_thread, _stop_event
    # Try watchdog first
    try:
        from watchdog.observers import Observer
        from watchdog.events import FileSystemEventHandler

        # Create observer if not exists or not alive
        if _observer and _observer.is_alive():
            return

        _stop_event.clear()

        # Create handler that inherits from FileSystemEventHandler
        class Handler(FileSystemEventHandler):
            def on_created(self, event):
                _WatchdogHandler().on_created(event)
            def on_modified(self, event):
                _WatchdogHandler().on_modified(event)
            def on_deleted(self, event):
                _WatchdogHandler().on_deleted(event)
            def on_moved(self, event):
                _WatchdogHandler().on_moved(event)

        _observer = Observer()
        # Schedule all watchers
        with _lock:
            watchers_snapshot = dict(_watchers)

        for wid, watcher in watchers_snapshot.items():
            try:
                watch_path = watcher.get("path", "")
                if not watch_path:
                    continue
                p = Path(watch_path)
                # Watchdog needs dir — if file, watch parent
                if p.is_file():
                    watch_dir = str(p.parent)
                else:
                    watch_dir = str(p)
                if not Path(watch_dir).exists():
                    continue
                _observer.schedule(Handler(), watch_dir, recursive=True)
            except Exception:
                continue

        _observer.start()
        return
    except ImportError:
        # Fallback to polling thread
        pass
    except Exception:
        pass

    # Fallback polling
    if _poll_thread and _poll_thread.is_alive():
        return
    _stop_event.clear()
    _poll_thread = threading.Thread(target=_polling_loop, args=(1.0,), daemon=True)
    _poll_thread.start()

def _stop_watcher_if_empty():
    global _observer, _poll_thread
    with _lock:
        empty = len(_watchers) == 0
    if empty:
        _stop_event.set()
        if _observer:
            try:
                _observer.stop()
                _observer.join(timeout=2)
            except Exception:
                pass
            _observer = None
        # Poll thread will stop on next loop via _stop_event

def run(parameters: dict, player=None, session_memory=None) -> str:
    global _watchers, _next_id, _events
    action = (parameters.get("action", "list") or "list").lower().strip()
    watch_id = parameters.get("id", "") or ""
    path_str = parameters.get("path", "") or ""
    label = parameters.get("label", "") or ""
    mode = (parameters.get("mode", "all") or "all").lower().strip()
    watch_action = (parameters.get("watch_action", "") or parameters.get("action", "") or "notify")
    # The parameter named "action" conflicts with main action, so we check watch_action param
    # Actually PLUGIN uses watch_action key
    watch_action_val = parameters.get("watch_action", "notify") or "notify"
    if isinstance(watch_action_val, str):
        watch_action_val = watch_action_val.lower().strip()
    else:
        watch_action_val = "notify"
    # If user passed action=organize as main action, treat as add with organize
    if action in ("organize", "backup", "notify", "custom"):
        watch_action_val = action
        action = "add"

    dest = parameters.get("dest", "") or ""
    limit = parameters.get("limit", 20)
    try:
        limit = int(limit)
    except Exception:
        limit = 20
    limit = max(1, min(100, limit))

    try:
        if player:
            try:
                player.write_log(f"File Watcher Pro: {action} id={watch_id} path={path_str}")
            except Exception:
                pass

        if action in ("help", "?", "h"):
            return (
                "File Watcher Pro — File & Folder Watcher with Auto Actions (Zero Tokens, from ONEPUNCHMAN411 brain/file_organizer.py + process_watcher.py + region_watcher_pro pattern):\n"
                "\n"
                "Background thread via watchdog Observer or polling fallback mtime, watches dict id→path label mode created/modified/deleted/all action organize/backup/notify/custom dest events paused created.\n"
                "\n"
                "• add path=... [label=...] [mode=created/modified/deleted/all] [watch_action=organize/backup/notify/custom] [dest=...] — add watcher, path file or folder e.g. ~/Downloads, mode default all, action: organize (move by type to Images/Videos/Docs/etc subfolder), backup (copy to dest with timestamp), notify (plyer notification), custom (emit ui event), returns watch id, starts background thread\n"
                "• list — list watchers id, path, label, mode, action, events count, paused\n"
                "• remove id=... — remove watcher by id, or all if no id\n"
                "• status — watcher thread status (watchdog or polling), watch count, events count\n"
                "• events [id=...] [limit=20] — recent events timestamp, watcher_id, path, event_type, action_taken\n"
                "• pause id=... / resume id=... — pause/resume watcher\n"
                "\n"
                "Organize map: Images .jpg .png .gif, Videos .mp4 .mov, Audio .mp3 .wav, Docs .pdf .docx .txt .md, Sheets .xlsx .csv, Archives .zip .rar, Code .py .js .ts .html .css .json, Others rest — moves to dest/category or path/category.\n"
                "\n"
                "Examples:\n"
                "• file_watcher_pro action=add path=~/Downloads label=Downloads mode=created watch_action=organize dest=~/Downloads/Organized\n"
                "• file_watcher_pro action=add path=~/Downloads label=Downloads mode=created watch_action=notify\n"
                "• file_watcher_pro action=add path=~/Documents/report.docx mode=modified watch_action=backup dest=~/Backups\n"
                "• file_watcher_pro action=list\n"
                "• file_watcher_pro action=events limit=20\n"
                "• file_watcher_pro action=remove id=1\n"
                "\n"
                "Zero tokens — local via watchdog or polling mtime, plyer, shutil.\n"
                "Install: pip install watchdog plyer (plyer optional for notifications)\n"
                "Thread-safe via lock, daemon thread stops when no watchers.\n"
            )

        if action == "add":
            if not path_str:
                return "Need path: add path=~/Downloads mode=created watch_action=organize — e.g., ~/Downloads, ~/Documents/report.docx"
            p = Path(path_str).expanduser()
            if not p.exists():
                return f"Path not found: {p} — create folder first or check path"
            if mode not in ("created", "modified", "deleted", "all"):
                return "Mode must be created, modified, deleted, or all"
            if watch_action_val not in ("organize", "backup", "notify", "custom"):
                watch_action_val = "notify"

            with _lock:
                new_id = str(_next_id)
                _next_id += 1
                _watchers[new_id] = {
                    "path": str(p),
                    "label": label or f"Watcher {new_id}",
                    "mode": mode,
                    "action": watch_action_val,
                    "dest": str(Path(dest).expanduser()) if dest else "",
                    "events": 0,
                    "paused": False,
                    "created": datetime.now().isoformat(),
                }

            _ensure_watcher()

            return (
                f"Added file watcher {new_id}: '{label or f'Watcher {new_id}'}' path {p} mode={mode} action={watch_action_val} dest={dest or 'auto'}\n"
                f"Background thread started (watchdog if available else polling 1s) — will {watch_action_val} on {mode} events\n"
                f"Use list to see watchers, events limit=20 to see recent events, remove id={new_id} to stop"
            )

        if action == "list":
            with _lock:
                watchers_copy = dict(_watchers)
            if not watchers_copy:
                return "No file watchers — use add action to watch file/folder"
            lines = []
            for wid, w in watchers_copy.items():
                lines.append(
                    f"{wid}. '{w.get('label')}' path {w.get('path')} mode={w.get('mode')} action={w.get('action')} dest={w.get('dest') or 'auto'} events={w.get('events',0)} paused={w.get('paused')} created {w.get('created','')[:19]}"
                )
            return f"File watchers ({len(watchers_copy)}):\n" + "\n".join(lines)

        if action == "remove":
            if not watch_id:
                # Remove all?
                with _lock:
                    count = len(_watchers)
                    _watchers.clear()
                    _events.clear()
                _stop_watcher_if_empty()
                return f"Removed all {count} file watchers — background thread will stop"
            with _lock:
                if watch_id not in _watchers:
                    return f"No watcher with id {watch_id} — use list to see watchers"
                del _watchers[watch_id]
                remaining = len(_watchers)
            if remaining == 0:
                _stop_watcher_if_empty()
                return f"Removed watcher {watch_id}, no watchers left — background thread will stop"
            return f"Removed watcher {watch_id}, {remaining} watchers remaining"

        if action == "status":
            with _lock:
                count = len(_watchers)
                events_count = len(_events)
            watchdog_available = False
            try:
                import watchdog
                watchdog_available = True
            except ImportError:
                pass
            observer_alive = _observer.is_alive() if _observer else False
            poll_alive = _poll_thread.is_alive() if _poll_thread else False
            return (
                f"File Watcher Pro status:\n"
                f"• Watchdog available: {watchdog_available} — pip install watchdog for efficient watching, else polling fallback\n"
                f"• Observer alive: {observer_alive}\n"
                f"• Poll thread alive: {poll_alive}\n"
                f"• Watchers: {count}\n"
                f"• Events: {events_count} (last 100 kept)\n"
                f"• Organize map: Images, Videos, Audio, Docs, Sheets, Archives, Code, Others\n"
                f"• Actions: organize (move by ext), backup (copy with timestamp), notify (plyer), custom (print)\n"
            )

        if action == "events":
            with _lock:
                events_copy = list(_events)
            if not events_copy:
                return "No events yet — add watcher and trigger file change"
            # Filter by id if provided
            if watch_id:
                events_copy = [e for e in events_copy if e.get("watcher_id") == watch_id]
                if not events_copy:
                    return f"No events for watcher {watch_id}"
            # Limit
            events_copy = events_copy[-limit:]
            lines = []
            for e in events_copy:
                lines.append(
                    f"{e.get('timestamp','')[:19]} watcher {e.get('watcher_id')} {e.get('event_type')} {Path(e.get('path','')).name} → {e.get('action_taken')}"
                )
            return f"Recent events ({len(events_copy)} of {len(_events)} total):\n" + "\n".join(lines)

        if action == "pause":
            if not watch_id:
                return "Need id: pause id=1"
            with _lock:
                if watch_id not in _watchers:
                    return f"No watcher {watch_id}"
                _watchers[watch_id]["paused"] = True
            return f"Paused watcher {watch_id}"

        if action == "resume":
            if not watch_id:
                return "Need id: resume id=1"
            with _lock:
                if watch_id not in _watchers:
                    return f"No watcher {watch_id}"
                _watchers[watch_id]["paused"] = False
            return f"Resumed watcher {watch_id}"

        return f"Unknown action {action}. Say 'file_watcher_pro action=help'"

    except Exception as e:
        return f"File Watcher Pro failed: {e}"
