import "dotenv/config";
import path from "node:path";

const env = process.env;

function str(key: string, fallback: string): string {
  return env[key] && env[key]!.length > 0 ? env[key]! : fallback;
}

function int(key: string, fallback: number): number {
  const v = parseInt(env[key] ?? "", 10);
  return Number.isFinite(v) ? v : fallback;
}

export const config = {
  env: env.NODE_ENV ?? "development",
  isProd: (env.NODE_ENV ?? "development") === "production",
  port: int("PORT", 4000),
  appUrl: str("APP_URL", "http://localhost:5173"),
  databaseUrl: str("DATABASE_URL", ""),
  // In production these MUST be present (validated at startup).
  jwtAccessSecret: str("JWT_ACCESS_SECRET", "dev-access-secret-change-me"),
  jwtRefreshSecret: str("JWT_REFRESH_SECRET", "dev-refresh-secret-change-me"),
  jwtAccessTtl: str("JWT_ACCESS_TTL", "15m"),
  jwtRefreshTtl: str("JWT_REFRESH_TTL", "7d"),
  corsOrigins: (env.CORS_ORIGINS ?? env.APP_URL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  emailFrom: str("EMAIL_FROM", "Soundwave AI <no-reply@soundwave.ai>"),
  resendApiKey: str("RESEND_API_KEY", ""),
  googleClientId: str("GOOGLE_CLIENT_ID", ""),
  googleClientSecret: str("GOOGLE_CLIENT_SECRET", ""),
  githubClientId: str("GITHUB_CLIENT_ID", ""),
  githubClientSecret: str("GITHUB_CLIENT_SECRET", ""),
  stripeSecretKey: str("STRIPE_SECRET_KEY", ""),
  stripeWebhookSecret: str("STRIPE_WEBHOOK_SECRET", ""),
  ffmpegPath: str("FFMPEG_PATH", ""),
  dataDir: str("DATA_DIR", path.join(process.cwd(), "data")),
  uploadsDir: str("UPLOADS_DIR", path.join(process.cwd(), "uploads")),
} as const;

const REQUIRED_PROD = [
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "DATABASE_URL",
];

const REQUIRED_DEV: string[] = [];

/** Validate config — crash in prod if critical secrets are missing, warn in dev. */
export function validateConfig(): void {
  const required = config.isProd ? REQUIRED_PROD : REQUIRED_DEV;
  const missing = required.filter((k) => !env[k] || env[k]!.length === 0);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  // In development, warn if using default JWT secrets but don't crash — allow zero-config demo.
  if (!config.isProd) {
    const defaultAccess = "dev-access-secret-change-me";
    const defaultRefresh = "dev-refresh-secret-change-me";
    if (config.jwtAccessSecret === defaultAccess || config.jwtRefreshSecret === defaultRefresh) {
      console.warn("[soundwave] WARNING: Using default JWT secrets in development. Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET in .env for better security.");
    }
  } else {
    // In production, ensure secrets are not defaults and are strong.
    if (config.jwtAccessSecret.length < 32 || config.jwtRefreshSecret.length < 32) {
      throw new Error("JWT secrets must be at least 32 characters in production.");
    }
  }
}

/** Resolve the FFmpeg binary path (env override → vendored static binary → PATH). */
export function resolveFfmpegPath(): string {
  if (config.ffmpegPath) return config.ffmpegPath;
  const candidates = [
    path.join(process.cwd(), "..", "vendor", "ffmpeg", "ffmpeg"),
    path.join(process.cwd(), "vendor", "ffmpeg", "ffmpeg"),
    "/usr/bin/ffmpeg",
  ];
  for (const c of candidates) {
    if (existsSyncSafe(c)) return c;
  }
  return "ffmpeg";
}

import { existsSync } from "node:fs";
function existsSyncSafe(p: string): boolean {
  try {
    return existsSync(p);
  } catch {
    return false;
  }
}