"""
Soundwave Simple Edition — Full Autopilot for arena/01a08864-soundwave-ai
Teaches JARVIS every single button in the single-user edition (SINGLE_USER_MODE=true, no login, ENTERPRISE plan).

Workflow: Generate script → Choose voice → Generate voice → TikTok subtitles style → Auto-generate → Add no-copyright gameplay background → Export Portrait 720p MP4 H.264 Medium 60fps End-with-voice → Download

This plugin is for the new branch: arena/01a08864-soundwave-ai (13 commits ahead of main, single-user simple edition)
Repo: https://github.com/Str4hinj47/Soundwave-AI/tree/arena/01a08864-soundwave-ai

UI Map (exact selectors from frontend/src/pages/):
- Studio (/studio or /): textarea id="studio-text", VoicePicker, Generate Speech button text "Generate Speech" / "Generating… ⚡"
- Subtitles (/studio/subtitles): preset select placeholder "Apply a preset…" id tiktok = "TikTok Style" (Montserrat 800, #FFFFFF text, #8B5CF6 bg 90% 14px 10px radius), Auto-generate button text "Auto-generate"
- Video (/studio/video): YouTube input aria-label="YouTube video URL", Import button, Video style radiogroup aria-label="Video style" buttons title Portrait "9:16 · Shorts · TikTok" / Landscape "16:9 · YouTube", Toggle label "End video with the voice" (fitToVoice), Resolution select ariaLabel="Resolution" (720p 720x1280 portrait), Format ariaLabel="Format" MP4 H.264, Quality ariaLabel="Quality" Medium, Frame rate ariaLabel="Frame rate" 60 fps, Export Video button (Clapperboard icon), Download Video button
"""

PLUGIN = {
    "name": "soundwave_simple_edition",
    "description": "Master Soundwave AI single-user edition (arena/01a08864-soundwave-ai) — no login, ENTERPRISE. Full autopilot: generate short story script for voice, choose voice, generate voice, customize subtitles TikTok style + auto-generate, add no-copyright minecraft/subway surfers/roblox background gameplay via YouTube paste, export Portrait 9:16 720p MP4 H.264 Medium 60fps End-with-voice, download. Teaches JARVIS every button with exact selectors.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: guide, generate_script, add_text, choose_voice, generate_voice, tiktok_style, auto_generate_subtitles, find_gameplay, add_background, export_portrait_default, export_video, download_video, full_tiktok_workflow, tiktok_workflow, search_no_copyright",
                "enum": ["guide", "generate_script", "add_text", "choose_voice", "generate_voice", "tiktok_style", "auto_generate_subtitles", "find_gameplay", "add_background", "export_portrait_default", "export_video", "download_video", "full_tiktok_workflow", "tiktok_workflow", "search_no_copyright"]
            },
            "topic": {
                "type": "STRING",
                "description": "Topic for short story script, e.g., 'a cat who learns to code' or 'motivational story about never giving up'"
            },
            "text": {
                "type": "STRING",
                "description": "Direct text to put into studio-text textarea, if not using generate_script"
            },
            "voice": {
                "type": "STRING",
                "description": "Voice id: Jenny, Ana, Sonia, Christopher, Guy, Ryan, or clone:xxx. Default Jenny"
            },
            "background_type": {
                "type": "STRING",
                "description": "Background gameplay type: minecraft, subway_surfers, roblox, gta, minecraft_parkour",
                "enum": ["minecraft", "subway_surfers", "roblox", "minecraft_parkour", "gta", "random"]
            },
            "youtube_url": {
                "type": "STRING",
                "description": "YouTube URL for background gameplay, e.g., https://youtube.com/watch?v=... (no copyright)"
            },
            "method": {
                "type": "STRING",
                "description": "Method to add background: api, existing_chrome, clipboard, auto. Default auto (api then existing_chrome then clipboard). Use existing_chrome to avoid new Chrome without login.",
                "enum": ["api", "existing_chrome", "clipboard", "auto"]
            }
        },
        "required": ["action"]
    }
}

# --- Constants for simple edition ---
DEFAULT_EXPORT = {
    "video_style": "Portrait",
    "aspect": "9:16",
    "aspect_sub": "9:16 · Shorts · TikTok",
    "resolution": "720p",
    "resolution_label": "720p (720×1280) portrait",
    "dims": "720×1280",
    "format": "mp4",
    "format_label": "MP4 (H.264)",
    "quality": "medium",
    "quality_label": "Medium",
    "fps": 60,
    "fps_label": "60 fps",
    "fit_to_voice": True,
    "end_with_voice_label": "End video with the voice"
}

