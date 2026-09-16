/**
 * Soundwave AI Knowledge Base — Teaches JARVIS (Mark LIII) to use Soundwave
 * This is the inverse of markLiiiKnowledge.ts — instead of teaching Soundwave to use Mark LIII,
 * this teaches Mark LIII JARVIS to use Soundwave AI.
 */

export const SOUNDWAVE_OVERVIEW = {
  name: "Soundwave AI",
  tagline: "Production-grade, client-side AI text-to-speech and video compositing studio",
  repo: "https://github.com/Str4hinj47/Soundwave-AI",
  stack: {
    frontend: "React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Zustand, React Hook Form + Zod",
    tts: "Server-side Microsoft Neural voices via node-edge-tts (24 kHz mono MP3 + word timings), offline formant fallback",
    backend: "Express 5 + TypeScript, PostgreSQL + Prisma (JSON-file store fallback), JWT sessions (httpOnly cookies + refresh rotation + CSRF), Stripe billing stubs, SSE export jobs",
    media: "FFmpeg (libx264/libvpx-vp9, libass subtitles + ASS watermark, volume/fades, media probing)",
  },
  description: `
Soundwave AI generates studio-quality voiceovers with Microsoft Neural voices (via free, key-less Edge TTS service) or with your own cloned voice (OmniVoice voice cloning, optional local sidecar), styles and burns subtitles into video, and exports finished MP4/WebM with FFmpeg.

Architecture:
- Frontend Vite + React SPA: Landing, Pricing, auth, Dashboard, Studio, SubtitleEditor, VideoCompositor, Projects, Settings, VoiceLibrary, JarvisExpert
- TTS: Server-side edge-tts API call + offline fallback (formant synthesizer)
- Backend: Express API with auth, voices, tts, projects, upload, export, user, billing, apiKeys, jarvis
- Media: FFmpeg export, yt-dlp YouTube import

Quotas:
- Free: 10k chars/mo, 720p watermark, local only, 2 exports/hour
- Pro: 200k chars, 1080p, cloud save, 20 exports/hour
- Enterprise: 2M chars, 4K no watermark, API access, 100 exports/hour
`.trim(),
  voices: [
    { id: "en-US-JennyNeural", displayName: "Jenny", gender: "Female", accent: "American", style: "Warm, friendly, versatile — narration, explainer, YouTube", sample: "/voice-samples/en-US-JennyNeural.mp3" },
    { id: "en-US-AnaNeural", displayName: "Ana", gender: "Female", accent: "American", style: "Young, energetic, upbeat — TikTok, Reels, ads", sample: "/voice-samples/en-US-AnaNeural.mp3" },
    { id: "en-GB-SoniaNeural", displayName: "Sonia", gender: "Female", accent: "British", style: "Elegant British, professional — corporate, audiobook, documentary", sample: "/voice-samples/en-GB-SoniaNeural.mp3" },
    { id: "en-US-ChristopherNeural", displayName: "Christopher", gender: "Male", accent: "American", style: "Deep, authoritative — trailer, podcast, presentation", sample: "/voice-samples/en-US-ChristopherNeural.mp3" },
    { id: "en-US-GuyNeural", displayName: "Guy", gender: "Male", accent: "American", style: "Casual, conversational — vlog, tutorial, friendly", sample: "/voice-samples/en-US-GuyNeural.mp3" },
    { id: "en-GB-RyanNeural", displayName: "Ryan", gender: "Male", accent: "British", style: "British male, clear — news, education, formal", sample: "/voice-samples/en-GB-RyanNeural.mp3" },
  ],
  api: [
    { method: "GET", path: "/api/v1/voices", auth: "—", notes: "Voice metadata + sample URLs, no auth" },
    { method: "GET", path: "/voice-samples/:voiceId.mp3", auth: "—", notes: "Static sample audio" },
    { method: "POST", path: "/api/v1/tts/synthesize", auth: "✓", notes: "Server-side synthesis Microsoft Neural → MP3 base64 + word timings, enforces quota" },
    { method: "POST", path: "/api/v1/tts/clone", auth: "✓", notes: "Cloned voice synthesis via OmniVoice sidecar" },
    { method: "GET", path: "/api/v1/tts/clone/status", auth: "✓", notes: "Clone configured + available" },
    { method: "GET/POST", path: "/api/v1/projects", auth: "✓", notes: "Cloud projects (Pro+ for save), local fallback IndexedDB" },
    { method: "POST", path: "/api/v1/upload/video|audio|avatar", auth: "✓", notes: "Magic-byte validated uploads, UUIDv7 keys" },
    { method: "POST", path: "/api/v1/upload/youtube", auth: "✓", notes: "YouTube import via yt-dlp vendored zipapp, Range supported" },
    { method: "GET", path: "/api/v1/upload/file/:key", auth: "✓", notes: "Stream imported/uploaded video (Range for previews)" },
    { method: "POST", path: "/api/v1/export/video", auth: "✓", notes: "Start FFmpeg export job (16:9 or 9:16 portrait)" },
    { method: "GET", path: "/api/v1/export/jobs/:id", auth: "✓", notes: "Job status, SSE stream supported" },
    { method: "GET", path: "/api/v1/export/jobs/:id/download", auth: "✓", notes: "Download finished export" },
    { method: "GET", path: "/api/v1/jarvis/knowledge", auth: "—", notes: "Mark LIII expert knowledge base" },
    { method: "POST", path: "/api/v1/jarvis/chat", auth: "—", notes: "Chat with Mark LIII expert" },
    { method: "POST", path: "/api/v1/jarvis/generate-plugin", auth: "—", notes: "Generate Mark LIII plugin from description" },
  ],
  structure: `
soundwave-ai/
├── frontend/            # Vite + React SPA
│   ├── src/pages/       # Landing, Pricing, auth, Dashboard, Studio, SubtitleEditor, VideoCompositor, Projects, Settings, JarvisExpert, Help
│   ├── src/components/  # ui/ primitives, layout/, VoicePicker, Waveform, JarvisWidget, …
│   ├── src/hooks/       # useTTS (edge-tts API call + offline fallback), useJarvisExpert
│   ├── src/lib/         # audio, ttsEngine, voices, subtitlePresets, idb, api, jarvisApi, …
│   └── src/store/       # Zustand: auth, studio, toast
├── server/              # Express API
│   ├── src/routes/      # auth, voices, tts, projects, upload, export, user, billing, apiKeys, jarvis
│   ├── src/lib/         # auth (JWT/bcrypt), edgeTts, store (Prisma/JSON), ffmpeg, ytdlp, plans, security, markLiiiKnowledge, soundwaveKnowledge
│   ├── prisma/schema.prisma
│   └── scripts/generate-samples.ts
├── mark-liii-plugins/   # Drop-in plugins teaching Mark LIII JARVIS to use Soundwave
│   ├── _soundwave_client.py  # Shared helper (not plugin)
│   ├── soundwave_tts.py      # TTS generation
│   ├── soundwave_voices.py   # Voice library
│   ├── soundwave_studio.py   # Master studio control
│   ├── soundwave_projects.py # Project management
│   ├── soundwave_video.py    # Video compositing
│   ├── soundwave_clone.py    # Voice cloning
│   ├── soundwave_youtube.py  # YouTube import
│   └── README.md
├── docs/                # JARVIS_MARK_LIII_EXPERT.md etc.
└── vendor/              # static ffmpeg + yt-dlp zipapp
`.trim(),
};

