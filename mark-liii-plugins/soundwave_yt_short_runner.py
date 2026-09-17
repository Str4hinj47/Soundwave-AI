"""
Soundwave YT Short Runner — Auto-start local site + full TikTok/Shorts autopilot
For arena/01a08864-soundwave-ai single-user edition (no login, ENTERPRISE)

User says: "generate me a yt short"
JARVIS must:
1. Check if site running (localhost:5173 frontend + localhost:4000 backend)
2. If not running, open each in separate PowerShell: npm run dev in server and frontend
3. Then do all steps: generate short story script, paste into #studio-text, choose voice, generate voice, TikTok style subtitles + auto-generate, find no-copyright minecraft/subway surfers/roblox gameplay, paste YouTube link via existing Chrome, export Portrait 9:16 720p MP4 H.264 Medium 60fps End-with-voice ON, download, say done and notify

Paths from user:
C:/Users/Strahinja/Downloads/Soundwave-AI-arena-01a08864-soundwave-ai/server
C:/Users/Strahinja/Downloads/Soundwave-AI-arena-01a08864-soundwave-ai/frontend

Also supports double-nested:
C:/Users/Strahinja/Downloads/Soundwave-AI-arena-01a08864-soundwave-ai/Soundwave-AI-arena-01a08864-soundwave-ai/server

And relative fallback: ./server, ./frontend, ../frontend etc.
"""

PLUGIN = {
    "name": "soundwave_yt_short_runner",
    "description": "YT Shorts autopilot — checks if Soundwave site running (localhost:5173 + 4000), if not starts server and frontend in separate PowerShell windows via npm run dev, then full workflow: generate short story script, choose voice, generate voice, TikTok style subtitles + auto-generate, find no-copyright minecraft/subway surfers/roblox gameplay, add background via YouTube paste existing Chrome, export Portrait 9:16 720p MP4 H.264 Medium 60fps End-with-voice ON, download, notify done. Trigger: 'generate me a yt short' or 'make me a youtube short'.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: generate_yt_short, check_site, start_site, ensure_site, guide, generate_script, add_text, choose_voice, generate_voice, tiktok_style, auto_generate_subtitles, find_gameplay, add_background, export_default, download_video, full_workflow",
                "enum": ["generate_yt_short", "check_site", "start_site", "ensure_site", "guide", "generate_script", "add_text", "choose_voice", "generate_voice", "tiktok_style", "auto_generate_subtitles", "find_gameplay", "add_background", "export_default", "download_video", "full_workflow", "make_short"]
            },
            "topic": {
                "type": "STRING",
                "description": "Topic for short story, e.g., 'a cat who learns to code', 'motivational story about never giving up', 'scary story'. Default random motivational."
            },
            "voice": {
                "type": "STRING",
                "description": "Voice: Jenny, Ana, Sonia, Christopher, Guy, Ryan. Default Jenny (best for TikTok)"
            },
            "background_type": {
                "type": "STRING",
                "description": "Gameplay background: minecraft, subway_surfers, roblox, minecraft_parkour, gta, random. Default random (picks no-copyright)",
                "enum": ["minecraft", "subway_surfers", "roblox", "minecraft_parkour", "gta", "random"]
            },
            "youtube_url": {
                "type": "STRING",
                "description": "Optional YouTube URL for background. If not provided, will search for no-copyright gameplay"
            },
            "server_path": {
                "type": "STRING",
                "description": "Custom server path, e.g., C:\\Users\\Strahinja\\Downloads\\Soundwave-AI-arena-01a08864-soundwave-ai\\server"
            },
            "frontend_path": {
                "type": "STRING",
                "description": "Custom frontend path"
            },
            "text": {
                "type": "STRING",
                "description": "Direct text to use instead of generating script"
            }
        },
        "required": ["action"]
    }
}

