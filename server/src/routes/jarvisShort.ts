import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";
import { getStore } from "../lib/store.js";
import { PLANS, dimensionsFor } from "../lib/plans.js";
import { synthesizeEdgeTTS } from "../lib/edgeTts.js";
import { runFfmpegExport, resolveFfmpegPath, type ExportSettings, type SubtitleCueInput, type SubtitleStyleInput } from "../lib/ffmpeg.js";
import { parseYouTubeUrl, fetchMetadata, downloadVideo, resolveYtDlpPath } from "../lib/ytdlp.js";
import { config } from "../config.js";

// ── Curated high-quality ONLY minecraft_parkour — no subway/roblox/gta/random
const CURATED_MINECRAFT_PARKOUR = [
  "https://www.youtube.com/watch?v=tiOl_mcAsF4", // 1 HOUR 2026 high quality
  "https://www.youtube.com/watch?v=BXUA2FncVPI", // 4K 2025 background for Shorts
  "https://www.youtube.com/watch?v=71YeZAUS9NQ", // 4K 60FPS FREE great for Shorts
  "https://www.youtube.com/watch?v=FOX3lBXVeck", // Free2Use drive link
  "https://www.youtube.com/watch?v=85z7jqGAGcc", // 2 Hours
  "https://www.youtube.com/watch?v=Geuaf2Nj_zE",
];

const BLACKLIST = ["dQw4w9WgXcQ", "NJ1VD4eCcD0"];

function isBlacklisted(url: string): boolean {
  return BLACKLIST.some((id) => url.includes(id));
}

// ── Script templates for Jarvis — VIRAL 2026 RESEARCH-BASED
// Based on 13.5M clips analysis: Expertise hooks 6.7k avg views, 80% viral use captions
const VIRAL_SCRIPTS: Record<string, string[]> = {
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
    "One AI prompt that gives you viral hooks: 'Write 10 hooks using curiosity gap for {topic}'. I tried it and got 3 million views from one.",
  ],
};

function generateScript(topic: string): string {
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
    // Default: rotate between high-retention niches — psychology, facts, history
    const rot = ["psychology", "facts", "history", "finance"];
    category = rot[Math.floor(Math.random() * rot.length)]!;
  }
  const templates = VIRAL_SCRIPTS[category] ?? VIRAL_SCRIPTS.psychology!;
  const idx = Math.floor(Math.random() * templates.length);
  const base = templates[idx]!;
  if (topic.length > 5 && topic.length < 60 && !["psychology", "facts", "history", "motivation", "horror", "finance", "ai"].includes(t)) {
    // If specific topic like 'dogs' — use hook + fact
    return `Did you know that ${topic}? ${base}`;
  }
  return base;
}

function cuesFromTimings(
  wordTimings: { word: string; start: number; end: number }[],
  duration: number,
): SubtitleCueInput[] {
  if (!wordTimings.length) {
    // Fallback: split duration into 3-word chunks
    return [];
  }
  const cues: SubtitleCueInput[] = [];
  const WORDS_PER_CUE = 4;
  const MAX_CUE_DURATION = 2.5;
  for (let i = 0; i < wordTimings.length; i += WORDS_PER_CUE) {
    const chunk = wordTimings.slice(i, i + WORDS_PER_CUE);
    if (!chunk.length) continue;
    const start = chunk[0]!.start;
    let end = chunk[chunk.length - 1]!.end;
    // Cap duration
    if (end - start > MAX_CUE_DURATION) end = start + MAX_CUE_DURATION;
    const text = chunk.map((w) => w.word).join(" ");
    if (text.trim()) cues.push({ start, end, text: text.trim() });
  }
  // Ensure last cue doesn't exceed duration
  if (cues.length && cues[cues.length - 1]!.end > duration) {
    cues[cues.length - 1]!.end = duration;
  }
  return cues;
}

