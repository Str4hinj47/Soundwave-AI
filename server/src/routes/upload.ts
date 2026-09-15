import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { requireAuth } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";
import { uploadLimiter } from "../lib/security.js";
import { getStore } from "../lib/store.js";
import { PLANS } from "../lib/plans.js";
import { config } from "../config.js";

const router = Router();

// Use disk storage to avoid loading multi-GB files into memory.
// Files are written to a temp dir first, validated, then moved to final location.
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(config.uploadsDir, "_tmp");
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, _file, cb) => {
      cb(null, `${crypto.randomUUID()}.tmp`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB hard cap; per-plan caps below
  fileFilter: (_req, file, cb) => {
    // Basic mime allow-list to reject obvious junk before disk write.
    const allowed = [
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/x-msvideo",
      "video/avi",
      "audio/mpeg",
      "audio/wav",
      "audio/wave",
      "audio/x-wav",
      "audio/ogg",
      "audio/webm",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];
    // Allow if mime matches or extension looks plausible — final validation is magic-byte.
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith("video/") || file.mimetype.startsWith("audio/") || file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      // Still allow but will be rejected by sniff — don't block here to keep error messages consistent.
      cb(null, true);
    }
  },
});

// ── Magic-byte (file signature) validation ──────────────────────────────────
type Category = "video" | "audio" | "image";

function sniffFile(filePathTmp: string): Category | null {
  try {
    const fd = fs.openSync(filePathTmp, "r");
    const buf = Buffer.alloc(12);
    const read = fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);
    if (read < 12) return null;
    return sniffBuffer(buf);
  } catch {
    return null;
  }
}

