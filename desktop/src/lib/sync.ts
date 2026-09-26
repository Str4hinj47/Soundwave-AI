/**
 * Companion Link — sync the companion's state with a phone.
 *
 * The phone opens the same app (dev: `http://<lan>:5174/?phone=1&pair=…`,
 * prod: `http://<lan>:4000/phone?pair=…`). Both sides merge against the
 * JSON blob stored by the API server (`/api/v1/companion/state`), so you
 * can talk to Echo, check tasks and tick habits from your pocket — the
 * way heytaby.com's phone web app works with the desktop app.
 *
 * Merge semantics: union by id, newest timestamp wins per item, tombstones
 * propagate deletions, settings follow `settingsUpdatedAt`.
 */
import { useStore } from "../store";
import type { ChatMsg, Settings, Task, Note, Habit, CalEvent, FocusLog, Tombstone } from "./types";

export interface SyncState {
  settings: Settings;
  settingsUpdatedAt: number;
  tasks: Task[];
  notes: Note[];
  habits: Habit[];
  events: CalEvent[];
  messages: ChatMsg[];
  focusLog: FocusLog[];
  tombstones: Tombstone[];
}

export const PAIR_STORAGE_KEY = "soundwave-pair";

/** API base — Electron (file://) must hit localhost directly; browsers proxy same-origin. */
export function apiBase(): string {
  if (typeof window !== "undefined" && window.location.protocol === "file:") {
    return "http://localhost:4000";
  }
  return "";
}

const itemTs = (x: { updatedAt?: number; completedAt?: number; createdAt?: number; endedAt?: number }) =>
  x.updatedAt ?? x.completedAt ?? x.endedAt ?? x.createdAt ?? 0;

function mergeList<T extends { id: string }>(a: T[] | undefined, b: T[] | undefined, tombstones: Tombstone[]): T[] {
  const byId = new Map<string, T>();
  const dead = new Set(tombstones.filter((t) => t.id).map((t) => t.id));
  for (const list of [a ?? [], b ?? []]) {
    for (const item of list) {
      const prev = byId.get(item.id);
      if (!prev || itemTs(item as any) >= itemTs(prev as any)) byId.set(item.id, item);
    }
  }
  const out: T[] = [];
  for (const item of byId.values()) {
    if (dead.has(item.id)) continue;
    out.push(item);
  }
  return out;
}

/** Pure union merge of two sync states (newest-per-item, tombstones applied). */
export function mergeStates(a: Partial<SyncState> | null | undefined, b: Partial<SyncState> | null | undefined): SyncState {
  const tombstones = [...(a?.tombstones ?? []), ...(b?.tombstones ?? [])];
  // dedupe + prune (>60 days)
  const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
  const seen = new Map<string, number>();
  for (const t of tombstones) {
    if (!t?.id || t.ts < cutoff) continue;
    seen.set(t.id, Math.max(seen.get(t.id) ?? 0, t.ts));
  }
  const mergedTombs: Tombstone[] = [...seen.entries()].map(([id, ts]) => ({ id, ts }));

  const useASettings = (a?.settingsUpdatedAt ?? 0) >= (b?.settingsUpdatedAt ?? 0);
  const settings = (useASettings ? a?.settings : b?.settings) ?? a?.settings ?? b?.settings ?? ({} as Settings);
  const settingsUpdatedAt = Math.max(a?.settingsUpdatedAt ?? 0, b?.settingsUpdatedAt ?? 0);

  const allMsgs = [...(a?.messages ?? []), ...(b?.messages ?? [])];
  const msgById = new Map<string, ChatMsg>();
  for (const m of allMsgs) if (!m.pending) msgById.set(m.id, m);
  const messages = [...msgById.values()].sort((x, y) => x.createdAt - y.createdAt).slice(-80);

  return {
    settings,
    settingsUpdatedAt,
    tasks: mergeList(a?.tasks, b?.tasks, mergedTombs),
    notes: mergeList(a?.notes, b?.notes, mergedTombs),
    habits: mergeList(a?.habits, b?.habits, mergedTombs),
    events: mergeList(a?.events, b?.events, mergedTombs),
    focusLog: mergeList(a?.focusLog, b?.focusLog, mergedTombs),
    messages,
    tombstones: mergedTombs,
  };
}

export function localSnapshot(): SyncState {
  const s = useStore.getState();
  return {
    settings: s.settings,
    settingsUpdatedAt: s.settingsUpdatedAt,
    tasks: s.tasks,
    notes: s.notes,
    habits: s.habits,
    events: s.events,
    messages: s.messages.slice(-80),
    focusLog: s.focusLog,
    tombstones: s.tombstones,
  };
}

