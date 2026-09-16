# Teaching JARVIS (Mark LIII) to Use Soundwave AI

This guide explains how Mark LIII JARVIS (https://github.com/FatihMakes/Mark-LIII) can use Soundwave AI as its voice studio.

## The Bridge: Bidirectional Expertise

We built **two-way expertise**:

1. **Soundwave knows Mark-LIII** — `server/src/lib/markLiiiKnowledge.ts` + `/api/v1/jarvis/*` + frontend `/jarvis` page chat expert that knows Mark-LIII actions, core, memory, wake word, etc. + plugin generator
2. **JARVIS knows Soundwave** — `mark-liii-plugins/` folder with 7 drop-in plugins teaching Mark LIII JARVIS to use Soundwave AI TTS, voices, projects, video export, YouTube import, cloning

This doc covers #2.

## Why Teach JARVIS to Use Soundwave?

Mark LIII is a real-time voice assistant (Gemini Live API, PyQt6 HUD, wake word, self-describing skills). Soundwave AI is a production TTS + video studio (6 Microsoft Neural voices via free Edge TTS, FFmpeg video compositing, subtitles, YouTube import).

By teaching JARVIS to use Soundwave:

- JARVIS can generate studio-quality voiceovers with Soundwave's 6 Neural voices (Jenny, Ana, Sonia, Christopher, Guy, Ryan) — same free Edge TTS engine but via Soundwave's curated voices + word timings + SRT generation
- JARVIS can manage Soundwave projects (~/Soundwave/projects/)
- JARVIS can create videos with burned-in subtitles (16:9 + 9:16 portrait for Shorts/TikTok/Reels) via FFmpeg workflow
- JARVIS can import YouTube videos as backgrounds via yt-dlp
- JARVIS can clone voices via OmniVoice sidecar
- JARVIS becomes a full media producer, not just a voice assistant

## Soundwave AI — What JARVIS Needs to Know

### Voices (6 Microsoft Neural, Edge TTS, 24kHz mono MP3, free, no API key)

| Voice | Gender | Accent | Style | Use Case |
|-------|--------|--------|-------|----------|
| Jenny (en-US-JennyNeural) | Female | American | Warm, friendly, versatile | Narration, explainer, YouTube |
| Ana (en-US-AnaNeural) | Female | American | Young, energetic, upbeat | TikTok, Reels, ads |
| Sonia (en-GB-SoniaNeural) | Female | British | Elegant British, professional | Corporate, audiobook, documentary |
| Christopher (en-US-ChristopherNeural) | Male | American | Deep, authoritative | Trailer, podcast, presentation |
| Guy (en-US-GuyNeural) | Male | American | Casual, conversational | Vlog, tutorial, friendly |
| Ryan (en-GB-RyanNeural) | Male | British | British male, clear | News, education, formal |

Samples: `/voice-samples/<voiceId>.mp3` in Soundwave frontend/public/voice-samples/

### TTS Engine

- **Server-side**: `server/src/lib/edgeTts.ts` uses `node-edge-tts` (free, key-less Edge online TTS) — `EdgeTTS` class with voice, lang derived from voice id, outputFormat `audio-24khz-96kbitrate-mono-mp3`, saveSubtitles true, rate/pitch/volume mapped to SSML, timeout 20s, writes MP3 + JSON cues, wordTimings {word, start, end}, duration from last cue or MP3 byte length estimate
- **Client-side**: `frontend/src/hooks/useTTS.ts` calls POST /api/v1/tts/synthesize with {text, voice, speed, pitch, volume} → {audioBase64, mimeType, duration, wordTimings, used, limit, resetDate}, decodes base64 to Blob, AudioBuffer via decodeAudioBlob, timings via cuesFromTimings or estimateWordTimings, quota enforced server-side via getQuotaFor(), fallback to offline formant synthesizer (createOfflineEngine) if API unreachable — surfaced as demo voice
- **Python equivalent**: `edge-tts` library — `edge_tts.Communicate(text, voice, rate, pitch, volume).save(output_path)` — same Microsoft service

### Projects

- Schema: title 1-120, type TTS|SUBTITLE|VIDEO, textContent 20k max, voiceId, voiceSettings, characterCount, duration, subtitleData, subtitleStyle, videoBackgroundUrl, audioUrl, status DRAFT|PROCESSING|COMPLETED|FAILED, storageType CLOUD|LOCAL
- API: GET /api/v1/projects (list), POST / (create, Pro+), GET /:id, PUT /:id, PUT /:id/subtitles, DELETE /:id, POST /:id/duplicate
- Free: local only (IndexedDB via idb.ts + localProjects.ts), Pro: cloud save via Prisma/Postgres or JSON-file fallback
- Frontend: Dashboard recent projects, Projects page list, Studio save via saveLocalProject or cloud API

### Video Compositing

- Frontend: `VideoCompositor.tsx` — background video optional (solid color if none), portrait 9:16 first-class for Shorts/TikTok/Reels, all resolutions supported (1080p → 1080x1920)
- Backend: `server/src/routes/export.ts` — POST /api/v1/export/video with videoFileKey nullable, audioFileKey, subtitleData array {start, end, text} max 2000, subtitleStyle, exportSettings {resolution 720p/1080p/1440p/4K, aspect 16:9/9:16 default 16:9, format mp4/webm, quality low/medium/high, fps 24-60, audioVolume 0-2, fadeIn/out 0-30, videoEnd optional cut at seconds}
- FFmpeg: `server/src/lib/ffmpeg.ts` — runFfmpegExport with libx264/libvpx-vp9, libass subtitles + ASS watermark (static build has no drawtext, so watermark via libass), volume/fades, media probing, looping if video shorter than voice (via -stream_loop or concat), solid color generation via lavfi color source `color=c=0x0A0F1C:s=WxH:d=seconds:r=30` with libx264 veryfast
- Jobs: createJob with QUEUED, processJob updates PROCESSING with progress 2 → 99 via onProgress callback, COMPLETED with outputUrl /api/v1/export/jobs/:id/download or FAILED with errorMessage, outputDir uploads/jobs/, ext mp4/webm, emit via EventEmitter jobEvents, SSE stream via /jobs/:id/events with heartbeat every 15s, download via createReadStream
- Quotas: Free 2 exports/hour 720p watermark, Pro 20/hour 1080p, Enterprise 100/hour 4K no watermark, resolutionAllowed check, countJobsSince for rate limit
- FFmpeg availability: resolveFfmpegPath() env FFMPEG_PATH → vendor/ffmpeg/ffmpeg → /usr/bin/ffmpeg → ffmpeg, spawnSync -version check, assertFfmpeg throws 503 with actionable message (Windows winget install ffmpeg, Linux sudo apt install ffmpeg)

### YouTube Import

- `server/src/lib/ytdlp.ts` — yt-dlp wrapper, vendored zipapp vendor/yt-dlp/yt-dlp auto-detected (needs python3), override via YTDLP_PATH env, YTDLP_COOKIES optional cookies.txt for age/bot-gated, YTDLP_MAX_DURATION caps length, YTDLP_TIMEOUT_MS 240s, uses spawn to run yt-dlp
- API: POST /api/v1/upload/youtube with {url} → downloads via yt-dlp, returns fileKey, GET /file/:key streams with Range support for previews
- Frontend: Video Compositor → Import from YouTube button

### Voice Cloning

- `server/src/lib/voiceclone.ts` — OmniVoice sidecar, optional, stateless so can run on ephemeral free hosting, config VOICECLONE_URL empty = off, VOICECLONE_TOKEN shared secret for public URL (Hugging Face Space, tunnel, remote GPU), VOICECLONE_MIN_PLAN default FREE, timeout 600s (CPU slow)
- API: GET /clone/status {configured, available} via probeVoiceClone(), GET /profiles listCloneProfiles(userId), POST /profiles multipart file+name+refText+consent via createCloneProfile (sniffAudio validates WAV/MP3/FLAC/OGG/M4A, 25MB max, magic-byte), DELETE /profiles/:id via deleteCloneProfile, POST /clone {text, profileId, speed} → {audioBase64, mimeType, duration, wordTimings} same quota accounting
- Storage: reference clips per-user <dataDir>/voice-clips/<userId>/
- Frontend: Studio voiceTab neural|clone, cloneConfigured + cloneAvailable, cloneProfiles, clone modal with file+name+refText+consent, http.upload with 300s timeout, http.del for delete

## Plugins — How JARVIS Uses Soundwave

### Shared Helper `_soundwave_client.py`

Not a plugin (starts with _), imported by others:

- `SOUNDWAVE_VOICES` list with id, displayName, gender, accent, style
- `get_voice(voice_id)` — resolves id or display name
- `resolve_api_url()` — env SOUNDWAVE_API_URL > config/api_keys.json soundwave_url > default http://localhost:4000
- `get_api_key()` — env SOUNDWAVE_API_KEY
- `synthesize_edge_tts(text, voice, output_path, speed, pitch, volume)` — direct Edge TTS via edge-tts library, maps speed 0.5-2.0 → rate +%, pitch -50..50 → +Hz, volume 0-100 → +%, saves to ~/Soundwave/tts/, handles asyncio loop detection
- `play_audio(file_path)` — cross-platform: os.startfile Windows, open macOS, xdg-open/mpv/vlc Linux
- `api_request(method, path, json_data, timeout)` — requests library, handles Authorization Bearer + X-API-Key headers, raises RuntimeError on failure
- `list_soundwave_voices_api()` — GET /api/v1/voices fallback to local metadata
- `synthesize_via_soundwave_api(text, voice, speed, pitch, volume)` — POST /api/v1/tts/synthesize
- `save_base64_mp3(b64, output_path)` — base64 decode to MP3
- `text_to_srt_cues(text, duration)` — splits text into sentences, distributes duration by char ratio
- `save_srt(cues, path)` — writes SRT with HH:MM:SS,mmm format

### Plugin `soundwave_tts.py`

**Name**: soundwave_tts
**Description**: Generates studio-quality speech using Soundwave AI's Microsoft Neural voices (Edge TTS, free, no API key). Use when user asks to generate speech, create voiceover, say something with specific voice, make audio clip, TTS, text to speech. Supports 6 voices. Trigger phrases: generate speech, create voiceover, say with X voice, TTS, text to speech, make audio. Do NOT use for system TTS (that's Gemini Live) — this is for creating files via Soundwave engine.
**Parameters**: text (required, max 5000), voice (Jenny/Ana/Sonia/Christopher/Guy/Ryan or full id, default Jenny), speed 0.5-2.0 default 1.0, pitch -50..50 default 0, volume 0-100 default 100, play boolean default true
**Settings**: api_url, api_key, auto_play checkbox, save_dir
**Logic**: get_voice() resolves, clamps speed/pitch/volume, synthesize_edge_tts() direct Edge TTS no server, saves to ~/Soundwave/tts/, play_audio(), logs via player.write_log() with 📤 emoji, returns result_text with chars, voice, speed, path
**Example**: "Generate speech with Jenny: Hello world, welcome to Soundwave AI"

