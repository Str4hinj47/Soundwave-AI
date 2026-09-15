import "dotenv/config";
import crypto from "node:crypto";
import path from "node:path";

const env = process.env;

/**
 * Dev convenience: a fresh clone has no `server/.env` (it is git-ignored), so
 * `npm run dev` used to crash on the missing JWT secrets. In development we
 * mint throwaway secrets instead — sessions only survive the process, and a
 * warning points at `.env.example` for persistent logins. Production keeps the
 * strict REQUIRED_PROD validation below.
 */
if ((env.NODE_ENV ?? "development") !== "production") {
  for (const key of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const) {
    if (!env[key] || env[key]!.length === 0) {
      env[key] = `ephemeral-${crypto.randomBytes(24).toString("hex")}`;
      console.warn(
        `[soundwave] ${key} is not set — generated an ephemeral dev secret. ` +
          "Sessions reset on every restart; copy server/.env.example to server/.env " +
          "and set your own values to keep logins across restarts.",
      );
    }
  }
}

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
  corsOrigins: (env.CORS_ORIGINS ?? "")
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
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
];

const REQUIRED_DEV = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];

/** Validate config — crash in dev if JWT secrets are using defaults. */
export function validateConfig(): void {
  const required = config.isProd ? REQUIRED_PROD : REQUIRED_DEV;
  const missing = required.filter((k) => !env[k] || env[k]!.length === 0);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  // In development, ensure JWT secrets are not the default values
  if (!config.isProd) {
    const defaultAccess = "dev-access-secret-change-me";
    const defaultRefresh = "dev-refresh-secret-change-me";
    if (config.jwtAccessSecret === defaultAccess) {
      throw new Error("JWT_ACCESS_SECRET is using the default value. Please set a custom secret in development.");
    }
    if (config.jwtRefreshSecret === defaultRefresh) {
      throw new Error("JWT_REFRESH_SECRET is using the default value. Please set a custom secret in development.");
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