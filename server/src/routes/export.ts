import { Router, type Response } from "express";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";
import { getStore } from "../lib/store.js";
import { PLANS, dimensionsFor, resolutionAllowed, type ResolutionKey } from "../lib/plans.js";
import { runFfmpegExport, probeMedia, resolveFfmpegPath, type ExportSettings, type SubtitleCueInput, type SubtitleStyleInput } from "../lib/ffmpeg.js";
import { spawn, spawnSync } from "node:child_process";
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
    aspect: z.enum(["16:9", "9:16"]).default("16:9"),
    format: z.enum(["mp4", "webm"]),
    quality: z.enum(["low", "medium", "high"]),
    fps: z.number().int().min(24).max(60),
    audioVolume: z.number().min(0).max(2).optional(),
    fadeIn: z.number().min(0).max(30).optional(),
    fadeOut: z.number().min(0).max(30).optional(),
    // Optional: cut the video at this many seconds. When omitted the export
    // ends exactly when the voiceover does.
    videoEnd: z.number().min(0.1).max(7200).optional(),
  }),
  projectId: z.string().nullable().default(null),
});

// ── FFmpeg availability (cached) ────────────────────────────────────────────
// Failing fast with an actionable message beats a puzzling FAILED job — the
// number-one cause of "export doesn't work" on a fresh Windows install.
let ffmpegCheck: { ok: boolean; path: string } | null = null;

function ffmpegAvailable(): { ok: boolean; path: string } {
  if (ffmpegCheck) return ffmpegCheck;
  const p = resolveFfmpegPath();
  try {
    const r = spawnSync(p, ["-version"], { stdio: "ignore" });
    ffmpegCheck = { ok: r.status === 0, path: p };
  } catch {
    ffmpegCheck = { ok: false, path: p };
  }
  return ffmpegCheck;
}

function assertFfmpeg(): void {
  const c = ffmpegAvailable();
  if (!c.ok) {
    throw new ApiError(
      503,
      "FFMPEG_UNAVAILABLE",
      process.platform === "win32"
        ? "FFmpeg wasn't found on this computer. Install it once with `winget install ffmpeg` in PowerShell, then restart the server (a new terminal is opened so PATH refreshes), and export will work."
        : `FFmpeg wasn't found on this server (looked for "${c.path}"). Install it (e.g. \`sudo apt install ffmpeg\`) or set FFMPEG_PATH, then restart.`,
    );
  }
}

function isVideoAllowed(plan: "FREE" | "PRO" | "ENTERPRISE", res: ResolutionKey): boolean {
  return resolutionAllowed(plan, res);
}

// ── Start export job ────────────────────────────────────────────────────────
// NO LIMITS MODE — optionalAuth, no rate limit, no resolution check, no watermark
router.post("/video", optionalAuth, validate({ body: exportSchema }), async (req, res, next) => {
  try {
    assertFfmpeg();
    const body = req.body as z.infer<typeof exportSchema>;
    const store = await getStore();
    const plan = PLANS.ENTERPRISE;

    const audioPath = filePath(body.audioFileKey);
    if (!fs.existsSync(audioPath)) throw new ApiError(400, "AUDIO_NOT_FOUND", "The audio file could not be found. Please re-upload.");

    const dims = dimensionsFor(body.exportSettings.resolution, body.exportSettings.aspect);

    let videoPath: string;
    if (body.videoFileKey) {
      videoPath = filePath(body.videoFileKey);
      if (!fs.existsSync(videoPath)) throw new ApiError(400, "VIDEO_NOT_FOUND", "The video file could not be found. Please re-upload.");
    } else {
      const audioProbe = await probeMedia(audioPath).catch(() => null);
      const subtitleEnd = body.subtitleData.reduce((m, c) => Math.max(m, c.end), 0);
      const seconds = Math.min(3600, Math.max(1, Math.ceil((body.exportSettings.videoEnd ?? audioProbe?.duration ?? 0) || subtitleEnd || 10)) + 1);
      videoPath = await generateColorVideo(dims.width, dims.height, seconds, req.user?.id ?? "soundwave-local");
    }

    const audioProbe = await probeMedia(audioPath).catch(() => null);
    const outDuration =
      body.exportSettings.videoEnd ??
      (audioProbe?.duration && audioProbe.duration > 0 ? audioProbe.duration : undefined) ??
      (body.subtitleData.reduce((m, c) => Math.max(m, c.end), 0) || 10);

    const settings: ExportSettings = {
      resolution: dims,
      format: body.exportSettings.format,
      quality: body.exportSettings.quality,
      fps: body.exportSettings.fps,
      watermark: false,
      audioVolume: body.exportSettings.audioVolume,
      fadeIn: body.exportSettings.fadeIn,
      fadeOut: body.exportSettings.fadeOut,
      duration: outDuration > 0 ? outDuration : undefined,
    };

    const job = await store.createJob({
      projectId: body.projectId,
      userId: req.user?.id ?? "soundwave-local",
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
    });

    res.status(202).json({ jobId: job.id, status: "QUEUED" });
  } catch (e) {
    next(e);
  }
});

