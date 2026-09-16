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
    { method: "POST", path: "/api/v1/upload/youtube", auth: "✓", notes: "YouTube import via yt-dlp vendored zipapp, Range supported — THIS IS PASTE YOUTUBE LINK FLOW" },
    { method: "GET", path: "/api/v1/upload/file/:key", auth: "✓", notes: "Stream imported/uploaded video (Range for previews)" },
    { method: "POST", path: "/api/v1/export/video", auth: "✓", notes: "Start FFmpeg export job (16:9 or 9:16 portrait)" },
    { method: "GET", path: "/api/v1/export/jobs/:id", auth: "✓", notes: "Job status, SSE stream supported" },
    { method: "GET", path: "/api/v1/export/jobs/:id/download", auth: "✓", notes: "Download finished export" },
    { method: "GET", path: "/api/v1/jarvis/knowledge", auth: "—", notes: "Mark LIII expert knowledge base" },
    { method: "POST", path: "/api/v1/jarvis/chat", auth: "—", notes: "Chat with Mark LIII expert" },
    { method: "POST", path: "/api/v1/jarvis/generate-plugin", auth: "—", notes: "Generate Mark LIII plugin from description" },
  ],
  youtubePasteWorkflow: `
## YouTube Link Paste into Video Editor — Exact Workflow for JARVIS

This is the #1 workflow: user copies YouTube URL, wants it as background video in Soundwave's Video Compositor.

### Frontend UI (VideoCompositor.tsx) — What JARVIS needs to know:

**Page**: /studio/video — VideoCompositor component, max-w-7xl, left column preview + timeline + video background + audio track, right column export settings

**Video Background Section** (left column, rounded-card border border-gray-800 bg-panel p-5):
- Title: "Video Background" + Badge (YouTube violet or Uploaded green dot)
- If video exists: shows videoName truncate text-sm text-white + text-xs text-gray-500 "MP4/MOV/WEBM/AVI · max X MB" + Remove button (Trash2 icon, size sm variant outline)
- If NO video:
  - Drag & drop zone: onDrop, onDragOver preventDefault, class mt-3 flex cursor-pointer flex-col items-center justify-center rounded-card border-2 border-dashed border-gray-700 px-6 py-10 text-center hover:border-blue-500/50, onClick inputRef.current.click(), role button tabIndex 0 onKeyDown Enter → click, Upload icon, text "Drag & drop a video, or click to browse" + "MP4, MOV, WEBM, AVI · up to X MB", ProgressBar indeterminate if uploading, hidden input type file accept video/mp4,video/quicktime,video/webm,video/x-msvideo,.mp4,.mov,.webm,.avi onChange onFile
  - **Import from YouTube card**: mt-4 rounded-card border border-gray-800 bg-gray-900/50 p-4
    - Title: <Youtube icon h-4 w-4 text-red-400> Import from YouTube text-sm font-medium text-gray-200
    - Form: mt-2.5 flex flex-col gap-2 sm:flex-row, onSubmit e.preventDefault() void importYouTube()
      - Input: value ytUrl, onChange setYtUrl, disabled ytImporting, placeholder "Paste a link — youtube.com/watch?v=…, youtu.be/…, /shorts/…", aria-label "YouTube video URL", class h-10 w-full rounded-input border border-gray-700 bg-gray-900 px-3 text-sm text-white placeholder-gray-500 hover:border-gray-600 focus:border-blue-500 disabled:opacity-60
      - Button: type submit size sm loading ytImporting icon Youtube h-4 w-4 class h-10 shrink-0 sm:w-auto w-full, text {ytImporting ? "Importing…" : "Import"}
    - When importing: mt-3 ProgressBar indeterminate + text-xs text-gray-500 "Downloading from YouTube — long videos can take a minute."
    - Note: mt-2 text-xs text-gray-500 "The video is downloaded straight to your project. Only import content you own or have permission to use."

**importYouTube() function** (in VideoCompositor.tsx):
\`\`\`ts
const importYouTube = async () => {
  const url = ytUrl.trim();
  if (!url) { toast.warning("No link", "Paste a YouTube link first."); return; }
  setYtImporting(true);
  try {
    const res = await http.post<{ fileKey: string; name: string; size: number }>("/upload/youtube", { url }, { timeout: 300_000 }); // 5 min for long videos
    const streamUrl = \`/api/v1/upload/file/\${res.fileKey}\`;
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
\`\`\`

**Backend** (server/src/lib/ytdlp.ts + routes/upload.ts):
- Vendored yt-dlp zipapp vendor/yt-dlp/yt-dlp (needs python3), auto-detected, override via YTDLP_PATH env, YTDLP_COOKIES optional cookies.txt for bot/age-gated, YTDLP_MAX_DURATION caps length default 1200s, YTDLP_TIMEOUT_MS 240s
- POST /api/v1/upload/youtube with {url} → uses yt-dlp to download, returns fileKey UUIDv7, stored under uploads dir, streamed via GET /api/v1/upload/file/:key Range supported
- videoFromYouTube = videoUrl != null && videoUrl.startsWith("/api/v1/upload/file/") → Badge tone violet

**After import**:
- videoRef src=streamUrl, muted playsInline, onLoadedMetadata sets videoDuration, onEnded pauses if no audio
- previewRef measures previewW via ResizeObserver, k = previewW/1280 for subtitle scaling
- Timeline shows video duration + audio waveform + subtitle cues
- Export: POST /api/v1/export/video with videoFileKey + audioFileKey + subtitleData + exportSettings, job QUEUED→PROCESSING→COMPLETED, SSE progress, download

### JARVIS Paste Methods:

**A) API Direct (fastest, recommended for JARVIS, no UI):**
\`\`\`python
from _soundwave_client import api_request, resolve_api_url
api_url = resolve_api_url()  # env SOUNDWAVE_API_URL or config/api_keys.json or default http://localhost:4000
res = api_request("POST", "/api/v1/upload/youtube", json_data={"url": "https://youtube.com/watch?v=..."}, timeout=300)
file_key = res["fileKey"]  # UUIDv7
name = res["name"]
stream_url = f"/api/v1/upload/file/{file_key}"
# Now video ready as background, use as videoFileKey in export job
\`\`\`

**B) Browser Automation (opens UI and pastes):**
Mark LIII has browser_control (open URLs, navigate tabs, Playwright) + computer_control (keyboard shortcuts, mouse, window management, pyautogui, pygetwindow, pywinauto)
\`\`\`python
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
\`\`\`

**C) Clipboard:**
\`\`\`python
import pyperclip
pyperclip.copy("https://youtube.com/watch?v=...")
# Then computer_control action=hotkey key=ctrl+v + press_key enter
# Input has aria-label="YouTube video URL"
\`\`\`

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

This is exactly how JARVIS pastes YouTube link into Soundwave Video Editor.
`.trim(),
  structure: `
soundwave-ai/
├── frontend/            # Vite + React SPA
│   ├── src/pages/       # Landing, Pricing, auth, Dashboard, Studio, SubtitleEditor, VideoCompositor (YouTube paste here), Projects, Settings, JarvisExpert, Help
│   ├── src/components/  # ui/ primitives, layout/, VoicePicker, Waveform, JarvisWidget, …
│   ├── src/hooks/       # useTTS (edge-tts API call + offline fallback), useJarvisExpert
│   ├── src/lib/         # audio, ttsEngine, voices, subtitlePresets, idb, api, jarvisApi, …
│   └── src/store/       # Zustand: auth, studio, toast
├── server/              # Express API
│   ├── src/routes/      # auth, voices, tts, projects, upload (youtube paste API), export, user, billing, apiKeys, jarvis
│   ├── src/lib/         # auth, edgeTts, store, ffmpeg, ytdlp (yt-dlp wrapper for YouTube paste), plans, security, markLiiiKnowledge, soundwaveKnowledge
│   ├── prisma/schema.prisma
│   └── scripts/generate-samples.ts
├── mark-liii-plugins/   # Drop-in plugins teaching Mark LIII JARVIS to use Soundwave
│   ├── _soundwave_client.py         # Shared helper
│   ├── soundwave_tts.py             # TTS generation
│   ├── soundwave_voices.py          # Voice library
│   ├── soundwave_studio.py          # Master studio control
│   ├── soundwave_projects.py        # Project management
│   ├── soundwave_video.py           # Video compositing
│   ├── soundwave_clone.py           # Voice cloning
│   ├── soundwave_youtube.py         # YouTube import (download + API)
│   ├── soundwave_youtube_paste.py   # PASTE YouTube link into Video Editor (NEW - exact UI flow)
│   └── README.md
├── docs/                # JARVIS_MARK_LIII_EXPERT.md, SOUNDWAVE_FOR_JARVIS.md
└── vendor/              # static ffmpeg + yt-dlp zipapp (for YouTube paste)
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
    purpose: "YouTube import as video background via yt-dlp — download + API import",
    triggers: ["import YouTube", "download YouTube video", "YouTube background", "YouTube to Soundwave", "import from YouTube"],
    parameters: {
      url: "YouTube URL to import",
      action: "info, download, soundwave_import. Default info",
      output_path: "Output path for download action",
    },
    ytDlp: "Vendored vendor/yt-dlp/yt-dlp zipapp needs python3, auto-detected, override via YTDLP_PATH, YTDLP_COOKIES for age/bot-gated, YTDLP_MAX_DURATION caps length, timeout 240s",
  },
  {
    file: "soundwave_youtube_paste.py",
    isPlugin: true,
    name: "soundwave_youtube_paste",
    purpose: "PASTE YouTube link into Soundwave Video Editor — EXACT UI flow, 3 methods: api (direct, fastest), browser (open UI + automate paste), clipboard (copy + focus)",
    triggers: ["paste YouTube link", "import YouTube into editor", "YouTube to video editor", "paste link into video editor", "add YouTube background", "YouTube in Soundwave video", "paste YouTube into Soundwave"],
    parameters: {
      url: "YouTube URL to paste (youtube.com/watch?v=…, youtu.be/…, /shorts/…)",
      method: "Method: api (direct API, fastest, recommended), browser (open UI and automate paste), clipboard (copy to clipboard + focus input), auto (tries api then clipboard). Default auto",
      auto_play: "Whether to auto-play video preview after import, default false",
    },
    pasteWorkflow: `
