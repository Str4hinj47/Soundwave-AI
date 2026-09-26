/**
 * Companion Link — lets the Soundwave Companion connect to a phone,
 * the way heytaby.com pairs its phone web app with the desktop app.
 *
 * - `GET  /api/v1/companion/info`   loopback only → pairing token + LAN base URL
 * - `POST /api/v1/companion/token`  loopback only → rotate the pairing code
 * - `GET  /api/v1/companion/state`  loopback OR valid token → synced state blob
 * - `PUT  /api/v1/companion/state`  loopback OR valid token → store state blob
 *
 * State lives in <dataDir>/companion-state.json (same zero-infra JSON store
 * philosophy as the rest of the product). Token in companion-token.json.
 */
import { Router } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { config } from "../config.js";

const router = Router();

interface PairFile {
  token: string;
  createdAt: number;
}
interface StateFile {
  rev: number;
  updatedAt: number;
  state: Record<string, unknown> | null;
}

const tokenPath = () => path.join(config.dataDir, "companion-token.json");
const statePath = () => path.join(config.dataDir, "companion-state.json");

function ensureDataDir() {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

function readJson<T>(file: string): T | null {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function writeJson(file: string, value: unknown) {
  ensureDataDir();
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

export function getPairToken(): string {
  const existing = readJson<PairFile>(tokenPath());
  if (existing?.token) return existing.token;
  const fresh: PairFile = { token: crypto.randomBytes(18).toString("hex"), createdAt: Date.now() };
  writeJson(tokenPath(), fresh);
  return fresh.token;
}

function rotatePairToken(): string {
  const fresh: PairFile = { token: crypto.randomBytes(18).toString("hex"), createdAt: Date.now() };
  writeJson(tokenPath(), fresh);
  return fresh.token;
}

function isLoopback(req: { socket: { remoteAddress?: string | null } }): boolean {
  const addr = (req.socket.remoteAddress || "").replace(/^::ffff:/, "");
  return addr === "127.0.0.1" || addr === "::1" || addr === "";
}

function tokenMatches(req: {
  socket: { remoteAddress?: string | null };
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, unknown>;
}): boolean {
  if (isLoopback(req)) return true;
  const header = req.headers["x-companion-pair"];
  const query = typeof req.query.pair === "string" ? (req.query.pair as string) : "";
  const provided = (Array.isArray(header) ? header[0] : header) || query;
  if (!provided) return false;
  const expected = getPairToken();
  const a = Buffer.from(String(provided));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** LAN origin (http://192.168.x.x:PORT) for QR codes shown on the desktop. */
export function lanOrigin(): string {
  const ifaces = os.networkInterfaces();
  for (const entries of Object.values(ifaces)) {
    for (const e of entries || []) {
      if (e.family === "IPv4" && !e.internal) {
        return `http://${e.address}`;
      }
    }
  }
  return "http://localhost";
}

router.get("/info", (req, res) => {
  if (!isLoopback(req)) {
    return res.status(403).json({ error: { code: "LOOPBACK_ONLY", message: "info is only available on this computer" } });
  }
  res.json({
    token: getPairToken(),
    lanOrigin: lanOrigin(),
    apiPort: config.port,
    version: "1.0.0",
  });
});

router.post("/token", (req, res) => {
  if (!isLoopback(req)) {
    return res.status(403).json({ error: { code: "LOOPBACK_ONLY", message: "token rotation is only available on this computer" } });
  }
  res.json({ token: rotatePairToken() });
});

router.get("/state", (req, res) => {
  if (!tokenMatches(req)) {
    return res.status(401).json({ error: { code: "BAD_PAIR", message: "Invalid pairing code" } });
  }
  const file = readJson<StateFile>(statePath());
  res.json({
    rev: file?.rev ?? 0,
    updatedAt: file?.updatedAt ?? 0,
    state: file?.state ?? null,
  });
});

router.put("/state", (req, res) => {
  if (!tokenMatches(req)) {
    return res.status(401).json({ error: { code: "BAD_PAIR", message: "Invalid pairing code" } });
  }
  const state = req.body?.state;
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return res.status(400).json({ error: { code: "BAD_STATE", message: "state object is required" } });
  }
  const prev = readJson<StateFile>(statePath());
  const next: StateFile = {
    rev: (prev?.rev ?? 0) + 1,
    updatedAt: Date.now(),
    state: state as Record<string, unknown>,
  };
  writeJson(statePath(), next);
  res.json({ ok: true, rev: next.rev, updatedAt: next.updatedAt });
});

export default router;
