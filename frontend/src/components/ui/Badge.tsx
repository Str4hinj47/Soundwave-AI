import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type Tone = "blue" | "violet" | "green" | "red" | "amber" | "gray" | "gradient";

const tones: Record<Tone, string> = {
  blue: "bg-primary/15 text-primary border-primary/30",
  violet: "bg-accent/15 text-accent border-accent/30",
  green: "bg-success/15 text-success border-success/30",
  red: "bg-danger/15 text-danger border-danger/30",
  amber: "bg-warning/15 text-warning border-warning/30",
  gray: "bg-surface-2 text-fg-muted border-border-strong",
  gradient: "bg-gradient-to-r from-primary to-accent text-primary-fg border-transparent",
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
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}