EXACT UI FLOW FOR PASTING YOUTUBE LINK INTO VIDEO EDITOR:

1. Page: /studio/video — VideoCompositor, left column Video Background section
   - If no video: drag & drop zone + Import from YouTube card
   - Import from YouTube card:
     - Title: <Youtube icon red> Import from YouTube
     - Form: input placeholder "Paste a link — youtube.com/watch?v=…, youtu.be/…, /shorts/…" aria-label "YouTube video URL" class h-10 w-full rounded-input border border-gray-700 bg-gray-900
     - Button: Import with Youtube icon h-10 type submit
     - Importing: ProgressBar indeterminate + "Downloading from YouTube — long videos can take a minute."
     - Note: "The video is downloaded straight to your project. Only import content you own or have permission to use."
   - If video exists: videoName + Badge YouTube violet / Uploaded green + Remove button

2. Backend: POST /api/v1/upload/youtube {url} timeout 300s → {fileKey, name, size}
   - Server runs yt-dlp vendored zipapp vendor/yt-dlp/yt-dlp needs python3, auto-detected, override via YTDLP_PATH, YTDLP_COOKIES for age/bot-gated, YTDLP_MAX_DURATION 1200s cap, YTDLP_TIMEOUT_MS 240s
   - Returns fileKey UUIDv7, stored uploads dir, streamed via GET /api/v1/upload/file/:key Range

