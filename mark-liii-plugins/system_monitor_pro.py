"""
System Monitor Pro — Enhanced System Monitoring for JARVIS (Mark LIII)
Makes JARVIS impeccable at system monitoring — CPU, RAM, GPU, disk, network, battery, temperature, processes.

Inspired by ONEPUNCHMAN411/Jarvis system_monitor_plugin, process_watcher, and FatihMakes system_monitor.py

Free & open source.
"""

import platform
import time
from pathlib import Path

PLUGIN = {
    "name": "system_monitor_pro",
    "description": (
        "Enhanced system monitoring pro — makes JARVIS impeccable at monitoring PC. Actions: status, cpu, ram, disk, gpu, network, battery, temperature, processes, top, sensors, uptime, help. "
        "Shows CPU/RAM/disk/GPU/network/battery/temperature with psutil, GPUtil, etc. Proactive alerts for high CPU, low disk, low battery. "
        "Use when user wants system info, CPU usage, RAM usage, disk space, GPU, network, battery, temperature, system monitoring. "
        "Trigger phrases: system monitor, system info, cpu usage, ram usage, disk space, gpu usage, network usage, battery status, temperature, system status, pc status, system monitor pro, my pc status, how is my pc."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: status, cpu, ram, disk, gpu, network, battery, temperature, processes, top, sensors, uptime, help. Default status.",
            },
            "query": {
                "type": "STRING",
                "description": "Optional filter for processes action",
            },
        },
        "required": ["action"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "system_monitor_pro",
    "title": "System Monitor Pro",
    "description": "Enhanced system monitoring — CPU, RAM, GPU, disk, network, battery",
    "icon": "📊",
    "color": "#06B6D4",
    "order": 8,
    "default_enabled": True,
}

