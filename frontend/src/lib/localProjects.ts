import { idbGet, idbSet } from "./idb";
import type { ProjectMeta } from "./types";

// ── Free-plan local project storage (IndexedDB, browser-only) ──────────────
// Free users save projects locally; Pro/Enterprise save to the cloud. The UI
// shows a "Local Only" badge for IndexedDB projects.

const KEY = "sw.local_projects.v1";

export async function listLocalProjects(): Promise<ProjectMeta[]> {
  const data = await idbGet<{ projects: ProjectMeta[] }>(KEY);
  return data?.projects ?? [];
}

export async function saveLocalProject(project: ProjectMeta): Promise<void> {
  const current = await listLocalProjects();
  const idx = current.findIndex((p) => p.id === project.id);
  if (idx === -1) current.unshift(project);
  else current[idx] = project;
  await idbSet(KEY, { projects: current.slice(0, 50) });
}

export async function deleteLocalProject(id: string): Promise<void> {
  const current = await listLocalProjects();
  await idbSet(KEY, { projects: current.filter((p) => p.id !== id) });
}