export function statesEqual(a: Partial<SyncState>, b: Partial<SyncState>): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/* ── transport ─────────────────────────────────────────────────────────── */

export interface PairInfo {
  token: string;
  lanOrigin: string;
  apiPort: number;
  version: string;
}

async function jsonOrThrow(res: Response): Promise<any> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `request failed (${res.status})`);
  return data;
}

export async function fetchPairInfo(): Promise<PairInfo | null> {
  try {
    const res = await fetch(`${apiBase()}/api/v1/companion/info`, { cache: "no-store" });
    return (await jsonOrThrow(res)) as PairInfo;
  } catch {
    return null;
  }
}

/** Check a pairing code against the server before starting a phone session. */
export async function validatePair(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase()}/api/v1/companion/state?pair=${encodeURIComponent(token)}`, {
      headers: { "x-companion-pair": token },
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function rotatePairToken(): Promise<string | null> {
  try {
    const res = await fetch(`${apiBase()}/api/v1/companion/token`, { method: "POST" });
    const data = await jsonOrThrow(res);
    return (data.token as string) || null;
  } catch {
    return null;
  }
}

async function fetchRemote(token: string): Promise<{ rev: number; state: SyncState | null } | null> {
  try {
    const res = await fetch(`${apiBase()}/api/v1/companion/state?pair=${encodeURIComponent(token)}`, {
      headers: { "x-companion-pair": token },
      cache: "no-store",
    });
    return await jsonOrThrow(res);
  } catch {
    return null;
  }
}

async function pushRemote(token: string, state: SyncState): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase()}/api/v1/companion/state?pair=${encodeURIComponent(token)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-companion-pair": token },
      body: JSON.stringify({ state }),
    });
    await jsonOrThrow(res);
    notifySync("ok");
    return true;
  } catch {
    notifySync("error");
    return false;
  }
}

/* ── sync session ──────────────────────────────────────────────────────── */

let stopCurrent: (() => void) | null = null;

export function notifySync(state: "ok" | "error") {
  try {
    window.dispatchEvent(new CustomEvent("sw-sync", { detail: { state, at: Date.now() } }));
  } catch {
    /* non-browser */
  }
}

/**
 * Start a sync session: hydrate from the server (union merge), then keep
 * pushing local edits (debounced) and pulling remote edits (interval).
 * Returns a stop function.
 */
export function startSync(token: string): () => void {
  stopCurrent?.();

  let stopped = false;
  let pushTimer: number | null = null;
  let lastPushedJson = "";
  const hydrating = { current: false };

  const hydrate = async (): Promise<boolean> => {
    if (stopped) return false;
    const remote = await fetchRemote(token);
    if (stopped || !remote?.state) return false;
    const merged = mergeStates(localSnapshot(), remote.state);
    const local = localSnapshot();
    if (!statesEqual(merged, local)) {
      hydrating.current = true;
      try {
        useStore.setState({ ...merged });
      } finally {
        // let any subscriber callbacks from this setState drain first
        setTimeout(() => {
          hydrating.current = false;
        }, 0);
      }
      return true;
    }
    return false;
  };

  const push = async () => {
    if (stopped) return;
    const snap = localSnapshot();
    const json = JSON.stringify(snap);
    if (json === lastPushedJson) return;
    lastPushedJson = json;
    await pushRemote(token, snap);
  };

  const schedulePush = () => {
    if (hydrating.current || stopped) return;
    if (pushTimer) window.clearTimeout(pushTimer);
    pushTimer = window.setTimeout(() => {
      pushTimer = null;
      void push();
    }, 500);
  };

  void hydrate().then((changed) => {
    if (stopped) return;
    // push whatever we had locally that the server doesn't know about yet
    void push();
    if (changed) void push();
  });

  const unsubscribe = useStore.subscribe(() => {
    if (hydrating.current) return;
    schedulePush();
  });

  const pullTimer = window.setInterval(() => {
    void hydrate().then((changed) => {
      if (changed && !stopped) void push();
    });
  }, 4000);

  const stop = () => {
    stopped = true;
    if (pushTimer) window.clearTimeout(pushTimer);
    if (pullTimer) window.clearInterval(pullTimer);
    unsubscribe();
    if (stopCurrent === stop) stopCurrent = null;
  };
  stopCurrent = stop;
  return stop;
}
