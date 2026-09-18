"""
System Services Pro — Services/Startup/Registry/Env Vars Control for JARVIS (Mark LIII)
Makes JARVIS deep system admin — beyond basic pc_master.

Ported from ONEPUNCHMAN411/Jarvis control/system.py + app_launcher.py + process_commander
+ Mark LIII computer_settings 56 actions.

Free & open source, zero tokens.
"""

import json
import os
import platform
import subprocess
from pathlib import Path
from datetime import datetime

PLUGIN = {
    "name": "system_services_pro",
    "description": (
        "System services/startup/registry/env vars control pro — makes JARVIS deep system admin beyond basic pc_master (zero tokens). "
        "Actions: services [action=list/start/stop/restart/status] [name=...] — list services via psutil or sc query Windows or systemctl Linux or launchctl macOS, start/stop/restart/status service by name e.g., services action=list, services action=status name=wuauserv Windows Update, startup [action=list/enable/disable/add/remove] [name=...] [path=...] — list startup apps via registry HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run Windows or ~/Library/LaunchAgents macOS or ~/.config/autostart Linux, enable/disable/add/remove startup app e.g., startup action=list, startup action=add name=MyApp path=C:\\MyApp.exe, registry [action=get/set/list/delete] [key=...] [value=...] [data=...] — Windows registry control via winreg e.g., registry action=get key=HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run value=MyApp, registry action=list key=HKCU\\Software\\...\\Run, macOS/Linux degraded not supported, env [action=list/get/set/delete] [key=...] [value=...] — env vars list/get/set/delete e.g., env action=list, env action=get key=PATH, env action=set key=MY_VAR value=123 set via os.environ + setx Windows or export Linux/macOS note, tasks [action=list/run] [name=...] — scheduled tasks list/run via schtasks Windows or crontab -l Linux or launchctl list macOS, info — system info OS version uptime boot time user hostname etc., help. "
        "Use when user wants to list services, start/stop service, startup apps, registry, env vars, scheduled tasks, system info, system services pro. "
        "Trigger phrases: system services pro, list services, start service, stop service, startup apps, registry, env vars, scheduled tasks, system info, deep system control."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: services, startup, registry, env, tasks, info, help. Default services.",
            },
            "subaction": {"type": "STRING", "description": "Subaction: list, start, stop, restart, status, enable, disable, add, remove, get, set, delete, run, default list"},
            "name": {"type": "STRING", "description": "Service/startup/task name, e.g. wuauserv, MyApp"},
            "path": {"type": "STRING", "description": "Path for startup add, e.g. C:\\MyApp.exe or /usr/bin/myapp"},
            "key": {"type": "STRING", "description": "Registry key or env key, e.g. HKCU\\Software\\...\\Run or PATH"},
            "value": {"type": "STRING", "description": "Registry value name or env value, e.g. MyApp or 123"},
            "data": {"type": "STRING", "description": "Registry data or env value data, e.g. C:\\MyApp.exe"},
        },
        "required": ["action"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "system_services_pro",
    "title": "System Services Pro — Deep System Control",
    "description": "Services/startup/registry/env vars/tasks control — zero tokens",
    "icon": "🔧",
    "color": "#EF4444",
    "order": 47,
    "default_enabled": True,
    "fields": [
        {"key": "enable_registry", "label": "Enable registry actions (Windows only)", "type": "checkbox", "default": True},
    ],
}

