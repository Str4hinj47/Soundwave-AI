"""
Network Commander — Advanced Network Control for JARVIS (Mark LIII)
Makes JARVIS impeccable at network control — WiFi, IP, scanner, speed test, etc.

Inspired by ONEPUNCHMAN411/Jarvis network_plugin, network_scanner, and FatihMakes computer_settings.

Free & open source.
"""

import platform
import subprocess
import socket
from pathlib import Path

PLUGIN = {
    "name": "network_commander",
    "description": (
        "Advanced network control — makes JARVIS impeccable at network. Actions: status, wifi_list, wifi_connect, wifi_disconnect, ip, speedtest, scan, ping, traceroute, dns, hosts, firewall, help. "
        "Shows WiFi networks, connects, IP, speed test, network scan, ping, traceroute, DNS. "
        "Use when user wants network info, WiFi, IP, speed test, scan network, ping, etc. "
        "Trigger phrases: network control, wifi, wifi list, wifi connect, ip address, speed test, network scan, ping, traceroute, network commander, network info, my ip, wifi status."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: status, wifi_list, wifi_connect, wifi_disconnect, ip, speedtest, scan, ping, traceroute, dns, hosts, firewall, help. Default status.",
            },
            "target": {
                "type": "STRING",
                "description": "Target: WiFi SSID, IP to ping, host to traceroute, etc.",
            },
            "password": {
                "type": "STRING",
                "description": "WiFi password for wifi_connect",
            },
        },
        "required": ["action"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "network_commander",
    "title": "Network Commander",
    "description": "Advanced network control — WiFi, IP, scanner, speed test",
    "icon": "🌐",
    "color": "#6366F1",
    "order": 11,
    "default_enabled": True,
}

def _run(cmd, timeout=10):
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return result.stdout.strip() or result.stderr.strip() or "Done"
    except Exception as e:
        return f"Error: {e}"

