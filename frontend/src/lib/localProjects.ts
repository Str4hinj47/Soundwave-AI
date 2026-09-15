import { idbGet, idbSet } from "./idb";
import type { ProjectMeta } from "./types";

// ── Free-plan local project storage (IndexedDB, browser-only) ──────────────
// Free users save projects locally; Pro/Enterprise save to the cloud. The UI
// shows a "Local Only" badge for IndexedDB projects.

const KEY = "sw.local_projects.v1";
const MAX_LOCAL = 50;

export async function listLocalProjects(): Promise<ProjectMeta[]> {
  try {
    const data = await idbGet<{ projects: ProjectMeta[] }>(KEY);
    const list = data?.projects ?? [];
    // Filter out corrupted entries.
    return list.filter((p) => p && typeof p.id === "string" && typeof p.title === "string");
  } catch {
    return [];
  }
}

export async function saveLocalProject(project: ProjectMeta): Promise<void> {
  const current = await listLocalProjects();
  const idx = current.findIndex((p) => p.id === project.id);
  if (idx === -1) current.unshift(project);
  else current[idx] = { ...current[idx], ...project, updatedAt: new Date().toISOString() } as ProjectMeta;
  // Enforce max and sort by updatedAt.
  const sorted = current
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
    .slice(0, MAX_LOCAL);
  await idbSet(KEY, { projects: sorted });
}

export async function deleteLocalProject(id: string): Promise<void> {
  const current = await listLocalProjects();
  await idbSet(KEY, { projects: current.filter((p) => p.id !== id) });
}

export async function getLocalProject(id: string): Promise<ProjectMeta | null> {
  const list = await listLocalProjects();
  return list.find((p) => p.id === id) ?? null;
}
