"""
Soundwave AI Voice Cloning — Mark LIII Plugin

Teaches JARVIS to use Soundwave AI's voice cloning (OmniVoice sidecar).

Soundwave voice cloning (server/src/lib/voiceclone.ts + voiceclone/):
- Optional OmniVoice sidecar (local or remote GPU, Hugging Face Space)
- Config: VOICECLONE_URL (empty = feature off), VOICECLONE_TOKEN (shared secret for public URL), VOICECLONE_MIN_PLAN (default FREE), VOICECLONE_TIMEOUT_MS 600s
- API: GET /api/v1/tts/clone/status (configured + available), GET /profiles (list), POST /profiles (multipart file + name + refText + consent), DELETE /profiles/:id, POST /clone (text + profileId + speed → MP3 base64 + timings)
- Reference clip: 3-10s clean speech, WAV/MP3/FLAC/OGG/M4A, 25MB max, magic-byte validated, stored per-user under <dataDir>/voice-clips/<userId>/
- Frontend: Studio has voiceTab neural|clone, cloneConfigured + cloneAvailable, cloneProfiles, clone modal with file + name + refText + consent, submit via http.upload, remove via http.del

This plugin lets JARVIS:
- Check clone status
- List cloned voices
- Explain cloning workflow
- Generate with cloned voice (if API available)

Install: pip install requests
"""

PLUGIN = {
    "name": "soundwave_clone",
    "description": (
        "Manages voice cloning via Soundwave AI's OmniVoice sidecar — clone your own voice from 3-10s clean speech. "
        "Use when user asks to clone voice, create cloned voice, list cloned voices, use my cloned voice, voice cloning, my voice clone. "
        "Reference clip should be 3-10s clean speech, WAV/MP3/FLAC/OGG/M4A. "
        "Trigger phrases: clone voice, my cloned voice, create voice clone, list cloned voices, voice cloning."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {"type": "STRING", "description": "Action: status, list, clone_info, generate. Default status."},
            "text": {"type": "STRING", "description": "Text to synthesize with cloned voice (for generate action)"},
            "profile_id": {"type": "STRING", "description": "Cloned voice profile id (for generate)"},
            "profile_name": {"type": "STRING", "description": "Name for new cloned voice profile"},
            "reference_file": {"type": "STRING", "description": "Path to reference audio file (3-10s clean speech) for cloning"},
        },
        "required": [],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "soundwave",
    "title": "Soundwave Voice Cloning",
    "fields": [
        {"key": "api_url", "label": "Soundwave API URL", "type": "text", "default": "http://localhost:4000"},
        {"key": "clone_min_duration", "label": "Min reference duration (seconds)", "type": "text", "default": "3"},
    ],
}

