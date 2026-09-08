import { Router } from "express";
import { VOICES, getVoice } from "../lib/voices.js";
import { ApiError } from "../middleware/error.js";

const router = Router();

// Voice metadata list (NOT model weights — those are fetched by the browser
// directly from the Hugging Face CDN).
router.get("/", (_req, res) => {
  res.json({ voices: VOICES });
});

router.get("/:voiceId/sample", (req, res, next) => {
  const voice = getVoice(req.params.voiceId ?? "");
  if (!voice) return next(new ApiError(404, "NOT_FOUND", "Voice not found."));
  res.json({ voiceId: voice.id, url: voice.sampleUrl });
});

export default router;