3. Frontend after: streamUrl = /api/v1/upload/file/\${fileKey}, setVideoFileKey(fileKey), setVideoUrl(streamUrl), setVideoName(name), studio.setVideo({blob: null, url: streamUrl, name, fileKey})
   - Video element src=streamUrl, muted playsInline, onLoadedMetadata sets videoDuration
   - Badge YouTube violet appears

JARVIS Methods:
A) API Direct (fastest, recommended, no UI):
   from _soundwave_client import api_request
   res = api_request("POST", "/api/v1/upload/youtube", json_data={"url": "https://youtube.com/watch?v=..."}, timeout=300)
   file_key = res["fileKey"]

B) Browser Automation (opens UI and pastes):
   # browser_control action=open url=http://localhost:5173/studio/video
   # Wait 3-4s React SPA load
   # Focus input [aria-label="YouTube video URL"] via playwright or computer_control
   # computer_control action=type_text text=https://youtube.com/watch?v=... OR hotkey ctrl+v
   # computer_control action=press_key key=enter OR click Import button
   # Wait for Badge YouTube
   Playwright:
     await page.goto("http://localhost:5173/studio/video")
     await page.wait_for_selector('[aria-label="YouTube video URL"]', timeout=10000)
     await page.fill('[aria-label="YouTube video URL"]', 'https://youtube.com/watch?v=...')
     await page.click('button:has-text("Import")')
     await page.wait_for_selector('text=YouTube', timeout=120000)

