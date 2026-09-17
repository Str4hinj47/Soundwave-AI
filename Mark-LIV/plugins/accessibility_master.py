"""
Accessibility Master — Windows UI Automation Master for JARVIS (Mark LIII)
Makes JARVIS impeccable at PC vision — uses accessibility tree first (zero tokens), not pixel coordinates.

Ported from ONEPUNCHMAN411/Jarvis control/accessibility.py (229 lines) + control/screen_reader.py (331 lines)
+ upgraderguy777/jarvis-plugins discord_messenger.py Tier 2 (accessibility tree via pywinauto).

Why accessibility tree? LLMs can't see screen, need structured data. pywinauto reads Windows UI Automation (UIA) tree
via Desktop(backend="uia") — gives name, type, bounds, enabled, value for every control — zero tokens, instant, no vision.

Free & open source, zero tokens, Windows 10/11 best, macOS/Linux degraded.

Install: pip install pywinauto pyautogui comtypes
"""

import platform
import ctypes
import time
from pathlib import Path

PLUGIN = {
    "name": "accessibility_master",
    "description": (
        "Windows UI Automation accessibility tree master — makes JARVIS impeccable at finding and clicking UI elements without vision (zero tokens). "
        "Reads the accessibility tree of windows via pywinauto UIA backend — gives name, type, value, bounds x,y,w,h, enabled for every control. "
        "Actions: list [window] [max=50] — list UI elements, find name=... [window] — find element by name, click name=... [window] — click via center of rectangle, type name=... text=... [window] — type into element, focus — focused element, active_window — active window info via ctypes GetForegroundWindow, describe [max=30] — text description active window + mouse + focused + visible elements, tree [window] [max=100] — full tree, get_value name=..., is_enabled name=..., help. "
        "Use when user wants to find UI element, click button, type into field, list windows, describe screen, where is button — uses accessibility tree first (zero tokens), not pixel coordinates. "
        "Trigger phrases: accessibility, ui automation, find element, click element, type into element, list ui elements, describe screen, where is button, click button, accessibility master, ui tree, window elements, active window."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: list, find, click, type, focus, active_window, describe, tree, get_value, is_enabled, help. Default help.",
            },
            "name": {
                "type": "STRING",
                "description": "Element name to find/click/type, e.g. 'File', 'Export', 'Search', 'Login' — exact or partial, case-insensitive",
            },
            "window": {
                "type": "STRING",
                "description": "Window title or partial title to target, e.g. 'Chrome', 'Notepad', 'Visual Studio Code'. Leave empty for active/foreground window.",
            },
            "text": {
                "type": "STRING",
                "description": "Text to type into element for type action",
            },
            "max": {
                "type": "NUMBER",
                "description": "Max elements to return for list/tree/describe, default 50",
            },
        },
        "required": ["action"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "accessibility_master",
    "title": "Accessibility Master — UI Automation Tree",
    "description": "Reads Windows UI Automation tree — zero tokens, finds and clicks UI elements via name, not pixels",
    "icon": "♿",
    "color": "#00D4FF",
    "order": 30,
    "default_enabled": True,
    "fields": [
        {"key": "max_elements", "label": "Default max elements to list", "type": "number", "default": 50},
        {"key": "fuzzy_match", "label": "Fuzzy match (contains vs exact)", "type": "checkbox", "default": True},
        {"key": "filter_empty", "label": "Filter Pane/Group/Custom with no name", "type": "checkbox", "default": True},
    ],
}

def _is_windows():
    return platform.system() == "Windows"

def _get_active_window_info():
    """Get active window info via ctypes — title, rect, pid."""
    try:
        hwnd = ctypes.windll.user32.GetForegroundWindow()
        if not hwnd:
            return None
        # GetWindowTextLengthW + GetWindowTextW (W suffix required on Python 3.14+)
        length = ctypes.windll.user32.GetWindowTextLengthW(hwnd)
        buf = ctypes.create_unicode_buffer(length + 1)
        ctypes.windll.user32.GetWindowTextW(hwnd, buf, length + 1)
        title = buf.value or "Unknown"

        # GetWindowRect
        rect = ctypes.wintypes.RECT()
        ctypes.windll.user32.GetWindowRect(hwnd, ctypes.byref(rect))

        # Try get process name via pywinauto
        app_name = "unknown"
        try:
            from pywinauto import Application
            app = Application(backend="uia").connect(handle=hwnd)
            app_name = str(app.process) if hasattr(app, 'process') else "unknown"
        except Exception:
            pass

        return {
            "hwnd": hwnd,
            "title": title,
            "app_name": app_name,
            "rect": {
                "x": rect.left,
                "y": rect.top,
                "w": rect.right - rect.left,
                "h": rect.bottom - rect.top,
            },
        }
    except Exception as e:
        return {"error": str(e)}

