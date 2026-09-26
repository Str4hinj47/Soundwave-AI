import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import multer from "multer";
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
import { backgroundPool, backgroundCacheRoot } from "../lib/backgroundPool.js";
import { isReadableMediaFile } from "../lib/mediaFile.js";
import { youtubeService } from "../lib/youtube.js";
import { emitJob } from "./export.js";

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
  const t = topic.toLowerCase().trim();
  let category = "motivation";
  if (t.includes("fact") || t.includes("science") || t.includes("space")) category = "facts";
  else if (t.includes("history") || t.includes("ancient") || t.includes("war")) category = "history";
  else if (t.includes("horror") || t.includes("scary") || t.includes("creepy") || t.includes("ghost") || t.includes("dark")) category = "horror";
  else if (t.includes("money") || t.includes("finance") || t.includes("invest") || t.includes("saving") || t.includes("wealth")) category = "finance";
  else if (t.includes("ai") || t.includes("tool") || t.includes("tech") || t.includes("productivity")) category = "ai";
  else if (t.includes("motivat") || t.includes("inspir") || t.includes("success") || t.includes("mindset") || t.includes("discipline")) category = "motivation";
  else if (t.includes("psych") || t.includes("brain") || t.includes("behavior")) category = "psychology";
  else {
    const rot = ["motivation", "psychology", "facts", "history", "finance", "ai", "horror"];
    category = rot[Math.floor(Math.random() * rot.length)]!;
  }
  const templates = VIRAL_SCRIPTS[category] ?? VIRAL_SCRIPTS.motivation!;
  const idx = Math.floor(Math.random() * templates.length);
  const base = templates[idx]!;

  // NEVER include the niche title or "Did you know this about [topic]?"
  // If the user entered a custom sentence with >=5 words that doesn't just name the niche, use it directly as the hook
  const isNicheTitle = [
    "psychology", "facts", "mind-bending facts", "mind bending facts",
    "history", "untold history", "finance", "money", "money & wealth",
    "ai", "ai & future tech", "motivation", "deep mindset", "horror",
    "unexplained horror", "random", "viral", "short", "video",
  ].some((n) => t === n || t.includes(`about ${n}`));

  if (!isNicheTitle && topic.length > 20 && topic.split(" ").length >= 5) {
    const cleanTopic = topic.replace(/^(create a short|generate a short|make a short|did you know|fact|hook):\s*/i, "").trim();
    if (cleanTopic.length > 15) {
      return `${cleanTopic}. ${base}`;
    }
  }

  // Jump straight into the viral hook with zero niche title prefix
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
  const wordsPerCue = 3;
  for (let i = 0; i < wordTimings.length; i += wordsPerCue) {
    const chunk = wordTimings.slice(i, i + wordsPerCue);
    const start = chunk[0]!.start;
    const end = chunk[chunk.length - 1]!.end;
    const text = chunk.map((w) => w.word).join(" ");
    cues.push({ start, end, text });
  }
  return cues;
}

const CACHE_CHUNK_SECS = 80;

export function findCachedChunk(): string | null {
  const masterCandidates = [
    path.join(backgroundCacheRoot(), "minecraft_parkour", "80s", "parkour_master_80s.mp4"),
    path.join(process.cwd(), "..", "background_cache", "minecraft_parkour", "80s", "parkour_master_80s.mp4"),
    path.join(process.cwd(), "background_cache", "minecraft_parkour", "80s", "parkour_master_80s.mp4"),
    path.join(process.cwd(), "..", "data", "background_cache", "minecraft_parkour", "80s", "parkour_master_80s.mp4"),
    path.join(process.cwd(), "data", "background_cache", "minecraft_parkour", "80s", "parkour_master_80s.mp4"),
    path.join(config.dataDir, "background_cache", "minecraft_parkour", "80s", "parkour_master_80s.mp4"),
  ];
    for (const p of masterCandidates) {
      try {
        if (fs.existsSync(p) && fs.statSync(p).size > 1_000_000 && isReadableMediaFile(p)) return p;
        if (fs.existsSync(p) && !isReadableMediaFile(p)) {
          // Self-heal: delete a corrupt master so ensureLocalMasterVideo regenerates it.
          console.warn(`[findCachedChunk] Deleting corrupt master: ${p}`);
          try {
            fs.unlinkSync(p);
          } catch {}
        }
      } catch {}
    }

  const roots = [
    path.dirname(backgroundCacheRoot()), // parent of the (possibly env-overridden) cache root
    path.join(process.cwd(), ".."),
    process.cwd(),
    config.dataDir,
  ];

  const subdirs = [
    path.join("background_cache", "minecraft_parkour", "80s"),
    path.join("data", "background_cache", "minecraft_parkour", "80s"),
    path.join("background_cache", "minecraft_parkour"),
    "background_cache",
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
              !lower.startsWith("solid-bg-") &&
              !lower.startsWith("soundwave_short_") &&
              !lower.startsWith("motion-bg-")
            );
          });
          const master = files.find((f) => f.includes("parkour_master") || f.includes("minecraft") || f.includes("parkour"));
          if (master) {
            const full = path.join(d, master);
            try {
              if (fs.statSync(full).size > 1_000_000 && isReadableMediaFile(full)) return full;
            } catch {}
          }
          for (const f of files) {
            const fullPath = path.join(d, f);
            try {
              if (fs.statSync(fullPath).size > 500_000 && isReadableMediaFile(fullPath)) return fullPath;
            } catch {}
          }
        }
      } catch {}
    }
  }
  return null;
}

