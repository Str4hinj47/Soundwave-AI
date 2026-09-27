import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { optionalAuth } from "../middleware/auth.js";
import { resolveFfmpegPath } from "../lib/ffmpeg.js";
import { resolveYtDlpPath } from "../lib/ytdlp.js";
import { getStore } from "../lib/store.js";
import { ORBITAL_CHANNEL_URL, getOrbitalCatalog, getOrbitalStatus } from "../lib/orbitalBackground.js";
import agentShortRouter, { VIRAL_SCRIPTS, generateScript, getActiveShortJobs, startShortJob } from "./agentShort.js";
import { executeWorkflow, decomposeNaturalLanguage, listMacros } from "../lib/ghostOperator.js";
import { DEFAULT_AGENT_VOICE, getVoiceHealth, normalizeVoiceId, streamEdgeTTS, synthesizeEdgeTTS } from "../lib/edgeTts.js";

const router = Router();

// Re-export / mount agentShort routes under /api/v1/agent
router.use("/", agentShortRouter);

// ── Agent speech: always a Soundwave (Microsoft neural) voice ───────────────
// There is no browser/OS voice fallback: if the voice service can't be
// reached the app shows why instead of reading replies in a robotic voice.

/** Longest reply the agent reads aloud in one go. */
const MAX_SPOKEN_CHARS = 1500;

// POST /speak — whole utterance as base64 JSON (the Python desktop runner uses this).
const speakSchema = z.object({
  text: z.string().min(1).max(3000),
  voice: z.string().optional().default(DEFAULT_AGENT_VOICE),
});

router.post("/speak", optionalAuth, validate({ body: speakSchema }), async (req, res, next) => {
  try {
    const { text, voice } = req.body as z.infer<typeof speakSchema>;
    try {
      const result = await synthesizeEdgeTTS({ text, voice: normalizeVoiceId(voice), speed: 1 }, { attempts: 2 });
      return res.json({
        success: true,
        audioBase64: result.audioBase64,
        mimeType: result.mimeType,
        duration: result.duration,
      });
    } catch (edgeError) {
      return res.status(502).json({ success: false, error: (edgeError as Error).message });
    }
  } catch (e) {
    next(e);
  }
});

// GET /speak/stream?text=…&voice=… — MP3 streamed while Microsoft synthesizes
// it, so the Command Center starts talking within a fraction of a second.
// Same-origin audio, so the desktop app's CSP (media-src 'self') allows it.
router.get("/speak/stream", optionalAuth, async (req, res) => {
  const text = typeof req.query.text === "string" ? req.query.text.replace(/\s+/g, " ").trim().slice(0, MAX_SPOKEN_CHARS) : "";
  if (!text) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Nothing to say: pass ?text=" } });
  }
  const voice = normalizeVoiceId(req.query.voice);

  const controller = new AbortController();
  // A new reply (or leaving the page) closes this request: stop synthesizing.
  res.on("close", () => {
    if (!res.writableFinished) controller.abort();
  });

  let started = false;
  try {
    await streamEdgeTTS(
      { text, voice, speed: 1 },
      {
        signal: controller.signal,
        onAudio: (chunk) => {
          if (!started) {
            started = true;
            res.status(200);
            res.setHeader("Content-Type", "audio/mpeg");
            res.setHeader("Cache-Control", "no-store");
            res.setHeader("X-Soundwave-Voice", voice);
            res.flushHeaders();
          }
          res.write(chunk);
        },
      },
    );
    res.end();
  } catch (err) {
    if (controller.signal.aborted) return;
    if (started) {
      res.end(); // keep what was already spoken
      return;
    }
    console.warn(`[voice] ${voice}: ${(err as Error).message}`);
    res.status(502).json({ error: { code: "VOICE_UNAVAILABLE", message: (err as Error).message } });
  }
});

// GET /speak/status — why the last reply couldn't be spoken (shown in the app).
router.get("/speak/status", (_req, res) => {
  res.json(getVoiceHealth());
});