### Plugin `soundwave_voices.py`

**Name**: soundwave_voices
**Description**: Lists and describes Soundwave AI's voice library — 6 Microsoft Neural voices. Use when user asks about voices, what voices available, which voice to use, voice library, describe Jenny, recommend voice for TikTok/corporate/etc. Trigger phrases: list voices, voice library, what voices, describe voice, recommend voice, which voice for, voice samples.
**Parameters**: action list/describe/recommend/sample default list, voice name/id, use_case for recommendation (tiktok, youtube, corporate, audiobook, podcast, trailer, education, ads, etc.)
**Logic**: 
- describe/sample + voice_q → get_voice(), if sample → synthesize_edge_tts() sample sentence "Welcome to Soundwave AI..." + play_audio()
- recommend or use_case → simple keyword matching: tiktok/reel/short/energetic/young/ad → Ana, corporate/business/professional/elegant/british female → Sonia, trailer/deep/authoritative/movie/podcast → Christopher, vlog/casual/friendly/tutorial/conversational → Guy, news/education/formal/british male → Ryan, else Jenny
- list → shows all 6 with id, gender, accent, style

### Plugin `soundwave_studio.py`

**Name**: soundwave_studio (master, like computer_settings 56 actions)
**Description**: Master control for Soundwave AI studio — production-grade TTS and video compositing. Use when user wants to use Soundwave: create voiceover, generate TTS, make video with subtitles, burn subtitles, export video, create project, YouTube import, subtitle styling, video compositing. Main Soundwave integration — handles TTS, subtitles, video export, projects. Trigger phrases: soundwave studio, create voiceover, make video with subtitles, burn subtitles, export video, soundwave project, use soundwave, generate with soundwave.
**Parameters**: action tts/list_voices/create_project/subtitles/video_export/youtube_import/status/help default help, text, voice, speed, project_title, video_path, youtube_url, aspect 16:9/9:16
**Settings**: api_url, default_voice, auto_export checkbox
**Sub-actions**:
- tts: text + voice + speed → MP3 + SRT + auto-play, creates SRT cues via text_to_srt_cues(), saves SRT
- list_voices: show 6 voices
- create_project: title + aspect → local ~/Soundwave/projects/ + project.json with title, type, voice, aspect, created, api_url, text
- video_export: video_path optional solid color if empty + aspect → explains FFmpeg workflow, API POST /api/v1/export/video
- youtube_import: youtube_url → explains yt-dlp import flow
- status: API URL, voices, quotas, architecture, UI URLs
- help: full help with voice mapping and API list

