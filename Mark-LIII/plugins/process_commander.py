"""
Process Commander — Advanced Process & Task Management for JARVIS (Mark LIII)
Makes JARVIS impeccable at process management — list, kill, start, monitor, priority, affinity.

Inspired by ONEPUNCHMAN411/Jarvis process_watcher, and FatihMakes system_monitor.

Free & open source.
"""

import platform
import subprocess
import time
from pathlib import Path

PLUGIN = {
    "name": "process_commander",
    "description": (
        "Advanced process and task management — makes JARVIS impeccable at managing processes. Actions: list, top, search, kill, kill_all, start, restart, priority, affinity, monitor, tree, stats, help. "
        "Use when user wants to manage processes, task manager, kill app, start app, check CPU usage, process tree. "
        "Trigger phrases: process manager, task manager, list processes, kill process, start process, process list, top processes, process tree, process stats, kill app, process monitor, cpu usage."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: list, top, search, kill, kill_all, start, restart, priority, affinity, monitor, tree, stats, help. Default help.",
            },
            "query": {
                "type": "STRING",
                "description": "Process name, pid, or search query, e.g. chrome, 1234, python",
            },
            "value": {
                "type": "STRING",
                "description": "Value: for priority high/normal/low, affinity 0,1, etc.",
            },
        },
        "required": ["action"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "process_commander",
    "title": "Process Commander",
    "description": "Advanced process & task management",
    "icon": "⚙️",
    "color": "#10B981",
    "order": 4,
    "default_enabled": True,
}

