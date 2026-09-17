"""
Soundwave AI TTS — Mark LIII Plugin

Teaches JARVIS to use Soundwave AI's text-to-speech engine.

Soundwave uses Microsoft Neural voices via free, key-less Edge TTS (same as
Mark LIII's Python edge-tts). 6 voices, 24kHz mono MP3, word timings, no API key.

This plugin lets JARVIS:
- Generate speech with any Soundwave voice (Jenny, Ana, Sonia, Christopher, Guy, Ryan)
- Control speed (0.5-2.0), pitch (-50..50), volume (0-100)
- Save MP3 to ~/Soundwave/tts/ and auto-play
- Optionally use Soundwave API for cloud synthesis with quota

Voice mapping mirrors Soundwave:
- en-US-JennyNeural — Warm, friendly, versatile (narration, YouTube)
- en-US-AnaNeural — Young, energetic (TikTok, Reels, ads)
- en-GB-SoniaNeural — Elegant British (corporate, audiobook)
- en-US-ChristopherNeural — Deep, authoritative (trailer, podcast)
- en-US-GuyNeural — Casual conversational (vlog, tutorial)
- en-GB-RyanNeural — British male clear (news, education)

Install: pip install edge-tts requests
Drop in Mark-LIII/plugins/ (no leading underscore), restart JARVIS.

Usage examples (voice commands):
- "Generate speech with Jenny: Hello world, welcome to Soundwave"
- "Say this with Guy voice: The quick brown fox"
- "Create TTS with Sonia, speed 1.2: Welcome to our presentation"
- "Make an audio clip of this text: ..."
"""

from pathlib import Path

PLUGIN = {
    "name": "soundwave_tts",
    "description": (
        "Generates studio-quality speech using Soundwave AI's Microsoft Neural voices (Edge TTS, free, no API key). "
        "Use when user asks to generate speech, create voiceover, say something with a specific voice, make audio clip, TTS, text to speech. "
        "Supports 6 voices: Jenny (warm friendly), Ana (young energetic), Sonia (British elegant), Christopher (deep authoritative), Guy (casual), Ryan (British clear). "
        "Trigger phrases: generate speech, create voiceover, say with X voice, TTS, text to speech, make audio. "
        "Do NOT use for system TTS (that's Gemini Live) — this is for creating files via Soundwave engine."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "text": {"type": "STRING", "description": "Text to synthesize (max 5000 chars, clean, no SSML needed)"},
            "voice": {"type": "STRING", "description": "Voice id or display name: Jenny, Ana, Sonia, Christopher, Guy, Ryan OR full id like en-US-JennyNeural. Default Jenny."},
            "speed": {"type": "NUMBER", "description": "Speed multiplier 0.5-2.0, default 1.0"},
            "pitch": {"type": "NUMBER", "description": "Pitch -50 to +50, default 0"},
            "volume": {"type": "NUMBER", "description": "Volume 0-100, default 100"},
            "play": {"type": "BOOLEAN", "description": "Whether to auto-play the audio after generation, default true"},
        },
        "required": ["text"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "soundwave",
    "title": "Soundwave AI Settings",
    "fields": [
        {"key": "api_url", "label": "Soundwave API URL (optional, for cloud)", "type": "text", "default": "http://localhost:4000"},
        {"key": "api_key", "label": "Soundwave API Key (optional, Enterprise)", "type": "password", "required": False},
        {"key": "auto_play", "label": "Auto-play generated audio", "type": "checkbox", "default": True},
        {"key": "save_dir", "label": "Save directory", "type": "text", "default": "~/Soundwave/tts"},
    ],
}

def run(parameters: dict, player=None, session_memory=None) -> str:
    text = parameters.get("text", "").strip()
    voice_input = parameters.get("voice", "Jenny").strip() or "Jenny"
    speed = float(parameters.get("speed", 1.0) or 1.0)
    pitch = int(parameters.get("pitch", 0) or 0)
    volume = int(parameters.get("volume", 100) or 100)
    play = parameters.get("play", True)
    if isinstance(play, str):
        play = play.lower() not in ("false", "no", "0")

    if not text:
        return "Sir, I need text to synthesize. Tell me what you want me to say."

    # Clamp
    speed = max(0.5, min(2.0, speed))
    pitch = max(-50, min(50, pitch))
    volume = max(0, min(100, volume))

    try:
        from _soundwave_client import get_voice, synthesize_edge_tts, play_audio, SOUNDWAVE_VOICES

        # Resolve voice
        v = get_voice(voice_input)
        voice_id = v["id"] if v else "en-US-JennyNeural"
        display = v["displayName"] if v else voice_id

        # Synthesize via direct Edge TTS (no server needed, same engine Soundwave uses)
        output_path = synthesize_edge_tts(text, voice=voice_id, speed=speed, pitch=pitch, volume=volume)

        if play:
            play_audio(output_path)

        result_text = f"Generated {len(text)} characters with {display} ({voice_id}) at {speed}x speed. Saved to {output_path}."

        if player:
            try:
                player.write_log(f"JARVIS: {result_text}")
                player.write_log(f"📤 soundwave_tts → {display}: {text[:60]}... → {Path(output_path).name}")
            except Exception:
                pass

        return result_text

    except Exception as e:
        err = f"Soundwave TTS failed: {e}. Ensure edge-tts installed: pip install edge-tts"
        if player:
            try:
                player.write_log(f"JARVIS: {err}")
            except Exception:
                pass
        return err