// ── Download only first 80 seconds of a YouTube video via yt-dlp sections
async function downloadYouTubeSection(url: string, uuid: string, maxBytes: number, sectionSeconds = 80): Promise<{ fileKey: string; filePath: string; size: number; ext: string }> {
  const dir = config.uploadsDir;
  fs.mkdirSync(dir, { recursive: true });
  const template = path.join(dir, `${uuid}.%(ext)s`);

  const ytDlpPath = resolveYtDlpPath();
  const isZipapp = ytDlpPath.endsWith("yt-dlp") && process.platform === "win32";
  const command = isZipapp ? (process.env.PYTHON ?? "python") : ytDlpPath;
  const prefixArgs = isZipapp ? [ytDlpPath] : [];

  const ffmpegDir = path.dirname(resolveFfmpegPath());
  const args = [
    ...prefixArgs,
    "--no-playlist",
    "--no-warnings",
    "--ignore-config",
    "--restrict-filenames",
    "-f",
    "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080][ext=mp4]/bv*[height<=1080]+ba/b[height<=1080]/b",
    ...(ffmpegDir && ffmpegDir !== "." ? ["--ffmpeg-location", ffmpegDir] : []),
    "--download-sections",
    `*0-${sectionSeconds}`,
    "--force-keyframes-at-cuts",
    "-o",
    template,
    url,
  ];

  if (config.ytDlpCookies) {
    args.splice(1, 0, "--cookies", config.ytDlpCookies);
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`yt-dlp timed out after ${Math.round(config.ytDlpTimeoutMs / 1000)}s`));
    }, config.ytDlpTimeoutMs);
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-500) || `yt-dlp exited with ${code}`));
    });
  });

  const produced = fs.readdirSync(dir).filter((f) => f.startsWith(`${uuid}.`) && !f.endsWith(".part") && !f.endsWith(".ytdl"));
  const name = produced[0];
  if (!name) throw new Error("YouTube section download produced no file.");
  const filePath = path.join(dir, name);
  const size = fs.statSync(filePath).size;
  if (size > maxBytes) {
    try {
      fs.unlinkSync(filePath);
    } catch {}
    throw Object.assign(new Error(`Video is ${(size / 1024 / 1024).toFixed(0)}MB, exceeds limit.`), { status: 413 });
  }
  return { fileKey: name, filePath, size, ext: name.slice(uuid.length + 1) };
}

// ── Router ──────────────────────────────────────────────────────────────────
const router = Router();

// POST /api/v1/jarvis/generate-short
// One-click: topic → TTS (Jenny) + TikTok style #8B5CF6 + minecraft parkour 80s cache + export 9:16 720p 60fps
// Returns jobId + downloadUrl when done, or jobId immediately if ?async=true
const generateShortSchema = z.object({
  topic: z.string().min(2).max(500).default("motivation"),
  voice: z.string().min(2).max(100).default("en-US-JennyNeural"),
  youtubeUrl: z.string().max(2048).nullable().optional(),
  useDefaultBackground: z.boolean().default(true),
  backgroundFileKey: z.string().max(200).nullable().optional(),
  resolution: z.enum(["720p", "1080p"]).default("720p"),
  async: z.boolean().default(false),
});

