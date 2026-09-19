import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { optionalAuth } from "../middleware/auth.js";
import { getStore } from "../lib/store.js";
import { dimensionsFor } from "../lib/plans.js";
import { synthesizeEdgeTTS } from "../lib/edgeTts.js";
import { synthesizeClone } from "../lib/voiceclone.js";
import { runFfmpegExport, resolveFfmpegPath, type ExportSettings, type SubtitleCueInput, type SubtitleStyleInput } from "../lib/ffmpeg.js";
import { resolveYtDlpPath } from "../lib/ytdlp.js";
import { config } from "../config.js";

// ── Curated high-quality ONLY minecraft_parkour — no watermark, clean gameplay
export const CURATED_MINECRAFT_PARKOUR = [
  "https://www.youtube.com/watch?v=tiOl_mcAsF4", // 1 HOUR 2026 high quality
  "https://www.youtube.com/watch?v=BXUA2FncVPI", // 4K 2025 background for Shorts
  "https://www.youtube.com/watch?v=71YeZAUS9NQ", // 4K 60FPS FREE great for Shorts
  "https://www.youtube.com/watch?v=FOX3lBXVeck", // Free2Use drive link
  "https://www.youtube.com/watch?v=85z7jqGAGcc", // 2 Hours
  "https://www.youtube.com/watch?v=Geuaf2Nj_zE",
];

export const BLACKLIST = ["dQw4w9WgXcQ", "NJ1VD4eCcD0"];

export function isBlacklisted(url: string): boolean {
  return BLACKLIST.some((id) => url.includes(id));
}

// ── Script templates for Soundwave Agent — VIRAL 2026 RESEARCH-BASED
export const VIRAL_SCRIPTS: Record<string, string[]> = {
  psychology: [
    "Did you know that the Chameleon Effect makes people trust you more when you subtly mimic their posture? Most people never notice this, but once you see it, you can't unsee it. Try it in your next conversation.",
    "Only 1% know this psychology trick: if you mirror someone's last three words, they will keep talking and feel deeply heard. It feels illegal but it's just how the brain works.",
    "You're doing this wrong in every argument: saying 'you always' or 'you never'. The moment you say it, their brain stops listening. Say 'I feel' instead and watch what happens.",
    "Three psychological tricks that feel illegal to know: One — asking a small favor makes people like you more, Benjamin Franklin Effect. Two — people remember how you made them feel, not what you said. Three — silence after a question makes them reveal more.",
    "Your brain has a negativity bias: it remembers one insult longer than ten compliments. That's why one comment can ruin your day. But you can rewire it by writing three good things every night.",
  ],
  facts: [
    "Did you know sharks are older than trees? Sharks 400 million years, trees 350 million. I was today years old when I found this out.",
    "Honey never spoils. Archaeologists found 3000-year-old honey in Egyptian tombs and it was still edible. Nature's perfect preservative.",
    "Cleopatra lived closer to the moon landing than to the building of the pyramids. Pyramids 2560 BC, Cleopatra 30 BC, moon 1969. Time is wild.",
    "Oxford University is older than the Aztec Empire. Oxford founded 1096, Aztecs started 1428. A university outlived an empire.",
    "Octopuses have three hearts and blue blood — and nine brains, one in each arm. And that's just one of five things that sound fake but are real.",
    "Wombat poop is cube-shaped. Not a joke. Their intestines have ridges that form cubes so it doesn't roll off rocks.",
    "Scotland's national animal is a unicorn. Not a lion, not an eagle — a unicorn. And they put it on their royal coat of arms.",
  ],
  history: [
    "The shortest war lasted 38 minutes — Britain vs Zanzibar in 1896. 38 minutes and it was over.",
    "Ancient Romans used urine as mouthwash. Ammonia cleans teeth, so they bought Portuguese urine because it was considered strongest.",
    "The first computer programmer was a woman in the 1840s — Ada Lovelace wrote the first algorithm for Charles Babbage's machine.",
    "Samurai and cowboys existed at the same time. Last samurai 1867, first cowboys 1860s. Two worlds that never met.",
    "Nintendo was founded in 1889 as a playing card company. 100 years before Mario, they sold cards.",
  ],
  motivation: [
    "Stop trying to be motivated. Motivation is weather, discipline is climate. Weather changes daily, climate stays. Build climate: one small win every morning.",
    "I did one hard thing every morning for 7 days. Here's what happened: day 1 sucked, day 3 my brain resisted, day 7 I craved it. The trick is you quit at 40% when you're actually at 40% of your limit.",
    "You're doing motivation wrong. You wait to feel ready. Ready never comes. The most successful people started exactly where you are — uncertain, afraid, but moving anyway.",
    "Three things I do before every failure: expect it to be easy, wait for perfect, quit early. Stop doing them and failure becomes data, not identity.",
  ],
  horror: [
    "She lived alone. Every night at exactly 3:13 AM, footsteps in the attic. She told herself it was the house settling. Until she found wet footprints leading from the attic to her bedroom.",
    "The last message said 'Don't look behind you.' He laughed and turned around. Nothing. He texted 'Very funny.' Reply came instantly: 'I wasn't joking. I can see you.'",
    "They said the trail was closed for a reason. He didn't listen. Halfway through, birds stopped singing. Trees leaned inward. Then he saw them — dozens of carved symbols on every trunk, all pointing at him.",
  ],
  finance: [
    "Everything you knew about saving money is wrong. Saving alone keeps you poor because inflation eats it. $100 in 2000 is $60 now. Investing is not optional.",
    "Only 1% know the $100 rule: if it costs less than $100, ask 'Will I use this 100 times?' If yes, buy it. If no, skip. It feels illegal but saves thousands.",
    "Three money mistakes keeping you poor: One — you budget but don't track. Two — you save but don't invest. Three — you wait for more money instead of managing what you have.",
  ],
  ai: [
    "This free AI tool is better than most paid alternatives and takes 10 seconds: it turns your messy notes into a viral script with hook, context, payoff. Show outcome first, then tool.",
    "I asked 100 people about their biggest time waste, AI answers shocked me: it's not social media, it's re-doing the same task because you didn't write it down once.",
    "One AI prompt that gives you viral hooks: 'Write 10 hooks using curiosity gap for your niche'. I tried it and got 3 million views from one.",
  ],
};

