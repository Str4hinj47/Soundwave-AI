import { http } from "./api";
import { saveLocalProject } from "./localProjects";
import type { Plan, ProjectMeta } from "./types";

// ── Project persistence ─────────────────────────────────────────────────────
// Free accounts store projects in the browser (IndexedDB); Pro/Enterprise save
// them to the cloud. Shared by the Studio, the Subtitle Editor and the Video
// Compositor so every "Save" button behaves identically.

export interface SaveResult {
  storageType: ProjectMeta["storageType"];
  label: string;
}

export async function persistProject(meta: ProjectMeta, plan: Plan | undefined): Promise<SaveResult> {
  const storageType: ProjectMeta["storageType"] = plan && plan !== "FREE" ? "CLOUD" : "LOCAL";
  const payload: ProjectMeta = { ...meta, storageType };

  if (storageType === "LOCAL") {
    await saveLocalProject(payload);
    return { storageType, label: "Saved in this browser (Local Only)" };
  }

  // The API assigns its own id; strip client-side-only fields.
  const { storageType: _omit, ...body } = payload;
  void _omit;
  await http.post("/projects", body);
  return { storageType, label: "Saved to your cloud projects" };
}

/**
 * Build a project record from the current studio session. `type` distinguishes
 * pure TTS, subtitle-only and video projects in the Projects list.
 */
export function buildProjectMeta(params: {
  id?: string;
  title: string;
  type: ProjectMeta["type"];
  text: string;
  voiceId: string;
  voiceSettings: ProjectMeta["voiceSettings"];
  duration: number | null;
  cues?: ProjectMeta["subtitleData"];
  subtitleStyle?: ProjectMeta["subtitleStyle"];
  videoFileKey?: string | null;
  status?: ProjectMeta["status"];
}): ProjectMeta {
  const now = new Date().toISOString();
  return {
    id: params.id ?? crypto.randomUUID(),
    title: params.title.trim() || "Untitled Project",
    type: params.type,
    textContent: params.text,
    voiceId: params.voiceId,
    voiceSettings: params.voiceSettings,
    characterCount: params.text.length,
    duration: params.duration,
    status: params.status ?? "DRAFT",
    storageType: "LOCAL",
    createdAt: now,
    updatedAt: now,
    audioUrl: null,
    videoBackgroundUrl: params.videoFileKey ?? null,
    subtitleData: params.cues ?? null,
    subtitleStyle: params.subtitleStyle ?? null,
  };
}
