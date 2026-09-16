"""
Screen Pro — Thread-Safe Screenshot with DPI Awareness for JARVIS (Mark LIII)
Fixes segfaults and multi-monitor alignment — makes JARVIS impeccable at screenshots.

Ported from ONEPUNCHMAN411/Jarvis control/screen.py (106 lines):
- Fresh mss instance per call (thread-safe, no shared state) — mss uses Windows GDI/COM and is NOT thread-safe, creating once and calling from thread pool causes segfaults.
- Resize for max width, DPI percent via GetDpiForSystem, automation display hint caching.

Free & open source, zero tokens.
"""

import sys
import time
import platform
from pathlib import Path

PLUGIN = {
    "name": "screen_pro",
    "description": (
        "Thread-safe screenshot pro with DPI awareness — makes JARVIS impeccable at screenshots. "
        "Takes screenshots with fresh mss instance per call (thread-safe, no shared state — mss uses Windows GDI/COM and is NOT thread-safe, creating once and calling from thread pool causes segfaults). "
        "Actions: screenshot [monitor=1] [max_width=1400] [path=...] — screenshot with optional resize via LANCZOS, monitor_info — list monitors left,top,width,height, display_hint — cached automation hint PRIMARY monitor bitmap WxH at virtual origin, mouse clicks use same pixel grid as PNGs, Win UI scale ~X%, dpi — get Windows system DPI percent, help. "
        "Use when user wants screenshot, monitor info, display hint, DPI, screen pro. "
        "Trigger phrases: screenshot, screen capture, monitor info, display hint, dpi, screen pro, take screenshot, screen info."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: screenshot, monitor_info, display_hint, dpi, help. Default screenshot.",
            },
            "monitor": {
                "type": "NUMBER",
                "description": "Monitor index, 1 = primary, 0 = all monitors combined, default 1",
            },
            "max_width": {
                "type": "NUMBER",
                "description": "Max width to resize screenshot to, e.g. 1400 for vision optimization, default none (full res)",
            },
            "path": {
                "type": "STRING",
                "description": "Save path for screenshot, default data/screenshots/screenshot_<ms>.png or ~/Pictures/Screenshots/",
            },
        },
        "required": ["action"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "screen_pro",
    "title": "Screen Pro — Thread-Safe Screenshot + DPI",
    "description": "Thread-safe screenshots with DPI awareness, fixes segfaults",
    "icon": "🖥️",
    "color": "#06B6D4",
    "order": 31,
    "default_enabled": True,
    "fields": [
        {"key": "screenshot_dir", "label": "Screenshot directory", "type": "text", "default": "~/Pictures/Screenshots"},
        {"key": "default_max_width", "label": "Default max width for vision (1400)", "type": "number", "default": 1400},
        {"key": "cache_display_hint", "label": "Cache display hint", "type": "checkbox", "default": True},
    ],
}

_automation_hint_cache = None

def _resize_for_max_width(img, max_width):
    if not max_width:
        return img
    try:
        orig_w, orig_h = img.size
        if orig_w <= max_width:
            return img
        ratio = max_width / orig_w
        new_h = int(orig_h * ratio)
        return img.resize((max_width, new_h), img.LANCZOS if hasattr(img, 'LANCZOS') else 1)
    except Exception:
        return img

def _windows_system_dpi_percent():
    """Approximate UI scale % (100 = 96 DPI)."""
    if platform.system() != "Windows":
        return None
    try:
        import ctypes
        dpi = ctypes.windll.user32.GetDpiForSystem()
        return int(round(dpi / 96.0 * 100))
    except Exception:
        return None

def _screenshot_dir():
    # Try data/screenshots first (like ONEPUNCHMAN411), then ~/Pictures/Screenshots
    try:
        # Check if we're in Mark-LIII
        base = Path(__file__).resolve().parent.parent
        data_dir = base / "data" / "screenshots"
        data_dir.mkdir(parents=True, exist_ok=True)
        return data_dir
    except Exception:
        pass
    try:
        pics = Path.home() / "Pictures" / "Screenshots"
        pics.mkdir(parents=True, exist_ok=True)
        return pics
    except Exception:
        return Path.home()

