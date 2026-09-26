import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CalEvent, ChatMsg, FocusLog, Habit, Note, Settings, Task } from "./lib/types";

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** yyyy-mm-dd in local time */
export const dayKey = (d: Date = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const addDays = (base: Date, days: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
};

interface State {
  settings: Settings;
  tasks: Task[];
  notes: Note[];
  habits: Habit[];
  events: CalEvent[];
  messages: ChatMsg[];
  focusLog: FocusLog[];

  // settings
  patchSettings: (p: Partial<Settings>) => void;

  // tasks
  addTask: (title: string, due?: string) => Task;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;

  // notes
  addNote: (body: string) => Note;
  updateNote: (id: string, body: string) => void;
  removeNote: (id: string) => void;

  // habits
  addHabit: (title: string, emoji: string) => Habit;
  toggleHabitDay: (id: string, day: string) => void;
  removeHabit: (id: string) => void;

  // calendar
  addEvent: (title: string, date: string, time: string) => void;
  removeEvent: (id: string) => void;

  // chat
  pushMessage: (m: Omit<ChatMsg, "id" | "createdAt"> & { id?: string; createdAt?: number }) => ChatMsg;
  updateMessage: (id: string, patch: Partial<ChatMsg>) => void;
  clearMessages: () => void;

  // focus
  logFocus: (minutes: number) => void;

  // data
  resetAll: () => void;
}

const defaultSettings: Settings = {
  onboarded: false,
  userName: "",
  language: "en",
  theme: "cream",
  brain: "local",
  personality: "normal",
  voiceReplies: false,
  neuralVoice: "en-US-GuyNeural",
  studioUrl: "http://localhost:5173",
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      tasks: [],
      notes: [],
      habits: [],
      events: [],
      messages: [],
      focusLog: [],

      patchSettings: (p) => set({ settings: { ...get().settings, ...p } }),

      addTask: (title, due) => {
        const task: Task = {
          id: uid(),
          title: title.trim(),
          done: false,
          due,
          createdAt: Date.now(),
        };
        set({ tasks: [task, ...get().tasks] });
        return task;
      },
      toggleTask: (id) =>
        set({
          tasks: get().tasks.map((t) =>
            t.id === id ? { ...t, done: !t.done, completedAt: !t.done ? Date.now() : undefined } : t
          ),
        }),
      removeTask: (id) => set({ tasks: get().tasks.filter((t) => t.id !== id) }),

      addNote: (body) => {
        const note: Note = { id: uid(), body: body.trim(), createdAt: Date.now(), updatedAt: Date.now() };
        set({ notes: [note, ...get().notes] });
        return note;
      },
      updateNote: (id, body) =>
        set({
          notes: get().notes.map((n) => (n.id === id ? { ...n, body, updatedAt: Date.now() } : n)),
        }),
      removeNote: (id) => set({ notes: get().notes.filter((n) => n.id !== id) }),

      addHabit: (title, emoji) => {
        const habit: Habit = { id: uid(), title: title.trim(), emoji, days: [], createdAt: Date.now() };
        set({ habits: [...get().habits, habit] });
        return habit;
      },
      toggleHabitDay: (id, day) =>
        set({
          habits: get().habits.map((h) =>
            h.id === id
              ? { ...h, days: h.days.includes(day) ? h.days.filter((d) => d !== day) : [...h.days, day] }
              : h
          ),
        }),
      removeHabit: (id) => set({ habits: get().habits.filter((h) => h.id !== id) }),

      addEvent: (title, date, time) =>
        set({
          events: [...get().events, { id: uid(), title: title.trim(), date, time }].sort((a, b) =>
            a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)
          ),
        }),
      removeEvent: (id) => set({ events: get().events.filter((e) => e.id !== id) }),

      pushMessage: (m) => {
        const msg: ChatMsg = {
          id: m.id ?? uid(),
          sender: m.sender,
          text: m.text,
          createdAt: m.createdAt ?? Date.now(),
          cards: m.cards,
          tag: m.tag,
          pending: m.pending,
        };
        set({ messages: [...get().messages, msg] });
        return msg;
      },
      updateMessage: (id, patch) =>
        set({ messages: get().messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) }),
      clearMessages: () => set({ messages: [] }),

      logFocus: (minutes) =>
        set({ focusLog: [...get().focusLog, { id: uid(), minutes, endedAt: Date.now() }] }),

      resetAll: () => set({ settings: defaultSettings, tasks: [], notes: [], habits: [], events: [], messages: [], focusLog: [] }),
    }),
    {
      name: "soundwave-companion",
      version: 1,
    }
  )
);

/** Apply the selected theme to <html data-theme="..."> */
export function applyTheme(theme: string) {
  document.documentElement.dataset.theme = theme;
}

/* ── ephemeral UI state (not persisted) ─────────────────────────────────── */

import { create as createStore } from "zustand";
import type { Mood, TabId } from "./lib/types";

interface UIState {
  tab: TabId;
  setTab: (t: TabId) => void;
  mood: Mood;
  setMood: (m: Mood) => void;
  panelOpen: boolean;
  setPanelOpen: (v: boolean) => void;
  /** a one-shot message the Today view can push into the chat composer */
  pendingSend: string | null;
  send: (text: string) => void;
  consumePendingSend: () => void;
  /** a one-shot focus request (minutes) consumed by the Focus view */
  focusRequest: number | null;
  requestFocus: (minutes: number) => void;
  consumeFocusRequest: () => void;
}

export const useUI = createStore<UIState>((set) => ({
  tab: "today",
  setTab: (tab) => set({ tab }),
  mood: "idle",
  setMood: (mood) => set({ mood }),
  panelOpen: false,
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  pendingSend: null,
  send: (text) => set({ pendingSend: text, tab: "chat" }),
  consumePendingSend: () => set({ pendingSend: null }),
  focusRequest: null,
  requestFocus: (minutes) => set({ focusRequest: minutes, tab: "focus" }),
  consumeFocusRequest: () => set({ focusRequest: null }),
}));