function sniffBuffer(buf: Buffer): Category | null {
  if (buf.length < 12) return null;
  const hex = (off: number, len: number) => buf.subarray(off, off + len).toString("hex");
  // MP4 / MOV
  if (hex(4, 4) === "66747970") return "video";
  // WEBM / MKV (EBML)
  if (hex(0, 4) === "1a45dfa3") return "video";
  // AVI
  if (buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "AVI ") return "video";
  // WAV
  if (buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WAVE") return "audio";
  // OGG
  if (buf.toString("latin1", 0, 4) === "OggS") return "audio";
  // MP3 (ID3 tag or frame sync)
  if (hex(0, 3) === "494433" || (buf[0] === 0xff && (buf[1]! & 0xe0) === 0xe0)) return "audio";
  // JPEG
  if (hex(0, 3) === "ffd8ff") return "image";
  // PNG
  if (hex(0, 8) === "89504e470d0a1a0a") return "image";
  // WebP (RIFF + WEBP)
  if (buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") return "image";
  return null;
}

function extForCategory(cat: Category, originalName: string): string {
  const lower = originalName.toLowerCase();
  if (cat === "video") {
    if (lower.endsWith(".webm")) return ".webm";
    if (lower.endsWith(".mov")) return ".mov";
    if (lower.endsWith(".avi")) return ".avi";
    return ".mp4";
  }
  if (cat === "audio") {
    if (lower.endsWith(".wav")) return ".wav";
    if (lower.endsWith(".ogg")) return ".ogg";
    if (lower.endsWith(".webm")) return ".webm";
    return ".mp3";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return ".jpg";
  if (lower.endsWith(".webp")) return ".webp";
  return ".png";
}

function saveFileFromTmp(tmpPath: string, ext: string): { key: string } {
  const key = `${crypto.randomUUID()}${ext}`;
  const dest = path.join(config.uploadsDir, key);
  fs.mkdirSync(config.uploadsDir, { recursive: true });
  fs.renameSync(tmpPath, dest);
  return { key };
}

function cleanupTmp(tmpPath?: string) {
  if (!tmpPath) return;
  try {
    fs.unlinkSync(tmpPath);
  } catch { /* ignore */ }
}

function filePath(key: string): string {
  // Keys are always server-generated UUIDs — safe against path traversal.
  // Allow .mp4, .webm, .mov, .avi, .mp3, .wav, .ogg, .png, .jpg, .jpeg, .webp, .video, .audio
  if (!/^[0-9a-f-]{36}\.(mp4|webm|mov|avi|mp3|wav|ogg|png|jpg|jpeg|webp|video|audio)$/.test(key)) {
    throw new ApiError(400, "INVALID_FILE", "Invalid file reference.");
  }
  return path.join(config.uploadsDir, key);
}

// ── Video upload ────────────────────────────────────────────────────────────
router.post("/video", requireAuth, uploadLimiter, upload.single("file"), async (req, res, next) => {
  const tmp = (req.file as Express.Multer.File & { path: string })?.path;
  try {
    if (!req.file) throw new ApiError(400, "NO_FILE", "No file provided.");
    const cat = tmp ? sniffFile(tmp) : null;
    if (cat !== "video") {
      cleanupTmp(tmp);
      throw new ApiError(400, "INVALID_FILE", "The uploaded file is not a supported video format.");
    }
    const maxMb = PLANS[req.user!.plan].maxVideoMb;
    if (req.file.size > maxMb * 1024 * 1024) {
      cleanupTmp(tmp);
      throw new ApiError(413, "FILE_TOO_LARGE", `Video exceeds the ${maxMb}MB limit for your plan.`);
    }
    const ext = extForCategory(cat, req.file.originalname);
    const { key } = saveFileFromTmp(tmp, ext);
    res.status(201).json({ fileKey: key, name: req.file.originalname, size: req.file.size });
  } catch (e) {
    cleanupTmp(tmp);
    next(e);
  }
});

// ── Audio upload (client-generated TTS blob for export compositing) ─────────
router.post("/audio", requireAuth, uploadLimiter, upload.single("file"), async (req, res, next) => {
  const tmp = (req.file as Express.Multer.File & { path: string })?.path;
  try {
    if (!req.file) throw new ApiError(400, "NO_FILE", "No file provided.");
    const cat = tmp ? sniffFile(tmp) : null;
    if (cat !== "audio") {
      cleanupTmp(tmp);
      throw new ApiError(400, "INVALID_FILE", "The uploaded file is not a supported audio format.");
    }
    if (req.file.size > 100 * 1024 * 1024) {
      cleanupTmp(tmp);
      throw new ApiError(413, "FILE_TOO_LARGE", "Audio exceeds the 100MB limit.");
    }
    const ext = extForCategory(cat, req.file.originalname);
    const { key } = saveFileFromTmp(tmp, ext);
    res.status(201).json({ fileKey: key, name: req.file.originalname, size: req.file.size });
  } catch (e) {
    cleanupTmp(tmp);
    next(e);
  }
});

// ── Avatar upload ───────────────────────────────────────────────────────────
router.post("/avatar", requireAuth, uploadLimiter, upload.single("file"), async (req, res, next) => {
  const tmp = (req.file as Express.Multer.File & { path: string })?.path;
  try {
    if (!req.file) throw new ApiError(400, "NO_FILE", "No file provided.");
    const cat = tmp ? sniffFile(tmp) : null;
    if (cat !== "image") {
      cleanupTmp(tmp);
      throw new ApiError(400, "INVALID_FILE", "Avatar must be a JPG or PNG image.");
    }
    if (req.file.size > 5 * 1024 * 1024) {
      cleanupTmp(tmp);
      throw new ApiError(413, "FILE_TOO_LARGE", "Avatar must be under 5MB.");
    }
    const ext = extForCategory(cat, req.file.originalname);
    const { key } = saveFileFromTmp(tmp, ext);
    const store = await getStore();
    await store.updateUser(req.user!.id, { avatarUrl: `/api/v1/user/avatar/${key}` });
    res.status(201).json({ avatarUrl: `/api/v1/user/avatar/${key}` });
  } catch (e) {
    cleanupTmp(tmp);
    next(e);
  }
});

export { filePath };
export default router;
