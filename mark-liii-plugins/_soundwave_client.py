"""
Soundwave AI — Shared client for Mark LIII plugins.

This is NOT a plugin (starts with _), it's a shared helper imported by the
soundwave_* plugins. It handles:
- Soundwave API base URL resolution (env, config, default)
- Edge TTS direct synthesis (same engine Soundwave uses server-side)
- Voice metadata (mirrors server/src/lib/voices.ts)
- File helpers for saving MP3/WAV

Mark LIII plugins run in same Python process as main.py, so they can import
this helper freely.

Install deps for these plugins:
  pip install edge-tts requests

Edge TTS Python is the same free, key-less Microsoft Edge online TTS that
Soundwave uses via node-edge-tts — 24kHz mono MP3 + word timings, no API key.

Soundwave API (optional, for cloud features):
- GET /api/v1/voices — no auth, lists 6 Microsoft Neural voices
- POST /api/v1/tts/synthesize — auth required, returns MP3 base64 + wordTimings
- POST /api/v1/tts/clone — cloned voice synthesis
- GET/POST /api/v1/projects — cloud projects (Pro+)
- POST /api/v1/upload/video|audio — upload media
- POST /api/v1/export/video — FFmpeg export job

For local use, plugins default to direct Edge TTS (no Soundwave server needed).
If SOUNDWAVE_API_URL env is set, they also try Soundwave API for cloud features.
"""

import os
import json
import base64
import asyncio
import subprocess
import platform
from pathlib import Path
from typing import Optional, List, Dict

# ── Voice metadata (mirrors Soundwave server/src/lib/voices.ts + frontend) ──
SOUNDWAVE_VOICES = [
    {"id": "en-US-JennyNeural", "displayName": "Jenny", "gender": "Female", "accent": "American", "style": "Warm, friendly, versatile — best for narration, explainer, YouTube"},
    {"id": "en-US-AnaNeural", "displayName": "Ana", "gender": "Female", "accent": "American", "style": "Young, energetic, upbeat — TikTok, Reels, ads"},
    {"id": "en-GB-SoniaNeural", "displayName": "Sonia", "gender": "Female", "accent": "British", "style": "Elegant British, professional — corporate, audiobook, documentary"},
    {"id": "en-US-ChristopherNeural", "displayName": "Christopher", "gender": "Male", "accent": "American", "style": "Deep, authoritative — trailer, podcast, presentation"},
    {"id": "en-US-GuyNeural", "displayName": "Guy", "gender": "Male", "accent": "American", "style": "Casual, conversational — vlog, tutorial, friendly"},
    {"id": "en-GB-RyanNeural", "displayName": "Ryan", "gender": "Male", "accent": "British", "style": "British male, clear — news, education, formal"},
]

VOICE_IDS = {v["id"] for v in SOUNDWAVE_VOICES}

def get_voice(voice_id: str) -> Optional[Dict]:
    for v in SOUNDWAVE_VOICES:
        if v["id"] == voice_id or v["displayName"].lower() == voice_id.lower():
            return v
    return None

def resolve_api_url() -> str:
    # Priority: env SOUNDWAVE_API_URL > config/api_keys.json soundwave_url > default localhost
    env_url = os.getenv("SOUNDWAVE_API_URL", "").strip()
    if env_url:
        return env_url.rstrip("/")
    try:
        # Try to read from Mark LIII config if user stored it
        base = Path(__file__).resolve().parent.parent
        cfg_path = base / "config" / "api_keys.json"
        if cfg_path.exists():
            cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
            if cfg.get("soundwave_url"):
                return str(cfg["soundwave_url"]).rstrip("/")
            if cfg.get("soundwave_api_url"):
                return str(cfg["soundwave_api_url"]).rstrip("/")
    except Exception:
        pass
    return "http://localhost:4000"

def get_api_key() -> str:
    return os.getenv("SOUNDWAVE_API_KEY", "").strip()

# ── Direct Edge TTS (no Soundwave server needed) ──────────────────────────
# This mirrors Soundwave's server/src/lib/edgeTts.ts but in Python.
# Uses edge-tts library (pip install edge-tts) — same free Microsoft service.

async def _edge_tts_async(text: str, voice: str, output_path: str, rate: str = "+0%", pitch: str = "+0Hz", volume: str = "+0%") -> Dict:
    try:
        import edge_tts
    except ImportError:
        raise RuntimeError("edge-tts not installed. Run: pip install edge-tts")

    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, volume=volume)
    await communicate.save(output_path)
    return {"path": output_path, "voice": voice}

