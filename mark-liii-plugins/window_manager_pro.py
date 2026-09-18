"""
Window Manager Pro — Advanced Window Management for JARVIS (Mark LIII)
Makes JARVIS impeccable at window management — snap, minimize, maximize, move, resize, always on top, virtual desktops, multi-monitor.

Inspired by ONEPUNCHMAN411/Jarvis control/window.py, screen_annotator, and FatihMakes desktop.py + computer_control.py

Free & open source, zero tokens.
"""

import platform
import time
from pathlib import Path

PLUGIN = {
    "name": "window_manager_pro",
    "description": (
        "Advanced window management — makes JARVIS impeccable at controlling windows. Actions: list, minimize, maximize, close, snap (left/right/top/bottom/max), move, resize, always_on_top, focus, hide, show, transparency, virtual_desktop (new/switch/close), multi_monitor (move to monitor), cascade, tile, help. "
        "Use when user wants to manage windows, snap windows, minimize/maximize, move windows, always on top, virtual desktops, multi-monitor. "
        "Trigger phrases: window manager, manage windows, snap window, minimize window, maximize window, move window, resize window, always on top, virtual desktop, multi monitor, cascade windows, tile windows, window control, arrange windows."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: list, minimize, maximize, close, snap, move, resize, always_on_top, focus, hide, show, transparency, virtual_desktop, multi_monitor, cascade, tile, help. Default help.",
            },
            "window": {
                "type": "STRING",
                "description": "Window title or partial title to target, e.g. 'Chrome', 'Visual Studio Code'. Leave empty for active window.",
            },
            "value": {
                "type": "STRING",
                "description": "Value: for snap left/right/top/bottom/max, move x,y, resize w,h, always_on_top on/off, virtual_desktop new/switch/close, multi_monitor 1/2, transparency 0-100",
            },
        },
        "required": ["action"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "window_manager",
    "title": "Window Manager Pro",
    "description": "Advanced window management — snap, move, resize, always on top, virtual desktops",
    "icon": "🪟",
    "color": "#8B5CF6",
    "order": 3,
    "default_enabled": True,
}

def _is_windows():
    return platform.system() == "Windows"

def _get_window(title=""):
    try:
        import pygetwindow as gw
        if title:
            wins = gw.getWindowsWithTitle(title)
            if wins:
                return wins[0]
            # Fuzzy search
            all_titles = gw.getAllTitles()
            for t in all_titles:
                if title.lower() in t.lower() and t.strip():
                    w = gw.getWindowsWithTitle(t)
                    if w:
                        return w[0]
        else:
            return gw.getActiveWindow()
    except Exception:
        pass
    return None

