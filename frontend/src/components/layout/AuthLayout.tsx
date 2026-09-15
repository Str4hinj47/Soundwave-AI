import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../Logo";
import { ThemeToggle } from "../ui/ThemeToggle";

/**
 * Centred auth card. Deliberately quiet: one hairline card on the page
 * background, no colour washes behind it.
 */
export function AuthLayout({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle className="hover:bg-tint" />
      </div>

      <Link to="/" className="relative mb-8" aria-label="Soundwave AI home">
        <Logo />
      </Link>

      <div className="relative w-full max-w-[440px] rounded-card border border-line bg-surface p-6 shadow-card sm:p-8">
        {children}
      </div>

      {footer && <div className="relative mt-6 text-sm text-muted">{footer}</div>}
    </div>
  );
}