TIKTOK_PRESET = {
    "id": "tiktok",
    "name": "TikTok Style",
    "font": "Montserrat",
    "weight": 800,
    "color": "#FFFFFF",
    "bg": "#8B5CF6",
    "bg_opacity": 90,
    "padding": 14,
    "radius": 10,
    "shadow": True,
    "align": "center middle",
    "size": 56,
    "anim": "scale"
}

# No-copyright gameplay search queries
NO_COPYRIGHT_QUERIES = {
    "minecraft": [
        "minecraft parkour no copyright free to use",
        "minecraft gameplay no copyright background",
        "minecraft no copyright 1 hour",
        "minecraft parkour gameplay free use"
    ],
    "subway_surfers": [
        "subway surfers gameplay no copyright",
        "subway surfers no copyright background video",
        "subway surfers 1 hour no copyright",
        "subway surfers free to use gameplay"
    ],
    "roblox": [
        "roblox obby gameplay no copyright",
        "roblox parkour no copyright background",
        "roblox gameplay free to use no copyright",
        "roblox no copyright background video"
    ],
    "minecraft_parkour": [
        "minecraft parkour no copyright 1080p",
        "minecraft parkour free background",
        "minecraft parkour gameplay no copyright"
    ],
    "gta": [
        "gta 5 gameplay no copyright free use",
        "gta parkour no copyright background"
    ],
    "random": [
        "no copyright background gameplay minecraft subway surfers",
        "free to use gameplay background no copyright",
        "no copyright gaming background video"
    ]
}

SELECTORS = {
    "studio_text": '#studio-text or textarea#studio-text or [id="studio-text"]',
    "generate_speech_btn": 'button:has-text("Generate Speech") or button:has-text("Generating")',
    "voice_picker": 'VoicePicker or [aria-label="Voice"]',
    "subtitle_preset_select": 'Select with placeholder "Apply a preset…" or [placeholder="Apply a preset…"]',
    "tiktok_preset_option": 'option:has-text("TikTok Style") or div:has-text("TikTok Style")',
    "auto_generate_btn": 'button:has-text("Auto-generate")',
    "youtube_input": '[aria-label="YouTube video URL"]',
    "youtube_import_btn": 'button:has-text("Import")',
    "video_style_group": '[role="radiogroup"][aria-label="Video style"]',
    "portrait_btn": 'button[title="Portrait"] or button:has-text("Portrait")',
    "landscape_btn": 'button[title="Landscape"]',
    "end_with_voice_toggle": '[label="End video with the voice"] or Toggle with label "End video with the voice"',
    "resolution_select": '[aria-label="Resolution"]',
    "format_select": '[aria-label="Format"]',
    "quality_select": '[aria-label="Quality"]',
    "fps_select": '[aria-label="Frame rate"]',
    "export_video_btn": 'button:has-text("Export Video")',
    "download_video_btn": 'button:has-text("Download Video")'
}

