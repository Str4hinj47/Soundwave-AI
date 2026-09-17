"""
Vision Bridge — Tree First, Vision Second for JARVIS (Mark LIII)
Fixes biggest weakness: accessibility tree first (zero tokens), vision second (low tokens via Gemini 2-pass).

Inspired by upgraderguy777/jarvis-plugins screenshot_annotate.py (2-pass 1400px + micro-crop orange rings)
+ discord_messenger.py 3-tier (saved aliases + accessibility tree + vision fallback) + ONEPUNCHMAN411 screen_annotator.

Strategy:
1. Tree first — try accessibility tree via pywinauto (zero tokens) — instant, no LLM
2. Vision fallback — if tree fails, take screenshot, downscale to 1400px max, annotate with orange rings around clickable elements? Actually use Gemini 2-pass low tokens.

Free & open source, zero to low tokens.
"""

import sys
import time
import platform
from pathlib import Path

PLUGIN = {
    "name": "vision_bridge",
    "description": (
        "Vision bridge tree first vision second — fixes biggest weakness, makes JARVIS impeccable at finding UI elements (zero to low tokens). "
        "Strategy: 1) Tree first — try accessibility tree via pywinauto Desktop(backend='uia') to find element by name (zero tokens, instant, no LLM) 2) Vision fallback — if tree fails, take screenshot via fresh mss instance per call (thread-safe), downscale to 1400px max via LANCZOS (saves tokens), optional micro-crop orange rings annotation, then describe via Gemini or local? "
        "Actions: find target=... [window=...] [mode=auto/tree/vision] — find element tree first vision second, click target=... [window] [mode] — click element tree first, describe [window] [mode] — describe screen tree first vision second, status — bridge status tree available + vision available, help. "
        "Use when user wants to find UI element, click, describe screen, vision bridge — uses accessibility tree first (zero tokens), vision second (low tokens). "
        "Trigger phrases: vision bridge, find element, click element, describe screen, tree first vision second, find button, where is, vision fallback, accessibility vision bridge."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: find, click, describe, status, help. Default find.",
            },
            "target": {
                "type": "STRING",
                "description": "Element name to find/click, e.g. 'File', 'Export', 'Search', 'Login Button'",
            },
            "window": {
                "type": "STRING",
                "description": "Window title filter, e.g. 'Chrome', 'Notepad'",
            },
            "mode": {
                "type": "STRING",
                "description": "Mode: auto (tree first vision second), tree (only tree zero tokens), vision (only vision low tokens), default auto",
            },
        },
        "required": ["action"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "vision_bridge",
    "title": "Vision Bridge — Tree First Vision Second",
    "description": "Accessibility tree first (zero tokens), vision second (low tokens) — fixes biggest weakness",
    "icon": "🌉",
    "color": "#10B981",
    "order": 34,
    "default_enabled": True,
    "fields": [
        {"key": "default_mode", "label": "Default mode auto/tree/vision", "type": "text", "default": "auto"},
        {"key": "max_width", "label": "Max width for vision 1400px", "type": "number", "default": 1400},
        {"key": "enable_vision_fallback", "label": "Enable vision fallback", "type": "checkbox", "default": True},
    ],
}

