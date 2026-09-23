import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
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
  Plus,
  Activity,
  Film,
  Volume2,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { LogoMark } from "../Logo";
import { useAuth } from "../../store/auth";
import { initials } from "../../lib/format";
import { Dropdown } from "../ui/Dropdown";
import { toast } from "../../store/toast";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  badge?: string | ReactNode;
  end?: boolean;
}

const workspaceNav: NavItem[] = [
  { to: "/dashboard", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" />, end: true },
  { to: "/agent", label: "Command Center", icon: <Bot className="h-4 w-4" />, badge: "Live" },
  { to: "/projects", label: "Projects", icon: <FolderKanban className="h-4 w-4" /> },
  { to: "/voices", label: "Voice Library", icon: <Mic className="h-4 w-4" /> },
];

const createNav: NavItem[] = [
  { to: "/agent?tab=generator", label: "Generate Short", icon: <Sparkles className="h-4 w-4" /> },
  { to: "/studio/video", label: "Compose Video", icon: <Film className="h-4 w-4" /> },
  { to: "/studio", label: "Generate Voiceover", icon: <Volume2 className="h-4 w-4" /> },
];

const manageNav: NavItem[] = [
  { to: "/agent?tab=activity", label: "Activity", icon: <Activity className="h-4 w-4" /> },
  { to: "/settings", label: "Settings", icon: <SettingsIcon className="h-4 w-4" /> },
  { to: "/help", label: "Help & Docs", icon: <HelpCircle className="h-4 w-4" /> },
];

export function AppShell({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const user = auth.user;
  const signOut = auth.signOut;
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {}
    navigate("/studio/video");
    toast.info("Signed out", "You have been signed out of Soundwave AI.");
  };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;
    navigate(`/projects?q=${encodeURIComponent(search.trim())}`);
  };

  // Compute clean breadcrumbs
  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path.startsWith("/agent")) return { section: "Workspace", current: "Command Center" };
    if (path.startsWith("/dashboard")) return { section: "Workspace", current: "Overview" };
    if (path.startsWith("/projects")) return { section: "Workspace", current: "Projects" };
    if (path.startsWith("/voices")) return { section: "Workspace", current: "Voice Library" };
    if (path.startsWith("/studio/video")) return { section: "Create", current: "Compose Video" };
    if (path.startsWith("/studio/subtitles")) return { section: "Create", current: "Subtitles" };
    if (path.startsWith("/studio")) return { section: "Create", current: "Generate Voiceover" };
    if (path.startsWith("/settings")) return { section: "Manage", current: "Settings" };
    if (path.startsWith("/help")) return { section: "Manage", current: "Help & Support" };
    return { section: "Workspace", current: "Studio" };
  };

  const breadcrumb = getBreadcrumb();

  const sidebar = (
    <div className="flex h-full flex-col bg-[#0F1017] text-gray-300 select-none">
      {/* Workspace Brand Switcher */}
      <div className="flex h-14 items-center justify-between border-b border-white/[0.06] px-3.5">
        <NavLink to="/agent" className="flex items-center gap-2.5 group">
          <LogoMark className="h-7 w-7" />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-white tracking-tight group-hover:text-blue-400 transition-colors">
              Soundwave <span className="text-blue-400">AI</span>
            </span>
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              Command Suite
              <ChevronDown className="h-3 w-3 text-gray-400" />
            </span>
          </div>
        </NavLink>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/[0.06] hover:text-white lg:hidden transition-colors"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Global Quick Search Input in Sidebar */}
      <div className="px-3 pt-3">
        <form onSubmit={onSearch} className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full rounded-lg border border-white/[0.07] bg-white/[0.03] py-1.5 pl-8 pr-2.5 text-xs text-white placeholder-gray-400 transition-colors hover:border-white/[0.12] focus:border-blue-500 focus:outline-none"
          />
        </form>
      </div>

      {/* Grouped Navigation */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4" aria-label="Main navigation">
        {/* Group: Workspace */}
        <div>
          <div className="px-2.5 pb-1 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
            Workspace
          </div>
          <div className="space-y-0.5">
            {workspaceNav.map((item) => (
              <SidebarNavLink key={item.to} item={item} />
            ))}
          </div>
        </div>

        {/* Group: Create */}
        <div>
          <div className="px-2.5 pb-1 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
            Create
          </div>
          <div className="space-y-0.5">
            {createNav.map((item) => (
              <SidebarNavLink key={item.to} item={item} />
            ))}
          </div>
        </div>

        {/* Group: Manage */}
        <div>
          <div className="px-2.5 pb-1 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
            Manage
          </div>
          <div className="space-y-0.5">
            {manageNav.map((item) => (
              <SidebarNavLink key={item.to} item={item} />
            ))}
          </div>
        </div>
      </nav>

      {/* Workspace System Status Pill */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-xs text-gray-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="truncate">Fleet Online · 4 Agents</span>
        </div>
      </div>

      {/* Bottom User Area */}
      <div className="border-t border-white/[0.06] p-2.5">
        <Dropdown
          align="right"
          label="Account options"
          trigger={
            <button className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-white/[0.05]">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-600/80 text-xs font-semibold text-white">
                {initials(user?.name ?? "Creator")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-white">{user?.name ?? "Creator Workspace"}</p>
                <p className="truncate text-[11px] text-gray-400">{user?.plan ?? "PRO"} Plan</p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            </button>
          }
          items={[
            { key: "profile", label: "Profile", icon: <CircleUserRound className="h-4 w-4" />, onClick: () => navigate("/settings") },
            { key: "billing", label: "Plan & Billing", icon: <CreditCard className="h-4 w-4" />, onClick: () => navigate("/settings/billing") },
            { key: "settings", label: "Settings", icon: <SettingsIcon className="h-4 w-4" />, onClick: () => navigate("/settings") },
            { key: "logout", label: "Sign out", icon: <LogOut className="h-4 w-4" />, danger: true, onClick: handleSignOut },
          ]}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0C0D12] text-gray-100 flex flex-col">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 border-r border-white/[0.06] bg-[#0F1017] lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-30 bg-black/70 backdrop-blur-xs lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-30 w-64 bg-[#0F1017] border-r border-white/[0.08] lg:hidden"
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: "tween", duration: 0.2 }}
            >
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="lg:pl-60 flex-1 flex flex-col">
        {/* Header Bar */}
        <header className="sticky top-0 z-10 h-14 border-b border-white/[0.06] bg-[#0C0D12]/90 backdrop-blur-md">
          <div className="flex h-full items-center justify-between px-4 sm:px-6">
            {/* Left: Mobile trigger & Breadcrumbs */}
            <div className="flex items-center gap-3">
              <button
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-white/[0.06] hover:text-white lg:hidden transition-colors"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation menu"
              >
                <Menu className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-gray-400">{breadcrumb.section}</span>
                <span className="text-gray-400">/</span>
                <span className="font-medium text-white">{breadcrumb.current}</span>
              </div>
            </div>

            {/* Right: Quick actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/agent?tab=generator")}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 active:bg-blue-700 transition-colors shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create with Agent</span>
              </button>

              <button
                onClick={() => navigate("/help")}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/[0.06] hover:text-white transition-colors"
                aria-label="Help"
                title="Help & Documentation"
              >
                <HelpCircle className="h-4 w-4" />
              </button>

              <button
                onClick={() => navigate("/settings")}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/[0.06] hover:text-white transition-colors"
                aria-label="Settings"
                title="Workspace Settings"
              >
                <SettingsIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main
          className={cn(
            "flex-1 w-full mx-auto",
            location.pathname.startsWith("/agent")
              ? "max-w-none px-2 sm:px-4 py-3"
              : "max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarNavLink({ item }: { item: NavItem }) {
  const location = useLocation();
  const currentPathWithSearch = location.pathname + location.search;
  const isMatch = item.to.includes("?")
    ? currentPathWithSearch === item.to
    : location.pathname === item.to;

  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={cn(
        "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
        isMatch
          ? "bg-white/[0.08] text-white"
          : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200",
      )}
    >
      <div className="flex items-center gap-2.5 truncate">
        <span className={cn(isMatch ? "text-blue-400" : "text-gray-400")}>{item.icon}</span>
        <span className="truncate">{item.label}</span>
      </div>
      {item.badge && (
        <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">
          {item.badge}
        </span>
      )}
    </NavLink>
  );
}