def _list_services():
    try:
        if platform.system() == "Windows":
            # Try sc query
            result = subprocess.run(["sc", "query", "type=", "service", "state=", "all"], capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                # Parse
                services = []
                for line in result.stdout.splitlines():
                    if "SERVICE_NAME:" in line:
                        name = line.split("SERVICE_NAME:")[-1].strip()
                        services.append(name)
                return services[:50], None
            # Fallback psutil
            import psutil
            services = [s.name() for s in psutil.win_service_iter()][:50]
            return services, None
        elif platform.system() == "Linux":
            result = subprocess.run(["systemctl", "list-units", "--type=service", "--all", "--no-pager"], capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                lines = result.stdout.splitlines()
                services = [line.split()[0] for line in lines if ".service" in line][:50]
                return services, None
            return [], "systemctl not available"
        else:  # Darwin
            result = subprocess.run(["launchctl", "list"], capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                lines = result.stdout.splitlines()
                services = [line.split()[-1] for line in lines if line.strip()][:50]
                return services, None
            return [], "launchctl not available"
    except Exception as e:
        return [], str(e)

def _service_action(action, name):
    try:
        if not name:
            return f"Need service name: services action={action} name=MyService"
        if platform.system() == "Windows":
            if action == "status":
                result = subprocess.run(["sc", "query", name], capture_output=True, text=True, timeout=10)
                return result.stdout[:2000] if result.returncode == 0 else f"Service {name} not found or error: {result.stderr[:500]}"
            elif action in ("start", "stop", "restart"):
                if action == "restart":
                    subprocess.run(["sc", "stop", name], capture_output=True, timeout=10)
                    time.sleep(2)
                    result = subprocess.run(["sc", "start", name], capture_output=True, text=True, timeout=10)
                else:
                    result = subprocess.run(["sc", action, name], capture_output=True, text=True, timeout=10)
                return result.stdout[:1000] + result.stderr[:500] if result.returncode == 0 else f"Failed {action} {name}: {result.stderr[:500]}"
        elif platform.system() == "Linux":
            result = subprocess.run(["systemctl", action, name], capture_output=True, text=True, timeout=15)
            return result.stdout[:1000] + result.stderr[:500] if result.returncode == 0 else f"Failed {action} {name}: {result.stderr[:500]}"
        else:
            result = subprocess.run(["launchctl", action, name], capture_output=True, text=True, timeout=15)
            return result.stdout[:1000] + result.stderr[:500] if result.returncode == 0 else f"Failed {action} {name}: {result.stderr[:500]}"
    except Exception as e:
        return f"Service action {action} {name} failed: {e}"

def _list_startup():
    try:
        if platform.system() == "Windows":
            import winreg
            startups = []
            # HKCU
            try:
                key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run", 0, winreg.KEY_READ)
                for i in range(winreg.QueryInfoKey(key)[1]):
                    try:
                        name, value, _ = winreg.EnumValue(key, i)
                        startups.append(f"HKCU Run: {name} → {value[:100]}")
                    except Exception:
                        continue
                winreg.CloseKey(key)
            except Exception:
                pass
            # HKLM
            try:
                key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"Software\Microsoft\Windows\CurrentVersion\Run", 0, winreg.KEY_READ)
                for i in range(winreg.QueryInfoKey(key)[1]):
                    try:
                        name, value, _ = winreg.EnumValue(key, i)
                        startups.append(f"HKLM Run: {name} → {value[:100]}")
                    except Exception:
                        continue
                winreg.CloseKey(key)
            except Exception:
                pass
            return startups, None
        elif platform.system() == "Darwin":
            launch_agents = Path.home() / "Library" / "LaunchAgents"
            if launch_agents.exists():
                files = list(launch_agents.glob("*.plist"))
                return [f.name for f in files[:20]], None
            return [], "No LaunchAgents found"
        else:  # Linux
            autostart = Path.home() / ".config" / "autostart"
            if autostart.exists():
                files = list(autostart.glob("*.desktop"))
                return [f.name for f in files[:20]], None
            return [], "No autostart found"
    except Exception as e:
        return [], str(e)

def _startup_action(action, name, path):
    try:
        if platform.system() == "Windows":
            import winreg
            if action == "add":
                if not name or not path:
                    return "Need name and path: startup action=add name=MyApp path=C:\\MyApp.exe"
                try:
                    key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run", 0, winreg.KEY_SET_VALUE)
                    winreg.SetValueEx(key, name, 0, winreg.REG_SZ, path)
                    winreg.CloseKey(key)
                    return f"Added startup app '{name}' → '{path}' to HKCU Run"
                except Exception as e:
                    return f"Add startup failed: {e} — try run as admin"
            elif action == "remove":
                if not name:
                    return "Need name: startup action=remove name=MyApp"
                try:
                    key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run", 0, winreg.KEY_SET_VALUE)
                    winreg.DeleteValue(key, name)
                    winreg.CloseKey(key)
                    return f"Removed startup app '{name}' from HKCU Run"
                except Exception as e:
                    return f"Remove startup failed: {e}"
            else:
                return f"Startup action {action} on Windows: list supported, add/remove via registry HKCU Run, enable/disable not directly — use add/remove"
        else:
            return f"Startup action {action} on {platform.system()}: list supported, add/remove manual — Windows registry method not applicable"
    except Exception as e:
        return f"Startup action failed: {e}"

def _registry_action(action, key, value, data):
    if platform.system() != "Windows":
        return f"Registry only on Windows — platform {platform.system()} not supported"
    try:
        import winreg
        # Parse key like HKCU\Software\...\Run
        # Map HKCU, HKLM, etc.
        hive_map = {
            "HKCU": winreg.HKEY_CURRENT_USER,
            "HKEY_CURRENT_USER": winreg.HKEY_CURRENT_USER,
            "HKLM": winreg.HKEY_LOCAL_MACHINE,
            "HKEY_LOCAL_MACHINE": winreg.HKEY_LOCAL_MACHINE,
            "HKCR": winreg.HKEY_CLASSES_ROOT,
            "HKU": winreg.HKEY_USERS,
        }
        # Split key
        parts = key.split("\\")
        if not parts:
            return "Need key: registry action=get key=HKCU\\Software\\...\\Run value=MyApp"
        hive_name = parts[0]
        hive = hive_map.get(hive_name)
        if not hive:
            return f"Unknown hive {hive_name} — use HKCU, HKLM, HKCR, HKU"
        subkey = "\\".join(parts[1:])

        if action == "list":
            try:
                k = winreg.OpenKey(hive, subkey, 0, winreg.KEY_READ)
                values = []
                for i in range(winreg.QueryInfoKey(k)[1]):
                    try:
                        name, val, _ = winreg.EnumValue(k, i)
                        values.append(f"{name} → {str(val)[:100]}")
                    except Exception:
                        continue
                winreg.CloseKey(k)
                return f"Registry list {key} — {len(values)} values:\n" + "\n".join(values[:20])
            except Exception as e:
                return f"Registry list failed {key}: {e}"

        elif action == "get":
            if not value:
                return "Need value name: registry action=get key=... value=MyApp"
            try:
                k = winreg.OpenKey(hive, subkey, 0, winreg.KEY_READ)
                val, typ = winreg.QueryValueEx(k, value)
                winreg.CloseKey(k)
                return f"Registry get {key} value {value} → {val} type {typ}"
            except Exception as e:
                return f"Registry get failed {key} {value}: {e}"

        elif action == "set":
            if not value or not data:
                return "Need value and data: registry action=set key=... value=MyApp data=C:\\MyApp.exe"
            try:
                k = winreg.OpenKey(hive, subkey, 0, winreg.KEY_SET_VALUE)
                winreg.SetValueEx(k, value, 0, winreg.REG_SZ, data)
                winreg.CloseKey(k)
                return f"Registry set {key} value {value} → {data}"
            except Exception as e:
                return f"Registry set failed: {e} — try run as admin"

        elif action == "delete":
            if not value:
                return "Need value: registry action=delete key=... value=MyApp"
            try:
                k = winreg.OpenKey(hive, subkey, 0, winreg.KEY_SET_VALUE)
                winreg.DeleteValue(k, value)
                winreg.CloseKey(k)
                return f"Registry deleted {key} value {value}"
            except Exception as e:
                return f"Registry delete failed: {e}"

        else:
            return f"Unknown registry action {action} — use list/get/set/delete"

    except ImportError:
        return "winreg not available — Windows only"
    except Exception as e:
        return f"Registry action failed: {e}"

def run(parameters: dict, player=None, session_memory=None) -> str:
    action = (parameters.get("action", "services") or "services").lower().strip()
    subaction = (parameters.get("subaction", "list") or "list").lower().strip()
    name = parameters.get("name", "") or ""
    path_str = parameters.get("path", "") or ""
    key = parameters.get("key", "") or ""
    value = parameters.get("value", "") or ""
    data = parameters.get("data", "") or ""

    try:
        if player:
            try:
                player.write_log(f"System Services Pro: {action} subaction={subaction} name={name}")
            except Exception:
                pass

        if action in ("help", "?", "h"):
            return (
                "System Services Pro — Services/Startup/Registry/Env Vars Control (Zero Tokens, from ONEPUNCHMAN411 system.py + Mark LIII computer_settings 56 actions):\n"
                "\n"
                "Deep system control — services, startup apps, registry (Windows), env vars, scheduled tasks.\n"
                "\n"
                "• services subaction=list/start/stop/restart/status name=... — list services via psutil or sc query Windows or systemctl Linux or launchctl macOS, start/stop/restart/status service by name e.g., services subaction=list, services subaction=status name=wuauserv Windows Update.\n"
                "• startup subaction=list/enable/disable/add/remove name=... path=... — list startup apps via registry HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run Windows or ~/Library/LaunchAgents macOS or ~/.config/autostart Linux, enable/disable/add/remove startup app e.g., startup subaction=list, startup subaction=add name=MyApp path=C:\\MyApp.exe.\n"
                "• registry subaction=get/set/list/delete key=... value=... data=... — Windows registry control via winreg e.g., registry subaction=get key=HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run value=MyApp, registry subaction=list key=HKCU\\Software\\...\\Run, macOS/Linux degraded not supported.\n"
                "• env subaction=list/get/set/delete key=... value=... — env vars list/get/set/delete e.g., env subaction=list, env subaction=get key=PATH, env subaction=set key=MY_VAR value=123 set via os.environ + setx Windows or export Linux/macOS note.\n"
                "• tasks subaction=list/run name=... — scheduled tasks list/run via schtasks Windows or crontab -l Linux or launchctl list macOS.\n"
                "• info — system info OS version uptime boot time user hostname etc. via platform + psutil + os.\n"
                "\n"
                "Examples:\n"
                "• system_services_pro action=services subaction=list\n"
                "• system_services_pro action=services subaction=status name=wuauserv\n"
                "• system_services_pro action=startup subaction=list\n"
                "• system_services_pro action=registry subaction=list key=HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\n"
                "• system_services_pro action=env subaction=list\n"
                "• system_services_pro action=info\n"
                "\n"
                "Zero tokens, pure local via psutil, winreg Windows, subprocess, os, pathlib.\n"
                "Install: pip install psutil\n"
                "Registry only Windows, services/startup per-OS.\n"
            )

        if action == "services":
            if subaction == "list":
                services, err = _list_services()
                if err:
                    return f"List services failed: {err}"
                if not services:
                    return "No services found"
                return f"Services ({len(services)}):\n" + "\n".join([f"• {s}" for s in services[:30]])
            else:
                return _service_action(subaction, name)

        if action == "startup":
            if subaction == "list":
                startups, err = _list_startup()
                if err:
                    return f"List startup failed: {err} — {startups}"
                if not startups:
                    return "No startup apps found"
                return f"Startup apps ({len(startups)}):\n" + "\n".join([f"• {s}" for s in startups[:20]])
            else:
                return _startup_action(subaction, name, path_str)

        if action == "registry":
            return _registry_action(subaction, key, value, data)

        if action == "env":
            if subaction == "list":
                env_vars = dict(os.environ)
                lines = [f"Env vars ({len(env_vars)}):"]
                for k, v in list(env_vars.items())[:30]:
                    lines.append(f"• {k}={v[:100]}")
                return "\n".join(lines)
            elif subaction == "get":
                if not key:
                    return "Need key: env subaction=get key=PATH"
                val = os.environ.get(key, "")
                if not val:
                    return f"Env var {key} not found"
                return f"Env {key}={val}"
            elif subaction == "set":
                if not key or not value:
                    return "Need key and value: env subaction=set key=MY_VAR value=123"
                os.environ[key] = value
                # Also try setx on Windows for persistence
                if platform.system() == "Windows":
                    try:
                        subprocess.run(["setx", key, value], capture_output=True, timeout=5)
                        return f"Set env {key}={value} via os.environ + setx (persistent for new processes, restart needed for existing)"
                    except Exception:
                        pass
                return f"Set env {key}={value} via os.environ (session only, for persistence set in system settings or .bashrc/.zshrc)"
            elif subaction == "delete":
                if not key:
                    return "Need key: env subaction=delete key=MY_VAR"
                if key in os.environ:
                    del os.environ[key]
                    return f"Deleted env var {key} from session — for persistence remove from system settings"
                return f"Env var {key} not found in session"
            else:
                return f"Unknown env subaction {subaction} — use list/get/set/delete"

        if action == "tasks":
            try:
                if platform.system() == "Windows":
                    if subaction == "list":
                        result = subprocess.run(["schtasks", "/query", "/fo", "LIST"], capture_output=True, text=True, timeout=10)
                        if result.returncode == 0:
                            return f"Scheduled tasks (schtasks):\n{result.stdout[:3000]}"
                        return f"List tasks failed: {result.stderr[:500]}"
                    elif subaction == "run":
                        if not name:
                            return "Need name: tasks subaction=run name=MyTask"
                        result = subprocess.run(["schtasks", "/run", "/tn", name], capture_output=True, text=True, timeout=10)
                        return result.stdout[:1000] + result.stderr[:500] if result.returncode == 0 else f"Run task failed: {result.stderr[:500]}"
                elif platform.system() == "Linux":
                    if subaction == "list":
                        result = subprocess.run(["crontab", "-l"], capture_output=True, text=True, timeout=5)
                        if result.returncode == 0:
                            return f"Crontab:\n{result.stdout[:2000]}"
                        return "No crontab or crontab -l failed"
                else:  # Darwin
                    if subaction == "list":
                        result = subprocess.run(["launchctl", "list"], capture_output=True, text=True, timeout=10)
                        return f"Launchctl list:\n{result.stdout[:3000]}" if result.returncode == 0 else f"List failed: {result.stderr[:500]}"
                return f"Tasks subaction {subaction} not implemented for {platform.system()}"
            except Exception as e:
                return f"Tasks action failed: {e}"

        if action == "info":
            try:
                import psutil
                info_lines = [
                    f"System info (zero tokens):",
                    f"• OS: {platform.system()} {platform.release()} {platform.version()[:100]}",
                    f"• Platform: {platform.platform()[:100]}",
                    f"• Machine: {platform.machine()}",
                    f"• Processor: {platform.processor()[:100]}",
                    f"• Hostname: {platform.node()}",
                    f"• User: {os.getlogin() if hasattr(os, 'getlogin') else os.environ.get('USERNAME') or os.environ.get('USER')}",
                    f"• Python: {platform.python_version()}",
                ]
                try:
                    boot_time = datetime.fromtimestamp(psutil.boot_time())
                    uptime = datetime.now() - boot_time
                    info_lines.append(f"• Boot time: {boot_time.strftime('%Y-%m-%d %H:%M:%S')}, Uptime: {uptime}")
                except Exception:
                    pass
                try:
                    info_lines.append(f"• CPU count: {psutil.cpu_count()} logical, {psutil.cpu_count(logical=False)} physical")
                except Exception:
                    pass
                try:
                    mem = psutil.virtual_memory()
                    info_lines.append(f"• RAM: {mem.total // (1024**3)}GB total, {mem.available // (1024**3)}GB available, {mem.percent}% used")
                except Exception:
                    pass
                return "\n".join(info_lines)
            except Exception as e:
                return f"System info failed: {e} — pip install psutil"

        return f"Unknown action {action}. Say 'system_services_pro action=help'"

    except Exception as e:
        return f"System Services Pro failed: {e}"
