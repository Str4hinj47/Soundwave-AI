import type { BrainResult } from "./brainTypes";
import type { Personality, Settings } from "./types";
import { dayKey } from "../store";
import { planToday } from "./schedule";
import type { Task, Note, Habit, CalEvent, FocusLog } from "./types";

export interface BrainCtx {
  settings: Settings;
  tasks: Task[];
  notes: Note[];
  habits: Habit[];
  events: CalEvent[];
  focusLog: FocusLog[];
}

export interface Actions {
  addTask: (title: string, due?: string) => Task;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;
  addNote: (body: string) => Note;
  addHabit: (title: string, emoji: string) => Habit;
  toggleHabitDay: (id: string, day: string) => void;
  addEvent: (title: string, date: string, time: string) => void;
  logFocus: (minutes: number) => void;
  patchSettings: (p: Partial<Settings>) => void;
  openTab: (tab: "tasks" | "notes" | "habits" | "focus" | "calendar" | "today") => void;
}

/* ── personalities ─────────────────────────────────────────────────────── */

interface Persona {
  label: string;
  quip: (inner: string) => string;
}

export const PERSONALITIES: Record<Personality, Persona> = {
  normal: {
    label: "Echo",
    quip: (s) => s,
  },
  butler: {
    label: "Butler",
    quip: (s) => `As you wish. ${s}`,
  },
  bro: {
    label: "Bro",
    quip: (s) => `Let's gooo. ${s}`,
  },
  anime: {
    label: "Anime",
    quip: (s) => `Nyaa~ ✨ ${s}`,
  },
  coach: {
    label: "Coach",
    quip: (s) => `Alright, lock in. ${s}`,
  },
  chill: {
    label: "Chill",
    quip: (s) => `All good. ${s}`,
  },
};

const clean = (s: string) => s.trim().replace(/\s+/g, " ");
const lower = (s: string) => s.toLowerCase().trim();

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function parseDue(rest: string): { title: string; due?: string } {
  let title = rest;
  let due: string | undefined;
  const today = dayKey();
  const tomorrow = dayKey(new Date(Date.now() + 86400000));

  const dueMatch = title.match(/\s*(?:,|—|-|\b)?\s*due\s+(today|tomorrow|tonight|next\s+\w+|\w+day|in\s+\d+\s+days?|\d{4}-\d{2}-\d{2})\s*$/i);
  if (dueMatch) {
    const raw = dueMatch[1]!.toLowerCase().replace(/\s+/g, " ");
    if (raw.startsWith("today") || raw === "tonight") due = today;
    else if (raw === "tomorrow") due = tomorrow;
    else if (raw.startsWith("in ")) {
      const n = parseInt(raw.replace(/\D/g, ""), 10) || 1;
      due = dayKey(new Date(Date.now() + n * 86400000));
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) due = raw;
    else {
      const idx = DAYS.findIndex((d) => raw.includes(d.slice(0, 3)));
      if (idx >= 0) {
        const now = new Date();
        let delta = (idx - now.getDay() + 7) % 7;
        if (delta === 0) delta = 7;
        due = dayKey(new Date(Date.now() + delta * 86400000));
      }
    }
    title = title.slice(0, dueMatch.index ?? title.length).trim();
  }
  title = title.replace(/^(to|that|for)\s+/i, "").replace(/[.!?]+$/, "");
  return { title: clean(title), due };
}

function fuzzyFind<T extends { title: string; done: boolean }>(items: T[], q: string): T | undefined {
  const needle = lower(q).replace(/^(the|my|a|an)\s+/, "").replace(/[.!?]+$/, "");
  if (!needle) return undefined;
  const open = items.filter((i) => !i.done);
  return (
    open.find((i) => lower(i.title) === needle) ||
    open.find((i) => lower(i.title).includes(needle)) ||
    open.find((i) => needle.includes(lower(i.title))) ||
    open.find((i) =>
      needle.split(" ").filter((w) => w.length > 3).some((w) => lower(i.title).includes(w))
    )
  );
}

