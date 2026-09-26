import { useMemo, useState } from "react";
import { ArrowRight, Check, Circle, Flame, Plus, Timer } from "lucide-react";
import { dayKey, useStore, useUI } from "../../store";
import { planToday } from "../../lib/schedule";
import { dueInfo, mmss } from "../../lib/format";
import { BuddyFace } from "../BuddyFace";

function greeting(name: string) {
  const h = new Date().getHours();
  const who = name ? `, ${name}` : "";
  if (h < 5) return `Late night${who}`;
  if (h < 12) return `Good morning${who}`;
  if (h < 18) return `Good afternoon${who}`;
  return `Good evening${who}`;
}

export function TodayView({ openUrl }: { openUrl: (url: string) => void }) {
  const settings = useStore((s) => s.settings);
  const tasks = useStore((s) => s.tasks);
  const habits = useStore((s) => s.habits);
  const events = useStore((s) => s.events);
  const focusLog = useStore((s) => s.focusLog);
  const addTask = useStore((s) => s.addTask);
  const toggleTask = useStore((s) => s.toggleTask);
  const toggleHabitDay = useStore((s) => s.toggleHabitDay);
  const mood = useUI((s) => s.mood);
  const send = useUI((s) => s.send);
  const requestFocus = useUI((s) => s.requestFocus);
  const setTab = useUI((s) => s.setTab);

  const [quick, setQuick] = useState("");

  const today = dayKey();
  const open = useMemo(() => tasks.filter((t) => !t.done), [tasks]);
  const nextUp = useMemo(() => {
    const rank = (t: { due?: string }) => (!t.due ? 2 : t.due < today ? 0 : t.due === today ? 1 : 3);
    return [...open].sort((a, b) => rank(a) - rank(b) || a.createdAt - b.createdAt)[0];
  }, [open, today]);
  const plan = useMemo(() => planToday(tasks, events, habits).slice(0, 4), [tasks, events, habits]);
  const focusToday = focusLog.filter((f) => dayKey(new Date(f.endedAt)) === today);
  const focusMinutes = focusToday.reduce((s, f) => s + f.minutes, 0);

  // last-7-days activity (tasks completed + focus sessions)
  const activity = useMemo(() => {
    const days: Array<{ key: string; count: number; label: string }> = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = dayKey(d);
      const count = tasks.filter((t) => t.completedAt && dayKey(new Date(t.completedAt)) === key).length;
      days.push({ key, count, label: d.toLocaleDateString([], { weekday: "narrow" }) });
    }
    return days;
  }, [tasks]);
  const maxActivity = Math.max(1, ...activity.map((a) => a.count));

  const todayHabits = habits.slice(0, 5);
  const dateStr = new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  const quickAdd = () => {
    const t = quick.trim();
    if (!t) return;
    addTask(t, today);
    setQuick("");
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {/* hero */}
      <div className="px-4 pt-4">
        <div className="rounded-3xl bg-card ring-1 ring-line p-4 flex items-center gap-3.5 shadow-card">
          <BuddyFace size={84} mood={mood} className="bob shrink-0" />
          <div className="min-w-0">
            <div className="text-[17px] font-extrabold tracking-tight leading-tight">{greeting(settings.userName)}</div>
            <div className="text-[12px] text-muted mt-0.5">{dateStr}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-sunken px-2 py-0.5 text-[10.5px] font-bold text-muted">
                {open.length} open
              </span>
              <span className="rounded-full bg-sunken px-2 py-0.5 text-[10.5px] font-bold text-muted">
                {events.filter((e) => e.date === today).length} events
              </span>
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-bold text-accent">
                {focusMinutes}m focus
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* quick capture */}
      <div className="px-4 mt-3">
        <div className="flex items-center gap-2 rounded-2xl bg-card ring-1 ring-line px-3 py-2 focus-within:ring-accent/50 transition">
          <Plus className="h-4 w-4 text-muted shrink-0" />
          <input
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && quickAdd()}
            placeholder="Quick task — press Enter…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint min-w-0"
          />
        </div>
      </div>

      {/* next up */}
      {nextUp && (
        <div className="px-4 mt-3">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted mb-1.5">Next up</div>
          <div className="rounded-2xl bg-card ring-1 ring-line p-3 flex items-center gap-3 shadow-card">
            <button
              onClick={() => toggleTask(nextUp.id)}
              className="shrink-0 rounded-full text-muted hover:text-good transition"
              title="Mark done"
            >
              <Circle className="h-6 w-6" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold truncate">{nextUp.title}</div>
              {nextUp.due && <div className="text-[11px] text-muted">{dueInfo(nextUp.due).label}</div>}
            </div>
            <button
              onClick={() => requestFocus(25)}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-ink text-panel px-3 py-1.5 text-[11.5px] font-bold hover:opacity-90 active:scale-95 transition"
            >
              <Timer className="h-3.5 w-3.5" /> Focus
            </button>
          </div>
        </div>
      )}

      {/* plan preview */}
      <div className="px-4 mt-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Your day</span>
          <button
            onClick={() => send("Plan my day")}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-accent hover:underline"
          >
            Full plan <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        <div className="rounded-2xl bg-card ring-1 ring-line divide-y divide-line overflow-hidden shadow-card">
          {plan.length === 0 && (
            <div className="px-3.5 py-3 text-[12.5px] text-muted">
              Nothing scheduled — add a task and I’ll shape the day around it.
            </div>
          )}
          {plan.map((b, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3.5 py-2.5">
              <span className="text-[11px] font-bold tabular-nums text-muted w-[38px] shrink-0">{b.time}</span>
              <span
                className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                  b.type === "event" ? "bg-accent" : b.type === "task" ? "bg-good" : b.type === "focus" ? "bg-amber-400" : "bg-sky-400"
                }`}
              />
              <span className="text-[12.5px] font-medium truncate">{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* habits strip */}
      {todayHabits.length > 0 && (
        <div className="px-4 mt-3">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted mb-1.5">Habits today</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {todayHabits.map((h) => {
              const done = h.days.includes(today);
              return (
                <button
                  key={h.id}
                  onClick={() => toggleHabitDay(h.id, today)}
                  className={`shrink-0 flex items-center gap-2 rounded-2xl px-3 py-2 ring-1 transition ${
                    done ? "bg-good/10 ring-good/40" : "bg-card ring-line hover:ring-accent/40"
                  }`}
                >
                  <span className={`text-[15px] ${done ? "" : "grayscale opacity-70"}`}>{h.emoji}</span>
                  <span className={`text-[12px] font-semibold ${done ? "line-through text-muted" : ""}`}>{h.title}</span>
                  {done && <Check className="h-3.5 w-3.5 text-good" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* activity + actions */}
      <div className="px-4 mt-3 pb-4">
        <div className="rounded-2xl bg-card ring-1 ring-line p-3.5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Activity · last 7 days</span>
            <span className="text-[11px] font-bold text-accent">{activity.reduce((s, a) => s + a.count, 0)} done</span>
          </div>
          <div className="mt-2.5 flex items-end gap-1.5 h-14">
            {activity.map((a) => (
              <div key={a.key} className="flex-1 flex flex-col items-center gap-1" title={`${a.count} completed`}>
                <div
                  className="w-full rounded-t-md bg-accent/80 min-h-[3px] transition-all"
                  style={{ height: `${Math.round((a.count / maxActivity) * 40) + (a.count ? 4 : 3)}px` }}
                />
                <span className="text-[9px] text-faint font-bold">{a.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => requestFocus(25)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-accent text-accent-ink px-3 py-2 text-[12px] font-bold hover:brightness-105 active:scale-95 transition"
            >
              <Timer className="h-3.5 w-3.5" /> Focus 25
            </button>
            <button
              onClick={() => setTab("tasks")}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-ink text-panel px-3 py-2 text-[12px] font-bold hover:opacity-90 active:scale-95 transition"
            >
              <Flame className="h-3.5 w-3.5" /> {open.length} tasks
            </button>
            <button
              onClick={() => openUrl(`${settings.studioUrl.replace(/\/$/, "")}/studio/video`)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-card ring-1 ring-line text-ink px-3 py-2 text-[12px] font-bold hover:ring-accent/40 transition"
            >
              Studio <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="mt-2 text-center text-[10px] text-faint font-medium">
          {focusToday.length > 0 ? `${mmss(focusMinutes * 60)} of focus banked today` : "Tip: ask “plan my day” in chat"}
        </div>
      </div>
    </div>
  );
}
