import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  ChevronDown,
  CircleUserRound,
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
  X,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { Logo } from "../Logo";
import { useAuth } from "../../store/auth";
import { initials } from "../../lib/format";
import { Dropdown } from "../ui/Dropdown";
import { ThemeToggle } from "../ui/ThemeToggle";
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
  { to: "/settings", label: "Settings", icon: <SettingsIcon className="h-5 w-5" /> },
];

const studioNav: { to: string; label: string; icon: ReactNode; sub: { to: string; label: string }[] } = {
  to: "/studio",
  label: "Studio",
  icon: <Sparkles className="h-5 w-5" />,
  sub: [
    { to: "/studio", label: "Text-to-Speech" },
    { to: "/studio/subtitles", label: "Subtitles" },
    { to: "/studio/video", label: "Video" },
  ],
};

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const studioActive = location.pathname.startsWith("/studio");

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
      <div className="flex h-16 items-center justify-between border-b border-line px-4">
        <NavLink to="/dashboard" className="flex items-center">
          <Logo />
        </NavLink>
        <button
          className="flex h-10 w-10 items-center justify-center rounded-md text-muted hover:bg-tint lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        <div className="space-y-1">
          {mainNav.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}

          {/* Studio section with sub-items */}
          <div className="pt-2">
            <NavLink
              to={studioNav.to}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200",
                studioActive ? "bg-accent/15 text-fg" : "text-muted hover:bg-tint hover:text-fg",
              )}
            >
              {studioNav.icon}
              {studioNav.label}
            </NavLink>
            {studioActive && (
              <div className="ml-6 mt-1 space-y-1 border-l border-line pl-3">
                {studioNav.sub.map((s) => (
                  <NavLink
                    key={s.to}
                    to={s.to}
                    end
                    className={({ isActive }) =>
                      cn(
                        "block rounded-md px-3 py-2 text-sm transition-colors",
                        isActive ? "text-accent" : "text-faint hover:text-fg-soft",
                      )
                    }
                  >
                    {s.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          <a
            href="mailto:support@soundwave.ai"
            className="mt-2 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted transition-all duration-200 hover:bg-tint hover:text-fg"
          >
            <HelpCircle className="h-5 w-5" />
            Help & Support
          </a>
        </div>
      </nav>

      <div className="border-t border-line p-3">
        {user?.plan === "FREE" ? (
          <div className="rounded-card border border-line bg-sunken p-3">
            <p className="text-sm font-semibold text-fg">Upgrade to Pro</p>
            <p className="mt-0.5 text-xs text-muted">200K chars, 1080p, no watermark.</p>
            <button
              onClick={() => navigate("/pricing")}
              className="mt-2 w-full rounded-btn bg-accent px-3 py-2 text-sm font-semibold text-accent-ink transition-all duration-200 hover:bg-accent-strong"
            >
              Upgrade
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-card border border-line bg-sunken/60 px-3 py-2.5">
            <span className="h-2 w-2 rounded-full bg-success" />
            <span className="text-sm text-fg-soft">{user?.plan} plan</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-line bg-surface lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-30 bg-scrim lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-30 w-72 border-r border-line bg-surface lg:hidden"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "tween", duration: 0.25 }}
            >
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-line bg-canvas/80 backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted hover:bg-tint lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <form onSubmit={onSearch} className="relative hidden max-w-md flex-1 md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects…"
                className="w-full rounded-input border border-line bg-sunken py-2 pl-9 pr-3 text-sm text-fg placeholder-faint transition-colors focus:border-accent/60 hover:border-line-emphasis"
                aria-label="Search projects"
              />
            </form>

            <div className="ml-auto flex items-center gap-1.5">
              <ThemeToggle className="hover:bg-tint" />
              <button
                aria-label="Notifications"
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-tint hover:text-fg"
              >
                <Bell className="h-5 w-5" />
              </button>

              <Dropdown
                align="right"
                label="Account menu"
                trigger={
                  <button className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-tint">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
                      {initials(user?.name ?? "U")}
                    </span>
                    <ChevronDown className="hidden h-4 w-4 text-muted sm:block" />
                  </button>
                }
                items={[
                  { key: "profile", label: "Profile", icon: <CircleUserRound className="h-4 w-4" />, onClick: () => navigate("/settings") },
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
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200",
          isActive ? "bg-accent/15 text-fg" : "text-muted hover:bg-tint hover:text-fg",
        )
      }
    >
      {item.icon}
      {item.label}
    </NavLink>
  );
}