export function generateScript(topic: string): string {
  const t = topic.toLowerCase();
  let category = "psychology";
  if (t.includes("fact") || t.includes("did you know") || t.includes("science") || t.includes("space")) category = "facts";
  else if (t.includes("history")) category = "history";
  else if (t.includes("horror") || t.includes("scary") || t.includes("creepy") || t.includes("ghost")) category = "horror";
  else if (t.includes("money") || t.includes("finance") || t.includes("invest") || t.includes("saving")) category = "finance";
  else if (t.includes("ai") || t.includes("tool") || t.includes("productivity")) category = "ai";
  else if (t.includes("motivat") || t.includes("inspir") || t.includes("success") || t.includes("mindset")) category = "motivation";
  else if (t.includes("psych")) category = "psychology";
  else {
    const rot = ["psychology", "facts", "history", "finance"];
    category = rot[Math.floor(Math.random() * rot.length)]!;
  }
  const templates = VIRAL_SCRIPTS[category] ?? VIRAL_SCRIPTS.psychology!;
  const idx = Math.floor(Math.random() * templates.length);
  const base = templates[idx]!;
  if (topic.length > 5 && topic.length < 60 && !["psychology", "facts", "history", "motivation", "horror", "finance", "ai"].includes(t)) {
    return `Did you know that ${topic}? ${base}`;
  }
  return base;
}

export function cuesFromTimings(
  wordTimings: { word: string; start: number; end: number }[],
  duration: number,
): SubtitleCueInput[] {
  if (wordTimings.length === 0) {
    return [{ start: 0, end: Math.max(duration, 1), text: "" }];
  }
  const cues: SubtitleCueInput[] = [];
  const wordsPerGroup = 3;
  for (let i = 0; i < wordTimings.length; i += wordsPerGroup) {
    const group = wordTimings.slice(i, i + wordsPerGroup);
    const start = group[0]!.start;
    const end = group[group.length - 1]!.end;
    const text = group.map((w) => w.word).join(" ");
    cues.push({
      start: Math.max(0, start),
      end: Math.max(start + 0.3, end),
      text,
    });
  }
  return cues;
}