# --- Default paths from user ---
DEFAULT_PATHS = [
    # User provided single
    (r"C:\Users\Strahinja\Downloads\Soundwave-AI-arena-01a08864-soundwave-ai\server",
     r"C:\Users\Strahinja\Downloads\Soundwave-AI-arena-01a08864-soundwave-ai\frontend"),
    # Double nested (like arena/01a0a795 case)
    (r"C:\Users\Strahinja\Downloads\Soundwave-AI-arena-01a08864-soundwave-ai\Soundwave-AI-arena-01a08864-soundwave-ai\server",
     r"C:\Users\Strahinja\Downloads\Soundwave-AI-arena-01a08864-soundwave-ai\Soundwave-AI-arena-01a08864-soundwave-ai\frontend"),
    # Also arena/01a0a795 double nested (user has both)
    (r"C:\Users\Strahinja\Downloads\Soundwave-AI-arena-01a0a795-soundwave-ai\Soundwave-AI-arena-01a0a795-soundwave-ai\server",
     r"C:\Users\Strahinja\Downloads\Soundwave-AI-arena-01a0a795-soundwave-ai\Soundwave-AI-arena-01a0a795-soundwave-ai\frontend"),
    # Relative fallbacks
    (r".\server", r".\frontend"),
    (r"..\server", r"..\frontend"),
    (r"server", r"frontend"),
    (r"./server", r"./frontend"),
]

NO_COPYRIGHT_QUERIES = {
    "minecraft": "minecraft parkour no copyright free to use background 1 hour",
    "subway_surfers": "subway surfers gameplay no copyright background video 1 hour",
    "roblox": "roblox obby gameplay no copyright free to use background",
    "minecraft_parkour": "minecraft parkour no copyright 1080p free background",
    "gta": "gta 5 gameplay no copyright free use background",
    "random": "no copyright background gameplay minecraft subway surfers free to use"
}

DEFAULT_EXPORT = {
    "aspect": "Portrait 9:16 Shorts TikTok",
    "resolution": "720p (720×1280)",
    "format": "MP4 (H.264)",
    "quality": "Medium",
    "fps": "60 fps",
    "end_with_voice": "ON",
    "estimated": "~1.8 MB"
}

def _is_port_open(host, port, timeout=1.5):
    import socket
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except:
        return False

def _check_site():
    import socket
    frontend = _is_port_open("127.0.0.1", 5173, 1.5)
    backend = _is_port_open("127.0.0.1", 4000, 1.5)
    # Also try localhost
    if not frontend:
        frontend = _is_port_open("localhost", 5173, 1.5)
    if not backend:
        backend = _is_port_open("localhost", 4000, 1.5)
    both = frontend and backend
    return both, frontend, backend

def _find_valid_paths(custom_server=None, custom_frontend=None):
    import os
    # If custom provided, try those first
    if custom_server and custom_frontend:
        if os.path.isdir(custom_server) and os.path.isdir(custom_frontend):
            return custom_server, custom_frontend
    # Try defaults
    for s, f in DEFAULT_PATHS:
        # Expand and check existence
        s_exp = os.path.expandvars(os.path.expanduser(s))
        f_exp = os.path.expandvars(os.path.expanduser(f))
        # Also try absolute from current working dir
        if os.path.isdir(s_exp) and os.path.isdir(f_exp):
            return s_exp, f_exp
        # Try relative to this file's location (mark-liii-plugins -> ../server)
        # For arena zip, Mark-LIV is sibling to server/frontend? No, server/frontend are at root, Mark-LIV at root
        # So try ../server
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.isfile(__file__) else os.getcwd()
        s2 = os.path.join(base, "server")
        f2 = os.path.join(base, "frontend")
        if os.path.isdir(s2) and os.path.isdir(f2):
            return s2, f2
    # Fallback to user provided defaults even if not exist (will error in PowerShell but we try)
    return DEFAULT_PATHS[0]