def run(parameters: dict, player=None, session_memory=None) -> str:
    action = (parameters.get("action", "help") or "help").lower().strip()
    query = parameters.get("query", "") or ""
    value = parameters.get("value", "") or ""

    try:
        if player:
            try:
                player.write_log(f"Process Commander: {action} {query} {value}")
            except Exception:
                pass

        if action in ("help", "?", "h"):
            return (
                "Process Commander — Advanced Process Management:\n"
                "\n"
                "• list [query] — list processes, filter by name e.g. list chrome\n"
                "• top [n] — top CPU processes\n"
                "• search query — search processes\n"
                "• kill name/pid — kill process e.g. kill chrome or kill 1234\n"
                "• kill_all name — kill all matching processes\n"
                "• start app — start app/process e.g. start notepad\n"
                "• restart name — restart process\n"
                "• priority pid high/normal/low — set priority\n"
                "• affinity pid 0,1 — set CPU affinity\n"
                "• monitor pid — monitor process CPU/MEM\n"
                "• tree — process tree\n"
                "• stats — system stats\n"
                "\n"
                "Examples:\n"
                "• process_commander action=list query=chrome\n"
                "• process_commander action=top\n"
                "• process_commander action=kill query=notepad\n"
                "• process_commander action=start query=code\n"
                "\n"
                "Install: pip install psutil"
            )

        # Import psutil
        try:
            import psutil
        except ImportError:
            return "psutil not installed — pip install psutil for process management"

        if action in ("list", "top", "search"):
            q = query or value
            procs = []
            for p in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent', 'status']):
                try:
                    name = p.info['name'] or ""
                    if not q or q.lower() in name.lower() or q == str(p.info['pid']):
                        procs.append(p.info)
                except Exception:
                    continue
            if action == "top":
                procs = sorted(procs, key=lambda x: x['cpu_percent'] or 0, reverse=True)[:15]
            else:
                procs = sorted(procs, key=lambda x: x['cpu_percent'] or 0, reverse=True)[:20]
            if not procs:
                return f"No processes found for '{q}'"
            lines = [f"{p['pid']:6} {p['name'][:25]:25} CPU {p['cpu_percent'] or 0:5.1f}% MEM {p['memory_percent'] or 0:5.1f}% {p['status']}" for p in procs]
            return f"Processes (filter: '{q}') — {len(procs)} found:\n" + "\n".join(lines)

        if action == "kill":
            if not query:
                return "Need process name or pid: kill chrome or kill 1234"
            killed = 0
            if query.isdigit():
                try:
                    p = psutil.Process(int(query))
                    p.terminate()
                    killed = 1
                    return f"Killed PID {query} ({p.name()})"
                except Exception as e:
                    return f"Kill PID {query} failed: {e}"
            else:
                for p in psutil.process_iter(['name']):
                    try:
                        if query.lower() in (p.info['name'] or "").lower():
                            p.terminate()
                            killed += 1
                    except Exception:
                        continue
                return f"Killed {killed} processes matching '{query}'"

        if action == "kill_all":
            if not query:
                return "Need process name: kill_all chrome"
            killed = 0
            for p in psutil.process_iter(['name']):
                try:
                    if query.lower() == (p.info['name'] or "").lower():
                        p.kill()
                        killed += 1
                except Exception:
                    continue
            return f"Force killed {killed} processes named '{query}'"

        if action == "start":
            app = query or value
            if not app:
                return "Need app name: start notepad"
            try:
                import os
                if platform.system() == "Windows":
                    if Path(app).exists():
                        os.startfile(app)
                    else:
                        subprocess.Popen(app, shell=True)
                else:
                    subprocess.Popen([app], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                return f"Started {app}"
            except Exception as e:
                return f"Start {app} failed: {e}"

        if action == "restart":
            if not query:
                return "Need process name: restart chrome"
            # Kill then start
            killed = 0
            exe = ""
            for p in psutil.process_iter(['name', 'exe']):
                try:
                    if query.lower() in (p.info['name'] or "").lower():
                        exe = p.info['exe'] or p.info['name']
                        p.terminate()
                        killed += 1
                        break
                except Exception:
                    continue
            time.sleep(1)
            if exe:
                try:
                    subprocess.Popen([exe], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    return f"Restarted {query} ({killed} killed, started {exe})"
                except Exception as e:
                    return f"Killed {killed} but restart failed: {e}"
            return f"Killed {killed} processes matching {query}, but exe not found to restart"

        if action == "priority":
            if not query or not value:
                return "Need pid and priority: priority 1234 high — high/normal/low/idle"
            try:
                pid = int(query)
                p = psutil.Process(pid)
                prio_map = {
                    "high": psutil.HIGH_PRIORITY_CLASS if platform.system() == "Windows" else -10,
                    "normal": psutil.NORMAL_PRIORITY_CLASS if platform.system() == "Windows" else 0,
                    "low": psutil.IDLE_PRIORITY_CLASS if platform.system() == "Windows" else 10,
                    "idle": psutil.IDLE_PRIORITY_CLASS if platform.system() == "Windows" else 19,
                }
                prio = prio_map.get(value.lower(), 0)
                if platform.system() == "Windows":
                    p.nice(prio)
                else:
                    p.nice(prio)
                return f"Set priority {value} for PID {pid}"
            except Exception as e:
                return f"Priority failed: {e}"

        if action == "monitor":
            if not query:
                return "Need pid or name: monitor 1234 or monitor chrome"
            try:
                if query.isdigit():
                    p = psutil.Process(int(query))
                else:
                    # Find first matching
                    p = None
                    for proc in psutil.process_iter(['name', 'pid']):
                        if query.lower() in (proc.info['name'] or "").lower():
                            p = psutil.Process(proc.info['pid'])
                            break
                    if not p:
                        return f"Process '{query}' not found"
                # Monitor for 3 seconds
                cpu = p.cpu_percent(interval=1)
                mem = p.memory_info()
                return (
                    f"Monitor {p.name()} PID {p.pid}:\n"
                    f"• CPU: {cpu}%\n"
                    f"• Memory: {mem.rss // (1024*1024)}MB RSS, {mem.vms // (1024*1024)}MB VMS\n"
                    f"• Status: {p.status()}\n"
                    f"• Created: {time.ctime(p.create_time())}\n"
                    f"• Threads: {p.num_threads()}\n"
                )
            except Exception as e:
                return f"Monitor failed: {e}"

        if action == "tree":
            try:
                # Build tree
                procs = {p.pid: p for p in psutil.process_iter(['pid', 'ppid', 'name'])}
                # Find roots
                roots = [p for p in procs.values() if p.info['ppid'] == 0 or p.info['ppid'] not in procs]
                lines = []
                def add_tree(pid, indent=0):
                    if pid not in procs:
                        return
                    p = procs[pid]
                    lines.append(f"{'  '*indent}{p.info['pid']} {p.info['name']}")
                    # Children
                    for child in [c for c in procs.values() if c.info['ppid'] == pid][:5]:
                        if len(lines) > 50:
                            return
                        add_tree(child.info['pid'], indent+1)
                for r in roots[:5]:
                    add_tree(r.info['pid'])
                    if len(lines) > 50:
                        break
                return "Process tree (first 50):\n" + "\n".join(lines[:50])
            except Exception as e:
                return f"Tree failed: {e}"

        if action == "stats":
            try:
                cpu = psutil.cpu_percent(interval=1)
                mem = psutil.virtual_memory()
                disk = psutil.disk_usage('/')
                return (
                    f"System stats:\n"
                    f"• CPU: {cpu}% ({psutil.cpu_count()} cores, {psutil.cpu_count(logical=False)} physical)\n"
                    f"• RAM: {mem.percent}% — {mem.used // (1024**2)}MB / {mem.total // (1024**2)}MB\n"
                    f"• Disk: {disk.percent}% — {disk.free // (1024**3)}GB free / {disk.total // (1024**3)}GB total\n"
                    f"• Processes: {len(psutil.pids())}\n"
                )
            except Exception as e:
                return f"Stats failed: {e}"

        return f"Unknown action {action}. Say 'process_commander action=help'"

    except Exception as e:
        return f"Process Commander failed: {e}"
