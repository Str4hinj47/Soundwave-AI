"""
Soundwave AI — High-Fidelity Neural Speech Engine
Integrates Microsoft 24kHz Neural Edge TTS & Google Gemini Native Voice Audio.
Eliminates robotic Windows SAPI / Google Translate artifacts.
"""

import os
import sys
import json
import base64
import tempfile
import urllib.request
import subprocess
import threading
from pathlib import Path
from typing import Optional

def speak(text: str, voice: str = "en-US-GuyNeural"):
    """Synthesize and play high-definition neural speech in a background thread."""
    if not text or not text.strip():
        return

    threading.Thread(target=_speak_worker, args=(text.strip(), voice), daemon=True).start()

def _speak_worker(text: str, voice: str):
    clean_text = text.replace('"', "'").replace("\n", " ")[:350].strip()
    if not clean_text:
        return

    # Method 1: Soundwave Local Server Neural TTS (24kHz Microsoft Neural Audio)
    if _try_soundwave_server_tts(clean_text, voice):
        return

    # Method 2: Python edge-tts CLI / Library (if installed locally)
    if _try_python_edge_tts(clean_text, voice):
        return

    # Method 3: Gemini Audio Synthesis (if GEMINI_API_KEY is configured)
    if _try_gemini_voice_audio(clean_text):
        return

    # Method 4: High-quality OS voice playback fallback
    _fallback_os_tts(clean_text)

def _try_soundwave_server_tts(text: str, voice: str) -> bool:
    """Query the local Soundwave Express server running at 127.0.0.1:4000."""
    try:
        url = "http://127.0.0.1:4000/api/v1/agent/speak"
        payload = json.dumps({"text": text, "voice": voice}).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("success") and data.get("audioBase64"):
                raw_bytes = base64.b64decode(data["audioBase64"])
                return _play_audio_bytes(raw_bytes, ext=".mp3")
    except Exception:
        pass
    return False

def _try_python_edge_tts(text: str, voice: str) -> bool:
    """Use the edge-tts command-line tool if available on the user's PATH."""
    try:
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tf:
            temp_mp3 = tf.name

        cmd = ["edge-tts", "--voice", voice or "en-US-GuyNeural", "--text", text, "--write-media", temp_mp3]
        res = subprocess.run(cmd, capture_output=True, timeout=12)
        if res.returncode == 0 and os.path.exists(temp_mp3) and os.path.getsize(temp_mp3) > 500:
            success = _play_audio_file(temp_mp3)
            try:
                os.remove(temp_mp3)
            except Exception:
                pass
            return success
    except Exception:
        pass
    return False

def _try_gemini_voice_audio(text: str) -> bool:
    """Use Gemini Flash Audio endpoint to generate raw lifelike speech."""
    try:
        from memory.config_manager import config_manager
        api_key = config_manager.get_api_key("gemini") or os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            return False

        model = "gemini-2.0-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": f"Read this aloud with natural human cadence, warmth, and emotion: {text}"}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    "voiceConfig": {
                        "prebuiltVoiceConfig": {
                            "voiceName": "Puck"
                        }
                    }
                }
            }
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                for p in parts:
                    inline = p.get("inlineData", {})
                    if inline.get("mimeType", "").startswith("audio") and inline.get("data"):
                        raw_bytes = base64.b64decode(inline["data"])
                        return _play_audio_bytes(raw_bytes, ext=".wav")
    except Exception:
        pass
    return False

def _play_audio_bytes(data: bytes, ext: str = ".mp3") -> bool:
    """Save bytes to a temp file and play it through OS audio player."""
    try:
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tf:
            tf.write(data)
            temp_path = tf.name
        played = _play_audio_file(temp_path)
        try:
            os.remove(temp_path)
        except Exception:
            pass
        return played
    except Exception:
        return False

def _play_audio_file(filepath: str) -> bool:
    """Play audio file across Windows, macOS, and Linux without external GUI popups."""
    norm_path = os.path.abspath(filepath)

    # Windows playback
    if sys.platform == "win32":
        try:
            # Use Windows Media Player COM object for headless background playback
            ps_cmd = f"""
            $w = New-Object -ComObject WMPlayer.OCX
            $w.settings.volume = 100
            $w.URL = "{norm_path}"
            $w.controls.play()
            while ($w.playState -ne 1 -and $w.playState -ne 8) {{ Start-Sleep -Milliseconds 100 }}
            """
            subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, timeout=18)
            return True
        except Exception:
            pass

    # macOS playback
    if sys.platform == "darwin":
        try:
            subprocess.run(["afplay", norm_path], capture_output=True, timeout=18)
            return True
        except Exception:
            pass

    # Linux playback (ffplay / mpv / aplay)
    if sys.platform.startswith("linux"):
        for player in [["ffplay", "-nodisp", "-autoexit", norm_path], ["mpv", "--no-video", norm_path], ["aplay", norm_path]]:
            try:
                res = subprocess.run(player, capture_output=True, timeout=18)
                if res.returncode == 0:
                    return True
            except Exception:
                continue

    return False

def _fallback_os_tts(clean_text: str):
    """Fallback if neural services are completely disconnected."""
    if sys.platform == "win32":
        try:
            ps_script = f"""
            Add-Type -AssemblyName System.Speech
            $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
            # Pick installed female or natural voice if available
            $v = $synth.GetInstalledVoices() | Where-Object {{ $_.VoiceInfo.Gender -eq 'Female' -or $_.VoiceInfo.Name -match 'Natural' }} | Select-Object -First 1
            if ($v) {{ $synth.SelectVoice($v.VoiceInfo.Name) }}
            $synth.Rate = 0
            $synth.Speak("{clean_text}")
            """
            subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], capture_output=True, timeout=15)
            return
        except Exception:
            pass

    if sys.platform == "darwin":
        try:
            subprocess.run(["say", "-v", "Samantha", clean_text], timeout=15)
            return
        except Exception:
            pass

    print(f"\n[Soundwave Speaks]: {clean_text}\n")

class SpeechEngine:
    @staticmethod
    def speak(text: str, voice: str = "en-US-GuyNeural") -> bool:
        speak(text, voice)
        return True

speech_engine = SpeechEngine()