def _start_site_powershell(server_path, frontend_path):
    import subprocess, platform, os
    system = platform.system()
    started = []
    errors = []

    # Normalize paths
    server_path = os.path.abspath(server_path) if not os.path.isabs(server_path) or server_path.startswith(".") else server_path
    frontend_path = os.path.abspath(frontend_path) if not os.path.isabs(frontend_path) or frontend_path.startswith(".") else frontend_path

    # On Windows, open separate PowerShell windows
    if system == "Windows":
        try:
            # Server
            # Use Start-Process to open new window
            # We use powershell -NoExit -Command "cd 'path'; npm run dev"
            # Escape single quotes in path by doubling?
            sp = server_path.replace("'", "''")
            fp = frontend_path.replace("'", "''")
            # Command to start server
            cmd_server = f"Start-Process powershell -ArgumentList '-NoExit','-Command',\"cd '{sp}'; Write-Host 'Starting Soundwave server at {sp}...'; npm run dev\""
            subprocess.Popen(["powershell", "-Command", cmd_server], creationflags=subprocess.CREATE_NEW_CONSOLE if hasattr(subprocess, 'CREATE_NEW_CONSOLE') else 0)
            started.append(f"Server PowerShell started: {server_path}")

            # Frontend - small delay to avoid race
            import time
            time.sleep(0.5)
            cmd_front = f"Start-Process powershell -ArgumentList '-NoExit','-Command',\"cd '{fp}'; Write-Host 'Starting Soundwave frontend at {fp}...'; npm run dev\""
            subprocess.Popen(["powershell", "-Command", cmd_front], creationflags=subprocess.CREATE_NEW_CONSOLE if hasattr(subprocess, 'CREATE_NEW_CONSOLE') else 0)
            started.append(f"Frontend PowerShell started: {frontend_path}")

        except Exception as e:
            errors.append(f"Failed to start via PowerShell: {e}")
            # Fallback try direct
            try:
                subprocess.Popen(["powershell", "-NoExit", "-Command", f"cd '{server_path}'; npm run dev"], creationflags=subprocess.CREATE_NEW_CONSOLE)
                started.append(f"Fallback server started: {server_path}")
            except Exception as e2:
                errors.append(str(e2))
    else:
        # macOS/Linux - try gnome-terminal, xterm, or background
        try:
            subprocess.Popen(f"cd '{server_path}' && npm run dev", shell=True)
            started.append(f"Server started (linux): {server_path}")
            subprocess.Popen(f"cd '{frontend_path}' && npm run dev", shell=True)
            started.append(f"Frontend started (linux): {frontend_path}")
        except Exception as e:
            errors.append(str(e))

    return started, errors

def _generate_script(topic):
    topic = (topic or "motivational story about never giving up").strip()
    templates = [
        f"Did you know {topic}? Here's a short story. Once upon a time, there was someone who never gave up. They faced challenges every day, but they kept going. Because they knew, success is not about being perfect, it's about being consistent. If you're watching this, this is your sign to keep pushing. Your time is coming.",
        f"Let me tell you a story about {topic}. A small step every day leads to big results. You don't need to be the best, you just need to start. The hardest part is beginning, but once you start, momentum carries you. So start today, not tomorrow. You've got this.",
        f"This is a story about {topic}. Imagine waking up and deciding today is the day you change. No more excuses. No more waiting. You take action, even if it's small. And those small actions, they compound. One day you look back and realize, you became the person you wanted to be.",
        f"{topic} — listen to this. The person who wins is not the strongest, it's the one who doesn't quit. Every failure is a lesson. Every setback is a setup for a comeback. So if you're struggling right now, keep going. Your breakthrough is closer than you think.",
        f"Here's a short story about {topic}. There was a kid who had a dream, but everyone said it was impossible. They laughed. They doubted. But the kid kept working in silence. Years later, they didn't just achieve the dream, they exceeded it. Let that be you.",
    ]
    idx = sum(ord(c) for c in topic) % len(templates)
    script = templates[idx]
    if len(script) > 450:
        script = script[:450].rsplit('.', 1)[0] + "."
    return script

