"""
Power Manager Pro — Battery Deep & Power Plans & Sleep/Wake for JARVIS (Mark LIII)
Makes JARVIS impeccable at power management — beyond basic lock/shutdown.

Ported from pc_master power + system_monitor_pro battery + power + display.

Free & open source, zero tokens.
"""

import platform
import subprocess
from pathlib import Path
from datetime import datetime

PLUGIN = {
    "name": "power_manager_pro",
    "description": (
        "Battery deep & power plans & sleep/wake pro — makes JARVIS impeccable at power management beyond basic lock/shutdown (zero tokens). "
        "Actions: battery [action=status/health/cycles] — battery status via psutil.sensors_battery() + WMI Win32_Battery Windows for health cycles design capacity full capacity wear level e.g., battery action=status, battery action=health, returns percent plugged time left health cycles design/full capacity, power_plans [action=list/get/set] [name=...] — power plans list/get/set via powercfg /list Windows or system_profiler SPPowerDataType macOS or upower Linux e.g., power_plans action=list, power_plans action=set name=High performance, sleep [action=sleep/hibernate] [delay=...] — sleep/hibernate now or after delay seconds e.g., sleep action=sleep delay=60, wake [action=list/set/delete] [time=...] — wake timers list/set/delete via powercfg /waketimers Windows or pmset macOS or rtcwake Linux e.g., wake action=set time=2026-09-17T08:00:00, performance [action=get/set] [mode=balanced/performance/power_saver] — performance mode get/set via powercfg or Windows 11 power mode API or cpufreq Linux, brightness [action=get/set] [value=0-100] — brightness get/set via screen-brightness-control or WMI, uptime — uptime and boot time via psutil.boot_time(), help. "
        "Use when user wants battery status, battery health, power plans, sleep, wake timer, performance mode, brightness, uptime, power manager pro. "
        "Trigger phrases: power manager pro, battery status, battery health, power plans, sleep, wake timer, performance mode, brightness, uptime, power management."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: battery, power_plans, sleep, wake, performance, brightness, uptime, help. Default battery.",
            },
            "subaction": {"type": "STRING", "description": "Subaction: status, health, cycles, list, get, set, sleep, hibernate, enable, disable, default status/list"},
            "name": {"type": "STRING", "description": "Power plan name for power_plans set, e.g. High performance, Balanced, Power saver"},
            "value": {"type": "NUMBER", "description": "Value for brightness 0-100 or performance mode"},
            "mode": {"type": "STRING", "description": "Mode for performance: balanced, performance, power_saver, default balanced"},
            "delay": {"type": "NUMBER", "description": "Delay seconds for sleep action, default 0 now"},
            "time": {"type": "STRING", "description": "Time for wake set, e.g. 2026-09-17T08:00:00 or 08:00"},
        },
        "required": ["action"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "power_manager_pro",
    "title": "Power Manager Pro — Battery Deep & Power Plans",
    "description": "Battery health/cycles, power plans, sleep/wake timers, performance modes — zero tokens",
    "icon": "🔋",
    "color": "#F59E0B",
    "order": 49,
    "default_enabled": True,
    "fields": [
        {"key": "enable_wmi", "label": "Enable WMI for battery health (Windows)", "type": "checkbox", "default": True},
    ],
}

def _get_battery_status():
    try:
        import psutil
        battery = psutil.sensors_battery()
        if not battery:
            return "No battery found — desktop or battery not detected via psutil.sensors_battery()", None
        percent = battery.percent
        plugged = battery.power_plugged
        secsleft = battery.secsleft
        if secsleft == -1:
            time_left = "Unknown"
        elif secsleft == -2:
            time_left = "Unlimited (plugged)"
        else:
            hours = secsleft // 3600
            mins = (secsleft % 3600) // 60
            time_left = f"{hours}h {mins}m"

        return {
            "percent": percent,
            "plugged": plugged,
            "time_left": time_left,
            "secsleft": secsleft,
        }, None
    except ImportError:
        return None, "psutil not installed — pip install psutil for battery status"
    except Exception as e:
        return None, f"Battery status failed: {e}"

