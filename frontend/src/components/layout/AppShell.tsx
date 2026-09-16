import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Bot,
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
  { to: "/jarvis", label: "JARVIS Expert", icon: <Bot className="h-5 w-5" /> },
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
      <div className="flex h-16 items-center justify-between border-b border-gray-800 px-4">
        <NavLink to="/dashboard" className="flex items-center">
          <Logo />
        </NavLink>
        <button
          className="flex h-10 w-10 items-center justify-center rounded-md text-gray-400 hover:bg-gray-800 lg:hidden"
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
                studioActive ? "bg-blue-500/15 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white",
              )}
            >
              {studioNav.icon}
              {studioNav.label}
            </NavLink>
            {studioActive && (
              <div className="ml-6 mt-1 space-y-1 border-l border-gray-800 pl-3">
                {studioNav.sub.map((s) => (
                  <NavLink
                    key={s.to}
                    to={s.to}
                    end
                    className={({ isActive }) =>
                      cn(
                        "block rounded-md px-3 py-2 text-sm transition-colors",
                        isActive ? "text-blue-300" : "text-gray-500 hover:text-gray-200",
                      )
                    }
                  >
                    {s.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          <NavLink
            to="/help"
            className={({ isActive }) =>
              cn(
                "mt-2 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive ? "bg-blue-500/10 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white",
              )
            }
          >
            <HelpCircle className="h-5 w-5" />
            Help & Support
          </NavLink>
        </div>
      </nav>

      <div className="border-t border-gray-800 p-3">
        {user?.plan === "FREE" ? (
          <div className="rounded-card border border-violet-500/30 bg-gradient-to-br from-blue-500/10 to-violet-500/10 p-3">
            <p className="text-sm font-semibold text-white">Upgrade to Pro</p>
            <p className="mt-0.5 text-xs text-gray-400">200K chars, 1080p, no watermark.</p>
            <button
              onClick={() => navigate("/pricing")}
              className="mt-2 w-full rounded-btn bg-gradient-to-r from-blue-500 to-violet-500 px-3 py-2 text-sm font-semibold text-white transition-all duration-200 hover:from-blue-400 hover:to-violet-400"
            >
              Upgrade
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-card border border-gray-800 bg-gray-900/60 px-3 py-2.5">
            <span className="h-2 w-2 rounded-full bg-success" />
            <span className="text-sm text-gray-300">{user?.plan} plan</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-navy">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-gray-800 bg-panel lg:block">{sidebar}</aside>

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
              className="fixed inset-y-0 left-0 z-30 w-72 bg-panel lg:hidden"
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
        <header className="sticky top-0 z-10 border-b border-gray-800 bg-navy/85 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-800 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <form onSubmit={onSearch} className="relative hidden max-w-md flex-1 md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects…"
                className="w-full rounded-input border border-gray-700 bg-gray-900 py-2 pl-9 pr-3 text-sm text-white placeholder-gray-500 transition-colors hover:border-gray-600"
                aria-label="Search projects"
              />
            </form>

            <div className="ml-auto flex items-center gap-1.5">
              <button
                aria-label="Notifications"
                className="flex h-10 w-10 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
              >
                <Bell className="h-5 w-5" />
              </button>

              <Dropdown
                align="right"
                label="Account menu"
                trigger={
                  <button className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-gray-800">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-sm font-bold text-white">
                      {initials(user?.name ?? "U")}
                    </span>
                    <ChevronDown className="hidden h-4 w-4 text-gray-400 sm:block" />
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
          isActive ? "bg-blue-500/15 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white",
        )
      }
    >
      {item.icon}
      {item.label}
    </NavLink>
  );
}
