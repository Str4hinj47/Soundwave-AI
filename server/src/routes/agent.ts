import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { optionalAuth } from "../middleware/auth.js";
import { resolveFfmpegPath } from "../lib/ffmpeg.js";
import { resolveYtDlpPath } from "../lib/ytdlp.js";
import { getStore } from "../lib/store.js";
import { config } from "../config.js";
import agentShortRouter, { VIRAL_SCRIPTS, generateScript, CURATED_MINECRAFT_PARKOUR } from "./agentShort.js";

const router = Router();

// Re-export / mount agentShort routes under /api/v1/agent
router.use("/", agentShortRouter);

// GET /status — check health, tool binaries, and cache state
router.get("/status", async (_req, res) => {
  const ffmpeg = resolveFfmpegPath();
  const ytdlp = resolveYtDlpPath();

  const cacheDirs = [
    path.join(process.cwd(), "background_cache", "minecraft_parkour", "80s"),
    path.join(process.cwd(), "..", "background_cache", "minecraft_parkour", "80s"),
    path.join(config.dataDir, "background_cache", "minecraft_parkour", "80s"),
  ];

  let cachedClipsCount = 0;
  let totalSizeBytes = 0;
  for (const dir of cacheDirs) {
    try {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mp4"));
        cachedClipsCount += files.length;
        for (const file of files) {
          totalSizeBytes += fs.statSync(path.join(dir, file)).size;
        }
      }
    } catch {}
  }

  res.json({
    status: "online",
    system: "Soundwave AI Autonomous Agent Engine",
    version: "2.0.0",
    ffmpegAvailable: Boolean(ffmpeg),
    ytdlpAvailable: Boolean(ytdlp),
    cachedBackgroundClips: cachedClipsCount,
    cachedBackgroundSizeMb: +(totalSizeBytes / (1024 * 1024)).toFixed(1),
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

// GET /jobs — recent agent automation jobs
router.get("/jobs", optionalAuth, async (req, res, next) => {
  try {
    const store = await getStore();
    const userId = req.user?.id ?? "agent-local";
    const jobs = await store.listJobs(userId);
    res.json({ jobs: jobs.slice(0, 20) });
  } catch (e) {
    next(e);
  }
});

export default router;
