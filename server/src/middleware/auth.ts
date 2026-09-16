import type { NextFunction, Request, RequestHandler, Response } from "express";
import { config } from "../config.js";
import { ApiError } from "./error.js";
import {
  clearAuthCookies,
  createUserSession,
  deviceInfoFromUA,
  randomToken,
  setAuthCookies,
  sha256,
  signAccessToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../lib/auth.js";
import { getStore } from "../lib/store.js";
import type { StoredUser } from "../lib/store.js";
import { PLANS, type Plan } from "../lib/plans.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: StoredUser;
    }
  }
}

function getCookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = req.headers.cookie ?? "";
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

/**
 * CSRF protection for cookie-authenticated state-changing requests
 * (double-submit cookie: the SPA mirrors the readable `csrf_token` cookie into
 * the `X-CSRF-Token` header). Header-authenticated requests — Bearer API keys
 * — are not reachable cross-site and are therefore exempt.
 */
function checkCsrf(req: Request): void {
  const method = req.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return;
  const token = getCookies(req)["csrf_token"];
  const header = req.headers["x-csrf-token"];
  if (!token || typeof header !== "string" || header.length === 0 || header !== token) {
    throw new ApiError(403, "CSRF_FAILED", "Security check failed. Reload the page and try again.");
  }
}

/**
 * Bearer API-key authentication (`Authorization: Bearer sw_…`), used by
 * scripts/CI and the documented Enterprise API. Before this existed the keys
 * could be created, listed and revoked but never used.
 */
async function userFromApiKey(req: Request): Promise<StoredUser | null> {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !/^bearer /i.test(header)) return null;
  const raw = header.slice(7).trim();
  if (!raw.startsWith("sw_")) return null;
  const store = await getStore();
  const key = await store.findApiKeyByHash(sha256(raw));
  if (!key || key.revokedAt) return null;
  if (key.expiresAt && new Date(key.expiresAt).getTime() < Date.now()) return null;
  const user = await store.findUserById(key.userId);
  if (!user) return null;
  // Touch `lastUsedAt` at most once every five minutes — the JSON store
  // rewrites its file on every update.
  const last = key.lastUsedAt ? new Date(key.lastUsedAt).getTime() : 0;
  if (Date.now() - last > 5 * 60 * 1000) {
    await store.updateApiKey(key.id, { lastUsedAt: new Date().toISOString() });
  }
  return user;
}

/** Attempt silent refresh via the refresh-token cookie. */
async function tryRefresh(req: Request, res: Response): Promise<StoredUser | null> {
  const cookies = getCookies(req);
  const token = cookies["refresh_token"];
  if (!token) return null;
  const claims = verifyRefreshToken(token);
  if (!claims) return null;

  const store = await getStore();
  const session = await store.findSessionById(claims.sid);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    await store.deleteSession(session.id);
    return null;
  }
  // The stored token must hash-match; otherwise treat as reuse/theft.
  if (session.refreshTokenHash !== sha256(token)) {
    await store.deleteAllSessionsForUser(claims.sub);
    return null;
  }
  const user = await store.findUserById(claims.sub);
  if (!user) return null;

  // Rotate: delete old session, issue a new one + fresh tokens.
  await store.deleteSession(session.id);
  const bundle = await createUserSession(store, user.id, req.ip ?? "unknown", session.deviceInfo);
  setAuthCookies(res, signAccessToken(user.id), bundle.refreshToken, randomToken(16));
  return user;
}

async function resolveUser(req: Request, res: Response): Promise<StoredUser | null> {
  const cookies = getCookies(req);
  const access = cookies["access_token"];
  if (access) {
    const claims = verifyAccessToken(access);
    if (claims) {
      const store = await getStore();
      const user = await store.findUserById(claims.sub);
      if (user) return user;
    }
  }
  return tryRefresh(req, res);
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const apiKeyUser = await userFromApiKey(req);
    if (apiKeyUser) {
      req.user = apiKeyUser;
      next();
      return;
    }

    // Cookie-authenticated request → CSRF applies, and it is checked *before*
    // the silent refresh below so a cross-site POST can never rotate a
    // victim's session.
    const cookies = getCookies(req);
    if (cookies["access_token"] || cookies["refresh_token"]) {
      if (!cookies["csrf_token"]) {
        // Half-eaten cookie jar (user cleared one cookie by hand): force a
        // clean re-authentication instead of silently skipping the check.
        clearAuthCookies(res);
        throw new ApiError(401, "UNAUTHORIZED", "Your session needs to be refreshed. Please try again.");
      }
      checkCsrf(req);
    }

    const user = await resolveUser(req, res);
    if (!user) {
      clearAuthCookies(res);
      throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    }
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
};

export function requirePlan(min: Plan): RequestHandler {
  const order: Plan[] = ["FREE", "PRO", "ENTERPRISE"];
  return (req, _res, next) => {
    const user = req.user;
    if (!user) return next(new ApiError(401, "UNAUTHORIZED", "Please sign in."));
    if (order.indexOf(user.plan) < order.indexOf(min)) {
      return next(new ApiError(403, "PLAN_REQUIRED", `This feature requires the ${PLANS[min].name} plan.`));
    }
    next();
  };
}

export function deviceInfo(req: Request): string {
  return deviceInfoFromUA(req.headers["user-agent"]);
}

export { config };