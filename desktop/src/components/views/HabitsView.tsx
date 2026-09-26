import { useState } from "react";
import { Flame, Plus, Trash2 } from "lucide-react";
import { addDays, dayKey, useStore } from "../../store";
import { streakOf } from "../../lib/brain";

const EMOJIS = ["💧", "🏃", "📖", "🧘", "💊", "🌱", "✍️", "🛌", "🎧", "💪", "🚰", "🍎"];

export function HabitsView() {
  const habits = useStore((s) => s.habits);
  const addHabit = useStore((s) => s.addHabit);
  const toggleHabitDay = useStore((s) => s.toggleHabitDay);
  const removeHabit = useStore((s) => s.removeHabit);
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]!);

  const today = dayKey();
  const last7 = Array.from({ length: 7 }).map((_, i) => dayKey(addDays(new Date(), -(6 - i))));

  const add = () => {
    const t = title.trim();
    if (!t) return;
    addHabit(t, emoji);
    setTitle("");
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 px-4 pt-3.5 pb-2.5 border-b border-line">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[16px] font-extrabold tracking-tight">Habits</h2>
          <span className="text-[11px] font-bold text-muted">{habits.length} tracked</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <div className="flex-1 flex items-center gap-2 rounded-[16px] bg-card ring-1 ring-line px-3 py-2 focus-within:ring-accent/50 transition min-w-0">
            <span className="text-[14px] shrink-0">{emoji}</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="New habit…"
              className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint min-w-0"
            />
          </div>
          <button
            onClick={add}
            disabled={!title.trim()}
            className="shrink-0 rounded-full p-2 bg-accent text-accent-ink disabled:opacity-35 hover:brightness-105 active:scale-90 transition"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`shrink-0 h-7 w-7 rounded-lg text-[14px] transition ${
                emoji === e ? "bg-accent-soft ring-1 ring-accent/50 scale-110" : "hover:bg-card"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        {habits.length === 0 ? (
          <div className="text-center pt-12 text-muted">
            <Flame className="h-9 w-9 mx-auto text-faint" />
            <p className="mt-2 text-[13.5px] font-semibold text-ink">Build your first habit</p>
            <p className="text-[12.5px]">Tiny actions, daily — I’ll keep the streak alive.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {habits.map((h) => {
              const streak = streakOf(h.days);
              return (
                <div key={h.id} className="rounded-2xl bg-card ring-1 ring-line px-3.5 py-3 shadow-card group">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[19px]">{h.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-bold truncate">{h.title}</div>
                      <div className="text-[10.5px] text-muted font-semibold flex items-center gap-1">
                        {streak > 0 ? (
                          <>
                            <Flame className="h-3 w-3 text-accent" /> {streak}-day streak
                          </>
                        ) : (
                          "starts today"
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => removeHabit(h.id)}
                      className="rounded-lg p-1.5 text-faint opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-400/10 transition"
                      title="Delete habit"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2.5 flex gap-1.5">
                    {last7.map((day) => {
                      const done = h.days.includes(day);
                      const isToday = day === today;
                      return (
                        <button
                          key={day}
                          onClick={() => toggleHabitDay(h.id, day)}
                          title={day}
                          className={`flex-1 h-8 rounded-lg text-[11px] font-bold transition ${
                            done
                              ? "bg-good text-white"
                              : isToday
                              ? "bg-accent-soft text-accent ring-1 ring-accent/40 hover:ring-accent"
                              : "bg-sunken text-faint hover:bg-line"
                          }`}
                        >
                          {done ? "✓" : new Date(`${day}T00:00:00`).toLocaleDateString([], { day: "numeric" })}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