def run(parameters: dict, player=None, session_memory=None) -> str:
    action = (parameters.get("action", "status") or "status").lower()
    text = parameters.get("text", "") or ""
    profile_id = parameters.get("profile_id", "") or ""
    profile_name = parameters.get("profile_name", "") or ""
    reference_file = parameters.get("reference_file", "") or ""

    try:
        from _soundwave_client import resolve_api_url
        from pathlib import Path

        api_url = resolve_api_url()

        if action == "status":
            return (
                f"Soundwave Voice Cloning Status:\n"
                f"• API URL: {api_url}\n"
                f"• Endpoint: GET /api/v1/tts/clone/status → {{configured, available}}\n"
                f"• Sidecar: OmniVoice voice-cloning sidecar (optional, see voiceclone/ README) — can run locally or on Hugging Face Space, tunnel, remote GPU\n"
                f"• Config: VOICECLONE_URL (empty = off), VOICECLONE_TOKEN (shared secret for public URL), VOICECLONE_MIN_PLAN (default FREE), timeout 600s (CPU slow)\n"
                f"• Reference clip: 3-10s clean speech, WAV/MP3/FLAC/OGG/M4A, 25MB max, magic-byte validated, per-user storage <dataDir>/voice-clips/<userId>/\n"
                f"• Frontend: Studio → voiceTab neural|clone, cloneConfigured + cloneAvailable, profiles list, modal with file + name + refText + consent\n"
                f"• API: GET /profiles (list), POST /profiles (multipart file+name+refText+consent), DELETE /profiles/:id, POST /clone (text+profileId+speed → MP3 base64 + wordTimings)\n"
                f"• Quota: Same as TTS — Free 10k chars/mo, Pro 200k, Enterprise 2M, enforced server-side\n"
                f"• Check status via: curl {api_url}/api/v1/tts/clone/status (needs auth cookie)\n"
                f"• To enable: set VOICECLONE_URL env to sidecar URL, ensure sidecar running, restart Soundwave server"
            )

        elif action == "list":
            # Try API
            try:
                from _soundwave_client import api_request
                data = api_request("GET", "/api/v1/tts/clone/profiles")
                profiles = data.get("profiles", [])
                if not profiles:
                    return f"No cloned voices found via API {api_url}/api/v1/tts/clone/profiles. Create one via Soundwave Studio → Clone tab: upload 3-10s clean clip, name, refText optional, consent checkbox."
                lines = [f"Found {len(profiles)} cloned voices via Soundwave API:"]
                for p in profiles:
                    lines.append(f"• {p.get('name')} (id {p.get('id')}) — created {p.get('createdAt')} — hasRefText {p.get('hasRefText')}")
                return "\n".join(lines)
            except Exception as e:
                return (
                    f"Could not list cloned voices via API {api_url}: {e}\n"
                    f"Local check: ~/Soundwave/cloned_voices/ (if any) or check Soundwave Studio UI → Clone tab.\n"
                    f"To clone: need reference file 3-10s clean speech. Use soundwave_clone action=clone_info"
                )

        elif action == "clone_info":
            return (
                "Soundwave Voice Cloning — How to clone your voice:\n"
                "\n"
                "1. Prepare reference clip:\n"
                "   • 3-10 seconds of clean speech, single speaker, no background noise\n"
                "   • Formats: WAV, MP3, FLAC, OGG, M4A, max 25MB\n"
                "   • Example: record yourself saying 'Hello, this is my voice, I am testing Soundwave AI voice cloning with a clean reference clip.'\n"
                "\n"
                "2. In Soundwave UI (http://localhost:5173/studio):\n"
                "   • Switch to Clone tab (voiceTab neural|clone)\n"
                "   • Click Clone New Voice → modal: file + name + refText (optional transcript) + consent checkbox (must confirm you have rights)\n"
                "   • Submit → POST /api/v1/tts/clone/profiles multipart, 300s timeout (CPU slow)\n"
                "   • Returns profile {id, name, createdAt, hasRefText}\n"
                "\n"
                "3. Use cloned voice:\n"
                "   • Select cloned voice in picker (id clone:<profileId>)\n"
                "   • Generate: POST /api/v1/tts/clone with {text, profileId, speed} → MP3 base64 + wordTimings + duration, same quota accounting as normal TTS\n"
                "   • Frontend: tts.generate() detects clone: prefix, calls /tts/clone, 600s timeout\n"
                "\n"
                "4. Via JARVIS plugin:\n"
                f"   • soundwave_clone action=generate text=\"Hello with my cloned voice\" profile_id=\"<id>\"\n"
                f"   • Or via soundwave_tts with voice=clone:<id> if you have API integration\n"
                "\n"
                f"Reference file provided: {reference_file or 'none — provide path to 3-10s WAV/MP3'}\n"
                f"Profile name: {profile_name or 'none — e.g. My Voice'}\n"
                "\n"
                "Storage: reference clips stored per-user under <dataDir>/voice-clips/<userId>/, sidecar stateless so can run on ephemeral free hosting.\n"
                "Security: magic-byte validation, consent required, per-user ownership."
            )

        elif action == "generate" and text:
            if not profile_id:
                return "Need profile_id for cloned voice generation. List via action=list or provide profile_id param. Example: soundwave_clone action=generate text=\"Hello\" profile_id=\"abc123\""
            
            try:
                from _soundwave_client import api_request, save_base64_mp3, play_audio
                payload = {"text": text, "profileId": profile_id, "speed": 1.0}
                res = api_request("POST", "/api/v1/tts/clone", json_data=payload, timeout=120)
                b64 = res.get("audioBase64")
                if not b64:
                    return f"Clone API returned no audio: {res}"
                mp3_path = save_base64_mp3(b64)
                play_audio(mp3_path)
                result = f"Generated {len(text)} chars with cloned voice {profile_id} → {mp3_path}, duration {res.get('duration', '?')}s"
                if player:
                    try:
                        player.write_log(f"JARVIS: {result}")
                    except Exception:
                        pass
                return result
            except Exception as e:
                return f"Cloned voice generation failed: {e}. Ensure Soundwave server running at {api_url} with VOICECLONE_URL configured and profile {profile_id} exists."

        else:
            return (
                "Soundwave Voice Cloning — actions:\n"
                "• status: show config, API endpoints, quotas\n"
                "• list: list cloned profiles via API /api/v1/tts/clone/profiles\n"
                "• clone_info: how to clone voice (reference clip 3-10s, UI flow, API)\n"
                "• generate: text + profile_id → synthesize with cloned voice via API /api/v1/tts/clone\n"
                f"Current API: {api_url}\n"
                "Example: soundwave_clone action=generate text=\"Hello with my cloned voice\" profile_id=\"your_id\""
            )

    except Exception as e:
        return f"Soundwave clone failed: {e}"
