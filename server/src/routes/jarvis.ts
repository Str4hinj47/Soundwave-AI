import { Router } from "express";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { validate } from "../middleware/validate.js";
import {
  MARK_LIII_OVERVIEW,
  MARK_LIII_PROJECT_STRUCTURE,
  MARK_LIII_CAPABILITIES,
  MARK_LIII_ACTIONS,
  MARK_LIII_CORE_MODULES,
  MARK_LIII_PLUGIN_TEMPLATE,
  MARK_LIII_ACTION_TEMPLATE,
  MARK_LIII_SETUP_GUIDE,
  MARK_LIII_BEST_PRACTICES,
  MARK_LIII_QUICK_PROMPTS,
  answerMarkLiiiQuestion,
  generatePluginCode,
} from "../lib/markLiiiKnowledge.js";
import {
  SOUNDWAVE_OVERVIEW,
  SOUNDWAVE_JARVIS_PLUGINS,
  SOUNDWAVE_JARVIS_INSTRUCTIONS,
} from "../lib/soundwaveKnowledge.js";

const router = Router();

router.get("/overview", (_req, res) => {
  res.json({ overview: MARK_LIII_OVERVIEW });
});

router.get("/structure", (_req, res) => {
  res.json({ structure: MARK_LIII_PROJECT_STRUCTURE });
});

router.get("/capabilities", (_req, res) => {
  res.json({ capabilities: MARK_LIII_CAPABILITIES, count: MARK_LIII_CAPABILITIES.length });
});

router.get("/actions", (_req, res) => {
  res.json({ actions: MARK_LIII_ACTIONS, count: MARK_LIII_ACTIONS.length });
});

router.get("/actions/:name", (req, res) => {
  const action = MARK_LIII_ACTIONS.find((a) => a.name === req.params.name);
  if (!action) return res.status(404).json({ error: "Action not found", available: MARK_LIII_ACTIONS.map((a) => a.name) });
  res.json({ action });
});

router.get("/core", (_req, res) => {
  res.json({ modules: MARK_LIII_CORE_MODULES, count: MARK_LIII_CORE_MODULES.length });
});

router.get("/core/:file", (req, res) => {
  const mod = MARK_LIII_CORE_MODULES.find((m) => m.file.includes(req.params.file || "") || m.name.toLowerCase().includes((req.params.file || "").toLowerCase()));
  if (!mod) return res.status(404).json({ error: "Core module not found" });
  res.json({ module: mod });
});

router.get("/templates", (_req, res) => {
  res.json({
    pluginTemplate: MARK_LIII_PLUGIN_TEMPLATE,
    actionTemplate: MARK_LIII_ACTION_TEMPLATE,
  });
});

router.get("/setup", (_req, res) => {
  res.json({ setup: MARK_LIII_SETUP_GUIDE });
});

router.get("/best-practices", (_req, res) => {
  res.json({ practices: MARK_LIII_BEST_PRACTICES });
});

router.get("/prompts", (_req, res) => {
  res.json({ prompts: MARK_LIII_QUICK_PROMPTS });
});

router.get("/knowledge", (_req, res) => {
  res.json({
    overview: MARK_LIII_OVERVIEW,
    structure: MARK_LIII_PROJECT_STRUCTURE,
    capabilities: MARK_LIII_CAPABILITIES,
    actions: MARK_LIII_ACTIONS,
    coreModules: MARK_LIII_CORE_MODULES,
    setup: MARK_LIII_SETUP_GUIDE,
    bestPractices: MARK_LIII_BEST_PRACTICES,
    quickPrompts: MARK_LIII_QUICK_PROMPTS,
    templates: {
      plugin: MARK_LIII_PLUGIN_TEMPLATE,
      action: MARK_LIII_ACTION_TEMPLATE,
    },
  });
});

// Soundwave knowledge — teaching JARVIS to use Soundwave
router.get("/soundwave/overview", (_req, res) => {
  res.json({ overview: SOUNDWAVE_OVERVIEW });
});

router.get("/soundwave/plugins", (_req, res) => {
  res.json({ plugins: SOUNDWAVE_JARVIS_PLUGINS, count: SOUNDWAVE_JARVIS_PLUGINS.length });
});

router.get("/soundwave/instructions", (_req, res) => {
  res.json({ instructions: SOUNDWAVE_JARVIS_INSTRUCTIONS });
});

router.get("/soundwave/knowledge", (_req, res) => {
  res.json({
    overview: SOUNDWAVE_OVERVIEW,
    plugins: SOUNDWAVE_JARVIS_PLUGINS,
    instructions: SOUNDWAVE_JARVIS_INSTRUCTIONS,
  });
});

