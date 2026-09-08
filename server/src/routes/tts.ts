import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";
import { usageLimiter } from "../lib/security.js";
import { getStore } from "../lib/store.js";
import { PLANS } from "../lib/plans.js";
import { getVoice } from "../lib/voices.js";
import { synthesizeEdgeTTS } from "../lib/edgeTts.js";

const router = Router();

// ── Quota helper ────────────────────────────────────────────────────────────
// Enforced server-side. The client only reports character counts AFTER
// generation completes; the TTS text itself is never transmitted.
export async function getQuotaFor(userId: string) {
  const store = await getStore();
  const user = await store.findUserById(userId);
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "User not found.");
  const limit = PLANS[user.plan].characterLimit;
  const resetDate = new Date(user.characterResetDate);
  const now = new Date();
  let used = user.charactersUsedThisMonth;
  if (now >= resetDate) {
    // New billing month — reset.
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    used = 0;
    await store.updateUser(userId, { charactersUsedThisMonth: 0, characterResetDate: next.toISOString() });
  }
  return { used, limit, resetDate: resetDate.toISOString(), plan: user.plan, allowed: used < limit };
}

router.get("/quota", requireAuth, async (req, res, next) => {
  try {
    res.json(await getQuotaFor(req.user!.id));
  } catch (e) {
    next(e);
  }
});

const usageSchema = z.object({
  voiceId: z.string().min(1).max(64),
  characterCount: z.number().int().min(1).max(10_000), // max single-report bound
  audioDurationSeconds: z.number().min(0).max(86_400),
});

const synthesizeSchema = z.object({
  text: z.string().min(1).max(5000),
  voice: z.string().min(1).max(64),
  speed: z.number().min(0.5).max(2).optional(),
  pitch: z.number().min(-50).max(50).optional(),
  volume: z.number().min(0).max(100).optional(),
});

// ── Server-side synthesis via Microsoft Edge Neural voices ──────────────────
// Returns MP3 audio (base64) + word timings. Quota is enforced here.
router.post("/synthesize", requireAuth, usageLimiter, validate({ body: synthesizeSchema }), async (req, res, next) => {
  try {
    const { text, voice, speed, pitch, volume } = req.body as z.infer<typeof synthesizeSchema>;
    const voiceMeta = getVoice(voice);
    if (!voiceMeta) throw new ApiError(400, "INVALID_VOICE", "Unknown voice. Choose one of the supported Microsoft Neural voices.");

    const store = await getStore();
    const quota = await getQuotaFor(req.user!.id);
    const characters = text.length;
    if (quota.used + characters > quota.limit) {
      const err = new ApiError(403, "QUOTA_EXCEEDED", "You've reached your monthly character limit. Upgrade to Pro for more.");
      throw err;
    }

    const result = await synthesizeEdgeTTS({ text, voice, speed, pitch, volume });

    await store.addUsageLog({
      userId: req.user!.id,
      characterCount: characters,
      voiceId: voice,
      audioDurationSeconds: Math.max(1, Math.round(result.duration)),
      generatedAt: new Date().toISOString(),
    });
    await store.updateUser(req.user!.id, {
      charactersUsedThisMonth: quota.used + characters,
      totalAudioDurationSeconds: req.user!.totalAudioDurationSeconds + Math.round(result.duration),
    });

    res.json({
      audioBase64: result.audioBase64,
      mimeType: result.mimeType,
      duration: result.duration,
      wordTimings: result.wordTimings,
      voiceId: voice,
      used: quota.used + characters,
      limit: quota.limit,
      resetDate: quota.resetDate,
    });
  } catch (e) {
    next(e);
  }
});

// Client-side usage reporting — kept for the offline fallback engine.
router.post("/usage", requireAuth, usageLimiter, validate({ body: usageSchema }), async (req, res, next) => {
  try {
    const { voiceId, characterCount, audioDurationSeconds } = req.body as z.infer<typeof usageSchema>;
    const store = await getStore();
    const quota = await getQuotaFor(req.user!.id);

    if (quota.used + characterCount > quota.limit) {
      return res.status(403).json({
        allowed: false,
        code: "QUOTA_EXCEEDED",
        used: quota.used,
        limit: quota.limit,
        resetDate: quota.resetDate,
      });
    }

    await store.addUsageLog({
      userId: req.user!.id,
      characterCount,
      voiceId,
      audioDurationSeconds,
      generatedAt: new Date().toISOString(),
    });
    const updated = await store.updateUser(req.user!.id, {
      charactersUsedThisMonth: quota.used + characterCount,
      totalAudioDurationSeconds: req.user!.totalAudioDurationSeconds + audioDurationSeconds,
    });
    res.json({ allowed: true, used: updated!.charactersUsedThisMonth, limit: quota.limit, resetDate: quota.resetDate });
  } catch (e) {
    next(e);
  }
});

export default router;
