import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "../config.js";

// ── HTTP security headers ───────────────────────────────────────────────────
// TTS is server-side (Microsoft Neural voices), so no WebAssembly, no Web
// Workers, and no model CDN are required on the client — the CSP is tight.
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'"],
      "style-src": ["'self'", "https://fonts.googleapis.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com"],
      "img-src": ["'self'", "data:", "blob:"],
      "media-src": ["'self'", "blob:"],
      "connect-src": ["'self'"],
      "frame-ancestors": ["'none'"],
      "base-uri": ["'self'"],
      "form-action": ["'self'"],
      "object-src": ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  xContentTypeOptions: true,
  xFrameOptions: false, // frame-ancestors 'none' is set in CSP instead
  xXssProtection: false, // deprecated — CSP is the replacement
});

// ── Rate limiting (applied to ALL backend endpoints) ────────────────────────
/**
 * Rate-limit key for anonymous requests.
 *
 * `X-Forwarded-For` is attacker-controlled unless it comes from a trusted
 * proxy, and the first entry in the chain is the one a client can freely
 * forge — using it directly let anyone bypass every limiter by rotating the
 * header. Express already resolves the real client address from the header
 * when `trust proxy` is configured (see app.ts), so `req.ip` is the value to
 * trust here.
 */
const trustIp = (req: { ip?: string }): string => req.ip ?? "unknown";

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Try to get user ID from auth cookies for per-user limiting
    const cookies = req.headers.cookie ?? "";
    const m = cookies.match(/(?:^|;\s*)access_token=([^;]*)/);
    if (m && m[1]) {
      // User is authenticated - key by user identifier (token prefix)
      return `user:${m[1].substring(0, 16)}`;
    }
    return trustIp(req);
  },
  message: { error: { code: "RATE_LIMITED", message: "Too many requests. Please slow down." } },
});

export const authSignupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isProd ? 5 : 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => trustIp(req),
  message: { error: { code: "RATE_LIMITED", message: "Too many sign-up attempts. Try again in 15 minutes." } },
});

export const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isProd ? 10 : 200,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => trustIp(req),
  message: { error: { code: "RATE_LIMITED", message: "Too many login attempts. Try again in 15 minutes." } },
});

export const usageLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => trustIp(req),
  message: { error: { code: "RATE_LIMITED", message: "Too many usage reports." } },
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60, // increased from 5 to 60 per 60s per IP; per-user throttling added in generalLimiter
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => trustIp(req),
  message: { error: { code: "RATE_LIMITED", message: "Upload limit reached. Try again shortly." } },
});