import { cn } from "../../lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <Skeleton className="mb-4 h-6 w-2/5" />
      <Skeleton className="mb-2 h-4 w-full" />
      <Skeleton className="mb-2 h-4 w-4/5" />
      <Skeleton className="h-4 w-3/5" />
    </div>
  );
}
