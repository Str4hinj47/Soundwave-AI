# Soundwave Simple Edition Autopilot — Teach JARVIS Every Button (arena/01a08864-soundwave-ai)

**Branch:** `arena/01a08864-soundwave-ai` — 13 commits ahead of main, SINGLE_USER_MODE=true, no login, ENTERPRISE plan, no subscription.
**Your screenshots:**
- Export Settings: Portrait 9:16 Shorts TikTok, End video with the voice ON, 720p (720×1280), MP4 H.264, Medium, 60 fps, ~1.8 MB
- Subtitles page: /studio/subtitles with Minimal/Karaoke/News Ticker, Extra-Bold 800, letter spacing 0px, line height 1.2, Text color #FFFFFF, Background #8B5CF6 90% 14px 10px radius

**Goal:** JARVIS does: Generate short story script → Choose voice → Generate voice → TikTok style + Auto-generate → Find no-copyright minecraft/subway surfers/roblox gameplay → Paste YouTube link → Export Portrait default → Download

## New Plugin: soundwave_simple_edition.py

**Location:** `Mark-LIV/plugins/soundwave_simple_edition.py` and `mark-liii-plugins/soundwave_simple_edition.py` — 46 plugins total now (47 files source, 49 in Mark-LIV with template+init+helper).

