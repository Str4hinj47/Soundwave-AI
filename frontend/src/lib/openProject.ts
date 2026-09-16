import type { NavigateFunction } from "react-router-dom";
import { useStudio } from "../store/studio";
import { toast } from "../store/toast";
import type { ProjectMeta } from "./types";

/**
 * Load a saved project back into the shared studio store and route the user to
 * the right editor. Used by the Dashboard and the Projects list so "Open"
 * actually restores the script, voice, style and cues.
 */
export function openProject(project: ProjectMeta, navigate: NavigateFunction): void {
  const studio = useStudio.getState();
  studio.setText(project.textContent ?? "");
  if (project.voiceId) studio.setVoiceId(project.voiceId);
  if (project.voiceSettings) studio.setVoiceSettings(project.voiceSettings);
  if (project.subtitleData?.length) studio.setCues(project.subtitleData);
  if (project.subtitleStyle) studio.setStyle(project.subtitleStyle);
  if (project.title) studio.setProjectName(project.title);

  if (project.storageType === "LOCAL") {
    toast.info(
      "Local project loaded",
      "Its audio lives in this browser only — regenerate the take to export it again.",
    );
  }

  navigate(
    project.type === "VIDEO"
      ? "/studio/video"
      : project.type === "SUBTITLE"
        ? "/studio/subtitles"
        : "/studio",
  );
}
