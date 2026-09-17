"""
Screen Reader Pro — Text-Based Screen Description for JARVIS (Mark LIII)
Makes JARVIS impeccable at understanding screen without vision — for non-vision providers or when vision fails.

Ported from ONEPUNCHMAN411/Jarvis control/screen_reader.py (331 lines):
- Active window via ctypes GetForegroundWindow + GetWindowTextW + GetWindowRect
- Mouse via pyautogui + distance from center
- Focused element via pywinauto Desktop(backend="uia")
- Visible UI elements via accessibility tree
- Clipboard, processes

Zero tokens, pure OS API.

Free & open source.
"""

import ctypes
import math
import platform
import time
from pathlib import Path

PLUGIN = {
    "name": "screen_reader_pro",
    "description": (
        "Text-based screen reader pro — makes JARVIS impeccable at understanding screen without vision (zero tokens). "
        "Describes screen as text: active window title/app/position/size, mouse position (x,y) [near center], focused element name (type) at x,y + value, visible UI elements top N with [type] name at x,y WxH [disabled] + value. "
        "Uses ctypes GetForegroundWindow + GetWindowTextW + GetWindowRect + pywinauto UIA backend + pyautogui. For non-vision AI providers or when vision fails. "
        "Actions: describe [max=30] — full description, active_window — active window info, focused — focused element, elements [window] [max=50] — visible UI elements, click_by_name name=... [window] — click by accessibility name, type_into name=... text=... [window] — type into element, clipboard — clipboard content, help. "
        "Use when user wants screen description, active window, focused element, visible elements, click by name, type into element, screen reader. "
        "Trigger phrases: screen reader, describe screen, active window, focused element, visible elements, click by name, type into element, screen reader pro, what is on screen, read screen."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: describe, active_window, focused, elements, click_by_name, type_into, clipboard, help. Default describe.",
            },
            "name": {
                "type": "STRING",
                "description": "Element name for click_by_name/type_into, e.g. 'File', 'Search'",
            },
            "window": {
                "type": "STRING",
                "description": "Window title filter, e.g. 'Chrome', 'Notepad'",
            },
            "text": {
                "type": "STRING",
                "description": "Text to type for type_into action",
            },
            "max": {
                "type": "NUMBER",
                "description": "Max elements for describe/elements, default 30",
            },
        },
        "required": ["action"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "screen_reader_pro",
    "title": "Screen Reader Pro — Text-Based Screen Description",
    "description": "Describes screen as text for non-vision providers — zero tokens",
    "icon": "👁️",
    "color": "#8B5CF6",
    "order": 32,
    "default_enabled": True,
}

def _get_active_window_info():
    try:
        hwnd = ctypes.windll.user32.GetForegroundWindow()
        if not hwnd:
            return {}
        length = ctypes.windll.user32.GetWindowTextLengthW(hwnd)
        buf = ctypes.create_unicode_buffer(length + 1)
        ctypes.windll.user32.GetWindowTextW(hwnd, buf, length + 1)
        title = buf.value or "Unknown"
        rect = ctypes.wintypes.RECT()
        ctypes.windll.user32.GetWindowRect(hwnd, ctypes.byref(rect))
        app_name = "unknown"
        try:
            from pywinauto import Application
            app = Application(backend="uia").connect(handle=hwnd)
            app_name = str(app.process) if hasattr(app, 'process') else "unknown"
        except Exception:
            pass
        return {
            "title": title,
            "app_name": app_name,
            "hwnd": hwnd,
            "rect": {"x": rect.left, "y": rect.top, "w": rect.right - rect.left, "h": rect.bottom - rect.top},
        }
    except Exception as e:
        return {"error": str(e)}