async function generateColorVideo(width: number, height: number, seconds: number, userId: string): Promise<string> {
  const dir = path.join(config.uploadsDir, "jobs");
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${userId}-bg-${Date.now()}.mp4`);
  const dur = Math.min(3600, Math.max(1, Math.round(seconds)));
  // lavfi color source of just the needed length; the export ends at audio
  // length via -shortest.
  await new Promise<void>((resolve, reject) => {
    const child = spawn(resolveFfmpegPath(), [
      "-y", "-f", "lavfi", "-i", `color=c=0x0A0F1C:s=${width}x${height}:d=${dur}:r=30`,
      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-t", String(dur), out,
    ]);
    child.on("error", reject);
    child.on("close", (code: number) => (code === 0 ? resolve() : reject(new Error("Background generation failed"))));
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
    try {
      if (params.videoPath.includes("-bg-")) fs.unlinkSync(params.videoPath);
    } catch { /* ignore */ }
  }
}

function emitJob(jobId: string, payload: Record<string, unknown>): void {
  jobEvents.emit(jobId, payload);
}

function isLocalAutomationUser(uid?: string | null): boolean {
  if (!uid) return false;
  return uid === "agent-local" || uid === "soundwave-local" || uid === "soundwave-agent" || uid === "jarvis-local";
}

// ── Job status ──────────────────────────────────────────────────────────────
// Allow local automation jobs (one-click endpoint) without auth — otherwise require auth
router.get("/jobs/:jobId", optionalAuth, async (req, res, next) => {
  try {
    const store = await getStore();
    const jobId = req.params.jobId ?? "";
    let job = await store.getJob(jobId, "agent-local");
    if (!job) job = await store.getJob(jobId, "soundwave-local");
    if (!job) job = await store.getJob(jobId, "soundwave-agent");
    if (!job) job = await store.getJob(jobId, "jarvis-local");
    if (!job && req.user) {
      job = await store.getJob(jobId, req.user.id);
    }
    // Fallback: try to find job without user check
    if (!job) {
      try {
        const all = await (store as any).getJobById?.(jobId);
        if (all) job = all;
      } catch {}
    }
    if (!job) {
      const uid = req.user?.id ?? "agent-local";
      job = await store.getJob(jobId, uid);
    }
    if (!job) throw new ApiError(404, "NOT_FOUND", "Export job not found.");
    // If job belongs to someone else and request is not that user and not a local job, block
    if (!isLocalAutomationUser(job.userId) && req.user && job.userId !== req.user.id) {
      throw new ApiError(403, "FORBIDDEN", "Not your export job.");
    }
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
router.get("/jobs/:jobId/events", optionalAuth, async (req, res, next) => {
  try {
    const store = await getStore();
    const jobId = req.params.jobId ?? "";
    let job = await store.getJob(jobId, "agent-local");
    if (!job) job = await store.getJob(jobId, "soundwave-local");
    if (!job) job = await store.getJob(jobId, "soundwave-agent");
    if (!job) job = await store.getJob(jobId, "jarvis-local");
    if (!job && req.user) job = await store.getJob(jobId, req.user.id);
    if (!job) {
      try {
        const all = await (store as any).getJobById?.(jobId);
        if (all) job = all;
      } catch {}
    }
    if (!job) {
      const uid = req.user?.id ?? "agent-local";
      job = await store.getJob(jobId, uid);
    }
    if (!job) throw new ApiError(404, "NOT_FOUND", "Export job not found.");

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const send = (data: Record<string, unknown>) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    send({ status: job.status, progress: job.progress, outputUrl: job.outputUrl });

    const onUpdate = (payload: Record<string, unknown>) => {
      send(payload);
      if (payload.status === "COMPLETED" || payload.status === "FAILED") {
        jobEvents.removeListener(job.id, onUpdate);
        res.end();
      }
    };
    jobEvents.on(job.id, onUpdate);

    req.on("close", () => jobEvents.removeListener(job.id, onUpdate));
    const hb = setInterval(() => res.write(`: hb\n\n`), 15000);
    res.on("close", () => clearInterval(hb));
  } catch (e) {
    next(e);
  }
});

// ── Download ────────────────────────────────────────────────────────────────
// Allow local automation downloads without auth cookie
router.get("/jobs/:jobId/download", optionalAuth, async (req, res, next) => {
  try {
    const store = await getStore();
    const jobId = req.params.jobId ?? "";
    let job = await store.getJob(jobId, "agent-local");
    if (!job) job = await store.getJob(jobId, "soundwave-local");
    if (!job) job = await store.getJob(jobId, "soundwave-agent");
    if (!job) job = await store.getJob(jobId, "jarvis-local");
    if (!job && req.user) job = await store.getJob(jobId, req.user.id);
    if (!job) {
      try {
        const all = await (store as any).getJobById?.(jobId);
        if (all) job = all;
      } catch {}
    }
    if (!job) {
      const uid = req.user?.id ?? "agent-local";
      job = await store.getJob(jobId, uid);
    }
    if (!job) throw new ApiError(404, "NOT_FOUND", "Export job not found.");
    if (job.status !== "COMPLETED" || !job.outputUrl) {
      throw new ApiError(400, "NOT_READY", "This export is not ready for download yet.");
    }
    const ext = (job.settings as { format?: string })?.format === "webm" ? ".webm" : ".mp4";
    const candidates = [
      path.join(config.uploadsDir, "jobs", `${job.id}${ext}`),
      path.join(config.uploadsDir, `soundwave_short_${job.id}${ext}`),
      path.join(config.uploadsDir, `${job.id}${ext}`),
      path.join(config.uploadsDir, "jobs", `${job.id}.mp4`),
      path.join(config.uploadsDir, `soundwave_short_${job.id}.mp4`),
    ];
    const p = candidates.find((f) => fs.existsSync(f));
    if (!p) throw new ApiError(404, "NOT_FOUND", "Export file expired. Please export again.");

    const isDownload = req.query.download === "1" || req.query.dl === "1";
    if (isDownload) {
      res.setHeader("Content-Disposition", `attachment; filename="soundwave-export-${job.id}${ext}"`);
    } else {
      res.setHeader("Content-Disposition", `inline; filename="soundwave-export-${job.id}${ext}"`);
    }
    res.setHeader("Content-Type", ext === ".webm" ? "video/webm" : "video/mp4");
    res.sendFile(path.resolve(p));
  } catch (e) {
    next(e);
  }
});

export default router;