router.get("/soundwave/plugins/files", (_req, res) => {
  try {
    const pluginsDir = path.join(process.cwd(), "..", "mark-liii-plugins");
    const altDir = path.join(process.cwd(), "mark-liii-plugins");
    const dir = fs.existsSync(pluginsDir) ? pluginsDir : altDir;
    if (!fs.existsSync(dir)) {
      return res.json({ files: [], dir, note: "mark-liii-plugins folder not found" });
    }
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".py") || f.endsWith(".md")).map((f) => {
      const fp = path.join(dir, f);
      const stat = fs.statSync(fp);
      return {
        name: f,
        size: stat.size,
        isPlugin: !f.startsWith("_") && f.endsWith(".py"),
        path: `mark-liii-plugins/${f}`,
      };
    });
    res.json({ files, dir, count: files.length });
  } catch (e) {
    res.status(500).json({ error: "Failed to list plugin files", detail: (e as Error).message });
  }
});

router.get("/soundwave/plugins/files/:filename", (req, res) => {
  try {
    const filename = req.params.filename || "";
    if (!/^[a-zA-Z0-9_\-]+\.(py|md)$/.test(filename)) {
      return res.status(400).json({ error: "Invalid filename" });
    }
    const pluginsDir = path.join(process.cwd(), "..", "mark-liii-plugins");
    const altDir = path.join(process.cwd(), "mark-liii-plugins");
    const dir = fs.existsSync(pluginsDir) ? pluginsDir : altDir;
    const filePath = path.join(dir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }
    const content = fs.readFileSync(filePath, "utf-8");
    res.json({ filename, content, size: content.length });
  } catch (e) {
    res.status(500).json({ error: "Failed to read file", detail: (e as Error).message });
  }
});

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).optional().default([]),
});

router.post("/chat", validate({ body: chatSchema }), async (req, res) => {
  const { message } = req.body as z.infer<typeof chatSchema>;
  try {
    const result = answerMarkLiiiQuestion(message);
    res.json({
      answer: result.answer,
      sources: result.sources,
      relatedActions: result.relatedActions || [],
      codeExample: result.codeExample,
      followUp: result.followUp || [],
      meta: { model: "mark-liii-expert-v1", knowledgeCutoff: "2026-09-16", repo: MARK_LIII_OVERVIEW.repo, latency: "local" },
    });
  } catch (e) {
    res.status(500).json({ error: "Expert failed", detail: (e as Error).message });
  }
});

const soundwaveChatSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).optional().default([]),
});

