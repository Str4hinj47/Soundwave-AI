import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { optionalAuth } from "../middleware/auth.js";
import { youtubeService, type YouTubeConfig } from "../lib/youtube.js";
import { config } from "../config.js";
import { ConnectError, startYouTubeConnect, YOUTUBE_SCOPES } from "../lib/youtubeOAuth.js";
import { notFromApp } from "../middleware/localApp.js";

const router = Router();

// GET /api/v1/youtube/status
router.get("/status", (_req, res) => {
  const cfg = youtubeService.getConfig();
  const isConnected = !!(cfg.clientId && cfg.clientSecret && cfg.refreshToken);
  res.json({
    connected: isConnected,
    configured: isConnected,
    channelTitle: cfg.channelTitle || null,
    channelId: cfg.channelId || null,
    autoPublish: cfg.autoPublish,
    defaultPrivacy: cfg.defaultPrivacy,
    defaultTags: cfg.defaultTags,
    titleSuffix: cfg.titleSuffix,
    hasClientId: !!cfg.clientId,
    hasClientSecret: !!cfg.clientSecret,
    hasRefreshToken: !!cfg.refreshToken,
  });
});

// POST /api/v1/youtube/config
const configSchema = z.object({
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  refreshToken: z.string().optional(),
  autoPublish: z.boolean().optional(),
  defaultPrivacy: z.enum(["public", "unlisted", "private"]).optional(),
  defaultTags: z.array(z.string()).optional(),
  titleSuffix: z.string().optional(),
});

router.post("/config", optionalAuth, validate({ body: configSchema }), (req, res) => {
  const updates = req.body as Partial<YouTubeConfig>;
  const updated = youtubeService.saveConfig(updates);
  const isConnected = !!(updated.clientId && updated.clientSecret && updated.refreshToken);
  res.json({
    ok: true,
    status: {
      connected: isConnected,
      configured: isConnected,
      channelTitle: updated.channelTitle,
      autoPublish: updated.autoPublish,
      defaultPrivacy: updated.defaultPrivacy,
      defaultTags: updated.defaultTags,
    },
    connected: isConnected,
    configured: isConnected,
    channelTitle: updated.channelTitle,
    autoPublish: updated.autoPublish,
    defaultPrivacy: updated.defaultPrivacy,
    defaultTags: updated.defaultTags,
  });
});

// POST /api/v1/youtube/test - Test credentials and update channel info
router.post("/test", async (_req, res) => {
  const result = await youtubeService.testConnection();
  res.json(result);
});

// POST /api/v1/youtube/upload - Manually upload a rendered short
const uploadSchema = z.object({
  jobId: z.string().optional(),
  videoUrl: z.string().optional(),
  title: z.string().min(1).max(100),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  privacy: z.enum(["public", "unlisted", "private"]).optional(),
});

router.post("/upload", optionalAuth, validate({ body: uploadSchema }), async (req, res) => {
  try {
    const { jobId, videoUrl, title, description, tags, privacy } = req.body;

    // Locate the physical MP4 video file
    let targetPath: string | null = null;

    if (jobId) {
      const candidates = [
        path.join(config.uploadsDir, "jobs", `${jobId}.mp4`),
        path.join(config.uploadsDir, `soundwave_short_${jobId}.mp4`),
        path.join(config.uploadsDir, `${jobId}.mp4`),
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          targetPath = c;
          break;
        }
      }
    }

    if (!targetPath && videoUrl) {
      // e.g. /api/v1/export/jobs/<id>/download
      const idMatch = videoUrl.match(/jobs\/([a-zA-Z0-9_-]+)/);
      if (idMatch) {
        const id = idMatch[1];
        const candidates = [
          path.join(config.uploadsDir, "jobs", `${id}.mp4`),
          path.join(config.uploadsDir, `soundwave_short_${id}.mp4`),
          path.join(config.uploadsDir, `${id}.mp4`),
        ];
        for (const c of candidates) {
          if (fs.existsSync(c)) {
            targetPath = c;
            break;
          }
        }
      }
    }

    if (!targetPath) {
      // Find latest completed short video in uploads
      const files = fs.readdirSync(config.uploadsDir)
        .filter((f) => f.endsWith(".mp4") && f.startsWith("soundwave_short_"))
        .sort((a, b) => fs.statSync(path.join(config.uploadsDir, b)).mtimeMs - fs.statSync(path.join(config.uploadsDir, a)).mtimeMs);
      if (files.length > 0) {
        targetPath = path.join(config.uploadsDir, files[0]!);
      }
    }

    if (!targetPath || !fs.existsSync(targetPath)) {
      return res.status(404).json({ error: "Video file not found for upload. Please render a short first." });
    }

    const uploadResult = await youtubeService.uploadShort({
      videoPath: targetPath,
      title,
      description,
      tags,
      privacy,
    });

    res.json({
      ok: true,
      ...uploadResult,
    });
  } catch (err: any) {
    console.error("[YouTubeRoute] Upload error:", err);
    res.status(500).json({ error: err.message || "YouTube upload failed" });
  }
});

// POST /api/v1/youtube/connect — the Google sign-in address for "Connect YouTube account"
// (the app opens it in the browser; Google comes back to this server, see app.ts).
router.post("/connect", (req, res) => {
  const problem = notFromApp(req);
  if (problem) return res.status(403).json({ error: { code: "FORBIDDEN", message: problem } });
  try {
    const port = req.socket.localPort ?? config.port;
    res.json(startYouTubeConnect(port));
  } catch (err) {
    if (err instanceof ConnectError) return res.status(409).json({ error: { code: err.code, message: err.message } });
    throw err;
  }
});

// GET /api/v1/youtube/oauth-guide — the short version of the guide (the agent explains it in detail).
router.get("/oauth-guide", (_req, res) => {
  res.json({
    steps: [
      "1. Open console.cloud.google.com with the Google account that owns your channel and create a project.",
      "2. APIs & Services → Library → YouTube Data API v3 → Enable.",
      "3. Google Auth platform → Get started: app name, your email, Audience: External, agree → Create.",
      "4. Google Auth platform → Audience → Test users → add your Gmail (or press Publish app to avoid re-connecting every 7 days).",
      "5. Google Auth platform → Clients → Create client → Desktop app → copy the Client ID and Client secret.",
      "6. In Soundwave: Command Center → gear → YouTube API & Shorts → paste both → Save API Keys → Connect YouTube account.",
    ],
    note: "New Google Cloud projects upload as Private until YouTube's API audit approves them.",
    scope: YOUTUBE_SCOPES.join(" "),
    requiredScopes: YOUTUBE_SCOPES,
  });
});

export default router;
