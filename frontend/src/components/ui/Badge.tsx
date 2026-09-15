import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type Tone =
  | "accent"
  | "blue"
  | "violet"
  | "green"
  | "red"
  | "amber"
  | "gray"
  | "gradient";

/**
 * Quiet, low-contrast chips: a 10% tint of the token colour plus a hairline
 * border. "blue"/"gradient" are kept as aliases so existing call sites work.
 */
const tones: Record<Tone, string> = {
  accent: "bg-accent/10 text-accent border-accent/25",
  blue: "bg-accent/10 text-accent border-accent/25",
  violet: "bg-secondary/15 text-secondary border-secondary/25",
  green: "bg-success/15 text-success border-success/25",
  red: "bg-danger/15 text-danger border-danger/25",
  amber: "bg-warning/15 text-warning border-warning/25",
  gray: "bg-tint text-muted border-line",
  gradient: "bg-accent/10 text-accent border-accent/25",
};

export function Badge({
  children,
  tone = "gray",
  className,
  dot,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />}
      {children}
    </span>
  );
}
