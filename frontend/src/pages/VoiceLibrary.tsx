import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mic, Play, Square } from "lucide-react";
import { Navbar } from "../components/layout/Navbar";
import { Badge } from "../components/ui/Badge";
import { DEFAULT_VOICES } from "../lib/voices";
import { STANDALONE } from "../lib/env";
import { synthesizeBrowserEdge } from "../lib/edgeTtsBrowser";
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

  // Standalone build has no pre-generated server samples — synthesize a short
  // preview line on demand instead (cached per voice for the session).
  const sampleCache = useRef(new Map<string, string>());
  const synthSample = async (id: string): Promise<void> => {
    if (playing === id) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    setPlaying(id);
    try {
      let url = sampleCache.current.get(id);
      if (!url) {
        const res = await synthesizeBrowserEdge(`Hi! I'm ${id.split("-").slice(-1)[0]}. This is how I sound narrating your videos.`, id, {}, { timeoutMs: 25_000 });
        const bytes = Uint8Array.from(atob(res.audioBase64), (c) => c.charCodeAt(0));
        url = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
        sampleCache.current.set(id, url);
      }
      if (audioRef.current) {
        audioRef.current.src = url;
        void audioRef.current.play();
      }
    } catch {
      setPlaying(null);
    }
  };

  const toggle = (id: string, url: string) => {
    if (STANDALONE) {
      void synthSample(id);
      return;
    }
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
    <div className={standalone ? "min-h-screen bg-navy" : undefined}>
      {standalone && <Navbar />}
      <audio ref={audioRef} onEnded={() => setPlaying(null)} className="hidden" />
      <div
        className={cn(
          "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8",
          // Standalone clears the fixed marketing navbar; embedded in AppShell
          // the <main> area already provides horizontal padding + top spacing.
          standalone ? "pb-24 pt-28" : "pb-16 pt-2",
        )}
      >
        <h1 className="text-4xl font-extrabold text-white">Voice Library</h1>
        <p className="mt-2 max-w-xl text-gray-400">
          Every Microsoft Neural voice, with a pre-generated sample. Tap any card to hear the real voice.
        </p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search voices…"
            className="w-full rounded-input border border-gray-700 bg-gray-900 px-3.5 py-2.5 text-white placeholder-gray-500 sm:max-w-xs"
            aria-label="Search voices"
          />
          <div className="flex flex-wrap gap-2">
            {(["all", "Female", "Male"] as GenderFilter[]).map((g) => (
              <FilterChip key={g} active={gender === g} onClick={() => setGender(g)}>
                {g === "all" ? "All genders" : g}
              </FilterChip>
            ))}
            <span className="mx-1 hidden w-px bg-gray-800 sm:block" />
            {(["all", "American", "British"] as AccentFilter[]).map((a) => (
              <FilterChip key={a} active={accent === a} onClick={() => setAccent(a)}>
                {a === "all" ? "All accents" : a}
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((v) => (
            <div key={v.id} className="flex flex-col gap-3 rounded-card border border-gray-800 bg-panel p-5 transition-all duration-200 hover:border-blue-500/50">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggle(v.id, v.sampleUrl)}
                  aria-label={playing === v.id ? `Stop ${v.displayName}` : `Play ${v.displayName} sample`}
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-all duration-200",
                    playing === v.id ? "bg-gradient-to-r from-blue-500 to-violet-500 text-white" : "bg-gray-800 text-gray-300 hover:text-white",
                  )}
                >
                  {playing === v.id ? <Square className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{v.displayName}</p>
                  <p className="truncate font-mono text-xs text-gray-500">{v.id}</p>
                </div>
                {playing === v.id && (
                  <span className="flex items-end gap-0.5" aria-hidden="true">
                    <span className="h-4 w-0.5 animate-eq1 bg-violet-400" />
                    <span className="h-4 w-0.5 animate-eq2 bg-blue-400" />
                    <span className="h-4 w-0.5 animate-eq3 bg-violet-400" />
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Badge tone={v.gender === "Female" ? "violet" : "blue"}>{v.gender}</Badge>
                <Badge tone="gray">{v.accent}</Badge>
              </div>
              <button
                onClick={() => navigate(user ? `/studio?voice=${v.id}` : "/signup")}
                className="mt-auto flex h-10 w-full items-center justify-center gap-2 rounded-btn border border-gray-600 text-sm font-semibold text-gray-200 transition-all duration-200 hover:border-blue-500/70 hover:text-white"
              >
                <Mic className="h-4 w-4" /> Use This Voice
              </button>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="mt-12 text-center text-gray-500">
            <p>No voices match your filters.</p>
            <Link to="/" className="mt-2 inline-block text-blue-400 hover:text-blue-300">← Back home</Link>
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
        active ? "border-blue-500/60 bg-blue-500/15 text-white" : "border-gray-700 text-gray-400 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}
