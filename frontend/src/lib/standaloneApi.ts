// ── In-browser API for the single-file standalone build ────────────────────
// Implements just enough of the /api/v1 surface for the full app to run
// without the Node server: a fixed local user (Enterprise perks: 4K, no
// watermark), Edge neural TTS straight from the browser, unlimited quota,
// IndexedDB project storage. Upload/export never leave the browser.

import { idbGet, idbSet } from "./idb";
import { synthesizeBrowserEdge } from "./edgeTtsBrowser";
import { DEFAULT_VOICES } from "./voices";
import type { ProjectMeta, QuotaStatus, UserProfile } from "./types";

const USER_KEY = "sw.standalone.user.v1";
const PROJECTS_KEY = "sw.standalone.projects.v1";

interface StoredUser {
  name: string;
}

async function localUser(): Promise<UserProfile> {
  const stored = (await idbGet<StoredUser>(USER_KEY).catch(() => null)) ?? { name: "Local User" };
  return {
    id: "local-user",
    email: "you@soundwave.local",
    name: stored.name || "Local User",
    plan: "ENTERPRISE",
    avatarUrl: null,
    emailVerified: true,
  };
}

const unlimitedQuota: QuotaStatus = {
  used: 0,
  limit: 2_000_000,
  resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
  plan: "ENTERPRISE",
  allowed: true,
};

async function listProjects(): Promise<ProjectMeta[]> {
  return (await idbGet<ProjectMeta[]>(PROJECTS_KEY).catch(() => null)) ?? [];
}

async function writeProjects(projects: ProjectMeta[]): Promise<void> {
  await idbSet(PROJECTS_KEY, projects.slice(0, 100));
}

class StandaloneApiError extends Error {
  code = "STANDALONE_UNSUPPORTED";
}

function notAvailable(path: string): never {
  throw new StandaloneApiError(
    `"${path}" needs the full server. In the standalone build everything runs in your browser — no accounts, no billing.`,
  );
}

interface StandaloneRequestOptions {
  method?: string;
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
}

let blobSeq = 0;
const blobRegistry = new Map<string, Blob>();

export function standaloneBlobUrl(key: string): string | null {
  const b = blobRegistry.get(key);
  return b ? URL.createObjectURL(b) : null;
}

export async function standaloneApi<T>(path: string, opts: StandaloneRequestOptions): Promise<T> {
  const method = (opts.method ?? "GET").toUpperCase();
  const body = (opts.body ?? {}) as Record<string, unknown>;

  // ── Auth / identity ─────────────────────────────────────────────────────
  if (path === "/auth/session" && method === "GET") return (await localUser()) as T;
  if (path === "/auth/refresh" && method === "POST") return {} as T;
  if (path === "/auth/signout" && method === "POST") return {} as T;
  if (path === "/auth/providers" && method === "GET") return { google: false } as T;

  // ── Plan & usage ─────────────────────────────────────────────────────────
  if (path === "/tts/quota" && method === "GET") return unlimitedQuota as T;
  if (path === "/tts/usage" && method === "POST") return {} as T;
  if (path === "/tts/voices" && method === "GET") return { voices: DEFAULT_VOICES } as T;

  // ── TTS synthesis — same Microsoft edge-tts upstream as the server, via WS ─
  if (path === "/tts/synthesize" && method === "POST") {
    const res = await synthesizeBrowserEdge(
      String(body.text ?? ""),
      String(body.voice ?? "en-US-JennyNeural"),
      { speed: body.speed as number | undefined, pitch: body.pitch as number | undefined, volume: body.volume as number | undefined },
      { signal: opts.signal, timeoutMs: 45_000 },
    );
    return res as unknown as T;
  }

  // ── Projects (the Studio saves here for Pro+ users — store locally) ─────
  if (path === "/projects" && method === "GET") return { projects: await listProjects() } as T;
  if (path === "/projects" && method === "POST") {
    const now = new Date().toISOString();
    const meta = { ...(body as unknown as ProjectMeta) } as ProjectMeta;
    meta.id = meta.id || crypto.randomUUID();
    meta.storageType = "LOCAL";
    meta.createdAt = meta.createdAt || now;
    meta.updatedAt = now;
    const projects = await listProjects();
    projects.unshift(meta);
    await writeProjects(projects);
    return { project: meta } as T;
  }
  const projMatch = path.match(/^\/projects\/([0-9a-f-]+)$/i);
  if (projMatch && method === "DELETE") {
    await writeProjects((await listProjects()).filter((p) => p.id !== projMatch[1]));
    return {} as T;
  }
  if (projMatch && (method === "PATCH" || method === "PUT")) {
    const projects = await listProjects();
    const idx = projects.findIndex((p) => p.id === projMatch[1]);
    if (idx >= 0) {
      projects[idx] = { ...projects[idx]!, ...(body as Partial<ProjectMeta>), updatedAt: new Date().toISOString() };
      await writeProjects(projects);
    }
    return {} as T;
  }

  // ── Profile ──────────────────────────────────────────────────────────────
  if (path === "/user/profile" && method === "PUT") {
    const name = String(body.name ?? "Local User");
    await idbSet(USER_KEY, { name } satisfies StoredUser);
    return (await localUser()) as T;
  }

  // ── Uploads: kept as an in-memory registry so callers don't need to care ──
  if ((path === "/upload/video" || path === "/upload/audio") && method === "POST") {
    const file = opts.formData?.get("file");
    if (!(file instanceof Blob)) throw new StandaloneApiError("No file provided.");
    const key = `${crypto.randomUUID()}${path.endsWith("video") ? ".video" : ".audio"}`;
    blobRegistry.set(key, file);
    void blobSeq++;
    return { fileKey: key, name: "file", size: file.size } as T;
  }

  notAvailable(path);
}
