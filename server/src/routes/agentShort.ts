import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { optionalAuth } from "../middleware/auth.js";
import { getStore } from "../lib/store.js";
import { dimensionsFor } from "../lib/plans.js";
import { synthesizeEdgeTTS } from "../lib/edgeTts.js";
import { runFfmpegExport, type ExportSettings, type SubtitleCueInput, type SubtitleStyleInput } from "../lib/ffmpeg.js";
import { config } from "../config.js";
import {
  ORBITAL_CHANNEL_NAME,
  ORBITAL_CHANNEL_URL,
  OrbitalError,
  describeOrbitalSection,
  discardOrbitalImport,
  getOrbitalCatalog,
  getOrbitalStatus,
  importUnusedOrbitalVideo,
  markOrbitalVideoUsed,
  releaseOrbitalVideo,
  resetOrbitalHistory,
  type OrbitalImport,
  type OrbitalSection,
} from "../lib/orbitalBackground.js";
import { youtubeService } from "../lib/youtube.js";
import { emitJob } from "./export.js";
import { activeBrain } from "../lib/brain/settings.js";
import { writeShortScript } from "../lib/brain/script.js";

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

// ── Narration: always a Soundwave (Microsoft neural) voice ─────────────────
// No robotic stand-ins: the old Windows SAPI voice (slower, estimated captions)
// and the voiceless music bed are gone. If the neural voice can't be reached,
// the short fails with a clear message and no Orbital video is used up.
const NARRATOR_FALLBACK_VOICE = "en-US-ChristopherNeural";

function voiceDisplayName(voice: string): string {
  return /-([A-Za-z]+)Neural$/.exec(voice)?.[1] ?? voice;
}

export async function synthesizeNarration(
  text: string,
  voice: string = NARRATOR_FALLBACK_VOICE,
): Promise<{
  audioBase64: string;
  duration: number;
  wordTimings: { word: string; start: number; end: number }[];
}> {
  const selectedVoice = voice && !voice.startsWith("clone:") ? voice : NARRATOR_FALLBACK_VOICE;
  try {
    const result = await synthesizeEdgeTTS({ text, voice: selectedVoice, speed: 0.95 }, { attempts: 3 });
    if (!result.audioBase64 || result.duration < 0.5) throw new Error("the voice service returned an empty recording");
    return result;
  } catch (err) {
    throw new Error(
      `Couldn't record the voiceover with the Soundwave voice "${voiceDisplayName(selectedVoice)}" — ` +
        `${(err as Error).message}. Check the internet connection and generate the short again.`,
    );
  }
}

// ── End-to-End Short Video Builder ─────────────────────────────────────────
/** Where the short's background footage came from (always Orbital NCG). */
export interface ShortBackgroundInfo {
  source: "orbital_ncg";
  importer: "youtube_link_importer";
  channelName: string;
  channelUrl: string;
  videoId: string;
  url: string;
  title: string;
  /** Imported window of the Orbital video (null = whole video). */
  section: OrbitalSection | null;
}

export interface BuildShortOptions {
  topic: string;
  script?: string;
  /** What the person asked for beyond the topic (an angle, facts, tone) — for the script writer. */
  scriptBrief?: string;
  voice?: string;
  resolution?: "720p" | "1080p";
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
  background: ShortBackgroundInfo;
  youtubeUrl?: string;
  youtubeVideoId?: string;
}

/** Gameplay seconds to import: the voiceover plus a small safety margin
 * (the renderer loops the clip if it ever comes up short). */
function backgroundClipSeconds(voiceSeconds: number): number {
  return Math.min(180, Math.max(15, Math.ceil(voiceSeconds) + 3));
}

function toBackgroundInfo(orbital: OrbitalImport): ShortBackgroundInfo {
  return {
    source: "orbital_ncg",
    importer: "youtube_link_importer",
    channelName: ORBITAL_CHANNEL_NAME,
    channelUrl: ORBITAL_CHANNEL_URL,
    videoId: orbital.video.id,
    url: orbital.video.url,
    title: orbital.imported.meta.title || orbital.video.title,
    section: orbital.imported.section,
  };
}

