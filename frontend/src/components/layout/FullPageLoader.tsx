import { Logo } from "../Logo";

/** Branded full-viewport loader used while the session/route resolves. */
export function FullPageLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app">
      <div className="flex flex-col items-center gap-4">
        <Logo />
        <div className="h-1 w-40 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full w-1/3 animate-[shimmer_1.4s_linear_infinite] rounded-full bg-gradient-to-r from-primary to-accent" />
        </div>
        {label && <p className="text-sm text-fg-muted">{label}</p>}
      </div>
    </div>
  );
}