C) Clipboard:
   import pyperclip
   pyperclip.copy("https://youtube.com/watch?v=...")
   # Then computer_control hotkey ctrl+v + enter

Supported URLs: youtube.com/watch?v=..., youtu.be/..., /shorts/..., m.youtube.com/watch?v=... with params &t=30s &list=...

Error handling: No link → toast warning, Invalid → yt-dlp fails 400, Too long → YTDLP_MAX_DURATION 1200s refuses 400, Bot/age-gated → needs YTDLP_COOKIES, Timeout → 300s frontend
`,
    example: "Paste YouTube link https://youtube.com/watch?v=dQw4w9WgXcQ into Soundwave video editor",
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

4. **PASTE YOUTUBE LINK INTO VIDEO EDITOR — THE MAIN WORKFLOW:**
   - **What it is**: User copies YouTube URL (youtube.com/watch?v=…, youtu.be/…, /shorts/…), wants it as background video in Soundwave's Video Compositor at /studio/video
   - **UI Location**: Left column → Video Background section → Import from YouTube card (Youtube icon red) → Form with Input placeholder "Paste a link — youtube.com/watch?v=…, youtu.be/…, /shorts/…" aria-label "YouTube video URL" + Button "Import" with Youtube icon h-10
   - **Backend**: POST /api/v1/upload/youtube {url} timeout 300s → {fileKey, name, size}, server runs yt-dlp vendored zipapp vendor/yt-dlp/yt-dlp needs python3, auto-detected, override via YTDLP_PATH, YTDLP_COOKIES for age/bot-gated, YTDLP_MAX_DURATION 1200s cap, returns fileKey UUIDv7, streamed via GET /api/v1/upload/file/:key Range
   - **For JARVIS — 3 Methods:**
     - **A) API Direct (fastest, recommended, no UI)**: from _soundwave_client import api_request; res = api_request("POST", "/api/v1/upload/youtube", json_data={"url": "https://youtube.com/watch?v=..."}, timeout=300); file_key = res["fileKey"]; stream_url = f"/api/v1/upload/file/{file_key}"; Now video ready as background, use as videoFileKey in export
     - **B) Browser Automation (opens UI and pastes)**: browser_control action=open url=http://localhost:5173/studio/video, wait 3-4s React SPA load, focus input [aria-label="YouTube video URL"] via playwright (page.fill) or computer_control, type/paste URL via computer_control action=type_text or hotkey ctrl+v, press enter or click Import button, wait for Badge YouTube violet
       - Playwright exact: await page.goto("http://localhost:5173/studio/video"); await page.wait_for_selector('[aria-label="YouTube video URL"]', timeout=10000); await page.fill('[aria-label="YouTube video URL"]', 'https://youtube.com/watch?v=...'); await page.click('button:has-text("Import")'); await page.wait_for_selector('text=YouTube', timeout=120000)
       - pyautogui: pyperclip.copy(url); pyautogui.hotkey('ctrl', 'v'); pyautogui.press('enter')
     - **C) Clipboard**: pyperclip.copy(url), then computer_control hotkey ctrl+v + enter, input has aria-label "YouTube video URL"
   - **Supported URLs**: youtube.com/watch?v=..., youtu.be/..., /shorts/..., m.youtube.com/watch?v=... with &t=30s &list=...
   - **Plugin**: soundwave_youtube_paste.py — params url required, method api/browser/clipboard/auto default auto, auto_play bool. Auto tries api then clipboard fallback. Handles all 3 methods + error handling.
   - **Example**: User "Paste YouTube link https://youtube.com/watch?v=dQw4w9WgXcQ into Soundwave video editor" → JARVIS calls soundwave_youtube_paste url=https://... method=auto → via API: fileKey, name, streamUrl, next steps, or via clipboard: copies to clipboard + focus instructions

5. **Manage Projects:**
   - soundwave_projects action=list → ~/Soundwave/projects/ folders
   - action=create title="My Podcast" type=TTS → creates folder + project.json
   - action=show project_id=my_podcast → details, files
   - action=stats → counts by type
   - Cloud via API GET /api/v1/projects (Pro+ for save), POST /, etc.

6. **Video Compositing:**
   - soundwave_video action=workflow → full workflow explanation
   - action=prepare text="Welcome" voice=Jenny aspect=9:16 resolution=1080p → MP3+SRT + video_project.json in ~/Soundwave/video_projects/
   - Background: upload via /api/v1/upload/video or solid color 0x0A0F1C, YouTube via POST /api/v1/upload/youtube with {url} (yt-dlp vendored, Range supported, cookies for age/bot-gated, max duration cap)
   - Export: POST /api/v1/export/video with videoFileKey (nullable), audioFileKey, subtitleData array {start, end, text}, subtitleStyle, exportSettings {resolution 720p/1080p/1440p/4K, aspect 16:9/9:16 portrait 1080x1920 for Shorts/TikTok/Reels, format mp4/webm, quality low/medium/high, fps 24-60, audioVolume, fadeIn/out, videoEnd}
   - Job: QUEUED → PROCESSING (FFmpeg libx264/libvpx-vp9, libass, volume/fades, looping if video shorter) → COMPLETED/FAILED, progress via GET /jobs/:id or SSE /jobs/:id/events, download /jobs/:id/download
   - Quotas: Free 2/hour 720p watermark, Pro 20/hour 1080p, Enterprise 100/hour 4K no watermark

7. **Voice Cloning:**
   - soundwave_clone action=status → config, API endpoints, quotas
   - action=list → GET /api/v1/tts/clone/profiles via API
   - action=clone_info → how to clone: 3-10s clean clip WAV/MP3/FLAC/OGG/M4A max 25MB, Soundwave UI Studio → Clone tab → file+name+refText+consent → POST /profiles multipart 300s timeout
   - action=generate text="Hello cloned" profile_id="abc123" → POST /api/v1/tts/clone → MP3 base64

8. **YouTube Import (general):**
   - soundwave_youtube url=https://youtube.com/watch?v=... action=info → workflow
   - action=download → direct yt-dlp download to ~/Soundwave/youtube/ (finds vendored vendor/yt-dlp/yt-dlp or system yt-dlp, uses python3 for zipapp)
   - action=soundwave_import → POST /api/v1/upload/youtube via Soundwave API
   - For pasting into editor specifically: use soundwave_youtube_paste plugin (more detailed, 3 methods)

### For User: Installing Plugins into Mark LIII

1. Install Mark LIII: git clone https://github.com/FatihMakes/Mark-LIII.git, cd Mark-LIII, python setup.py
2. Install deps: pip install edge-tts requests pyautogui pyperclip (yt-dlp optional, playwright already in Mark LIII requirements)
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
- "Paste YouTube link https://youtube.com/watch?v=... into Soundwave video editor" → uses soundwave_youtube_paste plugin
- "Import YouTube video https://... as background" → uses soundwave_youtube
- "Paste https://youtu.be/... into video editor" → soundwave_youtube_paste
- "Clone my voice"
- "Check Soundwave clone status"

### Architecture Mapping for JARVIS

- Soundwave's edgeTts.ts (Node) ↔ _soundwave_client.py synthesize_edge_tts() (Python edge-tts) — same Microsoft Edge TTS free service
- Soundwave's voices.ts (6 voices) ↔ SOUNDWAVE_VOICES list — same ids, display names, styles
- Soundwave's API routes ↔ api_request() helper — handles SOUNDWAVE_API_URL resolution, api_key header
- Soundwave's project system (Prisma/JSON + local IndexedDB) ↔ ~/Soundwave/projects/ local folders + API
- Soundwave's FFmpeg export ↔ workflow explanation + local FFmpeg check via shutil.which("ffmpeg")
- Soundwave's yt-dlp vendored ↔ yt-dlp binary detection + python3 zipapp handling
- Soundwave's VideoCompositor.tsx YouTube paste UI ↔ soundwave_youtube_paste plugin — exact selectors [aria-label="YouTube video URL"], placeholder "Paste a link — youtube.com/watch?v=…, youtu.be/…, /shorts/…", Import button with Youtube icon, ProgressBar, Badge YouTube violet

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
- For YouTube paste specifically: validate URL contains youtube.com or youtu.be, support all formats (watch?v=, youtu.be/, shorts/, m.youtube.com), try API first (fastest, no UI), fallback to clipboard + browser automation instructions, mention YTDLP_COOKIES for age/bot-gated, YTDLP_MAX_DURATION 1200s cap

### Example: JARVIS Pastes YouTube Link into Video Editor

User: "Paste YouTube link https://www.youtube.com/watch?v=dQw4w9WgXcQ into Soundwave video editor"

JARVIS:
1. Acknowledges: "On it — pasting that YouTube link into Soundwave's Video Editor now..." (in user's language)
2. Calls soundwave_youtube_paste url=https://www.youtube.com/watch?v=dQw4w9WgXcQ method=auto
   - Tries via_api(): api_request POST /api/v1/upload/youtube {url} timeout 300 → {fileKey, name, size}
   - If API fails, fallback to via_clipboard(): pyperclip.copy(url) + instructions to focus input [aria-label="YouTube video URL"] and hotkey ctrl+v + enter
   - Also provides via_browser() instructions with playwright exact selectors
3. Returns: "✅ Pasted YouTube link into Soundwave Video Editor via API: URL https://... → FileKey abc123 (UUIDv7) → Name Rick Astley - Never Gonna Give You Up → Stream URL /api/v1/upload/file/abc123 → Next: In Soundwave UI at http://localhost:5173/studio/video, video appears as background with YouTube badge violet. Then generate voiceover in Studio, add subtitles, export via FFmpeg with 16:9 or 9:16 portrait."

User then sees video in Soundwave UI Video Compositor left column Video Background section with YouTube badge violet, videoName, Remove button, preview via video element src=streamUrl Range supported.

### Example: JARVIS Creates Full Video with YouTube Background

User: "Create a TikTok video with Jenny voice saying Welcome to Soundwave AI, use YouTube https://youtube.com/watch?v=... as background, portrait"

JARVIS:
1. Ack: "On it — creating your portrait TikTok video with Jenny and YouTube background now..."
2. Calls soundwave_youtube_paste url=https://... method=api → fileKey for background
3. Calls soundwave_studio action=tts text="Welcome to Soundwave AI" voice=Jenny aspect=9:16 → MP3 + SRT
4. Calls soundwave_video action=prepare text="Welcome to Soundwave AI" voice=Jenny aspect=9:16 resolution=1080p video_path=fileKey → video project folder
5. Returns: "Created video project with Jenny voiceover + YouTube background https://... → fileKey abc123, portrait 1080x1920 for TikTok, MP3 at ..., SRT with 1 cue. Open Soundwave UI http://localhost:5173/studio/video to style subtitles (TikTok preset) and export MP4 via FFmpeg."

This teaches JARVIS to use Soundwave as its voice studio with YouTube paste.
`.trim();
