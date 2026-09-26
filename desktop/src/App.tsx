import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore, useUI, applyTheme } from "./store";
import { Panel } from "./components/Panel";
import { Onboarding } from "./components/Onboarding";
import { BuddyFace } from "./components/BuddyFace";
import { PAIR_STORAGE_KEY, fetchPairInfo, startSync, validatePair } from "./lib/sync";

/** Phone mode: served at /phone (prod) or ?phone=1 (dev). */
function isPhoneMode(): boolean {
  try {
    return (
      new URLSearchParams(window.location.search).get("phone") === "1" ||
      window.location.pathname.startsWith("/phone")
    );
  } catch {
    return false;
  }
}

/** Read & persist the pairing code from the QR deep link (?pair=…). */
function readPairToken(): string | null {
  try {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("pair");
    if (fromUrl) {
      localStorage.setItem(PAIR_STORAGE_KEY, fromUrl);
      url.searchParams.delete("pair");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      return fromUrl;
    }
    return localStorage.getItem(PAIR_STORAGE_KEY);
  } catch {
    return null;
  }
}

function PairingGate({ onConnected }: { onConnected: (token: string) => void }) {
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    const token = draft.trim();
    if (!token) {
      setErr("Paste the pairing code from your computer.");
      return;
    }
    setBusy(true);
    setErr(null);
    const ok = await validatePair(token);
    setBusy(false);
    if (ok) {
      localStorage.setItem(PAIR_STORAGE_KEY, token);
      onConnected(token);
    } else {
      setErr("That code didn’t match. On your computer: Settings → Phone (same Wi‑Fi network).");
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center p-5">
      <div className="w-full max-w-[380px] rounded-3xl bg-panel ring-1 ring-line shadow-panel p-6 text-center">
        <BuddyFace size={96} mood="happy" className="mx-auto bob" />
        <h1 className="mt-4 text-[21px] font-extrabold tracking-tight">Pair with your computer</h1>
        <p className="mt-1.5 text-[13px] text-muted leading-relaxed">
          On your computer open the Soundwave Companion → <strong className="text-ink">Settings → Phone</strong>, then scan
          the QR code or paste the pairing code below. Keep both devices on the same Wi‑Fi.
        </p>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void connect()}
          placeholder="pairing code"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="mt-4 w-full rounded-2xl bg-sunken ring-1 ring-line px-4 py-3 text-[14px] font-mono outline-none focus:ring-accent/50 text-center"
        />
        {err && <p className="mt-2 text-[12px] text-red-500 font-semibold">{err}</p>}
        <button
          onClick={() => void connect()}
          disabled={busy}
          className="mt-3 w-full rounded-full bg-accent text-accent-ink font-bold text-[15px] py-3.5 hover:brightness-105 active:scale-[0.98] transition shadow-pill disabled:opacity-50"
        >
          {busy ? "Checking…" : "Connect"}
        </button>
        <p className="mt-3 text-[11px] text-faint leading-snug">
          The code only works on your local network — your data never leaves your devices.
        </p>
      </div>
    </div>
  );
}

/** The phone web app — same buddy, pocket-sized chrome, live two-way sync. */
function PhoneApp() {
  const onboarded = useStore((s) => s.settings.onboarded);
  const theme = useStore((s) => s.settings.theme);
  const [pair, setPair] = useState<string | null>(() => readPairToken());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!pair) return;
    return startSync(pair);
  }, [pair]);

  if (!pair) {
    return (
      <div className="fixed inset-0 bg-sunken overflow-y-auto">
        <PairingGate onConnected={setPair} />
      </div>
    );
  }

  const panelBody = !onboarded ? (
    <Onboarding openUrl={openUrl} />
  ) : (
    <Panel isElectron={false} phone onBrowserHide={() => undefined} openUrl={openUrl} />
  );
  return <div className="fixed inset-0 bg-sunken">{panelBody}</div>;
}

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
  const [isPhone] = useState(() => isPhoneMode());
  const onboarded = useStore((s) => s.settings.onboarded);
  const theme = useStore((s) => s.settings.theme);
  const phoneLink = useStore((s) => s.settings.phoneLink);
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

  // Companion Link (desktop side): start syncing when the toggle is on.
  useEffect(() => {
    if (isPhone || !phoneLink) return;
    let cancelled = false;
    let stop: (() => void) | null = null;
    void (async () => {
      const info = await fetchPairInfo();
      if (!info || cancelled) return;
      stop = startSync(info.token);
      if (cancelled) stop();
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [phoneLink, isPhone]);

  // Seed the greeting once onboarding is complete (desktop only — the phone
  // pulls it down through Companion Link).
  useEffect(() => {
    if (!onboarded || isPhone) return;
    const st = useStore.getState();
    if (st.messages.length === 0) {
      st.pushMessage({
        sender: "echo",
        text: "Hi — I'm Echo, your computer's little buddy. I keep your tasks, notes, habits, focus and calendar in one place, and I plan your day.\n\nTry: “Create a task to learn how to use Echo, due today.”",
        tag: "local",
      });
    }
  }, [onboarded, isPhone]);

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

  // ── Phone: full-screen mobile shell with bottom nav + live sync ──
  if (isPhone) return <PhoneApp />;

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