def _get_window_elements(window_title="", max_elements=50):
    try:
        from pywinauto import Desktop, Application
        from pywinauto.findwindows import ElementNotFoundError
        desktop = Desktop(backend="uia")
        if window_title:
            try:
                window = desktop.window(title_re=f".*{window_title}.*", found_index=0)
                wrapper = window.wrapper_object()
            except ElementNotFoundError:
                return [], f"No window found matching '{window_title}'"
        else:
            hwnd = ctypes.windll.user32.GetForegroundWindow()
            if not hwnd:
                return [], "No foreground window"
            app = Application(backend="uia").connect(handle=hwnd)
            wrapper = app.top_window().wrapper_object()

        elements = []
        try:
            for child in wrapper.descendants():
                if len(elements) >= max_elements:
                    break
                try:
                    ctrl_type = child.element_info.control_type or ""
                    name = child.element_info.name or ""
                    if not name and ctrl_type in ("Pane", "Group", "Custom"):
                        continue
                    rect = child.rectangle()
                    if rect.width() == 0 or rect.height() == 0:
                        continue
                    value = ""
                    try:
                        if hasattr(child, 'get_value'):
                            value = child.get_value() or ""
                    except Exception:
                        pass
                    enabled = True
                    try:
                        enabled = child.is_enabled()
                    except Exception:
                        pass
                    elements.append({
                        "name": name[:80],
                        "type": ctrl_type,
                        "value": str(value)[:200] if value else "",
                        "bounds": {"x": rect.left, "y": rect.top, "w": rect.width(), "h": rect.height()},
                        "enabled": enabled,
                    })
                except Exception:
                    continue
        except Exception as e:
            return [], f"Error reading descendants: {e}"
        return elements, None
    except ImportError:
        return [], "pywinauto not installed — pip install pywinauto"
    except Exception as e:
        return [], f"Get window elements failed: {e}"

def _get_focused_element(window_title=""):
    try:
        from pywinauto import Desktop
        desktop = Desktop(backend="uia")
        # Get wrapper
        if window_title:
            try:
                window = desktop.window(title_re=f".*{window_title}.*", found_index=0)
                wrapper = window.wrapper_object()
            except Exception:
                return None, f"No window '{window_title}'"
        else:
            import ctypes
            from pywinauto import Application
            hwnd = ctypes.windll.user32.GetForegroundWindow()
            if not hwnd:
                return None, "No foreground window"
            app = Application(backend="uia").connect(handle=hwnd)
            wrapper = app.top_window().wrapper_object()

        for child in wrapper.descendants():
            try:
                if child.has_focus():
                    rect = child.rectangle()
                    return {
                        "name": child.element_info.name or "",
                        "type": child.element_info.control_type or "",
                        "value": (child.get_value() if hasattr(child, 'get_value') else "")[:200],
                        "bounds": {"x": rect.left, "y": rect.top, "w": rect.width(), "h": rect.height()},
                    }, None
            except Exception:
                continue
        return None, "No focused element found"
    except ImportError:
        return None, "pywinauto not installed — pip install pywinauto"
    except Exception as e:
        return None, f"Focused failed: {e}"

