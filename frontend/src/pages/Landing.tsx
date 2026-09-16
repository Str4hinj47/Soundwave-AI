import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  AudioLines,
  Captions,
  Check,
  Film,
  Github,
  Mail,
  Mic,
  Palette,
  Play,
  ShieldCheck,
  Sparkles,
  Square,
  Wand2,
  Zap,
} from "lucide-react";
import { Navbar } from "../components/layout/Navbar";
import { Logo } from "../components/Logo";
import { Badge } from "../components/ui/Badge";
import { DEFAULT_VOICES } from "../lib/voices";
import { cn } from "../lib/cn";
import { useAuth } from "../store/auth";
import { cssVarColor } from "../store/theme";

const FEATURES = [
  {
    icon: <Mic className="h-6 w-6" />,
    title: "6 Neural Voices",
    desc: "Crystal-clear Microsoft Neural voices — American and British, male and female, rendered in seconds.",
  },
  {
    icon: <Captions className="h-6 w-6" />,
    title: "Custom Subtitles",
    desc: "Fonts, colours, outlines, shadows, animations and free positioning — with a live 16:9/9:16 preview.",
  },
  {
    icon: <Film className="h-6 w-6" />,
    title: "Video Export",
    desc: "Burn subtitles onto your own footage (or a solid background) and export 720p → 4K, landscape or portrait.",
  },
  {
    icon: <AudioLines className="h-6 w-6" />,
    title: "Word-Level Timings",
    desc: "Every generation returns word timings, so subtitles auto-cue to the voice instead of guessing.",
  },
  {
    icon: <Palette className="h-6 w-6" />,
    title: "Themes You Control",
    desc: "Seven built-in themes, custom accent colours, radius and density — pick the look you want to work in.",
  },
  {
    icon: <ShieldCheck className="h-6 w-6" />,
    title: "Private By Default",
    desc: "Your script is used to synthesise the audio and is never stored. Audio only leaves your device for an export you start.",
  },
];

/** Animated hero waveform drawn with the *active theme* colours. */
function HeroWaveform() {
  const ref = useRef<HTMLCanvasElement>(null);
  const themeId = useThemeId();
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const primary = cssVarColor("primary");
    const primarySoft = cssVarColor("primary-soft");
    const accent = cssVarColor("accent");
    let raf = 0;
    const bars = 56;
    const draw = (t: number) => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, rect.width, rect.height);
      const w = rect.width;
      const h = rect.height;
      const step = w / bars;
      for (let i = 0; i < bars; i++) {
        const base = Math.abs(Math.sin(i * 0.55)) * 0.5 + 0.15;
        const wave = Math.sin(t / 600 + i * 0.45) * 0.25 + Math.sin(t / 900 + i * 0.2) * 0.15;
        const amp = reduced ? base : base + wave;
        const barH = Math.max(4, amp * h);
        const x = i * step + step * 0.2;
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, i % 3 === 0 ? accent : primarySoft);
        grad.addColorStop(1, primary);
        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.3 + (i / bars) * 0.65;
        ctx.beginPath();
        ctx.roundRect(x, (h - barH) / 2, step * 0.6, barH, 6);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [themeId]);
  return <canvas ref={ref} className="h-24 w-full max-w-3xl" aria-hidden="true" />;
}

/** Re-renders the hero canvas whenever the theme changes. */
function useThemeId(): string {
  const [id, setId] = useState(() => document.documentElement.dataset.theme ?? "midnight");
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setId(document.documentElement.dataset.theme ?? "midnight");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "style"] });
    return () => observer.disconnect();
  }, []);
  return id;
}

