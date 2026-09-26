import { useMemo, useState } from "react";
import { Check, CheckCircle2, ChevronDown, Circle, Plus, Trash2 } from "lucide-react";
import { addDays, dayKey, useStore, useUI } from "../../store";
import type { Task } from "../../lib/types";
import { dueInfo } from "../../lib/format";

type DuePick = "today" | "tomorrow" | "none";

function dueFromPick(pick: DuePick): string | undefined {
  if (pick === "today") return dayKey();
  if (pick === "tomorrow") return dayKey(addDays(new Date(), 1));
  return undefined;
}

function TaskItem({ task }: { task: Task }) {
  const toggle = useStore((s) => s.toggleTask);
  const remove = useStore((s) => s.removeTask);
  const due = dueInfo(task.due);
  return (
    <div className="group flex items-center gap-2.5 rounded-2xl bg-card ring-1 ring-line px-3 py-2.5 shadow-card hover:ring-accent/30 transition">
      <button
        onClick={() => toggle(task.id)}
        className={`shrink-0 rounded-full transition ${task.done ? "text-good" : "text-muted hover:text-accent"}`}
        title={task.done ? "Mark open" : "Mark done"}
      >
        {task.done ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
      </button>
      <span className={`flex-1 text-[13.5px] font-medium min-w-0 truncate ${task.done ? "line-through text-muted" : ""}`}>
        {task.title}
      </span>
      {due.tone !== "none" && !task.done && (
        <span
          className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
            due.tone === "overdue"
              ? "bg-red-400/15 text-red-500"
              : due.tone === "today"
              ? "bg-accent-soft text-accent"
              : "bg-sunken text-muted"
          }`}
        >
          {due.label}
        </span>
      )}
      <button
        onClick={() => remove(task.id)}
        className="shrink-0 rounded-lg p-1 text-faint opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-400/10 transition"
        title="Delete"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function TasksView() {
  const tasks = useStore((s) => s.tasks);
  const addTask = useStore((s) => s.addTask);
  const send = useUI((s) => s.send);
  const [title, setTitle] = useState("");
  const [pick, setPick] = useState<DuePick>("today");
  const [showDone, setShowDone] = useState(false);

  const today = dayKey();

  const { overdue, todayList, upcoming, someday, done } = useMemo(() => {
    const buckets = { overdue: [] as Task[], todayList: [] as Task[], upcoming: [] as Task[], someday: [] as Task[], done: [] as Task[] };
    for (const t of tasks) {
      if (t.done) buckets.done.push(t);
      else if (!t.due) buckets.someday.push(t);
      else if (t.due < today) buckets.overdue.push(t);
      else if (t.due === today) buckets.todayList.push(t);
      else buckets.upcoming.push(t);
    }
    const sort = (a: Task, b: Task) => (a.due || "9999").localeCompare(b.due || "9999") || b.createdAt - a.createdAt;
    Object.values(buckets).forEach((arr) => arr.sort(sort));
    return buckets;
  }, [tasks, today]);

  const add = () => {
    const t = title.trim();
    if (!t) return;
    addTask(t, dueFromPick(pick));
    setTitle("");
  };

  const Section = ({ label, list, tint }: { label: string; list: Task[]; tint?: string }) =>
    list.length ? (
      <div className="mt-3.5 first:mt-0">
        <div className={`flex items-center gap-1.5 mb-1.5 text-[10.5px] font-bold uppercase tracking-wider ${tint || "text-muted"}`}>
          {label}
          <span className="text-faint">· {list.length}</span>
        </div>
        <div className="space-y-1.5">
          {list.map((t) => (
            <TaskItem key={t.id} task={t} />
          ))}
        </div>
      </div>
    ) : null;

  const openCount = overdue.length + todayList.length + upcoming.length + someday.length;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 px-4 pt-3.5 pb-2 border-b border-line">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[16px] font-extrabold tracking-tight">Tasks</h2>
          <span className="text-[11px] font-bold text-muted">{openCount} open</span>
        </div>
        <div className="mt-2.5 flex items-center gap-1.5 rounded-[18px] bg-card ring-1 ring-line px-2.5 py-1.5 focus-within:ring-accent/50 transition">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Add a task…"
            className="flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-faint min-w-0"
          />
          <div className="flex gap-1 shrink-0">
            {(["today", "tomorrow", "none"] as DuePick[]).map((p) => (
              <button
                key={p}
                onClick={() => setPick(p)}
                className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition ${
                  pick === p ? "bg-accent text-accent-ink" : "bg-sunken text-muted hover:text-ink"
                }`}
              >
                {p === "none" ? "someday" : p}
              </button>
            ))}
          </div>
          <button
            onClick={add}
            disabled={!title.trim()}
            className="shrink-0 rounded-full p-1.5 bg-accent text-accent-ink disabled:opacity-35 hover:brightness-105 active:scale-90 transition"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        <Section label="Overdue" list={overdue} tint="text-red-500" />
        <Section label="Today" list={todayList} tint="text-accent" />
        <Section label="Upcoming" list={upcoming} />
        <Section label="Someday" list={someday} />

        {done.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowDone((v) => !v)}
              className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider text-muted hover:text-ink transition"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDone ? "" : "-rotate-90"}`} />
              Done · {done.length}
            </button>
            {showDone && (
              <div className="mt-1.5 space-y-1.5">
                {done.slice(0, 12).map((t) => (
                  <TaskItem key={t.id} task={t} />
                ))}
              </div>
            )}
          </div>
        )}

        {openCount === 0 && (
          <div className="text-center pt-10 text-muted">
            <Check className="h-9 w-9 mx-auto text-good" />
            <p className="mt-2 text-[13.5px] font-semibold text-ink">All clear</p>
            <p className="text-[12.5px]">Add one above, or ask Echo to “plan my day”.</p>
            <button
              onClick={() => send("Plan my day")}
              className="mt-3 rounded-full bg-accent text-accent-ink px-4 py-2 text-[12.5px] font-bold hover:brightness-105 transition"
            >
              Plan my day
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
