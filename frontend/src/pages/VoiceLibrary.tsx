import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AudioLines, Mic, Play, Search, Square } from "lucide-react";
import { Navbar } from "../components/layout/Navbar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { DEFAULT_VOICES } from "../lib/voices";
import { cn } from "../lib/cn";
import { useAuth } from "../store/auth";
import { toast } from "../store/toast";

type GenderFilter = "all" | "Female" | "Male";
type AccentFilter = "all" | "American" | "British";

const GENDERS: GenderFilter[] = ["all", "Female", "Male"];
const ACCENTS: AccentFilter[] = ["all", "American", "British"];

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

  const stop = () => {
    audioRef.current?.pause();
    setPlaying(null);
  };

  const toggle = (id: string, url: string) => {
    if (playing === id) {
      stop();
      return;
    }
    const el = audioRef.current;
    if (!el) return;
    el.src = url;
    setPlaying(id);
    void el.play().catch(() => {
      // Sample missing (e.g. the repo's pre-generated clips were not built).
      setPlaying(null);
      toast.error("Sample unavailable", "This voice has no pre-generated sample yet.");
    });
  };

  const use = (voiceId: string) => {
    stop();
    navigate(user ? `/studio?voice=${voiceId}` : "/signup");
  };

  const hasFilters = query.trim().length > 0 || gender !== "all" || accent !== "all";

  return (
    <div className={standalone ? "min-h-screen bg-app" : undefined}>
      {standalone && <Navbar />}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} onEnded={() => setPlaying(null)} className="hidden" />
      <div
        className={cn(
          "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8",
          // Standalone clears the fixed marketing navbar; embedded in AppShell
          // the <main> area already provides horizontal padding + top spacing.
          standalone ? "pb-24 pt-28" : "pb-16 pt-2",
        )}
      >
        <p className="sw-eyebrow">Voices</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-fg-strong sm:text-4xl">Voice library</h1>
            <p className="mt-1.5 max-w-2xl text-sm text-fg-muted sm:text-base">
              {DEFAULT_VOICES.length} Microsoft Neural voices, each with a real pre-generated sample. Press play to
              audition one, then take it straight into the Studio.
            </p>
          </div>
          <Badge tone="gradient">{filtered.length} of {DEFAULT_VOICES.length} shown</Badge>
        </div>

        {/* ── Filters ─────────────────────────────────────────────────────── */}
        <div className="sw-card sw-card-pad mt-6 flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or voice ID…"
              className="sw-input h-11 w-full pl-9"
              aria-label="Search voices"
              type="search"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by gender">
            <span className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Gender</span>
            {GENDERS.map((g) => (
              <FilterChip key={g} active={gender === g} onClick={() => setGender(g)}>
                {g === "all" ? "All" : g}
              </FilterChip>
            ))}
          </div>

          <span className="hidden h-8 w-px bg-border lg:block" aria-hidden="true" />

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by accent">
            <span className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Accent</span>
            {ACCENTS.map((a) => (
              <FilterChip key={a} active={accent === a} onClick={() => setAccent(a)}>
                {a === "all" ? "All" : a}
              </FilterChip>
            ))}
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setGender("all");
                setAccent("all");
              }}
              className="ml-auto text-sm text-fg-subtle underline decoration-dotted underline-offset-4 transition-colors hover:text-fg"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* ── Voices ──────────────────────────────────────────────────────── */}
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((v) => {
            const isPlaying = playing === v.id;
            return (
              <li
                key={v.id}
                className={cn(
                  "sw-card flex flex-col gap-4 p-5 transition-colors",
                  isPlaying ? "border-primary/60" : "hover:border-primary/40",
                )}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggle(v.id, v.sampleUrl)}
                    aria-label={isPlaying ? `Stop the ${v.displayName} sample` : `Play the ${v.displayName} sample`}
                    aria-pressed={isPlaying}
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-all duration-200",
                      isPlaying
                        ? "bg-gradient-to-r from-primary to-accent text-primary-fg shadow-pop"
                        : "bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg-strong",
                    )}
                  >
                    {isPlaying ? <Square className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-fg-strong">{v.displayName}</p>
                    <p className="truncate font-mono text-xs text-fg-subtle">{v.id}</p>
                  </div>
                  {isPlaying && (
                    <span className="flex items-end gap-0.5" aria-hidden="true">
                      <span className="h-4 w-0.5 animate-eq1 bg-accent" />
                      <span className="h-4 w-0.5 animate-eq2 bg-primary" />
                      <span className="h-4 w-0.5 animate-eq3 bg-accent" />
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={v.gender === "Female" ? "violet" : "blue"}>{v.gender}</Badge>
                  <Badge tone="gray">{v.accent}</Badge>
                </div>

                <Button
                  variant="outline"
                  fullWidth
                  className="mt-auto"
                  onClick={() => use(v.id)}
                  aria-label={user ? `Use ${v.displayName} in the studio` : `Create an account to use ${v.displayName}`}
                >
                  <Mic className="h-4 w-4" /> {user ? "Use this voice" : "Sign up to use"}
                </Button>
              </li>
            );
          })}
        </ul>

        {filtered.length === 0 && (
          <div className="mt-10 flex flex-col items-center rounded-card border border-dashed border-border-strong bg-surface-inset px-6 py-14 text-center">
            <AudioLines className="h-8 w-8 text-fg-subtle" />
            <p className="mt-3 font-medium text-fg-strong">No voices match those filters</p>
            <p className="mt-1 text-sm text-fg-muted">Try a different gender/accent combination or clear the search.</p>
            <Button
              variant="outline"
              className="mt-5"
              onClick={() => {
                setQuery("");
                setGender("all");
                setAccent("all");
              }}
            >
              Reset filters
            </Button>
          </div>
        )}

        {standalone && (
          <p className="mt-10 text-center text-sm text-fg-subtle">
            Looking for something else?{" "}
            <Link to="/pricing" className="sw-link">
              Compare plans
            </Link>{" "}
            or{" "}
            <Link to="/help" className="sw-link">
              browse the help centre
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
        active
          ? "border-primary/60 bg-primary/15 font-medium text-fg-strong"
          : "border-border-strong text-fg-muted hover:border-primary/40 hover:text-fg-strong",
      )}
    >
      {children}
    </button>
  );
}