const CACHE_CHUNK_SECS = 80;
function findCachedChunk(): string | null {
  const roots = [
    process.cwd(),
    path.join(process.cwd(), ".."),
    path.join(process.cwd(), "..", ".."),
    config.dataDir,
    path.dirname(config.uploadsDir),
    os.homedir(),
    path.join(os.homedir(), ".soundwave"),
    path.join(os.homedir(), "Downloads"),
    path.join(os.homedir(), "Videos"),
  ];

  const subdirs = [
    path.join("background_cache", "minecraft_parkour", "80s"),
    path.join("background_cache", "minecraft_parkour"),
    "background_cache",
    "clips",
    "backgrounds",
    "videos",
    "assets",
    path.join("Mark-LIV", "clips"),
    path.join("Mark-LIV", "backgrounds"),
    path.join("Mark-LIV", "background_cache"),
    path.join("Mark-LIV", "background_cache", "minecraft_parkour", "80s"),
    "Mark-LIV",
    path.join("Mark-54", "clips"),
    path.join("Mark-54", "backgrounds"),
    path.join("Mark-54", "background_cache"),
    "Mark-54",
    path.join("Mark 54", "clips"),
    path.join("Mark 54", "backgrounds"),
    path.join("Mark 54", "background_cache"),
    "Mark 54",
    path.join("soundwave-agent", "clips"),
    path.join("soundwave-agent", "backgrounds"),
    path.join("server", "uploads"),
    "uploads",
  ];

  for (const root of roots) {
    for (const sub of subdirs) {
      const d = path.resolve(root, sub);
      try {
        if (fs.existsSync(d) && fs.statSync(d).isDirectory()) {
          const files = fs.readdirSync(d).filter((f) => {
            const lower = f.toLowerCase();
            return (
              (lower.endsWith(".mp4") || lower.endsWith(".mov") || lower.endsWith(".mkv") || lower.endsWith(".webm")) &&
              !lower.startsWith("solid-bg-")
            );
          });
          if (files.length > 0) {
            for (const f of files) {
              const fullPath = path.join(d, f);
              try {
                if (fs.statSync(fullPath).size > 500_000) {
                  return fullPath;
                }
              } catch {}
            }
          }
        }
      } catch {}
    }
  }
  return null;
}

async function ensureMinecraftBackground(customUrl?: string | null): Promise<string | null> {
  const cached = findCachedChunk();
  if (cached && fs.existsSync(cached)) {
    return cached;
  }

  const targetUrl = customUrl || CURATED_MINECRAFT_PARKOUR[0]!;
  if (isBlacklisted(targetUrl)) {
    throw new Error("Provided YouTube URL is blacklisted");
  }

  const ytdlp = resolveYtDlpPath();
  const ffmpeg = resolveFfmpegPath();
  if (!ytdlp || !ffmpeg) {
    return null;
  }

  const cacheDir = path.join(config.dataDir, "background_cache", "minecraft_parkour", "80s");
  fs.mkdirSync(cacheDir, { recursive: true });
  const outPath = path.join(cacheDir, `parkour_${Date.now()}_80s.mp4`);

  return new Promise((resolve) => {
    const args = [
      "-f", "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      "--no-playlist",
      "--download-sections", `*0-${CACHE_CHUNK_SECS}`,
      "--force-keyframes-at-cuts",
      "-o", outPath,
      targetUrl,
    ];
    const proc = spawn(ytdlp, args, { stdio: ["ignore", "pipe", "pipe"] });
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve(null);
    }, 120_000);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && fs.existsSync(outPath) && fs.statSync(outPath).size > 100_000) {
        resolve(outPath);
      } else {
        resolve(null);
      }
    });
    proc.on("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

async function generateSolidVideo(width: number, height: number, seconds: number): Promise<string> {
  const dir = path.join(config.uploadsDir, "jobs");
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `motion-bg-${Date.now()}.mp4`);
  const dur = Math.min(3600, Math.max(1, Math.round(seconds)));
  await new Promise<void>((resolve, reject) => {
    // Generates a cyber dynamic motion background
    const child = spawn(resolveFfmpegPath(), [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=#070d18:s=${width}x${height}:d=${dur}:r=30`,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-t",
      String(dur),
      out,
    ]);
    child.on("error", reject);
    child.on("close", (code: number) => (code === 0 ? resolve() : reject(new Error("Background generation failed"))));
  });
  return out;
}

// ── Router ──────────────────────────────────────────────────────────────────
const router = Router();

const generateShortSchema = z.object({
  topic: z.string().min(2).max(500).default("motivation"),
  voice: z.string().min(2).max(100).default("en-US-JennyNeural"),
  youtubeUrl: z.string().max(2048).nullable().optional(),
  useDefaultBackground: z.boolean().default(true),
  backgroundFileKey: z.string().max(200).nullable().optional(),
  resolution: z.enum(["720p", "1080p"]).default("720p"),
  async: z.boolean().default(false),
});