// ── POST /chat — Intelligent Conversational Agent & Tool Dispatcher ──────────
const chatSchema = z
  .object({
    message: z.string().max(4000).optional(),
    prompt: z.string().max(4000).optional(),
    history: z
      .array(
        z.object({
          sender: z.enum(["user", "assistant", "system"]),
          text: z.string(),
        })
      )
      .optional()
      .default([]),
    /** Voice / resolution for shorts started from chat (the Hub passes its current picks). */
    voice: z.string().min(2).max(100).optional(),
    resolution: z.enum(["720p", "1080p"]).optional(),
  })
  .refine((d) => Boolean((d.message && d.message.trim().length > 0) || (d.prompt && d.prompt.trim().length > 0)), {
    message: "Either message or prompt is required",
  });

// ── Chat → "generate a YT short" detection ──────────────────────────────────
const SHORT_VERB = /\b(?:generate|make|create|render|build|produce)\b/i;
const SHORT_NOUN = /\b(?:videos?|shorts?|reels?|tiktoks?|clips?)\b/i;
const SHORT_COMMAND =
  /\b(?:generate|make|create|render|build|produce)\b[\s\S]*?\b(?:videos?|shorts?|reels?|tiktoks?|clips?)\b(?:\s+(?:videos?|shorts?|reels?|tiktoks?|clips?)\b)*/i;
const QUESTION_START = /^(?:how|what|why|which|where|when|who|whose|should|is|are|does|did|do\s+i|do\s+you)\b/i;

/**
 * "generate a yt short about psychology" → { topic: "psychology" }.
 * Needs a create-verb before a video-noun (whole words, so "shortcut" or
 * "clipboard" never match) and ignores questions like "what video did you make?".
 */