### Plugin `soundwave_projects.py`

**Name**: soundwave_projects
**Description**: Manages Soundwave AI projects — TTS, Subtitle, Video. Use when user asks to list projects, show my projects, create project, duplicate project, delete project, project status, my soundwave projects. Projects stored locally ~/Soundwave/projects/ + optionally cloud via Soundwave API (Pro+). Trigger phrases: list projects, my projects, soundwave projects, create project, show projects, project status.
**Parameters**: action list/create/show/duplicate/delete/stats default list, title, type TTS/SUBTITLE/VIDEO default TTS, project_id folder name substring
**Logic**: base_dir ~/Soundwave/projects/, list → iterates dirs, reads project.json, shows title type folder created voice, create → safe_title + timestamp folder + project.json, show → finds by substring, reads json + files, duplicate → shutil.copytree, delete → send2trash if available else rmtree, stats → counts by type

### Plugin `soundwave_video.py`

**Name**: soundwave_video
**Description**: Creates and exports videos with burned-in subtitles using Soundwave AI's video compositing engine (FFmpeg). Use when user asks to make video, burn subtitles, create video with voiceover, export video, video with captions, portrait video, YouTube Shorts, TikTok video, Reels. Supports 16:9 + 9:16 portrait, resolutions 720p-4K, MP4/WebM, FFmpeg libass. Trigger phrases: make video, burn subtitles, create video, export video, video with subtitles, portrait video, Shorts video, TikTok video.
**Parameters**: action workflow/prepare/export/youtube_import/status default workflow, text, voice, video_path optional solid color, aspect 16:9/9:16 default 16:9, resolution 720p/1080p/1440p/4K default 1080p, youtube_url
**Workflows**:
- workflow: full explanation 1. TTS → MP3+SRT, 2. Subtitle styling presets TikTok/YouTube/minimal, 3. Background video upload or solid color 0x0A0F1C or YouTube via yt-dlp, loops if shorter, 4. Export via API POST /api/v1/export/video with settings, job QUEUED→PROCESSING→COMPLETED, SSE progress, download, quotas, 5. Example via JARVIS
- prepare: text + voice + aspect + resolution + video_path → MP3 via synthesize_edge_tts(), est duration words/2.5, cues via text_to_srt_cues(), SRT via save_srt(), project folder ~/Soundwave/video_projects/video_<time>/ with video_project.json
- youtube_import: explains API + local yt-dlp
- export: explains API payload
- status: FFmpeg/yt-dlp availability via shutil.which, quotas, codecs

