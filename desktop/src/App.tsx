import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore, useUI, applyTheme } from "./store";
import { Panel } from "./components/Panel";
import { Onboarding } from "./components/Onboarding";
import { BuddyFace } from "./components/BuddyFace";

function openUrl(url: string) {
  if (window.companion?.openExternal) window.companion.openExternal(url);
  else window.open(url, "_blank", "noopener");
}

function MenuBar({ onToggle }: { onToggle: () => void }) {
  const [clock, setClock] = useState(() => new Date());
  const mood = useUI((s) => s.mood);
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 10000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="absolute inset-x-0 top-0 h-8 z-30 flex items-center justify-between px-3 text-[12px] text-ink/80 select-none">
      <div className="flex items-center gap-2 font-semibold tracking-tight drop-shadow-sm">
        <span aria-hidden>🌊</span>
        <span>Soundwave</span>
        <span className="font-normal opacity-60">Companion</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden sm:inline opacity-70">{clock.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</span>
        <span className="tabular-nums opacity-90">{clock.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
        <button
          onClick={onToggle}
          className="rounded-full p-0.5 ring-1 ring-black/10 hover:scale-110 active:scale-95 transition bg-white/40"
          title="Toggle Echo (Ctrl + Alt + Space)"
        >
          <BuddyFace size={20} mood={mood} />
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const onboarded = useStore((s) => s.settings.onboarded);
  const theme = useStore((s) => s.settings.theme);
  const panelOpen = useUI((s) => s.panelOpen);
  const setPanelOpen = useUI((s) => s.setPanelOpen);
  const isElectron = Boolean(window.companion?.isElectron);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // The panel is always down during first-run onboarding (like Taby's setup).
  useEffect(() => {
    if (!onboarded) setPanelOpen(true);
  }, [onboarded, setPanelOpen]);

  // Seed the greeting once onboarding is complete.
  useEffect(() => {
    if (!onboarded) return;
    const st = useStore.getState();
    if (st.messages.length === 0) {
      st.pushMessage({
        sender: "echo",
        text: "Hi — I'm Echo, your computer's little buddy. I keep your tasks, notes, habits, focus and calendar in one place, and I plan your day.\n\nTry: “Create a task to learn how to use Echo, due today.”",
        tag: "local",
      });
    }
  }, [onboarded]);

  // Global hotkey: Ctrl/Cmd + Alt + Space toggles the panel; Esc tucks it away.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.code === "Space") {
        e.preventDefault();
        setPanelOpen(!useUI.getState().panelOpen);
      } else if (e.key === "Escape" && useUI.getState().panelOpen && !window.companion?.isElectron) {
        setPanelOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    const off = window.companion?.onVisibility?.((v: boolean) => setPanelOpen(v));
    return () => {
      window.removeEventListener("keydown", onKey);
      off?.();
    };
  }, [setPanelOpen]);

  const scheduleClose = (ms: number) => {
    if (!onboarded) return;
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setPanelOpen(false), ms);
  };
  const cancelClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  const panelBody = !onboarded ? (
    <Onboarding openUrl={openUrl} />
  ) : (
    <Panel isElectron={isElectron} onBrowserHide={() => setPanelOpen(false)} openUrl={openUrl} />
  );

  // ── Electron: the window IS the panel; transparent around the corners ──
  if (isElectron) {
    return (
      <div className="fixed inset-0 pointer-events-none">
        <div className="pointer-events-auto h-full w-full">{panelBody}</div>
      </div>
    );
  }

  // ── Browser preview: a fake desktop with the panel dropping from the top ──
  return (
    <div className="fixed inset-0 wallpaper overflow-hidden">
      <MenuBar
        onToggle={() => {
          cancelClose();
          setPanelOpen(!panelOpen);
        }}
      />

      {/* hover the top edge of the screen to drop the panel down */}
      {!panelOpen && (
        <div
          className="absolute inset-x-0 top-0 h-4 z-40"
          onMouseEnter={() => {
            cancelClose();
            setPanelOpen(true);
          }}
          title="Hover to open Echo"
        />
      )}

      <AnimatePresence>
        {panelOpen && (
          <motion.div
            key="panel"
            initial={{ y: "-104%" }}
            animate={{ y: 0 }}
            exit={{ y: "-104%" }}
            transition={{ type: "spring", stiffness: 290, damping: 31, mass: 0.75 }}
            className="absolute top-0 inset-x-0 flex justify-center z-50 pointer-events-none"
            onMouseEnter={cancelClose}
            onMouseLeave={() => scheduleClose(950)}
          >
            <div className="pointer-events-auto w-[min(97vw,472px)] h-[min(95vh,792px)]">{panelBody}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* friendly hint, like the hotkey tip in Taby's setup */}
      <AnimatePresence>
        {panelOpen && onboarded && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 rounded-full bg-black/45 text-white/90 text-[11.5px] px-4 py-2 backdrop-blur-md shadow-lg"
          >
            Press <kbd className="font-sans font-semibold">Ctrl</kbd> + <kbd className="font-sans font-semibold">Alt</kbd> +{" "}
            <kbd className="font-sans font-semibold">Space</kbd> to toggle · hover the top edge · <span>Esc</span> to hide
          </motion.div>
        )}
      </AnimatePresence>

      {/* desktop watermark */}
      <div className="absolute bottom-5 right-6 text-[11px] text-ink/35 font-medium tracking-wide select-none">
        Soundwave Companion — your computer’s little buddy
      </div>
    </div>
  );
}