/** Small live preview of the app inside the hero. */
function StudioPreview() {
  const themeId = useThemeId();
  return (
    <div className="sw-card sw-card-pad relative w-full max-w-xl overflow-hidden">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
        <span className="ml-2 sw-eyebrow">Studio</span>
        <Badge tone="green" dot className="ml-auto">
          Ready
        </Badge>
      </div>

      <div className="mt-4 rounded-input border border-border bg-surface-inset p-3">
        <p className="text-sm leading-relaxed text-fg-muted">
          “Welcome back. This voiceover was generated with Microsoft Neural voices and cued to word-level timings…”
        </p>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-r from-primary to-accent text-primary-fg shadow-glow">
          <Play className="ml-0.5 h-5 w-5" />
        </span>
        <span className="flex h-10 items-end gap-[3px]" aria-hidden="true">
          {Array.from({ length: 28 }).map((_, i) => (
            <span
              key={i}
              className={cn("w-[3px] rounded-full", i < 17 ? "bg-gradient-to-t from-primary to-accent" : "bg-surface-3")}
              style={{ height: `${8 + Math.abs(Math.sin(i * 0.8)) * 26}px` }}
            />
          ))}
        </span>
        <span className="ml-auto font-mono text-xs tabular-nums text-fg-subtle">0:12 / 0:31</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Theme", value: document.documentElement.dataset.theme ?? "midnight" },
          { label: "Resolution", value: "1080p" },
          { label: "Words aligned", value: "62" },
        ].map((s) => (
          <div key={s.label} className="rounded-input border border-border bg-surface-inset px-2 py-2">
            <p className="truncate text-[11px] uppercase tracking-wide text-fg-subtle">{s.label}</p>
            <p className="truncate text-sm font-semibold capitalize text-fg-strong">{s.value}</p>
          </div>
        ))}
      </div>
      <span key={themeId} className="pointer-events-none absolute inset-0 sw-aurora opacity-[0.12]" aria-hidden="true" />
    </div>
  );
}