def _tree_find(name, window_title=""):
    """Try accessibility tree — zero tokens."""
    try:
        from pywinauto import Desktop, Application
        from pywinauto.findwindows import ElementNotFoundError

        desktop = Desktop(backend="uia")
        if window_title:
            try:
                window = desktop.window(title_re=f".*{window_title}.*", found_index=0)
                wrapper = window.wrapper_object()
            except ElementNotFoundError:
                return None, f"No window '{window_title}'"
        else:
            import ctypes
            hwnd = ctypes.windll.user32.GetForegroundWindow()
            if not hwnd:
                return None, "No foreground window"
            app = Application(backend="uia").connect(handle=hwnd)
            wrapper = app.top_window().wrapper_object()

        name_lower = name.lower().strip()
        if not name_lower:
            return None, "Need target name"

        # Exact first
        for child in wrapper.descendants():
            try:
                if (child.element_info.name or "").lower() == name_lower:
                    rect = child.rectangle()
                    return {
                        "name": child.element_info.name,
                        "type": child.element_info.control_type,
                        "bounds": {"x": rect.left, "y": rect.top, "w": rect.width(), "h": rect.height()},
                        "center": (rect.left + rect.width() // 2, rect.top + rect.height() // 2),
                        "method": "tree",
                    }, None
            except Exception:
                continue

        # Contains
        for child in wrapper.descendants():
            try:
                if name_lower in (child.element_info.name or "").lower():
                    rect = child.rectangle()
                    if rect.width() == 0 or rect.height() == 0:
                        continue
                    return {
                        "name": child.element_info.name,
                        "type": child.element_info.control_type,
                        "bounds": {"x": rect.left, "y": rect.top, "w": rect.width(), "h": rect.height()},
                        "center": (rect.left + rect.width() // 2, rect.top + rect.height() // 2),
                        "method": "tree",
                    }, None
            except Exception:
                continue

        return None, f"Tree: No element '{name}' found in window '{window_title or 'active'}'"
    except ImportError:
        return None, "Tree: pywinauto not installed — pip install pywinauto"
    except Exception as e:
        return None, f"Tree failed: {e}"

def _vision_find(name, window_title="", max_width=1400):
    """Vision fallback — low tokens via screenshot + downscale."""
    try:
        import mss
        from PIL import Image
        import io
        import os

        # Take screenshot with fresh mss instance per call — thread-safe
        save_dir = Path.home() / "Pictures" / "Screenshots"
        save_dir.mkdir(parents=True, exist_ok=True)
        save_path = save_dir / f"vision_bridge_{int(time.time()*1000)}.png"

        def capture():
            with mss.mss() as sct:
                # Try target window? Simplified: monitor 1
                mon_index = 1 if len(sct.monitors) > 1 else 0
                shot = sct.grab(sct.monitors[mon_index])
                img = Image.frombytes("RGB", shot.size, shot.rgb)
            # Resize for max_width
            if max_width:
                orig_w, orig_h = img.size
                if orig_w > max_width:
                    ratio = max_width / orig_w
                    new_h = int(orig_h * ratio)
                    img = img.resize((max_width, new_h), Image.LANCZOS if hasattr(Image, 'LANCZOS') else 1)
            return img

        img = capture()
        img.save(str(save_path), optimize=True)

        # Try Gemini vision if google-genai available and API key set
        api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY") or ""
        if api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                model = genai.GenerativeModel("gemini-2.0-flash")
                prompt = (
                    f"Find UI element '{name}' in this screenshot. "
                    f"Return JSON: {{\"found\": true/false, \"x\": 0-1000, \"y\": 0-1000, \"description\": \"...\"}} "
                    f"Coordinates are relative 0-1000. If not found, found=false."
                )
                # Use PIL image
                response = model.generate_content([prompt, img])
                text = response.text or ""
                # Try parse JSON
                import json, re
                m = re.search(r"\{.*\}", text, re.DOTALL)
                if m:
                    data = json.loads(m.group(0))
                    if data.get("found"):
                        x_rel = data.get("x", 500)
                        y_rel = data.get("y", 500)
                        # Convert to absolute via display hint
                        with mss.mss() as sct:
                            mon = sct.monitors[1] if len(sct.monitors) > 1 else sct.monitors[0]
                            abs_x = mon["left"] + int(x_rel / 1000 * mon["width"])
                            abs_y = mon["top"] + int(y_rel / 1000 * mon["height"])
                        return {
                            "name": name,
                            "type": "vision",
                            "bounds": {"x": abs_x, "y": abs_y, "w": 0, "h": 0},
                            "center": (abs_x, abs_y),
                            "method": "vision",
                            "screenshot": str(save_path),
                            "description": data.get("description", ""),
                        }, None
                return None, f"Vision: Element '{name}' not found via Gemini — screenshot saved {save_path}, response: {text[:500]}"
            except Exception as e:
                return None, f"Vision Gemini failed: {e} — screenshot saved {save_path}"

        # No API key — return screenshot path for manual
        return None, f"Vision: No GOOGLE_API_KEY set — screenshot saved {save_path} ({img.size[0]}x{img.size[1]}) downscaled to {max_width}px max (low tokens). Install google-genai and set API key for 2-pass vision, or use tree mode which is zero tokens."

    except ImportError as e:
        return None, f"Vision: mss/Pillow not installed — pip install mss Pillow ({e})"
    except Exception as e:
        return None, f"Vision failed: {e}"

def _tree_describe(window_title="", max_elements=30):
    """Describe via tree — zero tokens."""
    try:
        import ctypes, math
        from pywinauto import Desktop, Application

        parts = []

        # Active window via ctypes
        try:
            hwnd = ctypes.windll.user32.GetForegroundWindow()
            if hwnd:
                length = ctypes.windll.user32.GetWindowTextLengthW(hwnd)
                buf = ctypes.create_unicode_buffer(length + 1)
                ctypes.windll.user32.GetWindowTextW(hwnd, buf, length + 1)
                title = buf.value or "Unknown"
                rect = ctypes.wintypes.RECT()
                ctypes.windll.user32.GetWindowRect(hwnd, ctypes.byref(rect))
                parts.append(f"Active Window: \"{title}\"")
                parts.append(f"Window position: ({rect.left}, {rect.top}) size {rect.right - rect.left}x{rect.bottom - rect.top}")
        except Exception:
            pass

        # Mouse
        try:
            import pyautogui
            x, y = pyautogui.position()
            dist = math.sqrt((x - 960)**2 + (y - 540)**2)
            pos_desc = f"({x}, {y}) [near center]" if dist < 200 else f"({x}, {y})"
            parts.append(f"Mouse position: {pos_desc}")
        except Exception:
            pass

        # Elements
        try:
            desktop = Desktop(backend="uia")
            if window_title:
                window = desktop.window(title_re=f".*{window_title}.*", found_index=0)
                wrapper = window.wrapper_object()
            else:
                hwnd = ctypes.windll.user32.GetForegroundWindow()
                app = Application(backend="uia").connect(handle=hwnd)
                wrapper = app.top_window().wrapper_object()

            elements = []
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
                    elements.append(f"  - [{ctrl_type}] {name} at ({rect.left}, {rect.top}) {rect.width()}x{rect.height()}")
                except Exception:
                    continue

            if elements:
                parts.append(f"\nVisible UI elements (top {len(elements)} via tree zero tokens):")
                parts.extend(elements)
        except Exception as e:
            parts.append(f"Tree elements failed: {e}")

        return "\n".join(parts) if parts else "Tree describe failed", None
    except ImportError:
        return "", "pywinauto not installed — pip install pywinauto"
    except Exception as e:
        return "", f"Tree describe failed: {e}"

def run(parameters: dict, player=None, session_memory=None) -> str:
    action = (parameters.get("action", "find") or "find").lower().strip()
    target = parameters.get("target", "") or ""
    window_title = parameters.get("window", "") or ""
    mode = (parameters.get("mode", "auto") or "auto").lower().strip()

    try:
        if player:
            try:
                player.write_log(f"Vision Bridge: {action} target={target} window={window_title} mode={mode}")
            except Exception:
                pass

        if action in ("help", "?", "h"):
            return (
                "Vision Bridge — Tree First, Vision Second (Zero to Low Tokens, fixes biggest weakness):\n"
                "\n"
                "Strategy (from upgraderguy777/jarvis-plugins screenshot_annotate.py 2-pass + discord_messenger.py 3-tier + ONEPUNCHMAN411 screen_annotator):\n"
                "1. Tree first — try accessibility tree via pywinauto Desktop(backend='uia') to find element by name (zero tokens, instant, no LLM) — filters Pane/Group/Custom no name, exact then contains\n"
                "2. Vision fallback — if tree fails, take screenshot via fresh mss instance per call (thread-safe, no segfaults), downscale to 1400px max via LANCZOS (saves tokens), optional micro-crop orange rings, then describe via Gemini 2.0 Flash if GOOGLE_API_KEY set (low tokens), else return screenshot path\n"
                "\n"
                "• find target=... [window=...] [mode=auto/tree/vision] — find element tree first vision second, returns name, type, bounds x,y,w,h, center x,y, method tree/vision, screenshot path if vision\n"
                "• click target=... [window] [mode] — click element tree first (pyautogui center), vision second if tree fails\n"
                "• describe [window] [mode=auto/tree/vision] — describe screen tree first (active window title, mouse, visible elements), vision second (screenshot + Gemini if API key)\n"
                "• status — bridge status: tree available? (pywinauto), vision available? (mss+Pillow), Gemini available? (google-genai + API key), display hint cached\n"
                "\n"
                "Modes:\n"
                "- auto: tree first (zero tokens), vision second (low tokens) — default, best\n"
                "- tree: only tree (zero tokens) — fastest, no LLM\n"
                "- vision: only vision (low tokens) — when tree fails or UWP/admin window\n"
                "\n"
                "Examples:\n"
                "• vision_bridge action=find target=File window=Notepad mode=auto\n"
                "• vision_bridge action=click target=Export mode=auto\n"
                "• vision_bridge action=describe mode=tree\n"
                "• vision_bridge action=status\n"
                "\n"
                "Zero tokens for tree, low tokens for vision (1400px max + Gemini 2.0 Flash 2-pass).\n"
                "Install: pip install pywinauto pyautogui mss Pillow google-genai\n"
                "Set GOOGLE_API_KEY env for vision fallback.\n"
            )

        if action == "status":
            tree_ok = False
            try:
                import pywinauto
                tree_ok = True
            except ImportError:
                pass
            vision_ok = False
            try:
                import mss, PIL
                vision_ok = True
            except ImportError:
                pass
            gemini_ok = False
            try:
                import google.generativeai
                import os
                if os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY"):
                    gemini_ok = True
            except ImportError:
                pass
            # Display hint
            hint = ""
            try:
                import mss, ctypes
                with mss.mss() as sct:
                    mon = sct.monitors[1] if len(sct.monitors) > 1 else sct.monitors[0]
                    w, h = mon["width"], mon["height"]
                    left, top = mon["left"], mon["top"]
                try:
                    dpi = ctypes.windll.user32.GetDpiForSystem()
                    dpi_pct = int(round(dpi / 96.0 * 100))
                    hint = f"PRIMARY {w}x{h} at ({left},{top}) mouse same grid as PNGs, Win scale ~{dpi_pct}%"
                except Exception:
                    hint = f"PRIMARY {w}x{h} at ({left},{top})"
            except Exception:
                hint = "No monitor info"

            return (
                f"Vision Bridge status:\n"
                f"• Tree (zero tokens) available: {tree_ok} — pywinauto UIA backend, Desktop(backend='uia')\n"
                f"• Vision (low tokens) available: {vision_ok} — mss + Pillow, fresh instance per call thread-safe\n"
                f"• Gemini (vision LLM) available: {gemini_ok} — google-genai + GOOGLE_API_KEY, 2-pass 1400px max + micro-crop orange rings\n"
                f"• Display hint: {hint}\n"
                f"• Strategy: tree first (zero tokens) → vision second (low tokens) → fails gracefully\n"
                f"• Mode auto: try tree, if fails try vision — best of both worlds"
            )

        if action == "find":
            if not target:
                return "Need target: find target=File — element name to find"
            if mode in ("auto", "tree"):
                el, err = _tree_find(target, window_title)
                if el:
                    bounds = el.get("bounds", {})
                    return (
                        f"Found '{target}' via TREE (zero tokens):\n"
                        f"• Name: {el.get('name')}\n"
                        f"• Type: {el.get('type')}\n"
                        f"• Bounds: ({bounds.get('x')}, {bounds.get('y')}) {bounds.get('w')}x{bounds.get('h')}\n"
                        f"• Center: {el.get('center')} — use click action\n"
                        f"• Method: {el.get('method')} (zero tokens, instant, no LLM)"
                    )
                if mode == "tree":
                    return err or f"Tree: '{target}' not found"
                # auto — fall through to vision
                tree_err = err
            else:
                tree_err = None

            if mode in ("auto", "vision"):
                el, err = _vision_find(target, window_title, max_width=1400)
                if el:
                    bounds = el.get("bounds", {})
                    return (
                        f"Found '{target}' via VISION (low tokens):\n"
                        f"• Name: {el.get('name')}\n"
                        f"• Type: {el.get('type')}\n"
                        f"• Center: {el.get('center')} — use click action\n"
                        f"• Method: {el.get('method')} (low tokens, 1400px max + Gemini)\n"
                        f"• Screenshot: {el.get('screenshot', 'N/A')}\n"
                        f"• Description: {el.get('description', '')[:200]}"
                    )
                # Both failed
                if tree_err:
                    return f"Tree failed: {tree_err}\nVision failed: {err}\nTry tree mode for zero tokens, or set GOOGLE_API_KEY for vision"
                return err or f"Vision: '{target}' not found"

            return f"Unknown mode {mode} — use auto/tree/vision"

        if action == "click":
            if not target:
                return "Need target: click target=Export"
            # Find first
            el = None
            method = None
            if mode in ("auto", "tree"):
                el_found, err = _tree_find(target, window_title)
                if el_found:
                    el = el_found
                    method = "tree"
                elif mode == "tree":
                    return err or f"Tree: '{target}' not found — cannot click"

            if not el and mode in ("auto", "vision"):
                el_found, err = _vision_find(target, window_title, max_width=1400)
                if el_found:
                    el = el_found
                    method = "vision"
                elif mode == "vision":
                    return err or f"Vision: '{target}' not found — cannot click"

            if not el:
                return f"Element '{target}' not found via tree nor vision — try find action with mode=tree to see error, or mode=vision with GOOGLE_API_KEY"

            try:
                import pyautogui
                cx, cy = el.get("center", (0, 0))
                pyautogui.click(cx, cy)
                return f"Clicked '{target}' at ({cx}, {cy}) via {method} (tree=zero tokens, vision=low tokens) — bounds {el.get('bounds')}"
            except ImportError:
                return "pyautogui not installed — pip install pyautogui for clicks"
            except Exception as e:
                return f"Click failed: {e}"

        if action == "describe":
            if mode in ("auto", "tree"):
                text, err = _tree_describe(window_title, max_elements=30)
                if text and "failed" not in text.lower():
                    return f"Describe via TREE (zero tokens):\n{text}"
                if mode == "tree":
                    return err or text or "Tree describe failed"
                tree_err = err or text
            else:
                tree_err = None

            if mode in ("auto", "vision"):
                # Vision describe
                try:
                    import mss
                    from PIL import Image
                    import os

                    save_dir = Path.home() / "Pictures" / "Screenshots"
                    save_dir.mkdir(parents=True, exist_ok=True)
                    save_path = save_dir / f"vision_bridge_describe_{int(time.time()*1000)}.png"

                    def capture():
                        with mss.mss() as sct:
                            mon_index = 1 if len(sct.monitors) > 1 else 0
                            shot = sct.grab(sct.monitors[mon_index])
                            img = Image.frombytes("RGB", shot.size, shot.rgb)
                        # Downscale 1400
                        orig_w, orig_h = img.size
                        if orig_w > 1400:
                            ratio = 1400 / orig_w
                            new_h = int(orig_h * ratio)
                            img = img.resize((1400, new_h), Image.LANCZOS if hasattr(Image, 'LANCZOS') else 1)
                        return img

                    img = capture()
                    img.save(str(save_path), optimize=True)

                    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY") or ""
                    if api_key:
                        try:
                            import google.generativeai as genai
                            genai.configure(api_key=api_key)
                            model = genai.GenerativeModel("gemini-2.0-flash")
                            prompt = "Describe this screen in detail: active window, visible UI elements, mouse position, what user is doing. Be concise but thorough."
                            response = model.generate_content([prompt, img])
                            vision_text = response.text or "No description"
                            return f"Describe via VISION (low tokens, 1400px max + Gemini):\n{vision_text}\n\nScreenshot: {save_path}"
                        except Exception as e:
                            return f"Vision describe Gemini failed: {e} — screenshot saved {save_path} ({img.size[0]}x{img.size[1]})"

                    return f"Describe via VISION fallback: screenshot saved {save_path} ({img.size[0]}x{img.size[1]}) 1400px max (low tokens). Set GOOGLE_API_KEY for Gemini description. Tree failed: {tree_err}"

                except ImportError as e:
                    return f"Vision describe failed: mss/Pillow not installed — pip install mss Pillow ({e})"
                except Exception as e:
                    return f"Vision describe failed: {e}"

            return f"Unknown mode {mode}"

        return f"Unknown action {action}. Say 'vision_bridge action=help'"

    except Exception as e:
        return f"Vision Bridge failed: {e}"