def _guide():
    return f"""
# Soundwave Simple Edition — Full Button Guide (arena/01a08864-soundwave-ai)

**Single-user mode:** SINGLE_USER_MODE=true, no login, auto ENTERPRISE, no subscription. Branch 13 commits ahead of main.

## Your Export Default (from screenshot):
- Video style: **Portrait** 9:16 · Shorts · TikTok (not Landscape 16:9 YouTube)
- End video with the voice: **ON** (toggle checked, fitToVoice=true, both video and subtitles stop at voiceover duration)
- Resolution: **720p (720×1280)** portrait (dimsLabel swaps axes for 9:16)
- Format: **MP4 (H.264)**
- Quality: **Medium**
- Frame rate: **60 fps**
- Estimated: ~1.8 MB

## Full Workflow — Every Button:

### 1. Generate Script for Short Story (Text-to-Speech Studio)
Page: http://localhost:5173/studio or /studio/text-to-speech or / (Studio.tsx)
- Textarea: id="studio-text" placeholder "Enter the text you want to convert to speech..."
- Character counter: X / 10000, color tone green→amber→orange→red
- Buttons: Add pause <break time="500ms"/>, Emphasis, Pronunciation
- Action: generate_script topic="a cat who learns to code" → creates 150-300 char short story, puts into studio-text

Exact Playwright:
await page.goto("http://localhost:5173/studio")
await page.fill('#studio-text', "Your short story here...")

### 2. Choosing Voice
Component: VoicePicker (DEFAULT_VOICES: Jenny, Ana, Sonia, Christopher, Guy, Ryan + cloned)
- Selected: shows name + badge American/British
- Tabs: Microsoft Neural / Cloned voices (if cloneConfigured)
- Action: choose_voice voice=Jenny → clicks voice card

Playwright:
await page.click('text=Jenny') or VoicePicker option

### 3. Generating Voice
Button: "Generate Speech" → "Generating… ⚡" (tts.status)
- CanGenerate: text.trim() >0 and not limitReached and status != generating
- OnComplete: sets audioBuffer, audioBlob, wordTimings, duration, adds history, refreshQuota, toast "Audio ready Generated Xm with Jenny"
- Player: auto-plays after 150ms

Playwright:
await page.click('button:has-text("Generate Speech")')
await page.wait_for_selector('text=Audio ready', timeout=60000)

### 4. Customizing Subtitles — TikTok Style + Auto-generate
Page: http://localhost:5173/studio/subtitles (SubtitleEditor.tsx)
- Toolbar: project name input aria-label="Project name", Undo/Redo, Save, Export SRT
- Preview: 16:9, grid toggle, drag subtitle to position (customX/customY 0-100%)
- Presets: SUBTITLE_PRESETS from subtitlePresets.ts:
  - youtube: Roboto 700 white stroke 3
  - netflix: Inter 500 white bg black 60% 12px 6px
  - tiktok: Montserrat 800 white #FFFFFF bg #8B5CF6 90% 14px 10px shadow blur 10 black center middle 56px scale anim
  - minimal, karaoke, news
- Your choice: **TikTok Style** (id=tiktok) — matches your screenshot bg #8B5CF6
- Auto-generate: button "Auto-generate" → uses wordTimings if exists else estimateWordTimings(text, duration) → cuesFromTimings → toast "Subtitles generated X cues"
- Cue list: Subtitle Segments, each cue id start end text

Exact:
await page.goto("http://localhost:5173/studio/subtitles")
await page.select_option('select', 'tiktok') or click div:has-text("TikTok Style")
# Or via code: studio.setStyle(TIKTOK_PRESET.style)
await page.click('button:has-text("Auto-generate")')

### 5. Adding Video — No Copyright Gameplay Background
Page: http://localhost:5173/studio/video (VideoCompositor.tsx)
- Video Background section: drag & drop zone "Drag & drop a video, or click to browse" + hidden file input + Import from YouTube card
- YouTube card: title Youtube icon Import from YouTube, form flex, input aria-label="YouTube video URL" placeholder "Paste a link — youtube.com/watch?v=…, youtu.be/…, /shorts/…", button Import / Importing…
- When importing: ProgressBar indeterminate + "Downloading from YouTube — long videos can take a minute."
- If video exists: videoName truncate + Badge + Remove

To find no-copyright gameplay:
- Use web_search with queries: "minecraft parkour no copyright free to use", "subway surfers gameplay no copyright background video", "roblox obby gameplay no copyright"
- Filter: look for videos marked Creative Commons, or channels that say "free to use", "no copyright", "background video"
- Good sources: YouTube search with filter Creative Commons, or specific no-copyright gameplay channels

Paste flow (existing Chrome, keeps login):
- Use window_manager_pro focus Chrome (not browser_control new Chromium)
- computer_control: ctrl+l, type http://localhost:5173/studio/video, enter, wait 4s, click input[aria-label="YouTube video URL"], ctrl+v, enter

API direct (single-user mode, ENTERPRISE, no auth needed after first request):
POST /api/v1/upload/youtube {{url}} → {{fileKey, name, size}}
GET /api/v1/upload/file/:fileKey → stream

Playwright for existing Chrome method:
await page.goto("http://localhost:5173/studio/video")
await page.wait_for_selector('[aria-label="YouTube video URL"]', timeout=10000)
await page.fill('[aria-label="YouTube video URL"]', 'https://youtube.com/watch?v=...')
await page.click('button:has-text("Import")')
await page.wait_for_selector('text=YouTube', timeout=120000)

### 6. Export with Default Settings
Export Settings panel:
- Video style radiogroup aria-label="Video style": Landscape 16:9 YouTube / Portrait 9:16 Shorts TikTok → **click Portrait**
- Description when 9:16: "Vertical video for YouTube Shorts, TikTok & Reels. Landscape footage is fitted with black bars."
- Length: Toggle label "End video with the voice" checked=true fitToVoice → both video and subtitles stop at audioDuration. If unchecked, slider "End video at"
- Resolution select ariaLabel="Resolution": 720p (720×1280) / 1080p / 1440p / 4K → **select 720p**
- Format select ariaLabel="Format": MP4 H.264 / WEBM VP9 → **MP4**
- Quality select ariaLabel="Quality": Low fast smaller / Medium / High slow larger → **Medium**
- Frame rate select ariaLabel="Frame rate": 24 fps / 30 fps / 60 fps → **60 fps**
- Estimated size: ~1.8 MB for your settings
- Export Video button: fullWidth size lg icon Clapperboard disabled if !audioBlob or cues.length==0 → click
- Exporting: ProgressBar + exportStatus + %
- When done: Download Video button icon Download → click → downloads final mp4

Exact:
await page.click('button[title="Portrait"]')
await page.click('[label="End video with the voice"]') # ensure checked
await page.select_option('[aria-label="Resolution"]', '720p')
await page.select_option('[aria-label="Format"]', 'mp4')
await page.select_option('[aria-label="Quality"]', 'medium')
await page.select_option('[aria-label="Frame rate"]', '60')
await page.click('button:has-text("Export Video")')
await page.wait_for_selector('button:has-text("Download Video")', timeout=300000)
await page.click('button:has-text("Download Video")')

### 7. Find No-Copyright Background & Download End Product
- After export, Download Video button downloads final product
- For background: search YouTube "minecraft parkour no copyright", "subway surfers no copyright 1 hour", "roblox obby no copyright background"
- Paste link via YouTube input, import, then export
- Final product is vertical 720p 60fps with TikTok style subtitles (#8B5CF6 bg) + voiceover + gameplay background, ends exactly when voice ends

Selectors summary:
{SELECTORS}
"""

