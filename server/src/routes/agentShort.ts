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
import { config } from "../config.js";
import {
  acquireClip,
  releaseClip,
  seedSource,
  getBackgroundStatus,
  resetLibrary,
  isBlacklisted,
  CLIP_SECS,
  CURATED_MINECRAFT_PARKOUR,
  BLACKLIST,
} from "../lib/backgroundClips.js";

// Background sourcing lives in lib/backgroundClips.ts (the 60s clip library).
// Re-exported here because agent.ts and the /defaults endpoint read them.
export { CURATED_MINECRAFT_PARKOUR, BLACKLIST, isBlacklisted };

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
  /** Optional verbatim voiceover script. When present it wins over `topic`.
   *  Empty/whitespace is treated as "not supplied" and falls back to `topic`. */
  script: z.string().max(8000).nullable().optional(),
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

    // 1. Script — a caller-supplied script is used verbatim; otherwise the
    //    niche-matched viral template for `topic` is generated here.
    const customScript = typeof body.script === "string" ? body.script.trim() : "";
    const script = customScript.length > 0 ? customScript : generateScript(body.topic);
    const scriptSource = customScript.length > 0 ? "custom" : "generated";

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

    // 4. Background video — one 60s parkour clip from the managed library.
    //    Order: explicit upload → clip library → solid colour fallback.
    let videoPath: string | null = null;
    let clipToRelease: string | null = null;
    let backgroundLabel = "solid #070d18";

    if (body.backgroundFileKey) {
      const p = path.join(config.uploadsDir, body.backgroundFileKey);
      if (fs.existsSync(p)) {
        videoPath = p;
        backgroundLabel = "uploaded file";
      }
    }

    // An explicit youtubeUrl seeds the library with that specific video.
    if (!videoPath && body.useDefaultBackground && body.youtubeUrl && !isBlacklisted(body.youtubeUrl)) {
      try {
        const seeded = await seedSource(body.youtubeUrl);
        if (seeded) console.log(`[agentShort] library seeded from ${body.youtubeUrl}`);
      } catch (e) {
        console.warn("[agentShort] youtubeUrl seed failed, using library:", (e as Error).message);
      }
    }

    if (!videoPath && body.useDefaultBackground) {
      try {
        // Pulls the next unused clip; downloads+slices a new long video when
        // the library is empty, and remembers which videos were already used.
        const clip = await acquireClip();
        if (clip && fs.existsSync(clip.path)) {
          videoPath = clip.path;
          clipToRelease = clip.path;
          backgroundLabel = `minecraft_parkour ${CLIP_SECS}s clip (${clip.clipsRemaining} left)`;
          console.log(
            `[agentShort] background clip ${clip.name} ${clip.freshSource ? "from NEW source " + clip.sourceUrl : "from library"} — ${clip.clipsRemaining} remaining`,
          );
        }
      } catch (e) {
        console.warn("[agentShort] clip library unavailable:", (e as Error).message);
      }
    }

    const dims = dimensionsFor(body.resolution, "9:16");

    if (!videoPath || !fs.existsSync(videoPath)) {
      videoPath = await generateSolidVideo(dims.width, dims.height, Math.ceil(ttsResult.duration) + 2);
      backgroundLabel = "solid #070d18";
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

    // Named `runExport` — it must NOT shadow Node's global `process`.
    const runExport = async () => {
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
        // Clip served its purpose — delete it so the next short gets a new one.
        if (clipToRelease) {
          releaseClip(clipToRelease);
          console.log(`[agentShort] used clip deleted: ${path.basename(clipToRelease)}`);
        }
      } catch (err) {
        await store.updateJob(job.id, {
          status: "FAILED",
          errorMessage: (err as Error).message,
        });
        throw err;
      }
    };

    if (body.async) {
      runExport().catch((e) => console.error("[agentShort async] export failed:", e.message));
      res.json({
        jobId: job.id,
        status: "QUEUED",
        pollUrl: `/api/v1/export/jobs/${job.id}`,
        eventsUrl: `/api/v1/export/jobs/${job.id}/events`,
        downloadUrl: `/api/v1/export/jobs/${job.id}/download`,
        script,
        scriptSource,
        duration: ttsResult.duration,
        durationSeconds: Math.round(ttsResult.duration * 10) / 10,
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
          background: backgroundLabel,
        },
      });
      return;
    }

    // Synchronous
    try {
      await runExport();
      const completed = await store.getJob(job.id, userId);
      res.json({
        jobId: job.id,
        status: "COMPLETED",
        downloadUrl: completed?.outputUrl ?? `/api/v1/export/jobs/${job.id}/download`,
        videoUrl: completed?.outputUrl ?? `/api/v1/export/jobs/${job.id}/download`,
        script,
        scriptSource,
        duration: ttsResult.duration,
        durationSeconds: Math.round(ttsResult.duration * 10) / 10,
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
          background: backgroundLabel,
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
      clipDuration: CLIP_SECS,
      curated: CURATED_MINECRAFT_PARKOUR,
      lifecycle:
        "One long parkour video is downloaded, sliced into 60s clips, and each short consumes one clip which is then deleted. When the library is empty a NEW video is found online; already-clipped URLs are remembered and never reused.",
    },
    script: {
      source: "custom script (body.script) when supplied, else generated from body.topic",
      niches: Object.keys(VIRAL_SCRIPTS),
    },
    workflow: {
      oneClickEndpoint: "POST /api/v1/agent/generate-short",
      body: { topic: "motivation", voice: "en-US-JennyNeural", useDefaultBackground: true, resolution: "720p" },
      backgroundStatusEndpoint: "GET /api/v1/agent/background/status",
      backgroundResetEndpoint: "POST /api/v1/agent/background/reset",
      result: "downloadUrl -> ~/Downloads/soundwave_short_*.mp4",
    },
  });
});

// GET /background/status — which long video is clipped, how many 60s clips are
// left, and which source URLs have already been consumed.
router.get("/background/status", optionalAuth, (_req, res) => {
  try {
    res.json(getBackgroundStatus());
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /background/reset — wipe the library so the next short finds a new video.
router.post("/background/reset", optionalAuth, (_req, res) => {
  try {
    resetLibrary();
    res.json({ ok: true, message: "Background clip library cleared — next short will download a new source." });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
