import { Router, type Response } from "express";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";
import { getStore } from "../lib/store.js";
import { PLANS, RESOLUTIONS, resolutionAllowed, type ResolutionKey } from "../lib/plans.js";
import { runFfmpegExport, probeMedia, resolveFfmpegPath, type ExportSettings, type SubtitleCueInput, type SubtitleStyleInput } from "../lib/ffmpeg.js";
import { spawn } from "node:child_process";
import { filePath } from "./upload.js";
import { config } from "../config.js";

const router = Router();

const jobEvents = new EventEmitter();

const cueSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
  text: z.string().max(500),
});

const styleSchema = z.record(z.unknown());

const exportSchema = z.object({
  videoFileKey: z.string().min(1).max(200).nullable(),
  audioFileKey: z.string().min(1).max(200),
  subtitleData: z.array(cueSchema).max(2000).default([]),
  subtitleStyle: styleSchema.default({}),
  exportSettings: z.object({
    resolution: z.enum(["720p", "1080p", "1440p", "4K"]),
    format: z.enum(["mp4", "webm"]),
    quality: z.enum(["low", "medium", "high"]),
    fps: z.number().int().min(24).max(60),
    audioVolume: z.number().min(0).max(2).optional(),
    fadeIn: z.number().min(0).max(30).optional(),
    fadeOut: z.number().min(0).max(30).optional(),
    bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  }),
  projectId: z.string().nullable().default(null),
});

function isVideoAllowed(plan: "FREE" | "PRO" | "ENTERPRISE", res: ResolutionKey): boolean {
  return resolutionAllowed(plan, res);
}

// ── Start export job ────────────────────────────────────────────────────────
router.post("/video", requireAuth, validate({ body: exportSchema }), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof exportSchema>;
    const store = await getStore();
    const plan = PLANS[req.user!.plan];

    // Rate limit: exports per hour.
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const recent = await store.countJobsSince(req.user!.id, hourAgo);
    if (recent >= plan.exportsPerHour) {
      throw new ApiError(429, "RATE_LIMITED", `Your plan allows ${plan.exportsPerHour} exports per hour. Try again later.`);
    }
    if (!isVideoAllowed(req.user!.plan, body.exportSettings.resolution)) {
      throw new ApiError(403, "RESOLUTION_NOT_ALLOWED", `The ${req.user!.plan} plan supports up to ${plan.maxResolution} export.`);
    }

    const audioPath = filePath(body.audioFileKey);
    if (!fs.existsSync(audioPath)) throw new ApiError(400, "AUDIO_NOT_FOUND", "The audio file could not be found. Please re-upload.");

    // Background: solid color if no video uploaded.
    let videoPath: string;
    let isTempBg = false;
    if (body.videoFileKey) {
      videoPath = filePath(body.videoFileKey);
      if (!fs.existsSync(videoPath)) throw new ApiError(400, "VIDEO_NOT_FOUND", "The video file could not be found. Please re-upload.");
    } else {
      videoPath = await generateColorVideo(body.exportSettings.resolution, req.user!.id, body.exportSettings.bgColor);
      isTempBg = true;
    }

    const settings: ExportSettings = {
      resolution: { width: RESOLUTIONS[body.exportSettings.resolution].width, height: RESOLUTIONS[body.exportSettings.resolution].height },
      format: body.exportSettings.format,
      quality: body.exportSettings.quality,
      fps: body.exportSettings.fps,
      watermark: plan.watermark,
      audioVolume: body.exportSettings.audioVolume,
      fadeIn: body.exportSettings.fadeIn,
      fadeOut: body.exportSettings.fadeOut,
    };

    const job = await store.createJob({
      projectId: body.projectId,
      userId: req.user!.id,
      status: "QUEUED",
      progress: 0,
      settings: { ...settings, subtitleCount: body.subtitleData.length },
      outputUrl: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
    });

    void processJob(job.id, {
      videoPath,
      audioPath,
      subtitles: body.subtitleData as SubtitleCueInput[],
      subtitleStyle: body.subtitleStyle as SubtitleStyleInput,
      settings,
      isTempBg,
    });

    res.status(202).json({ jobId: job.id, status: "QUEUED" });
  } catch (e) {
    next(e);
  }
});