function VoicePreviewSection() {
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { user } = useAuth();

  const play = (id: string, url: string) => {
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

  useEffect(() => {
    // Stop playback when the component unmounts so the sample never keeps
    // playing after navigating away.
    return () => audioRef.current?.pause();
  }, []);

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <audio ref={audioRef} onEnded={() => setPlaying(null)} className="hidden" />
      <div className="text-center">
        <Badge tone="violet" className="mb-4">
          <Mic className="h-3.5 w-3.5" /> Voice library
        </Badge>
        <h2 className="text-3xl font-bold text-fg-strong sm:text-4xl">Hear it before you commit</h2>
        <p className="mx-auto mt-3 max-w-xl text-fg-muted">
          Six natural-sounding Microsoft Neural voices. Tap any card to play a real, pre-generated sample.
        </p>
      </div>
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DEFAULT_VOICES.map((v) => (
          <div
            key={v.id}
            className="group flex items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lift"
          >
            <button
              onClick={() => play(v.id, v.sampleUrl)}
              aria-label={playing === v.id ? `Stop ${v.displayName} sample` : `Play ${v.displayName} sample`}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all duration-200",
                playing === v.id
                  ? "bg-gradient-to-r from-primary to-accent text-primary-fg shadow-glow"
                  : "bg-surface-2 text-fg-muted group-hover:text-fg-strong",
              )}
            >
              {playing === v.id ? <Square className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-fg-strong">{v.displayName}</p>
              <p className="truncate font-mono text-xs text-fg-subtle">{v.id}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Badge tone={v.gender === "Female" ? "violet" : "blue"}>{v.gender}</Badge>
              <Badge tone="gray">{v.accent}</Badge>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 text-center">
        <Link
          to={user ? "/studio" : "/signup"}
          className="inline-flex items-center gap-2 rounded-btn bg-gradient-to-r from-primary to-accent px-6 py-3 font-semibold text-primary-fg shadow-glow transition-all duration-200 hover:brightness-110"
        >
          Use a voice <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

export function Landing() {
  return (
    <div className="min-h-screen bg-app">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pb-16 pt-28 sm:pt-32">
        <span className="pointer-events-none absolute inset-0 sw-aurora opacity-60" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:px-8">
          <div className="min-w-0">
            <Badge tone="gradient" className="mb-6 px-4 py-1">
              <Sparkles className="h-3.5 w-3.5" /> Microsoft Neural voices · no install
            </Badge>
            <h1 className="text-3xl font-extrabold leading-[1.1] text-fg-strong sm:text-5xl">
              Turn text into <span className="text-gradient">stunning voice content</span>
            </h1>
            <p className="mt-5 max-w-[620px] text-lg text-fg-muted">
              Studio-grade voiceover, styleable subtitles and video export in one workspace — rendered by Microsoft
              Neural voices on our servers and streamed straight to your browser.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/signup"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-btn bg-gradient-to-r from-primary to-accent px-7 text-base font-semibold text-primary-fg shadow-glow transition-all duration-200 hover:brightness-110"
              >
                Start creating — free
              </Link>
              <a
                href="#voices"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-btn border border-border-strong px-7 text-base font-semibold text-fg transition-all duration-200 hover:border-primary/60 hover:bg-primary/5 hover:text-fg-strong"
              >
                Listen to voices
              </a>
            </div>

            <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-fg-subtle">
              {["No API keys or model downloads", "Word-level subtitle timing", "Themes you can customise"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  {t}
                </li>
              ))}
            </ul>

            <div className="mt-10">
              <HeroWaveform />
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <StudioPreview />
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center">
          <Badge tone="blue" className="mb-4">
            <Wand2 className="h-3.5 w-3.5" /> Everything included
          </Badge>
          <h2 className="text-3xl font-bold text-fg-strong sm:text-4xl">One workspace, whole pipeline</h2>
          <p className="mx-auto mt-3 max-w-xl text-fg-muted">
            Generate, style, sync and export — with your privacy at the core.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-card border border-border bg-surface p-6 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lift"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent/20 text-primary transition-transform duration-200 group-hover:scale-105">
                {f.icon}
              </div>
              <h3 className="text-lg font-semibold text-fg-strong">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="scroll-mt-20 border-y border-border bg-surface/40 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <Badge tone="violet" className="mb-4">
              <Zap className="h-3.5 w-3.5" /> Three steps
            </Badge>
            <h2 className="text-3xl font-bold text-fg-strong sm:text-4xl">From script to finished video</h2>
            <p className="mx-auto mt-3 max-w-2xl text-fg-muted">
              No model downloads, no GPU, no API keys — the heavy lifting happens server-side.
            </p>
          </div>
          <ol className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                title: "Pick a voice",
                desc: "Choose one of the six Neural voices, tune speed, pitch and volume, and tune the delivery to your script.",
              },
              {
                title: "Generate the voiceover",
                desc: "We synthesise 24 kHz MP3 audio with word timings, ready to play, regenerate or download as MP3, WAV or OGG.",
              },
              {
                title: "Style and export",
                desc: "Cue subtitles, design them, attach your own footage (or a colour background) and render MP4/WebM at up to 4K.",
              },
            ].map((s, i) => (
              <li key={s.title} className="relative">
                {i < 2 && (
                  <span
                    className="absolute left-full top-8 hidden h-px w-8 bg-gradient-to-r from-primary/60 to-accent/60 md:block"
                    aria-hidden="true"
                  />
                )}
                <div className="rounded-card border border-border bg-surface p-6 shadow-card">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-primary to-accent text-lg font-bold text-primary-fg">
                    {i + 1}
                  </div>
                  <h3 className="text-lg font-semibold text-fg-strong">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-fg-muted">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-sm">
            <Badge tone="green" dot>Server-side neural TTS</Badge>
            <span className="text-fg-subtle">→</span>
            <Badge tone="gray">Word-timed subtitles</Badge>
            <span className="mx-2 hidden text-fg-subtle sm:inline">|</span>
            <Badge tone="amber" dot>Audio uploaded only for exports you start</Badge>
            <span className="text-fg-subtle">→</span>
            <Badge tone="gray">FFmpeg compositing</Badge>
          </div>
        </div>
      </section>

      {/* ── Voices ───────────────────────────────────────────────────────── */}
      <div id="voices" className="scroll-mt-20">
        <VoicePreviewSection />
      </div>

      {/* ── Pricing preview ──────────────────────────────────────────────── */}
      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-fg-strong sm:text-4xl">Simple pricing</h2>
            <p className="mx-auto mt-3 max-w-xl text-fg-muted">
              Start free. Upgrade when you need more characters, higher resolutions and cloud sync.
            </p>
          </div>
          <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
            {[
              { name: "Free", price: "$0", desc: "10K chars / month", highlight: false, cta: "Get started", to: "/signup" },
              { name: "Pro", price: "$12", desc: "200K chars / month", highlight: true, cta: "Subscribe now", to: "/signup" },
              { name: "Enterprise", price: "$39", desc: "2M chars / month", highlight: false, cta: "Compare plans", to: "/pricing" },
            ].map((p) => (
              <div
                key={p.name}
                className={cn(
                  "relative rounded-card border p-6 text-center shadow-card transition-transform duration-200",
                  p.highlight ? "border-primary/50 bg-surface hover:-translate-y-1" : "border-border bg-surface",
                )}
              >
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-primary to-accent px-3 py-0.5 text-xs font-semibold text-primary-fg">
                    MOST POPULAR
                  </div>
                )}
                <p className="text-lg font-semibold text-fg-strong">{p.name}</p>
                <p className="mt-2 text-4xl font-bold text-fg-strong">
                  {p.price}
                  <span className="text-base font-normal text-fg-subtle">/mo</span>
                </p>
                <p className="mt-1 text-sm text-fg-muted">{p.desc}</p>
                <Link
                  to={p.to}
                  className={cn(
                    "mt-5 inline-flex h-11 w-full items-center justify-center rounded-btn font-semibold transition-all duration-200",
                    p.highlight
                      ? "bg-gradient-to-r from-primary to-accent text-primary-fg hover:brightness-110"
                      : "border border-border-strong text-fg hover:border-primary/60 hover:bg-primary/5 hover:text-fg-strong",
                  )}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link to="/pricing" className="sw-link">
              View full pricing →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-5">
            <div className="col-span-2 md:col-span-1">
              <Logo />
              <p className="mt-4 max-w-xs text-sm text-fg-subtle">
                Text-to-speech, subtitles and video export — one workflow, seven themes, zero setup.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-fg-strong">Product</h4>
              <ul className="mt-4 space-y-2.5">
                <li><a href="#features" className="text-sm text-fg-muted transition-colors hover:text-fg-strong">Features</a></li>
                <li><Link to="/voices" className="text-sm text-fg-muted transition-colors hover:text-fg-strong">Voice library</Link></li>
                <li><Link to="/pricing" className="text-sm text-fg-muted transition-colors hover:text-fg-strong">Pricing</Link></li>
                <li><Link to="/studio" className="text-sm text-fg-muted transition-colors hover:text-fg-strong">Studio</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-fg-strong">Account</h4>
              <ul className="mt-4 space-y-2.5">
                <li><Link to="/signin" className="text-sm text-fg-muted transition-colors hover:text-fg-strong">Sign in</Link></li>
                <li><Link to="/signup" className="text-sm text-fg-muted transition-colors hover:text-fg-strong">Create account</Link></li>
                <li><Link to="/settings/appearance" className="text-sm text-fg-muted transition-colors hover:text-fg-strong">Appearance</Link></li>
                <li><Link to="/help" className="text-sm text-fg-muted transition-colors hover:text-fg-strong">Help &amp; support</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-fg-strong">Legal</h4>
              <ul className="mt-4 space-y-2.5">
                <li><Link to="/terms" className="text-sm text-fg-muted transition-colors hover:text-fg-strong">Terms of Service</Link></li>
                <li><Link to="/privacy" className="text-sm text-fg-muted transition-colors hover:text-fg-strong">Privacy Policy</Link></li>
                <li><Link to="/voices" className="text-sm text-fg-muted transition-colors hover:text-fg-strong">Voice samples</Link></li>
                <li><Link to="/pricing" className="text-sm text-fg-muted transition-colors hover:text-fg-strong">Plan limits</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-fg-strong">Contact</h4>
              <ul className="mt-4 space-y-2.5">
                <li>
                  <a href="mailto:hello@soundwave.ai" className="text-sm text-fg-muted transition-colors hover:text-fg-strong">
                    hello@soundwave.ai
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/Str4hinj47/Soundwave-AI"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-sm text-fg-muted transition-colors hover:text-fg-strong"
                  >
                    GitHub repository
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
            <p className="text-sm text-fg-subtle">© {new Date().getFullYear()} Soundwave AI. All rights reserved.</p>
            <div className="flex items-center gap-3 text-fg-subtle">
              <a
                href="https://github.com/Str4hinj47/Soundwave-AI"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="GitHub"
                className="transition-colors hover:text-fg-strong"
              >
                <Github className="h-5 w-5" />
              </a>
              <a href="mailto:hello@soundwave.ai" aria-label="Email" className="transition-colors hover:text-fg-strong">
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