def _get_window_wrapper(window_title=""):
    """Get pywinauto wrapper for window — active or by title."""
    try:
        from pywinauto import Desktop, Application
        from pywinauto.findwindows import ElementNotFoundError

        desktop = Desktop(backend="uia")
        if window_title:
            try:
                # Try exact, then regex
                window = desktop.window(title_re=f".*{window_title}.*", found_index=0)
                wrapper = window.wrapper_object()
                return wrapper, None
            except ElementNotFoundError:
                # Fuzzy search all titles
                try:
                    import pygetwindow as gw
                    for t in gw.getAllTitles():
                        if window_title.lower() in t.lower() and t.strip():
                            try:
                                w = desktop.window(title_re=f".*{t}.*", found_index=0)
                                return w.wrapper_object(), None
                            except Exception:
                                continue
                except Exception:
                    pass
                return None, f"No window found matching '{window_title}' — try list action to see open windows"
        else:
            hwnd = ctypes.windll.user32.GetForegroundWindow()
            if not hwnd:
                return None, "No foreground window"
            app = Application(backend="uia").connect(handle=hwnd)
            wrapper = app.top_window().wrapper_object()
            return wrapper, None
    except ImportError:
        return None, "pywinauto not installed — pip install pywinauto for accessibility tree (zero tokens)"
    except Exception as e:
        return None, f"Failed to get window wrapper: {e}"

