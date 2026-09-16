import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutDashboard, Menu, X } from "lucide-react";
import { Logo } from "../Logo";
import { cn } from "../../lib/cn";
import { useAuth } from "../../store/auth";
import { ThemePicker } from "../theme/ThemePicker";

const links = [
  { label: "Features", href: "/#features" },
  { label: "Voices", href: "/voices" },
  { label: "Pricing", href: "/pricing" },
  { label: "How It Works", href: "/#how-it-works" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-30 transition-all duration-300",
        scrolled
          ? "border-b border-border bg-app/80 backdrop-blur-xl shadow-card"
          : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" aria-label="Soundwave AI home" className="shrink-0">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="rounded-btn px-3.5 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg-strong"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemePicker />
          {user ? (
            <button
              onClick={() => navigate("/dashboard")}
              className="inline-flex h-10 items-center gap-2 rounded-btn bg-gradient-to-r from-primary to-accent px-5 text-sm font-semibold text-primary-fg shadow-glow transition-all duration-200 hover:brightness-110"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </button>
          ) : (
            <>
              <Link
                to="/signin"
                className="rounded-btn px-4 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg-strong"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="rounded-btn bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-semibold text-primary-fg shadow-glow transition-all duration-200 hover:brightness-110"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemePicker />
          <button
            className="flex h-10 w-10 items-center justify-center rounded-btn text-fg-muted hover:bg-surface-2 hover:text-fg-strong"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40 flex flex-col bg-app md:hidden"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ type: "tween", duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex h-16 items-center justify-between px-4">
              <Logo />
              <button
                className="flex h-10 w-10 items-center justify-center rounded-btn text-fg-muted hover:bg-surface-2 hover:text-fg-strong"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="flex flex-col gap-1 px-4 py-4" aria-label="Mobile">
              {links.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-btn px-3 py-3 text-lg text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg-strong"
                >
                  {l.label}
                </a>
              ))}
              <div className="mt-4 flex flex-col gap-3">
                {!user && (
                  <Link
                    to="/signin"
                    onClick={() => setOpen(false)}
                    className="rounded-btn border border-border-strong px-5 py-3 text-center font-semibold text-fg"
                  >
                    Sign In
                  </Link>
                )}
                <Link
                  to={user ? "/dashboard" : "/signup"}
                  onClick={() => setOpen(false)}
                  className="rounded-btn bg-gradient-to-r from-primary to-accent px-5 py-3 text-center font-semibold text-primary-fg"
                >
                  {user ? "Open Dashboard" : "Get Started"}
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