type BuildStage = "script" | "voice" | "background" | "render" | "publish";

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
  const jobId = job.id;
  let jobSettings: Record<string, unknown> = { ...((job.settings as unknown as Record<string, unknown> | null) ?? {}) };

  const reportProgress = async (pct: number, step: string) => {
    params.onProgress?.(pct, step);
    emitJob(jobId, { progress: pct, step, status: "PROCESSING", background: jobSettings.background });
    try {
      await store.updateJob(jobId, {
        progress: pct,
        settings: { ...jobSettings, step } as any,
      });
    } catch {}
  };

  let stage: BuildStage = "script";
  let orbital: OrbitalImport | null = null;
  let orbitalMarkedUsed = false;

  try {
    // 1. Script (10% -> 22%): written by Gemini when a key is set (Settings →
    //    Brain), otherwise — or if Gemini fails — the built-in template.
    let script = params.script?.trim() || "";
    let scriptSource: "provided" | "gemini" | "template" = "provided";
    if (!script && activeBrain()) {
      await reportProgress(10, "Writing the script with Gemini...");
      try {
        const written = await writeShortScript(params.topic, params.scriptBrief);
        if (written) {
          script = written.script;
          scriptSource = "gemini";
        }
      } catch (err) {
        console.warn(`[agentShort] Gemini couldn't write the script (${(err as Error).message}); using the template`);
      }
    }
    if (!script) {
      await reportProgress(12, "Crafting viral script & opening hook...");
      script = generateScript(params.topic);
      scriptSource = "template";
    }
    jobSettings = { ...jobSettings, script, scriptSource };
    await reportProgress(22, "Script ready. Preparing neural narrator...");

    // 2. Voiceover Synthesis (28% -> 40%)
    stage = "voice";
    await reportProgress(28, "Synthesizing neural voiceover with natural pacing...");
    const ttsResult = await synthesizeNarration(script, voice);
    const audioBuf = Buffer.from(ttsResult.audioBase64, "base64");
    const audioFileKey = `${crypto.randomUUID()}.audio`;
    const audioPath = path.join(config.uploadsDir, audioFileKey);
    fs.mkdirSync(config.uploadsDir, { recursive: true });
    fs.writeFileSync(audioPath, audioBuf);
    await reportProgress(40, "Speech synthesized. Aligning captions...");

    // 3. Word-by-word Subtitles (40% -> 46%)
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

    // 4. Background (46% -> 58%): an Orbital NCG video the agent has never
    //    used, pasted into the YouTube link importer.
    stage = "background";
    let progressChain: Promise<void> = Promise.resolve();
    orbital = await importUnusedOrbitalVideo({
      clipSeconds: backgroundClipSeconds(ttsResult.duration),
      onStep: (message, fraction) => {
        const pct = Math.round(46 + fraction * 12);
        progressChain = progressChain.then(() => reportProgress(pct, message));
      },
    });
    await progressChain;
    const background = toBackgroundInfo(orbital);
    jobSettings = { ...jobSettings, background };
    await reportProgress(58, `Background ready: "${background.title}" (Orbital NCG, ${describeOrbitalSection(background.section)}). Initializing 60fps compositor...`);
    const videoPath = orbital.imported.filePath;

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
    const outFilename = `soundwave_short_${jobId}.mp4`;
    const outPath = path.join(config.uploadsDir, outFilename);
    const jobFilePath = path.join(jobsDir, `${jobId}.mp4`);

    const finalCues = cues.map((c) => ({
      ...c,
      end: Math.min(c.end, ttsResult.duration),
    }));

    // 6. FFmpeg Compositing (58% -> 96%)
    stage = "render";
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

    // The short exists — this Orbital video is now used and never picked again.
    markOrbitalVideoUsed(orbital.video, { jobId, topic: params.topic, section: orbital.imported.section });
    orbitalMarkedUsed = true;

    await reportProgress(97, "Finalizing short video package...");
    try {
      fs.copyFileSync(outPath, jobFilePath);
    } catch {}

    // 7. Auto-Publish to YouTube Shorts (if configured & requested)
    stage = "publish";
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
          description: `${script}\n\nBackground gameplay: ${background.title} by ${ORBITAL_CHANNEL_NAME} (${background.url})\nProduced with Soundwave AI Automated Shorts Pipeline.\n#shorts #minecraft #motivation #viral`,
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

    const finalUrl = `/api/v1/export/jobs/${jobId}/download`;
    const finalStep = ytResult ? `Video Ready & Published to YouTube Shorts!` : "Video Ready!";
    await store.updateJob(jobId, {
      status: "COMPLETED",
      progress: 100,
      outputUrl: finalUrl,
      completedAt: new Date().toISOString(),
      // Shown by Projects / Overview (the agent's shorts library).
      settings: { ...jobSettings, step: finalStep, voice, duration: ttsResult.duration, youtubeUrl: ytResult?.youtubeUrl ?? null } as any,
    });

    emitJob(jobId, {
      status: "COMPLETED",
      progress: 100,
      step: finalStep,
      outputUrl: finalUrl,
      videoUrl: finalUrl,
      downloadUrl: finalUrl,
      youtubeUrl: ytResult?.youtubeUrl,
      youtubeVideoId: ytResult?.videoId,
      script,
      duration: ttsResult.duration,
      background,
    });

    return {
      jobId,
      videoUrl: finalUrl,
      downloadUrl: finalUrl,
      script,
      duration: ttsResult.duration,
      cuesCount: finalCues.length,
      background,
      youtubeUrl: ytResult?.youtubeUrl,
      youtubeVideoId: ytResult?.videoId,
    };
  } catch (err: any) {
    let failure: Error = err instanceof Error ? err : new Error(String(err ?? "Short generation failed"));
    const errText = failure.message || "Short generation failed";
    if (
      stage === "render" &&
      (err?.code === "ENOENT" || errText.includes("ENOENT") || errText.includes("spawn ffmpeg"))
    ) {
      failure = new Error("FFmpeg not found on system. Please run 'winget install ffmpeg' in PowerShell or launch via 'start_windows.bat'.");
    }
    emitJob(jobId, { status: "FAILED", error: failure.message, background: jobSettings.background });
    try {
      await store.updateJob(jobId, {
        status: "FAILED",
        errorMessage: failure.message,
        settings: { ...jobSettings, step: `Failed: ${failure.message}` } as any,
      });
    } catch {}
    throw failure;
  } finally {
    // Failed after the pick → the Orbital video goes back to the unused set.
    if (orbital && !orbitalMarkedUsed) releaseOrbitalVideo(orbital.video.id);
    // The imported clip lives on inside the rendered short; the link stays in the history.
    discardOrbitalImport(orbital);
  }
}