### Plugin `soundwave_clone.py`

**Name**: soundwave_clone
**Description**: Manages voice cloning via Soundwave AI's OmniVoice sidecar — clone your own voice from 3-10s clean speech. Use when user asks to clone voice, create cloned voice, list cloned voices, use my cloned voice, voice cloning, my voice clone. Reference clip 3-10s clean speech, WAV/MP3/FLAC/OGG/M4A. Trigger phrases: clone voice, my cloned voice, create voice clone, list cloned voices, voice cloning.
**Parameters**: action status/list/clone_info/generate default status, text, profile_id, profile_name, reference_file
**Settings**: api_url, clone_min_duration
**Logic**:
- status: shows config VOICECLONE_URL, VOICECLONE_TOKEN, MIN_PLAN, timeout, reference clip specs, API endpoints, frontend flow, curl check
- list: api_request GET /profiles → lists name id createdAt hasRefText
- clone_info: how to clone — prepare clip 3-10s, UI Studio → Clone tab → file+name+refText+consent → POST /profiles multipart 300s, use clone: clone:<id> via POST /clone → MP3 base64
- generate: text + profile_id → POST /clone via api_request → save_base64_mp3 + play_audio

### Plugin `soundwave_youtube.py`

**Name**: soundwave_youtube
**Description**: Imports YouTube videos as background for Soundwave AI video compositing via yt-dlp. Use when user asks to import YouTube video, download YouTube, use YouTube as background, YouTube to video, import from YouTube. Soundwave uses vendored yt-dlp zipapp needs python3 with cookies support for age/bot-gated, max duration cap. Trigger phrases: import YouTube, download YouTube video, YouTube background, YouTube to Soundwave, import from YouTube.
**Parameters**: url required, action info/download/soundwave_import default info, output_path
**Logic**:
- info: workflow — API POST /upload/youtube with {url} → fileKey, frontend Video Compositor → Import from YouTube button, export via fileKey as videoFileKey, local download via yt-dlp to ~/Soundwave/youtube/
- download: finds yt-dlp binary — checks possible vendored paths (~/Soundwave-AI/vendor/yt-dlp/yt-dlp, cwd/vendor/yt-dlp/yt-dlp, parent/vendor/yt-dlp/yt-dlp) or shutil.which("yt-dlp"), output template %(title)s [%(id)s].%(ext)s, handles zipapp via python3 + binary, subprocess.run check=True timeout 120, finds newest file in out_dir
- soundwave_import: api_request POST /upload/youtube with {url} timeout 180 → fileKey

## Installation — Teaching JARVIS

```bash
# 1. Install Mark LIII
git clone https://github.com/FatihMakes/Mark-LIII.git
cd Mark-LIII
python setup.py
pip install edge-tts requests yt-dlp

# 2. Copy plugins from Soundwave-AI repo
cp /path/to/Soundwave-AI/mark-liii-plugins/soundwave_*.py ./plugins/
cp /path/to/Soundwave-AI/mark-liii-plugins/_soundwave_client.py ./plugins/

# 3. Configure (optional)
export SOUNDWAVE_API_URL=http://localhost:4000
export SOUNDWAVE_API_KEY=swa_live_...

# 4. Restart JARVIS
python main.py
# Logs: Plugin loaded: soundwave_tts, soundwave_voices, soundwave_studio, soundwave_projects, soundwave_video, soundwave_clone, soundwave_youtube
```

Enable/disable via ⚙ → Plugin Manager (config/api_keys.json plugin_enabled dict, re-read every call, no restart).

## Voice Commands — After Installation

User speaks to JARVIS:

- "Generate speech with Jenny: Hello world, welcome to Soundwave AI"
- "List Soundwave voices"
- "Describe Sonia voice"
- "Play sample of Guy"
- "Recommend voice for TikTok"
- "Use Soundwave studio to create voiceover"
- "Soundwave studio status"
- "Create Soundwave project My First Video"
- "List my Soundwave projects"
- "Make video with subtitles portrait 9:16"
- "Import YouTube video https://youtube.com/watch?v=... as background"
- "Clone my voice"
- "List cloned voices"
- "Check Soundwave clone status"

JARVIS will:

1. Acknowledge instantly (Mark LIII's instant acknowledgment rule — says one short sentence in user's language before long tool)
2. Call appropriate soundwave_* plugin with extracted params
3. Plugin synthesizes via direct Edge TTS (no server) or via Soundwave API, saves to ~/Soundwave/tts/ or ~/Soundwave/projects/, auto-plays, logs to HUD
4. Returns spoken result: "Generated 10 characters with Jenny (en-US-JennyNeural) at 1.0x speed. Saved to ..."

## Example: Full Video Creation via JARVIS

**User**: "Create a TikTok video with Jenny voice saying Welcome to Soundwave AI, make it portrait"

**JARVIS flow**:

1. Instant ack: "On it — creating your portrait video with Jenny now..." (in user's language)
2. Calls `soundwave_studio` action=tts text="Welcome to Soundwave AI" voice=Jenny aspect=9:16 → MP3 + SRT
   - Internally: get_voice("Jenny") → en-US-JennyNeural, synthesize_edge_tts() → ~/Soundwave/tts/sw_Welcome_to_Soundwave_AI_en-US-JennyNeural_...mp3, text_to_srt_cues() → 1 cue, save_srt() → .srt, play_audio()
3. Calls `soundwave_video` action=prepare text="Welcome to Soundwave AI" voice=Jenny aspect=9:16 resolution=1080p → video project folder ~/Soundwave/video_projects/video_.../ with video_project.json containing text, voice, aspect, resolution, video_path solid_color, mp3_path, srt_path, cues
4. Returns: "Prepared Soundwave video project at ... with Jenny voiceover 4 words, ~1.6s, MP3 ..., SRT with 1 cue, Background solid color 0x0A0F1C, Aspect 9:16 portrait 1080x1920 for TikTok, Resolution 1080p. Next: Open Soundwave UI http://localhost:5173/studio/video, upload MP3 + video + SRT, choose TikTok preset, export MP4 via FFmpeg"

**User then**: Opens Soundwave UI at http://localhost:5173/studio/video, uploads MP3 + background video (or uses solid color), uploads SRT or uses wordTimings, chooses style, exports — FFmpeg burns subtitles via libass, loops if video shorter, downloads MP4.

## API Reference for JARVIS

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | /api/v1/voices | — | 6 voices metadata + sample URLs |
| GET | /voice-samples/:voiceId.mp3 | — | static sample |
| POST | /api/v1/tts/synthesize | ✓ | Edge TTS → MP3 base64 + wordTimings, quota |
| POST | /api/v1/tts/clone | ✓ | Cloned voice synthesis |
| GET | /api/v1/tts/clone/status | ✓ | configured + available |
| GET/POST | /api/v1/projects | ✓ | Cloud projects (Pro+) |
| POST | /api/v1/upload/video\|audio\|avatar | ✓ | magic-byte validated, UUIDv7 |
| POST | /api/v1/upload/youtube | ✓ | yt-dlp vendored zipapp, Range |
| GET | /api/v1/upload/file/:key | ✓ | Stream file Range for previews |
| POST | /api/v1/export/video | ✓ | FFmpeg job 16:9/9:16 |
| GET | /api/v1/export/jobs/:id | ✓ | Job status, SSE stream |
| GET | /api/v1/export/jobs/:id/download | ✓ | Download export |

Auth: JWT httpOnly cookies + CSRF for web, API keys swa_live_... SHA-256 hashed for Enterprise (server/src/routes/apiKeys.ts, lib/auth.ts sha256).

## Soundwave Knowledge API (for Soundwave UI)

Soundwave itself has expert API teaching it to use Mark LIII AND teaching JARVIS to use Soundwave:

- GET /api/v1/jarvis/soundwave/overview — Soundwave overview
- GET /api/v1/jarvis/soundwave/plugins — plugin metadata list
- GET /api/v1/jarvis/soundwave/instructions — full instructions for JARVIS
- GET /api/v1/jarvis/soundwave/knowledge — overview + plugins + instructions bundle
- GET /api/v1/jarvis/soundwave/plugins/files — list actual .py files in mark-liii-plugins/ with size, isPlugin
- GET /api/v1/jarvis/soundwave/plugins/files/:filename — content of specific plugin file
- POST /api/v1/jarvis/soundwave/chat — chat with Soundwave expert (how JARVIS uses Soundwave), local no LLM

Frontend: /jarvis page has mode toggle Mark LIII vs Soundwave, Soundwave chat, plugins tab with file viewer + copy/download.

## Troubleshooting

- `edge-tts not installed`: pip install edge-tts
- `requests not installed`: pip install requests
- `yt-dlp not found`: pip install yt-dlp or use vendored vendor/yt-dlp/yt-dlp (needs python3)
- JARVIS can't hear: ⚙ → 🎧 AUDIO DEVICES — pick mic by name, filters 41→8
- Soundwave API 401: need auth — set SOUNDWAVE_API_KEY or login via UI, or use Enterprise API key
- Clone unavailable: set VOICECLONE_URL in Soundwave server to sidecar URL
- FFmpeg not found: winget install ffmpeg (Windows) or sudo apt install ffmpeg (Linux) or set FFMPEG_PATH
- No projects: ~/Soundwave/projects/ created on first use

## Related

- Mark LIII repo: https://github.com/FatihMakes/Mark-LIII
- Soundwave repo: this repo
- Soundwave expert teaching Soundwave to use Mark LIII: server/src/lib/markLiiiKnowledge.ts + docs/JARVIS_MARK_LIII_EXPERT.md
- This guide teaching JARVIS to use Soundwave: server/src/lib/soundwaveKnowledge.ts + mark-liii-plugins/ + docs/SOUNDWAVE_FOR_JARVIS.md
- Frontend bridge: /jarvis page — bidirectional expert

---

**JARVIS + Soundwave = Full Media Studio**

Now JARVIS can say "Generate speech with Jenny" and create studio-quality voiceover via Soundwave's Edge TTS, then "Make video with subtitles portrait" and prepare a TikTok-ready project with MP3+SRT+video_project.json, ready for FFmpeg export in Soundwave UI.

## ⭐ NEW: Paste YouTube Link into Video Editor — Exact Workflow for JARVIS

This is the #1 requested workflow: user copies YouTube URL, wants it as background video in Soundwave's Video Compositor.

### Frontend UI — VideoCompositor.tsx Exact Location

**Page**: `/studio/video` — VideoCompositor component, max-w-7xl, left column preview + timeline + video background + audio track, right column export settings

**Video Background Section** (left column, `rounded-card border border-gray-800 bg-panel p-5`):
- Title: "Video Background" + Badge (YouTube violet or Uploaded green dot)
- If video exists: shows videoName truncate text-sm text-white + text-xs text-gray-500 "MP4/MOV/WEBM/AVI · max X MB" + Remove button (Trash2 icon, size sm variant outline)
- If NO video:
  - Drag & drop zone: onDrop, onDragOver preventDefault, class `mt-3 flex cursor-pointer flex-col items-center justify-center rounded-card border-2 border-dashed border-gray-700 px-6 py-10 text-center hover:border-blue-500/50`, onClick inputRef.current.click(), role button tabIndex 0 onKeyDown Enter → click, Upload icon, text "Drag & drop a video, or click to browse" + "MP4, MOV, WEBM, AVI · up to X MB", ProgressBar indeterminate if uploading, hidden input type file accept video/mp4,video/quicktime,video/webm,video/x-msvideo,.mp4,.mov,.webm,.avi onChange onFile
  - **Import from YouTube card**: `mt-4 rounded-card border border-gray-800 bg-gray-900/50 p-4`
    - Title: `<Youtube icon h-4 w-4 text-red-400> Import from YouTube text-sm font-medium text-gray-200`
    - Form: `mt-2.5 flex flex-col gap-2 sm:flex-row`, onSubmit e.preventDefault() void importYouTube()
      - Input: value ytUrl, onChange setYtUrl, disabled ytImporting, placeholder "Paste a link — youtube.com/watch?v=…, youtu.be/…, /shorts/…", aria-label "YouTube video URL", class `h-10 w-full rounded-input border border-gray-700 bg-gray-900 px-3 text-sm text-white placeholder-gray-500 hover:border-gray-600 focus:border-blue-500 disabled:opacity-60`
      - Button: type submit size sm loading ytImporting icon Youtube h-4 w-4 class `h-10 shrink-0 sm:w-auto w-full`, text {ytImporting ? "Importing…" : "Import"}
    - When importing: mt-3 ProgressBar indeterminate + text-xs text-gray-500 "Downloading from YouTube — long videos can take a minute."
    - Note: mt-2 text-xs text-gray-500 "The video is downloaded straight to your project. Only import content you own or have permission to use."

**importYouTube() function** (in VideoCompositor.tsx):
```ts
const importYouTube = async () => {
  const url = ytUrl.trim();
  if (!url) { toast.warning("No link", "Paste a YouTube link first."); return; }
  setYtImporting(true);
  try {
    const res = await http.post<{ fileKey: string; name: string; size: number }>("/upload/youtube", { url }, { timeout: 300_000 }); // 5 min for long videos
    const streamUrl = `/api/v1/upload/file/${res.fileKey}`;
    setVideoFileKey(res.fileKey);
    setVideoUrl(streamUrl);
    setVideoName(res.name);
    studio.setVideo({ blob: null, url: streamUrl, name: res.name, fileKey: res.fileKey });
    setYtUrl("");
    toast.success("YouTube video imported", "It is ready to use as your video background.");
  } catch (e) {
    toast.error("YouTube import failed", (e as Error).message);
  } finally {
    setYtImporting(false);
  }
};
```

**Backend** (server/src/lib/ytdlp.ts + routes/upload.ts):
- Vendored yt-dlp zipapp vendor/yt-dlp/yt-dlp (needs python3), auto-detected, override via YTDLP_PATH env, YTDLP_COOKIES optional cookies.txt for bot/age-gated, YTDLP_MAX_DURATION caps length default 1200s, YTDLP_TIMEOUT_MS 240s
- POST /api/v1/upload/youtube with {url} → uses yt-dlp to download, returns fileKey UUIDv7, stored under uploads dir, served via GET /api/v1/upload/file/:key Range supported
- videoFromYouTube = videoUrl != null && videoUrl.startsWith("/api/v1/upload/file/") → Badge tone violet

**After import**:
- videoRef src=streamUrl, muted playsInline, onLoadedMetadata sets videoDuration, onEnded pauses if no audio
- previewRef measures previewW via ResizeObserver, k = previewW/1280 for subtitle scaling
- Timeline shows video duration + audio waveform + subtitle cues
- Export: POST /api/v1/export/video with videoFileKey + audioFileKey + subtitleData + exportSettings, job QUEUED→PROCESSING→COMPLETED, SSE progress, download

### JARVIS Paste Methods — 3 Ways

**A) API Direct (fastest, recommended for JARVIS, no UI):**
```python
from _soundwave_client import api_request, resolve_api_url
api_url = resolve_api_url()  # env SOUNDWAVE_API_URL or config/api_keys.json or default http://localhost:4000
res = api_request("POST", "/api/v1/upload/youtube", json_data={"url": "https://youtube.com/watch?v=..."}, timeout=300)
file_key = res["fileKey"]  # UUIDv7
name = res["name"]
stream_url = f"/api/v1/upload/file/{file_key}"
# Now video ready as background, use as videoFileKey in export job
```