def _list_elements(window_title="", max_elements=50, filter_empty=True):
    """List UI elements in window via accessibility tree."""
    try:
        from pywinauto import Desktop, Application
        from pywinauto.findwindows import ElementNotFoundError

        wrapper, err = _get_window_wrapper(window_title)
        if err:
            return [], err
        if not wrapper:
            return [], "No window wrapper"

        elements = []
        try:
            for child in wrapper.descendants():
                if len(elements) >= max_elements:
                    break
                try:
                    ctrl_type = child.element_info.control_type or ""
                    name = child.element_info.name or ""
                    # Filter Pane/Group/Custom with no name (like original)
                    if filter_empty and not name and ctrl_type in ("Pane", "Group", "Custom"):
                        continue
                    # Skip empty
                    if not name and ctrl_type in ("", "Pane"):
                        continue
                    rect = child.rectangle()
                    # Skip zero-size
                    if rect.width() == 0 or rect.height() == 0:
                        continue
                    # Get value if available
                    value = ""
                    try:
                        if hasattr(child, 'get_value'):
                            value = child.get_value() or ""
                    except Exception:
                        pass
                    # Get toggle state, etc.
                    enabled = True
                    try:
                        enabled = child.is_enabled()
                    except Exception:
                        pass

                    elements.append({
                        "name": name[:80],
                        "type": ctrl_type,
                        "value": str(value)[:200] if value else "",
                        "bounds": {
                            "x": rect.left,
                            "y": rect.top,
                            "w": rect.width(),
                            "h": rect.height(),
                        },
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
        return [], f"List elements failed: {e}"

def _find_element(name, window_title="", fuzzy=True):
    """Find element by name — exact or contains."""
    try:
        elements, err = _list_elements(window_title, max_elements=100, filter_empty=True)
        if err:
            return None, err
        name_lower = name.lower().strip()
        if not name_lower:
            return None, "Need element name to find"

        # Try exact first
        for el in elements:
            el_name = (el.get("name") or "").lower()
            if el_name == name_lower:
                return el, None

        # Then contains if fuzzy
        if fuzzy:
            for el in elements:
                el_name = (el.get("name") or "").lower()
                if name_lower in el_name and el_name:
                    return el, None

        # Also try value contains
        if fuzzy:
            for el in elements:
                val = (el.get("value") or "").lower()
                if name_lower in val and val:
                    return el, None

        return None, f"No element found with name '{name}' in window '{window_title or 'active'}' — try list action to see available elements: list window={window_title}"
    except Exception as e:
        return None, f"Find failed: {e}"

def run(parameters: dict, player=None, session_memory=None) -> str:
    action = (parameters.get("action", "help") or "help").lower().strip()
    name = parameters.get("name", "") or ""
    window_title = parameters.get("window", "") or ""
    text = parameters.get("text", "") or ""
    max_elements = parameters.get("max", 50)
    try:
        max_elements = int(max_elements)
    except Exception:
        max_elements = 50
    max_elements = max(1, min(200, max_elements))

    try:
        if player:
            try:
                player.write_log(f"Accessibility Master: {action} name={name} window={window_title}")
            except Exception:
                pass

        if action in ("help", "?", "h"):
            return (
                "Accessibility Master — Windows UI Automation Tree (Zero Tokens):\n"
                "\n"
                "Why accessibility tree? LLMs can't see screen, need structured data. pywinauto reads Windows UI Automation (UIA) tree via Desktop(backend='uia') — gives name, type, value, bounds x,y,w,h, enabled for every control — zero tokens, instant, no vision. Like ONEPUNCHMAN411/Jarvis accessibility.py (229 lines).\n"
                "\n"
                "• list [window=...] [max=50] — list UI elements in active or specified window: [type] name at x,y WxH enabled/value — filters Pane/Group/Custom with no name, skips zero-size\n"
                "• find name=... [window=...] — find element by name (exact first, then contains if fuzzy, case-insensitive)\n"
                "• click name=... [window=...] — click element by name via center of rectangle using pyautogui.click(cx,cy)\n"
                "• type name=... text=... [window=...] — type into element by name via type_keys\n"
                "• focus — get focused element\n"
                "• active_window — active window info via ctypes GetForegroundWindow: title, app, hwnd, rect x,y,w,h\n"
                "• describe [max=30] — text description: Active Window \"title\" + Application + Window position/size + Mouse position (x,y) [near center if <200px from 960,540] + Focused element + Visible UI elements top N\n"
                "• tree [window] [max=100] — full accessibility tree (descendants)\n"
                "• get_value name=... [window] — get value of element\n"
                "• is_enabled name=... [window] — check if enabled\n"
                "\n"
                "Examples:\n"
                "• accessibility_master action=list\n"
                "• accessibility_master action=list window=Chrome max=30\n"
                "• accessibility_master action=find name=File window=Notepad\n"
                "• accessibility_master action=click name=Export window=Visual Studio Code\n"
                "• accessibility_master action=type name=Search text=hello world window=Chrome\n"
                "• accessibility_master action=describe max=30\n"
                "• accessibility_master action=active_window\n"
                "\n"
                "Zero tokens for all actions — pure OS API via pywinauto UIA + ctypes. No LLM call.\n"
                "Install: pip install pywinauto pyautogui comtypes\n"
                "Windows 10/11 best, macOS/Linux degraded (pywinauto Windows only, use pyatspi on Linux, AXUIElement on macOS).\n"
            )

        if action == "active_window":
            info = _get_active_window_info()
            if not info:
                return "No active window found"
            if "error" in info:
                return f"Active window error: {info['error']}"
            rect = info.get("rect", {})
            return (
                f"Active Window:\n"
                f"• Title: \"{info.get('title', 'Unknown')}\"\n"
                f"• App: {info.get('app_name', 'unknown')}\n"
                f"• HWND: {info.get('hwnd', 0)}\n"
                f"• Position: ({rect.get('x', 0)}, {rect.get('y', 0)}) size {rect.get('w', 0)}x{rect.get('h', 0)}"
            )

        if action == "list":
            elements, err = _list_elements(window_title, max_elements=max_elements, filter_empty=True)
            if err:
                return err
            if not elements:
                return f"No UI elements found in window '{window_title or 'active'}' — window may be UWP, admin, or have no accessibility tree. Try describe action."
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
                val = el.get("value", "")
                val_str = f" Value: {val[:50]}" if val and len(val) < 100 else ""
                if name or type_:
                    lines.append(f"{i}. [{type_}] {name} at ({x}, {y}) {w}x{h}{status}{val_str}")
            return f"UI elements in '{window_title or 'active'}' (top {len(elements)}):\n" + "\n".join(lines)

        if action == "find":
            if not name:
                return "Need element name: find name=File"
            el, err = _find_element(name, window_title, fuzzy=True)
            if err:
                return err
            if not el:
                return f"Element '{name}' not found"
            bounds = el.get("bounds", {})
            return (
                f"Found element '{name}':\n"
                f"• Name: {el.get('name')}\n"
                f"• Type: {el.get('type')}\n"
                f"• Value: {el.get('value', '')[:200]}\n"
                f"• Bounds: ({bounds.get('x')}, {bounds.get('y')}) {bounds.get('w')}x{bounds.get('h')}\n"
                f"• Enabled: {el.get('enabled')}\n"
                f"• Center: ({bounds.get('x', 0) + bounds.get('w', 0)//2}, {bounds.get('y', 0) + bounds.get('h', 0)//2}) — use click action to click"
            )

        if action == "click":
            if not name:
                return "Need element name: click name=Export"
            el, err = _find_element(name, window_title, fuzzy=True)
            if err:
                return err
            if not el:
                return f"Element '{name}' not found — try list action"
            try:
                import pyautogui
                bounds = el.get("bounds", {})
                cx = bounds.get("x", 0) + bounds.get("w", 0) // 2
                cy = bounds.get("y", 0) + bounds.get("h", 0) // 2
                pyautogui.click(cx, cy)
                return f"Clicked element '{name}' ({el.get('type')}) at ({cx}, {cy}) via accessibility tree (zero tokens) — bounds {bounds.get('w')}x{bounds.get('h')}"
            except ImportError:
                return "pyautogui not installed — pip install pyautogui for clicks"
            except Exception as e:
                return f"Click failed: {e}"

        if action == "type":
            if not name or not text:
                return "Need name and text: type name=Search text=hello world"
            # Find wrapper and element, then type_keys
            try:
                from pywinauto import Desktop
                wrapper, err = _get_window_wrapper(window_title)
                if err:
                    return err
                # Find element by name in wrapper
                name_lower = name.lower()
                found_el = None
                for child in wrapper.descendants():
                    if (child.element_info.name or "").lower() == name_lower:
                        found_el = child
                        break
                if not found_el and True:  # fuzzy
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
                return f"Type failed: {e}"

        if action == "focus":
            try:
                from pywinauto import Desktop
                desktop = Desktop(backend="uia")
                # Get focused element — try from point 0,0 or via GetFocusedElement?
                # Simplified: get active window's focused
                wrapper, err = _get_window_wrapper(window_title)
                if err:
                    return err
                # Try to get focused child
                # pywinauto doesn't have direct get focused, use wrapper.has_focus() iteration
                for child in wrapper.descendants():
                    try:
                        if child.has_focus():
                            rect = child.rectangle()
                            return (
                                f"Focused element:\n"
                                f"• Name: {child.element_info.name}\n"
                                f"• Type: {child.element_info.control_type}\n"
                                f"• Bounds: ({rect.left}, {rect.top}) {rect.width()}x{rect.height()}\n"
                            )
                    except Exception:
                        continue
                return "No focused element found — try describe action"
            except ImportError:
                return "pywinauto not installed — pip install pywinauto"
            except Exception as e:
                return f"Focus failed: {e}"

        if action == "describe":
            # Full text description like ScreenReader.describe_screen
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
                import math
                x, y = pyautogui.position()
                dist = math.sqrt((x - 960)**2 + (y - 540)**2)
                pos_desc = f"({x}, {y}) [near center]" if dist < 200 else f"({x}, {y})"
                parts.append(f"Mouse position: {pos_desc}")
            except Exception:
                pass
            # Focused
            try:
                from pywinauto import Desktop
                wrapper, _ = _get_window_wrapper(window_title)
                if wrapper:
                    for child in wrapper.descendants():
                        try:
                            if child.has_focus():
                                parts.append(f"\nFocused element: {child.element_info.name} ({child.element_info.control_type}) at ({child.rectangle().left}, {child.rectangle().top})")
                                if hasattr(child, 'get_value'):
                                    val = child.get_value()
                                    if val:
                                        parts.append(f"Value: {val[:100]}")
                                break
                        except Exception:
                            continue
            except Exception:
                pass
            # Visible elements
            elements, err = _list_elements(window_title, max_elements=max_elements, filter_empty=True)
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
            return "\n".join(parts) if parts else "Could not read screen state — try list action"

        if action == "tree":
            elements, err = _list_elements(window_title, max_elements=max_elements, filter_empty=False)
            if err:
                return err
            # Build tree-like output
            lines = [f"Accessibility tree for '{window_title or 'active'}' (top {len(elements)}):"]
            for i, el in enumerate(elements, 1):
                name = el.get("name", "")[:60]
                type_ = el.get("type", "")
                bounds = el.get("bounds", {})
                lines.append(f"{'  '*0}{i}. {type_}: {name} at {bounds.get('x')},{bounds.get('y')} {bounds.get('w')}x{bounds.get('h')}")
            return "\n".join(lines)

        if action == "get_value":
            if not name:
                return "Need name: get_value name=Search"
            el, err = _find_element(name, window_title, fuzzy=True)
            if err:
                return err
            if not el:
                return f"Element '{name}' not found"
            return f"Value of '{name}' ({el.get('type')}): {el.get('value', '')[:500]}"

        if action == "is_enabled":
            if not name:
                return "Need name: is_enabled name=Export"
            el, err = _find_element(name, window_title, fuzzy=True)
            if err:
                return err
            if not el:
                return f"Element '{name}' not found"
            return f"Element '{name}' enabled: {el.get('enabled')}"

        return f"Unknown action {action}. Say 'accessibility_master action=help'"

    except Exception as e:
        return f"Accessibility Master failed: {e}"