// ── Router ──────────────────────────────────────────────────────────────────
const router = Router();

const BACKGROUND_POLICY = `Unused Orbital NCG video (${ORBITAL_CHANNEL_URL}) imported via the YouTube link importer`;

const generateShortSchema = z.object({
  topic: z.string().min(2).max(500).default("motivation"),
  voice: z.string().min(2).max(100).default("en-US-ChristopherNeural"),
  resolution: z.enum(["720p", "1080p"]).default("720p"),
  async: z.boolean().default(false),
  autoPublishYouTube: z.boolean().optional(),
  youtubePrivacy: z.enum(["public", "unlisted", "private"]).optional(),
  youtubeTags: z.array(z.string()).optional(),
});

/** Background shorts currently rendering (chat uses this to avoid stacking jobs). */
const activeShortJobs = new Map<string, { topic: string; startedAt: number }>();

export function getActiveShortJobs(): Array<{ jobId: string; topic: string; startedAt: number }> {
  return [...activeShortJobs.entries()].map(([jobId, j]) => ({ jobId, ...j }));
}

/** Start a short as a background job; progress streams via /export/jobs/:id(/events). */
export async function startShortJob(params: Omit<BuildShortOptions, "existingJobId" | "onProgress">): Promise<{ jobId: string }> {
  const store = await getStore();
  const userId = params.userId || "agent-local";
  const dims = dimensionsFor(params.resolution || "720p", "9:16");
  const job = await store.createJob({
    projectId: null,
    userId,
    status: "PROCESSING",
    progress: 8,
    settings: { resolution: dims, topic: params.topic, step: "Crafting viral script & hook..." } as any,
    outputUrl: null,
    errorMessage: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
  });

  // buildShortVideo marks the job FAILED (and streams the error) on its own.
  activeShortJobs.set(job.id, { topic: params.topic, startedAt: Date.now() });
  buildShortVideo({ ...params, userId, existingJobId: job.id })
    .catch((e) => {
      console.error("[agentShort async] generation failed:", (e as Error).message);
    })
    .finally(() => activeShortJobs.delete(job.id));
  return { jobId: job.id };
}

