import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  ClipboardCopy,
  Download,
  ExternalLink,
  Flame,
  ListChecks,
  Play,
  StickyNote,
  Timer,
} from "lucide-react";
import type { Card, Task } from "../../lib/types";
import { useStore, useUI } from "../../store";
import { dueInfo } from "../../lib/format";

/* ── markdown-lite text renderer ───────────────────────────────────────── */

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} className="font-bold">{p.slice(2, -2)}</strong>;
        if (p.startsWith("`") && p.endsWith("`"))
          return (
            <code key={i} className="rounded bg-sunken px-1 py-px text-[12px] font-mono">
              {p.slice(1, -1)}
            </code>
          );
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

export function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) =>
        line.trim() === "" ? <div key={i} className="h-1.5" /> : (
          <div key={i} className="leading-relaxed">
            <Inline text={line} />
          </div>
        )
      )}
    </div>
  );
}

/* ── cards ─────────────────────────────────────────────────────────────── */

function TaskRow({ taskId }: { taskId: string }) {
  const task = useStore((s) => s.tasks.find((t) => t.id === taskId));
  const toggle = useStore((s) => s.toggleTask);
  if (!task) return null;
  return <SingleTask task={task} onToggle={() => toggle(task.id)} />;
}

function SingleTask({ task, onToggle }: { task: Task; onToggle: () => void }) {
  const due = dueInfo(task.due);
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2.5 rounded-xl bg-sunken px-3 py-2.5 text-left hover:bg-sunken/70 transition group"
    >
      {task.done ? (
        <CheckCircle2 className="h-[18px] w-[18px] text-good shrink-0" />
      ) : (
        <Circle className="h-[18px] w-[18px] text-muted shrink-0 group-hover:text-accent transition" />
      )}
      <span className={`flex-1 text-[13px] font-medium ${task.done ? "line-through text-muted" : ""}`}>{task.title}</span>
      {due.tone !== "none" && (
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
            due.tone === "overdue" ? "bg-red-400/15 text-red-500" : due.tone === "today" ? "bg-accent-soft text-accent" : "bg-card text-muted ring-1 ring-line"
          }`}
        >
          {due.label}
        </span>
      )}
    </button>
  );
}

export function ChatCard({ card, openUrl }: { card: Card; openUrl: (url: string) => void }) {
  const setTab = useUI((s) => s.setTab);
  const requestFocus = useUI((s) => s.requestFocus);
  const toggleTask = useStore((s) => s.toggleTask);
  const [copied, setCopied] = useState(false);

  switch (card.kind) {
    case "task":
      return (
        <div className="mt-1.5">
          <TaskRow taskId={card.taskId} />
        </div>
      );
    case "tasks":
      return (
        <div className="mt-1.5 space-y-1.5">
          {card.tasks.map((t) => (
            <SingleTask key={t.id} task={{ ...t, createdAt: 0 }} onToggle={() => toggleTask(t.id)} />
          ))}
        </div>
      );
    case "plan":
      return (
        <div className="mt-1.5 rounded-2xl bg-card ring-1 ring-line overflow-hidden">
          <div className="px-3 py-2 text-[10.5px] font-bold uppercase tracking-wider text-muted bg-sunken flex items-center gap-1.5">
            <ListChecks className="h-3.5 w-3.5" /> Today’s plan
          </div>
          <div className="divide-y divide-line">
            {card.blocks.map((b, i) => (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2">
                <span className="text-[11px] font-bold tabular-nums text-muted w-[38px]">{b.time}</span>
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
      );
    case "note":
      return (
        <button
          onClick={() => setTab("notes")}
          className="mt-1.5 w-full flex items-start gap-2.5 rounded-2xl bg-card ring-1 ring-line px-3 py-2.5 text-left hover:ring-accent/40 transition"
        >
          <StickyNote className="h-4 w-4 text-accent shrink-0 mt-0.5" />
          <span className="text-[12.5px] text-ink/90 line-clamp-2">{card.preview}</span>
        </button>
      );
    case "habit":
      return (
        <div className="mt-1.5 inline-flex items-center gap-2 rounded-full bg-card ring-1 ring-line px-3.5 py-2 text-[13px] font-semibold">
          <span>{card.emoji}</span> {card.title} <Flame className="h-3.5 w-3.5 text-accent" />
        </div>
      );
    case "focus":
      return (
        <button
          onClick={() => requestFocus(card.minutes)}
          className="mt-1.5 inline-flex items-center gap-2 rounded-full bg-accent text-accent-ink px-4 py-2.5 text-[13px] font-bold hover:brightness-105 active:scale-95 transition shadow-pill"
        >
          <Play className="h-4 w-4" /> Start {card.minutes}-minute focus
        </button>
      );
    case "script":
      return (
        <div className="mt-1.5 rounded-2xl bg-card ring-1 ring-line overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-sunken">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted">{card.topic}</span>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(card.body);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-ink transition"
            >
              {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-good" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="px-3 py-2.5 text-[12.5px] leading-relaxed whitespace-pre-wrap font-sans text-ink/90 max-h-44 overflow-y-auto">
            {card.body}
          </pre>
        </div>
      );
    case "video":
      return (
        <div className="mt-1.5 rounded-2xl bg-card ring-1 ring-line overflow-hidden">
          {card.videoUrl && (
            <video src={card.videoUrl} controls playsInline className="w-full max-h-56 bg-black" />
          )}
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-[12px] font-semibold truncate">{card.title}</span>
            {card.downloadUrl && (
              <a
                href={card.downloadUrl}
                download
                className="inline-flex items-center gap-1.5 text-[12px] font-bold text-accent hover:underline"
              >
                <Download className="h-3.5 w-3.5" /> Save
              </a>
            )}
          </div>
        </div>
      );
    case "links":
      return (
        <div className="mt-1.5 flex flex-wrap gap-2">
          {card.links.map((l) => (
            <button
              key={l.url}
              onClick={() => openUrl(l.url)}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink text-panel px-3.5 py-2 text-[12.5px] font-bold hover:opacity-90 active:scale-95 transition"
            >
              {l.label} <ExternalLink className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      );
    default:
      return null;
  }
}

export function FocusMini({ minutes }: { minutes: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent">
      <Timer className="h-3.5 w-3.5" /> {minutes}m
    </span>
  );
}
