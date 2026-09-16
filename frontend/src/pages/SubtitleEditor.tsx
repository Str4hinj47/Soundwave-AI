import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowDown,
  Clapperboard,
  Grid3X3,
  Play as PlayIcon,
  Plus,
  Redo2,
  Save,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { useStudio } from "../store/studio";
import { AudioPlayer, type AudioPlayerHandle } from "../components/AudioPlayer";
import { Button } from "../components/ui/Button";
import { Slider } from "../components/ui/Slider";
import { Select } from "../components/ui/Select";
import { Toggle } from "../components/ui/Toggle";
import { ColorPicker } from "../components/ui/ColorPicker";
import { Badge } from "../components/ui/Badge";
import { cn } from "../lib/cn";
import { cuesFromTimings, estimateWordTimings, downloadBlob } from "../lib/audio";
import { useAuth } from "../store/auth";
import { buildProjectMeta, persistProject } from "../lib/projectSave";
import { subtitleStyleToCss, subtitlePosition } from "../lib/subtitleStyle";
import { DEFAULT_SUBTITLE_STYLE, FONT_OPTIONS, GOOGLE_FONTS_LINK, SUBTITLE_PRESETS } from "../lib/subtitlePresets";
import { toast } from "../store/toast";
import type { SubtitleCue, SubtitleStyle } from "../lib/types";

interface Snapshot {
  cues: SubtitleCue[];
  style: SubtitleStyle;
}

