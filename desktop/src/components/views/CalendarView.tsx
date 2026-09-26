import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { dayKey, useStore } from "../../store";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView() {
  const events = useStore((s) => s.events);
  const addEvent = useStore((s) => s.addEvent);
  const removeEvent = useStore((s) => s.removeEvent);

  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(() => dayKey());
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("09:00");

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: Array<{ key: string; day: number; inMonth: boolean }> = [];
    for (let i = 0; i < startPad; i += 1) {
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), -(startPad - 1 - i));
      cells.push({ key: dayKey(d), day: d.getDate(), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
      cells.push({ key: dayKey(new Date(cursor.getFullYear(), cursor.getMonth(), d)), day: d, inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, cells.length - startPad - daysInMonth + 1);
      cells.push({ key: dayKey(last), day: last.getDate(), inMonth: false });
    }
    return cells;
  }, [cursor]);

  const dayEvents = events.filter((e) => e.date === selected);
  const selectedDate = new Date(`${selected}T00:00:00`);

  const add = () => {
    const t = title.trim();
    if (!t) return;
    addEvent(t, selected, time);
    setTitle("");
  };

  const shiftMonth = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 px-4 pt-3.5 pb-2 border-b border-line flex items-center justify-between">
        <h2 className="text-[16px] font-extrabold tracking-tight">
          {cursor.toLocaleDateString([], { month: "long", year: "numeric" })}
        </h2>
        <div className="flex gap-1">
          <button onClick={() => shiftMonth(-1)} className="rounded-full p-1.5 text-muted hover:text-ink hover:bg-card transition">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => shiftMonth(1)} className="rounded-full p-1.5 text-muted hover:text-ink hover:bg-card transition">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        {/* weekday header */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-center text-[9.5px] font-bold uppercase tracking-wider text-faint">
              {w}
            </div>
          ))}
        </div>

        {/* day cells */}
        <div className="grid grid-cols-7 gap-1">
          {grid.map((c) => {
            const isToday = c.key === dayKey();
            const isSel = c.key === selected;
            const hasEvent = events.some((e) => e.date === c.key);
            return (
              <button
                key={`${c.key}-${c.day}`}
                onClick={() => setSelected(c.key)}
                className={`relative aspect-square rounded-xl text-[12.5px] font-semibold transition flex items-center justify-center ${
                  isSel
                    ? "bg-accent text-accent-ink shadow-pill"
                    : isToday
                    ? "bg-accent-soft text-accent ring-1 ring-accent/40"
                    : c.inMonth
                    ? "bg-card text-ink ring-1 ring-line hover:ring-accent/40"
                    : "text-faint/60 hover:bg-card/50"
                }`}
              >
                {c.day}
                {hasEvent && !isSel && (
                  <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent" />
                )}
              </button>
            );
          })}
        </div>

        {/* selected day */}
        <div className="mt-4">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[12.5px] font-extrabold tracking-tight">
              {selectedDate.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
            </span>
            <span className="text-[10.5px] font-bold text-muted">{dayEvents.length} events</span>
          </div>

          <div className="space-y-1.5">
            {dayEvents.length === 0 && (
              <div className="rounded-2xl bg-card ring-1 ring-line px-3.5 py-3 text-[12.5px] text-muted flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-faint" /> Nothing booked — space to think.
              </div>
            )}
            {dayEvents.map((e) => (
              <div key={e.id} className="group flex items-center gap-2.5 rounded-2xl bg-card ring-1 ring-line px-3 py-2.5 shadow-card">
                <span className="text-[11.5px] font-bold tabular-nums text-accent w-[42px] shrink-0">{e.time}</span>
                <span className="flex-1 text-[13px] font-medium truncate">{e.title}</span>
                <button
                  onClick={() => removeEvent(e.id)}
                  className="rounded-lg p-1 text-faint opacity-0 group-hover:opacity-100 hover:text-red-500 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* add */}
          <div className="mt-2.5 flex items-center gap-1.5">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="Add event to this day…"
              className="flex-1 min-w-0 rounded-[15px] bg-card ring-1 ring-line px-3 py-2.5 text-[13px] outline-none focus:ring-accent/50 transition placeholder:text-faint"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded-[15px] bg-card ring-1 ring-line px-2 py-2.5 text-[12.5px] font-semibold outline-none focus:ring-accent/50 transition"
            />
            <button
              onClick={add}
              disabled={!title.trim()}
              className="shrink-0 rounded-full p-2 bg-accent text-accent-ink disabled:opacity-35 hover:brightness-105 active:scale-90 transition"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="h-3" />
      </div>
    </div>
  );
}
