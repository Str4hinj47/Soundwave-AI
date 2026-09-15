import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Captions,
  Film,
  Github,
  Globe,
  Linkedin,
  Lock,
  Mail,
  Mic,
  ShieldCheck,
  Sparkles,
  Twitter,
  Zap,
} from "lucide-react";
import { Navbar } from "../components/layout/Navbar";
import { Logo } from "../components/Logo";
import { Badge } from "../components/ui/Badge";
import { DEFAULT_VOICES } from "../lib/voices";
import { cn } from "../lib/cn";
import { tokenColor } from "../lib/themeTokens";
import { useAuth } from "../store/auth";
import { useTheme } from "../store/theme";

const FEATURES = [
  {
    icon: <Mic className="h-6 w-6" />,
    title: "6 Premium Voices",
    desc: "Crystal-clear Microsoft Neural voices — American and British accents, male and female.",
  },
  {
    icon: <Captions className="h-6 w-6" />,
    title: "Custom Subtitles",
    desc: "Fully customizable subtitle styling. Choose fonts, colors, sizes, animations, and positioning.",
  },
  {
    icon: <Film className="h-6 w-6" />,
    title: "Video Export",
    desc: "Overlay your subtitles on any video. Export in multiple quality settings from 720p to 4K.",
  },
  {
    icon: <ShieldCheck className="h-6 w-6" />,
    title: "Studio-Grade Audio",
    desc: "Microsoft Neural voices produce crisp 24 kHz studio-quality MP3 — no model downloads, no GPU required.",
  },
  {
    icon: <Zap className="h-6 w-6" />,
    title: "Instant, Always",
    desc: "No model to install. Every generation streams from our neural service in seconds.",
  },
  {
    icon: <Lock className="h-6 w-6" />,
    title: "Secure & Private",
    desc: "Your text is used only to synthesize the audio and is never stored. No API keys, no setup.",
  },
];