export const SOUNDWAVE_JARVIS_PLUGINS = [
  {
    file: "_soundwave_client.py",
    isPlugin: false,
    purpose: "Shared helper — NOT a plugin (starts with _), imported by other plugins",
    features: [
      "Voice metadata mirrors server/src/lib/voices.ts (6 voices with styles)",
      "Direct Edge TTS via edge-tts library (same engine Soundwave uses server-side via node-edge-tts)",
      "API client for Soundwave API (resolve_api_url from env SOUNDWAVE_API_URL or config/api_keys.json, api_request with requests)",
      "Helpers: get_voice(), synthesize_edge_tts(), play_audio() cross-platform, list_soundwave_voices_api(), synthesize_via_soundwave_api(), save_base64_mp3(), text_to_srt_cues(), save_srt()",
      "Handles running event loop detection for asyncio",
    ],
    install: "pip install edge-tts requests",
  },
  {
    file: "soundwave_tts.py",
    isPlugin: true,
    name: "soundwave_tts",
    purpose: "Generate speech with Soundwave's 6 Neural voices",
    triggers: ["generate speech", "create voiceover", "say with X voice", "TTS", "text to speech", "make audio clip"],
    parameters: {
      text: "Text to synthesize (max 5000 chars)",
      voice: "Voice id or display name: Jenny, Ana, Sonia, Christopher, Guy, Ryan OR full id like en-US-JennyNeural. Default Jenny",
      speed: "Speed multiplier 0.5-2.0, default 1.0",
      pitch: "Pitch -50 to +50, default 0",
      volume: "Volume 0-100, default 100",
      play: "Whether to auto-play audio after generation, default true",
    },
    example: 'Generate speech with Jenny: Hello world, welcome to Soundwave',
    workflow: "Resolves voice via get_voice(), clamps speed/pitch/volume, synthesizes via synthesize_edge_tts() (direct Edge TTS, no server), saves to ~/Soundwave/tts/, auto-plays via play_audio(), logs via player.write_log()",
  },
  {
    file: "soundwave_voices.py",
    isPlugin: true,
    name: "soundwave_voices",
    purpose: "List, describe, preview Soundwave's 6 Microsoft Neural voices",
    triggers: ["list voices", "voice library", "what voices", "describe voice", "recommend voice", "voice samples"],
    parameters: {
      action: "list, describe, recommend, sample. Default list",
      voice: "Voice name or id to describe/sample",
      use_case: "Use case for recommendation: tiktok, youtube, corporate, audiobook, podcast, trailer, education, ads, etc.",
    },
    example: "List Soundwave voices / Recommend voice for TikTok",
    recommendationLogic: "tiktok/reel/short/energetic/young/ad → Ana, corporate/business/professional/elegant/british female → Sonia, trailer/deep/authoritative/movie/podcast → Christopher, vlog/casual/friendly/tutorial/conversational → Guy, news/education/formal/british male → Ryan, else Jenny",
  },
  {
    file: "soundwave_studio.py",
    isPlugin: true,
    name: "soundwave_studio",
    purpose: "Master control for Soundwave AI studio — TTS, subtitles, video export, projects, YouTube import",
    triggers: ["soundwave studio", "create voiceover", "make video with subtitles", "burn subtitles", "export video", "soundwave project", "use soundwave"],
    parameters: {
      action: "tts, list_voices, create_project, subtitles, video_export, youtube_import, status, help. Default help",
      text: "Text for TTS",
      voice: "Voice: Jenny, Ana, Sonia, Christopher, Guy, Ryan",
      speed: "Speed 0.5-2.0",
      project_title: "Project title for create_project",
      video_path: "Path to background video for video_export",
      youtube_url: "YouTube URL for youtube_import",
      aspect: "Aspect: 16:9 or 9:16 (portrait for Shorts/TikTok)",
    },
    subActions: [
      "tts: text + voice + speed → MP3 + SRT + auto-play, creates SRT cues via text_to_srt_cues()",
      "list_voices: show 6 voices",
      "create_project: title + aspect → local ~/Soundwave/projects/ + project.json",
      "video_export: video_path (optional, solid color if empty) + aspect → explains FFmpeg workflow, API POST /api/v1/export/video",
      "youtube_import: youtube_url → explains yt-dlp import flow",
      "status: API URL, voices, quotas, architecture",
      "help: full help",
    ],
  },
  {
    file: "soundwave_projects.py",
    isPlugin: true,
    name: "soundwave_projects",
    purpose: "Manage Soundwave AI projects (TTS, Subtitle, Video)",
    triggers: ["list projects", "my projects", "soundwave projects", "create project", "show projects", "project status"],
    parameters: {
      action: "list, create, show, duplicate, delete, stats. Default list",
      title: "Project title for create",
      type: "Project type: TTS, SUBTITLE, VIDEO. Default TTS",
      project_id: "Project id or folder name for show/duplicate/delete",
    },
    storage: "Local ~/Soundwave/projects/ + cloud via API /api/v1/projects (Pro+)",
  },
  {
    file: "soundwave_video.py",
    isPlugin: true,
    name: "soundwave_video",
    purpose: "Video compositing — burn subtitles into video, 16:9 + 9:16 portrait",
    triggers: ["make video", "burn subtitles", "create video", "export video", "video with subtitles", "portrait video", "Shorts video", "TikTok video"],
    parameters: {
      action: "workflow, prepare, export, youtube_import, status. Default workflow",
      text: "Text for voiceover (for prepare)",
      voice: "Voice for TTS",
      video_path: "Path to background video file (optional, solid color if empty)",
      aspect: "Aspect ratio: 16:9 or 9:16 (portrait for Shorts/TikTok). Default 16:9",
      resolution: "Resolution: 720p, 1080p, 1440p, 4K. Default 1080p",
      youtube_url: "YouTube URL for youtube_import",
    },
    workflow: "1. TTS via soundwave_tts → MP3+SRT, 2. Style subtitles (presets TikTok, YouTube, minimal), 3. Background video upload or solid color 0x0A0F1C, YouTube via yt-dlp, loops if shorter, 4. Export via API POST /api/v1/export/video, FFmpeg libx264/libvpx-vp9 + libass, SSE progress, 5. Download",
  },
  {
    file: "soundwave_clone.py",
    isPlugin: true,
    name: "soundwave_clone",
    purpose: "Voice cloning via OmniVoice sidecar",
    triggers: ["clone voice", "my cloned voice", "create voice clone", "list cloned voices", "voice cloning"],
    parameters: {
      action: "status, list, clone_info, generate. Default status",
      text: "Text to synthesize with cloned voice",
      profile_id: "Cloned voice profile id",
      profile_name: "Name for new cloned voice profile",
      reference_file: "Path to reference audio file (3-10s clean speech)",
    },
    cloneFlow: "1. Prepare 3-10s clean clip WAV/MP3/FLAC/OGG/M4A max 25MB, 2. In Soundwave UI Studio → Clone tab → file+name+refText+consent → POST /api/v1/tts/clone/profiles, 3. Use clone: clone:<profileId> via POST /api/v1/tts/clone → MP3 base64",
  },
  {
    file: "soundwave_youtube.py",
    isPlugin: true,
    name: "soundwave_youtube",
    purpose: "YouTube import as video background via yt-dlp",
    triggers: ["import YouTube", "download YouTube video", "YouTube background", "YouTube to Soundwave", "import from YouTube"],
    parameters: {
      url: "YouTube URL to import",
      action: "info, download, soundwave_import. Default info",
      output_path: "Output path for download action",
    },
    ytDlp: "Vendored vendor/yt-dlp/yt-dlp zipapp needs python3, auto-detected, override via YTDLP_PATH, YTDLP_COOKIES for age/bot-gated, YTDLP_MAX_DURATION caps length, timeout 240s",
  },
];