function httpStatusFor(err: unknown): number {
  if (err instanceof OrbitalError) {
    return err.code === "ORBITAL_EXHAUSTED" || err.code === "ORBITAL_BUSY" ? 409 : 502;
  }
  return 500;
}

router.post("/generate-short", optionalAuth, validate({ body: generateShortSchema }), async (req, res) => {
  const defaults = (body: z.infer<typeof generateShortSchema>) => ({
    aspect: "9:16",
    resolution: body.resolution,
    format: "mp4",
    quality: "medium",
    fps: 60,
    fitToVoice: true,
    voice: body.voice,
    subtitleStyle: "TikTok #8B5CF6 Montserrat 800 56px middle",
    background: BACKGROUND_POLICY,
  });

  try {
    const body = req.body as z.infer<typeof generateShortSchema>;
    const userId = req.user?.id ?? "agent-local";
    const buildParams = {
      topic: body.topic,
      voice: body.voice,
      resolution: body.resolution,
      userId,
      autoPublishYouTube: body.autoPublishYouTube,
      youtubePrivacy: body.youtubePrivacy,
      youtubeTags: body.youtubeTags,
    };

    if (body.async) {
      const { jobId } = await startShortJob(buildParams);
      res.json({
        jobId,
        status: "PROCESSING",
        pollUrl: `/api/v1/export/jobs/${jobId}`,
        eventsUrl: `/api/v1/export/jobs/${jobId}/events`,
        downloadUrl: `/api/v1/export/jobs/${jobId}/download`,
        message: "Short generation in progress",
        defaults: defaults(body),
      });
      return;
    }

    // Synchronous execution
    const result = await buildShortVideo(buildParams);

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
      background: result.background,
      defaults: defaults(body),
    });
  } catch (err: any) {
    console.error("[agentShort] Generation failed:", err);
    res.status(httpStatusFor(err)).json({
      error: err.message || "Failed to generate viral short",
      code: err instanceof OrbitalError ? err.code : undefined,
    });
  }
});

// ── Orbital NCG background history ─────────────────────────────────────────
// Which Orbital videos were already used, which are left, and a reset.
router.get("/orbital", (_req, res) => {
  res.json(getOrbitalStatus());
});

router.post("/orbital/refresh", async (_req, res) => {
  try {
    const catalog = await getOrbitalCatalog({ force: true });
    res.json({ ok: !catalog.stale, error: catalog.error, status: getOrbitalStatus() });
  } catch (err: any) {
    res.status(502).json({ ok: false, error: err.message, status: getOrbitalStatus() });
  }
});

router.post("/orbital/reset", (_req, res) => {
  res.json({ ok: true, status: resetOrbitalHistory() });
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
      source: "orbital_ncg",
      channelUrl: ORBITAL_CHANNEL_URL,
      policy: "Every short uses an Orbital NCG video that has never been used before",
      importer: "YouTube link importer (POST /api/v1/upload/youtube)",
      history: "GET /api/v1/agent/orbital",
    },
    workflow: {
      oneClickEndpoint: "POST /api/v1/agent/generate-short",
      body: { topic: "motivation", voice: "en-US-GuyNeural", resolution: "720p" },
      result: "downloadUrl -> ~/Downloads/soundwave_short_*.mp4",
    },
  });
});

export default router;