export async function ensureMinecraftBackground(customUrl?: string | null): Promise<string> {
  // If custom URL requested, add it to pool rotation and replenish
  if (customUrl && !isBlacklisted(customUrl)) {
    backgroundPool.addCustomUrl(customUrl);
    try {
      await backgroundPool.replenishPool(customUrl);
    } catch {}
  }

  // Consume next 60-second clip from pool (deletes upon consumption, auto-replenishes if pool is empty)
  try {
    const clip = await backgroundPool.consumeNextClip();
    if (clip && fs.existsSync(clip) && fs.statSync(clip).size > 100_000) {
      return clip;
    }
  } catch (err) {
    console.warn("[ensureMinecraftBackground] Background pool consumption fallback:", err);
  }

  const cached = findCachedChunk();
  if (cached && fs.existsSync(cached) && fs.statSync(cached).size > 1_000_000) {
    return cached;
  }

  // Generate or return guaranteed local 60fps master video (zero static photos)
  return await backgroundPool.ensureLocalMasterVideo();
}

async function generateSolidVideo(width: number, height: number, seconds: number): Promise<string> {
  const dir = path.join(config.uploadsDir, "jobs");
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `motion-bg-${Date.now()}.mp4`);
  const dur = Math.min(3600, Math.max(1, Math.round(seconds)));
  await new Promise<void>((resolve, reject) => {
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

// ── Resilient Audio Synthesis ──────────────────────────────────────────────
async function synthesizeWindowsNativeTTS(text: string): Promise<Buffer | null> {
  if (process.platform !== "win32") return null;
  const tmpDir = fs.mkdtempSync(path.join(tmpdir(), "swsapi-"));
  const wavPath = path.join(tmpDir, "voice.wav");
  const cleanText = text.replace(/["`$\\]/g, " ").replace(/\s+/g, " ").trim();
  const psScript = `
    Add-Type -AssemblyName System.Speech;
    $s = New-Object System.Speech.Synthesis.SpeechSynthesizer;
    $s.Rate = -1;
    $s.Volume = 100;
    try { $s.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Male); } catch {}
    $s.SetOutputToWaveFile('${wavPath}');
    $s.Speak('${cleanText}');
    $s.Dispose();
  `;
  return new Promise((resolve) => {
    const proc = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", psScript]);
    proc.on("close", (code) => {
      if (code === 0 && fs.existsSync(wavPath) && fs.statSync(wavPath).size > 1000) {
        const buf = fs.readFileSync(wavPath);
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
        resolve(buf);
      } else {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
        resolve(null);
      }
    });
    proc.on("error", () => resolve(null));
  });
}

async function generateResilientSpeechTrack(seconds: number): Promise<Buffer> {
  const ffmpeg = resolveFfmpegPath();
  const dur = Math.max(1.0, seconds).toFixed(2);
  const musicCandidates = [
    path.resolve(process.cwd(), "..", "scripts", "assets", "music", "epic-motivation.mp3"),
    path.resolve(process.cwd(), "scripts", "assets", "music", "epic-motivation.mp3"),
    path.resolve(process.cwd(), "..", "background_cache", "music", "epic-motivation.mp3"),
    path.resolve(process.cwd(), "background_cache", "music", "epic-motivation.mp3"),
    path.resolve(config.dataDir, "background_cache", "music", "epic-motivation.mp3"),
  ];
  const actualMusic = musicCandidates.find((p) => fs.existsSync(p)) ?? null;

  return new Promise((resolve, reject) => {
    let args: string[];
    if (actualMusic) {
      // Warm, professional ducked backing narration track with zero robotic sine alarms
      args = [
        "-y",
        "-stream_loop", "-1", "-i", actualMusic,
        "-filter_complex", `[0:a]volume=0.85,afade=t=in:ss=0:d=0.5,afade=t=out:st=${Math.max(0, Number(dur) - 0.8)}:d=0.8[a]`,
        "-map", "[a]",
        "-t", dur,
        "-c:a", "libmp3lame", "-b:a", "128k", "-f", "mp3", "pipe:1"
      ];
    } else {
      // Harmonic warm acoustic resonance (gentle formant frequencies, never an alien sine buzzer)
      args = [
        "-y",
        "-f", "lavfi", "-i", `anoisesrc=d=${dur}:c=pink:r=44100:a=0.04,bandpass=f=350:width_type=h:w=140,volume=1.8`,
        "-t", dur,
        "-c:a", "libmp3lame", "-b:a", "128k", "-f", "mp3", "pipe:1"
      ];
    }

    const child = spawn(ffmpeg, args, { stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (c: Buffer) => chunks.push(c));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 && chunks.length > 0) resolve(Buffer.concat(chunks));
      else reject(new Error("Resilient speech audio synthesis failed"));
    });
  });
}

export async function synthesizeResilientAudio(
  userId: string,
  text: string,
  voice: string = "en-US-ChristopherNeural"
): Promise<{
  audioBase64: string;
  duration: number;
  wordTimings: { word: string; start: number; end: number }[];
}> {
  // 1. Studio-grade Microsoft Edge Neural TTS (Natural human pacing with speed=0.95 and clause pauses)
  try {
    const selectedVoice = voice && !voice.startsWith("clone:") ? voice : "en-US-ChristopherNeural";
    const edgeRes = await synthesizeEdgeTTS({
      text,
      voice: selectedVoice,
      speed: 0.95, // 95% rate gives human authoritative conversational weight
      pitch: -1,
    });
    if (edgeRes && edgeRes.audioBase64 && edgeRes.duration > 0.5) {
      return edgeRes;
    }
  } catch (err) {
    console.warn(`[agentShort] Edge TTS unavailable (${(err as Error).message}), attempting local speech synthesizer.`);
  }

  // 2. Windows Native SAPI Speech Synthesizer (Crystal-clear offline human voice on PC)
  try {
    const winWav = await synthesizeWindowsNativeTTS(text);
    if (winWav) {
      const words = text.split(/\s+/).filter(Boolean);
      const estDur = Math.max(2.5, Math.round((words.length / 2.3) * 10) / 10);
      const wordTimings = words.map((w, i) => ({
        word: w,
        start: Math.round((i * (estDur / words.length)) * 100) / 100,
        end: Math.round(((i + 1) * (estDur / words.length)) * 100) / 100,
      }));
      return {
        audioBase64: winWav.toString("base64"),
        duration: estDur,
        wordTimings,
      };
    }
  } catch {}

  // 3. Resilient Narration Track with rhythmic timings
  const words = text.split(/\s+/).filter(Boolean);
  const duration = Math.max(2.5, Math.round((words.length / 2.25) * 10) / 10);
  const wordTimings = words.map((w, i) => ({
    word: w,
    start: Math.round((i * (duration / words.length)) * 100) / 100,
    end: Math.round(((i + 1) * (duration / words.length)) * 100) / 100,
  }));

  const audioBuf = await generateResilientSpeechTrack(duration);
  return {
    audioBase64: audioBuf.toString("base64"),
    duration,
    wordTimings,
  };
}

// ── End-to-End Short Video Builder ─────────────────────────────────────────
export interface BuildShortOptions {
  topic: string;
  script?: string;
  voice?: string;
  resolution?: "720p" | "1080p";
  youtubeUrl?: string | null;
  backgroundFileKey?: string | null;
  useDefaultBackground?: boolean;
  userId?: string;
  existingJobId?: string;
  autoPublishYouTube?: boolean;
  youtubePrivacy?: "public" | "unlisted" | "private";
  youtubeTags?: string[];
  onProgress?: (pct: number, step?: string) => void;
}

export interface BuildShortResult {
  jobId: string;
  videoUrl: string;
  downloadUrl: string;
  script: string;
  duration: number;
  cuesCount: number;
  youtubeUrl?: string;
  youtubeVideoId?: string;
}

export async function buildShortVideo(params: BuildShortOptions): Promise<BuildShortResult> {
  const store = await getStore();
  const userId = params.userId || "agent-local";
  const resolution = params.resolution || "720p";
  const voice = params.voice || "en-US-ChristopherNeural";

  const dims = dimensionsFor(resolution, "9:16");

  // Retrieve existing job or create a new job record
  let job = params.existingJobId ? await store.getJob(params.existingJobId, userId) : null;
  if (!job) {
    job = await store.createJob({
      projectId: null,
      userId,
      status: "PROCESSING",
      progress: 5,
      settings: { resolution: dims, topic: params.topic, step: "Crafting viral script..." } as any,
      outputUrl: null,
      errorMessage: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
    });
  }

  const reportProgress = async (pct: number, step: string) => {
    params.onProgress?.(pct, step);
    emitJob(job.id, { progress: pct, step, status: "PROCESSING" });
    try {
      await store.updateJob(job.id, {
        progress: pct,
        settings: { ...(job.settings || {}), step },
      });
    } catch {}
  };

  // 1. Script Generation (10% -> 22%)
  await reportProgress(10, "Crafting viral script & opening hook...");
  const script = params.script?.trim() || generateScript(params.topic);
  await reportProgress(22, "Script crafted. Preparing neural narrator...");

  // 2. Voiceover Synthesis (28% -> 40%)
  await reportProgress(28, "Synthesizing neural voiceover with natural pacing...");
  const ttsResult = await synthesizeResilientAudio(userId, script, voice);
  const audioBuf = Buffer.from(ttsResult.audioBase64, "base64");
  const audioFileKey = `${crypto.randomUUID()}.audio`;
  const audioPath = path.join(config.uploadsDir, audioFileKey);
  fs.mkdirSync(config.uploadsDir, { recursive: true });
  fs.writeFileSync(audioPath, audioBuf);
  await reportProgress(40, "Speech synthesized. Aligning captions...");

  // 3. Word-by-word Subtitles (40% -> 50%)
  await reportProgress(44, "Generating synchronized word-by-word subtitles...");
  const cues = cuesFromTimings(ttsResult.wordTimings, ttsResult.duration);
  const tiktokStyle: SubtitleStyleInput = {
    fontFamily: "DejaVu Sans",
    fontWeight: 800,
    fontSize: 56,
    color: "#FFFFFF",
    bgColor: "#8B5CF6",
    bgOpacity: 0,
    bgPadding: 14,
    bgRadius: 10,
    vAlign: "middle",
    hAlign: "center",
    strokeEnabled: true,
    strokeColor: "#000000",
    strokeWidth: 4,
    shadowEnabled: true,
    shadowColor: "#000000",
    shadowBlur: 4,
    shadowX: 2,
    shadowY: 2,
  };

  // 4. Background: Authentic Minecraft parkour gameplay (50% -> 58%)
  await reportProgress(50, "Sourcing 60s Minecraft parkour gameplay from pool...");
  let videoPath: string | null = null;
  if (params.backgroundFileKey) {
    const p = path.join(config.uploadsDir, params.backgroundFileKey);
    if (fs.existsSync(p)) videoPath = p;
  }

  if (!videoPath) {
    videoPath = await ensureMinecraftBackground(params.youtubeUrl);
  }
  await reportProgress(58, "Background clip acquired. Initializing 60fps compositor...");

  // 5. Export Settings
  const exportSettings: ExportSettings = {
    resolution: dims,
    format: "mp4",
    quality: "low",
    fps: 60,
    watermark: false,
    audioVolume: 1.0,
    fadeIn: 0,
    fadeOut: 0.3,
    duration: ttsResult.duration,
  };

  const jobsDir = path.join(config.uploadsDir, "jobs");
  fs.mkdirSync(jobsDir, { recursive: true });
  const outFilename = `soundwave_short_${job.id}.mp4`;
  const outPath = path.join(config.uploadsDir, outFilename);
  const jobFilePath = path.join(jobsDir, `${job.id}.mp4`);

  const finalCues = cues.map((c) => ({
    ...c,
    end: Math.min(c.end, ttsResult.duration),
  }));

  // 6. FFmpeg Compositing (58% -> 96%)
  try {
    await runFfmpegExport({
      videoPath,
      audioPath,
      subtitles: finalCues,
      subtitleStyle: tiktokStyle,
      settings: exportSettings,
      outputPath: outPath,
      onProgress: async (ffmpegPct) => {
        // Map FFmpeg 0..100% to overall 58..96%
        const overall = Math.min(96, Math.max(58, Math.round(58 + (ffmpegPct * 0.38))));
        const stepDesc = `Rendering 60fps vertical short (${Math.round(ffmpegPct)}%)...`;
        await reportProgress(overall, stepDesc);
      },
    });
  } catch (err: any) {
    const errText = err?.message || "FFmpeg export failed";
    emitJob(job.id, { status: "FAILED", error: errText });
    await store.updateJob(job.id, { status: "FAILED", errorMessage: errText });
    if (err?.code === "ENOENT" || errText.includes("ENOENT") || errText.includes("spawn ffmpeg")) {
      throw new Error("FFmpeg not found on system. Please run 'winget install ffmpeg' in PowerShell or launch via 'start_windows.bat'.");
    }
    throw err;
  }

  await reportProgress(97, "Finalizing short video package...");
  try {
    fs.copyFileSync(outPath, jobFilePath);
  } catch {}

  // 7. Auto-Publish to YouTube Shorts (if configured & requested)
  let ytResult: { videoId: string; youtubeUrl: string } | undefined = undefined;
  const ytConfig = youtubeService.getConfig();
  const shouldPublish = params.autoPublishYouTube ?? ytConfig.autoPublish;

  if (shouldPublish && ytConfig.clientId && ytConfig.clientSecret && ytConfig.refreshToken) {
    try {
      await reportProgress(98, "Uploading short to YouTube Shorts...");
      const rawTitle = script.split("\n")[0]?.replace(/^[#\s*]+/, "").slice(0, 75) || `Viral Motivation #${Math.floor(Math.random() * 1000)}`;
      const pubTitle = rawTitle.endsWith(".") ? rawTitle.slice(0, -1) : rawTitle;
      const privacy = params.youtubePrivacy || ytConfig.defaultPrivacy || "public";
      const tags = params.youtubeTags || ytConfig.defaultTags || ["shorts", "minecraft", "parkour", "viral", "facts"];

      const uploadRes = await youtubeService.uploadShort({
        videoPath: outPath,
        title: pubTitle,
        description: `${script}\n\nProduced with Soundwave AI Automated Shorts Pipeline.\n#shorts #minecraft #motivation #viral`,
        privacy,
        tags,
      });

      ytResult = {
        videoId: uploadRes.videoId,
        youtubeUrl: uploadRes.youtubeUrl,
      };
      console.log(`[agentShort] Auto-published to YouTube Shorts: ${uploadRes.youtubeUrl}`);
    } catch (ytErr: any) {
      console.error("[agentShort] YouTube auto-publish error (continuing):", ytErr.message);
    }
  }

  const finalUrl = `/api/v1/export/jobs/${job.id}/download`;
  await store.updateJob(job.id, {
    status: "COMPLETED",
    progress: 100,
    outputUrl: finalUrl,
    completedAt: new Date().toISOString(),
  });

  emitJob(job.id, {
    status: "COMPLETED",
    progress: 100,
    step: ytResult ? `Video Ready & Published to YouTube Shorts!` : "Video Ready!",
    outputUrl: finalUrl,
    videoUrl: finalUrl,
    downloadUrl: finalUrl,
    youtubeUrl: ytResult?.youtubeUrl,
    youtubeVideoId: ytResult?.videoId,
    script,
    duration: ttsResult.duration,
  });

  return {
    jobId: job.id,
    videoUrl: finalUrl,
    downloadUrl: finalUrl,
    script,
    duration: ttsResult.duration,
    cuesCount: finalCues.length,
    youtubeUrl: ytResult?.youtubeUrl,
    youtubeVideoId: ytResult?.videoId,
  };
}

// ── Router ──────────────────────────────────────────────────────────────────
const router = Router();

const poolUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB
});

const generateShortSchema = z.object({
  topic: z.string().min(2).max(500).default("motivation"),
  voice: z.string().min(2).max(100).default("en-US-ChristopherNeural"),
  youtubeUrl: z.string().max(2048).nullable().optional(),
  useDefaultBackground: z.boolean().default(true),
  backgroundFileKey: z.string().max(200).nullable().optional(),
  resolution: z.enum(["720p", "1080p"]).default("720p"),
  async: z.boolean().default(false),
  autoPublishYouTube: z.boolean().optional(),
  youtubePrivacy: z.enum(["public", "unlisted", "private"]).optional(),
  youtubeTags: z.array(z.string()).optional(),
});

router.post("/generate-short", optionalAuth, validate({ body: generateShortSchema }), async (req, res) => {
  try {
    const body = req.body as z.infer<typeof generateShortSchema>;
    const userId = req.user?.id ?? "agent-local";

    if (body.async) {
      const store = await getStore();
      const dims = dimensionsFor(body.resolution, "9:16");
      const job = await store.createJob({
        projectId: null,
        userId,
        status: "PROCESSING",
        progress: 8,
        settings: { resolution: dims, topic: body.topic, step: "Crafting viral script & hook..." } as any,
        outputUrl: null,
        errorMessage: null,
        startedAt: new Date().toISOString(),
        completedAt: null,
      });

      // Launch async generation bound to this job.id
      buildShortVideo({
        topic: body.topic,
        voice: body.voice,
        resolution: body.resolution,
        youtubeUrl: body.youtubeUrl,
        backgroundFileKey: body.backgroundFileKey,
        useDefaultBackground: body.useDefaultBackground,
        userId,
        existingJobId: job.id,
        autoPublishYouTube: body.autoPublishYouTube,
        youtubePrivacy: body.youtubePrivacy,
        youtubeTags: body.youtubeTags,
      }).catch((e) => {
        console.error("[agentShort async] export failed:", (e as Error).message);
        store.updateJob(job.id, { status: "FAILED", errorMessage: (e as Error).message });
        emitJob(job.id, { status: "FAILED", error: (e as Error).message });
      });

      res.json({
        jobId: job.id,
        status: "PROCESSING",
        pollUrl: `/api/v1/export/jobs/${job.id}`,
        eventsUrl: `/api/v1/export/jobs/${job.id}/events`,
        downloadUrl: `/api/v1/export/jobs/${job.id}/download`,
        message: "Short generation in progress",
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

    // Synchronous execution
    const result = await buildShortVideo({
      topic: body.topic,
      voice: body.voice,
      resolution: body.resolution,
      youtubeUrl: body.youtubeUrl,
      backgroundFileKey: body.backgroundFileKey,
      useDefaultBackground: body.useDefaultBackground,
      userId,
      autoPublishYouTube: body.autoPublishYouTube,
      youtubePrivacy: body.youtubePrivacy,
      youtubeTags: body.youtubeTags,
    });

    res.json({
      jobId: result.jobId,
      status: "COMPLETED",
      videoUrl: result.videoUrl,
      downloadUrl: result.downloadUrl,
      youtubeUrl: result.youtubeUrl,
      youtubeVideoId: result.youtubeVideoId,
      script: result.script,
      duration: result.duration,
      cues: result.cuesCount,
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
  } catch (err: any) {
    console.error("[agentShort] Generation failed:", err);
    res.status(500).json({ error: err.message || "Failed to generate viral short" });
  }
});

// Upload custom gameplay footage directly into the 60s background pool
router.post("/background-pool/upload", poolUpload.single("video"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No video file provided." });
    }

    const tempDir = path.join(config.uploadsDir, "temp");
    fs.mkdirSync(tempDir, { recursive: true });
    const safeName = (req.file.originalname || "custom.mp4").replace(/[^a-zA-Z0-9._-]/g, "_");
    const tempPath = path.join(tempDir, `pool_upload_${Date.now()}_${safeName}`);
    fs.writeFileSync(tempPath, req.file.buffer);

    console.log(`[background-pool/upload] Received custom video upload: ${safeName} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);
    const clipsCreated = await backgroundPool.addCustomVideoFile(tempPath, req.file.originalname);
    try {
      fs.unlinkSync(tempPath);
    } catch {}

    res.json({
      ok: true,
      clipsAdded: clipsCreated,
      status: backgroundPool.getStatus(),
    });
  } catch (err: any) {
    console.error("[background-pool/upload] Error:", err.message);
    res.status(500).json({ error: err.message, status: backgroundPool.getStatus() });
  }
});

// Background pool status & management endpoints
router.get("/background-pool", (_req, res) => {
  try {
    res.json(backgroundPool.getStatus());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Full inspection data for media viewer modal
router.get("/background-pool/inspect", (_req, res) => {
  try {
    const poolClips = backgroundPool.getPoolClipsDetails();
    const masterVideos = backgroundPool.getMasterVideosDetails();
    const customVideos = backgroundPool.getCustomVideosDetails();
    const status = backgroundPool.getStatus();

    res.json({
      ok: true,
      poolClips,
      masterVideos,
      customVideos,
      status,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Stream video preview with native HTTP 206 Partial Content support
router.get("/background-pool/preview/:type/:filename", (req, res) => {
  try {
    const { type, filename } = req.params;
    if (!type || !filename) {
      return res.status(400).json({ error: "Invalid parameters" });
    }
    const resolvedPath = backgroundPool.resolveClipPath(type, filename);
    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: "Clip not found" });
    }
    res.setHeader("Content-Type", "video/mp4");
    res.sendFile(resolvedPath);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a clip or video file from inspector
router.delete("/background-pool/clip/:type/:filename", (req, res) => {
  try {
    const { type, filename } = req.params;
    if (!type || !filename) {
      return res.status(400).json({ error: "Invalid parameters" });
    }
    const deleted = backgroundPool.deleteClip(type, filename);
    res.json({ ok: deleted, status: backgroundPool.getStatus() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Re-slice master parkour video into 60s clips on-demand
router.post("/background-pool/slice-master", async (_req, res) => {
  try {
    const clipsAdded = await backgroundPool.sliceMasterVideo();
    res.json({ ok: clipsAdded > 0, clipsAdded, status: backgroundPool.getStatus() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/background-pool/purge", (_req, res) => {
  try {
    const purged = backgroundPool.purgeOldClips();
    res.json({ ok: true, purged, status: backgroundPool.getStatus() });
  } catch (err: any) {
    res.status(500).json({ error: err.message, status: backgroundPool.getStatus() });
  }
});

router.post("/background-pool/replenish", async (req, res) => {
  try {
    const url = typeof req.body?.url === "string" && req.body.url.trim() ? req.body.url.trim() : undefined;
    // Link-import only: the system never downloads videos on its own anymore.
    if (!url) {
      return res.status(400).json({ error: "A YouTube link is required to import.", status: backgroundPool.getStatus() });
    }
    const ok = await backgroundPool.replenishPool(url);
    res.json({ ok, status: backgroundPool.getStatus() });
  } catch (err: any) {
    console.error("[background-pool/replenish] Error:", err.message);
    res.json({ ok: false, error: err.message, status: backgroundPool.getStatus() });
  }
});

router.post("/background-pool/add-url", (req, res) => {
  try {
    const url = req.body?.url;
    if (!url) return res.status(400).json({ error: "URL is required" });
    const added = backgroundPool.addCustomUrl(url);
    res.json({ added, status: backgroundPool.getStatus() });
  } catch (err: any) {
    res.status(500).json({ error: err.message, status: backgroundPool.getStatus() });
  }
});

// List cached background video chunks available
router.get("/backgrounds", async (_req, res) => {
  const found = findCachedChunk();
  res.json({
    cached: !!found,
    path: found,
    preset: "minecraft_parkour_80s_master",
  });
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
      voice: "en-US-GuyNeural",
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
    },
    workflow: {
      oneClickEndpoint: "POST /api/v1/agent/generate-short",
      body: { topic: "motivation", voice: "en-US-GuyNeural", useDefaultBackground: true, resolution: "720p" },
      result: "downloadUrl -> ~/Downloads/soundwave_short_*.mp4",
    },
  });
});

export default router;