router.post("/generate-short", optionalAuth, validate({ body: generateShortSchema }), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof generateShortSchema>;
    const store = await getStore();

    // Allow unauthenticated for Jarvis local usage if optionalAuth didn't set user
    // but we still need a userId for job tracking — use a system user or req.user
    const userId = req.user?.id ?? "jarvis-local";
    const userPlan = req.user?.plan ?? "PRO";
    const planDef = PLANS[userPlan as keyof typeof PLANS] ?? PLANS.PRO;

    // 1. Generate script
    const script = generateScript(body.topic);

    // 2. TTS via Edge TTS — Jenny default
    const ttsResult = await synthesizeEdgeTTS({ text: script, voice: body.voice || "en-US-JennyNeural" });
    const audioBuf = Buffer.from(ttsResult.audioBase64, "base64");
    const audioFileKey = `${crypto.randomUUID()}.audio`;
    const audioPath = path.join(config.uploadsDir, audioFileKey);
    fs.mkdirSync(config.uploadsDir, { recursive: true });
    fs.writeFileSync(audioPath, audioBuf);

    // 3. Subtitle cues from word timings
    const cues = cuesFromTimings(ttsResult.wordTimings, ttsResult.duration);
    // Fallback if no word timings — split by sentence
    const finalCues: SubtitleCueInput[] =
      cues.length > 0
        ? cues
        : (() => {
            const words = script.split(/\s+/);
            const perCue = 4;
            const chunkDur = ttsResult.duration / Math.max(1, Math.ceil(words.length / perCue));
            const out: SubtitleCueInput[] = [];
            for (let i = 0; i < words.length; i += perCue) {
              const slice = words.slice(i, i + perCue);
              const idx = i / perCue;
              out.push({ start: idx * chunkDur, end: Math.min((idx + 1) * chunkDur, ttsResult.duration), text: slice.join(" ") });
            }
            return out;
          })();

    // 4. Background video — cache-first 80s, ONLY minecraft_parkour
    let videoFileKey: string | null = body.backgroundFileKey ?? null;
    let videoPath: string | null = null;

    if (!videoFileKey) {
      if (body.youtubeUrl && !isBlacklisted(body.youtubeUrl)) {
        const parsed = parseYouTubeUrl(body.youtubeUrl);
        if (parsed) {
          try {
            const uuid = crypto.randomUUID();
            const dl = await downloadYouTubeSection(parsed.toString(), uuid, planDef.maxVideoMb * 1024 * 1024, 80);
            videoFileKey = dl.fileKey;
            videoPath = dl.filePath;
          } catch (e) {
            console.warn("[jarvisShort] youtubeUrl download failed, falling back to curated:", (e as Error).message);
          }
        }
      }
      if (!videoFileKey && body.useDefaultBackground) {
        // Try curated list — first high quality that works, 80s sections only
        for (const curatedUrl of CURATED_MINECRAFT_PARKOUR) {
          if (isBlacklisted(curatedUrl)) continue;
          try {
            const uuid = crypto.randomUUID();
            const dl = await downloadYouTubeSection(curatedUrl, uuid, planDef.maxVideoMb * 1024 * 1024, 80);
            videoFileKey = dl.fileKey;
            videoPath = dl.filePath;
            break;
          } catch (e) {
            console.warn(`[jarvisShort] curated ${curatedUrl} failed:`, (e as Error).message);
            continue;
          }
        }
      }
    } else {
      // Existing fileKey provided
      const p = path.join(config.uploadsDir, videoFileKey);
      if (fs.existsSync(p)) videoPath = p;
    }

    // If still no video, we'll use solid color background
    if (!videoPath && videoFileKey) {
      const p = path.join(config.uploadsDir, videoFileKey);
      if (fs.existsSync(p)) videoPath = p;
    }

    // 5. Export settings — OPTIMIZED FOR JARVIS: 9:16 720p MP4 Medium 60fps End-with-voice ON
    const dims = dimensionsFor(body.resolution as "720p" | "1080p", "9:16");
    const settings: ExportSettings = {
      resolution: dims,
      format: "mp4",
      quality: "medium",
      fps: 60,
      watermark: planDef.watermark,
      audioVolume: 1,
      fadeIn: 0,
      fadeOut: 0,
      duration: ttsResult.duration,
    };

    const subtitleStyle: SubtitleStyleInput = {
      fontFamily: "Montserrat",
      fontSize: 56,
      fontWeight: 800,
      letterSpacing: 0,
      lineHeight: 1.2,
      color: "#FFFFFF",
      textOpacity: 100,
      bgColor: "#8B5CF6",
      bgOpacity: 90,
      bgPadding: 14,
      bgRadius: 10,
      strokeEnabled: false,
      strokeColor: "#000000",
      strokeWidth: 0,
      shadowEnabled: true,
      shadowColor: "#000000",
      shadowBlur: 10,
      shadowX: 0,
      shadowY: 2,
      hAlign: "center",
      vAlign: "middle",
      customX: null,
      customY: null,
      margin: 40,
      animIn: "scale",
      animOut: "fade",
      animDuration: 250,
    };

    // If no video path, generate solid color background of exact audio duration
    let finalVideoPath: string;
    let tempBgToClean: string | null = null;
    if (videoPath) {
      finalVideoPath = videoPath;
    } else {
      // Generate solid color video matching duration
      const dir = path.join(config.uploadsDir, "jobs");
      fs.mkdirSync(dir, { recursive: true });
      finalVideoPath = path.join(dir, `${userId}-bg-${Date.now()}.mp4`);
      tempBgToClean = finalVideoPath;
      await new Promise<void>((resolve, reject) => {
        const child = spawn(resolveFfmpegPath(), [
          "-y",
          "-f",
          "lavfi",
          "-i",
          `color=c=0x0A0F1C:s=${dims.width}x${dims.height}:d=${Math.ceil(ttsResult.duration) + 1}:r=30`,
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-pix_fmt",
          "yuv420p",
          "-t",
          String(Math.ceil(ttsResult.duration) + 1),
          finalVideoPath,
        ]);
        child.on("error", reject);
        child.on("close", (code) => (code === 0 ? resolve() : reject(new Error("Background generation failed"))));
      });
    }

    // Create job
    const job = await store.createJob({
      projectId: null,
      userId,
      status: "QUEUED",
      progress: 0,
      settings: { ...settings, subtitleCount: finalCues.length, topic: body.topic },
      outputUrl: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
    });

    const process = async () => {
      const outputDir = path.join(config.uploadsDir, "jobs");
      fs.mkdirSync(outputDir, { recursive: true });
      const outputPath = path.join(outputDir, `${job.id}.mp4`);
      await store.updateJob(job.id, { status: "PROCESSING", startedAt: new Date().toISOString(), progress: 5 });
      try {
        await runFfmpegExport({
          videoPath: finalVideoPath,
          audioPath,
          subtitles: finalCues,
          subtitleStyle,
          settings,
          outputPath,
          onProgress: (pct) => {
            void store.updateJob(job.id, { progress: Math.round(pct) });
          },
        });
        const outputUrl = `/api/v1/export/jobs/${job.id}/download`;
        await store.updateJob(job.id, { status: "COMPLETED", progress: 100, outputUrl, completedAt: new Date().toISOString() });
      } catch (e) {
        const msg = (e as Error).message.slice(0, 400);
        await store.updateJob(job.id, { status: "FAILED", errorMessage: msg, completedAt: new Date().toISOString() });
        throw e;
      } finally {
        try {
          if (tempBgToClean) fs.unlinkSync(tempBgToClean);
        } catch {}
        try {
          fs.unlinkSync(audioPath);
        } catch {}
        // Keep videoPath if it's a cached 80s clip? For now keep it for reuse.
      }
    };

    if (body.async) {
      void process();
      res.status(202).json({
        jobId: job.id,
        status: "QUEUED",
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

    // Synchronous — wait for completion (up to 5 min)
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
          background: videoFileKey ? "minecraft_parkour 80s cached" : "solid #0A0F1C",
        },
      });
    } catch (e) {
      const msg = (e as Error).message;
      res.status(500).json({ jobId: job.id, status: "FAILED", error: msg });
    }
  } catch (e) {
    const err = e as Error;
    console.error("[jarvisShort] failed:", err.message);
    // next(e) would go to error handler; for Jarvis we return JSON
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/jarvis/defaults — returns optimized defaults for Jarvis to use without UI
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
      oneClickEndpoint: "POST /api/v1/jarvis/generate-short",
      body: { topic: "your topic", voice: "en-US-JennyNeural", useDefaultBackground: true, resolution: "720p" },
      result: "downloadUrl -> ~/Downloads/soundwave_short_*.mp4",
    },
  });
});

export default router;