def _generate_script(topic: str) -> str:
    topic = (topic or "motivational short story").strip()
    # Simple template for short story script — JARVIS can also use Gemini via anything_llm_bridge or magi_system for better
    templates = [
        f"Did you know {topic}? Here's a short story. Once upon a time, there was someone who never gave up. They faced challenges every day, but they kept going. Because they knew, success is not about being perfect, it's about being consistent. If you're watching this, this is your sign to keep pushing. Your time is coming.",
        f"Let me tell you a story about {topic}. A small step every day leads to big results. You don't need to be the best, you just need to start. The hardest part is beginning, but once you start, momentum carries you. So start today, not tomorrow. You've got this.",
        f"This is a story about {topic}. Imagine waking up and deciding today is the day you change. No more excuses. No more waiting. You take action, even if it's small. And those small actions, they compound. One day you look back and realize, you became the person you wanted to be.",
    ]
    import random
    # Deterministic pick based on topic hash for consistency
    idx = sum(ord(c) for c in topic) % len(templates)
    script = templates[idx]
    # Trim to ~300 chars for TikTok Shorts (60 sec voiceover ~130 words)
    if len(script) > 400:
        script = script[:400].rsplit('.', 1)[0] + "."
    return script

def _find_gameplay_queries(bg_type: str):
    bg_type = (bg_type or "random").lower()
    key = bg_type
    if key not in NO_COPYRIGHT_QUERIES:
        key = "random"
    return NO_COPYRIGHT_QUERIES[key]

def _search_no_copyright(bg_type: str):
    queries = _find_gameplay_queries(bg_type)
    guide = f"To find no-copyright {bg_type} background gameplay:\n\n"
    for q in queries:
        guide += f"- Search YouTube: \"{q}\" + filter Creative Commons\n"
    guide += """
Best practices:
- Look for titles containing "no copyright", "free to use", "background video", "1 hour", "free background"
- Channels: search "minecraft parkour no copyright free use" — many upload 1 hour loops explicitly free
- Check description: should say "free to use", "no copyright", "creative commons"
- Avoid music: choose gameplay with no music or YouTube audio library music
- For TikTok: vertical footage preferred, but landscape will be fitted with black bars (your export does that automatically)
- Good examples:
  * Minecraft: "Minecraft Parkour Gameplay No Copyright Free Background 1 Hour"
  * Subway Surfers: "Subway Surfers Gameplay No Copyright Background Video 1 Hour"
  * Roblox: "Roblox Obby Gameplay No Copyright Free To Use Background"

After finding URL, use action=add_background youtube_url=URL method=existing_chrome to paste into Soundwave.
"""
    return guide

