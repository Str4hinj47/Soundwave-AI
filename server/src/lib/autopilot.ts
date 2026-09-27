import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { OrbitalError, getOrbitalStatus, resetOrbitalHistory, type OrbitalStatus } from "./orbitalBackground.js";

// ── Shorts Agent Autopilot ──────────────────────────────────────────────────
// Turns the 1-click short pipeline into a zero-click one: once enabled, the
// agent picks the next niche, writes the script, synthesizes the voice,
// imports an unused Orbital NCG background through our yt-dlp importer,
// renders the 9:16 short (and optionally auto-publishes to YouTube) — then
// waits `intervalMinutes` and does it again. Hands-free, forever, until stopped.
//
// State is persisted to a JSON file so the autopilot survives server restarts
// (it resumes on boot if it was enabled when the process stopped).

export const AUTOPILOT_NICHES = ["psychology", "facts", "history", "finance", "ai", "motivation", "horror"] as const;
export type AutopilotNiche = (typeof AUTOPILOT_NICHES)[number];

export interface AutopilotConfig {
  intervalMinutes: number;
  niches: string[];
  voice: string;
  resolution: "720p" | "1080p";
  autoPublishYouTube: boolean;
  youtubePrivacy: "public" | "unlisted" | "private";
  /** When the Orbital catalog is exhausted: reset history and reuse videos (true)
   *  or pause until the user resets manually (false, default). */
  reuseBackgrounds: boolean;
  /** Stop the autopilot after this many consecutive failed shorts. */
  maxConsecutiveFailures: number;
}

export interface AutopilotHistoryEntry {
  ts: string;
  niche: string;
  jobId: string | null;
  status: "COMPLETED" | "FAILED";
  videoUrl?: string;
  youtubeUrl?: string;
  durationSec?: number;
  backgroundTitle?: string;
  error?: string;
}

export interface AutopilotState {
  enabled: boolean;
  /** Short currently being produced (null while waiting for the next tick). */
  current: { niche: string; jobId: string | null; startedAt: string } | null;
  /** ISO time of the next scheduled short while waiting. */
  nextRunAt: string | null;
  /** Why the loop is paused even though enabled (e.g. backgrounds exhausted). */
  pausedReason: string | null;
  consecutiveFailures: number;
  producedTotal: number;
  failedTotal: number;
}

export interface AutopilotStatus {
  state: AutopilotState;
  config: AutopilotConfig;
  history: AutopilotHistoryEntry[];
  orbital: OrbitalStatus;
}

const DEFAULT_CONFIG: AutopilotConfig = {
  intervalMinutes: 60,
  niches: [...AUTOPILOT_NICHES],
  voice: "en-US-ChristopherNeural",
  resolution: "720p",
  autoPublishYouTube: false,
  youtubePrivacy: "unlisted",
  reuseBackgrounds: false,
  maxConsecutiveFailures: 3,
};

const HISTORY_LIMIT = 100;

// ── Persistence ────────────────────────────────────────────────────────────
interface Persisted {
  enabled: boolean;
  config: AutopilotConfig;
  history: AutopilotHistoryEntry[];
  producedTotal: number;
  failedTotal: number;
}

function statePath(): string {
  return path.join(config.dataDir, "agent", "autopilot.json");
}

function loadPersisted(): Persisted {
  try {
    const raw = fs.readFileSync(statePath(), "utf8");
    const p = JSON.parse(raw) as Partial<Persisted>;
    return {
      enabled: p.enabled === true,
      config: { ...DEFAULT_CONFIG, ...(p.config ?? {}) },
      history: Array.isArray(p.history) ? p.history.slice(0, HISTORY_LIMIT) : [],
      producedTotal: typeof p.producedTotal === "number" ? p.producedTotal : 0,
      failedTotal: typeof p.failedTotal === "number" ? p.failedTotal : 0,
    };
  } catch {
    return { enabled: false, config: { ...DEFAULT_CONFIG }, history: [], producedTotal: 0, failedTotal: 0 };
  }
}

