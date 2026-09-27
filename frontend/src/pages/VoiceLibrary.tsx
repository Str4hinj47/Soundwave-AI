import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mic,
  Play,
  Square,
  Sparkles,
  Volume2,
} from "lucide-react";
import { Navbar } from "../components/layout/Navbar";
import { Badge } from "../components/ui/Badge";
import { DEFAULT_VOICES } from "../lib/voices";
import { STANDALONE } from "../lib/env";
import { synthesizeBrowserEdge } from "../lib/edgeTtsBrowser";
import { cn } from "../lib/cn";

type GenderFilter = "all" | "Female" | "Male";
type AccentFilter = "all" | "American" | "British";

export function VoiceLibrary({ standalone = true }: { standalone?: boolean }) {
  const [query, setQuery] = useState("");
  const [gender, setGender] = useState<GenderFilter>("all");
  const [accent, setAccent] = useState<AccentFilter>("all");
  const [playing, setPlaying] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
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
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play().catch(() => setPlaying(null));
    audio.onended = () => setPlaying(null);
    setPlaying(id);
  };

  return (
    <div className="min-h-screen bg-canvas text-gray-100">
      {standalone && <Navbar />}

      <main
        className={cn(
          "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8",
          standalone ? "pb-24 pt-28" : "pb-16 pt-2",
        )}
      >
        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-800/80 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-wide flex items-center gap-2.5">
              <Sparkles className="h-7 w-7 text-cyan-400" />
              Neural Voice Library
            </h1>
            <p className="mt-1 max-w-2xl text-xs sm:text-sm text-gray-400">
              Explore ultra-realistic 24kHz neural speech models and expressive narrators engineered for viral shorts and storytelling.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-950/20 px-3 py-1.5 text-xs text-cyan-300 font-mono">
            <Volume2 className="h-4 w-4 text-cyan-400" />
            <span>24kHz Studio Neural Voices Ready</span>
          </div>
        </div>

        {/* ── NEURAL VOICE DIRECTORY ────────────────────────────────────── */}
        <div className="mt-8 space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-800 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono">
                Studio Neural Voice Catalog
              </span>
              <p className="text-xs text-gray-400 mt-0.5">High-RPM narrator voices for documentary, fact videos, and viral vertical shorts.</p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search voices…"
                className="rounded-xl border border-gray-800 bg-[#0C1220] px-3.5 py-1.5 text-xs text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
              />
              <div className="flex flex-wrap gap-1.5">
                {(["all", "Male", "Female"] as GenderFilter[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className={`rounded-lg border px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                      gender === g ? "border-cyan-500 bg-cyan-500/20 text-cyan-300" : "border-gray-800 bg-[#0C1220] text-gray-400 hover:text-white"
                    }`}
                  >
                    {g === "all" ? "All Genders" : g}
                  </button>
                ))}
                {(["all", "American", "British"] as AccentFilter[]).map((a) => (
                  <button
                    key={a}
                    onClick={() => setAccent(a)}
                    className={`rounded-lg border px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                      accent === a ? "border-blue-500 bg-blue-500/20 text-blue-300" : "border-gray-800 bg-[#0C1220] text-gray-400 hover:text-white"
                    }`}
                  >
                    {a === "all" ? "All Accents" : a}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((v) => (
              <div
                key={v.id}
                className="flex flex-col gap-3 rounded-2xl border border-gray-800/80 bg-[#0A101D] p-5 transition-all duration-200 hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-950/20"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggle(v.id, v.sampleUrl)}
                    aria-label={playing === v.id ? `Stop ${v.displayName}` : `Play ${v.displayName} sample`}
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-200 cursor-pointer",
                      playing === v.id
                        ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-[#070B14] shadow-md shadow-cyan-500/30"
                        : "bg-[#070B14] border border-gray-800 text-gray-300 hover:text-cyan-400 hover:border-cyan-500/40",
                    )}
                  >
                    {playing === v.id ? <Square className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white text-sm">{v.displayName}</p>
                    <p className="truncate font-mono text-[10px] text-cyan-400/80">{v.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge tone={v.gender === "Male" ? "blue" : "violet"}>{v.gender}</Badge>
                  <Badge tone="gray">{v.accent}</Badge>
                </div>
                <button
                  onClick={() => navigate(`/agent?voice=${v.id}`)}
                  className="mt-auto flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-gray-700 bg-[#070D18] text-xs font-semibold text-gray-300 transition-all hover:border-cyan-500 hover:text-white cursor-pointer"
                >
                  <Mic className="h-3.5 w-3.5 text-cyan-400" /> Use in Command Center
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default VoiceLibrary;