**B) Browser Automation (opens UI and pastes):**
Mark LIII has browser_control (open URLs, navigate tabs, Playwright) + computer_control (keyboard shortcuts, mouse, window management, pyautogui, pygetwindow, pywinauto)
```python
# Step 1: Open Soundwave Video Compositor
# browser_control action=open url=http://localhost:5173/studio/video
# or
import webbrowser
webbrowser.open("http://localhost:5173/studio/video")
# Wait 3-4s for React SPA load

# Step 2: Focus YouTube input
# Input: [aria-label="YouTube video URL"], placeholder "Paste a link — youtube.com/watch?v=…, youtu.be/…, /shorts/…"
# In Video Background section → Import from YouTube card → form → input
# Via playwright (Mark LIII has playwright):
# await page.goto("http://localhost:5173/studio/video")
# await page.wait_for_selector('[aria-label="YouTube video URL"]', timeout=10000)
# await page.fill('[aria-label="YouTube video URL"]', 'https://youtube.com/watch?v=...')
# await page.click('button:has-text("Import")')
# await page.wait_for_selector('text=YouTube', timeout=120000)  # Badge appears

# Via computer_control + pyautogui:
import pyautogui, pyperclip, time
pyperclip.copy("https://youtube.com/watch?v=...")
time.sleep(0.5)
# Focus input: Tab navigate or click at position
pyautogui.hotkey('ctrl', 'v')  # or 'command', 'v' on macOS
time.sleep(0.3)
pyautogui.press('enter')
# Wait for ProgressBar + "Downloading from YouTube..."
```

