import type { Task, CalEvent, Habit } from "./types";
import { dayKey } from "../store";

export interface PlanBlock {
  time: string;
  label: string;
  type: "event" | "task" | "habit" | "focus";
  id?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function dueRank(t: Task) {
  const today = dayKey();
  const tomorrow = dayKey(new Date(Date.now() + 86400000));
  if (!t.due) return 2;
  if (t.due <= today) return 0;
  if (t.due === tomorrow) return 1;
  return 3;
}

/**
 * Build a friendly, time-blocked plan for the rest of today —
 * fixed calendar events first, then priority tasks, habits anchored
 * to sensible slots, and a focus block when the day allows.
 */
export function planToday(tasks: Task[], events: CalEvent[], habits: Habit[]): PlanBlock[] {
  const today = dayKey();
  const now = new Date();
  const openTasks = tasks
    .filter((t) => !t.done && (!t.due || t.due <= today))
    .sort((a, b) => dueRank(a) - dueRank(b) || a.createdAt - b.createdAt)
    .slice(0, 6);

  const dayEvents = events
    .filter((e) => e.date === today && e.time >= hhmm(now))
    .sort((a, b) => a.time.localeCompare(b.time));

  const blocks: PlanBlock[] = [];

  // Roll the clock forward in 15-min granularity, min 25-min blocks.
  let cursor = new Date(now);
  cursor.setMinutes(Math.ceil((cursor.getMinutes() + 10) / 15) * 15, 0, 0);

  const eventsSorted = [...dayEvents];
  const startNext = () => {
    while (eventsSorted.length && eventsSorted[0]!.time <= hhmm(cursor)) eventsSorted.shift();
  };

  // 1) Calendar events (fixed points)
  let safety = 0;
  while ((eventsSorted.length || openTasks.length) && safety < 10) {
    safety += 1;
    startNext();
    const nextEvent = eventsSorted[0];
    if (nextEvent) {
      const [eh, em] = nextEvent.time.split(":").map(Number);
      const evStart = new Date();
      evStart.setHours(eh!, em!, 0, 0);
      // free time before the event → tuck a task in
      const gapMin = Math.round((evStart.getTime() - cursor.getTime()) / 60000);
      const nextTask = openTasks[0];
      if (nextTask && gapMin >= 30) {
        blocks.push({ time: hhmm(cursor), label: nextTask.title, type: "task", id: nextTask.id });
        openTasks.shift();
        cursor = new Date(Math.min(evStart.getTime(), cursor.getTime() + Math.max(30, Math.min(gapMin, 50)) * 60000));
        continue;
      }
      blocks.push({ time: nextEvent.time, label: nextEvent.title, type: "event", id: nextEvent.id });
      cursor = new Date(evStart.getTime() + 60 * 60000);
      eventsSorted.shift();
      continue;
    }
    const nextTask = openTasks.shift();
    if (nextTask) {
      blocks.push({ time: hhmm(cursor), label: nextTask.title, type: "task", id: nextTask.id });
      cursor = new Date(cursor.getTime() + 35 * 60000);
      continue;
    }
    break;
  }

  // 2) A deep-work focus block
  const focusStart = new Date(cursor.getTime() + 15 * 60000);
  if (focusStart.getHours() < 19) {
    blocks.push({ time: hhmm(focusStart), label: "Deep focus session · 25 min", type: "focus" });
  }

  // 3) Anchor habits to the evening
  const pendingHabits = habits.filter((h) => !h.days.includes(today)).slice(0, 3);
  if (pendingHabits.length) {
    const t = new Date();
    t.setHours(20, 0, 0, 0);
    if (t.getTime() < Date.now()) t.setTime(Date.now() + 45 * 60000);
    blocks.push({ time: hhmm(t), label: pendingHabits.map((h) => `${h.emoji} ${h.title}`).join(" · "), type: "habit" });
  }

  return blocks.sort((a, b) => a.time.localeCompare(b.time));
}