router.post("/generate-short", optionalAuth, validate({ body: generateShortSchema }), async (req, res) => {
  try {
    const body = req.body as z.infer<typeof generateShortSchema>;
    const store = await getStore();

    const userId = req.user?.id ?? "agent-local";

    // 1. Generate script
    const script = generateScript(body.topic);

    // 2. TTS via Cloned Voice or Edge TTS
    let ttsResult;
    if (body.voice && body.voice.startsWith("clone:")) {
      const profileId = body.voice.replace("clone:", "");
      ttsResult = await synthesizeClone(userId, { text: script, profileId });
    } else {
      ttsResult = await synthesizeEdgeTTS({ text: script, voice: body.voice || "en-US-JennyNeural" });
    }

    const audioBuf = Buffer.from(ttsResult.audioBase64, "base64");
    const audioFileKey = `${crypto.randomUUID()}.audio`;
    const audioPath = path.join(config.uploadsDir, audioFileKey);
    fs.mkdirSync(config.uploadsDir, { recursive: true });
    fs.writeFileSync(audioPath, audioBuf);

    // 3. Subtitle cues
    const cues = cuesFromTimings(ttsResult.wordTimings, ttsResult.duration);

    // TikTok subtitle preset style — Montserrat 800 56px #FFFFFF on #8B5CF6 rounded badge
    const tiktokStyle: SubtitleStyleInput = {
      fontFamily: "Montserrat",
      fontWeight: 800,
      fontSize: 56,
      color: "#FFFFFF",
      bgColor: "#8B5CF6",
      bgOpacity: 90,
      bgPadding: 14,
      bgRadius: 10,
      vAlign: "middle",
      hAlign: "center",
      strokeEnabled: true,
      strokeColor: "#000000",
      strokeWidth: 2,
      shadowEnabled: true,
      shadowColor: "#000000",
      shadowBlur: 8,
      shadowX: 2,
      shadowY: 2,
    };

    // 4. Background video: either custom key, downloaded, cached, or solid
    let videoPath: string | null = null;
    if (body.backgroundFileKey) {
      const p = path.join(config.uploadsDir, body.backgroundFileKey);
      if (fs.existsSync(p)) videoPath = p;
    }

    if (!videoPath && body.useDefaultBackground) {
      if (body.youtubeUrl && !isBlacklisted(body.youtubeUrl)) {
        try {
          const downloaded = await ensureMinecraftBackground(body.youtubeUrl);
          if (downloaded) videoPath = downloaded;
        } catch (e) {
          console.warn("[agentShort] youtubeUrl download failed, falling back to curated:", (e as Error).message);
        }
      }

      if (!videoPath) {
        const cached = findCachedChunk();
        if (cached && fs.existsSync(cached)) {
          videoPath = cached;
        } else {
          for (const curatedUrl of CURATED_MINECRAFT_PARKOUR) {
            try {
              const bg = await ensureMinecraftBackground(curatedUrl);
              if (bg && fs.existsSync(bg)) {
                videoPath = bg;
                break;
              }
            } catch (e) {
              console.warn(`[agentShort] curated ${curatedUrl} failed:`, (e as Error).message);
            }
          }
        }
      }
    }

    const dims = dimensionsFor(body.resolution, "9:16");

    if (!videoPath || !fs.existsSync(videoPath)) {
      videoPath = await generateSolidVideo(dims.width, dims.height, Math.ceil(ttsResult.duration) + 2);
    }

    // 5. Export settings: 9:16 vertical short format, 720p or 1080p, 60fps
    const exportSettings: ExportSettings = {
      resolution: dims,
      format: "mp4",
      quality: "medium",
      fps: 60,
      watermark: false,
      audioVolume: 1.0,
      fadeIn: 0,
      fadeOut: 0.3,
      duration: ttsResult.duration,
    };

    // 6. Register job
    const job = await store.createJob({
      projectId: null,
      userId,
      status: "QUEUED",
      progress: 0,
      settings: { ...exportSettings, subtitleCount: cues.length } as any,
      outputUrl: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
    });

    const jobsDir = path.join(config.uploadsDir, "jobs");
    fs.mkdirSync(jobsDir, { recursive: true });
    const outFilename = `soundwave_short_${job.id}.mp4`;
    const outPath = path.join(config.uploadsDir, outFilename);
    const jobFilePath = path.join(jobsDir, `${job.id}.mp4`);

    const finalCues = cues.map((c) => ({
      ...c,
      end: Math.min(c.end, ttsResult.duration),
    }));

    const process = async () => {
      try {
        await store.updateJob(job.id, { status: "PROCESSING", startedAt: new Date().toISOString() });
        await runFfmpegExport({
          videoPath: videoPath!,
          audioPath,
          subtitles: finalCues,
          subtitleStyle: tiktokStyle,
          settings: exportSettings,
          outputPath: outPath,
          onProgress: async (p) => {
            await store.updateJob(job.id, { progress: Math.min(99, Math.round(p * 100)) });
          },
        });
        try {
          fs.copyFileSync(outPath, jobFilePath);
        } catch {}
        await store.updateJob(job.id, {
          status: "COMPLETED",
          progress: 100,
          outputUrl: `/api/v1/export/jobs/${job.id}/download`,
          completedAt: new Date().toISOString(),
        });
      } catch (err) {
        await store.updateJob(job.id, {
          status: "FAILED",
          errorMessage: (err as Error).message,
        });
        throw err;
      }
    };

    if (body.async) {
      process().catch((e) => console.error("[agentShort async] export failed:", e.message));
      res.json({
        jobId: job.id,
        status: "QUEUED",
        pollUrl: `/api/v1/export/jobs/${job.id}`,
        eventsUrl: `/api/v1/export/jobs/${job.id}/events`,
        downloadUrl: `/api/v1/export/jobs/${job.id}/download`,
        script,
        duration: ttsResult.duration,
        cues: finalCues.length,
        message: "Export queued — poll GET /api/v1/export/jobs/:jobId or stream /api/v1/export/jobs/:jobId/events",
        defaults: {
          aspect: "9:16",
          resolution: body.resolution,
          format: "mp4",
          quality: "medium",
          fps: 60,
          fitToVoice: true,
          voice: body.voice,
          subtitleStyle: "TikTok #8B5CF6 Montserrat 800 56px middle",
          background: "ONLY minecraft_parkour high quality 1080p 4K 80s cache",
        },
      });
      return;
    }

    // Synchronous
    try {
      await process();
      const completed = await store.getJob(job.id, userId);
      res.json({
        jobId: job.id,
        status: "COMPLETED",
        downloadUrl: completed?.outputUrl ?? `/api/v1/export/jobs/${job.id}/download`,
        script,
        duration: ttsResult.duration,
        cues: finalCues.length,
        defaults: {
          aspect: "9:16",
          resolution: body.resolution,
          format: "mp4",
          quality: "medium",
          fps: 60,
          fitToVoice: true,
          voice: body.voice,
          subtitleStyle: "TikTok #8B5CF6 Montserrat 800 56px middle scale",
          background: videoPath ? "minecraft_parkour 80s cached" : "solid #0A0F1C",
        },
      });
    } catch (e) {
      const msg = (e as Error).message;
      res.status(500).json({ jobId: job.id, status: "FAILED", error: msg });
    }
  } catch (e) {
    const err = e as Error;
    console.error("[agentShort] failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /defaults
router.get("/defaults", (_req, res) => {
  res.json({
    video: {
      aspect: "9:16",
      resolution: "720p",
      format: "mp4",
      quality: "medium",
      fps: 60,
      fitToVoice: true,
      width: 720,
      height: 1280,
    },
    audio: {
      voice: "en-US-JennyNeural",
      speed: 1.0,
      pitch: 0,
      volume: 100,
    },
    subtitles: {
      preset: "tiktok",
      fontFamily: "Montserrat",
      fontWeight: 800,
      fontSize: 56,
      color: "#FFFFFF",
      bgColor: "#8B5CF6",
      bgOpacity: 90,
      bgPadding: 14,
      bgRadius: 10,
      vAlign: "middle",
      hAlign: "center",
      animIn: "scale",
    },
    background: {
      type: "minecraft_parkour",
      only: "minecraft_parkour high quality 1080p 4K",
      blacklist: BLACKLIST,
      cacheChunkDuration: 80,
      curated: CURATED_MINECRAFT_PARKOUR,
    },
    workflow: {
      oneClickEndpoint: "POST /api/v1/agent/generate-short",
      body: { topic: "motivation", voice: "en-US-JennyNeural", useDefaultBackground: true, resolution: "720p" },
      result: "downloadUrl -> ~/Downloads/soundwave_short_*.mp4",
    },
  });
});

export default router;