def run(parameters: dict, player=None, session_memory=None) -> str:
    action = (parameters.get("action", "status") or "status").lower().strip()
    target = parameters.get("target", "") or ""
    password = parameters.get("password", "") or ""

    try:
        if player:
            try:
                player.write_log(f"Network Commander: {action} {target}")
            except Exception:
                pass

        if action in ("help", "?", "h"):
            return (
                "Network Commander — Advanced Network Control:\n"
                "\n"
                "• status — full network status (IP, WiFi, interfaces)\n"
                "• wifi_list — list WiFi networks\n"
                "• wifi_connect target=SSID password=... — connect to WiFi\n"
                "• wifi_disconnect — disconnect WiFi\n"
                "• ip — show IP addresses (local + public)\n"
                "• speedtest — internet speed test\n"
                "• scan [target] — scan network (e.g. scan 192.168.1.0/24)\n"
                "• ping target=8.8.8.8 — ping host\n"
                "• traceroute target=google.com — traceroute\n"
                "• dns target=google.com — DNS lookup\n"
                "• hosts — show hosts file\n"
                "• firewall status — firewall status\n"
                "\n"
                "Examples:\n"
                "• network_commander action=status\n"
                "• network_commander action=wifi_list\n"
                "• network_commander action=ip\n"
                "• network_commander action=ping target=8.8.8.8\n"
                "• network_commander action=speedtest\n"
                "\n"
                "Install: pip install speedtest-cli (optional for speedtest)"
            )

        if action == "status":
            ip_info = _run("ipconfig" if platform.system() == "Windows" else "ifconfig || ip addr")
            wifi_info = _run("netsh wlan show interfaces" if platform.system() == "Windows" else "nmcli device wifi list | head -n 20")
            # Local IP
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                s.connect(("8.8.8.8", 80))
                local_ip = s.getsockname()[0]
                s.close()
            except Exception:
                local_ip = "unknown"
            # Public IP
            try:
                import requests
                public_ip = requests.get("https://api.ipify.org", timeout=5).text
            except Exception:
                public_ip = "unknown (pip install requests)"
            return (
                f"Network Status:\n"
                f"• Local IP: {local_ip}\n"
                f"• Public IP: {public_ip}\n"
                f"• Hostname: {socket.gethostname()}\n"
                f"\n"
                f"Interfaces:\n{ip_info[:1500]}\n"
                f"\n"
                f"WiFi:\n{wifi_info[:1000]}"
            )

        if action == "wifi_list":
            if platform.system() == "Windows":
                return _run("netsh wlan show networks")
            elif platform.system() == "Darwin":
                return _run("/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -s")
            else:
                return _run("nmcli device wifi list")

        if action == "wifi_connect":
            if not target:
                return "Need SSID: wifi_connect target=MyWiFi password=..."
            if platform.system() == "Windows":
                if password:
                    # Create profile
                    profile = f"""<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
    <name>{target}</name>
    <SSIDConfig><SSID><name>{target}</name></SSID></SSIDConfig>
    <connectionType>ESS</connectionType>
    <connectionMode>auto</connectionMode>
    <MSM><security><authEncryption><authentication>WPA2PSK</authentication><encryption>AES</encryption><useOneX>false</useOneX></authEncryption><sharedKey><keyType>passPhrase</keyType><protected>false</protected><keyMaterial>{password}</keyMaterial></sharedKey></security></MSM>
</WLANProfile>"""
                    tmp = Path.home() / f"{target}.xml"
                    tmp.write_text(profile, encoding="utf-8")
                    _run(f'netsh wlan add profile filename="{tmp}"')
                    _run(f'netsh wlan connect name="{target}"')
                    tmp.unlink(missing_ok=True)
                    return f"Connecting to WiFi {target}..."
                else:
                    return _run(f'netsh wlan connect name="{target}"')
            elif platform.system() == "Darwin":
                return _run(f"networksetup -setairportnetwork Wi-Fi {target} {password}")
            else:
                return _run(f"nmcli device wifi connect {target} password {password}")

        if action == "wifi_disconnect":
            if platform.system() == "Windows":
                return _run("netsh wlan disconnect")
            elif platform.system() == "Darwin":
                return _run("networksetup -setairportpower Wi-Fi off && networksetup -setairportpower Wi-Fi on")
            else:
                return _run("nmcli device disconnect wlan0 || nmcli radio wifi off && nmcli radio wifi on")

        if action == "ip":
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                s.connect(("8.8.8.8", 80))
                local_ip = s.getsockname()[0]
                s.close()
            except Exception:
                local_ip = "unknown"
            try:
                import requests
                public_ip = requests.get("https://api.ipify.org", timeout=5).text
                # Also get location
                try:
                    info = requests.get(f"https://ipapi.co/{public_ip}/json/", timeout=5).json()
                    loc = f"{info.get('city')}, {info.get('country_name')} — {info.get('org')}"
                except Exception:
                    loc = ""
            except Exception:
                public_ip = "unknown"
                loc = ""
            return f"IP Addresses:\n• Local: {local_ip}\n• Public: {public_ip}\n• Location: {loc}\n• Hostname: {socket.gethostname()}"

        if action == "speedtest":
            try:
                import speedtest
                st = speedtest.Speedtest()
                st.get_best_server()
                download = st.download() / 1_000_000
                upload = st.upload() / 1_000_000
                ping = st.results.ping
                return f"Speedtest:\n• Download: {download:.2f} Mbps\n• Upload: {upload:.2f} Mbps\n• Ping: {ping:.0f} ms"
            except ImportError:
                return "speedtest not installed — pip install speedtest-cli — or use fast.com in browser"
            except Exception as e:
                return f"Speedtest failed: {e}"

        if action == "scan":
            net = target or "192.168.1.0/24"
            try:
                # Try nmap if available
                if Path("/usr/bin/nmap").exists() or subprocess.run("which nmap", shell=True, capture_output=True).returncode == 0:
                    return _run(f"nmap -sn {net}", timeout=30)
                # Fallback: ping sweep
                return f"Scanning {net} — nmap not found, install nmap for full scan. Fallback: use arp -a\n" + _run("arp -a" if platform.system() == "Windows" else "arp -a || ip neigh")
            except Exception as e:
                return f"Scan failed: {e}"

        if action == "ping":
            if not target:
                return "Need target: ping target=8.8.8.8"
            count = 4
            cmd = f"ping -n {count} {target}" if platform.system() == "Windows" else f"ping -c {count} {target}"
            return _run(cmd, timeout=15)

        if action == "traceroute":
            if not target:
                return "Need target: traceroute target=google.com"
            cmd = f"tracert {target}" if platform.system() == "Windows" else f"traceroute {target}"
            return _run(cmd, timeout=20)

        if action == "dns":
            if not target:
                return "Need target: dns target=google.com"
            cmd = f"nslookup {target}" if platform.system() == "Windows" else f"dig {target} +short || nslookup {target}"
            return _run(cmd)

        if action == "hosts":
            hosts_path = Path("C:/Windows/System32/drivers/etc/hosts") if platform.system() == "Windows" else Path("/etc/hosts")
            try:
                content = hosts_path.read_text(encoding="utf-8", errors="ignore")
                return f"Hosts file {hosts_path}:\n{content[:2000]}"
            except Exception as e:
                return f"Hosts read failed: {e}"

        if action == "firewall":
            if platform.system() == "Windows":
                return _run("netsh advfirewall show allprofiles state")
            elif platform.system() == "Darwin":
                return _run("/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate")
            else:
                return _run("sudo ufw status || sudo iptables -L | head -n 30")

        return f"Unknown action {action}. Say 'network_commander action=help'"

    except Exception as e:
        return f"Network Commander failed: {e}"
