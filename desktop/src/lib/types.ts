export type TabId =
  | "today"
  | "chat"
  | "tasks"
  | "notes"
  | "focus"
  | "habits"
  | "calendar"
  | "settings";

export type Mood = "idle" | "thinking" | "listening" | "talking" | "happy" | "focused";

export type Brain = "local" | "gemini" | "cloud";

export type Personality = "normal" | "butler" | "bro" | "anime" | "coach" | "chill";

export type Theme = "cream" | "dark" | "ocean";

export interface Task {
  id: string;
  title: string;
  done: boolean;
  /** yyyy-mm-dd */
  due?: string;
  createdAt: number;
  completedAt?: number;
  updatedAt?: number;
}

export interface Note {
  id: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

export interface Habit {
  id: string;
  title: string;
  emoji: string;
  /** yyyy-mm-dd keys of days completed */
  days: string[];
  createdAt: number;
  updatedAt?: number;
}

export interface CalEvent {
  id: string;
  title: string;
  /** yyyy-mm-dd */
  date: string;
  /** HH:MM (24h) */
  time: string;
  createdAt?: number;
}

export interface FocusLog {
  id: string;
  minutes: number;
  endedAt: number;
}

export type Card =
  | { kind: "task"; taskId: string; title: string; due?: string }
  | { kind: "tasks"; tasks: Array<{ id: string; title: string; done: boolean; due?: string }> }
  | { kind: "plan"; blocks: Array<{ time: string; label: string; type: "event" | "task" | "habit" | "focus" }> }
  | { kind: "note"; noteId: string; preview: string }
  | { kind: "habit"; habitId: string; title: string; emoji: string }
  | { kind: "focus"; minutes: number }
  | { kind: "script"; topic: string; body: string }
  | { kind: "video"; title: string; videoUrl?: string; downloadUrl?: string }
  | { kind: "links"; links: Array<{ label: string; url: string }> };

export interface ChatMsg {
  id: string;
  sender: "user" | "echo";
  text: string;
  createdAt: number;
  cards?: Card[];
  tag?: string; // e.g. "local", "cloud", "voice"
  pending?: boolean;
}

export interface Tombstone {
  id: string;
  ts: number;
}

export interface Settings {
  onboarded: boolean;
  userName: string;
  language: string;
  theme: Theme;
  brain: Brain;
  personality: Personality;
  voiceReplies: boolean;
  neuralVoice: string;
  studioUrl: string;
  /** Free Google Gemini brain (AI Studio key) — stored only on this device. */
  geminiKey: string;
  geminiModel: string;
  /** Companion Link: sync state with the phone web app. */
  phoneLink: boolean;
}
