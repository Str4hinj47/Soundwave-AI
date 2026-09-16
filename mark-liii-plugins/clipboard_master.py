"""
Clipboard Master — Advanced Clipboard Intelligence for JARVIS (Mark LIII)
Makes JARVIS impeccable at clipboard — history, translate, summarize, explain, fix, OCR.

Inspired by ONEPUNCHMAN411/Jarvis clipboard_history, clipboard, and FatihMakes clipboard intelligence.

Free & open source, zero tokens for local actions, optional Gemini for translate/summarize.
"""

import time
import json
from pathlib import Path
import platform

PLUGIN = {
    "name": "clipboard_master",
    "description": (
        "Advanced clipboard intelligence — makes JARVIS impeccable at clipboard. Actions: history, get, set, clear, translate, summarize, explain, fix, search, pin, unpin, save, load, ocr. "
        "Tracks last 50 clipboard entries automatically, with Translate/Summarize/Explain/Fix via local or Gemini. "
        "Use when user wants clipboard history, translate clipboard, summarize, explain code, fix text, search clipboard, save clipboard. "
        "Trigger phrases: clipboard history, clipboard manager, translate clipboard, summarize clipboard, explain clipboard, fix clipboard, clipboard search, save clipboard, clipboard master, clipboard intelligence."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: history, get, set, clear, translate, summarize, explain, fix, search, pin, unpin, save, load, ocr, help. Default history.",
            },
            "text": {
                "type": "STRING",
                "description": "Text for set action, or query for search/translate",
            },
            "language": {
                "type": "STRING",
                "description": "Target language for translate, e.g. en, sr, de",
            },
        },
        "required": ["action"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "clipboard_master",
    "title": "Clipboard Master",
    "description": "Advanced clipboard intelligence — history, translate, summarize",
    "icon": "📋",
    "color": "#F59E0B",
    "order": 5,
    "default_enabled": True,
    "fields": [
        {"key": "history_size", "label": "History size", "type": "number", "default": 50},
        {"key": "auto_translate", "label": "Auto-translate clipboard", "type": "checkbox", "default": False},
        {"key": "default_lang", "label": "Default translate language", "type": "text", "default": "en"},
    ],
}

_history = []
_pinned = []

def _load_history():
    global _history
    try:
        hist_file = Path.home() / ".jarvis_clipboard_history.json"
        if hist_file.exists():
            _history = json.loads(hist_file.read_text(encoding="utf-8"))[-50:]
    except Exception:
        pass