router.post("/soundwave/chat", validate({ body: soundwaveChatSchema }), async (req, res) => {
  const { message } = req.body as z.infer<typeof soundwaveChatSchema>;
  const q = message.toLowerCase();
  try {
    let answer = "";
    let sources: string[] = [];
    let relatedPlugins: string[] = [];

    if (q.includes("install") || q.includes("setup") || q.includes("how to use soundwave") || q.includes("teach jarvis")) {
      answer = SOUNDWAVE_JARVIS_INSTRUCTIONS;
      sources = ["mark-liii-plugins/README.md", "soundwaveKnowledge.ts"];
      relatedPlugins = SOUNDWAVE_JARVIS_PLUGINS.filter((p) => p.isPlugin).map((p) => (p as any).name || p.file);
    } else if (q.includes("tts") || q.includes("voiceover") || q.includes("generate speech") || q.includes("say")) {
      answer = `
**Soundwave TTS — How JARVIS generates speech:**

Soundwave uses Microsoft Neural voices via Edge TTS (free, no API key) — same engine Mark LIII's Python edge-tts.

**Voices (6):**
${SOUNDWAVE_OVERVIEW.voices.map((v) => `- **${v.displayName}** (${v.id}): ${v.style}`).join("\n")}

**For JARVIS:**
- Plugin: soundwave_tts.py — PLUGIN name soundwave_tts, params text (required), voice (Jenny/Ana/Sonia/Christopher/Guy/Ryan or full id), speed 0.5-2.0, pitch -50..50, volume 0-100, play boolean
- Direct: from _soundwave_client import synthesize_edge_tts; path = synthesize_edge_tts(text, voice="en-US-JennyNeural", speed=1.0)
- Saves to ~/Soundwave/tts/, auto-plays cross-platform
- Also creates SRT via text_to_srt_cues() + save_srt()

**Via Soundwave API (optional, needs auth):**
POST /api/v1/tts/synthesize {text, voice, speed, pitch, volume} → {audioBase64, duration, wordTimings, used, limit}

**Example JARVIS command:**
"Generate speech with Jenny: Hello world, welcome to Soundwave" → soundwave_tts text="Hello world..." voice=Jenny

Install: pip install edge-tts requests
`;
      sources = ["mark-liii-plugins/soundwave_tts.py", "mark-liii-plugins/_soundwave_client.py", "server/src/lib/edgeTts.ts"];
      relatedPlugins = ["soundwave_tts", "soundwave_voices"];
    } else if (q.includes("voice") && (q.includes("list") || q.includes("recommend") || q.includes("library"))) {
      answer = `
**Soundwave Voice Library — 6 Microsoft Neural voices:**

${SOUNDWAVE_OVERVIEW.voices.map((v) => `- **${v.displayName}** (${v.id}) — ${v.gender}, ${v.accent}: ${v.style}`).join("\n")}

**Recommendation logic:**
- TikTok/Reels/Shorts/energetic/young/ad → Ana
- Corporate/business/professional/elegant/British female → Sonia
- Trailer/deep/authoritative/movie/podcast → Christopher
- Vlog/casual/friendly/tutorial/conversational → Guy
- News/education/formal/British male → Ryan
- Default versatile → Jenny

**Plugins:**
- soundwave_voices.py: action list/describe/recommend/sample, voice param, use_case param
`;
      sources = ["mark-liii-plugins/soundwave_voices.py", "server/src/lib/voices.ts"];
      relatedPlugins = ["soundwave_voices"];
    } else if (q.includes("video") || q.includes("subtitle") || q.includes("burn") || q.includes("export")) {
      answer = `
**Soundwave Video Compositor — How JARVIS makes videos with subtitles:**

Workflow:
1. TTS: soundwave_tts or soundwave_studio action=tts text="..." voice=Jenny → MP3 + SRT
2. Subtitle styling: presets TikTok bold center, YouTube classic, minimal — font, size, color, background, position, animation
3. Background video: upload via POST /api/v1/upload/video (UUIDv7) or solid color 0x0A0F1C or YouTube via POST /api/v1/upload/youtube with {url} (yt-dlp vendored, Range supported)
4. Export: POST /api/v1/export/video with videoFileKey (nullable), audioFileKey, subtitleData array {start, end, text}, subtitleStyle, exportSettings {resolution 720p/1080p/1440p/4K, aspect 16:9 landscape 1920x1080 or 9:16 portrait 1080x1920 for Shorts/TikTok/Reels, format mp4/webm, quality low/medium/high, fps 24-60}
5. Job: QUEUED → PROCESSING (FFmpeg libx264/libvpx-vp9, libass, looping if video shorter) → COMPLETED/FAILED, progress via GET /jobs/:id or SSE /jobs/:id/events, download /jobs/:id/download
6. Quotas: Free 2/hour 720p watermark, Pro 20/hour 1080p, Enterprise 100/hour 4K no watermark

**For JARVIS:**
- soundwave_video.py: action workflow/prepare/export/youtube_import/status
- prepare: text + voice + aspect + resolution + video_path → creates ~/Soundwave/video_projects/
`;
      sources = ["mark-liii-plugins/soundwave_video.py", "server/src/routes/export.ts"];
      relatedPlugins = ["soundwave_video", "soundwave_youtube"];
    } else if (q.includes("project")) {
      answer = `
**Soundwave Projects:**

Schema: title 1-120, type TTS|SUBTITLE|VIDEO, textContent 20k max, voiceId, voiceSettings, characterCount, duration, subtitleData, subtitleStyle, videoBackgroundUrl, audioUrl, status DRAFT|PROCESSING|COMPLETED|FAILED, storageType CLOUD|LOCAL

Endpoints: GET /api/v1/projects (list), POST / (create, Pro+), GET /:id, PUT /:id, PUT /:id/subtitles, DELETE /:id, POST /:id/duplicate
Free: local only (IndexedDB), Pro: cloud save

**For JARVIS:**
- soundwave_projects.py: action list/create/show/duplicate/delete/stats
- Local: ~/Soundwave/projects/ folders + project.json
`;
      sources = ["mark-liii-plugins/soundwave_projects.py", "server/src/routes/projects.ts"];
      relatedPlugins = ["soundwave_projects"];
    } else if (q.includes("clone")) {
      answer = `
**Soundwave Voice Cloning:**

Config: VOICECLONE_URL (empty = off), VOICECLONE_TOKEN, VOICECLONE_MIN_PLAN FREE, timeout 600s
API: GET /api/v1/tts/clone/status, GET /profiles, POST /profiles multipart file+name+refText+consent, DELETE /profiles/:id, POST /clone {text, profileId, speed} → MP3 base64

Reference clip: 3-10s clean speech, WAV/MP3/FLAC/OGG/M4A max 25MB

**For JARVIS:**
- soundwave_clone.py: action status/list/clone_info/generate
`;
      sources = ["mark-liii-plugins/soundwave_clone.py", "server/src/lib/voiceclone.ts"];
      relatedPlugins = ["soundwave_clone"];
    } else if (q.includes("youtube")) {
      answer = `
**Soundwave YouTube Import:**

Vendored yt-dlp zipapp vendor/yt-dlp/yt-dlp needs python3, auto-detected, override via YTDLP_PATH, YTDLP_COOKIES for age/bot-gated, YTDLP_MAX_DURATION caps length

Endpoint: POST /api/v1/upload/youtube {url} → fileKey, GET /file/:key Range

**For JARVIS:**
- soundwave_youtube.py: url required, action info/download/soundwave_import
`;
      sources = ["mark-liii-plugins/soundwave_youtube.py", "server/src/lib/ytdlp.ts"];
      relatedPlugins = ["soundwave_youtube", "soundwave_video"];
    } else {
      answer = SOUNDWAVE_JARVIS_INSTRUCTIONS;
      sources = ["mark-liii-plugins/README.md", "soundwaveKnowledge.ts"];
      relatedPlugins = SOUNDWAVE_JARVIS_PLUGINS.filter((p) => p.isPlugin).map((p) => (p as any).name || p.file);
    }

    res.json({
      answer,
      sources,
      relatedPlugins,
      meta: { model: "soundwave-expert-v1", knowledgeCutoff: "2026-09-16", repo: SOUNDWAVE_OVERVIEW.repo, latency: "local" },
      followUp: [
        "How to install Soundwave plugins into Mark LIII?",
        "Generate speech with Jenny voice",
        "List Soundwave voices and recommend for TikTok",
        "How to make video with subtitles portrait?",
        "How to clone my voice?",
        "Import YouTube video as background",
      ],
    });
  } catch (e) {
    res.status(500).json({ error: "Soundwave expert failed", detail: (e as Error).message });
  }
});

