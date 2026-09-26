import { useEffect, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronUp,
  Flame,
  MessageCircle,
  Settings as SettingsIcon,
  StickyNote,
  Sun,
  Timer,
} from "lucide-react";
import { useStore, useUI } from "../store";
import type { TabId } from "../lib/types";
import { BuddyFace } from "./BuddyFace";
import { TodayView } from "./views/TodayView";
import { ChatView } from "./views/ChatView";
import { TasksView } from "./views/TasksView";
import { NotesView } from "./views/NotesView";
import { FocusView } from "./views/FocusView";
import { HabitsView } from "./views/HabitsView";
import { CalendarView } from "./views/CalendarView";
import { SettingsView } from "./views/SettingsView";

const TABS: Array<{ id: TabId; label: string; icon: typeof Sun }> = [
  { id: "today", label: "Today", icon: Sun },
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "tasks", label: "Tasks", icon: CheckCircle2 },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "focus", label: "Focus", icon: Timer },
  { id: "habits", label: "Habits", icon: Flame },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

function NavItem({
  label,
  icon: Icon,
  active,
  badge,
  horizontal,
  onClick,
}: {
  label: string;
  icon: typeof Sun;
  active: boolean;
  badge?: number;
  horizontal?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative shrink-0 ${
        horizontal ? "w-[62px] py-1.5" : "w-[58px] py-2"
      } rounded-2xl flex flex-col items-center gap-1 transition-colors ${active ? "text-accent" : "text-muted hover:text-ink"}`}
      title={label}
    >
      {active && <span className={`absolute inset-0 ${horizontal ? "bg-accent-soft" : "rounded-2xl bg-accent-soft"}`} aria-hidden />}
      <span className="relative">
        <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 2} />
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-accent text-accent-ink text-[9px] font-bold flex items-center justify-center">
            {badge}
          </span>
        )}
      </span>
      <span className="relative text-[9.5px] font-semibold tracking-tight">{label}</span>
    </button>
  );
}

function useOpenTaskCount() {
  return useStore((s) => s.tasks.filter((t) => !t.done).length);
}

function Rail() {
  const tab = useUI((s) => s.tab);
  const setTab = useUI((s) => s.setTab);
  const openTasks = useOpenTaskCount();

  return (
    <nav className="w-[68px] shrink-0 border-r border-line bg-panel flex flex-col items-center py-2 gap-0.5">
      {TABS.map(({ id, label, icon }) => (
        <NavItem
          key={id}
          label={label}
          icon={icon}
          active={tab === id}
          badge={id === "tasks" ? openTasks : undefined}
          onClick={() => setTab(id)}
        />
      ))}
    </nav>
  );
}

/** Phone layout: icon strip along the bottom (thumb-friendly, scrollable). */
function PhoneNav() {
  const tab = useUI((s) => s.tab);
  const setTab = useUI((s) => s.setTab);
  const openTasks = useOpenTaskCount();
  return (
    <nav
      className="shrink-0 border-t border-line bg-panel flex overflow-x-auto gap-0.5 px-1.5 pt-1.5"
      style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
    >
      {TABS.map(({ id, label, icon }) => (
        <NavItem
          key={id}
          label={label}
          icon={icon}
          active={tab === id}
          badge={id === "tasks" ? openTasks : undefined}
          horizontal
          onClick={() => setTab(id)}
        />
      ))}
    </nav>
  );
}

export function Panel({
  isElectron,
  onBrowserHide,
  openUrl,
  phone = false,
}: {
  isElectron: boolean;
  onBrowserHide: () => void;
  openUrl: (url: string) => void;
  phone?: boolean;
}) {
  const tab = useUI((s) => s.tab);
  const mood = useUI((s) => s.mood);
  const brain = useStore((s) => s.settings.brain);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  const hide = () => {
    if (window.companion?.hide) window.companion.hide();
    else onBrowserHide();
  };

  return (
    <div className="h-full w-full overflow-hidden rounded-b-[28px] bg-panel text-ink shadow-panel flex flex-col ring-1 ring-black/5">
      {/* window chrome */}
      <header
        className={`h-11 shrink-0 flex items-center gap-2.5 px-3 border-b border-line bg-panel ${isElectron ? "drag" : ""}`}
      >
        <BuddyFace size={24} mood={mood} className="shrink-0 no-drag" />
        <div className="no-drag leading-tight">
          <div className="text-[12.5px] font-bold tracking-tight">Soundwave</div>
          <div className="text-[9.5px] text-muted font-medium -mt-0.5">your little buddy</div>
        </div>
        <div className="flex-1" />
        <span
          className={`no-drag inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[10px] font-bold tracking-wide ${
            brain === "cloud" ? "bg-accent text-accent-ink" : "bg-sunken text-muted ring-1 ring-line"
          }`}
          title={brain === "cloud" ? "Bigger Soundwave brain (cloud)" : "On-device brain — everything stays local"}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${brain === "cloud" ? "bg-white" : "bg-good"}`} />
          {brain === "cloud" ? "CLOUD" : "LOCAL"}
        </span>
        <span className="no-drag text-[11px] text-muted tabular-nums font-medium">
          {clock.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </span>
        {!phone && (
          <button
            onClick={hide}
            className="no-drag rounded-full p-1.5 text-muted hover:text-ink hover:bg-sunken transition"
            title="Tuck away (Ctrl + Alt + Space)"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        )}
      </header>

      {/* body */}
      <div className="flex-1 min-h-0 flex">
        {!phone && <Rail />}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col bg-sunken">
          {tab === "today" && <TodayView openUrl={openUrl} />}
          {tab === "chat" && <ChatView openUrl={openUrl} />}
          {tab === "tasks" && <TasksView />}
          {tab === "notes" && <NotesView />}
          {tab === "focus" && <FocusView />}
          {tab === "habits" && <HabitsView />}
          {tab === "calendar" && <CalendarView />}
          {tab === "settings" && <SettingsView openUrl={openUrl} />}
        </main>
      </div>

      {phone && <PhoneNav />}
    </div>
  );
}