async function generateColorVideo(resolution: ResolutionKey, userId: string, bgColor?: string): Promise<string> {
  const dir = path.join(config.uploadsDir, "jobs");
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${userId}-bg-${Date.now()}.mp4`);
  const { width, height } = RESOLUTIONS[resolution];
  const color = (bgColor ?? "#0A0F1C").replace("#", "0x");
  // Generate a short color clip (60s) — the final export uses -shortest to trim to audio length.
  await new Promise<void>((resolve, reject) => {
    const child = spawn(resolveFfmpegPath(), [
      "-y", "-f", "lavfi", "-i", `color=c=${color}:s=${width}x${height}:d=60:r=30`,
      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-t", "60", out,
    ]);
    const timeout = setTimeout(() => {
      try { child.kill("SIGKILL"); } catch { /* ignore */ }
      reject(new Error("Background video generation timed out"));
    }, 60_000);
    child.on("error", (e) => {
      clearTimeout(timeout);
      reject(e);
    });
    child.on("close", (code: number) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error("Background generation failed"));
    });
  });
  return out;
}

async function processJob(
  jobId: string,
  params: {
    videoPath: string;
    audioPath: string;
    subtitles: SubtitleCueInput[];
    subtitleStyle: SubtitleStyleInput;
    settings: ExportSettings;
    isTempBg?: boolean;
  },
): Promise<void> {
  const store = await getStore();
  const outputDir = path.join(config.uploadsDir, "jobs");
  fs.mkdirSync(outputDir, { recursive: true });
  const ext = params.settings.format === "mp4" ? ".mp4" : ".webm";
  const outputPath = path.join(outputDir, `${jobId}${ext}`);

  await store.updateJob(jobId, { status: "PROCESSING", startedAt: new Date().toISOString(), progress: 2 });
  emitJob(jobId, { status: "PROCESSING", progress: 2 });

  let lastPct = 2;
  try {
    // Probe durations for accurate progress.
    const probe = await probeMedia(params.videoPath).catch(() => ({ duration: 0, width: 0, height: 0, hasVideo: true, hasAudio: false }));
    const total = Math.max(probe.duration, params.subtitles.reduce((m, c) => Math.max(m, c.end), 0), 1);
    void total;

    await runFfmpegExport({
      videoPath: params.videoPath,
      audioPath: params.audioPath,
      subtitles: params.subtitles,
      subtitleStyle: params.subtitleStyle,
      settings: params.settings,
      outputPath,
      onProgress: (pct) => {
        const rounded = Math.max(lastPct, Math.min(99, Math.round(pct)));
        if (rounded > lastPct + 1 || rounded === 99) {
          lastPct = rounded;
          void store.updateJob(jobId, { progress: rounded });
          emitJob(jobId, { status: "PROCESSING", progress: rounded });
        }
      },
    });

    const outputUrl = `/api/v1/export/jobs/${jobId}/download`;
    await store.updateJob(jobId, { status: "COMPLETED", progress: 100, outputUrl, completedAt: new Date().toISOString() });
    emitJob(jobId, { status: "COMPLETED", progress: 100, outputUrl });
  } catch (e) {
    const message = (e as Error)?.message ?? "Export failed";
    await store.updateJob(jobId, { status: "FAILED", errorMessage: message.slice(0, 400), completedAt: new Date().toISOString() });
    emitJob(jobId, { status: "FAILED", error: message.slice(0, 400) });
  } finally {
    // Clean up temp inputs (the compositing inputs, not the final output).
    // Keep uploaded video files (user may re-export), but delete temp bg and uploaded audio after use.
    try {
      if (params.isTempBg) fs.unlinkSync(params.videoPath);
    } catch { /* ignore */ }
    try {
      // Audio files are single-use export artifacts — clean up after 5 min to allow retries.
      // We delete immediately here but the upload endpoint's tmp is already moved.
      // The audio file itself should be kept briefly; delete now for disk hygiene.
      // If it's in uploads root (not jobs), delete it.
      if (params.audioPath.includes(config.uploadsDir) && !params.audioPath.includes("/jobs/")) {
        // Delay deletion slightly to allow debugging, but attempt cleanup.
        setTimeout(() => {
          try { fs.unlinkSync(params.audioPath); } catch { /* ignore */ }
        }, 5 * 60 * 1000).unref?.();
      }
    } catch { /* ignore */ }
  }
}

function emitJob(jobId: string, payload: Record<string, unknown>): void {
  jobEvents.emit(jobId, payload);
}

// ── Job status ──────────────────────────────────────────────────────────────
router.get("/jobs/:jobId", requireAuth, async (req, res, next) => {
  try {
    const store = await getStore();
    const job = await store.getJob(req.params.jobId ?? "", req.user!.id);
    if (!job) throw new ApiError(404, "NOT_FOUND", "Export job not found.");
    res.json({
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        outputUrl: job.outputUrl,
        errorMessage: job.errorMessage,
        settings: job.settings,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
      },
    });
  } catch (e) {
    next(e);
  }
});

// ── SSE progress stream (no polling) ────────────────────────────────────────
router.get("/jobs/:jobId/events", requireAuth, async (req, res, next) => {
  try {
    const store = await getStore();
    const job = await store.getJob(req.params.jobId ?? "", req.user!.id);
    if (!job) throw new ApiError(404, "NOT_FOUND", "Export job not found.");

        res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const send = (data: Record<string, unknown>) => {
      try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch { /* client gone */ }
    };
    send({ status: job.status, progress: job.progress, outputUrl: job.outputUrl });

    if (job.status === "COMPLETED" || job.status === "FAILED") {
      res.end();
      return;
    }

    const onUpdate = (payload: Record<string, unknown>) => {
      send(payload);
      if (payload.status === "COMPLETED" || payload.status === "FAILED") {
        jobEvents.removeListener(job.id, onUpdate);
        try { res.end(); } catch { /* ignore */ }
      }
    };
    jobEvents.on(job.id, onUpdate);

    req.on("close", () => jobEvents.removeListener(job.id, onUpdate));
    const hb = setInterval(() => {
      try { res.write(`: hb\n\n`); } catch { clearInterval(hb); }
    }, 15000);
    res.on("close", () => clearInterval(hb));
  } catch (e) {
    next(e);
  }
});

// ── Download ────────────────────────────────────────────────────────────────
router.get("/jobs/:jobId/download", requireAuth, async (req, res, next) => {
  try {
    const store = await getStore();
    const job = await store.getJob(req.params.jobId ?? "", req.user!.id);
    if (!job) throw new ApiError(404, "NOT_FOUND", "Export job not found.");
    if (job.status !== "COMPLETED" || !job.outputUrl) {
      throw new ApiError(400, "NOT_READY", "This export is not ready for download yet.");
    }
    const ext = (job.settings as { format?: string })?.format === "webm" ? ".webm" : ".mp4";
    const p = path.join(config.uploadsDir, "jobs", `${job.id}${ext}`);
    if (!fs.existsSync(p)) throw new ApiError(404, "NOT_FOUND", "Export file expired. Please export again.");
    res.setHeader("Content-Type", ext === ".webm" ? "video/webm" : "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="soundwave-export-${job.id}${ext}"`);
    fs.createReadStream(p).pipe(res);
  } catch (e) {
    next(e);
  }
});

export default router;