**C) Clipboard:**
```python
import pyperclip
pyperclip.copy("https://youtube.com/watch?v=...")
# Then computer_control action=hotkey key=ctrl+v + press_key enter
# Input has aria-label="YouTube video URL"
```

**Supported URL formats:**
- https://www.youtube.com/watch?v=dQw4w9WgXcQ
- https://youtu.be/dQw4w9WgXcQ
- https://www.youtube.com/shorts/abc123
- https://m.youtube.com/watch?v=...
- With extra params: &t=30s, &list=... — yt-dlp handles

**Error handling:**
- No link: toast.warning "No link" "Paste a YouTube link first."
- Invalid: yt-dlp fails, backend returns 400 with message
- Too long: YTDLP_MAX_DURATION default 1200s (20min) — refuses longer, returns 400
- Bot/age-gated: needs YTDLP_COOKIES env with cookies.txt export, or fails with bot detection message
- Timeout: 300s frontend timeout for long videos, backend YTDLP_TIMEOUT_MS 240s

### New Plugin: soundwave_youtube_paste.py

**File**: `mark-liii-plugins/soundwave_youtube_paste.py` — dedicated paste plugin with 3 methods auto fallback

**PLUGIN**:
- name: soundwave_youtube_paste
- description: Pastes a YouTube link into Soundwave AI's Video Editor to import as background video. Exact workflow for YouTube import: user copies YouTube URL, pastes into 'Import from YouTube' input in Video Background section, clicks Import, video downloaded via yt-dlp. Supports youtube.com/watch?v=…, youtu.be/…, youtube.com/shorts/… formats. Can do via Soundwave API directly (fastest, no UI), via browser automation (opens UI and pastes), or via clipboard. Trigger phrases: paste YouTube link, import YouTube into editor, YouTube to video editor, paste link into video editor, add YouTube background, YouTube in Soundwave video.
- params: url required (youtube.com/watch?v=…, youtu.be/…, /shorts/…), method api/browser/clipboard/auto default auto (tries api then clipboard+browser), auto_play bool
- PLUGIN_SETTINGS: namespace soundwave, title Soundwave YouTube Paste, fields api_url, ui_url, default_method, auto_play