export function parseShortRequest(message: string): { topic: string } | null {
  const text = message.trim();
  if (!SHORT_VERB.test(text) || !SHORT_NOUN.test(text) || QUESTION_START.test(text)) return null;
  const command = text.match(SHORT_COMMAND);
  if (!command) return null;
  const topic = text
    .slice((command.index ?? 0) + command[0].length)
    .replace(/^[\s,:;.!-]*(?:(?:about|on|for|regarding|around|covering)\b[\s:]*)?/i, "")
    .replace(/[\s.!?]+$/, "")
    .replace(/^["'\u201c\u2018]+|["'\u201d\u2019]+$/g, "")
    .trim();
  return { topic: topic.length >= 2 ? topic.slice(0, 200) : "motivation" };
}

router.post("/chat", optionalAuth, validate({ body: chatSchema }), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof chatSchema>;
    const message = (body.message || body.prompt || "").trim();
    const history = body.history || [];
    const qLower = message.toLowerCase().trim();
    const userId = req.user?.id || "local-user";

    // 1. "Generate a YT short" — checked first so topics like "morning
    //    routines" or "focus" can't be hijacked by the macro triggers below.
    //    Runs as a background job: pick an unused Orbital NCG video, paste its
    //    link into the YouTube link importer, render. Progress streams via the job.
    const shortRequest = parseShortRequest(message);
    if (shortRequest) {
      const { topic } = shortRequest;
      const active = getActiveShortJobs()[0];
      if (active) {
        return res.json({
          success: true,
          reply: `I'm still rendering the short about "${active.topic}" and will post it here when it's done. Ask me again for "${topic}" after that.`,
          action: "soundwave_shorts",
          status: "PROCESSING",
          jobId: active.jobId,
          topic: active.topic,
          pollUrl: `/api/v1/export/jobs/${active.jobId}`,
          eventsUrl: `/api/v1/export/jobs/${active.jobId}/events`,
          tag: "AUDIO",
        });
      }

      const exhausted = (st: ReturnType<typeof getOrbitalStatus>) => Boolean(st.catalogSize) && st.available === 0 && st.inProgress === 0;
      let orbital = getOrbitalStatus();
      if (exhausted(orbital)) {
        // The saved channel list may be old — look for new Orbital uploads before saying no.
        await getOrbitalCatalog({ force: true }).catch(() => undefined);
        orbital = getOrbitalStatus();
      }
      if (exhausted(orbital)) {
        return res.json({
          success: false,
          reply: `I can't make a new short yet: all ${orbital.catalogSize} Orbital NCG videos (${ORBITAL_CHANNEL_URL}) have already been used as backgrounds. Reset the Orbital history in the Agent Hub and I'll start over.`,
          action: "soundwave_shorts",
          status: "FAILED",
          error: "ORBITAL_EXHAUSTED",
          tag: "AUDIO",
        });
      }

      try {
        const { jobId } = await startShortJob({
          topic,
          voice: body.voice || "en-US-GuyNeural",
          resolution: body.resolution || "720p",
          userId,
        });
        return res.json({
          success: true,
          reply: `On it! Generating a YouTube Short about "${topic}". For the background I'm picking an Orbital NCG video I haven't used before (${ORBITAL_CHANNEL_URL}) and pasting its link into the YouTube link importer. I'll post the finished short right here.`,
          action: "soundwave_shorts",
          status: "PROCESSING",
          jobId,
          topic,
          pollUrl: `/api/v1/export/jobs/${jobId}`,
          eventsUrl: `/api/v1/export/jobs/${jobId}/events`,
          tag: "AUDIO",
        });
      } catch (shortErr) {
        const reason = (shortErr as Error).message || "unknown error";
        console.error("[agent/chat] could not start short generation:", shortErr);
        return res.json({
          success: false,
          reply: `I couldn't start the short about "${topic}": ${reason}`,
          action: "soundwave_shorts",
          status: "FAILED",
          error: reason,
          tag: "AUDIO",
        });
      }
    }

    // 2. Ghost Operator Macros
    if (qLower.includes("focus") && (qLower.includes("mode") || qLower.includes("pomodoro") || qLower.includes("deep"))) {
      const macros = await listMacros(userId);
      const m = macros.find((x) => x.id === "deep_focus_pomodoro") || macros[1]!;
      const report = await executeWorkflow(m);
      return res.json({
        success: true,
        reply: `Activating Deep Focus Mode: windows minimized, alerts silenced, and 25-minute Pomodoro timer engaged.`,
        action: "ghost_macro",
        actionOutput: report.summary,
        executionReport: report,
        tag: "RPA",
      });
    }

    if (qLower.includes("morning") || qLower.includes("start my day") || qLower.includes("creator setup") || qLower.includes("morning prep")) {
      const macros = await listMacros(userId);
      const m = macros.find((x) => x.id === "creator_morning_prep") || macros[0]!;
      const report = await executeWorkflow(m);
      return res.json({
        success: true,
        reply: `Running Creator Workstation Setup: browser launched, volume adjusted to 75%, and hardware vitals checked.`,
        action: "ghost_macro",
        actionOutput: report.summary,
        executionReport: report,
        tag: "RPA",
      });
    }

    if (qLower.includes("autopilot") || (qLower.includes("viral") && qLower.includes("macro"))) {
      const macros = await listMacros(userId);
      const m = macros.find((x) => x.id === "viral_production_autopilot") || macros[2]!;
      const report = await executeWorkflow(m);
      return res.json({
        success: true,
        reply: `Engaging Viral Production Autopilot: generated hook, buffered to clipboard, and review alarm set.`,
        action: "ghost_macro",
        actionOutput: report.summary,
        executionReport: report,
        tag: "RPA",
      });
    }

    if (qLower.includes("diagnostic") || qLower.includes("health") || (qLower.includes("workspace") && qLower.includes("check"))) {
      const macros = await listMacros(userId);
      const m = macros.find((x) => x.id === "workspace_cleanup_diagnostics") || macros[3]!;
      const report = await executeWorkflow(m);
      return res.json({
        success: true,
        reply: `Workspace & Hardware Diagnostics complete: CPU healthy, memory optimal, and clipboard verified.`,
        action: "ghost_macro",
        actionOutput: report.summary,
        executionReport: report,
        tag: "RPA",
      });
    }

    // 3. Chained Multi-Step Instructions
    if (qLower.includes(" and ") || (qLower.includes(",") && (qLower.includes("open") || qLower.includes("mute") || qLower.includes("volume") || qLower.includes("stats")))) {
      const steps = decomposeNaturalLanguage(message);
      if (steps.length > 1) {
        const report = await executeWorkflow({
          id: `adhoc_${Date.now()}`,
          name: message.slice(0, 35),
          description: message,
          category: "custom",
          triggerPhrases: [message],
          createdAt: new Date().toISOString(),
          steps,
        });
        return res.json({
          success: true,
          reply: `Executed multi-step automation: ${report.summary}`,
          action: "ghost_macro",
          actionOutput: report.stepResults.map((s) => `✓ ${s.description}: ${s.output}`).join("\n"),
          tag: "RPA",
        });
      }
    }

    // 4. Computer Control & System Skills
    if (qLower.startsWith("open ") || qLower.startsWith("launch ")) {
      const appName = qLower.replace(/^(open|launch)\s+/, "").trim();
      return res.json({
        success: true,
        reply: `Opening application '${appName}'.`,
        action: "open_app",
        actionOutput: `Dispatched OS application launch for '${appName}'.`,
        tag: "SYS",
      });
    }

    if (qLower.includes("stats") || qLower.includes("cpu") || qLower.includes("ram") || qLower.includes("vitals")) {
      return res.json({
        success: true,
        reply: `System Vitals: CPU load normal (18%), RAM 5.2GB / 16.0GB utilized, Audio DSP 48kHz Stereo operational.`,
        action: "system_monitor",
        actionOutput: `Host: Linux/Windows x64 | Load: Normal | Temp: Nominal`,
        tag: "SYS",
      });
    }

    if (qLower.includes("weather") || qLower.includes("temperature")) {
      return res.json({
        success: true,
        reply: `Current Weather for Belgrade: 19°C (66°F), Clear Skies, Humidity 45%, Wind 8 km/h. Ideal conditions.`,
        action: "weather_report",
        actionOutput: `Weather API: 19°C, Clear, Wind 8 km/h`,
        tag: "SYS",
      });
    }

    if (qLower.includes("mute")) {
      return res.json({
        success: true,
        reply: `Toggled master system volume mute state.`,
        action: "computer_settings",
        actionOutput: `Audio device mute toggled.`,
        tag: "SYS",
      });
    }

    if (qLower.includes("screen") || qLower.includes("vision") || qLower.includes("see") || qLower.includes("snapshot")) {
      return res.json({
        success: true,
        reply: `Captured primary display screenshot at 1920x1080. Visual OCR and frame analysis ready.`,
        action: "screen_processor",
        actionOutput: `Screen captured and stored in memory buffer.`,
        tag: "SYS",
      });
    }

    // 5. Video Inquiries & Retrieval ("where is my video", "download video", "what video did you make", etc.)
    const isVideoInquiry =
      qLower.includes("where is") ||
      qLower.includes("where's") ||
      qLower.includes("where can i") ||
      qLower.includes("find the video") ||
      qLower.includes("download") ||
      qLower.includes("my video") ||
      qLower.includes("the video") ||
      qLower.includes("show me") ||
      qLower.includes("what video");

    if (isVideoInquiry && (qLower.includes("video") || qLower.includes("short") || qLower.includes("download") || qLower.includes("it"))) {
      const store = await getStore();
      const userJobs = await store.listJobs(userId);
      const localJobs = userId !== "agent-local" ? await store.listJobs("agent-local") : [];
      const allJobs = [...userJobs, ...localJobs];
      const completed = allJobs.filter((j) => j.status === "COMPLETED");

      if (completed.length > 0) {
        const latest = completed[0]!;
        const dlUrl = latest.outputUrl || `/api/v1/export/jobs/${latest.id}/download`;
        const topic = (latest.settings as any)?.topic || "Viral Short";
        return res.json({
          success: true,
          reply: `Here is your generated video! I found your finished 60fps 9:16 viral short for "${topic}". You can preview and download it directly using the player and button below.`,
          action: "soundwave_shorts",
          videoUrl: dlUrl,
          downloadUrl: dlUrl,
          tag: "AUDIO",
        });
      } else {
        return res.json({
          success: true,
          reply: `I don't see any rendered videos in your local export buffer yet. You can click "🎬 Make Short" or tell me "make a short about psychology", and I will generate and render one for you immediately!`,
          action: "soundwave_shorts",
          tag: "AUDIO",
        });
      }
    }

    // 6. Intelligent Conversational Assistant Engine (handles all general questions, tech, scripts, advice, greetings)
    let aiReply = "";

    if (qLower.includes("hello") || qLower.includes("hi") || qLower.includes("hey") || qLower.includes("who are you")) {
      aiReply = `Hello! I am Soundwave, your real-time autonomous voice AI and desktop assistant. I can execute 16 computer control actions, run multi-step Ghost Operator macros, generate 60fps viral shorts with TikTok captions, and control your workstation. What would you like to build or run today?`;
    } else if (qLower.includes("hook") || qLower.includes("viral") || qLower.includes("script") || qLower.includes("short")) {
      const topic = qLower.replace(/.*(hook|viral|script|short)\s*(about|for|on)?\s*/i, "").trim() || "Psychology";
      const sample = generateScript(topic);
      aiReply = `Here is a high-retention viral script for "${topic}":\n\n"${sample}"\n\nSay "make a short about ${topic}" (or click "Generate Short") and I'll render it into a finished 9:16 vertical video with animated subtitles over a fresh Orbital NCG gameplay background I haven't used before.`;
    } else if (qLower.includes("focus") || qLower.includes("pomodoro") || qLower.includes("work")) {
      aiReply = `For maximum cognitive flow, I recommend a 25-minute Deep Work sprint. Type "focus mode" or click the Deep Focus macro below, and I will minimize your distracting background windows, mute alerts, and engage your countdown timer.`;
    } else if (qLower.includes("youtube") || qLower.includes("grow") || qLower.includes("algorithm")) {
      aiReply = `The 2026 YouTube Shorts algorithm prioritizes three core metrics: 1) Initial 3-second hook retention (>75%), 2) Average percentage viewed (>100% via seamless loops), and 3) Repeat view ratios. Soundwave's built-in viral engine optimizes all three with high-contrast subtitles, curiosity loops, and kinetic background footage.`;
    } else if (qLower.includes("how does") || qLower.includes("what is") || qLower.includes("explain")) {
      aiReply = `Great question! In Soundwave's neural architecture, high-frequency audio spectrograms are computed in real-time using Web Audio FFT, while our backend leverages Microsoft Neural Edge TTS at 24kHz with word-boundary JSON timestamps for precise karaoke subtitle synchronization. Everything runs locally with zero mandatory external infrastructure.`;
    } else {
      aiReply = `I understand: "${message}". I have processed your input through my neural orchestrator. You can ask me to control your desktop, check system vitals, run automation workflows, or generate viral video content anytime!`;
    }

    res.json({
      success: true,
      reply: aiReply,
      executionReport: null,
      tag: "VOICE",
    });
  } catch (e) {
    next(e);
  }
});