export function SubtitleEditor() {
  const navigate = useNavigate();
  const studio = useStudio();
  const { user } = useAuth();
  const playerRef = useRef<AudioPlayerHandle>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [showGrid, setShowGrid] = useState(false);
  const [undoStack, setUndoStack] = useState<Snapshot[]>([]);
  const [redoStack, setRedoStack] = useState<Snapshot[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{ id: string; startX: number; startY: number; origX: number | null; origY: number | null } | null>(null);

  const { cues, subtitleStyle: style } = studio;

  // Load Google Fonts for the 20+ subtitle fonts.
  useEffect(() => {
    const id = "sw-subtitle-fonts";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = GOOGLE_FONTS_LINK;
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    if (studio.audioBuffer && cues.length === 0 && studio.wordTimings.length > 0) {
      studio.setCues(cuesFromTimings(studio.wordTimings));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const duration = studio.audioBuffer?.duration ?? studio.lastDuration;

  const activeCue = useMemo(() => {
    if (duration <= 0) return cues[0] ?? null;
    return cues.find((c) => currentTime >= c.start && currentTime < c.end) ?? null;
  }, [cues, currentTime, duration]);

  const snapshot = useCallback((): Snapshot => ({ cues: JSON.parse(JSON.stringify(cues)), style: { ...style } }), [cues, style]);

  const commit = useCallback(
    (next: Partial<{ cues: SubtitleCue[]; style: SubtitleStyle }>) => {
      setUndoStack((u) => [...u, snapshot()].slice(-50));
      setRedoStack([]);
      if (next.cues) studio.setCues(next.cues);
      if (next.style) studio.setStyle(next.style);
    },
    [snapshot, studio],
  );

  const undo = () => {
    const prev = undoStack[undoStack.length - 1];
    if (!prev) return;
    setUndoStack((u) => u.slice(0, -1));
    setRedoStack((r) => [...r, snapshot()]);
    studio.setCues(prev.cues);
    studio.setStyle(prev.style);
  };

  const redo = () => {
    const next = redoStack[redoStack.length - 1];
    if (!next) return;
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((u) => [...u, snapshot()]);
    studio.setCues(next.cues);
    studio.setStyle(next.style);
  };

  const updateCue = (id: string, patch: Partial<SubtitleCue>) => {
    const next = cues.map((c) => (c.id === id ? { ...c, ...patch } : c));
    commit({ cues: next });
  };

  const addCue = () => {
    const start = activeCue ? activeCue.end : 0;
    const cue: SubtitleCue = { id: `cue-${Date.now()}`, start, end: start + 2, text: "New subtitle" };
    commit({ cues: [...cues, cue] });
  };

  const removeCue = (id: string) => commit({ cues: cues.filter((c) => c.id !== id) });

  const setStyle = (patch: Partial<SubtitleStyle>) => commit({ style: { ...style, ...patch } });

  const applyPreset = (id: string) => {
    const preset = SUBTITLE_PRESETS.find((p) => p.id === id);
    if (preset) commit({ style: { ...preset.style } });
  };

  const autoGenerate = () => {
    if (!studio.audioBuffer && !studio.text) {
      toast.warning("No content", "Generate audio or enter text first.");
      return;
    }
    const timings =
      studio.wordTimings.length > 0
        ? studio.wordTimings
        : estimateWordTimings(studio.text || "Enter subtitle text here", duration || 5);
    const next = cuesFromTimings(timings);
    commit({ cues: next });
    toast.success("Subtitles generated", `${next.length} cues created.`);
  };

  const save = async () => {
    if (cues.length === 0) {
      toast.warning("Nothing to save", "Add or auto-generate at least one subtitle segment first.");
      return;
    }
    setSaving(true);
    try {
      // Persists cues + styling (IndexedDB for Free, cloud for Pro/Enterprise)
      // so the project survives a reload instead of only living in memory.
      const meta = buildProjectMeta({
        id: savedProjectId ?? undefined,
        title: studio.projectName,
        type: "SUBTITLE",
        text: studio.text,
        voiceId: studio.voiceId,
        voiceSettings: studio.voiceSettings,
        duration: studio.audioBuffer?.duration ?? studio.lastDuration ?? null,
        cues,
        subtitleStyle: style,
        videoFileKey: studio.video.fileKey,
      });
      const result = await persistProject(meta, user?.plan);
      setSavedProjectId(meta.id);
      toast.success("Project saved", result.label);
    } catch (e) {
      toast.error("Save failed", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const exportSrt = () => {
    const srt = cues
      .map((c, i) => `${i + 1}\n${toSrtTime(c.start)} --> ${toSrtTime(c.end)}\n${c.text}\n`)
      .join("\n");
    downloadBlob(new Blob([srt], { type: "text/plain" }), `${studio.projectName}.srt`);
    toast.success("Exported", "SRT file downloaded.");
  };

  // Drag-to-position the active subtitle in the preview.
  const previewRef = useRef<HTMLDivElement>(null);
  const onSubtitleDragStart = (e: React.MouseEvent) => {
    if (!activeCue) return;
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = style.customX ?? 50;
    const origY = style.customY ?? 50;
    setDragState({ id: activeCue.id, startX, startY, origX, origY });
  };

  useEffect(() => {
    if (!dragState) return;
    const onMove = (e: MouseEvent) => {
      const rect = previewRef.current?.getBoundingClientRect();
      if (!rect || dragState.origX == null || dragState.origY == null) return;
      const dxPct = ((e.clientX - dragState.startX) / rect.width) * 100;
      const dyPct = ((e.clientY - dragState.startY) / rect.height) * 100;
      const cx = Math.round(Math.max(0, Math.min(100, dragState.origX + dxPct)));
      const cy = Math.round(Math.max(0, Math.min(100, dragState.origY + dyPct)));
      studio.setStyle({ customX: cx, customY: cy });
    };
    const onUp = () => setDragState(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragState, studio]);

  const styleCss = subtitleStyleToCss(style);
  const pos = subtitlePosition(style);

  return (
    <div className="mx-auto max-w-7xl">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface px-4 py-3">
        <input
          value={studio.projectName}
          onChange={(e) => studio.setProjectName(e.target.value)}
          className="min-w-0 max-w-[200px] flex-1 rounded-input border border-transparent bg-transparent px-2 py-1 text-lg font-semibold text-fg-strong transition-colors hover:border-border-strong focus:border-primary"
          aria-label="Project name"
        />
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <ToolbarBtn onClick={undo} disabled={undoStack.length === 0} label="Undo"><Undo2 className="h-4 w-4" /></ToolbarBtn>
          <ToolbarBtn onClick={redo} disabled={redoStack.length === 0} label="Redo"><Redo2 className="h-4 w-4" /></ToolbarBtn>
          <Button size="sm" variant="outline" onClick={save} loading={saving} icon={<Save className="h-4 w-4" />}>Save</Button>
          <Button size="sm" variant="subtle" onClick={exportSrt} icon={<Upload className="h-4 w-4" />}>
            SRT
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (cues.length === 0) {
                toast.warning("No subtitles yet", "Add or auto-generate segments before continuing.");
                return;
              }
              navigate("/studio/video");
            }}
            icon={<Clapperboard className="h-4 w-4" />}
          >
            Continue to video
          </Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        {/* Center: preview + cue list */}
        <div className="min-w-0 space-y-5">
          <div className="rounded-card border border-border bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-fg-muted">Preview <span className="text-fg-subtle">(16:9)</span></p>
              <button
                onClick={() => setShowGrid((g) => !g)}
                aria-pressed={showGrid}
                className={cn("flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors", showGrid ? "bg-primary/20 text-primary" : "text-fg-muted hover:text-fg-strong")}
              >
                <Grid3X3 className="h-4 w-4" /> Grid
              </button>
            </div>
            <div
              ref={previewRef}
              className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-card bg-black"
              style={{ aspectRatio: "16 / 9" }}
            >
              {showGrid && (
                <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                  <div className="absolute left-1/2 top-0 h-full w-px bg-white/10" />
                  <div className="absolute left-0 top-1/2 h-px w-full bg-white/10" />
                  <div className="absolute left-1/3 top-0 h-full w-px bg-white/5" />
                  <div className="absolute left-2/3 top-0 h-full w-px bg-white/5" />
                  <div className="absolute left-0 top-1/3 h-px w-full bg-white/5" />
                  <div className="absolute left-0 top-2/3 h-px w-full bg-white/5" />
                </div>
              )}

              {activeCue ? (
                <motion.div
                  key={activeCue.id}
                  className="absolute z-10 cursor-move select-none"
                  style={{ ...pos, ...(dragState ? { opacity: 0.9 } : {}) }}
                  onMouseDown={onSubtitleDragStart}
                  initial={entranceFor(style.animIn)}
                  animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                  transition={{ duration: style.animDuration / 1000 }}
                >
                  <div style={styleCss}>
                    {style.animIn === "wordByWord" ? (
                      activeCue.text.split(" ").map((w, i) => (
                        <motion.span
                          key={i}
                          initial={{ opacity: 0.25, color: "#FFFFFF" }}
                          animate={{ opacity: 1, color: "#FDE047" }}
                          transition={{ delay: (i * style.animDuration) / 1000 / activeCue.text.split(" ").length }}
                          className="inline-block whitespace-pre-wrap"
                        >
                          {w}&nbsp;
                        </motion.span>
                      ))
                    ) : (
                      <span className="whitespace-pre-wrap">{activeCue.text}</span>
                    )}
                  </div>
                </motion.div>
              ) : (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-fg-subtle">
                  {cues.length === 0 ? "No subtitle shown — add a cue below" : "No cue at this time"}
                </div>
              )}
            </div>

            <div className="mt-4">
              <AudioPlayer ref={playerRef} audioBuffer={studio.audioBuffer} onTimeUpdate={setCurrentTime} />
              {!studio.audioBuffer && (
                <p className="mt-2 text-sm text-fg-subtle">
                  No audio loaded. <button onClick={() => navigate("/studio")} className="sw-link">Generate audio first</button>.
                </p>
              )}
            </div>
          </div>

          {/* Cue list */}
          <div className="rounded-card border border-border bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-fg-muted">Subtitle Segments</p>
              <div className="flex gap-2">
                <Button size="sm" variant="subtle" onClick={autoGenerate}>Auto-generate</Button>
                <Button size="sm" variant="subtle" onClick={addCue} icon={<Plus className="h-4 w-4" />}>Add</Button>
              </div>
            </div>
            {cues.length === 0 ? (
              <p className="py-6 text-center text-sm text-fg-subtle">No segments yet. Auto-generate from your audio, or add one manually.</p>
            ) : (
              <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {cues.map((c) => {
                  const active = activeCue?.id === c.id;
                  return (
                    <li
                      key={c.id}
                      className={cn(
                        "rounded-card border p-3 transition-colors",
                        active ? "border-primary/60 bg-primary/5" : "border-border hover:border-border-strong",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => playerRef.current?.seek(c.start)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-fg-muted transition-colors hover:bg-primary/20 hover:text-primary"
                          aria-label={`Play from ${round2(c.start)}s`}
                          title="Play from this cue"
                        >
                          <PlayIcon className="h-3.5 w-3.5" />
                        </button>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={round2(c.start)}
                          onChange={(e) => updateCue(c.id, { start: parseFloat(e.target.value) || 0 })}
                          className="w-20 rounded-input border border-border-strong bg-surface-inset px-2 py-1 font-mono text-sm text-fg-strong"
                          aria-label="Start time"
                        />
                        <ArrowDown className="h-3.5 w-3.5 rotate-90 text-fg-subtle" />
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={round2(c.end)}
                          onChange={(e) => updateCue(c.id, { end: parseFloat(e.target.value) || 0 })}
                          className="w-20 rounded-input border border-border-strong bg-surface-inset px-2 py-1 font-mono text-sm text-fg-strong"
                          aria-label="End time"
                        />
                        <span className="font-mono text-xs text-fg-subtle">sec</span>
                        <button onClick={() => removeCue(c.id)} aria-label="Delete segment" className="ml-auto rounded p-1 text-fg-subtle hover:text-danger">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <input
                        value={c.text}
                        onChange={(e) => updateCue(c.id, { text: e.target.value })}
                        className="mt-2 w-full min-w-0 rounded-input border border-border-strong bg-surface-inset px-3 py-2 text-sm text-fg-strong [overflow-wrap:break-word] focus:border-primary"
                        aria-label="Subtitle text"
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Right: styling panel */}
        <div className="min-w-0 space-y-5">
          <div className="rounded-card border border-border bg-surface p-5">
            <p className="mb-3 text-sm font-medium text-fg-muted">Preset Styles</p>
            <Select
              value=""
              placeholder="Apply a preset…"
              onChange={applyPreset}
              options={SUBTITLE_PRESETS.map((p) => ({ value: p.id, label: p.name }))}
            />
          </div>

          <StyleGroup title="Font">
            <Select
              value={style.fontFamily}
              onChange={(v) => setStyle({ fontFamily: v })}
              options={FONT_OPTIONS.map((f) => ({ value: f.value, label: f.label }))}
              ariaLabel="Font family"
            />
            <Slider label="Font size" value={style.fontSize} onChange={(v) => setStyle({ fontSize: v })} min={12} max={120} format={(v) => `${v}px`} />
            <Select
              value={String(style.fontWeight)}
              onChange={(v) => setStyle({ fontWeight: parseInt(v, 10) })}
              options={[
                { value: "100", label: "Thin (100)" }, { value: "300", label: "Light (300)" },
                { value: "400", label: "Regular (400)" }, { value: "500", label: "Medium (500)" },
                { value: "600", label: "Semi-Bold (600)" }, { value: "700", label: "Bold (700)" },
                { value: "800", label: "Extra-Bold (800)" }, { value: "900", label: "Black (900)" },
              ]}
              ariaLabel="Font weight"
            />
            <Slider label="Letter spacing" value={style.letterSpacing} onChange={(v) => setStyle({ letterSpacing: v })} min={-5} max={20} format={(v) => `${v}px`} />
            <Slider label="Line height" value={style.lineHeight} onChange={(v) => setStyle({ lineHeight: v })} min={0.8} max={3} step={0.1} format={(v) => v.toFixed(1)} />
          </StyleGroup>

          <StyleGroup title="Color">
            <ColorPicker label="Text color" value={style.color} onChange={(v) => setStyle({ color: v })} />
            <Slider label="Text opacity" value={style.textOpacity} onChange={(v) => setStyle({ textOpacity: v })} min={0} max={100} format={(v) => `${v}%`} />
            <ColorPicker label="Background" value={style.bgColor} onChange={(v) => setStyle({ bgColor: v })} />
            <Slider label="Background opacity" value={style.bgOpacity} onChange={(v) => setStyle({ bgOpacity: v })} min={0} max={100} format={(v) => `${v}%`} />
            <Slider label="Background padding" value={style.bgPadding} onChange={(v) => setStyle({ bgPadding: v })} min={0} max={40} format={(v) => `${v}px`} />
            <Slider label="Background radius" value={style.bgRadius} onChange={(v) => setStyle({ bgRadius: v })} min={0} max={20} format={(v) => `${v}px`} />
          </StyleGroup>

          <StyleGroup title="Outline / Stroke">
            <div className="flex items-center justify-between">
              <span className="text-sm text-fg-muted">Enable outline</span>
              <Toggle checked={style.strokeEnabled} onChange={(v) => setStyle({ strokeEnabled: v })} label="Enable outline" />
            </div>
            {style.strokeEnabled && (
              <>
                <ColorPicker label="Stroke color" value={style.strokeColor} onChange={(v) => setStyle({ strokeColor: v })} />
                <Slider label="Stroke width" value={style.strokeWidth} onChange={(v) => setStyle({ strokeWidth: v })} min={0} max={10} format={(v) => `${v}px`} />
              </>
            )}
          </StyleGroup>

          <StyleGroup title="Shadow">
            <div className="flex items-center justify-between">
              <span className="text-sm text-fg-muted">Enable shadow</span>
              <Toggle checked={style.shadowEnabled} onChange={(v) => setStyle({ shadowEnabled: v })} label="Enable shadow" />
            </div>
            {style.shadowEnabled && (
              <>
                <ColorPicker label="Shadow color" value={style.shadowColor} onChange={(v) => setStyle({ shadowColor: v })} />
                <Slider label="Shadow blur" value={style.shadowBlur} onChange={(v) => setStyle({ shadowBlur: v })} min={0} max={20} format={(v) => `${v}px`} />
                <Slider label="Shadow offset X" value={style.shadowX} onChange={(v) => setStyle({ shadowX: v })} min={-20} max={20} format={(v) => `${v}px`} />
                <Slider label="Shadow offset Y" value={style.shadowY} onChange={(v) => setStyle({ shadowY: v })} min={-20} max={20} format={(v) => `${v}px`} />
              </>
            )}
          </StyleGroup>

          <StyleGroup title="Position">
            <div className="grid grid-cols-2 gap-3">
              <Select
                value={style.hAlign}
                onChange={(v) => setStyle({ hAlign: v as SubtitleStyle["hAlign"] })}
                options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]}
                ariaLabel="Horizontal alignment"
              />
              <Select
                value={style.vAlign}
                onChange={(v) => setStyle({ vAlign: v as SubtitleStyle["vAlign"] })}
                options={[{ value: "top", label: "Top" }, { value: "middle", label: "Middle" }, { value: "bottom", label: "Bottom" }]}
                ariaLabel="Vertical alignment"
              />
            </div>
            <Slider label="Margin from edges" value={style.margin} onChange={(v) => setStyle({ margin: v })} min={0} max={100} format={(v) => `${v}px`} />
            <p className="text-xs text-fg-subtle">Tip: drag the subtitle in the preview to set a custom position.</p>
          </StyleGroup>

          <StyleGroup title="Animation">
            <Select
              value={style.animIn}
              onChange={(v) => setStyle({ animIn: v as SubtitleStyle["animIn"] })}
              options={[
                { value: "none", label: "None" }, { value: "fade", label: "Fade In" },
                { value: "slideUp", label: "Slide Up" }, { value: "slideDown", label: "Slide Down" },
                { value: "slideLeft", label: "Slide Left" }, { value: "slideRight", label: "Slide Right" },
                { value: "scale", label: "Scale In" }, { value: "typewriter", label: "Typewriter" },
                { value: "wordByWord", label: "Word-by-Word" },
              ]}
              ariaLabel="Entrance animation"
            />
            <Select
              value={style.animOut}
              onChange={(v) => setStyle({ animOut: v as SubtitleStyle["animOut"] })}
              options={[
                { value: "none", label: "None" }, { value: "fade", label: "Fade Out" },
                { value: "slideUp", label: "Slide Up" }, { value: "slideDown", label: "Slide Down" },
                { value: "scale", label: "Scale Out" },
              ]}
              ariaLabel="Exit animation"
            />
            <Slider label="Animation duration" value={style.animDuration} onChange={(v) => setStyle({ animDuration: v })} min={100} max={2000} step={50} format={(v) => `${v}ms`} />
          </StyleGroup>

          <div className="rounded-card border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-fg-muted">Reset</p>
              <Badge tone="gray">{cues.length} cues</Badge>
            </div>
            <Button
              variant="outline"
              fullWidth
              className="mt-3"
              onClick={() => commit({ style: { ...DEFAULT_SUBTITLE_STYLE, customX: null, customY: null } })}
            >
              Reset to default style
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StyleGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <p className="mb-4 text-sm font-semibold text-fg-strong">{title}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function ToolbarBtn({ onClick, disabled, label, children }: { onClick: () => void; disabled?: boolean; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg-strong disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function entranceFor(anim: SubtitleStyle["animIn"]) {
  switch (anim) {
    case "slideUp": return { opacity: 0, y: 40 };
    case "slideDown": return { opacity: 0, y: -40 };
    case "slideLeft": return { opacity: 0, x: 60 };
    case "slideRight": return { opacity: 0, x: -60 };
    case "scale": return { opacity: 0, scale: 0.6 };
    case "fade": return { opacity: 0 };
    case "wordByWord": return { opacity: 1 };
    default: return { opacity: 1 };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}
