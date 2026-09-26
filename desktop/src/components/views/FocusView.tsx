import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { dayKey, useStore, useUI } from "../../store";
import { mmss } from "../../lib/format";

type Mode = "focus" | "break";

const PRESETS = [15, 25, 50];

export function FocusView() {
  const focusLog = useStore((s) => s.focusLog);
  const logFocus = useStore((s) => s.logFocus);
  const voiceReplies = useStore((s) => s.settings.voiceReplies);
  const neuralVoice = useStore((s) => s.settings.neuralVoice);
  const setMood = useUI((s) => s.setMood);
  const focusRequest = useUI((s) => s.focusRequest);
  const consumeFocusRequest = useUI((s) => s.consumeFocusRequest);

  const [mode, setMode] = useState<Mode>("focus");
  const [minutes, setMinutes] = useState(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const endAtRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);

  const total = (mode === "focus" ? minutes : 5) * 60;
  const today = dayKey();
  const todaySessions = focusLog.filter((f) => dayKey(new Date(f.endedAt)) === today);
  const todayMinutes = todaySessions.reduce((s, f) => s + f.minutes, 0);

  const stopTick = () => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;
    endAtRef.current = null;
  };

  const runInterval = (deadline: number) => {
    stopTick();
    endAtRef.current = deadline;
    tickRef.current = window.setInterval(() => {
      if (!endAtRef.current) return;
      const left = Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) finishRef.current?.();
    }, 250);
  };

  const finish = () => {
    stopTick();
    setRunning(false);
    setMood("happy");
    if (mode === "focus") {
      logFocus(minutes);
      const msg = `${minutes} minute focus complete. Stand up, look far away, breathe.`;
      if (voiceReplies) {
        void import("../../lib/voice").then((m) =>
          m.speakText(msg, { neuralVoice, preferNeural: false })
        );
      }
      setMode("break");
      setRemaining(5 * 60);
    } else {
      setMode("focus");
      setRemaining(minutes * 60);
    }
    setTimeout(() => {
      if (useUI.getState().mood === "happy") setMood("idle");
    }, 2200);
  };

  // keep the freshest finish() reachable from timer intervals
  const finishRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    finishRef.current = finish;
  });

  const start = () => {
    setRunning(true);
    setMood("focused");
    runInterval(Date.now() + remaining * 1000);
  };

  const pause = () => {
    stopTick();
    setRunning(false);
    if (useUI.getState().mood === "focused") setMood("idle");
  };

  const reset = () => {
    stopTick();
    setRunning(false);
    setRemaining(total);
    if (useUI.getState().mood === "focused") setMood("idle");
  };

  // external request (from chat card / Today view)
  useEffect(() => {
    if (!focusRequest) return;
    setMode("focus");
    setMinutes(focusRequest);
    setRemaining(focusRequest * 60);
    setRunning(true);
    setMood("focused");
    consumeFocusRequest();
    runInterval(Date.now() + focusRequest * 60000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  useEffect(() => () => stopTick(), []);

  const progress = 1 - remaining / total;
  const R = 84;
  const C = 2 * Math.PI * R;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="px-4 pt-3.5 pb-2 border-b border-line flex items-baseline justify-between">
        <h2 className="text-[16px] font-extrabold tracking-tight">Focus</h2>
        <span className="text-[11px] font-bold text-muted">
          {todayMinutes}m today · {todaySessions.length} sessions
        </span>
      </div>

      <div className="px-4 pt-5 flex flex-col items-center">
        {/* ring */}
        <div className="relative">
          <svg width="208" height="208" viewBox="0 0 208 208">
            <circle cx="104" cy="104" r={R} fill="none" stroke="var(--line)" strokeWidth="12" />
            <circle
              cx="104"
              cy="104"
              r={R}
              fill="none"
              stroke={mode === "focus" ? "var(--accent)" : "var(--good)"}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - progress)}
              transform="rotate(-90 104 104)"
              style={{ transition: "stroke-dashoffset 0.3s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">
              {mode === "focus" ? "deep work" : "break"}
            </div>
            <div className="text-[44px] font-extrabold tabular-nums leading-none tracking-tight">{mmss(remaining)}</div>
            <div className="mt-1.5 text-[11px] text-muted font-semibold">
              {running ? (mode === "focus" ? "in the zone" : "recharge") : "ready when you are"}
            </div>
          </div>
        </div>

        {/* controls */}
        <div className="mt-5 flex items-center gap-2.5">
          <button
            onClick={reset}
            className="rounded-full p-3 bg-card ring-1 ring-line text-muted hover:text-ink hover:ring-accent/40 transition"
            title="Reset"
          >
            <RotateCcw className="h-4.5 w-4.5" style={{ height: 18, width: 18 }} />
          </button>
          <button
            onClick={running ? pause : start}
            className="rounded-full px-8 py-3.5 bg-accent text-accent-ink font-bold text-[14px] inline-flex items-center gap-2 hover:brightness-105 active:scale-95 transition shadow-pill"
          >
            {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {running ? "Pause" : "Start"}
          </button>
          <button
            onClick={() => {
              setMode((m) => (m === "focus" ? "break" : "focus"));
              reset();
            }}
            className="rounded-full p-3 bg-card ring-1 ring-line text-muted hover:text-ink hover:ring-accent/40 transition"
            title={mode === "focus" ? "Switch to break" : "Switch to focus"}
          >
            <Timer className="h-[18px] w-[18px]" />
          </button>
        </div>

        {/* presets */}
        {mode === "focus" && (
          <div className="mt-4 flex gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => {
                  setMinutes(p);
                  if (!running) setRemaining(p * 60);
                }}
                className={`rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${
                  minutes === p ? "bg-ink text-panel" : "bg-card ring-1 ring-line text-muted hover:text-ink"
                }`}
              >
                {p} min
              </button>
            ))}
          </div>
        )}

        {/* sessions */}
        <div className="mt-6 w-full rounded-2xl bg-card ring-1 ring-line p-3.5 shadow-card">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted mb-2">Today’s sessions</div>
          {todaySessions.length === 0 ? (
            <p className="text-[12.5px] text-muted">No sessions yet — 25 minutes is a great start.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {todaySessions.map((s) => (
                <span key={s.id} className="rounded-full bg-accent-soft text-accent px-2.5 py-1 text-[11px] font-bold">
                  {s.minutes}m
                </span>
              ))}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-line grid grid-cols-2 gap-2 text-center">
            <div>
              <div className="text-[19px] font-extrabold tabular-nums">{todayMinutes}</div>
              <div className="text-[10px] text-muted font-bold uppercase tracking-wide">minutes</div>
            </div>
            <div>
              <div className="text-[19px] font-extrabold tabular-nums">{focusLog.reduce((s, f) => s + f.minutes, 0)}</div>
              <div className="text-[10px] text-muted font-bold uppercase tracking-wide">all time</div>
            </div>
          </div>
        </div>
        <div className="h-4" />
      </div>
    </div>
  );
}
