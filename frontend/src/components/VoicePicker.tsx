import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Mic, Play, Search, Square } from "lucide-react";
import { cn } from "../lib/cn";
import type { VoiceInfo } from "../lib/types";
import { groupVoices } from "../lib/voices";
import { Badge } from "./ui/Badge";

interface VoicePickerProps {
  voices: VoiceInfo[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

/** Voice selector with search, accent/gender grouping, and inline samples. */
export function VoicePicker({ voices, value, onChange, disabled }: VoicePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return voices;
    return voices.filter((v) => v.displayName.toLowerCase().includes(q) || v.id.toLowerCase().includes(q) || v.accent.toLowerCase().includes(q));
  }, [voices, query]);

  const groups = useMemo(() => groupVoices(filtered), [filtered]);
  const selected = voices.find((v) => v.id === value);

  const toggleSample = (id: string, url: string) => {
    if (playing === id) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.src = url;
      void audioRef.current.play();
    }
    setPlaying(id);
  };

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <audio ref={audioRef} onEnded={() => setPlaying(null)} className="hidden" />
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 w-full min-w-0 items-center gap-2.5 rounded-input border border-gray-700 bg-gray-900 px-3.5 text-left transition-all duration-200 hover:border-gray-600 focus:border-blue-500 disabled:opacity-50"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/25 to-violet-500/25 text-blue-300">
          <Mic className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base text-white">{selected?.displayName ?? "Select a voice"}</span>
          <span className="block truncate text-xs text-gray-500">
            {selected ? `${selected.gender} · ${selected.accent} · ${selected.id}` : "6 voices available"}
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-gray-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-20 mt-1.5 overflow-hidden rounded-card border border-gray-700 bg-panel shadow-2xl">
          <div className="flex items-center gap-2 border-b border-gray-800 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-gray-500" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search voices…"
              className="w-full min-w-0 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {Object.keys(groups).length === 0 && <p className="px-4 py-3 text-sm text-gray-500">No voices found</p>}
            {Object.entries(groups).map(([group, list]) => (
              <div key={group}>
                <div className="px-3 pb-0.5 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{group}</div>
                {list.map((v) => (
                  <div
                    key={v.id}
                    role="option"
                    aria-selected={v.id === value}
                    className={cn("flex items-center gap-2 px-3 py-2", v.id === value && "bg-blue-500/10")}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSample(v.id, v.sampleUrl)}
                      aria-label={playing === v.id ? `Stop ${v.displayName} sample` : `Play ${v.displayName} sample`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-800 text-gray-300 transition-colors hover:text-white"
                    >
                      {playing === v.id ? <Square className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}
                    </button>
                    <button type="button" onClick={() => { onChange(v.id); setOpen(false); }} className="min-w-0 flex-1 text-left">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-white">{v.displayName}</span>
                        <Badge tone={v.gender === "Female" ? "violet" : "blue"} className="hidden sm:inline-flex">{v.gender}</Badge>
                      </span>
                      <span className="block truncate font-mono text-xs text-gray-500">{v.id}</span>
                    </button>
                    {v.id === value && <Check className="h-4 w-4 shrink-0 text-blue-400" />}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