def run(parameters: dict, player=None, session_memory=None) -> str:
    action = (parameters.get("action", "describe") or "describe").lower().strip()
    name = parameters.get("name", "") or ""
    window_title = parameters.get("window", "") or ""
    text = parameters.get("text", "") or ""
    max_elements = parameters.get("max", 30)
    try:
        max_elements = int(max_elements)
    except Exception:
        max_elements = 30
    max_elements = max(1, min(200, max_elements))

    try:
        if player:
            try:
                player.write_log(f"Screen Reader Pro: {action} name={name} window={window_title}")
            except Exception:
                pass

        if action in ("help", "?", "h"):
            return (
                "Screen Reader Pro — Text-Based Screen Description (Zero Tokens, from ONEPUNCHMAN411/Jarvis control/screen_reader.py 331 lines):\n"
                "\n"
                "Instead of sending screenshot image, extracts structured text describing:\n"
                "- Active window title and application\n"
                "- Focused element (what user has selected)\n"
                "- Visible UI elements via Windows Accessibility API (pywinauto)\n"
                "- Mouse cursor position\n"
                "- Clipboard content\n"
                "\n"
                "• describe [max=30] [window=...] — full multi-line text description: Active Window \"title\", Application, Window position/size, Mouse position (x,y) [near center if <200px from 960,540], Focused element name (type) at x,y + value, Visible UI elements top N: [type] name at x,y WxH [disabled] + value if <100 chars\n"
                "• active_window — active window info via ctypes GetForegroundWindow + GetWindowTextW + GetWindowRect + process via pywinauto\n"
                "• focused [window=...] — focused element via Desktop(backend='uia')\n"
                "• elements [window=...] [max=50] — visible UI elements via accessibility tree\n"
                "• click_by_name name=... [window=...] — find and click element by accessibility name via pyautogui center\n"
                "• type_into name=... text=... [window=...] — find and type into element via type_keys\n"
                "• clipboard — clipboard content\n"
                "\n"
                "Examples:\n"
                "• screen_reader_pro action=describe max=30\n"
                "• screen_reader_pro action=active_window\n"
                "• screen_reader_pro action=focused\n"
                "• screen_reader_pro action=elements window=Chrome max=30\n"
                "• screen_reader_pro action=click_by_name name=File window=Notepad\n"
                "• screen_reader_pro action=type_into name=Search text=hello world window=Chrome\n"
                "\n"
                "Zero tokens, pure OS API via pywinauto UIA + ctypes + pyautogui.\n"
                "Install: pip install pywinauto pyautogui\n"
            )

        if action == "active_window":
            info = _get_active_window_info()
            if not info:
                return "No active window"
            if "error" in info:
                return f"Active window error: {info['error']}"
            rect = info.get("rect", {})
            return (
                f"Active Window: \"{info.get('title', 'Unknown')}\"\n"
                f"Application: {info.get('app_name', 'unknown')}\n"
                f"HWND: {info.get('hwnd', 0)}\n"
                f"Window position: ({rect.get('x', 0)}, {rect.get('y', 0)}) size {rect.get('w', 0)}x{rect.get('h', 0)}"
            )

        if action == "focused":
            el, err = _get_focused_element(window_title)
            if err:
                return err
            if not el:
                return "No focused element"
            bounds = el.get("bounds", {})
            return (
                f"Focused element: {el.get('name')} ({el.get('type')}) at ({bounds.get('x')}, {bounds.get('y')})\n"
                f"Bounds: {bounds.get('w')}x{bounds.get('h')}\n"
                f"Value: {el.get('value', '')[:200]}"
            )

        if action == "elements":
            elements, err = _get_window_elements(window_title, max_elements=max_elements)
            if err:
                return err
            if not elements:
                return f"No elements in window '{window_title or 'active'}'"
            lines = []
            for i, el in enumerate(elements, 1):
                name = el.get("name", "")[:50]
                type_ = el.get("type", "")
                bounds = el.get("bounds", {})
                x = bounds.get("x", 0)
                y = bounds.get("y", 0)
                w = bounds.get("w", 0)
                h = bounds.get("h", 0)
                enabled = el.get("enabled", True)
                status = "" if enabled else " [disabled]"
                if name or type_:
                    lines.append(f"  {i}. [{type_}] {name} at ({x}, {y}) {w}x{h}{status}")
                    val = el.get("value", "")
                    if val and len(val) < 100:
                        lines.append(f"     Value: {val}")
            return f"Visible UI elements in '{window_title or 'active'}' (top {len(elements)}):\n" + "\n".join(lines)

        if action == "describe":
            parts = []
            # Active window
            info = _get_active_window_info()
            if info and "error" not in info:
                parts.append(f"Active Window: \"{info.get('title', 'Unknown')}\"")
                parts.append(f"Application: {info.get('app_name', 'unknown')}")
                rect = info.get("rect", {})
                if rect:
                    parts.append(f"Window position: ({rect.get('x')}, {rect.get('y')}) size {rect.get('w')}x{rect.get('h')}")
            # Mouse
            try:
                import pyautogui
                x, y = pyautogui.position()
                dist = math.sqrt((x - 960)**2 + (y - 540)**2)
                pos_desc = f"({x}, {y}) [near center]" if dist < 200 else f"({x}, {y})"
                parts.append(f"Mouse position: {pos_desc}")
            except Exception:
                pass
            # Focused
            el, _ = _get_focused_element(window_title)
            if el:
                bounds = el.get("bounds", {})
                parts.append(f"\nFocused element: {el.get('name')} ({el.get('type')}) at ({bounds.get('x')}, {bounds.get('y')})")
                if el.get("value"):
                    parts.append(f"Value: {el.get('value')[:100]}")
            # Elements
            elements, err = _get_window_elements(window_title, max_elements=max_elements)
            if not err and elements:
                parts.append(f"\nVisible UI elements (top {len(elements)}):")
                for i, el in enumerate(elements, 1):
                    name = el.get("name", "")[:50]
                    type_ = el.get("type", "")
                    bounds = el.get("bounds", {})
                    x = bounds.get("x", 0)
                    y = bounds.get("y", 0)
                    w = bounds.get("w", 0)
                    h = bounds.get("h", 0)
                    enabled = el.get("enabled", True)
                    status = "" if enabled else " [disabled]"
                    if name or type_:
                        parts.append(f"  {i}. [{type_}] {name} at ({x}, {y}) {w}x{h}{status}")
                        val = el.get("value", "")
                        if val and len(val) < 100:
                            parts.append(f"     Value: {val}")
            # Clipboard
            try:
                import pyperclip
                clip = pyperclip.paste()
                if clip and len(clip) < 200:
                    parts.append(f"\nClipboard: {clip[:200]}")
            except Exception:
                pass

            return "\n".join(parts) if parts else "Could not read screen state — try elements action"

        if action == "click_by_name":
            if not name:
                return "Need element name: click_by_name name=File"
            # Find element
            elements, err = _get_window_elements(window_title, max_elements=100)
            if err:
                return err
            name_lower = name.lower()
            found = None
            for el in elements:
                if (el.get("name") or "").lower() == name_lower:
                    found = el
                    break
            if not found:
                for el in elements:
                    if name_lower in (el.get("name") or "").lower():
                        found = el
                        break
            if not found:
                return f"No element found with name '{name}' in window '{window_title or 'active'}' — try elements action to see available"
            try:
                import pyautogui
                bounds = found.get("bounds", {})
                cx = bounds.get("x", 0) + bounds.get("w", 0) // 2
                cy = bounds.get("y", 0) + bounds.get("h", 0) // 2
                pyautogui.click(cx, cy)
                return f"Clicked element '{name}' ({found.get('type')}) at ({cx}, {cy}) via accessibility tree (zero tokens)"
            except ImportError:
                return "pyautogui not installed — pip install pyautogui"
            except Exception as e:
                return f"Click failed: {e}"

        if action == "type_into":
            if not name or not text:
                return "Need name and text: type_into name=Search text=hello"
            try:
                from pywinauto import Desktop
                # Get wrapper
                if window_title:
                    desktop = Desktop(backend="uia")
                    try:
                        window = desktop.window(title_re=f".*{window_title}.*", found_index=0)
                        wrapper = window.wrapper_object()
                    except Exception:
                        return f"No window '{window_title}'"
                else:
                    from pywinauto import Application
                    hwnd = ctypes.windll.user32.GetForegroundWindow()
                    if not hwnd:
                        return "No foreground window"
                    app = Application(backend="uia").connect(handle=hwnd)
                    wrapper = app.top_window().wrapper_object()

                name_lower = name.lower()
                found_el = None
                for child in wrapper.descendants():
                    if (child.element_info.name or "").lower() == name_lower:
                        found_el = child
                        break
                if not found_el:
                    for child in wrapper.descendants():
                        if name_lower in (child.element_info.name or "").lower():
                            found_el = child
                            break
                if not found_el:
                    return f"No element found with name '{name}'"
                found_el.type_keys(text)
                return f"Typed '{text[:100]}' into element '{name}' via accessibility tree (zero tokens)"
            except ImportError:
                return "pywinauto not installed — pip install pywinauto"
            except Exception as e:
                return f"Type into failed: {e}"

        if action == "clipboard":
            try:
                import pyperclip
                clip = pyperclip.paste()
                if not clip:
                    return "Clipboard empty"
                return f"Clipboard ({len(clip)} chars):\n{clip[:1000]}"
            except Exception as e:
                return f"Clipboard failed: {e}. pip install pyperclip"

        return f"Unknown action {action}. Say 'screen_reader_pro action=help'"

    except Exception as e:
        return f"Screen Reader Pro failed: {e}"