function persist(p: Persisted): void {
  try {
    fs.mkdirSync(path.dirname(statePath()), { recursive: true });
    const tmp = `${statePath()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(p, null, 2), "utf8");
    fs.renameSync(tmp, statePath());
  } catch (e) {
    console.warn("[autopilot] could not persist state:", e);
  }
}

// ── In-memory driver ───────────────────────────────────────────────────────
interface Driver {
  enabled: boolean;
  config: AutopilotConfig;
  history: AutopilotHistoryEntry[];
  producedTotal: number;
  failedTotal: number;
  current: AutopilotState["current"];
  nextRunAt: string | null;
  pausedReason: string | null;
  consecutiveFailures: number;
  nicheIdx: number;
  timer: NodeJS.Timeout | null;
  tickRunning: boolean;
}

const persisted0 = loadPersisted();
const driver: Driver = {
  enabled: persisted0.enabled,
  config: persisted0.config,
  history: persisted0.history,
  producedTotal: persisted0.producedTotal,
  failedTotal: persisted0.failedTotal,
  current: null,
  nextRunAt: null,
  pausedReason: null,
  consecutiveFailures: 0,
  nicheIdx: 0,
  timer: null,
  tickRunning: false,
};

function save(): void {
  persist({
    enabled: driver.enabled,
    config: driver.config,
    history: driver.history.slice(0, HISTORY_LIMIT),
    producedTotal: driver.producedTotal,
    failedTotal: driver.failedTotal,
  });
}

function log(entry: AutopilotHistoryEntry): void {
  driver.history.unshift(entry);
  if (driver.history.length > HISTORY_LIMIT) driver.history.length = HISTORY_LIMIT;
}

function schedule(delayMs: number): void {
  if (driver.timer) clearTimeout(driver.timer);
  driver.nextRunAt = new Date(Date.now() + delayMs).toISOString();
  driver.timer = setTimeout(() => void tick(), delayMs);
  driver.timer.unref?.();
}

function nextNiche(): string {
  const list = driver.config.niches.filter((n) => n.trim().length > 0);
  const niches = list.length > 0 ? list : [...AUTOPILOT_NICHES];
  const niche = niches[driver.nicheIdx % niches.length]!;
  driver.nicheIdx += 1;
  return niche;
}

async function produceOne(niche: string): Promise<AutopilotHistoryEntry> {
  // Lazy import: the pipeline lives in the routes module and pulls in half
  // the server; loading it here only when needed keeps cold boot fast.
  const { buildShortVideo } = await import("../routes/agentShort.js");
  const result = await buildShortVideo({
    topic: niche,
    voice: driver.config.voice,
    resolution: driver.config.resolution,
    userId: "agent-autopilot",
    autoPublishYouTube: driver.config.autoPublishYouTube,
    youtubePrivacy: driver.config.youtubePrivacy,
  });
  return {
    ts: new Date().toISOString(),
    niche,
    jobId: result.jobId,
    status: "COMPLETED",
    videoUrl: result.downloadUrl ?? result.videoUrl,
    youtubeUrl: result.youtubeUrl,
    durationSec: Math.round(result.duration ?? 0),
    backgroundTitle: result.background?.title,
  };
}

async function tick(): Promise<void> {
  if (!driver.enabled || driver.tickRunning) return;
  driver.tickRunning = true;
  driver.nextRunAt = null;
  const niche = nextNiche();
  driver.current = { niche, jobId: null, startedAt: new Date().toISOString() };

  try {
    let entry: AutopilotHistoryEntry;
    try {
      entry = await produceOne(niche);
    } catch (err) {
      // Background catalog exhausted → either self-heal (reuse) and retry
      // once, or pause with a clear reason for the UI to surface.
      if (err instanceof OrbitalError && err.code === "ORBITAL_EXHAUSTED") {
        if (driver.config.reuseBackgrounds) {
          resetOrbitalHistory();
          entry = await produceOne(niche);
        } else {
          driver.pausedReason =
            "All unused Orbital NCG backgrounds are exhausted. Enable background reuse or reset Orbital history to continue.";
          throw err;
        }
      } else {
        throw err;
      }
    }

    driver.producedTotal += 1;
    driver.consecutiveFailures = 0;
    driver.pausedReason = null;
    log(entry);
    console.log(`[autopilot] short complete (${niche}) job=${entry.jobId} ${entry.videoUrl ?? ""}`);
  } catch (err: any) {
    driver.failedTotal += 1;
    driver.consecutiveFailures += 1;
    const message = err instanceof Error ? err.message : String(err);
    log({ ts: new Date().toISOString(), niche, jobId: null, status: "FAILED", error: message });
    console.warn(`[autopilot] short failed (${niche}): ${message}`);
    if (driver.consecutiveFailures >= driver.config.maxConsecutiveFailures) {
      driver.enabled = false;
      driver.pausedReason = `Stopped after ${driver.consecutiveFailures} consecutive failures. Last error: ${message}`;
      driver.current = null;
      driver.nextRunAt = null;
      if (driver.timer) clearTimeout(driver.timer);
      save();
      driver.tickRunning = false;
      return;
    }
  } finally {
    driver.current = null;
  }

  save();
  driver.tickRunning = false;
  if (driver.enabled && !driver.pausedReason) {
    schedule(Math.max(1, driver.config.intervalMinutes) * 60_000);
  }
}

// ── Public API ─────────────────────────────────────────────────────────────
export function getAutopilotStatus(): AutopilotStatus {
  return {
    state: {
      enabled: driver.enabled,
      current: driver.current,
      nextRunAt: driver.nextRunAt,
      pausedReason: driver.pausedReason,
      consecutiveFailures: driver.consecutiveFailures,
      producedTotal: driver.producedTotal,
      failedTotal: driver.failedTotal,
    },
    config: { ...driver.config, niches: [...driver.config.niches] },
    history: driver.history.slice(0, 25),
    orbital: getOrbitalStatus(),
  };
}

export function startAutopilot(patch: Partial<AutopilotConfig>, opts: { startImmediately?: boolean } = {}): AutopilotStatus {
  driver.config = { ...driver.config, ...patch };
  if (driver.config.niches.length === 0) driver.config.niches = [...AUTOPILOT_NICHES];
  driver.enabled = true;
  driver.pausedReason = null;
  driver.consecutiveFailures = 0;
  save();
  if (opts.startImmediately !== false) {
    void tick();
  } else if (!driver.tickRunning) {
    schedule(Math.max(1, driver.config.intervalMinutes) * 60_000);
  }
  return getAutopilotStatus();
}

export function stopAutopilot(): AutopilotStatus {
  driver.enabled = false;
  driver.pausedReason = null;
  driver.nextRunAt = null;
  if (driver.timer) {
    clearTimeout(driver.timer);
    driver.timer = null;
  }
  // An in-flight render is allowed to finish; no new short will start.
  save();
  return getAutopilotStatus();
}

export function clearAutopilotHistory(): void {
  driver.history = [];
  save();
}

/** Called once at server boot: resume the loop if it was enabled at shutdown. */
export function resumeAutopilotIfEnabled(): void {
  if (!driver.enabled) return;
  console.log("[autopilot] resuming after restart — next short starts in 30s");
  schedule(30_000);
}