def _guide():
    return f"""
# YT Short Runner — Full Autopilot (generate me a yt short)

**Trigger phrases:** "generate me a yt short", "make me a youtube short", "create yt short", "generate_yt_short"

**What JARVIS does when you say "generate me a yt short":**
1. **Check if site running:** tries 127.0.0.1:5173 (frontend) and :4000 (backend) via socket
2. **If NOT running:** opens 2 separate PowerShell windows:
   - Window 1: cd 'C:\\Users\\Strahinja\\Downloads\\Soundwave-AI-arena-01a08864-soundwave-ai\\server' ; npm run dev
   - Window 2: cd '...\\frontend' ; npm run dev
   - Also tries double-nested path: ...\\Soundwave-AI-arena-01a08864-soundwave-ai\\Soundwave-AI-arena-01a08864-soundwave-ai\\server
   - Waits 8-15 sec for site to boot
3. **Then full workflow:**
   - Generate short story script (topic from your voice, e.g., "motivational" or "scary story")
   - Add text to #studio-text at http://localhost:5173/studio (uses existing Chrome via window_manager_pro focus Chrome, NOT new Chromium without login)
   - Choose voice Jenny (best for TikTok)
   - Generate voice (click Generate Speech, wait Audio ready)
   - Customize subtitles: TikTok Style (Montserrat 800 white #FFFFFF bg #8B5CF6 purple 90% 14px 10px radius center middle 56px scale) — your screenshot style
   - Auto-generate subtitles (click Auto-generate)
   - Find no-copyright gameplay: web_search "minecraft parkour no copyright free to use" / "subway surfers gameplay no copyright" / "roblox obby no copyright"
   - Add background via YouTube paste existing_chrome: focus Chrome, ctrl+l, type http://localhost:5173/studio/video, wait 4s, click input[aria-label="YouTube video URL"], type URL or ctrl+v, enter, wait Badge YouTube
   - Export with YOUR default (from screenshot):
     * Video style Portrait 9:16 Shorts TikTok
     * End video with the voice ON (fitToVoice=true)
     * Resolution 720p (720×1280) portrait
     * Format MP4 H.264
     * Quality Medium
     * Frame rate 60 fps
     * ~1.8 MB
     * Click Export Video → wait Download Video button
   - Download video
   - Say DONE and notify you via plyer notification + log

**Default export settings (automatic? You asked if needs to choose):**
- In single-user edition, defaults are: Landscape 16:9, 720p, MP4, Medium, 30fps, fitToVoice ON? But your screenshot shows Portrait 9:16, 720p, MP4, Medium, 60fps, End-with-voice ON.
- So JARVIS **must explicitly set** Portrait, 720p, MP4, Medium, 60fps, End-with-voice ON to match your desired default, because auto-loaded may be Landscape 30fps.
- Plugin does: clicks Portrait button title="Portrait", ensures toggle checked, selects 720p, MP4, Medium, 60fps.

**Selectors:**
- studio-text: #studio-text
- Generate Speech: button:has-text("Generate Speech")
- Voice: text=Jenny
- Subtitles preset: placeholder "Apply a preset…" → TikTok Style
- Auto-generate: button:has-text("Auto-generate")
- YouTube input: [aria-label="YouTube video URL"]
- Import: button:has-text("Import")
- Video style: [aria-label="Video style"] → button[title="Portrait"]
- End with voice toggle: [label="End video with the voice"]
- Resolution: [aria-label="Resolution"] → 720p
- Format: [aria-label="Format"] → mp4
- Quality: [aria-label="Quality"] → medium
- FPS: [aria-label="Frame rate"] → 60
- Export: button:has-text("Export Video")
- Download: button:has-text("Download Video")

**Paths JARVIS will try (in order):**
1. C:\\Users\\Strahinja\\Downloads\\Soundwave-AI-arena-01a08864-soundwave-ai\\server + frontend (your provided)
2. C:\\Users\\Strahinja\\Downloads\\Soundwave-AI-arena-01a08864-soundwave-ai\\Soundwave-AI-arena-01a08864-soundwave-ai\\server + frontend (double nested like arena/01a0a795)
3. C:\\Users\\Strahinja\\Downloads\\Soundwave-AI-arena-01a0a795-soundwave-ai\\Soundwave-AI-arena-01a0a795-soundwave-ai\\server + frontend (your other zip)
4. Relative ./server ./frontend, ../server etc.

**To manually check if site running:**
- Open http://localhost:5173 → should show Soundwave AI Studio
- Open http://localhost:4000/api/v1/voices → should return JSON (if backend running)

**If site not running, JARVIS runs:**
```powershell
Start-Process powershell -ArgumentList '-NoExit','-Command',\"cd 'C:\\Users\\Strahinja\\Downloads\\Soundwave-AI-arena-01a08864-soundwave-ai\\server'; npm run dev\"
Start-Process powershell -ArgumentList '-NoExit','-Command',\"cd 'C:\\Users\\Strahinja\\Downloads\\Soundwave-AI-arena-01a08864-soundwave-ai\\frontend'; npm run dev\"
```

Two separate PowerShell windows appear, each running npm run dev. Wait 10-15 sec for Vite + Express to boot.

**After download, JARVIS says DONE and notifies:**
- Uses plyer notification if available: "YT Short Ready — Downloaded to Downloads"
- Writes log: "DONE — YT Short exported Portrait 720p 60fps TikTok style with minecraft gameplay"
- Speaks: "Done, Sir. Your YouTube Short is ready in Downloads, Portrait 720p 60fps with TikTok style subtitles and no-copyright gameplay background."
"""

