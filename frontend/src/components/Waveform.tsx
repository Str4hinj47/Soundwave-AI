import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cssVarColor, useTheme } from "../store/theme";

interface WaveformProps {
  audioBuffer: AudioBuffer | null;
  currentTime: number;
  duration: number;
  onSeek: (t: number) => void;
  height?: number;
  progressColor?: string;
  idleColor?: string;
}

const BUCKETS = 900;

/** Canvas waveform with playhead + click/drag seeking. No external deps. */
export function Waveform({
  audioBuffer,
  currentTime,
  duration,
  onSeek,
  height = 72,
  progressColor,
  idleColor,
}: WaveformProps) {
  // The waveform is painted on a canvas, so it cannot use CSS classes: read the
  // live theme tokens instead. Subscribing to the theme keys re-runs `draw`
  // whenever the user switches theme/accent.
  const themeKey = useTheme((s) => `${s.themeId}|${s.mode}|${s.accentId}|${s.densityId}`);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState(false);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const peaksRef = useRef<number[]>([]);
  const durationRef = useRef(duration);
  durationRef.current = duration;
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;

  const peaks = useMemo(() => {
    if (!audioBuffer) return [];
    const data = audioBuffer.getChannelData(0);
    const per = Math.max(1, Math.floor(data.length / BUCKETS));
    const out: number[] = [];
    for (let i = 0; i < data.length; i += per) {
      let max = 0;
      for (let j = i; j < Math.min(i + per, data.length); j++) {
        const v = Math.abs(data[j] ?? 0);
        if (v > max) max = v;
      }
      out.push(max);
    }
    return out;
  }, [audioBuffer]);

  useEffect(() => {
    bufferRef.current = audioBuffer;
    peaksRef.current = peaks;
  }, [audioBuffer, peaks]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const played = progressColor ?? cssVarColor("accent", 0.9);
    const idle = idleColor ?? cssVarColor("fg-subtle", 0.45);
    const pks = peaksRef.current;
    if (pks.length === 0) {
      // Flat baseline.
      ctx.fillStyle = cssVarColor("fg-subtle", 0.2);
      ctx.fillRect(0, h / 2 - 1, w, 2);
    } else {
      const step = w / pks.length;
      const progress = durationRef.current > 0 ? Math.min(1, currentTime / durationRef.current) : 0;
      const barW = Math.max(1, step * 0.7);
      for (let i = 0; i < pks.length; i++) {
        const x = i * step;
        const barH = Math.max(1, (pks[i] ?? 0) * (h - 6));
        const isPlayed = i / pks.length <= progress;
        ctx.fillStyle = isPlayed ? played : idle;
        ctx.fillRect(x, (h - barH) / 2, barW, barH);
      }
    }

    // Playhead.
    const dur = durationRef.current;
    if (dur > 0) {
      const x = (Math.min(1, Math.max(0, currentTime / dur))) * w;
      ctx.fillStyle = cssVarColor("fg-strong", 1);
      ctx.fillRect(x - 1, 0, 2, h);
    }
  }, [currentTime, progressColor, idleColor, themeKey]);

  useEffect(() => {
    draw();
  }, [draw, currentTime, peaks]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  const seekFromEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onSeekRef.current(frac * durationRef.current);
  };

  return (
    <canvas
      ref={canvasRef}
      style={{ height: `${height}px`, width: "100%", display: "block" }}
      className="cursor-pointer select-none"
      role="slider"
      aria-label="Audio position"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(currentTime)}
      tabIndex={0}
      onMouseDown={(e) => {
        setDragging(true);
        seekFromEvent(e);
      }}
      onMouseMove={(e) => dragging && seekFromEvent(e)}
      onMouseUp={() => setDragging(false)}
      onMouseLeave={() => setDragging(false)}
      onKeyDown={(e) => {
        const step = duration / 20;
        if (e.key === "ArrowRight") {
          e.preventDefault();
          onSeekRef.current(Math.min(duration, currentTime + step));
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onSeekRef.current(Math.max(0, currentTime - step));
        }
        if (e.key === "Home") onSeekRef.current(0);
        if (e.key === "End") onSeekRef.current(duration);
      }}
    />
  );
}
