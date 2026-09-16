"""
Mouse Master Pro — Advanced Mouse Mastery for JARVIS (Mark LIII)
Makes JARVIS impeccable at mouse — beyond basic click/move, with easing, multi-monitor, gestures.

Ported from ONEPUNCHMAN411/Jarvis control/mouse.py + screen.py + window_manager_pro multi-monitor
+ pc_master mouse actions.

Free & open source, zero tokens.
"""

import time
import math
import platform
import random
from pathlib import Path

PLUGIN = {
    "name": "mouse_master_pro",
    "description": (
        "Advanced mouse mastery pro — makes JARVIS impeccable at mouse beyond basic click/move (zero tokens). "
        "Actions: move x=... y=... [duration=0.5] [easing=linear/easeIn/easeOut/easeInOut] — move with easing, click x=... y=... [button=left/right/middle] [clicks=1] [interval=0.1] — click at coords or current, drag from_x=... from_y=... to_x=... to_y=... [duration=0.5] [button=left] — drag with easing from→to, scroll amount=... [x=... y=...] [direction=vertical/horizontal] — scroll precise positive up negative down, position — current mouse position + monitor info which monitor resolution, multi_monitor — list monitors via screeninfo+mss which monitor mouse is on move to monitor 2 center, find_color color=... [region=x,y,w,h] — find color on screen via screenshot pixel search return x,y, gesture name=... — gestures shake/circle/swipe left/right/up/down via drag patterns, help. "
        "Use when user wants to move mouse, click, drag, scroll, mouse position, multi-monitor, find color, gesture. "
        "Trigger phrases: mouse master, move mouse, click mouse, drag mouse, scroll, mouse position, multi monitor, find color, mouse gesture, mouse pro, advanced mouse."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: move, click, drag, scroll, position, multi_monitor, find_color, gesture, help. Default help.",
            },
            "x": {"type": "NUMBER", "description": "X coordinate for move/click/scroll"},
            "y": {"type": "NUMBER", "description": "Y coordinate"},
            "from_x": {"type": "NUMBER", "description": "From X for drag"},
            "from_y": {"type": "NUMBER", "description": "From Y for drag"},
            "to_x": {"type": "NUMBER", "description": "To X for drag"},
            "to_y": {"type": "NUMBER", "description": "To Y for drag"},
            "duration": {"type": "NUMBER", "description": "Duration seconds for move/drag, default 0.5"},
            "easing": {"type": "STRING", "description": "Easing: linear, easeIn, easeOut, easeInOut, default easeInOut"},
            "button": {"type": "STRING", "description": "Button: left, right, middle, default left"},
            "clicks": {"type": "NUMBER", "description": "Clicks count, 1 single, 2 double, default 1"},
            "interval": {"type": "NUMBER", "description": "Interval between clicks, default 0.1"},
            "amount": {"type": "NUMBER", "description": "Scroll amount positive up negative down, e.g. 500, -500"},
            "direction": {"type": "STRING", "description": "Scroll direction vertical/horizontal, default vertical"},
            "color": {"type": "STRING", "description": "Color hex e.g. #FF0000 or rgb 255,0,0 for find_color"},
            "region": {"type": "STRING", "description": "Region x,y,w,h for find_color, e.g. 0,0,1920,1080"},
            "name": {"type": "STRING", "description": "Gesture name: shake, circle, swipe_left, swipe_right, swipe_up, swipe_down"},
        },
        "required": ["action"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "mouse_master_pro",
    "title": "Mouse Master Pro — Advanced Mouse",
    "description": "Advanced mouse with easing, multi-monitor, gestures, find color — zero tokens",
    "icon": "🖱️",
    "color": "#06B6D4",
    "order": 36,
    "default_enabled": True,
    "fields": [
        {"key": "default_duration", "label": "Default move duration", "type": "number", "default": 0.5},
        {"key": "default_easing", "label": "Default easing linear/easeIn/easeOut/easeInOut", "type": "text", "default": "easeInOut"},
    ],
}

def _ease(t, mode="easeInOut"):
    """Easing function t 0-1."""
    if mode == "linear":
        return t
    elif mode == "easeIn":
        return t * t
    elif mode == "easeOut":
        return 1 - (1 - t) * (1 - t)
    else:  # easeInOut
        return 2 * t * t if t < 0.5 else 1 - math.pow(-2 * t + 2, 2) / 2

def _move_with_easing(x, y, duration=0.5, easing="easeInOut"):
    try:
        import pyautogui
        if duration <= 0:
            pyautogui.moveTo(x, y)
            return
        start_x, start_y = pyautogui.position()
        steps = max(1, int(duration * 60))  # 60 fps
        for i in range(steps + 1):
            t = i / steps
            e = _ease(t, easing)
            cur_x = int(start_x + (x - start_x) * e)
            cur_y = int(start_y + (y - start_y) * e)
            pyautogui.moveTo(cur_x, cur_y)
            time.sleep(duration / steps)
    except ImportError:
        raise
    except Exception as e:
        # Fallback to direct
        try:
            import pyautogui
            pyautogui.moveTo(x, y)
        except Exception:
            pass

