import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Logo } from "../Logo";
import { cn } from "../../lib/cn";
import { useAuth } from "../../store/auth";
import { ThemeToggle } from "../ui/ThemeToggle";

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
        "fixed inset-x-0 top-0 z-20 backdrop-blur-md transition-all duration-300",
        scrolled ? "border-b border-line bg-canvas/85" : "border-b border-transparent bg-canvas/60",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" aria-label="Soundwave AI home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="rounded-md px-3.5 py-2 text-sm text-muted transition-colors duration-200 hover:bg-tint hover:text-fg"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle className="mr-1 hover:bg-tint" />
          {user ? (
            <button
              onClick={() => navigate("/dashboard")}
              className="rounded-btn bg-accent px-5 py-2 text-sm font-semibold text-accent-ink transition-colors duration-200 hover:bg-accent-strong"
            >
              Open Dashboard
            </button>
          ) : (
            <>
              <Link
                to="/signin"
                className="rounded-btn px-4 py-2 text-sm font-medium text-muted transition-colors duration-200 hover:text-fg"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="rounded-btn bg-accent px-5 py-2 text-sm font-semibold text-accent-ink transition-colors duration-200 hover:bg-accent-strong"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        <button
          className="flex h-10 w-10 items-center justify-center rounded-md text-fg-soft hover:bg-tint md:hidden"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-30 flex flex-col bg-canvas md:hidden"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
          >
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <Logo />
              <div className="flex items-center gap-1">
                <ThemeToggle className="hover:bg-tint" />
                <button
                  className="flex h-10 w-10 items-center justify-center rounded-md text-fg-soft hover:bg-tint"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            <nav className="flex flex-col gap-2 px-6 py-6" aria-label="Mobile">
              {links.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-lg text-muted transition-colors hover:bg-tint hover:text-fg"
                >
                  {l.label}
                </a>
              ))}
              <div className="mt-6 flex flex-col gap-3">
                {!user && (
                  <Link
                    to="/signin"
                    onClick={() => setOpen(false)}
                    className="rounded-btn border border-line-emphasis px-5 py-3 text-center font-semibold text-fg transition-colors hover:border-accent/60"
                  >
                    Sign In
                  </Link>
                )}
                <Link
                  to={user ? "/dashboard" : "/signup"}
                  onClick={() => setOpen(false)}
                  className="rounded-btn bg-accent px-5 py-3 text-center font-semibold text-accent-ink"
                >
                  Get Started
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
