import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { optionalAuth } from "../middleware/auth.js";
import {
  AUTOPILOT_NICHES,
  clearAutopilotHistory,
  getAutopilotStatus,
  startAutopilot,
  stopAutopilot,
} from "../lib/autopilot.js";

// ── Shorts Agent Autopilot API ─────────────────────────────────────────────
// Zero-click automation on top of the 1-click short pipeline: enable it and
// the agent scripts, voices, backgrounds (unused Orbital NCG video through the
// yt-dlp importer), renders and optionally publishes shorts by itself on an
// interval — no user action required until it's stopped.

const router = Router();

const startSchema = z.object({
  intervalMinutes: z.number().int().min(5).max(720).optional(),
  niches: z.array(z.enum(AUTOPILOT_NICHES)).min(1).optional(),
  voice: z.string().min(2).max(100).optional(),
  resolution: z.enum(["720p", "1080p"]).optional(),
  autoPublishYouTube: z.boolean().optional(),
  youtubePrivacy: z.enum(["public", "unlisted", "private"]).optional(),
  reuseBackgrounds: z.boolean().optional(),
  maxConsecutiveFailures: z.number().int().min(1).max(10).optional(),
  /** Kick off the first short right away (default) or wait one interval. */
  startImmediately: z.boolean().optional(),
});

router.get("/autopilot", optionalAuth, (_req, res) => {
  res.json(getAutopilotStatus());
});

router.post("/autopilot/start", optionalAuth, validate({ body: startSchema }), (req, res) => {
  const { startImmediately, ...patch } = req.body as z.infer<typeof startSchema>;
  const status = startAutopilot(patch, { startImmediately });
  res.json(status);
});

router.post("/autopilot/stop", optionalAuth, (_req, res) => {
  res.json(stopAutopilot());
});

router.post("/autopilot/clear-history", optionalAuth, (_req, res) => {
  clearAutopilotHistory();
  res.json(getAutopilotStatus());
});

export default router;