export const SOUNDWAVE_JARVIS_INSTRUCTIONS = `
# Teaching JARVIS (Mark LIII) to Use Soundwave AI — Complete Guide

## For JARVIS: How to Use Soundwave AI Studio

You are JARVIS, now equipped with Soundwave AI plugins. Soundwave AI is a production-grade TTS + video compositing studio.

### Quick Start for JARVIS

1. **Check Soundwave Status:**
   - Call soundwave_studio action=status → shows API URL, voices, quotas, architecture
   - API URL from env SOUNDWAVE_API_URL or config/api_keys.json soundwave_url or default http://localhost:4000
   - UI at http://localhost:5173 (Vite dev) or http://localhost:4000/api/health

2. **List Voices:**
   - soundwave_voices action=list → 6 Microsoft Neural voices (Jenny, Ana, Sonia, Christopher, Guy, Ryan)
   - Each has gender, accent, style: Jenny warm friendly YouTube, Ana young energetic TikTok, Sonia British elegant corporate, Christopher deep authoritative trailer, Guy casual vlog, Ryan British clear news
   - Recommend via action=recommend use_case=tiktok → Ana

3. **Generate Speech (TTS):**
   - soundwave_tts text="Hello world" voice=Jenny speed=1.0 pitch=0 volume=100 play=true
   - Direct Edge TTS via edge-tts library (same as Soundwave server node-edge-tts), no server needed, free, no API key, 24kHz mono MP3, saves to ~/Soundwave/tts/, auto-plays
   - Also via soundwave_studio action=tts → creates MP3 + SRT cues (text_to_srt_cues + save_srt)
   - Via Soundwave API: POST /api/v1/tts/synthesize with {text, voice, speed, pitch, volume} → {audioBase64, duration, wordTimings, used, limit}

4. **Manage Projects:**
   - soundwave_projects action=list → ~/Soundwave/projects/ folders
   - action=create title="My Podcast" type=TTS → creates folder + project.json
   - action=show project_id=my_podcast → details, files
   - action=stats → counts by type
   - Cloud via API GET /api/v1/projects (Pro+ for save), POST /, etc.

5. **Video Compositing:**
   - soundwave_video action=workflow → full workflow explanation
   - action=prepare text="Welcome" voice=Jenny aspect=9:16 resolution=1080p → MP3+SRT + video_project.json in ~/Soundwave/video_projects/
   - Background: upload via /api/v1/upload/video or solid color 0x0A0F1C, YouTube via POST /api/v1/upload/youtube with {url} (yt-dlp vendored, Range supported, cookies for age/bot-gated, max duration cap)
   - Export: POST /api/v1/export/video with videoFileKey (nullable), audioFileKey, subtitleData array {start, end, text}, subtitleStyle, exportSettings {resolution 720p/1080p/1440p/4K, aspect 16:9/9:16 portrait 1080x1920 for Shorts/TikTok/Reels, format mp4/webm, quality low/medium/high, fps 24-60, audioVolume, fadeIn/out, videoEnd}
   - Job: QUEUED → PROCESSING (FFmpeg libx264/libvpx-vp9, libass, volume/fades, looping if video shorter) → COMPLETED/FAILED, progress via GET /jobs/:id or SSE /jobs/:id/events, download /jobs/:id/download
   - Quotas: Free 2/hour 720p watermark, Pro 20/hour 1080p, Enterprise 100/hour 4K no watermark

6. **Voice Cloning:**
   - soundwave_clone action=status → config, API endpoints, quotas
   - action=list → GET /api/v1/tts/clone/profiles via API
   - action=clone_info → how to clone: 3-10s clean clip WAV/MP3/FLAC/OGG/M4A max 25MB, Soundwave UI Studio → Clone tab → file+name+refText+consent → POST /profiles multipart 300s timeout
   - action=generate text="Hello cloned" profile_id="abc123" → POST /api/v1/tts/clone → MP3 base64

7. **YouTube Import:**
   - soundwave_youtube url=https://youtube.com/watch?v=... action=info → workflow
   - action=download → direct yt-dlp download to ~/Soundwave/youtube/ (finds vendored vendor/yt-dlp/yt-dlp or system yt-dlp, uses python3 for zipapp)
   - action=soundwave_import → POST /api/v1/upload/youtube via Soundwave API

### For User: Installing Plugins into Mark LIII

1. Install Mark LIII: git clone https://github.com/FatihMakes/Mark-LIII.git, cd Mark-LIII, python setup.py
2. Install deps: pip install edge-tts requests (yt-dlp optional)
3. Copy: cp /path/to/Soundwave-AI/mark-liii-plugins/soundwave_*.py /path/to/Mark-LIII/plugins/ and cp _soundwave_client.py too
4. Configure (optional): export SOUNDWAVE_API_URL=http://localhost:4000 and SOUNDWAVE_API_KEY=swa_live_... or store in config/api_keys.json
5. Restart: python main.py — logs show Plugin loaded: soundwave_tts etc.
6. Enable/disable: ⚙ → Plugin Manager

### Voice Commands for JARVIS (Mark LIII) After Installation

- "Generate speech with Jenny: Hello world, welcome to Soundwave"
- "List Soundwave voices"
- "Recommend voice for TikTok"
- "Use Soundwave studio to create voiceover"
- "List my Soundwave projects"
- "Make video with subtitles portrait 9:16"
- "Import YouTube video https://... as background"
- "Clone my voice"
- "Check Soundwave clone status"

### Architecture Mapping for JARVIS

- Soundwave's edgeTts.ts (Node) ↔ _soundwave_client.py synthesize_edge_tts() (Python edge-tts) — same Microsoft Edge TTS free service
- Soundwave's voices.ts (6 voices) ↔ SOUNDWAVE_VOICES list — same ids, display names, styles
- Soundwave's API routes ↔ api_request() helper — handles SOUNDWAVE_API_URL resolution, api_key header
- Soundwave's project system (Prisma/JSON + local IndexedDB) ↔ ~/Soundwave/projects/ local folders + API
- Soundwave's FFmpeg export ↔ workflow explanation + local FFmpeg check via shutil.which("ffmpeg")
- Soundwave's yt-dlp vendored ↔ yt-dlp binary detection + python3 zipapp handling

### Best Practices for JARVIS When Using Soundwave

- Always resolve voice via get_voice() — handles display name or id, fallback Jenny
- Clamp speed 0.5-2.0, pitch -50..50, volume 0-100
- Save to ~/Soundwave/tts/ or ~/Soundwave/projects/ — user home, not temp
- Auto-play via play_audio() cross-platform, best effort no crash
- Log via player.write_log() for HUD activity log
- Never raise — catch exceptions, return spoken error string (loader also catches as safety net)
- For long tasks (TTS is fast, but YouTube download, API calls), use instant acknowledgment pattern: first say short sentence in user language, then run tool (Mark LIII's prompt.txt rule)
- For Soundwave API calls, handle auth failure gracefully, fallback to direct Edge TTS
- For video export, explain workflow if video_path missing — don't fail silently

### Example: JARVIS Creates Full Video via Soundwave

User: "Create a TikTok video with Jenny voice saying Welcome to Soundwave AI, make it portrait"

JARVIS:
1. Acknowledges: "On it — creating your portrait video with Jenny now..."
2. Calls soundwave_studio action=tts text="Welcome to Soundwave AI" voice=Jenny aspect=9:16 → MP3 + SRT
3. Calls soundwave_video action=prepare text="Welcome to Soundwave AI" voice=Jenny aspect=9:16 resolution=1080p → video project folder
4. Returns: "Created video project at ~/Soundwave/video_projects/video_... with Jenny voiceover 3 words, SRT with 1 cue, portrait 1080x1920 for TikTok. Open Soundwave UI http://localhost:5173/studio/video to upload background video or use solid color, style subtitles (TikTok preset), and export MP4 via FFmpeg. MP3 at ..."

This teaches JARVIS to use Soundwave as its voice studio.
`.trim();
