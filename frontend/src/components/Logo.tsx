import { cn } from "../lib/cn";

interface LogoProps {
  className?: string;
  withWordmark?: boolean;
  wordmarkClassName?: string;
}

/**
 * Monochrome wordmark: a hairline tile with six calm waveform bars.
 * Colours come from the active theme tokens, so it adapts to light/dark.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("h-9 w-9", className)}
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="2.75"
        y="2.75"
        width="42.5"
        height="42.5"
        rx="11.25"
        className="fill-surface stroke-line"
        strokeWidth="1.5"
      />
      <g className="stroke-accent" strokeWidth="2.5" strokeLinecap="round">
        <path d="M11 21v6" />
        <path d="M16.6 16.5v15" />
        <path d="M22.2 12.5v23" />
        <path d="M27.8 19v10" />
        <path d="M33.4 15v18" />
        <path d="M39 20v8" />
      </g>
    </svg>
  );
}

export function Logo({ className, withWordmark = true, wordmarkClassName }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {withWordmark && (
        <span
          className={cn(
            "text-lg font-semibold tracking-snug text-fg whitespace-nowrap",
            wordmarkClassName,
          )}
        >
          Soundwave <span className="font-medium text-accent">AI</span>
        </span>
      )}
    </span>
  );
}
