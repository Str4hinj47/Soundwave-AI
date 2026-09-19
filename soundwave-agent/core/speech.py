"""
Soundwave AI — Speech Output & Audio Synthesizer
Speaks assistant responses aloud using Microsoft Neural voices or local SAPI/TTS engines.
"""

import os
import sys
import subprocess
import threading
from pathlib import Path
from typing import Optional

def speak(text: str, voice: str = "en-US-JennyNeural"):
    """Synthesize and play speech in a background thread."""
    if not text or not text.strip():
        return

    threading.Thread(target=_speak_worker, args=(text.strip(), voice), daemon=True).start()

def _speak_worker(text: str, voice: str):
    clean_text = text.replace('"', "'")[:300]

    # Windows PowerShell SpeechSynthesizer (Zero-dependency on Windows)
    if sys.platform == "win32":
        try:
            ps_script = f"""
            Add-Type -AssemblyName System.Speech
            $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
            $synth.Rate = 1
            $synth.Speak("{clean_text}")
            """
            subprocess.run(["powershell", "-Command", ps_script], capture_output=True, timeout=15)
            return
        except Exception:
            pass

    # macOS say command
    if sys.platform == "darwin":
        try:
            subprocess.run(["say", clean_text], timeout=15)
            return
        except Exception:
            pass

    # Linux spd-say or espeak
    if sys.platform.startswith("linux"):
        for cmd in [["spd-say", clean_text], ["espeak", clean_text]]:
            try:
                subprocess.run(cmd, timeout=10, capture_output=True)
                return
            except Exception:
                continue

    # Fallback to printing
    print(f"\n[Soundwave Speaks]: {clean_text}\n")

class SpeechEngine:
    @staticmethod
    def speak(text: str, voice: str = "en-US-JennyNeural") -> bool:
        speak(text, voice)
        return True

speech_engine = SpeechEngine()
