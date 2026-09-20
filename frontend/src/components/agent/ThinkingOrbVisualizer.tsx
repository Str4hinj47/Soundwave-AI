import { useEffect, useRef, useState } from "react";
import { MODE_DRAWS, resolvePreset, type OrbState } from "thinking-orbs";

interface ThinkingOrbVisualizerProps {
  assistantState: "STANDBY" | "LISTENING" | "THINKING" | "SPEAKING" | "GENERATING";
  isMicActive?: boolean;
  size?: number;
  className?: string;
  onOrbClick?: () => void;
}

const ALL_STATES: { id: OrbState | "auto"; label: string; desc: string }[] = [
  { id: "auto", label: "Auto Sync", desc: "Syncs with agent cognitive state" },
  { id: "listening", label: "Listening", desc: "Waveform rolls through rings" },
  { id: "solving", label: "Solving", desc: "Bands scramble & click back" },
  { id: "searching", label: "Searching", desc: "Scan meridian sweeps globe" },
  { id: "connecting", label: "Connecting", desc: "Constellation wires itself" },
  { id: "weaving", label: "Weaving", desc: "Three strands plait sphere" },
  { id: "composing", label: "Composing", desc: "Undulating multi-band sash" },
  { id: "breathing", label: "Breathing", desc: "Morphing face-on ring" },
  { id: "working", label: "Working", desc: "Particles on tilted orbits" },
  { id: "shaping", label: "Shaping", desc: "Circle to triangle to square" },
];

export function ThinkingOrbVisualizer({
  assistantState,
  isMicActive = false,
  size = 280,
  className = "",
  onOrbClick,
}: ThinkingOrbVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [overrideState, setOverrideState] = useState<OrbState | "auto">("auto");
  const [showStatePicker, setShowStatePicker] = useState(false);

  // Map agent cognitive state to Jakubantalik Thinking Orb state
  const resolvedState: OrbState =
    overrideState !== "auto"
      ? overrideState
      : assistantState === "LISTENING" || isMicActive
      ? "listening"
      : assistantState === "THINKING"
      ? "solving"
      : assistantState === "SPEAKING"
      ? "weaving"
      : assistantState === "GENERATING"
      ? "connecting"
      : "breathing";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const preset = resolvePreset(resolvedState, 64);
    const drawFn = MODE_DRAWS[preset.mode];
    const speedMultiplier =
      assistantState === "THINKING" || assistantState === "GENERATING"
        ? preset.speed * 1.3
        : assistantState === "LISTENING"
        ? preset.speed * 1.15
        : preset.speed;

    let animId: number;
    let isMounted = true;

    const render = () => {
      if (!isMounted) return;

      const t = (performance.now() / 1000) * speedMultiplier;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      // Render Jakubantalik Dotted Thinking Orb geometry at full canvas scale
      drawFn(ctx, size, t, true, preset.opts);

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      isMounted = false;
      cancelAnimationFrame(animId);
    };
  }, [resolvedState, assistantState, isMicActive, size]);

  return (
    <div className={`relative flex flex-col items-center justify-center select-none ${className}`}>
      {/* Outer Cyan Energy Aura */}
      <div className="relative flex items-center justify-center p-2 cursor-pointer group" onClick={onOrbClick}>
        <div
          className={`absolute inset-0 rounded-full blur-2xl transition-all duration-700 pointer-events-none ${
            assistantState === "LISTENING" || isMicActive
              ? "bg-emerald-500/20 scale-110"
              : assistantState === "THINKING"
              ? "bg-purple-500/25 scale-115"
              : assistantState === "SPEAKING"
              ? "bg-cyan-500/25 scale-110"
              : assistantState === "GENERATING"
              ? "bg-blue-500/30 scale-120"
              : "bg-cyan-500/10 scale-95"
          }`}
        />

        {/* Outer Orbital Dashed Guide Ring */}
        <div
          className="absolute rounded-full border border-cyan-500/15 pointer-events-none animate-spin"
          style={{
            width: size + 28,
            height: size + 28,
            animationDuration: "40s",
            borderStyle: "dashed",
          }}
        />

        {/* Jakubantalik Thinking Orb Canvas */}
        <canvas
          ref={canvasRef}
          style={{ width: size, height: size }}
          className="relative z-10 transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      {/* State Switcher & Mode Badge */}
      <div className="flex flex-col items-center mt-3 gap-1.5 z-20">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-[#0C172E] px-3.5 py-1 text-xs font-mono font-semibold text-cyan-300 shadow-inner">
            <span
              className={`h-2 w-2 rounded-full animate-pulse ${
                assistantState === "LISTENING" || isMicActive
                  ? "bg-emerald-400"
                  : assistantState === "THINKING"
                  ? "bg-purple-400"
                  : assistantState === "SPEAKING"
                  ? "bg-cyan-400"
                  : assistantState === "GENERATING"
                  ? "bg-blue-400"
                  : "bg-cyan-400/80"
              }`}
            />
            {ALL_STATES.find((s) => s.id === resolvedState)?.label} Mode ({resolvedState})
          </span>

          <button
            type="button"
            onClick={() => setShowStatePicker(!showStatePicker)}
            className="rounded-lg border border-[#172A4A] bg-[#070D18] px-2 py-1 text-[11px] font-mono text-gray-400 hover:text-cyan-300 transition-colors cursor-pointer"
            title="Toggle Thinking Orb Animation State"
          >
            {showStatePicker ? "Hide Modes" : "Switch Orb"}
          </button>
        </div>

        {/* 9-State Selector Pills */}
        {showStatePicker && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-sm p-2 rounded-xl border border-cyan-500/20 bg-[#070D18]/95 backdrop-blur-md mt-2 transition-all shadow-xl">
            {ALL_STATES.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  setOverrideState(st.id);
                  if (st.id === "auto") setShowStatePicker(false);
                }}
                className={`rounded-md px-2.5 py-1 text-[10px] font-mono font-semibold transition-all cursor-pointer ${
                  overrideState === st.id
                    ? "bg-cyan-500 text-[#070B14] shadow-sm shadow-cyan-500/50"
                    : "border border-[#172A4A] bg-[#0C172E] text-gray-300 hover:text-white hover:border-cyan-500/40"
                }`}
                title={st.desc}
              >
                {st.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ThinkingOrbVisualizer;