def run(parameters, player=None, session_memory=None):
    def log(msg):
        if player and hasattr(player, 'write_log'):
            try:
                player.write_log(msg)
            except:
                pass

    action = (parameters.get("action") or "guide").strip().lower()
    topic = parameters.get("topic") or ""
    text = parameters.get("text") or ""
    voice = parameters.get("voice") or "Jenny"
    bg_type = parameters.get("background_type") or "random"
    yt_url = parameters.get("youtube_url") or ""
    method = parameters.get("method") or "auto"

    log(f"Soundwave simple edition action={action}")

    if action == "guide":
        return _guide()

    if action == "generate_script":
        if not topic:
            topic = "motivational story about never giving up"
        script = _generate_script(topic)
        return f"""Generated short story script for topic '{topic}' (for voiceover, ~60 sec TikTok):

\"{script}\"

Next:
1. Use action=add_text text="..." to put into studio-text
2. action=choose_voice voice=Jenny
3. action=generate_voice
4. Then tiktok_style + auto_generate_subtitles
5. find_gameplay background_type=minecraft/subway_surfers/roblox
6. add_background youtube_url=... method=existing_chrome
7. export_portrait_default
8. download_video

Selectors: textarea #studio-text, button Generate Speech"""

    if action == "add_text":
        actual_text = text or _generate_script(topic or "motivational")
        return f"""To add text to Soundwave Studio (single-user edition, no login):

Page: http://localhost:5173/studio
Textarea: id="studio-text" placeholder "Enter the text you want to convert to speech..."

Exact steps for JARVIS:
1. browser_control action=open url=http://localhost:5173/studio
   BUT use existing Chrome to keep session: window_manager_pro action=focus name=Chrome, then computer_control hotkey=ctrl+l, type_text=http://localhost:5173/studio, press=enter, wait 4s
2. accessibility_master action=find text="Text" or click at textarea
3. computer_control action=type_text text="{actual_text[:100]}..." (full text below)
4. OR Playwright: await page.fill('#studio-text', `{actual_text}`)

Full text to add:
\"{actual_text}\"

After adding, say "choose_voice voice={voice}" then "generate_voice"
"""

    if action == "choose_voice":
        return f"""Choose voice {voice} in Soundwave Studio:

Page: http://localhost:5173/studio
Component: VoicePicker — DEFAULT_VOICES Jenny, Ana, Sonia, Christopher, Guy, Ryan

Steps:
1. Focus Chrome window with Soundwave
2. Find voice card text="{voice}" via accessibility_master find or vision_bridge
3. Click it: mouse_master_pro click or accessibility_master click
4. Verify: Selected: {voice} badge

Playwright:
await page.click('text={voice}')
or await page.select_option('[aria-label="Voice"]', '{voice}')

Voices:
- Jenny (American, friendly, best for TikTok)
- Ana (American, warm)
- Sonia (British)
- Christopher (British, deep)
- Guy (American, mature)
- Ryan (British)

For TikTok short story, recommend Jenny or Guy.

Next: action=generate_voice"""

    if action == "generate_voice":
        return """Generate voice in Studio:

Page: http://localhost:5173/studio
Button: "Generate Speech" → "Generating… ⚡"

Steps:
1. Ensure text in #studio-text and voice selected
2. Click button:has-text("Generate Speech")
   - computer_control click or browser_master click selector button:has-text("Generate Speech")
   - Playwright: await page.click('button:has-text("Generate Speech")')
3. Wait for "Audio ready" toast: wait 30-60 sec, wordTimings generated
4. Auto-plays after 150ms, AudioPlayer shows waveform

API direct (single-user ENTERPRISE, no auth):
POST http://localhost:4000/api/v1/tts/synthesize
{{"text": "your script", "voice": "en-US-JennyNeural", "speed": "1.0", "pitch": "+0Hz"}}

After generating, go to subtitles: action=tiktok_style then auto_generate_subtitles
"""

    if action == "tiktok_style":
        return f"""Set TikTok Style subtitles (your screenshot style):

Page: http://localhost:5173/studio/subtitles
Preset: id=tiktok name="TikTok Style" — Montserrat 800, color #FFFFFF, bg #8B5CF6 90% 14px padding 10px radius shadow blur 10 black center middle 56px scale anim — matches your screenshot bg #8B5CF6

Exact steps:
1. Navigate to http://localhost:5173/studio/subtitles (existing Chrome: focus Chrome, ctrl+l, type url, enter, wait 4s)
2. Find preset select placeholder "Apply a preset…" 
   - accessibility_master find text="Apply a preset"
   - or Select component
3. Select TikTok Style:
   - computer_control: click select, then click div:has-text("TikTok Style")
   - Playwright: await page.select_option('select', 'tiktok') or await page.click('text=TikTok Style')
   - Or via API: studio.setStyle({SELECTORS})
4. Verify: preview shows white text on purple #8B5CF6 background center middle

Style details from subtitlePresets.ts:
{TIKTOK_PRESET}

Next: action=auto_generate_subtitles
"""

    if action == "auto_generate_subtitles":
        return """Auto-generate subtitles from voiceover:

Page: http://localhost:5173/studio/subtitles
Button: "Auto-generate" in Subtitle Segments section

Steps:
1. Ensure audio generated (hasAudio true, wordTimings exist)
2. Click button:has-text("Auto-generate")
   - Playwright: await page.click('button:has-text("Auto-generate")')
3. Toast: "Subtitles generated X cues created"
4. Cue list shows segments, preview shows active cue

Code: autoGenerate() uses studio.wordTimings if exists else estimateWordTimings(text, duration) → cuesFromTimings(timings)

If no audio yet: will warn "No content Generate audio or enter text first"

Next: find_gameplay background_type=minecraft/subway_surfers/roblox
"""

    if action in ("find_gameplay", "search_no_copyright"):
        return _search_no_copyright(bg_type)

    if action == "add_background":
        if not yt_url:
            # Suggest queries
            queries = _find_gameplay_queries(bg_type)
            return f"""Add background gameplay — you didn't provide youtube_url.

To find no-copyright {bg_type} gameplay, search YouTube:
{chr(10).join(f"- {q}" for q in queries)}

Then use:
action=add_background youtube_url=https://youtube.com/watch?v=... method=existing_chrome background_type={bg_type}

Method explained:
- api: POST /api/v1/upload/youtube {{url}} → fileKey → /api/v1/upload/file/:fileKey (needs backend running at :4000, single-user mode auto ENTERPRISE)
- existing_chrome: uses your logged-in Chrome (window_manager_pro focus Chrome, ctrl+l, type http://localhost:5173/studio/video, wait 4s, click input[aria-label="YouTube video URL"], ctrl+v, enter) — RECOMMENDED for your case (you said new Chrome without login failed)
- clipboard: copies URL to clipboard, you paste manually into YouTube input
- auto: tries api then existing_chrome then clipboard

Your previous JARVIS did clipboard fallback because backend not running. To make api work, run server npm run dev at :4000.

For your double-nested path:
cd "C:\\Users\\Strahinja\\Downloads\\Soundwave-AI-arena-01a0a795-soundwave-ai\\Soundwave-AI-arena-01a0a795-soundwave-ai\\Mark-LIV"
python main.py
Then say "Focus window Chrome" not "Open"
"""
        # Provide exact steps for given URL
        return f"""Add background video {yt_url} type {bg_type} method {method}:

Page: http://localhost:5173/studio/video
Input: aria-label="YouTube video URL" placeholder "Paste a link — youtube.com/watch?v=…, youtu.be/…, /shorts/…"
Button: Import / Importing…

Method {method} steps:

If method=api or auto (tries api first):
- Backend must be running: cd server && npm run dev at :4000 (single-user mode auto ENTERPRISE)
- POST http://localhost:4000/api/v1/upload/youtube {{"url": "{yt_url}"}} → {{fileKey, name, size}}
- Stream URL: /api/v1/upload/file/{{fileKey}}
- Frontend sets videoUrl, videoName, videoFileKey, studio.setVideo({{blob, url, name, fileKey}})
- Badge violet YouTube appears

If method=existing_chrome (RECOMMENDED for you — keeps login):
1. window_manager_pro action=list → find Chrome
2. window_manager_pro action=focus name=Chrome
3. computer_control action=hotkey keys=ctrl+l
4. computer_control action=type_text text=http://localhost:5173/studio/video
5. computer_control action=press key=enter
6. Wait 4 seconds (React SPA load)
7. accessibility_master action=find text="Import from YouTube" or find input
8. mouse_master_pro action=click x,y of input[aria-label="YouTube video URL"] or accessibility_master click
9. computer_control action=type_text text={yt_url} or hotkey ctrl+v if already in clipboard
10. computer_control action=press key=enter or click button:has-text("Import")
11. Wait for ProgressBar "Downloading from YouTube — long videos can take a minute." → Badge YouTube

Playwright exact for existing Chrome workaround (if you want new browser but logged in):
- Log into Soundwave in new Chrome window first, then run same steps

If method=clipboard:
- pyperclip.copy("{yt_url}")
- Tell user "Paste into YouTube input"

After adding, set export settings: action=export_portrait_default
"""

    if action in ("export_portrait_default", "export_video"):
        return f"""Export with YOUR default settings (from screenshot):

Settings you want (Portrait TikTok):
- Video style: Portrait 9:16 · Shorts · TikTok (not Landscape 16:9 YouTube)
- End video with the voice: ON (fitToVoice=true) → both video and subtitles stop at voiceover duration {DEFAULT_EXPORT['dims']}
- Resolution: 720p (720×1280) portrait — dimsLabel swaps axes for 9:16
- Format: MP4 (H.264)
- Quality: Medium
- Frame rate: 60 fps
- Estimated size: ~1.8 MB

Page: http://localhost:5173/studio/video
Selectors:
- Video style radiogroup aria-label="Video style" → button title Portrait
- Toggle label "End video with the voice" → checked
- Resolution select ariaLabel="Resolution" → 720p
- Format select ariaLabel="Format" → mp4
- Quality select ariaLabel="Quality" → medium
- Frame rate select ariaLabel="Frame rate" → 60
- Export Video button → Download Video button

Exact steps (existing Chrome):
1. Focus Chrome window with /studio/video
2. Click Portrait: accessibility_master find text="Portrait" or browser_master click selector button[title="Portrait"] or button:has-text("Portrait")
3. Ensure End video with voice toggle ON: find toggle label "End video with the voice" → if not checked, click it
4. Select 720p: click [aria-label="Resolution"] → click div:has-text("720p") or Playwright select_option
5. Select MP4: click [aria-label="Format"] → MP4 (H.264)
6. Select Medium: [aria-label="Quality"] → Medium
7. Select 60 fps: [aria-label="Frame rate"] → 60 fps
8. Click Export Video: button:has-text("Export Video") (Clapperboard icon) — disabled if !audioBlob or cues.length==0, so ensure voice + subtitles done
9. Wait for ProgressBar export progress + exportStatus, % → Download Video button appears
10. Click Download Video → downloads final mp4 vertical 720x1280 60fps TikTok style purple bg with gameplay background, ends when voice ends

Playwright:
await page.click('button[title="Portrait"]')
# Ensure toggle checked
toggle = page.locator('[label="End video with the voice"]')
if not await toggle.is_checked(): await toggle.click()
await page.select_option('[aria-label="Resolution"]', '720p')
await page.select_option('[aria-label="Format"]', 'mp4')
await page.select_option('[aria-label="Quality"]', 'medium')
await page.select_option('[aria-label="Frame rate"]', '60')
await page.click('button:has-text("Export Video")')
await page.wait_for_selector('button:has-text("Download Video")', timeout=300000)
await page.click('button:has-text("Download Video")')

API direct export (single-user ENTERPRISE):
POST /api/v1/export/video with {{
  resolution: "720p",
  aspect: "9:16",
  format: "mp4",
  quality: "medium",
  fps: 60,
  fitToVoice: true,
  audioVolume: 100,
  fadeIn: 0,
  fadeOut: 0
}}

Next: action=download_video
"""

    if action == "download_video":
        return """Download final product:

Page: http://localhost:5173/studio/video
After export, Download Video button appears (outline variant, icon Download)

Steps:
1. Click button:has-text("Download Video")
2. Browser downloads mp4 to Downloads folder
3. File is vertical 720x1280 60fps MP4 H.264 Medium ~1.8 MB with:
   - Voiceover (Jenny etc.)
   - TikTok style subtitles white #FFFFFF on purple #8B5CF6 bg 90% 14px 10px radius center middle 56px
   - Gameplay background (minecraft/subway surfers/roblox no copyright)
   - Ends exactly when voice ends (fitToVoice)

To find file: check ~/Downloads or browser download bar

If you want JARVIS to move file: use file_commander action=recent or file_organizer_pro
"""

    if action in ("full_tiktok_workflow", "tiktok_workflow"):
        if not topic:
            topic = "motivational short story about never giving up"
        script = _generate_script(topic)
        queries = _find_gameplay_queries(bg_type)
        return f"""FULL TIKTOK WORKFLOW — Single-User Edition (no login) — Topic: {topic}, Voice: {voice}, Background: {bg_type}

This is the complete autopilot you asked for. JARVIS will do every button.

**Step 0: Ensure Soundwave running (single-user mode)**
```powershell
cd "C:\\Users\\Strahinja\\Downloads\\Soundwave-AI-arena-01a0a795-soundwave-ai\\Soundwave-AI-arena-01a0a795-soundwave-ai\\server"
npm run dev
# Terminal 2
cd "..\\frontend"
npm run dev
# Open http://localhost:5173
```

**Step 1: Generate script**
Topic: {topic}
Script (150-300 chars for 60 sec Shorts):
"{script}"

Action: add_text text="..." 
- Focus Chrome window (existing, logged in — single-user no login needed but keep session)
- Navigate http://localhost:5173/studio
- Fill #studio-text with script
Playwright: await page.fill('#studio-text', `{script}`)

**Step 2: Choose voice {voice}**
- Click voice card {voice} in VoicePicker
- Recommended for TikTok: Jenny (friendly) or Guy (mature)

**Step 3: Generate voice**
- Click Generate Speech → wait Audio ready toast 30-60s
- AudioBuffer duration ~ 20-40 sec for this script

**Step 4: TikTok subtitles style**
- Navigate http://localhost:5173/studio/subtitles
- Select preset TikTok Style id=tiktok (Montserrat 800 white on #8B5CF6 purple 90% 14px 10px radius center middle 56px scale)
- Your screenshot shows this bg #8B5CF6

**Step 5: Auto-generate subtitles**
- Click Auto-generate button → X cues created from wordTimings

**Step 6: Find no-copyright gameplay background**
Background type {bg_type} — search queries:
{chr(10).join(f"- {q}" for q in queries)}

- Use web_search action=search query="minecraft parkour no copyright free to use" etc.
- Look for Creative Commons filter, titles "no copyright", "free to use", "background video", "1 hour"
- Good channels: no-copyright gameplay loops
- Pick URL e.g., https://youtube.com/watch?v=... (ensure no music or YouTube audio library)

**Step 7: Add background**
- Use existing_chrome method to keep login:
  window_manager_pro focus Chrome
  computer_control ctrl+l, type http://localhost:5173/studio/video, enter, wait 4s
  click input[aria-label="YouTube video URL"]
  type URL
  press enter / click Import
- Wait "Downloading from YouTube" → Badge YouTube

**Step 8: Export with YOUR default (Portrait TikTok)**
- Video style: Portrait 9:16 Shorts TikTok
- End video with voice: ON
- Resolution: 720p (720x1280)
- Format: MP4 H.264
- Quality: Medium
- Frame rate: 60 fps
- Estimated ~1.8 MB (your screenshot)
- Click Export Video → wait Download Video appears

**Step 9: Download**
- Click Download Video → saves to Downloads
- Final product: vertical 720x1280 60fps MP4 with TikTok purple subtitles + {voice} voiceover + {bg_type} gameplay, ends when voice ends

Voice commands to trigger full workflow:
"Full TikTok workflow topic {topic} voice {voice} background {bg_type}"
or
"Generate short story about {topic}, use Jenny voice, TikTok style subtitles, find minecraft parkour no copyright background, export portrait 720p 60fps and download"

For your double-nested path:
cd "C:\\Users\\Strahinja\\Downloads\\Soundwave-AI-arena-01a0a795-soundwave-ai\\Soundwave-AI-arena-01a0a795-soundwave-ai\\Mark-LIV"
python main.py
Then say full workflow command
"""

    return f"Unknown action {action}. Use guide, generate_script, add_text, choose_voice, generate_voice, tiktok_style, auto_generate_subtitles, find_gameplay, add_background, export_portrait_default, full_tiktok_workflow. Your screenshot defaults: Portrait 9:16, 720p (720x1280), MP4 H.264, Medium, 60fps, End with voice ON, TikTok style #8B5CF6 bg."