function greetingFor(name: string): string {
  const h = new Date().getHours();
  const who = name ? `, ${name}` : "";
  if (h < 5) return `Burning the midnight oil${who}?`;
  if (h < 12) return `Good morning${who}!`;
  if (h < 18) return `Good afternoon${who}.`;
  return `Good evening${who}.`;
}

function tryMath(text: string): string | null {
  const m = lower(text).match(/^\/?(?:what(?:'| i)s|calculate|compute|how much is)?\s*(-?\d+(?:\.\d+)?)\s*([+\-*/x×÷])\s*(-?\d+(?:\.\d+)?)(%?)\s*\??$/);
  if (!m) return null;
  const a = parseFloat(m[1]!);
  const b = parseFloat(m[3]!);
  const op = m[2]!;
  let r: number;
  if (op === "+") r = a + b;
  else if (op === "-") r = a - b;
  else if (op === "*" || op === "x" || op === "×") r = a * b;
  else if (b === 0) return "Dividing by zero? Even I can't do that one.";
  else r = a / b;
  const out = Math.round(r * 10000) / 10000;
  return `${a} ${op === "×" ? "×" : op === "÷" ? "÷" : op} ${b} = ${out}`;
}

/**
 * On-device intent engine — the free "local brain".
 * Handles day-management commands entirely offline, then falls back to
 * personality small-talk. Returns handled=false for things that need the
 * bigger Soundwave brain (cloud mode routes those to the API).
 */
export function localBrain(inputRaw: string, ctx: BrainCtx, actions: Actions): BrainResult {
  const text = clean(inputRaw);
  const t = lower(text);
  const p = PERSONALITIES[ctx.settings.personality];
  const today = dayKey();
  const name = ctx.settings.userName;

  /* ── tasks ─────────────────────────────────────────────────────────── */
  const taskCreate =
    t.match(/^(?:add|create|make|new|put down)(?:\s+me)?\s+(?:a|an|the)?\s*(?:task|todo|to-do|to do|reminder)(?:\s+to|\s+for|\s+about|\s*:)?\s+(.+)/i) ||
    t.match(/^remind me to\s+(.+)/i) ||
    t.match(/^i (?:need|want) to\s+(.+)/i);
  if (taskCreate) {
    const { title, due } = parseDue(taskCreate[1]!);
    if (title) {
      const task = actions.addTask(title, due ?? today);
      const dueLabel = due === today ? "due today" : due ? `due ${due}` : "";
      return {
        handled: true,
        mood: "happy",
        text: p.quip(`Added “${task.title}”${dueLabel ? ` — ${dueLabel}` : ""}.`),
        cards: [{ kind: "task", taskId: task.id, title: task.title, due: task.due }],
        tag: "local",
      };
    }
  }

  const taskDone =
    t.match(/^(?:complete|finish(?:ed)?|done with|check off|tick off|mark done|close)(?:\s+the)?\s*(?:task)?\s*(.+)/i) ||
    t.match(/^i (?:finished|did|completed)\s+(.+)/i);
  if (taskDone && !/^(the )?(day|work|it)/.test(taskDone[1]!)) {
    const found = fuzzyFind(ctx.tasks, taskDone[1]!);
    if (found) {
      actions.toggleTask(found.id);
      return {
        handled: true,
        mood: "happy",
        text: p.quip(`Nice — “${found.title}” is done. That's a wrap. ✅`),
        tag: "local",
      };
    }
    return { handled: true, text: `I couldn't find an open task matching “${clean(taskDone[1]!)}”.`, tag: "local" };
  }

  const taskDelete = t.match(/^(?:delete|remove|drop|cancel)(?:\s+the)?\s*(?:task)?\s+(.+)/i);
  if (taskDelete && !/^(all|everything)/.test(taskDelete[1]!)) {
    const found = fuzzyFind(ctx.tasks, taskDelete[1]!);
    if (found) {
      actions.removeTask(found.id);
      return { handled: true, text: `Removed “${found.title}”. Out of sight.`, tag: "local" };
    }
  }

  if (/(what'?s|show|list|give me|got)\s+(?:me\s+)?(?:my\s+)?(?:task|to-?do|list|plate)/.test(t) ||
      /what'?s on my plate/.test(t) || /^my tasks$/.test(t)) {
    const open = ctx.tasks.filter((x) => !x.done).slice(0, 6);
    if (!open.length) return { handled: true, text: `Your list is clear${name ? `, ${name}` : ""} — nothing open. Add one and I'll keep it safe.`, tag: "local" };
    return {
      handled: true,
      text: `You have ${open.length} thing${open.length > 1 ? "s" : ""} open:`,
      cards: [{ kind: "tasks", tasks: open.map((x) => ({ id: x.id, title: x.title, done: x.done, due: x.due })) }],
      tag: "local",
    };
  }

  /* ── notes ─────────────────────────────────────────────────────────── */
  const noteCreate =
    t.match(/^(?:add|create|make|take|write|jot down)?\s*(?:a|the)?\s*(?:quick\s+)?(?:note|memo)(?:\s+that|\s+to say|\s+about|\s*:)?\s+(.+)/i) ||
    t.match(/^remember(?:\s+that)?\s+(.+)/i);
  if (noteCreate) {
    const body = clean(noteCreate[1]!);
    if (body) {
      const note = actions.addNote(body);
      return {
        handled: true,
        mood: "happy",
        text: p.quip(`Noted: “${note.body}”.`),
        cards: [{ kind: "note", noteId: note.id, preview: note.body }],
        tag: "local",
      };
    }
  }
  if (/(?:show|list|open|read)(?:\s+my)?\s*notes/.test(t) || /^my notes$/.test(t)) {
    actions.openTab("notes");
    const top = ctx.notes[0];
    return {
      handled: true,
      text: ctx.notes.length
        ? `You have ${ctx.notes.length} note${ctx.notes.length > 1 ? "s" : ""}. Opening your notes — latest: “${top!.body.slice(0, 80)}${top!.body.length > 80 ? "…" : ""}”`
        : "No notes yet — say “note …” and I'll catch it.",
      tag: "local",
    };
  }

  /* ── habits ────────────────────────────────────────────────────────── */
  const habitCreate = t.match(/^(?:add|create|start|track)(?:\s+a)?\s*habit(?:\s+to|\s+for|\s*:)?\s+(.+)/i);
  if (habitCreate) {
    const title = clean(habitCreate[1]!.replace(/^(to|for)\s+/i, ""));
    const emojis = ["💧", "🏃", "📖", "🧘", "💊", "🌱", "✍️", "🛌", "🎧", "💪"];
    const habit = actions.addHabit(title, emojis[ctx.habits.length % emojis.length]!);
    return {
      handled: true,
      mood: "happy",
      text: p.quip(`New habit: ${habit.emoji} ${habit.title}. Streak starts today — I'll keep score.`),
      cards: [{ kind: "habit", habitId: habit.id, title: habit.title, emoji: habit.emoji }],
      tag: "local",
    };
  }
  const habitDone = t.match(/^(?:done|check|log|completed|tick)(?:\s+my)?\s*(?:habit\s*)?(.+)/i);
  if (habitDone && habitDone[1]) {
    const q = clean(habitDone[1]!);
    const found = ctx.habits.find(
      (h) => lower(h.title) === lower(q) || lower(h.title).includes(lower(q)) || lower(q).includes(lower(h.title))
    );
    if (found) {
      if (!found.days.includes(today)) actions.toggleHabitDay(found.id, today);
      const streak = streakOf(found.days);
      return {
        handled: true,
        mood: "happy",
        text: p.quip(`${found.emoji} ${found.title} — logged. ${streak} day streak${streak > 1 ? " going strong" : " starts now"}!`),
        tag: "local",
      };
    }
  }
  if (/(?:show|list|my)\s+(?:the\s+)?habits/.test(t) || /^my habits$/.test(t)) {
    actions.openTab("habits");
    if (!ctx.habits.length) return { handled: true, text: "No habits yet. Try “add habit drink water”.", tag: "local" };
    const lines = ctx.habits.map((h) => `${h.emoji} ${h.title} — ${streakOf(h.days)} day streak`);
    return { handled: true, text: `Your habits:\n${lines.join("\n")}`, tag: "local" };
  }

  /* ── focus ─────────────────────────────────────────────────────────── */
  const focusStart = t.match(/^(?:start|begin|engage)\s+(?:a\s+)?(?:focus|pomodoro|deep ?work|sprint)(?:\s+(?:for\s+)?(\d+)\s*(?:min|minutes?|m))?/i);
  if (focusStart) {
    const minutes = Math.min(120, Math.max(5, parseInt(focusStart[1] || "25", 10)));
    actions.openTab("focus");
    return {
      handled: true,
      mood: "focused",
      text: p.quip(`${minutes} minutes of deep work. Phone down, I'm on lookout. Starting your timer.`),
      cards: [{ kind: "focus", minutes }],
      tag: "local",
    };
  }
  if (/^(?:stop|pause|end|cancel)(?:\s+the)?\s*(?:focus|timer|pomodoro)/.test(t)) {
    actions.openTab("focus");
    return { handled: true, text: "Timer panel is up — pause or reset whenever you need.", tag: "local" };
  }
  if (/(?:how much|total)\s+focus|focus (?:time|today)/.test(t)) {
    const mins = ctx.focusLog.reduce((s, f) => s + f.minutes, 0);
    return { handled: true, text: `You've banked ${mins} minute${mins === 1 ? "" : "s"} of focus logged. ${mins >= 50 ? "That's a serious session. 🔥" : "Ready when you are."}`, tag: "local" };
  }

  /* ── plan my day ───────────────────────────────────────────────────── */
  if (/(?:plan|schedule|organize|structure)\s+(?:my\s+)?(?:day|morning|afternoon|today|schedule)|what should i do|^what'?s the plan|help me (?:start|plan)/.test(t)) {
    const blocks = planToday(ctx.tasks, ctx.events, ctx.habits);
    if (!blocks.length) {
      return { handled: true, text: `The day is wide open${name ? `, ${name}` : ""}. Add a task or two and I'll build you a plan.`, tag: "local" };
    }
    return {
      handled: true,
      mood: "happy",
      text: p.quip(`Here's your game plan — ${blocks.length} blocks, starting at ${blocks[0]!.time}:`),
      cards: [{ kind: "plan", blocks }],
      tag: "local",
    };
  }

  /* ── calendar ──────────────────────────────────────────────────────── */
  const evAdd = t.match(/^(?:add|create|schedule)(?:\s+an?)?\s*(?:event|meeting|appointment)(?:\s+for)?\s+(.+?)(?:\s+at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?(?:\s+(?:on|for)\s+(today|tomorrow|\w+day))?$/i);
  if (evAdd) {
    const title = clean(evAdd[1]!.replace(/\s+at\s+.*$/, ""));
    let time = "09:00";
    if (evAdd[2]) time = normalizeTime(evAdd[2]!);
    let date = today;
    if (evAdd[3]) {
      const d = lower(evAdd[3]);
      if (d === "tomorrow") date = dayKey(new Date(Date.now() + 86400000));
      else {
        const idx = DAYS.findIndex((x) => d.includes(x.slice(0, 3)));
        if (idx >= 0) {
          let delta = (idx - new Date().getDay() + 7) % 7 || 7;
          date = dayKey(new Date(Date.now() + delta * 86400000));
        }
      }
    }
    actions.addEvent(title, date, time);
    actions.openTab("calendar");
    return { handled: true, mood: "happy", text: p.quip(`Pinned “${title}” at ${time} on ${date}. Calendar's updated.`), tag: "local" };
  }
  if (/(?:what'?s|show|check)(?:\s+on)?\s+(?:my\s+)?calendar|do i have (?:any|a) (?:events|meetings)|what'?s (?:happening|on) today/.test(t)) {
    actions.openTab("calendar");
    const todays = ctx.events.filter((e) => e.date === today);
    return {
      handled: true,
      text: todays.length
        ? `Today you have ${todays.length} event${todays.length > 1 ? "s" : ""}:\n${todays.map((e) => `• ${e.time} — ${e.title}`).join("\n")}`
        : "Nothing on the calendar today. Enjoy the space — or let me plan some focus blocks.",
      tag: "local",
    };
  }

  /* ── open the content platform ─────────────────────────────────────── */
  const openMatch = t.match(/^open\s+(?:the\s+)?(studio|video|compositor|projects|creator|dashboard|web platform|app|voices|agent hub)\b/);
  if (openMatch) {
    const base = ctx.settings.studioUrl.replace(/\/$/, "");
    const map: Record<string, string> = {
      studio: "/studio/video",
      video: "/studio/video",
      compositor: "/studio/video",
      projects: "/projects",
      creator: "/creator",
      dashboard: "/dashboard",
      voices: "/voices",
      "agent hub": "/agent",
      "web platform": "/studio/video",
      app: "/studio/video",
    };
    const path = map[openMatch[1]!] ?? "/studio/video";
    const url = `${base}${path}`;
    return {
      handled: true,
      text: `Opening ${openMatch[1]} for you.`,
      cards: [{ kind: "links", links: [{ label: `Open ${openMatch[1]}`, url }] }],
      tag: "local",
      openUrl: url,
    };
  }

  /* ── time / date / math ────────────────────────────────────────────── */
  if (/\b(what|tell|whats|current)\b.*\btime\b/.test(t) && !/focus|timer time/.test(t)) {
    const now = new Date();
    return { handled: true, text: `It's ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`, tag: "local" };
  }
  if (/\b(what|tell|whats)\b.*\b(date|day)\b/.test(t) && !/^day\b/.test(t)) {
    const now = new Date();
    return {
      handled: true,
      text: `Today is ${now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.`,
      tag: "local",
    };
  }
  const math = tryMath(text);
  if (math) return { handled: true, text: math, tag: "local" };

  /* ── personality switch ────────────────────────────────────────────── */
  const brainSwitch = t.match(/^(?:switch|change|set|use)\s+(?:to\s+)?(?:the\s+)?(gemini|cloud|local)(?:\s+(?:brain|mode))?$/i);
  if (brainSwitch) {
    const target = brainSwitch[1]!.toLowerCase() as "gemini" | "cloud" | "local";
    if (target === "gemini" && !ctx.settings.geminiKey.trim()) {
      return {
        handled: true,
        text: "Gemini needs a free key first — grab one at aistudio.google.com/apikey and paste it in Settings → Brain, then ask me to switch to gemini again.",
        tag: "local",
      };
    }
    actions.patchSettings({ brain: target });
    const label = target === "gemini" ? "Gemini (free)" : target === "cloud" ? "Soundwave Cloud" : "the local brain";
    return { handled: true, mood: "happy", text: `Switched to ${label}. Ask me anything.`, tag: "local" };
  }

  const personaMatch = t.match(/^(?:change|switch|set)(?:\s+your)?\s*personality(?:\s+to)?\s+(\w+)/i) || t.match(/^be\s+(?:a\s+)?(butler|bro|anime|coach|chill|normal)\b/i);
  if (personaMatch) {
    const key = lower(personaMatch[1]!);
    const map: Record<string, Personality> = { butler: "butler", bro: "bro", brother: "bro", anime: "anime", coach: "coach", trainer: "coach", chill: "chill", relaxed: "chill", normal: "normal", echo: "normal" };
    const personality = map[key];
    if (personality) {
      actions.patchSettings({ personality });
      const p2 = PERSONALITIES[personality];
      return { handled: true, mood: "happy", text: `${p2.label} mode, engaged. ${personality === "butler" ? "Your wish is my command." : personality === "anime" ? "Let's do our best!" : "Let's get to work."}`, tag: "local" };
    }
  }

  /* ── creator / heavy intents → bigger brain ────────────────────────── */
  if (/(generate|make|create|render|produce|write|script).*(short|video|reel|tiktok|clip|viral|script|voiceover|voice|audio)|\bsay\b|weather|system (stats|vitals)|cpu|ram\b|screenshot|open (?:an? )?(?:app|application)/.test(t)) {
    return {
      handled: true,
      needsCloud: true,
      text: "That's a job for a bigger brain — switch me to **Gemini (free)** or **Soundwave Cloud** in Settings and I'll generate scripts, render shorts, speak with neural voices, and run workstation commands.",
      tag: "local",
    };
  }

  return { handled: false, text: "", tag: "local" };
}

export function streakOf(days: string[]): number {
  if (!days.length) return 0;
  const set = new Set(days);
  let streak = 0;
  const cursor = new Date();
  if (!set.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (set.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function normalizeTime(raw: string): string {
  const m = raw.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return "09:00";
  let h = parseInt(m[1]!, 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ampm = m[3]?.toLowerCase();
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/* ── small talk fallback (personality-driven) ─────────────────────────── */

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export function smallTalk(input: string, ctx: BrainCtx): BrainResult {
  const t = lower(input);
  const p = PERSONALITIES[ctx.settings.personality];
  const name = ctx.settings.userName;
  const openCount = ctx.tasks.filter((x) => !x.done).length;

  if (/^(hi|hello|hey|yo|sup|good (morning|afternoon|evening))\b/.test(t)) {
    return { handled: true, mood: "happy", text: `${greetingFor(name)} ${openCount ? `You've got ${openCount} open task${openCount > 1 ? "s" : ""} waiting.` : "Everything's tidy on my side."}`, tag: "local" };
  }
  if (/how are you|how('s| is) it going|you ok/.test(t)) {
    return { handled: true, text: pick([
      "Running smooth — all green over here. How about you?",
      "Alert, cozy, and one hotkey away. What's up?",
      "Fresh as a new waveform. What are we doing?",
    ]), tag: "local" };
  }
  if (/(who are you|what are you|your name)/.test(t)) {
    return { handled: true, text: "I'm Echo — your computer's little buddy. I keep your tasks, notes, habits, focus sessions and calendar in one calm place, and I plan your day. Everything stays right here on your machine.", tag: "local" };
  }
  if (/(what can you do|help me|capabilities|commands|what do you do)/.test(t)) {
    return {
      handled: true,
      text: "The short version:\n• “Add a task … due today”\n• “Plan my day”\n• “Start focus for 25”\n• “Note …” to remember things\n• “Add habit drink water”\n• “What's on my calendar?”\n\nAnd with the bigger brain: scripts, shorts, neural voices, and workstation commands.",
      tag: "local",
    };
  }
  if (/thank(s| you)|appreciate/.test(t)) {
    return { handled: true, mood: "happy", text: p.quip("Anytime. That's what buddies are for."), tag: "local" };
  }
  if (/(i('m| am) (tired|exhausted|burnt ?out|stressed)|stuck|overwhelmed|procrastinating)/.test(t)) {
    const lines = ctx.settings.personality === "coach"
      ? ["Break it into one tiny task and crush that first. Momentum beats motivation."]
      : ctx.settings.personality === "butler"
      ? ["May I suggest a short focus session, followed by tea? I can start the timer."]
      : ["Let's shrink it: one small task, 25 minutes, then a break. Want me to start a focus block?"];
    return { handled: true, text: pick(lines), tag: "local" };
  }
  if (/(joke|funny|make me laugh)/.test(t)) {
    return {
      handled: true,
      mood: "happy",
      text: ctx.settings.personality === "bro"
        ? "Why did the developer go broke? Because he used up all his cache. 😅"
        : ctx.settings.personality === "anime"
        ? "I'd tell you a UDP joke, but you might not get it~ 📡"
        : "I told my tasks a joke once. They all cracked up — then I checked them off. 📝",
      tag: "local",
    };
  }
  if (/(love you|marry me|best (friend|buddy))/.test(t)) {
    return { handled: true, mood: "happy", text: p.quip("Buddy noted, heart rate stable. Now — what's next on the list?"), tag: "local" };
  }
  if (/^(ok|okay|k|cool|nice|great|yes|yeah|nope?)$/.test(t)) {
    return { handled: true, text: p.quip("👍 Standing by."), tag: "local" };
  }

  const fallbacks = [
    `I've got you${name ? `, ${name}` : ""}. Try “plan my day”, “add a task …”, or “start focus”.`,
    "That one's outside my local toolkit — ask me for tasks, notes, habits, focus or your calendar, or switch to the Soundwave brain for the heavy stuff.",
    "Interesting. Want me to turn that into a task, a note, or a plan?",
  ];
  return { handled: true, text: p.quip(pick(fallbacks)), tag: "local" };
}
