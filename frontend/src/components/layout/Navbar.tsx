import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Logo } from "../Logo";
import { cn } from "../../lib/cn";
import { useAuth } from "../../store/auth";

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
        "fixed inset-x-0 top-0 z-20 backdrop-blur-xl transition-all duration-300",
        scrolled ? "border-b border-gray-800 bg-gray-900/80" : "bg-gray-900/60",
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
              className="rounded-md px-3.5 py-2 text-sm text-gray-300 transition-all duration-200 hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <button
              onClick={() => navigate("/dashboard")}
              className="rounded-btn bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-2 text-sm font-semibold text-white shadow-glow transition-all duration-200 hover:from-blue-400 hover:to-violet-400"
            >
              Open Dashboard
            </button>
          ) : (
            <>
              <Link
                to="/signin"
                className="rounded-btn px-4 py-2 text-sm font-medium text-gray-200 transition-all duration-200 hover:text-white"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="rounded-btn bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-2 text-sm font-semibold text-white shadow-glow transition-all duration-200 hover:from-blue-400 hover:to-violet-400"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        <button
          className="flex h-10 w-10 items-center justify-center rounded-md text-gray-300 hover:bg-gray-800 md:hidden"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-30 flex flex-col bg-navy md:hidden"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
          >
            <div className="flex h-16 items-center justify-between px-4">
              <Logo />
              <button
                className="flex h-10 w-10 items-center justify-center rounded-md text-gray-300 hover:bg-gray-800"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="flex flex-col gap-2 px-6 py-6" aria-label="Mobile">
              {links.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-lg text-gray-200 hover:bg-gray-800"
                >
                  {l.label}
                </a>
              ))}
              <div className="mt-6 flex flex-col gap-3">
                {!user && (
                  <Link
                    to="/signin"
                    onClick={() => setOpen(false)}
                    className="rounded-btn border border-gray-600 px-5 py-3 text-center font-semibold text-white"
                  >
                    Sign In
                  </Link>
                )}
                <Link
                  to={user ? "/dashboard" : "/signup"}
                  onClick={() => setOpen(false)}
                  className="rounded-btn bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-3 text-center font-semibold text-white"
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