def run(parameters: dict, player=None, session_memory=None) -> str:
    action = (parameters.get("action", "status") or "status").lower().strip()
    query = parameters.get("query", "") or ""

    try:
        if player:
            try:
                player.write_log(f"System Monitor Pro: {action} {query}")
            except Exception:
                pass

        if action in ("help", "?", "h"):
            return (
                "System Monitor Pro — Enhanced System Monitoring:\n"
                "\n"
                "• status — full system status (CPU, RAM, disk, battery, uptime)\n"
                "• cpu — CPU usage per core, frequency, load\n"
                "• ram — RAM usage, swap\n"
                "• disk — disk usage per partition\n"
                "• gpu — GPU usage (via GPUtil or nvidia-smi)\n"
                "• network — network IO, interfaces, WiFi\n"
                "• battery — battery status, time left\n"
                "• temperature — CPU/GPU temperature (if sensors available)\n"
                "• processes [query] — list processes filtered\n"
                "• top — top CPU processes\n"
                "• sensors — all sensors\n"
                "• uptime — system uptime\n"
                "\n"
                "Examples:\n"
                "• system_monitor_pro action=status\n"
                "• system_monitor_pro action=cpu\n"
                "• system_monitor_pro action=disk\n"
                "• system_monitor_pro action=processes query=chrome\n"
                "\n"
                "Install: pip install psutil GPUtil"
            )

        try:
            import psutil
        except ImportError:
            return "psutil not installed — pip install psutil for system monitoring"

        if action == "status":
            cpu = psutil.cpu_percent(interval=1)
            mem = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            battery = psutil.sensors_battery()
            boot = psutil.boot_time()
            uptime_sec = time.time() - boot
            uptime_h = uptime_sec // 3600
            uptime_m = (uptime_sec % 3600) // 60
            # CPU per core
            per_core = psutil.cpu_percent(interval=0.5, percpu=True)
            per_core_str = ", ".join([f"{c:.0f}%" for c in per_core[:8]])
            # Disk partitions
            partitions = psutil.disk_partitions()
            disk_lines = []
            for p in partitions[:3]:
                try:
                    usage = psutil.disk_usage(p.mountpoint)
                    disk_lines.append(f"{p.device} {p.mountpoint} {usage.percent}% free {usage.free // (1024**3)}GB")
                except Exception:
                    continue

            result = (
                f"System Status ({platform.system()} {platform.release()} {platform.machine()}):\n"
                f"• CPU: {cpu}% total — per core: {per_core_str}\n"
                f"• RAM: {mem.percent}% — {mem.used // (1024**2)}MB / {mem.total // (1024**2)}MB (available {mem.available // (1024**2)}MB)\n"
                f"• Disk /: {disk.percent}% — free {disk.free // (1024**3)}GB / total {disk.total // (1024**3)}GB\n"
            )
            if disk_lines:
                result += f"• Partitions:\n" + "\n".join([f"  - {l}" for l in disk_lines]) + "\n"
            if battery:
                result += f"• Battery: {battery.percent}% {'⚡ charging' if battery.power_plugged else '🔋 discharging'} — {battery.secsleft // 60 if battery.secsleft != -1 else '?'}min left\n"
            result += f"• Uptime: {int(uptime_h)}h {int(uptime_m)}m — boot {time.ctime(boot)}\n"
            result += f"• Processes: {len(psutil.pids())}\n"

            # Alerts
            alerts = []
            if cpu > 80:
                alerts.append(f"⚠️ High CPU {cpu}%")
            if mem.percent > 85:
                alerts.append(f"⚠️ High RAM {mem.percent}%")
            if disk.percent > 90:
                alerts.append(f"⚠️ Low disk {disk.percent}% used")
            if battery and battery.percent < 20 and not battery.power_plugged:
                alerts.append(f"⚠️ Low battery {battery.percent}%")
            if alerts:
                result += f"\nAlerts:\n" + "\n".join(alerts)

            return result

        if action == "cpu":
            cpu = psutil.cpu_percent(interval=1)
            per_core = psutil.cpu_percent(interval=0.5, percpu=True)
            freq = psutil.cpu_freq()
            load = psutil.getloadavg() if hasattr(psutil, 'getloadavg') else (0, 0, 0)
            result = (
                f"CPU:\n"
                f"• Total: {cpu}% — {psutil.cpu_count()} logical, {psutil.cpu_count(logical=False)} physical cores\n"
                f"• Per core: {', '.join([f'Core{i} {c:.0f}%' for i, c in enumerate(per_core)])}\n"
            )
            if freq:
                result += f"• Frequency: {freq.current:.0f}MHz (min {freq.min:.0f}, max {freq.max:.0f})\n"
            if load[0] != 0:
                result += f"• Load avg: {load[0]:.2f}, {load[1]:.2f}, {load[2]:.2f}\n"
            return result

        if action == "ram":
            mem = psutil.virtual_memory()
            swap = psutil.swap_memory()
            return (
                f"RAM:\n"
                f"• Physical: {mem.percent}% — {mem.used // (1024**2)}MB used / {mem.total // (1024**2)}MB total, available {mem.available // (1024**2)}MB\n"
                f"• Swap: {swap.percent}% — {swap.used // (1024**2)}MB used / {swap.total // (1024**2)}MB total\n"
            )

        if action == "disk":
            parts = psutil.disk_partitions()
            lines = []
            for p in parts:
                try:
                    usage = psutil.disk_usage(p.mountpoint)
                    lines.append(f"{p.device} ({p.fstype}) at {p.mountpoint}: {usage.percent}% used — {usage.used // (1024**3)}GB / {usage.total // (1024**3)}GB, free {usage.free // (1024**3)}GB")
                except Exception:
                    continue
            io_counters = psutil.disk_io_counters()
            io_str = f"• IO: read {io_counters.read_bytes // (1024**2)}MB, write {io_counters.write_bytes // (1024**2)}MB" if io_counters else ""
            return f"Disk:\n" + "\n".join(lines) + f"\n{io_str}"

        if action == "gpu":
            try:
                import GPUtil
                gpus = GPUtil.getGPUs()
                if not gpus:
                    return "No GPU found via GPUtil — try nvidia-smi"
                lines = [f"GPU {g.id} {g.name}: {g.load*100:.0f}% load, {g.memoryUtil*100:.0f}% mem ({g.memoryUsed}MB/{g.memoryTotal}MB), temp {g.temperature}C" for g in gpus]
                return "GPU:\n" + "\n".join(lines)
            except ImportError:
                # Try nvidia-smi
                try:
                    import subprocess
                    out = subprocess.run(["nvidia-smi", "--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu", "--format=csv,noheader"], capture_output=True, text=True, timeout=5)
                    if out.returncode == 0:
                        return f"GPU via nvidia-smi:\n{out.stdout}"
                except Exception:
                    pass
                return "GPU: GPUtil not installed — pip install GPUtil, or install NVIDIA drivers and use nvidia-smi"

        if action == "network":
            net_io = psutil.net_io_counters()
            addrs = psutil.net_if_addrs()
            stats = psutil.net_if_stats()
            lines = [f"• IO: sent {net_io.bytes_sent // (1024**2)}MB, recv {net_io.bytes_recv // (1024**2)}MB, packets sent {net_io.packets_sent}, recv {net_io.packets_recv}"]
            for iface, addr_list in list(addrs.items())[:5]:
                ips = [a.address for a in addr_list if a.family == 2]  # IPv4
                if ips:
                    is_up = stats[iface].isup if iface in stats else False
                    lines.append(f"• {iface}: {', '.join(ips)} {'up' if is_up else 'down'}")
            return "Network:\n" + "\n".join(lines)

        if action == "battery":
            batt = psutil.sensors_battery()
            if not batt:
                return "No battery found (desktop PC)"
            return (
                f"Battery:\n"
                f"• {batt.percent}% {'⚡ charging' if batt.power_plugged else '🔋 discharging'}\n"
                f"• Time left: {batt.secsleft // 3600}h {(batt.secsleft % 3600) // 60}m" if batt.secsleft != -1 else "• Time left: unknown"
            )

        if action == "temperature":
            try:
                temps = psutil.sensors_temperatures()
                if not temps:
                    return "No temperature sensors found — try OpenHardwareMonitor (Windows) or lm-sensors (Linux)"
                lines = []
                for name, entries in temps.items():
                    for e in entries:
                        lines.append(f"{name} {e.label or ''}: {e.current}C (high {e.high}C, critical {e.critical}C)")
                return "Temperature:\n" + "\n".join(lines[:20])
            except Exception as e:
                return f"Temperature sensors not available: {e}"

        if action in ("processes", "top"):
            q = query
            procs = []
            for p in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
                try:
                    name = p.info['name'] or ""
                    if not q or q.lower() in name.lower():
                        procs.append(p.info)
                except Exception:
                    continue
            procs = sorted(procs, key=lambda x: x['cpu_percent'] or 0, reverse=True)[:15]
            lines = [f"{p['pid']:6} {p['name'][:25]:25} CPU {p['cpu_percent'] or 0:5.1f}% MEM {p['memory_percent'] or 0:5.1f}%" for p in procs]
            return f"Processes (filter: '{q}'):\n" + "\n".join(lines)

        if action == "uptime":
            boot = psutil.boot_time()
            uptime_sec = time.time() - boot
            h = uptime_sec // 3600
            m = (uptime_sec % 3600) // 60
            return f"Uptime: {int(h)}h {int(m)}m — boot {time.ctime(boot)} — {time.ctime()} now"

        return f"Unknown action {action}. Say 'system_monitor_pro action=help'"

    except Exception as e:
        return f"System Monitor Pro failed: {e}"
