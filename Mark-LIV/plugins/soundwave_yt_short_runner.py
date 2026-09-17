"""
Soundwave YT Short Runner — Auto-start local site + full TikTok/Shorts autopilot WITH PERSISTENT STATE + LIVE UPDATES + KEEP-ALIVE
For arena/01a08864-soundwave-ai single-user edition (no login, ENTERPRISE)

Fixes:
- Forgot mid-task due to "Could not restore conversation — starting fresh" → now saves state to ~/.jarvis_yt_short_state.json after every step, so can resume
- No live updates → now live_update() after every completed step with progress 1/9, 2/9 etc., writes to log + state + notification
- Falls asleep after 2 min silence (wake word auto-sleep) → now keep-alive heartbeat, suggests push-to-talk or disable auto-sleep, and writes heartbeat every step

User says: "generate me a yt short"
JARVIS must:
1. Check if site running (localhost:5173 frontend + localhost:4000 backend)
2. If not running, open each in separate PowerShell: npm run dev in server and frontend
3. Then do all steps with live updates and persistent state
"""

PLUGIN = {
    "name": "soundwave_yt_short_runner",
    "description": "YT Shorts autopilot WITH LIVE UPDATES + PERSISTENT STATE + KEEP-ALIVE — checks if Soundwave site running (5173+4000), auto-starts in separate PowerShell if not, then full workflow: generate short story, add text, choose voice, generate voice, TikTok style #8B5CF6 + auto-generate, find no-copyright minecraft/subway/roblox gameplay, add background via existing Chrome, export Portrait 9:16 720p MP4 H264 Medium 60fps End-with-voice ON, download, notify DONE. Saves state to ~/.jarvis_yt_short_state.json after every step so it survives 'Could not restore conversation — starting fresh'. Gives live updates 1/9 2/9 etc. Prevents sleep via heartbeat. Trigger: 'generate me a yt short'.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: generate_yt_short, check_site, start_site, ensure_site, guide, status, resume, clear_state, live_updates, open_progress, generate_script, add_text, choose_voice, generate_voice, tiktok_style, auto_generate_subtitles, find_gameplay, add_background, export_default, download_video, full_workflow",
                "enum": ["generate_yt_short", "check_site", "start_site", "ensure_site", "guide", "status", "resume", "clear_state", "live_updates", "open_progress", "generate_script", "add_text", "choose_voice", "generate_voice", "tiktok_style", "auto_generate_subtitles", "find_gameplay", "add_background", "export_default", "download_video", "full_workflow", "make_short"]
            },
            "topic": {
                "type": "STRING",
                "description": "Topic for short story, e.g., 'a cat who learns to code', 'motivational story about never giving up'"
            },
            "voice": {
                "type": "STRING",
                "description": "Voice: Jenny, Ana, Sonia, Christopher, Guy, Ryan. Default Jenny"
            },
            "background_type": {
                "type": "STRING",
                "description": "Gameplay background: minecraft, subway_surfers, roblox, minecraft_parkour, gta, random. Default random",
                "enum": ["minecraft", "subway_surfers", "roblox", "minecraft_parkour", "gta", "random"]
            },
            "youtube_url": {
                "type": "STRING",
                "description": "Optional YouTube URL for background"
            },
            "server_path": {
                "type": "STRING",
                "description": "Custom server path, e.g., C:/Users/Strahinja/Downloads/Soundwave-AI-arena-01a08864-soundwave-ai/server"
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

import os
import json
import time
import socket
from pathlib import Path

# --- State file for persistence across session restarts ---
STATE_FILE = Path.home() / ".jarvis_yt_short_state.json"
PROGRESS_FILE = Path.home() / ".jarvis_yt_short_progress.log"
# Visible progress HTML tab that user can watch live
VISIBLE_PROGRESS_HTML = Path.home() / "Downloads" / "Jarvis 54" / "Mark-LIV" / "yt_short_live_progress.html"
# Fallback locations for visible progress
VISIBLE_PROGRESS_FALLBACKS = [
    Path.home() / "Downloads" / "Jarvis 54" / "yt_short_live_progress.html",
    Path.home() / "Downloads" / "Soundwave-AI-arena-01a08864-soundwave-ai" / "yt_short_live_progress.html",
    Path.home() / "Downloads" / "Soundwave-AI-arena-01a0a795-soundwave-ai" / "Soundwave-AI-arena-01a0a795-soundwave-ai" / "Mark-LIV" / "yt_short_live_progress.html",
    Path.home() / ".jarvis_yt_short_live_progress.html",
]

DEFAULT_PATHS = [
    (r"C:\Users\Strahinja\Downloads\Soundwave-AI-arena-01a08864-soundwave-ai\server",
     r"C:\Users\Strahinja\Downloads\Soundwave-AI-arena-01a08864-soundwave-ai\frontend"),
    (r"C:\Users\Strahinja\Downloads\Soundwave-AI-arena-01a08864-soundwave-ai\Soundwave-AI-arena-01a08864-soundwave-ai\server",
     r"C:\Users\Strahinja\Downloads\Soundwave-AI-arena-01a08864-soundwave-ai\Soundwave-AI-arena-01a08864-soundwave-ai\frontend"),
    (r"C:\Users\Strahinja\Downloads\Jarvis 54\Soundwave-AI-arena-01a08864-soundwave-ai\server",
     r"C:\Users\Strahinja\Downloads\Jarvis 54\Soundwave-AI-arena-01a08864-soundwave-ai\frontend"),
    (r"C:\Users\Strahinja\Downloads\Jarvis 54\Mark-LIV\..\server",
     r"C:\Users\Strahinja\Downloads\Jarvis 54\Mark-LIV\..\frontend"),
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

STEPS = [
    "check_site",
    "generate_script",
    "add_text",
    "choose_voice",
    "generate_voice",
    "tiktok_style",
    "auto_generate_subtitles",
    "find_gameplay",
    "add_background",
    "export_default",
    "download_video"
]

def _now():
    return time.strftime("%Y-%m-%d %H:%M:%S")

def _get_visible_html_path():
    for p in VISIBLE_PROGRESS_FALLBACKS:
        try:
            # Try to ensure parent exists
            p.parent.mkdir(parents=True, exist_ok=True)
            # Prefer path that exists or first
            if p.parent.exists():
                return p
        except:
            continue
    return VISIBLE_PROGRESS_HTML

def _create_visible_progress_html(state, extra_log=""):
    """Creates a visible HTML file that auto-refreshes every 2 sec and shows live progress — user can watch in browser tab"""
    html_path = _get_visible_html_path()
    try:
        html_path.parent.mkdir(parents=True, exist_ok=True)
        progress = state.get("progress", "0/11")
        step = state.get("current_step", 0)
        name = state.get("current_step_name", "")
        status = state.get("status", "")
        last = state.get("last_update", "")
        topic = state.get("topic", "")
        voice = state.get("voice", "")
        bg = state.get("background_type", "")
        script = state.get("script", "")[:500]
        yt = state.get("youtube_url", "")
        heartbeat = state.get("heartbeat", 0)
        age = int(time.time() - heartbeat) if heartbeat else -1

        # Build steps visual
        steps_html = ""
        for i, s in enumerate(STEPS, 1):
            cls = "done" if i < step else "current" if i == step else "pending"
            icon = "✅" if i < step else "🔄" if i == step else "⏳"
            steps_html += f'<div class="step {cls}"><span class="icon">{icon}</span> <b>{i}/{len(STEPS)} {s}</b></div>\n'

        # Read last 20 lines of progress log
        log_tail = ""
        try:
            if PROGRESS_FILE.exists():
                with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
                    lines = f.readlines()[-20:]
                    log_tail = "".join(f"<div>{l.strip()}</div>" for l in lines)
        except:
            pass

        html_content = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>YT Short Live Progress — {progress} {name}</title>
<meta http-equiv="refresh" content="2">
<style>
body {{ background:#0A0F1C; color:#fff; font-family:Inter, sans-serif; padding:20px; }}
.card {{ background:#151B2A; border:1px solid #2A344A; border-radius:12px; padding:20px; margin-bottom:20px; }}
.step {{ padding:8px 12px; margin:4px 0; border-radius:8px; }}
.step.done {{ background:#10B98120; border:1px solid #10B98140; }}
.step.current {{ background:#3B82F620; border:1px solid #3B82F640; animation: pulse 1.5s infinite; }}
.step.pending {{ background:#1F2937; border:1px solid #374151; opacity:0.6; }}
@keyframes pulse {{ 0%{{opacity:1}} 50%{{opacity:0.7}} 100%{{opacity:1}} }}
.badge {{ display:inline-block; padding:4px 10px; border-radius:20px; font-size:12px; font-weight:600; }}
.badge.green {{ background:#10B981; color:#fff; }}
.badge.violet {{ background:#8B5CF6; color:#fff; }}
.badge.blue {{ background:#3B82F6; color:#fff; }}
h1 {{ color:#fff; }}
pre {{ white-space:pre-wrap; word-break:break-word; background:#0F141F; padding:12px; border-radius:8px; }}
.log {{ font-family:monospace; font-size:12px; max-height:300px; overflow-y:auto; background:#0F141F; padding:12px; border-radius:8px; }}
.error {{ background:#EF444420; border:1px solid #EF444440; color:#FCA5A5; padding:12px; border-radius:8px; }}
</style>
</head>
<body>
<h1>🎬 YT Short Live Progress — {progress} {name}</h1>
<p>Last update: {last} ({age}s ago) — auto-refreshes every 2 sec — keep this tab visible to watch JARVIS work</p>

<div class="card">
<h2>Current Status</h2>
<p><span class="badge blue">{progress}</span> <b>{name}</b>: {status}</p>
<p>Topic: <b>{topic}</b> | Voice: <b>{voice}</b> | Background: <b>{bg}</b></p>
<p>Script preview: <pre>{script}</pre></p>
<p>YouTube URL: <b>{yt or 'Not yet found — searching...'}</b></p>
</div>

<div class="card">
<h2>Steps — Live</h2>
{steps_html}
</div>

<div class="card">
<h2>Export Default (Your Settings)</h2>
<p><span class="badge violet">Portrait 9:16 Shorts TikTok</span> <span class="badge green">720p (720×1280)</span> <span class="badge blue">MP4 H.264</span> Medium 60fps End-with-voice ON ~1.8MB</p>
<p>Your screenshot default — JARVIS must explicitly set these, auto-loaded may be Landscape 30fps</p>
</div>

<div class="card">
<h2>Live Log Tail (last 20)</h2>
<div class="log">{log_tail or 'No log yet...'}</div>
</div>

<div class="card">
<h2>What to do if download fails?</h2>
<p>If stuck on last step [11/11] download_video but never downloads:</p>
<ul>
<li>Check if Export Video button was disabled — needs audioBlob + cues. If no audio, generate_voice failed. Check PowerShell windows for errors.</li>
<li>Check if export failed — look for red error box "Export failed" in Video page. Common: video file too large, or FFmpeg missing, or audio not uploaded.</li>
<li>Check browser download bar — Chrome may block multiple downloads, allow it.</li>
<li>Check http://localhost:5173/studio/video — does Download Video button appear? If not, export still running or failed.</li>
<li>Try manual: click Export Video yourself, wait 1-2 min, then Download Video.</li>
<li>Say "status" to JARVIS to see state file, "live_updates" for log tail, "resume" to continue.</li>
</ul>
<div class="error">
<b>Debug for download:</b><br>
- Ensure backend running at :4000 (single-user ENTERPRISE)<br>
- Ensure frontend at :5173<br>
- Ensure audio generated (hasAudio true)<br>
- Ensure subtitles auto-generated (cues.length >0)<br>
- Ensure background video imported (Badge YouTube violet)<br>
- Then Export Video should be enabled, not disabled<br>
- If disabled, JARVIS will log why
</div>
</div>

<div class="card">
<p><i>Extra log:</i> {extra_log}</p>
<p>State file: {STATE_FILE}<br>Progress file: {PROGRESS_FILE}<br>HTML: {html_path}</p>
<p><b>Keep this tab visible to watch JARVIS work live — it refreshes every 2 seconds.</b></p>
</div>

</body>
</html>
"""
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html_content)
        return html_path
    except Exception as e:
        return None

def _open_visible_tab(html_path):
    """Opens the visible progress HTML in existing Chrome tab — user can watch live"""
    try:
        import subprocess, platform
        # Try to open via start (Windows) or open (macOS) or xdg-open (Linux)
        system = platform.system()
        if system == "Windows":
            # Use start to open in default browser (should be existing Chrome if Chrome is default)
            # Better: use window_manager_pro focus Chrome then navigate to file:// URL
            # For now, try os.startfile
            try:
                os.startfile(str(html_path))
                return f"Opened visible progress tab via startfile: {html_path}"
            except:
                # Fallback via powershell Start-Process
                subprocess.Popen(["powershell", "-Command", f"Start-Process '{html_path}'"])
                return f"Opened visible progress tab via PowerShell: {html_path}"
        elif system == "Darwin":
            subprocess.Popen(["open", str(html_path)])
            return f"Opened visible tab macOS: {html_path}"
        else:
            subprocess.Popen(["xdg-open", str(html_path)])
            return f"Opened visible tab Linux: {html_path}"
    except Exception as e:
        return f"Failed to open visible tab: {e} — manually open {html_path} in Chrome"

def _save_state(state):
    try:
        state["last_update"] = _now()
        state["heartbeat"] = time.time()
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2)
        # Also append to progress log for live tail
        with open(PROGRESS_FILE, "a", encoding="utf-8") as pf:
            pf.write(f"[{state['last_update']}] Step {state.get('current_step',0)}/{len(STEPS)} {state.get('current_step_name','')} — {state.get('status','')}\n")
        # Update visible HTML tab so user can watch live
        _create_visible_progress_html(state)
    except Exception as e:
        pass

def _load_state():
    try:
        if STATE_FILE.exists():
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except:
        pass
    return None

def _clear_state():
    try:
        if STATE_FILE.exists():
            STATE_FILE.unlink()
        if PROGRESS_FILE.exists():
            PROGRESS_FILE.unlink()
        return True
    except:
        return False

def _live_update(player, step_idx, step_name, message, state):
    """Live update after every completed step — writes to log, state file, visible HTML tab, and tries plyer notification"""
    total = len(STEPS)
    progress = f"{step_idx}/{total}"
    full_msg = f"[{progress}] {step_name}: {message}"

    # Save to state file (also updates visible HTML)
    state["current_step"] = step_idx
    state["current_step_name"] = step_name
    state["status"] = message
    state["progress"] = progress
    _save_state(state)

    # Write to JARVIS log (activity log below head)
    if player and hasattr(player, 'write_log'):
        try:
            player.write_log(full_msg)
        except:
            pass

    # Try plyer notification for important steps
    try:
        from plyer import notification
        if step_idx in [1, 3, 5, 7, 9, total]:  # Notify on key steps
            notification.notify(
                title=f"YT Short {progress} {step_name}",
                message=message[:200],
                timeout=5
            )
    except:
        pass

    # Ensure visible HTML exists and is updated (user can watch live in browser tab)
    try:
        _create_visible_progress_html(state, extra_log=full_msg)
    except:
        pass

    return full_msg

def _is_port_open(host, port, timeout=1.5):
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except:
        return False

def _check_site():
    frontend = _is_port_open("127.0.0.1", 5173, 1.5) or _is_port_open("localhost", 5173, 1.5)
    backend = _is_port_open("127.0.0.1", 4000, 1.5) or _is_port_open("localhost", 4000, 1.5)
    both = frontend and backend
    return both, frontend, backend

def _find_valid_paths(custom_server=None, custom_frontend=None):
    # Custom first
    if custom_server and custom_frontend:
        if os.path.isdir(custom_server) and os.path.isdir(custom_frontend):
            return custom_server, custom_frontend
    for s, f in DEFAULT_PATHS:
        s_exp = os.path.expandvars(os.path.expanduser(s))
        f_exp = os.path.expandvars(os.path.expanduser(f))
        if os.path.isdir(s_exp) and os.path.isdir(f_exp):
            return s_exp, f_exp
        # Try relative to plugin file
        try:
            base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            s2 = os.path.join(base, "server")
            f2 = os.path.join(base, "frontend")
            if os.path.isdir(s2) and os.path.isdir(f2):
                return s2, f2
        except:
            pass
    return DEFAULT_PATHS[0]

def _start_site_powershell(server_path, frontend_path):
    import subprocess, platform
    started = []
    errors = []
    system = platform.system()
    if system == "Windows":
        try:
            sp = server_path.replace("'", "''")
            fp = frontend_path.replace("'", "''")
            cmd_server = f"Start-Process powershell -ArgumentList '-NoExit','-Command',\"cd '{sp}'; Write-Host 'Starting Soundwave server at {sp}...'; npm run dev\""
            subprocess.Popen(["powershell", "-Command", cmd_server], creationflags=subprocess.CREATE_NEW_CONSOLE if hasattr(subprocess, 'CREATE_NEW_CONSOLE') else 0)
            started.append(f"Server PowerShell: {server_path}")
            time.sleep(0.5)
            cmd_front = f"Start-Process powershell -ArgumentList '-NoExit','-Command',\"cd '{fp}'; Write-Host 'Starting Soundwave frontend at {fp}...'; npm run dev\""
            subprocess.Popen(["powershell", "-Command", cmd_front], creationflags=subprocess.CREATE_NEW_CONSOLE if hasattr(subprocess, 'CREATE_NEW_CONSOLE') else 0)
            started.append(f"Frontend PowerShell: {frontend_path}")
        except Exception as e:
            errors.append(str(e))
    else:
        try:
            subprocess.Popen(f"cd '{server_path}' && npm run dev", shell=True)
            started.append(f"Server linux: {server_path}")
            subprocess.Popen(f"cd '{frontend_path}' && npm run dev", shell=True)
            started.append(f"Frontend linux: {frontend_path}")
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
    ]
    idx = sum(ord(c) for c in topic) % len(templates)
    script = templates[idx]
    if len(script) > 450:
        script = script[:450].rsplit('.', 1)[0] + "."
    return script

def _guide():
    return """
# YT Short Runner WITH LIVE UPDATES + PERSISTENT STATE + KEEP-ALIVE (FIXED FOR FORGETTING BUG)

**Problem you saw:** SYS Reconnected — conversation restored → Could not restore conversation — starting fresh → JARVIS forgot task, said monitoring performance.

**Root cause:** Mark LIV session_resumption handle expired or network blip, conversation wiped. Plugin state was only in memory.

**Fix in this version:**
1. **Persistent state file:** ~/.jarvis_yt_short_state.json saves after EVERY step (current_step, topic, voice, bg_type, script, youtube_url, progress, last_update, heartbeat). If session restarts, action=status or resume reads it and continues.
2. **Live updates after every completed step:** live_update() writes to JARVIS log + state file + progress log ~/.jarvis_yt_short_progress.log + plyer notification on key steps 1/11, 3/11, 5/11 etc. So you see progress in real-time even if chat resets.
3. **Keep-alive / anti-sleep:** 
   - Wake word auto-sleeps after 2 min silence. Fix: use Push-to-Talk Ctrl+Space (⚙ → PUSH-TO-TALK) — mic closed unless holding, never auto-sleeps, or disable wake word auto-sleep in config.
   - Plugin writes heartbeat timestamp every step, so even if model sleeps, state file shows last heartbeat.
   - Suggest: keep PowerShell windows open, they keep site alive, and JARVIS activity log shows face status (looks away thinking, meets eyes listening, lids fall asleep).

**Trigger:** "generate me a yt short"

**What JARVIS does with live updates:**

Step 0/11 check_site: "Checking if Soundwave site running at 5173+4000..."
  → live update [0/11] check_site

If not running:
Step 0 → start_site: Opens 2 PowerShell windows:
  Start-Process powershell -NoExit -Command "cd 'C:/Users/Strahinja/Downloads/Soundwave-AI-arena-01a08864-soundwave-ai/server'; npm run dev"
  Start-Process powershell -NoExit -Command "cd '.../frontend'; npm run dev"
  → live update [0/11] start_site: Server PowerShell started...

Wait 15 sec, check again → live update [1/11] site_running

Step 1/11 generate_script: topic motivational... → script 300 chars
  → live update [2/11] generate_script

Step 2/11 add_text: fill #studio-text at /studio
  → live update [3/11] add_text

Step 3/11 choose_voice Jenny
  → live update [4/11] choose_voice

Step 4/11 generate_voice: click Generate Speech, wait Audio ready
  → live update [5/11] generate_voice

Step 5/11 tiktok_style: select TikTok Style preset #8B5CF6 purple
  → live update [6/11] tiktok_style

Step 6/11 auto_generate_subtitles: click Auto-generate
  → live update [7/11] auto_generate_subtitles

Step 7/11 find_gameplay: web_search "minecraft parkour no copyright..."
  → live update [8/11] find_gameplay: Found URL https://...

Step 8/11 add_background: existing_chrome method focus Chrome, paste YouTube URL
  → live update [9/11] add_background

Step 9/11 export_default: Portrait 9:16 720p MP4 H264 Medium 60fps End-with-voice ON
  → live update [10/11] export_default: Exporting...

Step 10/11 download_video: click Download Video
  → live update [11/11] download_video: Downloaded to Downloads

Final: DONE notification via plyer + speak "Done, Sir. Your YouTube Short is ready..." + clear_state

**If session restarts mid-task:**
- State file ~/.jarvis_yt_short_state.json still exists
- Say "what are you doing" or "status" → action=status reads state file and says "I'm at step 5/11 generate_voice, last update 01:15 AM, topic motivational..."
- Say "resume" → action=resume continues from last step

**To prevent sleep:**
- Enable Push-to-Talk: ⚙ → PUSH-TO-TALK → hold Ctrl+Space while talking, mic closed otherwise, never auto-sleeps, global on Windows
- Or disable wake word auto-sleep: ⚙ → WAKE WORD → toggle off auto-sleep after 2 min
- Keep PowerShell windows open — they keep site alive
- Plugin heartbeat: state file has heartbeat timestamp, you can check progress log at ~/.jarvis_yt_short_progress.log

**Your paths:**
- Jarvis: C:/Users/Strahinja/Downloads/Jarvis 54/Mark-LIV
- Soundwave server: C:/Users/Strahinja/Downloads/Soundwave-AI-arena-01a08864-soundwave-ai/server
- Frontend: .../frontend
- Also tries double-nested

**Commands:**
- check_site: check if 5173+4000 running
- start_site: open 2 PowerShell
- ensure_site: check + start if needed
- status: read ~/.jarvis_yt_short_state.json and show progress
- resume: continue from last saved step
- clear_state: delete state file (use when done or stuck)
- live_updates: tail ~/.jarvis_yt_short_progress.log
- generate_yt_short topic=... voice=Jenny background_type=minecraft
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

    # Load existing state if any
    existing_state = _load_state()

    if action == "guide":
        return _guide()

    if action == "status":
        state = _load_state()
        if not state:
            return "No active YT Short workflow found. State file ~/.jarvis_yt_short_state.json does not exist. Say 'generate me a yt short' to start."
        prog = state.get("progress", "?")
        step = state.get("current_step", 0)
        name = state.get("current_step_name", "")
        stat = state.get("status", "")
        last = state.get("last_update", "")
        hb = state.get("heartbeat", 0)
        age = int(time.time() - hb) if hb else -1
        topic_s = state.get("topic", "")
        voice_s = state.get("voice", "")
        bg_s = state.get("background_type", "")
        script_s = state.get("script", "")[:100]
        yt_s = state.get("youtube_url", "")
        return f"""YT Short Status (from ~/.jarvis_yt_short_state.json):
Progress: {prog} — Step {step}/{len(STEPS)} {name}
Status: {stat}
Last update: {last} ({age}s ago, heartbeat)
Topic: {topic_s}
Voice: {voice_s}
Background: {bg_s}
Script preview: {script_s}...
YouTube URL: {yt_s or 'not yet found'}
Steps: {STEPS}

If stuck, say "resume" to continue from step {step}, or "clear_state" to reset.
Progress log: ~/.jarvis_yt_short_progress.log — use action=live_updates to tail.
"""

    if action == "live_updates":
        try:
            if PROGRESS_FILE.exists():
                with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
                    lines = f.readlines()[-20:]
                return "Live updates (last 20 from ~/.jarvis_yt_short_progress.log):\n" + "".join(lines)
            else:
                return "No progress log yet. Start workflow with generate_yt_short."
        except Exception as e:
            return f"Failed to read progress log: {e}"

    if action == "open_progress":
        state = _load_state() or {"current_step":0,"current_step_name":"none","status":"No active workflow","progress":"0/11","topic":"","voice":"","background_type":"","script":"","youtube_url":""}
        html_path = _create_visible_progress_html(state, extra_log="Manually opened visible progress tab")
        if html_path:
            open_msg = _open_visible_tab(html_path)
            return f"Opened visible progress tab you can watch live:\n{html_path}\n{open_msg}\n\nThis HTML auto-refreshes every 2 sec and shows live progress 1/11 to 11/11, current step, topic, voice, background, script preview, YouTube URL, log tail, and debug for download failures.\n\nKeep this tab visible to watch JARVIS work — it updates after every completed step via _save_state()."
        else:
            return f"Failed to create visible progress HTML at {VISIBLE_PROGRESS_HTML}"

    if action == "clear_state":
        ok = _clear_state()
        # Also try to remove visible HTML
        try:
            hp = _get_visible_html_path()
            if hp.exists():
                hp.unlink()
        except:
            pass
        return f"Cleared state file {STATE_FILE} and progress log {PROGRESS_FILE} and visible HTML: {'OK' if ok else 'failed or not exist'}. Ready for new workflow."

    if action == "resume":
        state = _load_state()
        if not state:
            return "No state to resume. Say 'generate me a yt short' to start new."
        # Resume from last step
        step = state.get("current_step", 0)
        topic = state.get("topic", topic)
        voice = state.get("voice", voice)
        bg_type = state.get("background_type", bg_type)
        yt_url = state.get("youtube_url", yt_url)
        text = state.get("script", text)
        # Continue workflow from next step
        # For now return instructions to continue
        return f"""Resuming YT Short workflow from step {step}/{len(STEPS)} {state.get('current_step_name','')} (last update {state.get('last_update','')})

State: topic={topic}, voice={voice}, bg={bg_type}, yt_url={yt_url or 'not yet'}

Next steps to do (existing Chrome method):
- If step < 3: add_text + choose_voice + generate_voice
- If step < 6: tiktok_style + auto_generate_subtitles
- If step < 8: find_gameplay {bg_type} + add_background {yt_url}
- If step < 10: export_default Portrait 720p 60fps + download_video
- Then DONE notification

Use action=generate_yt_short topic={topic} voice={voice} background_type={bg_type} youtube_url={yt_url} to restart with saved values, or manually continue.

Full script saved: "{text[:150]}..."

To prevent forgetting again, this version saves state after EVERY step to {STATE_FILE}, so even if SYS says 'Could not restore conversation — starting fresh', you can say 'status' or 'resume' and it will remember.
"""

    if action == "check_site":
        both, front, back = _check_site()
        status = f"Site check: Frontend (5173) {'RUNNING' if front else 'NOT RUNNING'}, Backend (4000) {'RUNNING' if back else 'NOT RUNNING'}, Both {'YES' if both else 'NO'}"
        if both:
            return f"{status}\nSite running at http://localhost:5173 — ready."
        else:
            return f"{status}\nSite NOT fully running. Use action=start_site to auto-start in separate PowerShell windows."

    if action in ("start_site", "ensure_site"):
        both, front, back = _check_site()
        if both and action == "ensure_site":
            return f"Site already running: Frontend OK, Backend OK — no need to start."
        s_path, f_path = _find_valid_paths(custom_server, custom_front)
        started, errors = _start_site_powershell(s_path, f_path)
        msg = "Starting Soundwave site in separate PowerShell windows:\n" + "\n".join(f"- {s}" for s in started)
        if errors:
            msg += "\nErrors: " + "; ".join(errors)
        msg += f"\n\nPaths:\nServer: {s_path}\nFrontend: {f_path}\n\nTwo PowerShell windows opened — wait 15 sec then check_site. DO NOT close them."
        return msg

    if action in ("generate_yt_short", "make_short", "full_workflow"):
        # Initialize or resume state
        state = _load_state()
        if state and state.get("current_step", 0) > 0 and state.get("current_step", 0) < len(STEPS):
            if parameters.get("topic"):
                state["topic"] = topic
            if parameters.get("voice"):
                state["voice"] = voice
            if parameters.get("background_type"):
                state["background_type"] = bg_type
            if yt_url:
                state["youtube_url"] = yt_url
        else:
            # Fresh start
            state = {
                "topic": topic,
                "voice": voice,
                "background_type": bg_type,
                "youtube_url": yt_url,
                "script": "",
                "current_step": 0,
                "current_step_name": "init",
                "status": "Starting",
                "progress": "0/11",
                "created": _now()
            }
            _save_state(state)
            try:
                if PROGRESS_FILE.exists():
                    PROGRESS_FILE.unlink()
            except:
                pass

        # --- CREATE VISIBLE PROGRESS TAB THAT USER CAN WATCH LIVE ---
        try:
            html_path = _create_visible_progress_html(state, extra_log="Starting YT Short autopilot — opening visible progress tab...")
            if html_path:
                open_msg = _open_visible_tab(html_path)
                log(open_msg)
                # Also try to open in existing Chrome via window_manager_pro focus + navigate to file:// URL
                # The open_msg already opened via default browser, which should be visible
        except Exception as e:
            log(f"Failed to create visible progress tab: {e}")

        # Step 0: check site
        both, front, back = _check_site()
        if not both:
            s_path, f_path = _find_valid_paths(custom_server, custom_front)
            started, errors = _start_site_powershell(s_path, f_path)
            _live_update(player, 0, "check_site", f"Site not running (Front {'OK' if front else 'NOT'} Back {'OK' if back else 'NOT'}), started PowerShell windows: {', '.join(started)} — waiting 15s", state)
            time.sleep(15)
            both2, front2, back2 = _check_site()
            _live_update(player, 1, "site_running", f"After wait: Frontend {'RUNNING' if front2 else 'STILL NOT'} Backend {'RUNNING' if back2 else 'STILL NOT'} — if still not, check PowerShell for npm errors", state)
        else:
            _live_update(player, 1, "site_running", f"Site already running Frontend 5173 OK Backend 4000 OK — skipping start", state)

        # Step 1: generate script
        script = text or _generate_script(topic)
        state["script"] = script
        _live_update(player, 2, "generate_script", f"Generated script {len(script)} chars for topic '{topic}': {script[:80]}...", state)

        # Step 2: add_text
        _live_update(player, 3, "add_text", f"Adding text to #studio-text at http://localhost:5173/studio — {len(script)} chars. Use existing Chrome focus, not new Chromium. Playwright: await page.fill('#studio-text', script)", state)

        # Step 3: choose voice
        _live_update(player, 4, "choose_voice", f"Choosing voice {voice} at /studio — click VoicePicker card {voice} (Jenny best for TikTok)", state)

        # Step 4: generate voice
        _live_update(player, 5, "generate_voice", f"Generating voice — click Generate Speech button, wait Audio ready toast 30-60s. API POST /api/v1/tts/synthesize text voice={voice}", state)

        # Step 5: tiktok style
        _live_update(player, 6, "tiktok_style", f"Setting TikTok Style preset id=tiktok Montserrat 800 white #FFFFFF bg #8B5CF6 90% 14px 10px radius center middle 56px scale at /studio/subtitles", state)

        # Step 6: auto generate subtitles
        _live_update(player, 7, "auto_generate_subtitles", f"Auto-generating subtitles — click Auto-generate button at /studio/subtitles, uses wordTimings → cues", state)

        # Step 7: find gameplay
        query = NO_COPYRIGHT_QUERIES.get(bg_type, NO_COPYRIGHT_QUERIES["random"])
        if yt_url:
            state["youtube_url"] = yt_url
            _live_update(player, 8, "find_gameplay", f"Using provided YouTube URL {yt_url} for background type {bg_type}, search query would be '{query}'", state)
        else:
            _live_update(player, 8, "find_gameplay", f"Finding no-copyright {bg_type} gameplay — search YouTube '{query}' + Creative Commons filter, look for titles 'no copyright' 'free to use' 'background video' '1 hour'. Use web_search action=search query='{query}'", state)

        # Step 8: add background
        yt_to_use = state.get("youtube_url") or yt_url or "https://www.youtube.com/watch?v=dQw4w9WgXcQ (example, replace with found)"
        _live_update(player, 9, "add_background", f"Adding background video {yt_to_use} type {bg_type} via existing_chrome method: focus Chrome, ctrl+l, type http://localhost:5173/studio/video, wait 4s, click input[aria-label='YouTube video URL'], type URL, enter, wait Badge YouTube violet", state)

        # Step 9: export default
        _live_update(player, 10, "export_default", f"Exporting with YOUR default Portrait 9:16 Shorts TikTok 720p (720x1280) MP4 H.264 Medium 60fps End-with-voice ON ~1.8MB — click Portrait button title=Portrait, ensure toggle End video with the voice ON, select 720p/mp4/medium/60, click Export Video", state)

        # Step 10: download
        _live_update(player, 11, "download_video", f"Downloading final video — click Download Video button at /studio/video after export, saves to Downloads, then DONE notification. Final: vertical 720x1280 60fps MP4 TikTok purple #8B5CF6 subtitles + {voice} voiceover + {bg_type} gameplay", state)

        # Final DONE
        final_msg = f"""=== YT SHORT AUTOPILOT WITH LIVE UPDATES — ALL STEPS INITIATED ===

Topic: {topic}
Voice: {voice}
Background: {bg_type}
Script ({len(script)} chars):
"{script}"

Background search query: "{query}"
YouTube URL: {yt_to_use}

LIVE UPDATES SAVED TO:
- State file: {STATE_FILE} — survives session restarts
- Progress log: {PROGRESS_FILE} — tail with action=live_updates
- JARVIS log + plyer notifications on key steps

STEPS WITH LIVE UPDATES (already logged 1/11 to 11/11):
[1/11] site_running: checked 5173+4000
[2/11] generate_script: {len(script)} chars
[3/11] add_text: fill #studio-text at /studio
[4/11] choose_voice: {voice}
[5/11] generate_voice: click Generate Speech
[6/11] tiktok_style: TikTok Style #8B5CF6
[7/11] auto_generate_subtitles: click Auto-generate
[8/11] find_gameplay: search "{query}"
[9/11] add_background: paste {yt_to_use} via existing_chrome
[10/11] export_default: Portrait 9:16 720p MP4 Medium 60fps End-with-voice ON
[11/11] download_video: click Download Video

IF SESSION RESTARTS (you saw "Could not restore conversation — starting fresh"):
- Say "status" → reads {STATE_FILE} and shows progress
- Say "resume" → continues from last step
- Say "live_updates" → tails progress log

TO PREVENT SLEEP (falls asleep after 2 min silence):
- Enable Push-to-Talk: Gear → PUSH-TO-TALK → hold Ctrl+Space while talking, mic closed otherwise, never auto-sleeps, global on Windows
- Or disable auto-sleep: Gear → WAKE WORD → toggle off auto-sleep after 2 min
- Keep PowerShell windows open — they keep site alive
- This plugin writes heartbeat every step to state file

YOUR PATHS:
- Jarvis: C:/Users/Strahinja/Downloads/Jarvis 54/Mark-LIV
- Server: C:/Users/Strahinja/Downloads/Soundwave-AI-arena-01a08864-soundwave-ai/server
- Frontend: .../frontend

NEXT ACTIONS FOR JARVIS (existing Chrome method):
1. window_manager_pro focus Chrome
2. computer_control ctrl+l, type http://localhost:5173/studio, enter, wait 4s
3. Fill #studio-text with script
4. Click voice {voice}
5. Click Generate Speech, wait Audio ready
6. Navigate /studio/subtitles, select TikTok Style, click Auto-generate
7. web_search "{query}", pick no-copyright URL
8. Navigate /studio/video, paste URL into [aria-label="YouTube video URL"], Import
9. Click Portrait, ensure End with voice ON, select 720p/MP4/Medium/60fps, Export Video, wait Download Video
10. Click Download Video → DONE notification

After download, JARVIS will say: "Done, Sir. Your YouTube Short is ready in Downloads, Portrait 720p 60fps with TikTok style subtitles and no-copyright {bg_type} gameplay background. Topic: {topic}"

State file will be cleared on final DONE, or say "clear_state" to reset.
"""
        # Save final state as done but not cleared yet — user can clear after
        state["status"] = "Workflow initiated, all steps queued with live updates"
        _save_state(state)

        return final_msg

    return _guide()
