import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type Tone = "blue" | "violet" | "green" | "red" | "amber" | "gray" | "gradient";

const tones: Record<Tone, string> = {
  blue: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  violet: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  green: "bg-success/15 text-emerald-300 border-success/30",
  red: "bg-danger/15 text-red-300 border-danger/30",
  amber: "bg-warning/15 text-amber-300 border-warning/30",
  gray: "bg-gray-700/40 text-gray-300 border-gray-600/40",
  gradient: "bg-gradient-to-r from-blue-500 to-violet-500 text-white border-transparent",
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