**Actions:**
- `guide` — full button guide with exact selectors
- `generate_script topic="a cat who learns to code"` — generates 150-300 char short story for 60 sec TikTok
- `add_text text="..."` — puts text into #studio-text
- `choose_voice voice=Jenny` — Jenny/Ana/Sonia/Christopher/Guy/Ryan
- `generate_voice` — clicks Generate Speech
- `tiktok_style` — selects TikTok Style preset (Montserrat 800 white #FFFFFF on #8B5CF6 purple 90% 14px 10px radius center middle 56px scale) — matches your screenshot
- `auto_generate_subtitles` — clicks Auto-generate button
- `find_gameplay background_type=minecraft|subway_surfers|roblox|minecraft_parkour|gta|random` — gives YouTube search queries for no-copyright gameplay
- `search_no_copyright` — same
- `add_background youtube_url=https://... method=existing_chrome|api|clipboard|auto` — adds background via YouTube paste, **existing_chrome keeps your logged-in Chrome** (fixes your bug where new Chrome without login failed)
- `export_portrait_default` / `export_video` — sets Portrait 9:16, End with voice ON, 720p 720x1280, MP4 H.264, Medium, 60fps, ~1.8MB, clicks Export Video
- `download_video` — clicks Download Video
- `full_tiktok_workflow topic="motivational story" voice=Jenny background_type=minecraft` — full autopilot end-to-end
- `tiktok_workflow` — alias

## Exact Selectors (from frontend/src/pages/)

**Studio (/studio):**
- Textarea: `id="studio-text"` placeholder "Enter the text you want to convert to speech..."
- Generate Speech: `button:has-text("Generate Speech")` → "Generating… ⚡"
- VoicePicker: `VoicePicker` component, options Jenny etc.
- Speed/Pitch sliders

**Subtitles (/studio/subtitles):**
- Preset select: placeholder "Apply a preset…" → id=tiktok name="TikTok Style" (Montserrat 800 #FFFFFF text #8B5CF6 bg 90% 14px 10px radius middle center 56px scale)
- Auto-generate: `button:has-text("Auto-generate")`
- Preview 16:9, grid toggle, drag to position customX/customY 0-100%

**Video (/studio/video):**
- YouTube input: `[aria-label="YouTube video URL"]` placeholder "Paste a link — youtube.com/watch?v=…, youtu.be/…, /shorts/…"
- Import button: `button:has-text("Import")` / "Importing…"
- Video style radiogroup: `[aria-label="Video style"]` buttons title Portrait "9:16 · Shorts · TikTok" / Landscape "16:9 · YouTube"
- End video with voice toggle: label "End video with the voice" (fitToVoice)
- Resolution: `[aria-label="Resolution"]` → 720p (720×1280 portrait)
- Format: `[aria-label="Format"]` → MP4 (H.264)
- Quality: `[aria-label="Quality"]` → Medium
- Frame rate: `[aria-label="Frame rate"]` → 60 fps
- Export Video: `button:has-text("Export Video")` Clapperboard icon, disabled if !audioBlob or cues.length==0
- Download Video: `button:has-text("Download Video")`

## Your Double-Nested Path Fix

Your screenshot shows:
```
C:\Users\Strahinja\Downloads\Soundwave-AI-arena-01a0a795-soundwave-ai\Soundwave-AI-arena-01a0a795-soundwave-ai
```

Inside: Mark-LIV, mark-liii-plugins, docs, etc.

**Use this for all commands:**
```powershell
$ROOT = "C:\Users\Strahinja\Downloads\Soundwave-AI-arena-01a0a795-soundwave-ai\Soundwave-AI-arena-01a0a795-soundwave-ai"
cd "$ROOT\Mark-LIV"
python main.py
```

**For Soundwave simple edition (your new branch arena/01a08864-soundwave-ai):**
```powershell
cd "C:\Users\Strahinja\Downloads\Soundwave-AI-arena-01a08864-soundwave-ai\Soundwave-AI-arena-01a08864-soundwave-ai"
# Or wherever you cloned arena/01a08864
cd frontend
npm run dev
# Terminal 2
cd ..\server
npm run dev
# Open http://localhost:5173
```

## Full Voice Workflow — What to Say to JARVIS

**One command does everything:**
```
"Full TikTok workflow topic a cat who learns to code voice Jenny background minecraft"
```

**Or step by step:**

1. Generate script:
```
"Generate script topic motivational story about never giving up"
```
→ Returns 150-300 char story

2. Add text:
```
"Add text this is my story..."
```
→ Fills #studio-text via existing Chrome (not new Chromium)

3. Choose voice:
```
"Choose voice Jenny"
```

4. Generate voice:
```
"Generate voice"
```
→ Clicks Generate Speech, waits Audio ready

5. TikTok style:
```
"TikTok style"
```
→ Selects TikTok Style preset #8B5CF6 purple bg

6. Auto-generate subtitles:
```
"Auto generate subtitles"
```

7. Find background gameplay:
```
"Find gameplay minecraft"
```
or
```
"Find gameplay subway_surfers"
"Find gameplay roblox"
```
→ Returns search queries like "minecraft parkour no copyright free to use"

8. Add background (use existing_chrome to keep login):
```
"Add background youtube_url https://www.youtube.com/watch?v=dQw4w9WgXcQ method existing_chrome background_type minecraft"
```
→ Focuses existing Chrome, ctrl+l, types http://localhost:5173/studio/video, wait 4s, clicks input[aria-label="YouTube video URL"], ctrl+v, enter, waits Badge YouTube

9. Export with your default:
```
"Export portrait default"
```
→ Clicks Portrait, ensures End with voice ON, selects 720p MP4 Medium 60fps, clicks Export Video

10. Download:
```
"Download video"
```
→ Clicks Download Video, saves to Downloads

## No-Copyright Gameplay — How JARVIS Finds It

**Search queries built-in:**
- minecraft: "minecraft parkour no copyright free to use", "minecraft gameplay no copyright background", "minecraft no copyright 1 hour"
- subway_surfers: "subway surfers gameplay no copyright", "subway surfers no copyright background video", "subway surfers 1 hour no copyright"
- roblox: "roblox obby gameplay no copyright", "roblox parkour no copyright background", "roblox gameplay free to use no copyright"

**JARVIS uses web_search action:**
```
web_search query="minecraft parkour no copyright free to use" mode=search
```
Then filters titles containing "no copyright", "free to use", "background video", "1 hour", "free background"

**Good sources:**
- YouTube Creative Commons filter
- Channels that explicitly say "free to use", "no copyright background"
- Avoid music — choose gameplay with no music or YouTube audio library music
- For TikTok: vertical preferred, but landscape fitted with black bars automatically (your export does that)

**After finding URL:**
- Use add_background with that URL
- Then export + download

## Default Export Settings (Your Screenshot)

From your image-2.png:
- Video style: Portrait 9:16 Shorts TikTok
- End video with the voice: toggle ON (checked) → fitToVoice=true → both video and subtitles stop at voiceover duration
- Resolution: 720p (720×1280) — dimsLabel swaps axes for 9:16, so 720p becomes 720×1280 portrait
- Format: MP4 (H.264)
- Quality: Medium
- Frame rate: 60 fps
- Estimated size: ~1.8 MB

This is now default in plugin action export_portrait_default.

## Why New Chrome Failed Before

You said: "he opened it in a brand new chrome, instead of the one already logged into soundwave and couldnt complete the action"

Cause: browser_master uses Playwright which launches new Chromium isolated, no cookies/JWT, so not logged into Soundwave (even though simple edition has no login, still needs session).

Fix: method=existing_chrome uses window_manager_pro focus Chrome + computer_control (pyautogui) on existing logged-in Chrome, keeps session.

New plugin defaults to auto which tries api then existing_chrome then clipboard — so it will now use existing Chrome and succeed.

## Test It Now

1. Update Mark-LIV plugins (you already have new plugin if you re-download arena zip, or copy):
```powershell
cd "C:\Users\Strahinja\Downloads\Soundwave-AI-arena-01a0a795-soundwave-ai\Soundwave-AI-arena-01a0a795-soundwave-ai\Mark-LIV"
dir plugins\*.py | Measure-Object
# Should be 49 now (was 48)
```

2. Run JARVIS:
```powershell
python main.py
```

3. Say:
```
"Guide for simple edition"
```
→ Returns full button guide

Then:
```
"Full TikTok workflow topic a dog who wants to be astronaut voice Jenny background subway_surfers"
```

Watch him do every button.

## For arena/01a08864-soundwave-ai Branch Itself

If you want JARVIS to also control that branch's Soundwave UI directly (not via Mark-LIV), you can copy the plugin to that branch's Mark-LIV if you have it, or just use same Mark-LIV to control localhost:5173 which runs simple edition.

Simple edition has no login, so api method will now work even in new Chrome — but existing_chrome still recommended for stability.

Enjoy — JARVIS now knows every button: generate script, choose voice, generate voice, TikTok style, auto-generate, find no-copyright minecraft/subway/roblox gameplay, paste link, export Portrait 720p MP4 Medium 60fps End-with-voice, download.
