"""
Soundwave AI Voice Library — Mark LIII Plugin

Teaches JARVIS to list, describe, and preview Soundwave AI's 6 Microsoft Neural voices.

Soundwave voices (same as server/src/lib/voices.ts):
- Jenny, Ana, Sonia, Christopher, Guy, Ryan
- Each has gender, accent, style, sampleUrl (/voice-samples/<id>.mp3)

This plugin lets JARVIS:
- List all voices with descriptions
- Describe a specific voice
- Play sample (if Soundwave server running or via direct synthesis)
- Recommend voice for use case (e.g. TikTok → Ana, corporate → Sonia)

Install: pip install edge-tts requests
"""

PLUGIN = {
    "name": "soundwave_voices",
    "description": (
        "Lists and describes Soundwave AI's voice library — 6 Microsoft Neural voices (Jenny, Ana, Sonia, Christopher, Guy, Ryan). "
        "Use when user asks about voices, what voices available, which voice to use, voice library, describe Jenny, recommend voice for TikTok/corporate/etc. "
        "Trigger phrases: list voices, voice library, what voices, describe voice, recommend voice, which voice for, voice samples."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {"type": "STRING", "description": "Action: list, describe, recommend, sample. Default list."},
            "voice": {"type": "STRING", "description": "Voice name or id to describe/sample: Jenny, Ana, Sonia, Christopher, Guy, Ryan"},
            "use_case": {"type": "STRING", "description": "Use case for recommendation: tiktok, youtube, corporate, audiobook, podcast, trailer, education, ads, etc."},
        },
        "required": [],
    },
}

def run(parameters: dict, player=None, session_memory=None) -> str:
    action = (parameters.get("action", "list") or "list").lower().strip()
    voice_q = (parameters.get("voice", "") or "").strip()
    use_case = (parameters.get("use_case", "") or "").strip().lower()

    try:
        from _soundwave_client import SOUNDWAVE_VOICES, get_voice, synthesize_edge_tts, play_audio

        if action in ("describe", "sample") and voice_q:
            v = get_voice(voice_q)
            if not v:
                return f"Voice '{voice_q}' not found. Available: {', '.join([x['displayName'] for x in SOUNDWAVE_VOICES])}"
            
            if action == "sample":
                try:
                    sample_text = "Welcome to Soundwave AI. This is a sample of my voice. I can help you create professional audio content with natural-sounding speech."
                    path = synthesize_edge_tts(sample_text, voice=v["id"])
                    play_audio(path)
                    result = f"Playing sample of {v['displayName']} ({v['id']}) — {v['style']}. Saved to {path}."
                except Exception as e:
                    result = f"{v['displayName']} ({v['id']}): {v['gender']}, {v['accent']}, {v['style']}. Sample failed: {e}"
            else:
                result = f"**{v['displayName']}** ({v['id']}) — {v['gender']}, {v['accent']}\nStyle: {v['style']}\nSample: /voice-samples/{v['id']}.mp3 (in Soundwave) or ask me to play sample."

            if player:
                try:
                    player.write_log(f"JARVIS: {result}")
                except Exception:
                    pass
            return result

        if action == "recommend" or use_case:
            # Simple recommendation logic mirroring Soundwave frontend
            uc = use_case or voice_q
            rec = None
            if any(k in uc for k in ("tiktok", "reel", "short", "energetic", "young", "ad")):
                rec = get_voice("Ana")
            elif any(k in uc for k in ("corporate", "business", "professional", "elegant", "british female")):
                rec = get_voice("Sonia")
            elif any(k in uc for k in ("trailer", "deep", "authoritative", "movie", "podcast")):
                rec = get_voice("Christopher")
            elif any(k in uc for k in ("vlog", "casual", "friendly", "tutorial", "conversational")):
                rec = get_voice("Guy")
            elif any(k in uc for k in ("news", "education", "formal", "british male")):
                rec = get_voice("Ryan")
            else:
                rec = get_voice("Jenny")  # default versatile

            if rec:
                result = f"For '{uc}' I recommend **{rec['displayName']}** ({rec['id']}) — {rec['style']}. Want me to generate a sample?"
                if player:
                    try:
                        player.write_log(f"JARVIS: {result}")
                    except Exception:
                        pass
                return result

        # Default list
        lines = ["Soundwave AI Voice Library — 6 Microsoft Neural voices (Edge TTS, 24kHz mono MP3, free, no API key):", ""]
        for v in SOUNDWAVE_VOICES:
            lines.append(f"• {v['displayName']} ({v['id']}) — {v['gender']}, {v['accent']}: {v['style']}")
        lines.append("")
        lines.append("Ask 'describe Jenny' or 'play sample of Guy' or 'recommend voice for TikTok'.")
        result = "\n".join(lines)

        if player:
            try:
                player.write_log(f"JARVIS: Listed {len(SOUNDWAVE_VOICES)} Soundwave voices")
            except Exception:
                pass

        return result

    except Exception as e:
        return f"Soundwave voices failed: {e}"