const generateSchema = z.object({
  description: z.string().min(5).max(500),
  name: z.string().min(1).max(32).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/).optional(),
});

router.post("/generate-plugin", validate({ body: generateSchema }), async (req, res) => {
  const { description, name } = req.body as z.infer<typeof generateSchema>;
  try {
    const { code, explanation } = generatePluginCode(description, name);
    res.json({
      pluginName: name || description.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30),
      code,
      explanation,
      fileName: `${name || description.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30) || "my_plugin"}.py`,
      installPath: "plugins/",
      instructions: [
        "Save the file in Mark-LIII/plugins/ (no leading underscore)",
        "Install any extra pip dependencies mentioned in code comments",
        "Restart Mark-LIII — it auto-discovers plugins on launch",
        "Enable/disable via ⚙ → Plugin Manager",
        "Test by saying trigger phrase described in PLUGIN['description']",
      ],
    });
  } catch (e) {
    res.status(500).json({ error: "Generation failed", detail: (e as Error).message });
  }
});

const actionGenerateSchema = z.object({
  description: z.string().min(5).max(500),
  name: z.string().min(1).max(32).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/).optional(),
});

router.post("/generate-action", validate({ body: actionGenerateSchema }), async (req, res) => {
  const { description, name } = req.body as z.infer<typeof actionGenerateSchema>;
  try {
    const { code, explanation } = generatePluginCode(description, name);
    const actionCode = code
      .replace("PLUGIN =", "def handler_placeholder(parameters: dict, player=None, speak=None, response=None, session_memory=None) -> str:\n    # Implement your logic here\n    return \"Done.\"\n\nTOOL = {")
      .replace('"name":', '"name":')
      .replace("def run(", "def handler_placeholder(")
      .replace("PLUGIN_SETTINGS", "# For bundled actions, no PLUGIN_SETTINGS — use TOOL only\n# TOOL_SETTINGS = ");
    res.json({
      actionName: name || "my_action",
      code: actionCode,
      explanation: explanation.replace("plugin", "action").replace("plugins/", "actions/"),
      fileName: `${name || "my_action"}.py`,
      installPath: "actions/",
    });
  } catch (e) {
    res.status(500).json({ error: "Generation failed", detail: (e as Error).message });
  }
});

export default router;