def _get_battery_health_windows():
    try:
        import subprocess
        # Try WMI Win32_Battery
        result = subprocess.run(["wmic", "path", "Win32_Battery", "get", "EstimatedChargeRemaining,DesignCapacity,FullChargeCapacity,BatteryStatus /format:list"], capture_output=True, text=True, timeout=10)
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout[:1000], None

        # Try powercfg /batteryreport
        result = subprocess.run(["powercfg", "/batteryreport", "/output", f"{Path.home() / 'battery-report.html'}", "/duration", "7"], capture_output=True, text=True, timeout=15)
        if result.returncode == 0:
            return f"Battery report generated at {Path.home() / 'battery-report.html'} via powercfg /batteryreport — open file for health, cycles, design/full capacity", None

        return "Battery health via WMI failed — try powercfg /batteryreport for detailed report", None
    except Exception as e:
        return None, f"Battery health Windows failed: {e}"

def _get_battery_health_generic():
    try:
        if platform.system() == "Linux":
            result = subprocess.run(["upower", "-i", "/org/freedesktop/UPower/devices/battery_BAT0"], capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                return result.stdout[:2000], None
            return "upower not available or battery_BAT0 not found", None
        elif platform.system() == "Darwin":
            result = subprocess.run(["system_profiler", "SPPowerDataType"], capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                # Extract battery info
                lines = [line for line in result.stdout.splitlines() if "Capacity" in line or "Cycle" in line or "Health" in line or "Battery" in line][:20]
                return "\n".join(lines), None
            return "system_profiler SPPowerDataType failed", None
        else:
            return "Battery health generic only Linux upower and macOS system_profiler", None
    except Exception as e:
        return None, str(e)

def _list_power_plans_windows():
    try:
        result = subprocess.run(["powercfg", "/list"], capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            return result.stdout[:3000], None
        return None, f"powercfg /list failed: {result.stderr[:500]}"
    except Exception as e:
        return None, str(e)

def _get_power_plan_windows():
    try:
        result = subprocess.run(["powercfg", "/getactivescheme"], capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            return result.stdout[:1000], None
        return None, f"powercfg /getactivescheme failed: {result.stderr[:500]}"
    except Exception as e:
        return None, str(e)

def _set_power_plan_windows(name):
    try:
        # List plans to find GUID matching name
        result = subprocess.run(["powercfg", "/list"], capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            return None, f"powercfg /list failed: {result.stderr[:500]}"

        # Parse GUIDs
        import re
        # Example: Power Scheme GUID: 381b4222-f694-41f0-9685-ff5bb260df2e  (Balanced)
        guid = None
        for line in result.stdout.splitlines():
            if name.lower() in line.lower():
                m = re.search(r"([a-f0-9\-]{36})", line, re.I)
                if m:
                    guid = m.group(1)
                    break

        if not guid:
            return None, f"Power plan '{name}' not found in list — list via power_plans action=list, names like Balanced, High performance, Power saver"

        result = subprocess.run(["powercfg", "/setactive", guid], capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            return f"Set power plan to '{name}' GUID {guid} via powercfg /setactive", None
        return None, f"Set power plan failed: {result.stderr[:500]} — try run as admin"
    except Exception as e:
        return None, str(e)

def run(parameters: dict, player=None, session_memory=None) -> str:
    action = (parameters.get("action", "battery") or "battery").lower().strip()
    subaction = (parameters.get("subaction", "status") or "status").lower().strip()
    name = parameters.get("name", "") or ""
    value = parameters.get("value", None)
    try:
        value = int(value) if value is not None else None
    except Exception:
        value = None
    mode = (parameters.get("mode", "balanced") or "balanced").lower().strip()
    delay = parameters.get("delay", 0)
    try:
        delay = int(delay)
    except Exception:
        delay = 0
    time_str = parameters.get("time", "") or ""

    try:
        if player:
            try:
                player.write_log(f"Power Manager Pro: {action} subaction={subaction} name={name} value={value}")
            except Exception:
                pass

        if action in ("help", "?", "h"):
            return (
                "Power Manager Pro — Battery Deep & Power Plans & Sleep/Wake (Zero Tokens, from pc_master power + system_monitor_pro battery):\n"
                "\n"
                "Deep power management — battery health, power plans, sleep/wake timers, performance modes.\n"
                "\n"
                "• battery subaction=status/health/cycles — battery status via psutil.sensors_battery() + WMI Win32_Battery Windows for health cycles design capacity full capacity wear level e.g., battery subaction=status, battery subaction=health, returns percent plugged time left health cycles design/full capacity.\n"
                "• power_plans subaction=list/get/set name=... — power plans list/get/set via powercfg /list Windows or system_profiler SPPowerDataType macOS or upower Linux e.g., power_plans subaction=list, power_plans subaction=set name=High performance.\n"
                "• sleep subaction=sleep/hibernate delay=... — sleep/hibernate now or after delay seconds e.g., sleep subaction=sleep delay=60.\n"
                "• wake subaction=list/set/delete time=... — wake timers list/set/delete via powercfg /waketimers Windows or pmset macOS or rtcwake Linux e.g., wake subaction=set time=2026-09-17T08:00:00.\n"
                "• performance subaction=get/set mode=balanced/performance/power_saver — performance mode get/set via powercfg or Windows 11 power mode API or cpufreq Linux.\n"
                "• brightness subaction=get/set value=0-100 — brightness get/set via screen-brightness-control or WMI.\n"
                "• uptime — uptime and boot time via psutil.boot_time().\n"
                "\n"
                "Examples:\n"
                "• power_manager_pro action=battery subaction=status\n"
                "• power_manager_pro action=battery subaction=health\n"
                "• power_manager_pro action=power_plans subaction=list\n"
                "• power_manager_pro action=power_plans subaction=set name=High performance\n"
                "• power_manager_pro action=sleep subaction=sleep delay=60\n"
                "• power_manager_pro action=uptime\n"
                "• power_manager_pro action=brightness subaction=get\n"
                "\n"
                "Zero tokens, pure local via psutil, WMI, powercfg, screen-brightness-control.\n"
                "Install: pip install psutil screen-brightness-control wmi (Windows optional)\n"
                "Battery health deep only Windows via WMI + powercfg /batteryreport, Linux upower, macOS system_profiler.\n"
            )

        if action == "battery":
            status, err = _get_battery_status()
            if err and not status:
                return err

            if subaction == "status":
                if isinstance(status, dict):
                    return (
                        f"Battery status (zero tokens, psutil):\n"
                        f"• Percent: {status['percent']}%\n"
                        f"• Plugged: {status['plugged']}\n"
                        f"• Time left: {status['time_left']} ({status['secsleft']}s)\n"
                        f"• Health: try battery subaction=health for design/full capacity wear level"
                    )
                return str(status)

            elif subaction in ("health", "cycles"):
                # Status + health
                lines = []
                if isinstance(status, dict):
                    lines.append(f"Battery status: {status['percent']}% plugged {status['plugged']} time left {status['time_left']}")

                if platform.system() == "Windows":
                    health, err = _get_battery_health_windows()
                    if err:
                        lines.append(f"Health Windows error: {err}")
                    if health:
                        lines.append(f"Battery health Windows (WMI + powercfg):\n{health}")
                else:
                    health, err = _get_battery_health_generic()
                    if err:
                        lines.append(f"Health generic error: {err}")
                    if health:
                        lines.append(f"Battery health {platform.system()}:\n{health}")

                return "\n".join(lines) if lines else "Battery health not available"

            else:
                return f"Unknown battery subaction {subaction} — use status/health/cycles"

        if action == "power_plans":
            if platform.system() != "Windows":
                if subaction == "list":
                    if platform.system() == "Linux":
                        result = subprocess.run(["upower", "-d"], capture_output=True, text=True, timeout=10)
                        if result.returncode == 0:
                            return f"Power info Linux via upower:\n{result.stdout[:2000]}"
                        return "Power plans list on Linux via upower -d or check power settings"
                    else:  # Darwin
                        result = subprocess.run(["system_profiler", "SPPowerDataType"], capture_output=True, text=True, timeout=10)
                        if result.returncode == 0:
                            return f"Power info macOS via system_profiler SPPowerDataType:\n{result.stdout[:3000]}"
                        return "Power plans list on macOS via system_profiler SPPowerDataType"
                return f"Power plans {subaction} only Windows via powercfg — platform {platform.system()} use system settings"

            if subaction == "list":
                result, err = _list_power_plans_windows()
                if err:
                    return err
                return f"Power plans Windows via powercfg /list:\n{result}"

            elif subaction == "get":
                result, err = _get_power_plan_windows()
                if err:
                    return err
                return f"Active power plan Windows via powercfg /getactivescheme:\n{result}"

            elif subaction == "set":
                if not name:
                    return "Need name: power_plans subaction=set name=High performance — list via power_plans subaction=list"
                result, err = _set_power_plan_windows(name)
                if err:
                    return err
                return result

            else:
                return f"Unknown power_plans subaction {subaction} — use list/get/set"

        if action == "sleep":
            if delay > 0:
                import threading
                def delayed_sleep():
                    time.sleep(delay)
                    try:
                        if subaction == "hibernate":
                            if platform.system() == "Windows":
                                subprocess.run(["shutdown", "/h"], timeout=10)
                            else:
                                subprocess.run(["systemctl", "hibernate"], timeout=10)
                        else:
                            if platform.system() == "Windows":
                                subprocess.run(["rundll32.exe", "powrprof.dll,SetSuspendState", "0,1,0"], timeout=10)
                            elif platform.system() == "Linux":
                                subprocess.run(["systemctl", "suspend"], timeout=10)
                            else:
                                subprocess.run(["pmset", "sleepnow"], timeout=10)
                    except Exception:
                        pass

                threading.Thread(target=delayed_sleep, daemon=True).start()
                return f"Sleep {subaction} scheduled in {delay} seconds via background thread — zero tokens"

            try:
                if subaction == "hibernate":
                    if platform.system() == "Windows":
                        subprocess.run(["shutdown", "/h"], timeout=10)
                        return "Hibernating now via shutdown /h — zero tokens"
                    elif platform.system() == "Linux":
                        subprocess.run(["systemctl", "hibernate"], timeout=10)
                        return "Hibernating now via systemctl hibernate"
                    else:
                        return "Hibernate on macOS: pmset hibernatemode? Or Apple menu → Sleep with safe sleep"
                else:
                    if platform.system() == "Windows":
                        subprocess.run(["rundll32.exe", "powrprof.dll,SetSuspendState", "0,1,0"], timeout=10)
                        return "Sleeping now via rundll32 powrprof.dll,SetSuspendState — zero tokens"
                    elif platform.system() == "Linux":
                        subprocess.run(["systemctl", "suspend"], timeout=10)
                        return "Sleeping now via systemctl suspend"
                    else:
                        subprocess.run(["pmset", "sleepnow"], timeout=10)
                        return "Sleeping now via pmset sleepnow"
            except Exception as e:
                return f"Sleep {subaction} failed: {e}"

        if action == "wake":
            if platform.system() == "Windows":
                if subaction == "list":
                    result = subprocess.run(["powercfg", "/waketimers"], capture_output=True, text=True, timeout=10)
                    if result.returncode == 0:
                        return f"Wake timers Windows via powercfg /waketimers:\n{result.stdout[:2000] if result.stdout.strip() else 'No wake timers'}"
                    return f"List wake timers failed: {result.stderr[:500]}"
                elif subaction == "set":
                    if not time_str:
                        return "Need time: wake subaction=set time=2026-09-17T08:00:00 or time=08:00"
                    return f"Set wake timer on Windows via Task Scheduler: schtasks /create /tn MyWake /tr \"cmd /c exit\" /sc once /st {time_str} /f — then powercfg /waketimers to list — manual for Phase 4, auto via schtasks in future"
                else:
                    return f"Wake {subaction} on Windows via powercfg /waketimers list, schtasks for set"
            elif platform.system() == "Darwin":
                if subaction == "list":
                    result = subprocess.run(["pmset", "-g", "sched"], capture_output=True, text=True, timeout=10)
                    return f"Wake sched macOS via pmset -g sched:\n{result.stdout[:2000]}" if result.returncode == 0 else f"Failed: {result.stderr[:500]}"
                else:
                    return f"Wake {subaction} macOS via pmset schedule/wakeorpoweron"
            else:  # Linux
                if subaction == "list":
                    return "Wake timers Linux via rtcwake? Or check /sys/class/rtc/rtc0/wakealarm — cat /sys/class/rtc/rtc0/wakealarm"
                else:
                    return f"Wake {subaction} Linux via rtcwake -m no -t $(date -d '{time_str}' +%s) — set wakealarm"

        if action == "performance":
            if subaction == "get":
                if platform.system() == "Windows":
                    result, err = _get_power_plan_windows()
                    if err:
                        return err
                    return f"Performance mode (active power plan) Windows:\n{result}\nFor Windows 11 power mode: Settings → System → Power → Power mode Balanced/Best performance/Best power efficiency"
                elif platform.system() == "Linux":
                    try:
                        result = subprocess.run(["cpufreq-info", "-p"], capture_output=True, text=True, timeout=5)
                        if result.returncode == 0:
                            return f"CPU freq governor Linux:\n{result.stdout[:1000]}"
                        result = subprocess.run(["cat", "/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor"], capture_output=True, text=True, timeout=5)
                        if result.returncode == 0:
                            return f"Scaling governor: {result.stdout.strip()} — via cpufreq"
                    except Exception:
                        pass
                    return "Performance mode Linux via cpufreq — cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor"
                else:
                    return "Performance mode macOS via pmset -g thermlog? Or System Settings → Battery → Low power mode"

            elif subaction == "set":
                if platform.system() == "Windows":
                    # Map mode to power plan name
                    mode_to_plan = {
                        "balanced": "Balanced",
                        "performance": "High performance",
                        "power_saver": "Power saver",
                        "power_saver": "Power saver",
                    }
                    plan_name = mode_to_plan.get(mode, "Balanced")
                    result, err = _set_power_plan_windows(plan_name)
                    if err:
                        return err
                    return f"Set performance mode to {mode} via power plan '{plan_name}' — {result}"
                else:
                    return f"Set performance mode {mode} on {platform.system()}: use system settings or cpufreq-set -g {mode} (Linux)"

        if action == "brightness":
            try:
                import screen_brightness_control as sbc
                if subaction == "get":
                    try:
                        brightness = sbc.get_brightness()
                        return f"Brightness: {brightness}% via screen-brightness-control — zero tokens"
                    except Exception as e:
                        return f"Get brightness failed: {e} — pip install screen-brightness-control"
                elif subaction == "set":
                    if value is None:
                        return "Need value: brightness subaction=set value=0-100"
                    try:
                        sbc.set_brightness(value)
                        return f"Set brightness to {value}% via screen-brightness-control"
                    except Exception as e:
                        return f"Set brightness failed: {e}"
            except ImportError:
                return "screen-brightness-control not installed — pip install screen-brightness-control for brightness get/set"
            except Exception as e:
                return f"Brightness {subaction} failed: {e}"

        if action == "uptime":
            try:
                import psutil
                boot_time = datetime.fromtimestamp(psutil.boot_time())
                uptime = datetime.now() - boot_time
                days = uptime.days
                hours = uptime.seconds // 3600
                mins = (uptime.seconds % 3600) // 60
                return f"Uptime: {days} days {hours}h {mins}m — Boot time: {boot_time.strftime('%Y-%m-%d %H:%M:%S')} — via psutil.boot_time() — zero tokens"
            except ImportError:
                return "psutil not installed — pip install psutil for uptime"
            except Exception as e:
                return f"Uptime failed: {e}"

        return f"Unknown action {action}. Say 'power_manager_pro action=help'"

    except Exception as e:
        return f"Power Manager Pro failed: {e}"