def run(parameters: dict, player=None, session_memory=None) -> str:
    global _automation_hint_cache
    action = (parameters.get("action", "screenshot") or "screenshot").lower().strip()
    monitor = parameters.get("monitor", 1)
    try:
        monitor = int(monitor)
    except Exception:
        monitor = 1
    max_width = parameters.get("max_width", None)
    try:
        max_width = int(max_width) if max_width else None
    except Exception:
        max_width = None
    path_str = parameters.get("path", "") or ""

    try:
        if player:
            try:
                player.write_log(f"Screen Pro: {action} monitor={monitor} max_width={max_width}")
            except Exception:
                pass

        if action in ("help", "?", "h"):
            return (
                "Screen Pro — Thread-Safe Screenshot with DPI Awareness (Zero Tokens):\n"
                "\n"
                "Why thread-safe? mss uses Windows GDI/COM internally and is NOT thread-safe. Creating it once and calling from thread pool causes unpredictable segfaults. Fix: fresh mss instance per call via with mss.mss() as sct: — fully thread-safe (from ONEPUNCHMAN411/Jarvis control/screen.py 106 lines).\n"
                "\n"
                "• screenshot [monitor=1] [max_width=1400] [path=...] — take screenshot with fresh mss instance per call, save to data/screenshots/screenshot_<ms>.png or custom path, optional resize via LANCZOS for vision optimization (1400px max saves tokens), log size, return path + size\n"
                "• monitor_info — list monitors via mss.mss().monitors: index, left, top, width, height\n"
                "• display_hint — cached automation hint: 'PRIMARY monitor bitmap WxH px at virtual origin (left,top); mouse clicks use same pixel grid as PNGs from take_screenshot (monitor 1). Win UI scale ~X%. Grab one screenshot before first click batch; repeat only after UI changes or a miss.' Cached, uses GetDpiForSystem\n"
                "• dpi — get Windows system DPI percent via GetDpiForSystem() / 96 * 100\n"
                "\n"
                "Examples:\n"
                "• screen_pro action=screenshot\n"
                "• screen_pro action=screenshot monitor=1 max_width=1400\n"
                "• screen_pro action=screenshot path=~/Pictures/my_screenshot.png\n"
                "• screen_pro action=monitor_info\n"
                "• screen_pro action=display_hint\n"
                "\n"
                "Zero tokens, pure local via mss + Pillow.\n"
                "Install: pip install mss Pillow\n"
                "Thread-safe: fresh mss instance per call, no shared state.\n"
            )

        if action == "screenshot":
            save_dir = _screenshot_dir()
            if path_str:
                save_path = Path(path_str).expanduser()
                save_path.parent.mkdir(parents=True, exist_ok=True)
            else:
                save_path = save_dir / f"screenshot_{int(time.time() * 1000)}.png"

            try:
                import mss
                from PIL import Image

                def capture():
                    # Fresh mss instance per thread-pool call — fully thread-safe
                    with mss.mss() as sct:
                        mon_index = min(monitor, len(sct.monitors) - 1)
                        screenshot = sct.grab(sct.monitors[mon_index])
                        img = Image.frombytes("RGB", screenshot.size, screenshot.rgb)
                    return _resize_for_max_width(img, max_width)

                # For Mark LIII plugins (sync), call directly, not via asyncio.to_thread
                img = capture()
                img.save(str(save_path), optimize=True)

                return f"Screenshot saved: {save_path} ({img.size[0]}x{img.size[1]}) monitor {monitor} max_width {max_width or 'full'} — thread-safe via fresh mss instance per call (fixes segfaults)"
            except ImportError as e:
                return f"mss or Pillow not installed — pip install mss Pillow ({e})"
            except Exception as e:
                # Fallback to pyautogui
                try:
                    import pyautogui
                    pyautogui.screenshot(str(save_path))
                    return f"Screenshot saved to {save_path} via pyautogui fallback (mss failed: {e})"
                except Exception as e2:
                    return f"Screenshot failed: {e}, fallback also failed: {e2}"

        if action == "monitor_info":
            try:
                import mss
                with mss.mss() as sct:
                    monitors = [
                        {
                            "index": i,
                            "left": m["left"],
                            "top": m["top"],
                            "width": m["width"],
                            "height": m["height"],
                        }
                        for i, m in enumerate(sct.monitors)
                    ]
                lines = [f"Monitor {m['index']}: {m['width']}x{m['height']} at ({m['left']}, {m['top']})" for m in monitors]
                return "Monitors:\n" + "\n".join(lines)
            except ImportError:
                return "mss not installed — pip install mss for monitor info"
            except Exception as e:
                return f"Monitor info failed: {e}"

        if action == "display_hint":
            if _automation_hint_cache is not None:
                return f"Display hint (cached):\n{_automation_hint_cache}"
            try:
                import mss
                with mss.mss() as sct:
                    mon = sct.monitors[1] if len(sct.monitors) > 1 else sct.monitors[0]
                    w, h = mon["width"], mon["height"]
                    left, top = mon["left"], mon["top"]
            except Exception:
                _automation_hint_cache = ""
                return "Could not get monitor info for display hint"

            dpi = _windows_system_dpi_percent()
            dpi_note = f" Win UI scale ~{dpi}%." if dpi else ""

            hint = (
                f"PRIMARY monitor bitmap {w}x{h}px at virtual origin ({left},{top}); "
                f"mouse clicks use the same pixel grid as PNGs from take_screenshot (monitor 1).{dpi_note} "
                f"Grab one screenshot before the first click batch; repeat only after the UI changes or a miss."
            )
            _automation_hint_cache = hint
            return f"Display hint:\n{hint}\n\nThis is cached — single line for system prompt, ties MSS captures (monitor 1) to pyautogui pixels, keeps model usage low."

        if action == "dpi":
            dpi = _windows_system_dpi_percent()
            if dpi is None:
                return f"DPI: not Windows or GetDpiForSystem failed — platform {platform.system()}"
            return f"Windows system DPI: {dpi}% (100% = 96 DPI) — via GetDpiForSystem()"

        return f"Unknown action {action}. Say 'screen_pro action=help'"

    except Exception as e:
        return f"Screen Pro failed: {e}"
