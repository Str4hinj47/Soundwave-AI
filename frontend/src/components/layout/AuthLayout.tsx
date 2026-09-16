import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AudioLines, Captions, Film, ShieldCheck } from "lucide-react";
import { Logo } from "../Logo";
import { ThemePicker } from "../theme/ThemePicker";

const HIGHLIGHTS = [
  { icon: <AudioLines className="h-4 w-4" />, text: "6 Microsoft Neural voices — instant, no downloads" },
  { icon: <Captions className="h-4 w-4" />, text: "Fully styleable subtitles with live preview" },
  { icon: <Film className="h-4 w-4" />, text: "Export MP4/WebM in landscape or portrait" },
  { icon: <ShieldCheck className="h-4 w-4" />, text: "Your text is never stored on our servers" },
];

/**
 * Split-screen auth shell: brand story on the left (large screens) and the
 * form card on the right. The theme picker is available before signing in, so
 * visitors can pick a look they like.
 */
export function AuthLayout({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-app lg:flex-row">
      {/* Brand panel */}
      <aside className="relative hidden w-[46%] max-w-2xl overflow-hidden border-r border-border lg:flex lg:flex-col">
        <span className="pointer-events-none absolute inset-0 sw-aurora opacity-70" aria-hidden="true" />
        <span
          className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute -right-16 bottom-10 h-72 w-72 rounded-full bg-accent/20 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
          <Link to="/" aria-label="Soundwave AI home" className="inline-flex">
            <Logo />
          </Link>

          <div>
            <h2 className="max-w-md text-4xl font-extrabold leading-tight text-fg-strong">
              Turn text into <span className="text-gradient">studio-grade voice</span> content.
            </h2>
            <p className="mt-4 max-w-md text-fg-muted">
              Voiceover, styled subtitles and video export — one workflow, no setup, nothing to install.
            </p>

            <ul className="mt-8 space-y-3">
              {HIGHLIGHTS.map((h) => (
                <li key={h.text} className="flex items-center gap-3 text-sm text-fg-muted">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface/80 text-primary">
                    {h.icon}
                  </span>
                  <span className="min-w-0">{h.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-6">
            {/* Animated equaliser — decorative */}
            <span className="flex items-end gap-1" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className="w-1 rounded-full bg-gradient-to-t from-primary to-accent"
                  style={{
                    height: `${14 + (i % 3) * 10}px`,
                    animation: `eq${(i % 3) + 1} ${0.9 + i * 0.11}s ease-in-out infinite`,
                  }}
                />
              ))}
            </span>
            <p className="text-xs text-fg-subtle">24 kHz mono MP3 · word timings included</p>
          </div>
        </div>
      </aside>

      {/* Form column */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6">
        <div className="absolute inset-x-4 top-4 flex items-center justify-between lg:inset-x-8 lg:top-8">
          <Link to="/" className="lg:invisible" aria-label="Soundwave AI home">
            <Logo markOnly />
          </Link>
          <ThemePicker />
        </div>

        <div className="relative w-full max-w-[440px] rounded-card border border-border bg-surface p-6 shadow-pop sm:p-8">
          {children}
        </div>
        {footer && <div className="relative mt-6 text-sm text-fg-muted">{footer}</div>}
      </div>
    </div>
  );
}