function HeroWaveform() {
  const ref = useRef<HTMLCanvasElement>(null);
  const theme = useTheme((s) => s.theme);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const bars = 40;
    const draw = (t: number) => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
      const w = rect.width;
      const h = rect.height;
      const step = w / bars;
      ctx.fillStyle = tokenColor("accent");
      for (let i = 0; i < bars; i++) {
        const base = Math.abs(Math.sin(i * 0.55)) * 0.45 + 0.12;
        const wave =
          Math.sin(t / 1400 + i * 0.45) * 0.14 + Math.sin(t / 2100 + i * 0.2) * 0.09;
        const amp = reduced ? base : base + wave;
        const barH = Math.max(3, amp * h);
        const x = i * step + step * 0.25;
        ctx.globalAlpha = 0.16 + (i / bars) * 0.28;
        ctx.beginPath();
        ctx.roundRect(x, (h - barH) / 2, step * 0.5, barH, 3);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [theme]);

  return <canvas ref={ref} className="h-20 w-full max-w-2xl" aria-hidden="true" />;
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

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <audio ref={audioRef} onEnded={() => setPlaying(null)} className="hidden" />
      <div className="text-center">
        <h2 className="text-3xl font-semibold tracking-snug text-fg sm:text-4xl">Hear Our Voices</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted">
          Six natural-sounding Microsoft Neural voices. Tap any voice to hear a real sample.
        </p>
      </div>
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {DEFAULT_VOICES.map((v) => (
          <div
            key={v.id}
            className="group flex items-center gap-3 rounded-card border border-line bg-surface p-4 transition-colors duration-200 hover:border-line-emphasis"
          >
            <button
              onClick={() => play(v.id, v.sampleUrl)}
              aria-label={`Play ${v.displayName} sample`}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all duration-200",
                playing === v.id
                  ? "bg-accent text-accent-ink"
                  : "bg-tint text-fg-soft group-hover:text-fg",
              )}
            >
              {playing === v.id ? <span className="flex gap-0.5" aria-hidden="true">
                <span className="h-3 w-0.5 animate-eq1 bg-current" />
                <span className="h-3 w-0.5 animate-eq2 bg-current" />
                <span className="h-3 w-0.5 animate-eq3 bg-current" />
              </span> : <Mic className="h-5 w-5" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-fg">{v.displayName}</p>
              <p className="truncate font-mono text-xs text-faint">{v.id}</p>
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
          className="inline-flex items-center gap-2 rounded-btn bg-accent px-6 py-3 font-semibold text-accent-ink transition-colors duration-200 hover:bg-accent-strong"
        >
          Use a Voice <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

export function Landing() {
  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-line pt-32 pb-20">
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <Badge tone="gray" className="mb-7 px-3.5 py-1 text-muted">
            <Sparkles className="h-3.5 w-3.5" /> Powered by Microsoft Neural Voices
          </Badge>
          <h1 className="text-4xl font-semibold leading-[1.15] tracking-snug text-fg sm:text-5xl">
            Turn Text Into <span className="text-accent">Stunning Voice Content</span>
          </h1>
          <p className="mx-auto mt-6 max-w-[620px] text-lg leading-relaxed text-muted">
            Professional AI voices, custom subtitles, and video export — all in one platform. Powered by Microsoft
            Neural voices, served securely from our cloud.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/signup"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-btn bg-accent px-7 text-base font-semibold text-accent-ink transition-colors duration-200 hover:bg-accent-strong sm:w-auto"
            >
              Start Creating — Free
            </Link>
            <a
              href="#voices"
              className="inline-flex h-12 w-full items-center justify-center rounded-btn border border-line-emphasis px-7 text-base font-medium text-fg-soft transition-colors duration-200 hover:border-accent/60 hover:text-fg sm:w-auto"
            >
              Listen to Voices ↓
            </a>
          </div>
          <div className="mt-14">
            <HeroWaveform />
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-faint">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" /> No API keys or model downloads
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Microsoft Neural Voices
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Mic className="h-3.5 w-3.5" /> 6 Premium Voices
            </span>
            <span>No credit card required</span>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-snug text-fg sm:text-4xl">Everything You Need</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">
            One platform for voice generation, subtitles, and video — with your privacy at the core.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-card border border-line bg-surface p-6 transition-colors duration-200 hover:border-line-emphasis"
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-accent/10 text-accent">
                {f.icon}
              </div>
              <h3 className="text-lg font-semibold text-fg">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="border-b border-line bg-sunken/50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-semibold tracking-snug text-fg sm:text-4xl">How Soundwave AI Works</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted">
              High-quality neural speech with zero setup. Here's the whole flow.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                n: "1",
                title: "Choose a Voice",
                desc: "Pick from six Microsoft Neural voices — American and British, male and female. Tap any voice to hear a real sample before you generate.",
              },
              {
                n: "2",
                title: "Generate",
                desc: "Enter your text and click Generate. Our servers synthesize studio-grade 24 kHz MP3 audio with Microsoft Neural voices in seconds.",
              },
              {
                n: "3",
                title: "Download or Export",
                desc: "Download your audio as MP3, WAV, or OGG. Optionally, send the audio to our servers only for video compositing with FFmpeg. We never store your audio without your explicit action.",
              },
            ].map((s, i) => (
              <div key={s.n} className="relative">
                {i < 2 && (
                  <div className="absolute left-full top-8 hidden h-px w-8 bg-line md:block" aria-hidden="true" />
                )}
                <div className="rounded-card border border-line bg-surface p-6">
                  <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface font-mono text-sm text-accent">
                    {s.n}
                  </div>
                  <h3 className="text-lg font-semibold text-fg">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-sm">
            <Badge tone="green" dot>On-device TTS</Badge>
            <span className="text-faint">→</span>
            <Badge tone="gray">No server round-trip</Badge>
            <span className="mx-3 hidden text-faint sm:inline">|</span>
            <Badge tone="amber" dot>Export path only</Badge>
            <span className="text-faint">→</span>
            <Badge tone="gray">FFmpeg compositing</Badge>
          </div>
        </div>
      </section>

      {/* ── Voices ───────────────────────────────────────────────────────── */}
      <div id="voices">
        <VoicePreviewSection />
      </div>

      {/* ── Pricing preview ──────────────────────────────────────────────── */}
      <section className="border-t border-line py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-semibold tracking-snug text-fg sm:text-4xl">Simple Pricing</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted">
              Start free. Upgrade when you need more characters, higher resolutions, and cloud sync.
            </p>
          </div>
          <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
            {[
              { name: "Free", price: "$0", desc: "10K chars / month", highlight: false, cta: "Get Started", to: "/signup" },
              { name: "Pro", price: "$12", desc: "200K chars / month", highlight: true, cta: "Subscribe Now", to: "/signup" },
              { name: "Enterprise", price: "$39", desc: "2M chars / month", highlight: false, cta: "Contact Sales", to: "/pricing" },
            ].map((p) => (
              <div
                key={p.name}
                className={cn(
                  "relative rounded-card border p-6 text-center",
                  p.highlight
                    ? "border-line bg-surface shadow-card"
                    : "border-line bg-surface",
                )}
              >
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-line bg-canvas px-3 py-0.5 text-xs font-medium uppercase tracking-wide text-accent">
                    Most popular
                  </div>
                )}
                <p className="text-lg font-semibold text-fg">{p.name}</p>
                <p className="mt-2 text-4xl font-semibold tracking-snug text-fg">
                  {p.price}
                  <span className="text-base font-normal text-faint">/mo</span>
                </p>
                <p className="mt-1 text-sm text-muted">{p.desc}</p>
                <Link
                  to={p.to}
                  className={cn(
                    "mt-5 inline-flex h-11 w-full items-center justify-center rounded-btn font-semibold transition-all duration-200",
                    p.highlight
                      ? "bg-accent text-accent-ink hover:bg-accent-strong"
                      : "border border-line-emphasis text-fg-soft hover:border-accent/60 hover:text-fg",
                  )}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link to="/pricing" className="text-accent transition-colors hover:text-accent-strong">
              View Full Pricing →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-line bg-sunken/50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <div className="col-span-2 md:col-span-1">
              <Logo />
              <p className="mt-4 max-w-xs text-sm text-faint">
                Text-to-speech, subtitles, and video export — running privately in your browser.
              </p>
            </div>
            {[
              { title: "Product", links: ["Features", "Voices", "Pricing", "Studio"] },
              { title: "Company", links: ["About", "Blog", "Careers", "Contact"] },
              { title: "Legal", links: ["Privacy Policy", "Terms of Service", "Security"] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="text-sm font-semibold text-fg">{col.title}</h4>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l}>
                      <a href="#" className="text-sm text-muted transition-colors hover:text-fg">
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-line pt-8 sm:flex-row">
            <p className="text-sm text-faint">© 2026 Soundwave AI. All rights reserved.</p>
            <div className="flex items-center gap-4 text-faint">
              <a href="#" aria-label="Twitter" className="transition-colors hover:text-fg"><Twitter className="h-5 w-5" /></a>
              <a href="#" aria-label="GitHub" className="transition-colors hover:text-fg"><Github className="h-5 w-5" /></a>
              <a href="#" aria-label="LinkedIn" className="transition-colors hover:text-fg"><Linkedin className="h-5 w-5" /></a>
              <a href="mailto:hello@soundwave.ai" aria-label="Email" className="transition-colors hover:text-fg"><Mail className="h-5 w-5" /></a>
              <a href="#" aria-label="Website" className="transition-colors hover:text-fg"><Globe className="h-5 w-5" /></a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