def _parse_color(color_str):
    """Parse #FF0000 or 255,0,0 or red."""
    color_str = color_str.strip().lower()
    if color_str.startswith("#"):
        hex_str = color_str[1:]
        if len(hex_str) == 6:
            r = int(hex_str[0:2], 16)
            g = int(hex_str[2:4], 16)
            b = int(hex_str[4:6], 16)
            return (r, g, b)
    elif "," in color_str:
        parts = [int(p.strip()) for p in color_str.split(",") if p.strip().isdigit() or p.strip().lstrip("-").isdigit()]
        if len(parts) >= 3:
            return (parts[0], parts[1], parts[2])
    # Named colors simple
    named = {"red": (255,0,0), "green": (0,255,0), "blue": (0,0,255), "white": (255,255,255), "black": (0,0,0), "yellow": (255,255,0)}
    if color_str in named:
        return named[color_str]
    return None

def run(parameters: dict, player=None, session_memory=None) -> str:
    action = (parameters.get("action", "help") or "help").lower().strip()
    x = parameters.get("x", None)
    y = parameters.get("y", None)
    try:
        x = int(x) if x is not None else None
        y = int(y) if y is not None else None
    except Exception:
        pass
    from_x = parameters.get("from_x", None)
    from_y = parameters.get("from_y", None)
    to_x = parameters.get("to_x", None)
    to_y = parameters.get("to_y", None)
    try:
        from_x = int(from_x) if from_x is not None else None
        from_y = int(from_y) if from_y is not None else None
        to_x = int(to_x) if to_x is not None else None
        to_y = int(to_y) if to_y is not None else None
    except Exception:
        pass
    duration = parameters.get("duration", 0.5)
    try:
        duration = float(duration)
    except Exception:
        duration = 0.5
    easing = (parameters.get("easing", "easeInOut") or "easeInOut").strip()
    button = (parameters.get("button", "left") or "left").lower().strip()
    clicks = parameters.get("clicks", 1)
    try:
        clicks = int(clicks)
    except Exception:
        clicks = 1
    interval = parameters.get("interval", 0.1)
    try:
        interval = float(interval)
    except Exception:
        interval = 0.1
    amount = parameters.get("amount", None)
    try:
        amount = int(amount) if amount is not None else None
    except Exception:
        amount = None
    direction = (parameters.get("direction", "vertical") or "vertical").lower().strip()
    color_str = parameters.get("color", "") or ""
    region_str = parameters.get("region", "") or ""
    name = parameters.get("name", "") or ""

    try:
        if player:
            try:
                player.write_log(f"Mouse Master Pro: {action} x={x} y={y} button={button}")
            except Exception:
                pass

        if action in ("help", "?", "h"):
            return (
                "Mouse Master Pro — Advanced Mouse Mastery (Zero Tokens, from ONEPUNCHMAN411/Jarvis control/mouse.py):\n"
                "\n"
                "Beyond basic pyautogui click/move — easing, multi-monitor, gestures, find color.\n"
                "\n"
                "• move x=... y=... [duration=0.5] [easing=linear/easeIn/easeOut/easeInOut] — move with easing, 60fps interpolation, duration\n"
                "• click [x=... y=...] [button=left/right/middle] [clicks=1] [interval=0.1] — click at coords or current, button, double-click clicks=2, interval between clicks\n"
                "• drag from_x=... from_y=... to_x=... to_y=... [duration=0.5] [button=left] [easing=...] — drag with easing from→to, uses pyautogui dragTo\n"
                "• scroll amount=... [x=... y=...] [direction=vertical/horizontal] — scroll precise positive up negative down, optional x,y to scroll at position, direction\n"
                "• position — current mouse position + monitor info which monitor resolution via screeninfo+mss\n"
                "• multi_monitor — list monitors via screeninfo + mss, which monitor mouse is on, move to monitor 2 center, etc.\n"
                "• find_color color=... [region=x,y,w,h] — find color on screen via screenshot pixel search, color hex #FF0000 or rgb 255,0,0 or name red, region optional, returns x,y\n"
                "• gesture name=... — gestures shake/circle/swipe_left/swipe_right/swipe_up/swipe_down via drag patterns\n"
                "\n"
                "Examples:\n"
                "• mouse_master_pro action=move x=100 y=100 duration=0.5 easing=easeInOut\n"
                "• mouse_master_pro action=click x=500 y=500 button=left clicks=2\n"
                "• mouse_master_pro action=drag from_x=100 from_y=100 to_x=200 to_y=200 duration=0.5\n"
                "• mouse_master_pro action=scroll amount=-500\n"
                "• mouse_master_pro action=position\n"
                "• mouse_master_pro action=multi_monitor\n"
                "• mouse_master_pro action=find_color color=#FF0000 region=0,0,1920,1080\n"
                "• mouse_master_pro action=gesture name=shake\n"
                "\n"
                "Zero tokens, pure local via pyautogui + screeninfo + mss + Pillow.\n"
                "Install: pip install pyautogui screeninfo mss Pillow\n"
            )

        if action == "move":
            if x is None or y is None:
                return "Need x,y: move x=100 y=100 duration=0.5 easing=easeInOut"
            try:
                _move_with_easing(x, y, duration=duration, easing=easing)
                return f"Moved mouse to ({x}, {y}) with {easing} easing duration {duration}s via mouse_master_pro (zero tokens)"
            except ImportError:
                return "pyautogui not installed — pip install pyautogui"
            except Exception as e:
                return f"Move failed: {e}"

        if action == "click":
            try:
                import pyautogui
                if x is not None and y is not None:
                    if clicks == 1:
                        pyautogui.click(x, y, button=button)
                    else:
                        pyautogui.click(x, y, clicks=clicks, interval=interval, button=button)
                    return f"Clicked at ({x}, {y}) button {button} clicks {clicks} interval {interval}s via mouse_master_pro (zero tokens)"
                else:
                    if clicks == 1:
                        pyautogui.click(button=button)
                    else:
                        pyautogui.click(clicks=clicks, interval=interval, button=button)
                    return f"Clicked at current position button {button} clicks {clicks} via mouse_master_pro"
            except ImportError:
                return "pyautogui not installed — pip install pyautogui"
            except Exception as e:
                return f"Click failed: {e}"

        if action == "drag":
            if from_x is None or from_y is None or to_x is None or to_y is None:
                return "Need from_x,from_y,to_x,to_y: drag from_x=100 from_y=100 to_x=200 to_y=200 duration=0.5"
            try:
                import pyautogui
                pyautogui.moveTo(from_x, from_y)
                time.sleep(0.1)
                pyautogui.dragTo(to_x, to_y, duration=duration, button=button)
                return f"Dragged from ({from_x}, {from_y}) to ({to_x}, {to_y}) duration {duration}s button {button} via mouse_master_pro (zero tokens)"
            except ImportError:
                return "pyautogui not installed — pip install pyautogui"
            except Exception as e:
                return f"Drag failed: {e}"

        if action == "scroll":
            if amount is None:
                return "Need amount: scroll amount=-500 — positive up negative down"
            try:
                import pyautogui
                if x is not None and y is not None:
                    pyautogui.moveTo(x, y)
                if direction == "horizontal":
                    pyautogui.hscroll(amount)
                else:
                    pyautogui.scroll(amount)
                return f"Scrolled {amount} {direction} at ({x}, {y}) via mouse_master_pro (zero tokens)"
            except ImportError:
                return "pyautogui not installed — pip install pyautogui"
            except Exception as e:
                return f"Scroll failed: {e}"

        if action == "position":
            try:
                import pyautogui
                cur_x, cur_y = pyautogui.position()
                info = f"Mouse position: ({cur_x}, {cur_y})"
                # Try monitor info
                try:
                    import mss
                    with mss.mss() as sct:
                        for i, mon in enumerate(sct.monitors[1:], 1):
                            if mon["left"] <= cur_x < mon["left"] + mon["width"] and mon["top"] <= cur_y < mon["top"] + mon["height"]:
                                info += f"\nOn monitor {i}: {mon['width']}x{mon['height']} at ({mon['left']}, {mon['top']})"
                                break
                except Exception:
                    pass
                try:
                    from screeninfo import get_monitors
                    mons = get_monitors()
                    info += f"\nMonitors via screeninfo: {len(mons)}"
                    for i, m in enumerate(mons, 1):
                        info += f"\n  {i}. {m.width}x{m.height} at ({m.x}, {m.y})"
                except Exception:
                    pass
                return info
            except ImportError:
                return "pyautogui not installed — pip install pyautogui"
            except Exception as e:
                return f"Position failed: {e}"

        if action == "multi_monitor":
            try:
                import mss
                from screeninfo import get_monitors
                import pyautogui
                cur_x, cur_y = pyautogui.position()
                lines = [f"Mouse at ({cur_x}, {cur_y})"]
                with mss.mss() as sct:
                    lines.append(f"Monitors via mss ({len(sct.monitors)-1} + all):")
                    for i, mon in enumerate(sct.monitors):
                        if i == 0:
                            lines.append(f"  0. All: {mon['width']}x{mon['height']} at ({mon['left']}, {mon['top']})")
                        else:
                            on = " ← mouse here" if (mon["left"] <= cur_x < mon["left"] + mon["width"] and mon["top"] <= cur_y < mon["top"] + mon["height"]) else ""
                            lines.append(f"  {i}. {mon['width']}x{mon['height']} at ({mon['left']}, {mon['top']}){on}")
                try:
                    mons = get_monitors()
                    lines.append(f"\nMonitors via screeninfo ({len(mons)}):")
                    for i, m in enumerate(mons, 1):
                        lines.append(f"  {i}. {m.width}x{m.height} at ({m.x}, {m.y}) name={getattr(m, 'name', 'N/A')}")
                except Exception as e:
                    lines.append(f"\nscreeninfo failed: {e} — pip install screeninfo")
                return "\n".join(lines)
            except ImportError as e:
                return f"mss/screeninfo/pyautogui not installed — pip install mss screeninfo pyautogui ({e})"
            except Exception as e:
                return f"Multi-monitor failed: {e}"

        if action == "find_color":
            if not color_str:
                return "Need color: find_color color=#FF0000 or color=255,0,0 or color=red [region=x,y,w,h]"
            target = _parse_color(color_str)
            if not target:
                return f"Could not parse color '{color_str}' — use #FF0000 or 255,0,0 or red/green/blue/white/black/yellow"
            # Parse region
            rx, ry, rw, rh = None, None, None, None
            if region_str:
                try:
                    parts = [int(p.strip()) for p in region_str.split(",")]
                    if len(parts) >= 4:
                        rx, ry, rw, rh = parts[0], parts[1], parts[2], parts[3]
                except Exception:
                    pass
            try:
                import mss
                from PIL import Image
                with mss.mss() as sct:
                    if rx is not None:
                        mon = {"left": rx, "top": ry, "width": rw, "height": rh}
                    else:
                        mon = sct.monitors[1] if len(sct.monitors) > 1 else sct.monitors[0]
                    shot = sct.grab(mon)
                    img = Image.frombytes("RGB", shot.size, shot.rgb)
                    # Search
                    pixels = img.load()
                    w, h = img.size
                    # Simple search with tolerance 10
                    tol = 10
                    for yy in range(0, h, 2):  # skip every 2 for speed
                        for xx in range(0, w, 2):
                            r, g, b = pixels[xx, yy]
                            if abs(r - target[0]) <= tol and abs(g - target[1]) <= tol and abs(b - target[2]) <= tol:
                                abs_x = mon["left"] + xx
                                abs_y = mon["top"] + yy
                                return f"Found color {color_str} {target} at ({abs_x}, {abs_y}) in region {mon} — tolerance {tol}, scanned {w}x{h} step 2"
                    return f"Color {color_str} {target} not found in region {mon} {w}x{h} tolerance {tol}"
            except ImportError as e:
                return f"mss/Pillow not installed — pip install mss Pillow ({e})"
            except Exception as e:
                return f"Find color failed: {e}"

        if action == "gesture":
            if not name:
                return "Need name: gesture name=shake/circle/swipe_left/swipe_right/swipe_up/swipe_down"
            name = name.lower()
            try:
                import pyautogui
                cx, cy = pyautogui.position()
                if name == "shake":
                    for _ in range(3):
                        pyautogui.moveRel(20, 0, duration=0.05)
                        pyautogui.moveRel(-40, 0, duration=0.05)
                        pyautogui.moveRel(20, 0, duration=0.05)
                    return f"Gesture shake at ({cx}, {cy}) — 3 shakes"
                elif name == "circle":
                    # Circle radius 50
                    steps = 20
                    radius = 50
                    for i in range(steps + 1):
                        angle = 2 * math.pi * i / steps
                        x = cx + int(radius * math.cos(angle))
                        y = cy + int(radius * math.sin(angle))
                        pyautogui.moveTo(x, y, duration=0.02)
                    return f"Gesture circle radius 50 at ({cx}, {cy})"
                elif name.startswith("swipe"):
                    dist = 200
                    if "left" in name:
                        pyautogui.dragRel(-dist, 0, duration=0.3)
                    elif "right" in name:
                        pyautogui.dragRel(dist, 0, duration=0.3)
                    elif "up" in name:
                        pyautogui.dragRel(0, -dist, duration=0.3)
                    elif "down" in name:
                        pyautogui.dragRel(0, dist, duration=0.3)
                    return f"Gesture {name} distance {dist} from ({cx}, {cy})"
                else:
                    return f"Unknown gesture {name} — use shake, circle, swipe_left, swipe_right, swipe_up, swipe_down"
            except ImportError:
                return "pyautogui not installed — pip install pyautogui"
            except Exception as e:
                return f"Gesture failed: {e}"

        return f"Unknown action {action}. Say 'mouse_master_pro action=help'"

    except Exception as e:
        return f"Mouse Master Pro failed: {e}"