**Logic**:
- Validates youtube.com/youtu.be
- via_api(): from _soundwave_client import api_request, resolve_api_url; api_request POST /api/v1/upload/youtube json {url} timeout 300 → fileKey/name/size/streamUrl; logs via player.write_log()
- via_browser(): webbrowser.open ui_url = api_url.replace(":4000",":5173")+"/studio/video"; checks browser_control available via actions.browser_control import; provides playwright selectors [aria-label="YouTube video URL"] fill + click button:has-text("Import") + wait violet badge, fallback computer_control type_text/hotkey/enter, pyautogui sequence
- via_clipboard(): pyperclip.copy(url) + pyautogui.hotkey ctrl+v + press enter, instructions for focusing input in Video Background → Import from YouTube card
- Auto: tries via_api() then fallback to via_clipboard() + via_browser() instructions
- Never raises, returns spoken string with fileKey, streamUrl, next steps

**Install**: `pip install pyperclip pyautogui` (Mark LIII already has playwright, pyautogui in requirements)

**Voice commands**:
- "Paste YouTube link https://youtube.com/watch?v=dQw4w9WgXcQ into Soundwave video editor" → soundwave_youtube_paste url=https://... method=auto
- "Paste https://youtu.be/... into video editor" → same
- "Import YouTube https://... as background in Soundwave video editor" → same
- "Add YouTube background https://..." → same

**Example flow**:
1. User: "Paste YouTube link https://www.youtube.com/watch?v=dQw4w9WgXcQ into Soundwave video editor"
2. JARVIS ack: "On it — pasting that YouTube link into Soundwave's Video Editor now..." (in user's language)
3. Calls soundwave_youtube_paste url=https://... method=auto
   - Tries via_api(): POST /api/v1/upload/youtube {url} timeout 300 → {fileKey, name, size}
   - If API fails, fallback to via_clipboard(): pyperclip.copy(url) + instructions to focus input [aria-label="YouTube video URL"] and hotkey ctrl+v + enter
4. Returns: "✅ Pasted YouTube link into Soundwave Video Editor via API: URL https://... → FileKey abc123 (UUIDv7) → Name Rick Astley - Never Gonna Give You Up → Stream URL /api/v1/upload/file/abc123 → Next: In Soundwave UI at http://localhost:5173/studio/video, video appears as background with YouTube badge violet. Then generate voiceover in Studio, add subtitles, export via FFmpeg with 16:9 or 9:16 portrait."
5. User sees video in Soundwave UI Video Compositor left column Video Background section with YouTube badge violet, videoName, Remove button, preview via video element src=streamUrl Range supported.

### Enhanced soundwave_youtube.py

Updated existing plugin with `paste_guide` action and full paste UI details:

- Now supports 4 actions: info, paste_guide, download, soundwave_import
- paste_guide explains exact UI flow with selectors, importYouTube() function, 3 methods, backend details, supported URLs, plugins
- info includes both classic workflow and paste workflow
- download and soundwave_import mention paste UI location

### Frontend — JarvisExpert.tsx Updates

- Welcome message now lists 8 plugins including soundwave_youtube_paste ⭐ NEW with paste workflow summary
- Added dedicated section "⭐ NEW: Paste YouTube Link into Video Editor — Exact Workflow for JARVIS" with:
  - UI Location with exact selectors and classes
  - Backend importYouTube() code snippet
  - 3 Methods with code examples (API direct, Browser automation with playwright, Clipboard)
  - Supported URL formats and yt-dlp config
- Voice commands list includes paste command with violet highlight
- Added separate workflow card "Paste YouTube Workflow for JARVIS ⭐" with UI/API/JARVIS/Browser/Badge steps
- Updated Soundwave Workflow to include YouTube paste as step 4 and step 7
- Quick prompts now include "Paste YouTube link into video editor ⭐"

### Backend — soundwaveKnowledge.ts + jarvis.ts Updates

- `SOUNDWAVE_OVERVIEW.api` now marks POST /api/v1/upload/youtube as "THIS IS PASTE YOUTUBE LINK FLOW"
- New `youtubePasteWorkflow` field with full exact workflow documentation
- `SOUNDWAVE_JARVIS_PLUGINS` now includes soundwave_youtube_paste with full pasteWorkflow description
- `SOUNDWAVE_JARVIS_INSTRUCTIONS` now has section 4 "PASTE YOUTUBE LINK INTO VIDEO EDITOR — THE MAIN WORKFLOW" as primary workflow
- `jarvis.ts` POST /soundwave/chat now handles q.includes("youtube") || "paste" || "link" with isPaste detection:
  - If paste: returns exact UI flow with VideoCompositor.tsx selectors, importYouTube() function, backend details, 3 methods with code, supported URLs, plugin info
  - Else: classic YouTube import + mentions new plugin
  - followUp includes "Paste YouTube link into video editor" and "How to paste a YouTube link into Soundwave video editor?"

Now JARVIS is truly an expert at pasting YouTube links into Soundwave's Video Editor — knows exact input aria-label, placeholder, button, API endpoint, timeout, fileKey handling, badge, and 3 automation paths.

