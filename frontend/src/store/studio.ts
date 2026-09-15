import { create } from "zustand";
import type {
  GenerationRecord,
  SubtitleCue,
  SubtitleStyle,
  VoiceSettings,
  WordTiming,
} from "../lib/types";
import { DEFAULT_SUBTITLE_STYLE } from "../lib/subtitlePresets";

interface VideoInfo {
  blob: Blob | null;
  url: string | null;
  name: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
}

interface StudioState {
  // TTS result (shared across /studio, /studio/subtitles, /studio/video)
  audioBuffer: AudioBuffer | null;
  audioBlob: Blob | null;
  text: string;
  voiceId: string;
  voiceSettings: VoiceSettings;
  wordTimings: WordTiming[];
  lastDuration: number;
  // Subtitle editor state
  cues: SubtitleCue[];
  subtitleStyle: SubtitleStyle;
  activeCueId: string | null;
  projectName: string;
  // Video compositor state
  video: VideoInfo;
  // Session generation history
  history: GenerationRecord[];

  setResult: (p: {
    audioBuffer: AudioBuffer;
    audioBlob: Blob;
    text: string;
    voiceId: string;
    voiceSettings: VoiceSettings;
    wordTimings: WordTiming[];
    duration: number;
  }) => void;
  setAudioBuffer: (b: AudioBuffer | null) => void;
  setAudioBlob: (b: Blob | null) => void;
  setText: (t: string) => void;
  setVoiceId: (v: string) => void;
  setVoiceSettings: (v: Partial<VoiceSettings>) => void;
  setWordTimings: (t: WordTiming[]) => void;
  setCues: (c: SubtitleCue[]) => void;
  upsertCue: (c: SubtitleCue) => void;
  removeCue: (id: string) => void;
  setActiveCue: (id: string | null) => void;
  setStyle: (s: Partial<SubtitleStyle>) => void;
  setProjectName: (n: string) => void;
  setVideo: (v: Partial<VideoInfo>) => void;
  addHistory: (r: GenerationRecord) => void;
  removeHistory: (id: string) => void;
  reset: () => void;
}

const initialVideo: VideoInfo = {
  blob: null,
  url: null,
  name: null,
  duration: null,
  width: null,
  height: null,
};

export const useStudio = create<StudioState>((set) => ({
  audioBuffer: null,
  audioBlob: null,
  text: "",
  voiceId: "en-US-JennyNeural",
  voiceSettings: { speed: 1.0, pitch: 0, volume: 100 },
  wordTimings: [],
  lastDuration: 0,
  cues: [],
  subtitleStyle: { ...DEFAULT_SUBTITLE_STYLE },
  activeCueId: null,
  projectName: "Untitled Project",
  video: initialVideo,
  history: [],

  setResult: (p) =>
    set({
      audioBuffer: p.audioBuffer,
      audioBlob: p.audioBlob,
      text: p.text,
      voiceId: p.voiceId,
      voiceSettings: p.voiceSettings,
      wordTimings: p.wordTimings,
      lastDuration: p.duration,
    }),
  setAudioBuffer: (b) => set({ audioBuffer: b }),
  setAudioBlob: (b) => set({ audioBlob: b }),
  setText: (t) => set({ text: t }),
  setVoiceId: (v) => set({ voiceId: v }),
  setVoiceSettings: (v) => set((s) => ({ voiceSettings: { ...s.voiceSettings, ...v } })),
  setWordTimings: (t) => set({ wordTimings: t }),
  setCues: (c) => set({ cues: c }),
  upsertCue: (c) =>
    set((s) => {
      const i = s.cues.findIndex((x) => x.id === c.id);
      if (i === -1) return { cues: [...s.cues, c].sort((a, b) => a.start - b.start) };
      const next = [...s.cues];
      next[i] = c;
      return { cues: next.sort((a, b) => a.start - b.start) };
    }),
  removeCue: (id) => set((s) => ({ cues: s.cues.filter((c) => c.id !== id) })),
  setActiveCue: (id) => set({ activeCueId: id }),
  setStyle: (p) => set((s) => ({ subtitleStyle: { ...s.subtitleStyle, ...p } })),
  setProjectName: (n) => set({ projectName: n }),
  setVideo: (v) => set((s) => ({ video: { ...s.video, ...v } })),
  addHistory: (r) => set((s) => ({ history: [r, ...s.history].slice(0, 50) })),
  removeHistory: (id) => set((s) => ({ history: s.history.filter((h) => h.id !== id) })),
  reset: () =>
    set((s) => {
      // Revoke any lingering object URLs to avoid leaks.
      if (s.video.url) {
        try { URL.revokeObjectURL(s.video.url); } catch { /* ignore */ }
      }
      return {
        audioBuffer: null,
        audioBlob: null,
        text: "",
        voiceId: "en-US-JennyNeural",
        voiceSettings: { speed: 1.0, pitch: 0, volume: 100 },
        wordTimings: [],
        cues: [],
        subtitleStyle: { ...DEFAULT_SUBTITLE_STYLE },
        activeCueId: null,
        lastDuration: 0,
        projectName: "Untitled Project",
        video: initialVideo,
        history: [],
      };
    }),
}));