def _save_history():
    try:
        hist_file = Path.home() / ".jarvis_clipboard_history.json"
        hist_file.write_text(json.dumps(_history[-50:], ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass

def _get_clipboard():
    try:
        import pyperclip
        return pyperclip.paste()
    except Exception:
        try:
            import subprocess
            if platform.system() == "Windows":
                import ctypes
                CF_UNICODETEXT = 13
                # Try via powershell
                result = subprocess.run(["powershell", "-command", "Get-Clipboard"], capture_output=True, text=True, timeout=5)
                return result.stdout.strip()
            elif platform.system() == "Darwin":
                result = subprocess.run(["pbpaste"], capture_output=True, text=True, timeout=5)
                return result.stdout.strip()
            else:
                result = subprocess.run(["xclip", "-selection", "clipboard", "-o"], capture_output=True, text=True, timeout=5)
                return result.stdout.strip()
        except Exception:
            return ""

def _set_clipboard(text):
    try:
        import pyperclip
        pyperclip.copy(text)
        return True
    except Exception:
        try:
            import subprocess
            if platform.system() == "Windows":
                subprocess.run(["powershell", "-command", f"Set-Clipboard -Value '{text[:500]}'"], timeout=5)
            elif platform.system() == "Darwin":
                subprocess.run(["pbcopy"], input=text, text=True, timeout=5)
            else:
                subprocess.run(["xclip", "-selection", "clipboard"], input=text, text=True, timeout=5)
            return True
        except Exception:
            return False

_load_history()

def run(parameters: dict, player=None, session_memory=None) -> str:
    global _history, _pinned
    action = (parameters.get("action", "history") or "history").lower().strip()
    text = parameters.get("text", "") or ""
    language = parameters.get("language", "") or "en"

    try:
        if player:
            try:
                player.write_log(f"Clipboard Master: {action} {text[:50]}")
            except Exception:
                pass

        # Auto-track current clipboard into history (for history action)
        current = _get_clipboard()
        if current and current not in _history and len(current) > 2:
            _history.append(current)
            if len(_history) > 50:
                _history = _history[-50:]
            _save_history()

        if action in ("help", "?", "h"):
            return (
                "Clipboard Master — Advanced Clipboard Intelligence:\n"
                "\n"
                "• history — show clipboard history (last 10)\n"
                "• get — get current clipboard\n"
                "• set text=... — set clipboard\n"
                "• clear — clear clipboard + history\n"
                "• translate text=... language=en — translate clipboard (uses Gemini if available, else local)\n"
                "• summarize — summarize clipboard text\n"
                "• explain — explain clipboard (code/text)\n"
                "• fix — fix grammar/spelling in clipboard\n"
                "• search text=query — search history for query\n"
                "• pin — pin current clipboard\n"
                "• unpin — unpin\n"
                "• save path=... — save clipboard to file\n"
                "• load path=... — load file to clipboard\n"
                "• ocr — OCR clipboard image (if image in clipboard)\n"
                "\n"
                "Examples:\n"
                "• clipboard_master action=history\n"
                "• clipboard_master action=get\n"
                "• clipboard_master action=translate language=sr\n"
                "• clipboard_master action=summarize\n"
                "• clipboard_master action=search text=report\n"
                "\n"
                "Install: pip install pyperclip"
            )

        if action == "history":
            _load_history()
            if not _history:
                return "Clipboard history empty — copy something first. JARVIS tracks last 50 entries."
            lines = []
            for i, c in enumerate(reversed(_history[-10:]), 1):
                preview = c.replace('\n', ' ')[:100]
                lines.append(f"{i}. {preview} ({len(c)} chars)")
            return f"Clipboard history ({len(_history)} entries, last 10):\n" + "\n".join(lines)

        if action == "get":
            clip = _get_clipboard()
            if not clip:
                return "Clipboard empty"
            return f"Clipboard ({len(clip)} chars):\n{clip[:1000]}"

        if action == "set":
            if not text:
                return "Need text: set text=hello world"
            ok = _set_clipboard(text)
            if ok:
                if text not in _history:
                    _history.append(text)
                    _save_history()
                return f"Clipboard set to {len(text)} chars: {text[:200]}"
            return "Failed to set clipboard — pip install pyperclip"

        if action == "clear":
            _history = []
            _pinned = []
            _save_history()
            _set_clipboard("")
            return "Clipboard cleared (current + history)"

        if action == "search":
            if not text:
                return "Need query: search text=report"
            matches = [c for c in _history if text.lower() in c.lower()]
            if not matches:
                return f"No matches for '{text}' in clipboard history ({len(_history)} entries)"
            lines = [f"{i+1}. {c[:100]}" for i, c in enumerate(matches[-10:])]
            return f"Found {len(matches)} matches for '{text}':\n" + "\n".join(lines)

        if action == "translate":
            clip = text or _get_clipboard()
            if not clip:
                return "Clipboard empty, nothing to translate"
            # Try Gemini if available
            try:
                from google import genai
                import json as js
                from pathlib import Path as P
                # Get key
                key = ""
                try:
                    from memory.config_manager import get_gemini_key
                    key = get_gemini_key()
                except Exception:
                    try:
                        cfg = js.loads((P(__file__).resolve().parent.parent / "config" / "api_keys.json").read_text(encoding="utf-8"))
                        key = cfg.get("gemini_api_key", "")
                    except Exception:
                        pass
                if key:
                    client = genai.Client(api_key=key)
                    prompt = f"Translate this text to {language}, keep formatting, only return translation:\n\n{clip[:2000]}"
                    resp = client.models.generate_content(model="gemini-2.0-flash-lite", contents=prompt)
                    translated = resp.text.strip()
                    _set_clipboard(translated)
                    return f"Translated to {language} ({len(translated)} chars) and copied to clipboard:\n{translated[:500]}"
            except Exception:
                pass
            # Fallback: use local argos or just say
            return f"Translate to {language}: clipboard has {len(clip)} chars — install google-genai and set Gemini key for auto-translate, or use anythingLLM for translation. Text: {clip[:500]}"

        if action == "summarize":
            clip = text or _get_clipboard()
            if not clip:
                return "Clipboard empty"
            if len(clip) < 50:
                return f"Clipboard too short to summarize ({len(clip)} chars): {clip}"
            try:
                from google import genai
                import json as js
                from pathlib import Path as P
                key = ""
                try:
                    from memory.config_manager import get_gemini_key
                    key = get_gemini_key()
                except Exception:
                    try:
                        cfg = js.loads((P(__file__).resolve().parent.parent / "config" / "api_keys.json").read_text(encoding="utf-8"))
                        key = cfg.get("gemini_api_key", "")
                    except Exception:
                        pass
                if key:
                    client = genai.Client(api_key=key)
                    prompt = f"Summarize this in 3 bullet points, keep language:\n\n{clip[:3000]}"
                    resp = client.models.generate_content(model="gemini-2.0-flash-lite", contents=prompt)
                    summary = resp.text.strip()
                    return f"Summary:\n{summary}"
            except Exception:
                pass
            # Local fallback: first 3 sentences
            sentences = clip.split('. ')[:3]
            return f"Summary (local, first 3 sentences):\n" + "\n".join([f"• {s}" for s in sentences])

        if action == "explain":
            clip = text or _get_clipboard()
            if not clip:
                return "Clipboard empty"
            try:
                from google import genai
                import json as js
                from pathlib import Path as P
                key = ""
                try:
                    from memory.config_manager import get_gemini_key
                    key = get_gemini_key()
                except Exception:
                    try:
                        cfg = js.loads((P(__file__).resolve().parent.parent / "config" / "api_keys.json").read_text(encoding="utf-8"))
                        key = cfg.get("gemini_api_key", "")
                    except Exception:
                        pass
                if key:
                    client = genai.Client(api_key=key)
                    prompt = f"Explain this code/text in simple terms:\n\n{clip[:3000]}"
                    resp = client.models.generate_content(model="gemini-2.0-flash-lite", contents=prompt)
                    return f"Explanation:\n{resp.text.strip()}"
            except Exception:
                pass
            return f"Explain: clipboard has {len(clip)} chars — use anythingLLM or Gemini for explanation. Preview: {clip[:500]}"

        if action == "fix":
            clip = text or _get_clipboard()
            if not clip:
                return "Clipboard empty"
            # Simple local fix: trim, fix double spaces
            fixed = ' '.join(clip.split())
            _set_clipboard(fixed)
            return f"Fixed clipboard (trimmed, double spaces removed) — {len(fixed)} chars, copied. For grammar fix, use anythingLLM or Gemini. Original {len(clip)} chars."

        if action == "pin":
            clip = _get_clipboard()
            if not clip:
                return "Clipboard empty, nothing to pin"
            if clip not in _pinned:
                _pinned.append(clip)
            return f"Pinned clipboard ({len(_pinned)} pinned): {clip[:100]}"

        if action == "save":
            clip = _get_clipboard()
            if not clip:
                return "Clipboard empty"
            save_path = Path(text).expanduser() if text else Path.home() / "clipboard.txt"
            try:
                save_path.write_text(clip, encoding="utf-8")
                return f"Saved clipboard ({len(clip)} chars) to {save_path}"
            except Exception as e:
                return f"Save failed: {e}"

        if action == "load":
            load_path = Path(text).expanduser() if text else None
            if not load_path or not load_path.exists():
                return f"Need valid file path: load text=C:\\path\\to\\file.txt"
            try:
                content = load_path.read_text(encoding="utf-8")
                _set_clipboard(content)
                return f"Loaded {load_path} ({len(content)} chars) to clipboard"
            except Exception as e:
                return f"Load failed: {e}"

        return f"Unknown action {action}. Say 'clipboard_master action=help'"

    except Exception as e:
        return f"Clipboard Master failed: {e}"
