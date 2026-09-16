import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Download, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { getAudioContext } from "../lib/audio";
import { formatDuration } from "../lib/format";
import { Waveform } from "./Waveform";
import { Slider } from "./ui/Slider";

export interface AudioPlayerHandle {
  play: () => void;
  pause: () => void;
  seek: (t: number) => void;
  setRate: (r: number) => void;
  setVolume: (v: number) => void;
}

interface AudioPlayerProps {
  audioBuffer: AudioBuffer | null;
  onTimeUpdate?: (t: number) => void;
  onEnded?: () => void;
  autoPlay?: boolean;
  onDownload?: () => void;
}

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(function AudioPlayer(
  { audioBuffer, onTimeUpdate, onEnded, autoPlay = false, onDownload },
  ref,
) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [rate, setRateState] = useState(1);
  const [volume, setVolumeState] = useState(100);
  const [muted, setMuted] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startedAtRef = useRef(0);
  const offsetRef = useRef(0);
  const rateRef = useRef(1);
  const playingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onEndedRef = useRef(onEnded);
  onTimeUpdateRef.current = onTimeUpdate;
  onEndedRef.current = onEnded;

  const duration = audioBuffer?.duration ?? 0;

  const stopSource = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.onended = null;
        sourceRef.current.stop();
      } catch {
        /* already stopped */
      }
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
  }, []);

  const stopLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const volumeRef = useRef(100);
  const mutedRef = useRef(false);

  const ensureGraph = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = getAudioContext();
      gainRef.current = ctxRef.current.createGain();
      // Previously the gain node defaulted to 1.0 and the volume slider only
      // took effect after it was moved — a muted player still played at full
      // volume until then.
      gainRef.current.gain.value = mutedRef.current ? 0 : volumeRef.current / 100;
      gainRef.current.connect(ctxRef.current.destination);
    }
    return ctxRef.current;
  }, []);

  const startPlayback = useCallback(
    (offset: number) => {
      const buffer = bufferRef.current;
      const ctx = ensureGraph();
      if (!buffer || !ctx) return;
      if (ctx.state === "suspended") void ctx.resume();
      stopSource();
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rateRef.current;
      src.connect(gainRef.current!);
      src.onended = () => {
        if (playingRef.current) {
          playingRef.current = false;
          setPlaying(false);
          setCurrentTime(0);
          offsetRef.current = 0;
          onEndedRef.current?.();
        }
      };
      src.start(0, Math.min(offset, buffer.duration));
      sourceRef.current = src;
      startedAtRef.current = ctx.currentTime;
      offsetRef.current = offset;
      playingRef.current = true;
      setPlaying(true);
      stopLoop();
      const tick = () => {
        if (!playingRef.current || !ctxRef.current) return;
        const t = offsetRef.current + (ctxRef.current.currentTime - startedAtRef.current) * rateRef.current;
        setCurrentTime(t);
        onTimeUpdateRef.current?.(t);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [ensureGraph, stopLoop, stopSource],
  );

  const pause = useCallback(() => {
    if (!playingRef.current) return;
    const ctx = ctxRef.current;
    if (ctx) offsetRef.current = offsetRef.current + (ctx.currentTime - startedAtRef.current) * rateRef.current;
    playingRef.current = false;
    setPlaying(false);
    stopSource();
    stopLoop();
  }, [stopLoop, stopSource]);

  const play = useCallback(() => {
    const buffer = bufferRef.current;
    if (!buffer) return;
    if (offsetRef.current >= buffer.duration - 0.01) offsetRef.current = 0;
    startPlayback(offsetRef.current);
  }, [startPlayback]);

  const seek = useCallback(
    (t: number) => {
      const buffer = bufferRef.current;
      if (!buffer) return;
      const clamped = Math.max(0, Math.min(t, buffer.duration));
      offsetRef.current = clamped;
      setCurrentTime(clamped);
      if (playingRef.current) {
        startPlayback(clamped);
      } else {
        onTimeUpdateRef.current?.(clamped);
      }
    },
    [startPlayback],
  );

  const setRate = useCallback(
    (r: number) => {
      rateRef.current = r;
      setRateState(r);
      if (playingRef.current) {
        const ctx = ctxRef.current;
        if (ctx) offsetRef.current = offsetRef.current + (ctx.currentTime - startedAtRef.current) * (sourceRef.current?.playbackRate.value ?? 1);
        startPlayback(offsetRef.current);
      }
    },
    [startPlayback],
  );

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    setMuted(v === 0);
    volumeRef.current = v;
    mutedRef.current = v === 0;
    if (gainRef.current) gainRef.current.gain.value = v / 100;
  }, []);

  useImperativeHandle(ref, () => ({ play, pause, seek, setRate, setVolume }), [play, pause, seek, setRate, setVolume]);

  useEffect(() => {
    bufferRef.current = audioBuffer;
    offsetRef.current = 0;
    setCurrentTime(0);
    playingRef.current = false;
    setPlaying(false);
    stopSource();
    stopLoop();
    if (audioBuffer && autoPlay) startPlayback(0);
    return () => {
      stopSource();
      stopLoop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBuffer]);

  const toggleMute = () => {
    const nextMuted = !muted;
    mutedRef.current = nextMuted;
    setMuted(nextMuted);
    if (gainRef.current) gainRef.current.gain.value = nextMuted ? 0 : volumeRef.current / 100;
  };

  if (!audioBuffer) {
    return (
      <div className="flex h-40 items-center justify-center rounded-card border border-border bg-surface text-sm text-fg-subtle">
        Generate audio to see the player
      </div>
    );
  }

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="mb-3">
        <Waveform audioBuffer={audioBuffer} currentTime={currentTime} duration={duration} onSeek={seek} />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => (playing ? pause() : play())}
          aria-label={playing ? "Pause" : "Play"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-primary to-accent text-fg-strong shadow-glow transition-all duration-200 hover:scale-105"
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
        </button>
        <button
          onClick={() => seek(0)}
          aria-label="Restart"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg-strong"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <span className="min-w-0 shrink-0 font-mono text-sm tabular-nums text-fg-muted">
          {formatDuration(currentTime)} <span className="text-fg-subtle">/</span> {formatDuration(duration)}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-1 rounded-md bg-surface-2 p-0.5 sm:flex">
            {RATES.map((r) => (
              <button
                key={r}
                onClick={() => setRate(r)}
                aria-label={`Playback speed ${r}x`}
                aria-pressed={rate === r}
                className={`rounded px-1.5 py-0.5 text-xs font-medium transition-colors ${
                  rate === r ? "bg-primary/30 text-fg-strong" : "text-fg-muted hover:text-fg-strong"
                }`}
              >
                {r}x
              </button>
            ))}
          </div>

          <button onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} className="shrink-0 rounded p-1.5 text-fg-muted transition-colors hover:text-fg-strong">
            {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <div className="hidden w-24 md:block">
            <Slider value={muted ? 0 : volume} onChange={setVolume} min={0} max={100} aria-label="Volume" />
          </div>

          {onDownload && (
            <button
              onClick={onDownload}
              aria-label="Download audio"
              className="ml-1 flex h-9 shrink-0 items-center gap-1.5 rounded-btn border border-border-strong px-3 text-sm text-fg transition-all duration-200 hover:border-primary/60 hover:text-fg-strong"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Download</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
