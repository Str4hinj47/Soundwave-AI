import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  CreditCard,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { Logo } from "../Logo";
import { useAuth } from "../../store/auth";
import { initials } from "../../lib/format";
import { Dropdown } from "../ui/Dropdown";
import { ThemePicker } from "../theme/ThemePicker";
import { toast } from "../../store/toast";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

const mainNav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" />, end: true },
  { to: "/projects", label: "My Projects", icon: <FolderKanban className="h-5 w-5" /> },
  { to: "/voices", label: "Voice Library", icon: <Mic className="h-5 w-5" /> },
];

const studioNav = {
  to: "/studio",
  label: "Studio",
  icon: <Sparkles className="h-5 w-5" />,
  sub: [
    { to: "/studio", label: "Text-to-Speech" },
    { to: "/studio/subtitles", label: "Subtitles" },
    { to: "/studio/video", label: "Video" },
  ],
};

const secondaryNav: NavItem[] = [
  { to: "/settings", label: "Settings", icon: <SettingsIcon className="h-5 w-5" /> },
  { to: "/help", label: "Help & Support", icon: <HelpCircle className="h-5 w-5" /> },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, quota, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Global search shortcut: "/" focuses the project search field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        document.getElementById("shell-search")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const studioActive = location.pathname.startsWith("/studio");
  const usage = useMemo(() => {
    if (!quota || quota.limit <= 0) return { pct: 0, label: "—" };
    const pct = Math.min(100, Math.round((quota.used / quota.limit) * 100));
    return { pct, label: `${pct}%` };
  }, [quota]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
    toast.info("Signed out", "You have been signed out of Soundwave AI.");
  };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/projects?q=${encodeURIComponent(search.trim())}`);
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        <NavLink to="/dashboard" className="flex items-center" aria-label="Soundwave AI dashboard">
          <Logo markOnly />
        </NavLink>
        <button
          className="flex h-10 w-10 items-center justify-center rounded-btn text-fg-muted hover:bg-surface-2 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        <p className="px-3 pb-1.5 sw-eyebrow">Workspace</p>
        <div className="space-y-1">
          {mainNav.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}

          <div className="pt-1">
            <NavLink
              to={studioNav.to}
              className={cn("sw-nav-link", studioActive && "sw-nav-link-active")}
            >
              {studioNav.icon}
              {studioNav.label}
            </NavLink>
            <AnimatePresence initial={false}>
              {studioActive && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="ml-6 mt-1 space-y-1 border-l border-border pl-3">
                    {studioNav.sub.map((s) => (
                      <NavLink
                        key={s.to}
                        to={s.to}
                        end
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-2 rounded-btn px-3 py-2 text-sm transition-colors",
                            isActive
                              ? "bg-primary/10 font-medium text-primary"
                              : "text-fg-subtle hover:bg-surface-2 hover:text-fg",
                          )
                        }
                      >
                        {s.label}
                      </NavLink>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <p className="mt-6 px-3 pb-1.5 sw-eyebrow">Account</p>
        <div className="space-y-1">
          {secondaryNav.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </div>
      </nav>

      <div className="border-t border-border p-3">
        {user?.plan === "FREE" ? (
          <div className="relative overflow-hidden rounded-card border border-accent/30 p-3">
            <span className="pointer-events-none absolute inset-0 sw-aurora opacity-40" aria-hidden="true" />
            <div className="relative">
              <p className="text-sm font-semibold text-fg-strong">Upgrade to Pro</p>
              <p className="mt-0.5 text-xs text-fg-muted">200K chars, 1080p, no watermark.</p>
              <button
                onClick={() => navigate("/pricing")}
                className="mt-2.5 w-full rounded-btn bg-gradient-to-r from-primary to-accent px-3 py-2 text-sm font-semibold text-primary-fg transition-all hover:brightness-110"
              >
                Upgrade
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-card border border-border bg-surface-inset px-3 py-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/15">
              <span className="h-2 w-2 rounded-full bg-success" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">{user?.plan} plan</p>
              <p className="truncate text-xs text-fg-subtle">
                {usage.pct}% of monthly characters used
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-app">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-border bg-surface/70 backdrop-blur-xl lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-30 bg-black/60 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-30 w-72 border-r border-border bg-surface lg:hidden"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "tween", duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-border bg-app/80 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn text-fg-muted hover:bg-surface-2 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <form onSubmit={onSearch} className="relative hidden max-w-md flex-1 md:block" role="search">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
              <input
                id="shell-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects…"
                className="w-full rounded-input border border-border bg-surface-inset py-2 pl-9 pr-12 text-sm text-fg transition-colors placeholder:text-fg-subtle hover:border-border-strong focus:border-primary"
                aria-label="Search projects"
              />
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-border px-1.5 py-0.5 font-mono text-[11px] text-fg-subtle lg:block">
                /
              </kbd>
            </form>

            <div className="ml-auto flex items-center gap-2">
              {quota && (
                <NavLink
                  to="/settings/billing"
                  className="hidden items-center gap-2.5 rounded-full border border-border px-3 py-1.5 transition-colors hover:border-border-strong sm:flex"
                  title={`${quota.used} / ${quota.limit} characters used this month`}
                >
                  <span className="relative flex h-5 w-5 items-center justify-center">
                    <svg viewBox="0 0 36 36" className="h-5 w-5 -rotate-90" aria-hidden="true">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="rgb(var(--sw-surface-3))" strokeWidth="6" />
                      <circle
                        cx="18"
                        cy="18"
                        r="15"
                        fill="none"
                        stroke="rgb(var(--sw-primary))"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={`${(usage.pct / 100) * 94.2} 94.2`}
                      />
                    </svg>
                  </span>
                  <span className="text-xs font-medium text-fg-muted">{usage.label}</span>
                </NavLink>
              )}

              <ThemePicker />

              <Dropdown
                align="right"
                label="Account menu"
                trigger={
                  <button className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-surface-2" aria-label="Account menu">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-sm font-bold text-primary-fg">
                      {initials(user?.name ?? "U")}
                    </span>
                    <ChevronDown className="hidden h-4 w-4 text-fg-subtle sm:block" />
                  </button>
                }
                items={[
                  { key: "profile", label: "Profile", icon: <UserRound className="h-4 w-4" />, onClick: () => navigate("/settings") },
                  { key: "appearance", label: "Appearance", icon: <Sparkles className="h-4 w-4" />, onClick: () => navigate("/settings/appearance") },
                  { key: "billing", label: "Billing", icon: <CreditCard className="h-4 w-4" />, onClick: () => navigate("/settings/billing") },
                  { key: "settings", label: "Settings", icon: <SettingsIcon className="h-4 w-4" />, onClick: () => navigate("/settings") },
                  { key: "logout", label: "Sign out", icon: <LogOut className="h-4 w-4" />, danger: true, onClick: handleSignOut },
                ]}
              />
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function SidebarLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) => cn("sw-nav-link", isActive && "sw-nav-link-active")}
    >
      {item.icon}
      {item.label}
    </NavLink>
  );
}