def synthesize_edge_tts(text: str, voice: str = "en-US-JennyNeural", output_path: Optional[str] = None, speed: float = 1.0, pitch: int = 0, volume: int = 100) -> str:
    """
    Synthesize speech via Edge TTS directly (no Soundwave server).
    Returns path to MP3 file.
    Speed 0.5..2.0 → rate, pitch -50..50 → pitch, volume 0..100 → volume
    """
    if voice not in VOICE_IDS:
        # Try to resolve display name
        v = get_voice(voice)
        if v:
            voice = v["id"]
        else:
            voice = "en-US-JennyNeural"

    if output_path is None:
        out_dir = Path.home() / "Soundwave" / "tts"
        out_dir.mkdir(parents=True, exist_ok=True)
        safe = "".join(c if c.isalnum() else "_" for c in text[:30])[:30]
        output_path = str(out_dir / f"sw_{safe}_{voice}_{int(asyncio.time.time() if hasattr(asyncio, 'time') else 0)}.mp3")
        # Fallback if no time
        if "0.mp3" in output_path:
            import time
            output_path = str(out_dir / f"sw_{safe}_{voice}_{int(time.time())}.mp3")

    # Map Soundwave's speed/pitch/volume to edge-tts SSML
    rate_pct = int((speed - 1) * 100) if speed != 1 else 0
    rate_str = f"{rate_pct:+d}%" if rate_pct != 0 else "+0%"
    pitch_str = f"{pitch:+d}Hz" if pitch != 0 else "+0Hz"
    vol_pct = volume - 100
    vol_str = f"{vol_pct:+d}%" if vol_pct != 0 else "+0%"

    try:
        asyncio.run(_edge_tts_async(text, voice, output_path, rate=rate_str, pitch=pitch_str, volume=vol_str))
    except RuntimeError:
        # Already running loop (e.g. in Jupyter) — create new loop
        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(_edge_tts_async(text, voice, output_path, rate=rate_str, pitch=pitch_str, volume=vol_str))
        finally:
            loop.close()

    return output_path

def play_audio(file_path: str):
    """Cross-platform audio playback — best effort, no crash."""
    try:
        system = platform.system()
        if system == "Windows":
            os.startfile(file_path)  # type: ignore
        elif system == "Darwin":
            subprocess.Popen(["open", file_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            # Linux — try xdg-open, mpv, vlc, aplay
            for cmd in [["xdg-open", file_path], ["mpv", file_path], ["vlc", file_path]]:
                try:
                    subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    break
                except Exception:
                    continue
    except Exception:
        pass

# ── Soundwave API client (optional, for cloud features) ────────────────────

def api_request(method: str, path: str, json_data=None, timeout=20) -> Dict:
    try:
        import requests
    except ImportError:
        raise RuntimeError("requests not installed. Run: pip install requests")

    base = resolve_api_url()
    url = f"{base}{path}"
    headers = {}
    api_key = get_api_key()
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
        # Soundwave also supports X-API-Key for Enterprise keys
        headers["X-API-Key"] = api_key

    try:
        if method.upper() == "GET":
            r = requests.get(url, headers=headers, timeout=timeout)
        else:
            r = requests.post(url, json=json_data, headers=headers, timeout=timeout)
        r.raise_for_status()
        try:
            return r.json()
        except Exception:
            return {"raw": r.text, "status": r.status_code}
    except Exception as e:
        raise RuntimeError(f"Soundwave API {method} {url} failed: {e}")

def list_soundwave_voices_api() -> List[Dict]:
    try:
        data = api_request("GET", "/api/v1/voices")
        return data.get("voices", [])
    except Exception:
        # Fallback to local metadata
        return SOUNDWAVE_VOICES

def synthesize_via_soundwave_api(text: str, voice: str = "en-US-JennyNeural", speed: float = 1.0, pitch: int = 0, volume: int = 100) -> Dict:
    """
    Synthesize via Soundwave API (requires auth, returns base64 MP3 + timings).
    Returns dict with audioBase64, duration, wordTimings, etc.
    """
    payload = {
        "text": text,
        "voice": voice,
        "speed": speed,
        "pitch": pitch,
        "volume": volume,
    }
    return api_request("POST", "/api/v1/tts/synthesize", json_data=payload, timeout=30)

def save_base64_mp3(b64: str, output_path: Optional[str] = None) -> str:
    if output_path is None:
        out_dir = Path.home() / "Soundwave" / "tts"
        out_dir.mkdir(parents=True, exist_ok=True)
        import time
        output_path = str(out_dir / f"sw_api_{int(time.time())}.mp3")
    data = base64.b64decode(b64)
    Path(output_path).write_bytes(data)
    return output_path

# ── Subtitle helpers ───────────────────────────────────────────────────────

def text_to_srt_cues(text: str, duration: float) -> List[Dict]:
    """
    Simple word-timing to SRT cues — splits text into sentences, distributes duration.
    Soundwave's edgeTts returns wordTimings; this is fallback when timings unavailable.
    """
    import re
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    if not sentences:
        return []
    total_chars = sum(len(s) for s in sentences)
    cues = []
    cursor = 0.0
    for sent in sentences:
        if not sent.strip():
            continue
        ratio = len(sent) / max(1, total_chars)
        dur = max(0.5, duration * ratio)
        cues.append({"start": cursor, "end": cursor + dur, "text": sent.strip()})
        cursor += dur
    return cues

def save_srt(cues: List[Dict], path: str):
    def fmt(t):
        h = int(t // 3600)
        m = int((t % 3600) // 60)
        s = int(t % 60)
        ms = int((t % 1) * 1000)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
    lines = []
    for i, c in enumerate(cues, 1):
        lines.append(str(i))
        lines.append(f"{fmt(c['start'])} --> {fmt(c['end'])}")
        lines.append(c["text"])
        lines.append("")
    Path(path).write_text("\n".join(lines), encoding="utf-8")