def run(parameters, player=None, session_memory=None):
    def log(msg):
        if player and hasattr(player, 'write_log'):
            try:
                player.write_log(msg)
            except:
                pass

    action = (parameters.get("action") or "generate_yt_short").strip().lower()
    topic = parameters.get("topic") or "motivational story about never giving up"
    voice = parameters.get("voice") or "Jenny"
    bg_type = parameters.get("background_type") or "random"
    yt_url = parameters.get("youtube_url") or ""
    custom_server = parameters.get("server_path") or ""
    custom_front = parameters.get("frontend_path") or ""
    text = parameters.get("text") or ""

    log(f"YT Short Runner action={action} topic={topic} voice={voice} bg={bg_type}")

    if action == "guide":
        return _guide()

    if action == "check_site":
        both, front, back = _check_site()
        status = f"Site check: Frontend (5173) {'RUNNING' if front else 'NOT RUNNING'}, Backend (4000) {'RUNNING' if back else 'NOT RUNNING'}, Both {'YES' if both else 'NO'}"
        if both:
            return f"{status}\nSite is running at http://localhost:5173 and http://localhost:4000/api/v1/voices — ready to generate YT Short."
        else:
            return f"{status}\nSite NOT fully running. Use action=start_site or ensure_site to auto-start in separate PowerShell windows:\nPaths: {custom_server or 'auto-detect'} and {custom_front or 'auto-detect'}\nDefault: C:\\Users\\Strahinja\\Downloads\\Soundwave-AI-arena-01a08864-soundwave-ai\\server + frontend"

    if action == "start_site":
        import os
        s_path, f_path = _find_valid_paths(custom_server, custom_front)
        log(f"Starting site server={s_path} frontend={f_path}")
        started, errors = _start_site_powershell(s_path, f_path)
        msg = "Starting Soundwave site in separate PowerShell windows:\n"
        for s in started:
            msg += f"- {s}\n"
        if errors:
            msg += "Errors:\n" + "\n".join(errors) + "\n"
        msg += f"\nPaths used:\nServer: {s_path}\nFrontend: {f_path}\n\nWait 10-15 seconds for Vite (frontend) and Express (backend) to boot, then check http://localhost:5173 and http://localhost:4000\n\nTwo PowerShell windows should have appeared — do NOT close them, they run npm run dev.\n\nNext: action=check_site to verify, then generate_yt_short"
        return msg

    if action == "ensure_site":
        both, front, back = _check_site()
        if both:
            return f"Site already running: Frontend 5173 {'OK' if front else 'NO'}, Backend 4000 {'OK' if back else 'NO'} — no need to start."
        import os
        s_path, f_path = _find_valid_paths(custom_server, custom_front)
        started, errors = _start_site_powershell(s_path, f_path)
        msg = f"Site not fully running (Frontend 5173 {'OK' if front else 'NOT'}, Backend 4000 {'OK' if back else 'NOT'}), starting now...\n"
        for s in started:
            msg += f"- {s}\n"
        if errors:
            msg += "Errors: " + "; ".join(errors) + "\n"
        msg += "\nWait 15 sec then action=check_site. Two PowerShell windows opened."
        return msg

    if action in ("generate_yt_short", "make_short", "full_workflow"):
        # This is the main entry: ensure site running, then full workflow
        both, front, back = _check_site()
        site_msg = ""
        if not both:
            import os
            s_path, f_path = _find_valid_paths(custom_server, custom_front)
            started, errors = _start_site_powershell(s_path, f_path)
            site_msg = f"Site was not running (Frontend 5173 {'OK' if front else 'NOT'}, Backend 4000 {'OK' if back else 'NOT'}), started now in separate PowerShell windows:\n"
            for s in started:
                site_msg += f"- {s}\n"
            site_msg += "\nWaiting 15 seconds for boot...\n"
            # Wait
            import time
            time.sleep(15)
            both2, front2, back2 = _check_site()
            site_msg += f"After wait: Frontend {'RUNNING' if front2 else 'STILL NOT'}, Backend {'RUNNING' if back2 else 'STILL NOT'}\nIf still not running, check PowerShell windows for npm errors, and ensure npm install was done.\n\n"
        else:
            site_msg = "Site already running (5173 + 4000) — skipping start, going straight to workflow.\n\n"

        # Generate script
        actual_text = text or _generate_script(topic)

        # Find gameplay query
        query = NO_COPYRIGHT_QUERIES.get(bg_type, NO_COPYRIGHT_QUERIES["random"])

        # Build full workflow instructions for JARVIS to execute via other plugins + browser automation
        workflow = f"""{site_msg}=== YT SHORT AUTOPILOT STARTED ===
Topic: {topic}
Voice: {voice}
Background: {bg_type}
Script ({len(actual_text)} chars):
\"{actual_text}\"

Background search query: "{query}"
YouTube URL provided: {yt_url or 'None — will search'}

=== STEPS JARVIS MUST DO NOW (existing Chrome method to keep login) ===

**IMPORTANT: Use existing Chrome (window_manager_pro focus Chrome), NOT browser_control new Chromium (no login).**

Step 1 — Add text to Studio:
- window_manager_pro action=focus name=Chrome
- computer_control hotkey=ctrl+l, type_text=http://localhost:5173/studio, press=enter, wait 4s
- accessibility_master find id=studio-text or click textarea
- computer_control type_text="{actual_text[:80]}..." (full text below) OR browser_master fill selector #studio-text with full text
Full text: "{actual_text}"

Step 2 — Choose voice {voice}:
- Click voice card {voice} via accessibility_master find text={voice} or mouse_master_pro click

Step 3 — Generate voice:
- Click button:has-text("Generate Speech") → wait 30-60s for Audio ready toast
- Playwright: await page.click('button:has-text("Generate Speech")'), wait_for_selector text=Audio ready

Step 4 — TikTok style subtitles:
- Navigate http://localhost:5173/studio/subtitles (focus Chrome, ctrl+l, type url, enter, wait 4s)
- Select TikTok Style: click Select placeholder "Apply a preset…" then click div:has-text("TikTok Style") id=tiktok (Montserrat 800 white #FFFFFF bg #8B5CF6 90% 14px 10px radius middle center 56px scale)
- Verify purple bg #8B5CF6 preview

Step 5 — Auto-generate subtitles:
- Click button:has-text("Auto-generate") → toast "Subtitles generated X cues"

Step 6 — Find no-copyright gameplay background:
- web_search action=search query="{query}" (or {bg_type} variant)
- Look for titles containing "no copyright", "free to use", "background video", "1 hour"
- Pick URL, e.g., https://youtube.com/watch?v=... (prefer Creative Commons, no music)
- If youtube_url provided: use {yt_url}

Step 7 — Add background video:
- Focus Chrome, ctrl+l, type http://localhost:5173/studio/video, enter, wait 4s
- Click input[aria-label="YouTube video URL"]
- Type URL: {yt_url or 'found URL from search'} or ctrl+v if already in clipboard
- Press enter or click button:has-text("Import")
- Wait ProgressBar "Downloading from YouTube — long videos can take a minute." → Badge YouTube violet

Step 8 — Export with YOUR default (Portrait TikTok):
- Video style: click button[title="Portrait"] (9:16 Shorts TikTok) — NOT Landscape
- End video with voice toggle: ensure checked (label "End video with the voice" ON, fitToVoice=true)
- Resolution: select 720p (720×1280) via [aria-label="Resolution"]
- Format: MP4 H.264 via [aria-label="Format"]
- Quality: Medium via [aria-label="Quality"]
- Frame rate: 60 fps via [aria-label="Frame rate"]
- Estimated ~1.8 MB (your screenshot)
- Click Export Video (Clapperboard icon) — disabled if !audioBlob or cues.length==0
- Wait ProgressBar export progress + % → Download Video button appears

Step 9 — Download and DONE notification:
- Click button:has-text("Download Video") → saves to Downloads
- Then notify:
  - plyer notification: "YT Short Ready — Portrait 720p 60fps TikTok style with {bg_type} gameplay"
  - Speak: "Done, Sir. Your YouTube Short is ready in Downloads, Portrait 720p 60fps with TikTok style subtitles and no-copyright {bg_type} gameplay background. Topic: {topic}"
  - Log: DONE — YT Short exported

=== PLAYWRIGHT EXACT CODE FOR FULL WORKFLOW ===
```python
# Ensure site running already handled above
await page.goto("http://localhost:5173/studio")
await page.fill('#studio-text', '''{actual_text}''')
await page.click('text={voice}')
await page.click('button:has-text("Generate Speech")')
await page.wait_for_selector('text=Audio ready', timeout=60000)
await page.goto("http://localhost:5173/studio/subtitles")
await page.click('text=Apply a preset')
await page.click('text=TikTok Style')
await page.click('button:has-text("Auto-generate")')
# Find gameplay via web_search, then:
await page.goto("http://localhost:5173/studio/video")
await page.wait_for_selector('[aria-label="YouTube video URL"]', timeout=10000)
await page.fill('[aria-label="YouTube video URL"]', '{yt_url or "https://youtube.com/watch?v=..."}')
await page.click('button:has-text("Import")')
await page.wait_for_selector('text=YouTube', timeout=120000)
await page.click('button[title="Portrait"]')
# Ensure toggle ON
toggle = page.locator('text=End video with the voice')
if not await toggle.is_checked(): await toggle.click()
await page.select_option('[aria-label="Resolution"]', '720p')
await page.select_option('[aria-label="Format"]', 'mp4')
await page.select_option('[aria-label="Quality"]', 'medium')
await page.select_option('[aria-label="Frame rate"]', '60')
await page.click('button:has-text("Export Video")')
await page.wait_for_selector('button:has-text("Download Video")', timeout=300000)
await page.click('button:has-text("Download Video")')
```

=== END — After download, say DONE and notify ===
"""
        return workflow

    # Other actions delegate to simple edition logic for backwards compat
    if action == "generate_script":
        script = _generate_script(topic)
        return f"Script for '{topic}': \"{script}\" — use add_text to paste into #studio-text"

    if action == "add_text":
        actual = text or _generate_script(topic)
        return f"Add text to #studio-text at http://localhost:5173/studio: \"{actual}\" — use existing Chrome focus + fill"

    if action == "choose_voice":
        return f"Choose voice {voice} at /studio — click VoicePicker card {voice}"

    if action == "generate_voice":
        return "Click Generate Speech button at /studio, wait Audio ready"

    if action == "tiktok_style":
        return "At /studio/subtitles select TikTok Style preset (Montserrat 800 #FFFFFF on #8B5CF6 90% 14px 10px radius)"

    if action == "auto_generate_subtitles":
        return "At /studio/subtitles click Auto-generate button"

    if action in ("find_gameplay",):
        q = NO_COPYRIGHT_QUERIES.get(bg_type, NO_COPYRIGHT_QUERIES["random"])
        return f"Search YouTube for no-copyright {bg_type}: \"{q}\" + Creative Commons filter. Then add_background with URL."

    if action == "add_background":
        if not yt_url:
            q = NO_COPYRIGHT_QUERIES.get(bg_type, NO_COPYRIGHT_QUERIES["random"])
            return f"Need youtube_url. Search: \"{q}\" then add_background youtube_url=URL method=existing_chrome"
        return f"Add background {yt_url} at /studio/video via input[aria-label='YouTube video URL'] method existing_chrome"

    if action in ("export_default", "export_video"):
        return f"Export default: Portrait 9:16, End with voice ON, 720p (720x1280), MP4 H.264, Medium, 60fps ~1.8MB — click Portrait, ensure toggle ON, select 720p/mp4/medium/60, click Export Video"

    if action == "download_video":
        return "Click Download Video button at /studio/video after export, saves to Downloads, then notify DONE"

    return _guide()