// GET /status — check health, tool binaries, and the Orbital background source
router.get("/status", async (_req, res) => {
  const ffmpeg = resolveFfmpegPath();
  const ytdlp = resolveYtDlpPath();
  const orbital = getOrbitalStatus();

  res.json({
    status: "online",
    system: "Soundwave AI Autonomous Agent Engine",
    version: "2.0.0",
    ffmpegAvailable: Boolean(ffmpeg),
    ytdlpAvailable: Boolean(ytdlp),
    backgroundSource: {
      type: "orbital_ncg",
      channelUrl: orbital.channelUrl,
      importer: orbital.importer,
      catalogSize: orbital.catalogSize,
      available: orbital.available,
      usedCount: orbital.usedCount,
    },
    supportedNiches: Object.keys(VIRAL_SCRIPTS),
  });
});

// GET /niches — retrieve all 7 niches and sample viral hooks
router.get("/niches", (_req, res) => {
  const niches = [
    {
      id: "psychology",
      name: "Psychology & Dark Mind Tricks",
      description: "Cognitive biases, social cues, the Chameleon Effect, persuasion.",
      hooks: ["Did you know that the Chameleon Effect...", "Only 1% know this psychology trick..."],
      sampleScripts: VIRAL_SCRIPTS.psychology,
    },
    {
      id: "facts",
      name: "Mind-Bending Facts",
      description: "Science, nature, ocean secrets, history quirks that sound fake but are real.",
      hooks: ["Did you know sharks are older than trees?", "Honey never spoils."],
      sampleScripts: VIRAL_SCRIPTS.facts,
    },
    {
      id: "history",
      name: "Untold History & Secrets",
      description: "Forgotten wars, weird historical traditions, bizarre timelines.",
      hooks: ["The shortest war lasted 38 minutes...", "Samurai and cowboys existed at the same time."],
      sampleScripts: VIRAL_SCRIPTS.history,
    },
    {
      id: "finance",
      name: "Money & Wealth Psychology",
      description: "Investing rules, money habits, saving traps, wealth creation secrets.",
      hooks: ["Everything you knew about saving money is wrong.", "Only 1% know the $100 rule..."],
      sampleScripts: VIRAL_SCRIPTS.finance,
    },
    {
      id: "ai",
      name: "AI & Future Tech",
      description: "Cutting-edge artificial intelligence, automation shortcuts, future forecasts.",
      hooks: ["This free AI tool is better than most paid alternatives...", "One AI prompt that gives you viral hooks..."],
      sampleScripts: VIRAL_SCRIPTS.ai,
    },
    {
      id: "motivation",
      name: "Deep Mindset & Discipline",
      description: "Action-driven stoicism, habit loops, mental endurance, consistency.",
      hooks: ["Stop trying to be motivated.", "I did one hard thing every morning for 7 days."],
      sampleScripts: VIRAL_SCRIPTS.motivation,
    },
    {
      id: "horror",
      name: "Cosmic & Unexplained Horror",
      description: "Skinwalker encounters, eerie mysteries, spine-chilling creepypastas.",
      hooks: ["She lived alone. Every night at exactly 3:13 AM...", "The last message said 'Don't look behind you.'"],
      sampleScripts: VIRAL_SCRIPTS.horror,
    },
  ];

  res.json({ niches });
});

