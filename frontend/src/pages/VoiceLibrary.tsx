import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mic, Play, Square } from "lucide-react";
import { Navbar } from "../components/layout/Navbar";
import { Badge } from "../components/ui/Badge";
import { DEFAULT_VOICES } from "../lib/voices";
import { cn } from "../lib/cn";
import { useAuth } from "../store/auth";

type GenderFilter = "all" | "Female" | "Male";
type AccentFilter = "all" | "American" | "British";

export function VoiceLibrary({ standalone = true }: { standalone?: boolean }) {
  const [query, setQuery] = useState("");
  const [gender, setGender] = useState<GenderFilter>("all");
  const [accent, setAccent] = useState<AccentFilter>("all");
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DEFAULT_VOICES.filter(
      (v) =>
        (gender === "all" || v.gender === gender) &&
        (accent === "all" || v.accent === accent) &&
        (!q || v.displayName.toLowerCase().includes(q) || v.id.toLowerCase().includes(q)),
    );
  }, [query, gender, accent]);

  const toggle = (id: string, url: string) => {
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
    <div className="min-h-screen bg-canvas">
      {standalone && <Navbar />}
      <audio ref={audioRef} onEnded={() => setPlaying(null)} className="hidden" />
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-28 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-semibold text-fg">Voice Library</h1>
        <p className="mt-2 max-w-xl text-muted">
          Every Microsoft Neural voice, with a pre-generated sample. Tap any card to hear the real voice.
        </p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search voices…"
            className="w-full rounded-input border border-line-strong bg-sunken px-3.5 py-2.5 text-fg placeholder-faint sm:max-w-xs"
            aria-label="Search voices"
          />
          <div className="flex flex-wrap gap-2">
            {(["all", "Female", "Male"] as GenderFilter[]).map((g) => (
              <FilterChip key={g} active={gender === g} onClick={() => setGender(g)}>
                {g === "all" ? "All genders" : g}
              </FilterChip>
            ))}
            <span className="mx-1 hidden w-px bg-tint sm:block" />
            {(["all", "American", "British"] as AccentFilter[]).map((a) => (
              <FilterChip key={a} active={accent === a} onClick={() => setAccent(a)}>
                {a === "all" ? "All accents" : a}
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((v) => (
            <div key={v.id} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5 transition-colors duration-200 hover:border-line-emphasis">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggle(v.id, v.sampleUrl)}
                  aria-label={playing === v.id ? `Stop ${v.displayName}` : `Play ${v.displayName} sample`}
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-all duration-200",
                    playing === v.id ? "bg-accent text-accent-ink" : "bg-tint text-fg-soft hover:text-fg",
                  )}
                >
                  {playing === v.id ? <Square className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-fg">{v.displayName}</p>
                  <p className="truncate font-mono text-xs text-faint">{v.id}</p>
                </div>
                {playing === v.id && (
                  <span className="flex items-end gap-0.5" aria-hidden="true">
                    <span className="h-4 w-0.5 animate-eq1 bg-accent/60" />
                    <span className="h-4 w-0.5 animate-eq2 bg-accent" />
                    <span className="h-4 w-0.5 animate-eq3 bg-accent/60" />
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Badge tone={v.gender === "Female" ? "violet" : "blue"}>{v.gender}</Badge>
                <Badge tone="gray">{v.accent}</Badge>
              </div>
              <button
                onClick={() => navigate(user ? `/studio?voice=${v.id}` : "/signup")}
                className="mt-auto flex h-10 w-full items-center justify-center gap-2 rounded-btn border border-line-emphasis text-sm font-semibold text-fg-soft transition-all duration-200 hover:border-accent/70 hover:text-fg"
              >
                <Mic className="h-4 w-4" /> Use This Voice
              </button>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="mt-12 text-center text-faint">
            <p>No voices match your filters.</p>
            <Link to="/" className="mt-2 inline-block text-accent hover:text-accent-strong">← Back home</Link>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm transition-all duration-200",
        active ? "border-accent/60 bg-accent/15 text-fg" : "border-line-strong text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
