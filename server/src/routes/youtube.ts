import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { optionalAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { youtubePublisher } from "../lib/youtubePublisher.js";
import { config } from "../config.js";

const router = Router();

// GET /api/v1/youtube/status
router.get("/status", optionalAuth, (_req, res) => {
  const conf = youtubePublisher.getConfig();
  res.json({
    ok: true,
    connected: conf.connected,
    clientId: conf.clientId ? `${conf.clientId.slice(0, 12)}...` : "",
    hasClientId: Boolean(conf.clientId),
    hasClientSecret: Boolean(conf.clientSecret),
    hasRefreshToken: Boolean(conf.refreshToken),
    channelTitle: conf.channelTitle,
    channelId: conf.channelId,
    subscriberCount: conf.subscriberCount,
    autoPostEnabled: conf.autoPostEnabled,
    defaultPrivacy: conf.defaultPrivacy,
    totalUploads: conf.totalUploads,
    lastUploadedAt: conf.lastUploadedAt,
  });
});

// POST /api/v1/youtube/config
const configSchema = z.object({
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  refreshToken: z.string().optional(),
  autoPostEnabled: z.boolean().optional(),
  defaultPrivacy: z.enum(["public", "unlisted", "private"]).optional(),
});

router.post("/config", optionalAuth, validate({ body: configSchema }), (req, res) => {
  try {
    const body = req.body as z.infer<typeof configSchema>;
    const updated = youtubePublisher.saveConfig({
      ...(body.clientId !== undefined && { clientId: body.clientId }),
      ...(body.clientSecret !== undefined && { clientSecret: body.clientSecret }),
      ...(body.refreshToken !== undefined && {
        refreshToken: body.refreshToken,
        connected: Boolean(body.refreshToken),
      }),
      ...(body.autoPostEnabled !== undefined && { autoPostEnabled: body.autoPostEnabled }),
      ...(body.defaultPrivacy !== undefined && { defaultPrivacy: body.defaultPrivacy }),
    });

    res.json({
      ok: true,
      success: true,
      config: {
        connected: updated.connected,
        autoPostEnabled: updated.autoPostEnabled,
        defaultPrivacy: updated.defaultPrivacy,
        channelTitle: updated.channelTitle,
        hasClientId: Boolean(updated.clientId),
        hasRefreshToken: Boolean(updated.refreshToken),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET & POST /api/v1/youtube/auth-url
router.all("/auth-url", optionalAuth, (req, res) => {
  try {
    const redirectUri = (req.query?.redirectUri as string) || req.body?.redirectUri || "http://localhost:5173/agent";
    const authUrl = youtubePublisher.getAuthUrl(redirectUri);
    res.json({ ok: true, url: authUrl, authUrl });
  } catch (err: any) {
    res.status(400).json({ error: err.message, message: err.message });
  }
});

// POST /api/v1/youtube/oauth-callback
router.post("/oauth-callback", optionalAuth, async (req, res) => {
  try {
    const { code, redirectUri } = req.body || {};
    if (!code) {
      return res.status(400).json({ error: "Missing authorization code" });
    }
    const creds = await youtubePublisher.handleOAuthCallback(
      code,
      redirectUri || "http://localhost:5173/agent"
    );
    res.json({
      ok: true,
      success: true,
      channelTitle: creds.channelTitle,
      subscriberCount: creds.subscriberCount,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/youtube/publish
const publishSchema = z.object({
  jobId: z.string().optional(),
  videoPath: z.string().optional(),
  videoUrl: z.string().optional(),
  title: z.string().min(1).max(100),
  description: z.string().max(4000).optional(),
  privacy: z.enum(["public", "unlisted", "private"]).default("public"),
  tags: z.array(z.string()).optional(),
});

router.post("/publish", optionalAuth, validate({ body: publishSchema }), async (req, res) => {
  try {
    const conf = youtubePublisher.getConfig();
    if (!conf.connected && !conf.refreshToken) {
      return res.status(400).json({
        error: "YouTube account is not connected",
        message: "YouTube account is not connected. Link your channel or configure credentials first.",
      });
    }

    const body = req.body as z.infer<typeof publishSchema>;

    let resolvedVideoPath = body.videoPath;
    if (!resolvedVideoPath && body.videoUrl) {
      const jobMatch = body.videoUrl.match(/jobs\/([a-zA-Z0-9_-]+)/);
      if (jobMatch) {
        body.jobId = jobMatch[1];
      }
    }

    if (!resolvedVideoPath && body.jobId) {
      const candidates = [
        path.join(config.uploadsDir, "jobs", `${body.jobId}.mp4`),
        path.join(config.uploadsDir, `soundwave_short_${body.jobId}.mp4`),
        path.join(config.uploadsDir, `${body.jobId}.mp4`),
      ];
      resolvedVideoPath = candidates.find((p) => fs.existsSync(p));
    }

    if (!resolvedVideoPath || !fs.existsSync(resolvedVideoPath)) {
      return res.status(404).json({ error: "Video file for export job not found" });
    }

    const result = await youtubePublisher.uploadShort({
      videoPath: resolvedVideoPath,
      title: body.title,
      description: body.description,
      privacy: body.privacy,
      tags: body.tags,
    });

    res.json({
      ok: true,
      success: true,
      videoId: result.videoId,
      videoUrl: result.videoUrl,
      title: result.title,
    });
  } catch (err: any) {
    console.error("[youtube/publish] Error:", err);
    res.status(500).json({ error: err.message || "Failed to publish video to YouTube" });
  }
});

// POST /api/v1/youtube/disconnect
router.post("/disconnect", optionalAuth, (_req, res) => {
  const conf = youtubePublisher.disconnect();
  res.json({
    ok: true,
    success: true,
    config: {
      connected: conf.connected,
      autoPostEnabled: conf.autoPostEnabled,
      defaultPrivacy: conf.defaultPrivacy,
    },
  });
});

export default router;