def run(parameters: dict, player=None, session_memory=None) -> str:
    action = (parameters.get("action", "help") or "help").lower().strip()
    window_title = parameters.get("window", "") or ""
    value = parameters.get("value", "") or ""

    try:
        if player:
            try:
                player.write_log(f"Window Manager Pro: {action} {window_title} {value}")
            except Exception:
                pass

        if action in ("help", "?", "h"):
            return (
                "Window Manager Pro — Advanced Window Management:\n"
                "\n"
                "• list — list open windows\n"
                "• minimize [window] — minimize window or active\n"
                "• maximize [window] — maximize\n"
                "• close [window] — close window\n"
                "• snap left/right/top/bottom/max [window] — snap window (Win+Left etc.)\n"
                "• move x,y [window] — move window to x,y e.g. move 100,200\n"
                "• resize w,h [window] — resize window e.g. resize 800,600\n"
                "• always_on_top on/off [window] — always on top\n"
                "• focus [window] — focus window\n"
                "• transparency 0-100 [window] — set transparency (Windows)\n"
                "• virtual_desktop new/switch/close — virtual desktops\n"
                "• multi_monitor 1/2 [window] — move to monitor\n"
                "• cascade — cascade all windows\n"
                "• tile — tile windows side by side\n"
                "\n"
                "Examples:\n"
                "• window_manager_pro action=list\n"
                "• window_manager_pro action=snap value=left window=Chrome\n"
                "• window_manager_pro action=move value=100,200 window=Notepad\n"
                "• window_manager_pro action=always_on_top value=on window=YouTube\n"
                "• window_manager_pro action=focus window=Visual Studio Code\n"
                "\n"
                "Install: pip install pygetwindow pyautogui"
            )

        if action == "list":
            try:
                import pygetwindow as gw
                titles = [t for t in gw.getAllTitles() if t.strip()]
                return f"Open windows ({len(titles)}):\n" + "\n".join(titles[:30])
            except Exception as e:
                return f"List failed: {e}. pip install pygetwindow"

        if action == "minimize":
            try:
                import pygetwindow as gw
                import pyautogui
                w = _get_window(window_title)
                if w:
                    w.minimize()
                    return f"Minimized {w.title}"
                # Fallback hotkey for active
                pyautogui.hotkey('win', 'down')
                return f"Minimized active window"
            except Exception as e:
                return f"Minimize failed: {e}"

        if action == "maximize":
            try:
                import pygetwindow as gw
                import pyautogui
                w = _get_window(window_title)
                if w:
                    w.maximize()
                    return f"Maximized {w.title}"
                pyautogui.hotkey('win', 'up')
                return f"Maximized active window"
            except Exception as e:
                return f"Maximize failed: {e}"

        if action == "close":
            try:
                import pygetwindow as gw
                w = _get_window(window_title)
                if w:
                    w.close()
                    return f"Closed {w.title}"
                return f"Window '{window_title}' not found"
            except Exception as e:
                return f"Close failed: {e}"

        if action == "snap":
            v = value.lower() or "left"
            try:
                import pyautogui
                # Focus window first if specified
                if window_title:
                    w = _get_window(window_title)
                    if w:
                        try:
                            w.activate()
                            time.sleep(0.3)
                        except Exception:
                            pass
                if v == "left":
                    pyautogui.hotkey('win', 'left')
                elif v == "right":
                    pyautogui.hotkey('win', 'right')
                elif v == "top":
                    pyautogui.hotkey('win', 'up')
                elif v == "bottom":
                    pyautogui.hotkey('win', 'down')
                elif v == "max":
                    pyautogui.hotkey('win', 'up')
                else:
                    return f"Unknown snap {v} — use left, right, top, bottom, max"
                return f"Snapped {window_title or 'active window'} {v}"
            except Exception as e:
                return f"Snap failed: {e}. pip install pyautogui"

        if action == "move":
            if not value or ',' not in value:
                return "Need move x,y e.g. move 100,200"
            try:
                x, y = map(int, value.split(','))
                w = _get_window(window_title)
                if w:
                    w.moveTo(x, y)
                    return f"Moved {w.title} to {x},{y}"
                return f"Window '{window_title}' not found"
            except Exception as e:
                return f"Move failed: {e}"

        if action == "resize":
            if not value or ',' not in value:
                return "Need resize w,h e.g. resize 800,600"
            try:
                w, h = map(int, value.split(','))
                win = _get_window(window_title)
                if win:
                    win.resizeTo(w, h)
                    return f"Resized {win.title} to {w}x{h}"
                return f"Window '{window_title}' not found"
            except Exception as e:
                return f"Resize failed: {e}"

        if action == "always_on_top":
            v = value.lower()
            try:
                win = _get_window(window_title)
                if not win:
                    return f"Window '{window_title}' not found"
                # pygetwindow doesn't have always on top, use Win32
                if _is_windows():
                    import ctypes
                    from ctypes import wintypes
                    HWND_TOPMOST = -1
                    HWND_NOTOPMOST = -2
                    SWP_NOMOVE = 0x0002
                    SWP_NOSIZE = 0x0001
                    hwnd = win._hWnd
                    if v == "on":
                        ctypes.windll.user32.SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE)
                        return f"{win.title} always on top ON"
                    else:
                        ctypes.windll.user32.SetWindowPos(hwnd, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE)
                        return f"{win.title} always on top OFF"
                return f"Always on top {v} for {win.title} — Windows only via Win32 API, use PowerToys for better support"
            except Exception as e:
                return f"Always on top failed: {e}"

        if action == "focus":
            try:
                win = _get_window(window_title)
                if win:
                    win.activate()
                    return f"Focused {win.title}"
                return f"Window '{window_title}' not found"
            except Exception as e:
                return f"Focus failed: {e}"

        if action == "transparency":
            try:
                level = int(value)
                level = max(0, min(100, level))
                win = _get_window(window_title)
                if not win:
                    return f"Window '{window_title}' not found"
                if _is_windows():
                    import ctypes
                    from ctypes import wintypes
                    hwnd = win._hWnd
                    # Set layered
                    GWL_EXSTYLE = -20
                    WS_EX_LAYERED = 0x80000
                    LWA_ALPHA = 0x2
                    style = ctypes.windll.user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
                    ctypes.windll.user32.SetWindowLongW(hwnd, GWL_EXSTYLE, style | WS_EX_LAYERED)
                    ctypes.windll.user32.SetLayeredWindowAttributes(hwnd, 0, int(255 * level / 100), LWA_ALPHA)
                    return f"Transparency {level}% for {win.title}"
                return f"Transparency {level}% — Windows only"
            except Exception as e:
                return f"Transparency failed: {e}"

        if action == "virtual_desktop":
            v = value.lower()
            if v == "new":
                try:
                    import pyautogui
                    pyautogui.hotkey('win', 'ctrl', 'd')
                    return "New virtual desktop created"
                except Exception as e:
                    return f"Virtual desktop new failed: {e}"
            elif v == "close":
                try:
                    import pyautogui
                    pyautogui.hotkey('win', 'ctrl', 'f4')
                    return "Virtual desktop closed"
                except Exception as e:
                    return f"Virtual desktop close failed: {e}"
            elif v.startswith("switch"):
                # switch 1, switch 2
                try:
                    import pyautogui
                    num = v.split()[-1] if len(v.split()) > 1 else "1"
                    # Win+Ctrl+Left/Right to switch
                    # For simplicity, use Win+Ctrl+Left/Right multiple times
                    return f"Switch virtual desktop — use Win+Ctrl+Left/Right hotkeys, or say 'switch to desktop {num}'"
                except Exception as e:
                    return f"Virtual desktop switch failed: {e}"
            return f"Virtual desktop {v} — use new, close, switch"

        if action == "multi_monitor":
            try:
                monitor_num = int(value) if value.isdigit() else 1
                win = _get_window(window_title)
                if not win:
                    return f"Window '{window_title}' not found"
                try:
                    import screeninfo
                    monitors = screeninfo.get_monitors()
                    if monitor_num < 1 or monitor_num > len(monitors):
                        return f"Monitor {monitor_num} not found — have {len(monitors)} monitors"
                    m = monitors[monitor_num - 1]
                    win.moveTo(m.x, m.y)
                    return f"Moved {win.title} to monitor {monitor_num} at {m.x},{m.y}"
                except Exception as e:
                    return f"Multi-monitor move failed: {e}. pip install screeninfo"
            except Exception as e:
                return f"Multi-monitor failed: {e}"

        if action == "cascade":
            try:
                import pygetwindow as gw
                wins = [w for w in gw.getAllWindows() if w.title.strip()]
                x, y = 0, 0
                for w in wins[:10]:
                    try:
                        w.moveTo(x, y)
                        x += 30
                        y += 30
                    except Exception:
                        continue
                return f"Cascaded {min(10, len(wins))} windows"
            except Exception as e:
                return f"Cascade failed: {e}"

        if action == "tile":
            try:
                import pygetwindow as gw
                import pyautogui
                screen_w, screen_h = pyautogui.size()
                wins = [w for w in gw.getAllWindows() if w.title.strip()][:2]
                if len(wins) >= 2:
                    wins[0].moveTo(0, 0)
                    wins[0].resizeTo(screen_w // 2, screen_h)
                    wins[1].moveTo(screen_w // 2, 0)
                    wins[1].resizeTo(screen_w // 2, screen_h)
                    return f"Tiled {wins[0].title} and {wins[1].title} side by side"
                return "Need at least 2 windows to tile"
            except Exception as e:
                return f"Tile failed: {e}"

        return f"Unknown action {action}. Say 'window_manager_pro action=help'"

    except Exception as e:
        return f"Window Manager Pro failed: {e}"