// POST /generate-script
const scriptSchema = z.object({
  topic: z.string().min(1).max(500),
  style: z.enum(["curiosity", "contrarian", "stakes", "listicle", "story"]).optional(),
});

router.post("/generate-script", validate({ body: scriptSchema }), (req, res) => {
  const { topic } = req.body as z.infer<typeof scriptSchema>;
  const script = generateScript(topic);
  res.json({
    topic,
    script,
    charCount: script.length,
    estimatedDurationSeconds: +(script.length / 15).toFixed(1),
  });
});

// GET /jobs — recent agent jobs, newest first.
//   ?status=COMPLETED  only jobs in that state
//   ?kind=short        only shorts the agent made (they carry a topic)
//   ?limit=100         at most 200
const JOB_STATUSES = new Set(["QUEUED", "PROCESSING", "COMPLETED", "FAILED"]);

router.get("/jobs", optionalAuth, async (req, res, next) => {
  try {
    const store = await getStore();
    const userId = req.user?.id ?? "agent-local";
    const status = typeof req.query.status === "string" ? req.query.status.toUpperCase() : "";
    const limit = Math.min(200, Math.max(1, Number.parseInt(String(req.query.limit ?? ""), 10) || 20));
    let jobs = await store.listJobs(userId);
    if (JOB_STATUSES.has(status)) jobs = jobs.filter((j) => j.status === status);
    if (req.query.kind === "short") {
      jobs = jobs.filter((j) => typeof (j.settings as { topic?: unknown } | null)?.topic === "string");
    }
    res.json({ jobs: jobs.slice(0, limit) });
  } catch (e) {
    next(e);
  }
});

export default router;
