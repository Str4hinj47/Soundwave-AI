import { useMemo, useState } from "react";
import { ArrowLeft, Plus, Search, StickyNote, Trash2 } from "lucide-react";
import { useStore } from "../../store";
import { relTime } from "../../lib/format";

export function NotesView() {
  const notes = useStore((s) => s.notes);
  const addNote = useStore((s) => s.addNote);
  const updateNote = useStore((s) => s.updateNote);
  const removeNote = useStore((s) => s.removeNote);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? notes.filter((n) => n.body.toLowerCase().includes(q)) : notes;
    return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes, query]);

  const openNote = openId ? notes.find((n) => n.id === openId) : undefined;

  if (openNote) {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-line">
          <button onClick={() => setOpenId(null)} className="rounded-full p-1.5 text-muted hover:text-ink hover:bg-card transition">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-[12px] text-muted flex-1 truncate">{relTime(openNote.updatedAt)} edited</span>
          <button
            onClick={() => {
              removeNote(openNote.id);
              setOpenId(null);
            }}
            className="rounded-full p-1.5 text-muted hover:text-red-500 hover:bg-red-400/10 transition"
            title="Delete note"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <textarea
          autoFocus
          value={openNote.body}
          onChange={(e) => updateNote(openNote.id, e.target.value)}
          placeholder="Write it down before it floats away…"
          className="flex-1 min-h-0 w-full resize-none bg-transparent px-4 py-3.5 text-[14px] leading-relaxed outline-none placeholder:text-faint"
        />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 px-4 pt-3.5 pb-2.5 border-b border-line">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[16px] font-extrabold tracking-tight">Notes</h2>
          <button
            onClick={() => {
              const n = addNote("");
              setOpenId(n.id);
            }}
            className="inline-flex items-center gap-1 rounded-full bg-accent text-accent-ink px-2.5 py-1 text-[11.5px] font-bold hover:brightness-105 active:scale-95 transition"
          >
            <Plus className="h-3.5 w-3.5" /> New
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-[16px] bg-card ring-1 ring-line px-3 py-2 focus-within:ring-accent/50 transition">
          <Search className="h-3.5 w-3.5 text-muted shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint min-w-0"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        {filtered.length === 0 ? (
          <div className="text-center pt-12 text-muted">
            <StickyNote className="h-9 w-9 mx-auto text-faint" />
            <p className="mt-2 text-[13.5px] font-semibold text-ink">{query ? "Nothing matches" : "No notes yet"}</p>
            <p className="text-[12.5px]">{query ? "Try another word." : "Tell Echo “note buy milk” or hit New."}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((n) => (
              <button
                key={n.id}
                onClick={() => setOpenId(n.id)}
                className="w-full text-left rounded-2xl bg-card ring-1 ring-line px-3.5 py-3 shadow-card hover:ring-accent/40 transition group"
              >
                <p className="text-[13.5px] leading-snug line-clamp-3 whitespace-pre-wrap break-words">
                  {n.body || <span className="text-faint italic">Empty note…</span>}
                </p>
                <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-faint font-semibold">
                  <span>{relTime(n.updatedAt)}</span>
                  <span className="opacity-0 group-hover:opacity-100 text-accent">Open →</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
