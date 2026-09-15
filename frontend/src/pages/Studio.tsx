import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Captions,
  Download,
  Film,
  Gauge,
  Mic,
  Pause,
  RefreshCw,
  Save,
  Wand2,
  WifiOff,
  X,
} from "lucide-react";
import { useTTS, type TTSResult } from "../hooks/useTTS";
import { useStudio } from "../store/studio";
import { useAuth } from "../store/auth";
import { toast } from "../store/toast";
import { http } from "../lib/api";
import { cn } from "../lib/cn";
import { formatDuration, formatNumber, truncate } from "../lib/format";
import { DEFAULT_VOICES, displayNameFor } from "../lib/voices";
import { encodeAudio, downloadBlob, cuesFromTimings } from "../lib/audio";
import { AudioPlayer, type AudioPlayerHandle } from "../components/AudioPlayer";
import { VoicePicker } from "../components/VoicePicker";
import { Button } from "../components/ui/Button";
import { Slider } from "../components/ui/Slider";
import { ProgressBar } from "../components/ui/ProgressBar";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { Tooltip } from "../components/ui/Tooltip";
import { saveLocalProject } from "../lib/localProjects";
import type { ProjectMeta } from "../lib/types";

const BREAK_TAG = '<break time="500ms"/>';

export function Studio() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { quota, refreshQuota, user } = useAuth();
  const studio = useStudio();
  const playerRef = useRef<AudioPlayerHandle>(null);
  const [format, setFormat] = useState<"mp3" | "wav" | "ogg">("mp3");
  const [encoding, setEncoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [online] = useState(() => navigator.onLine);

  const onComplete = useCallback(
    (r: TTSResult) => {
      studio.setResult({
        audioBuffer: r.audioBuffer,
        audioBlob: r.audioBlob,
        text: r.text,
        voiceId: r.voiceId,
        voiceSettings: studio.voiceSettings,
        wordTimings: r.wordTimings,
        duration: r.duration,
      });
      studio.addHistory({
        id: `h-${Date.now()}`,
        text: r.text,
        voiceId: r.voiceId,
        createdAt: Date.now(),
        duration: r.duration,
      });
      // Usage is accounted server-side by /tts/synthesize — just refresh quota.
      refreshQuota();
      toast.success("Audio ready", `Generated ${formatDuration(r.duration)} with ${displayNameFor(r.voiceId)}.`);
    },
    [refreshQuota, studio],
  );

  const tts = useTTS(onComplete);

  useEffect(() => {
    const preset = params.get("voice");
    if (preset && DEFAULT_VOICES.some((v) => v.id === preset)) studio.setVoiceId(preset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-play on completion.
  const prevStatus = useRef(tts.status);
  useEffect(() => {
    if (tts.status === "done" && prevStatus.current !== "done") {
      setTimeout(() => playerRef.current?.play(), 150);
    }
    prevStatus.current = tts.status;
  }, [tts.status]);

  const voices = DEFAULT_VOICES;

  const remaining = quota ? Math.max(0, quota.limit - quota.used) : null;
  const hardLimit = remaining ?? 10000;
  const limitReached = remaining !== null && remaining <= 0;
  const charCount = studio.text.length;
  const countRatio = hardLimit > 0 ? charCount / hardLimit : 0;
  const countTone = charCount >= hardLimit ? "text-danger" : countRatio > 0.95 ? "text-danger" : countRatio > 0.8 ? "text-warning" : countRatio > 0.5 ? "text-warning" : "text-success";

  const canGenerate = studio.text.trim().length > 0 && !limitReached && tts.status !== "generating";
  const generating = tts.status === "generating";

  const generateLabel = generating ? "Generating… ⚡" : "Generate Speech";

  const handleGenerate = () => {
    if (studio.text.trim().length === 0) return;
    if (limitReached) {
      toast.warning("Monthly limit reached", "Upgrade to Pro for more characters.");
      return;
    }
    tts.generate(studio.text, studio.voiceId, studio.voiceSettings);
  };

  const insertTag = (tag: string) => {
    const ta = document.getElementById("studio-text") as HTMLTextAreaElement | null;
    if (!ta) return;
    const start = ta.selectionStart ?? studio.text.length;
    const end = ta.selectionEnd ?? studio.text.length;
    const next = studio.text.slice(0, start) + tag + studio.text.slice(end);
    studio.setText(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + tag.length, start + tag.length);
    });
  };

  const download = async () => {
    if (!tts.audioBuffer) return;
    setEncoding(true);
    try {
      const blob = await encodeAudio(tts.audioBuffer, format, 128);
      downloadBlob(blob, `soundwave-${studio.voiceId}-${Date.now()}.${format}`);
    } catch {
      toast.error("Encoding failed", "Could not encode the audio. Try a different format.");
    } finally {
      setEncoding(false);
    }
  };

  const saveProject = async () => {
    if (!tts.audioBuffer) return;
    setSaving(true);
    try {
      const meta: ProjectMeta = {
        id: crypto.randomUUID(),
        title: studio.projectName,
        type: "TTS",
        textContent: studio.text,
        voiceId: studio.voiceId,
        voiceSettings: studio.voiceSettings,
        characterCount: studio.text.length,
        duration: tts.audioBuffer.duration,
        status: "DRAFT",
        storageType: user?.plan === "FREE" ? "LOCAL" : "CLOUD",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        audioUrl: null,
      };
      if (user?.plan === "FREE") {
        await saveLocalProject(meta);
        toast.success("Saved locally", "This project is stored in your browser (Local Only).");
      } else {
        await http.post("/projects", { ...meta, storageType: undefined });
        toast.success("Project saved", "Saved to your cloud projects.");
      }
    } catch (e) {
      toast.error("Save failed", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const goSubtitles = () => {
    if (!tts.audioBuffer) {
      toast.warning("No audio yet", "Generate audio first, then add subtitles.");
      return;
    }
    if (studio.wordTimings.length > 0) studio.setCues(cuesFromTimings(studio.wordTimings));
    navigate("/studio/subtitles");
  };

  const goVideo = () => {
    if (!tts.audioBuffer) {
      toast.warning("No audio yet", "Generate audio first, then create a video.");
      return;
    }
    navigate("/studio/video");
  };

  return (
    <div className="mx-auto max-w-7xl">
      {/* Offline banner */}
      {!online && (
        <div className="mb-4 flex items-center gap-3 rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          <WifiOff className="h-5 w-5 shrink-0" />
          <span className="min-w-0">
            You appear to be offline. TTS will fall back to the built-in demo voice, and project saving and video export require a connection.
          </span>
        </div>
      )}

      {/* Error banner */}
      {tts.status === "error" && tts.error && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <span className="min-w-0 flex-1">{tts.error}</span>
        </div>
      )}

      {/* Demo-voice fallback banner */}
      {tts.engine === "offline" && tts.status === "done" && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          <Mic className="h-5 w-5 shrink-0 text-warning" />
          <span className="min-w-0 flex-1">
            The Microsoft Neural voice service wasn't reachable, so this clip used the built-in demo voice. Check your connection and regenerate.
          </span>
        </div>
      )}

      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-fg">Text-to-Speech Studio</h1>
          <p className="text-sm text-muted">Generate professional voice audio with Microsoft Neural voices.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="green" dot>Microsoft Neural</Badge>
          {tts.engine === "offline" && <Badge tone="amber">Demo fallback</Badge>}
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* ── LEFT: input & controls ───────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-5">
          <div className="rounded-card border border-line bg-surface p-5">
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="studio-text" className="text-sm font-medium text-fg-soft">Text</label>
              <span className={cn("font-mono text-sm tabular-nums", countTone)}>
                {formatNumber(charCount)} / {formatNumber(hardLimit)} characters
              </span>
            </div>
            <textarea
              id="studio-text"
              value={studio.text}
              onChange={(e) => {
                if (e.target.value.length <= hardLimit) studio.setText(e.target.value);
              }}
              placeholder="Enter the text you want to convert to speech..."
              rows={7}
              className="w-full resize-y overflow-y-auto rounded-input border border-line-strong bg-sunken px-3.5 py-3 text-base text-fg placeholder-faint [overflow-wrap:break-word] transition-colors focus:border-accent"
            />
            {limitReached && (
              <p className="mt-2 text-sm text-danger">Monthly character limit reached. Upgrade to Pro for more.</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Tooltip content="Insert a pause at the cursor">
                <button onClick={() => insertTag(BREAK_TAG)} className="flex h-8 items-center gap-1.5 rounded border border-line-strong px-2.5 text-xs text-fg-soft transition-colors hover:border-line-emphasis hover:text-fg">
                  <Pause className="h-3.5 w-3.5" /> Add pause
                </button>
              </Tooltip>
              <Tooltip content="Insert emphasis markers">
                <button onClick={() => insertTag(" *emphasized* ")} className="flex h-8 items-center gap-1.5 rounded border border-line-strong px-2.5 text-xs text-fg-soft transition-colors hover:border-line-emphasis hover:text-fg">
                  <Wand2 className="h-3.5 w-3.5" /> Emphasis
                </button>
              </Tooltip>
              <Tooltip content="Insert a pronunciation guide">
                <button onClick={() => insertTag(' {pronounce:"example|ig-zam-pul"} ')} className="flex h-8 items-center gap-1.5 rounded border border-line-strong px-2.5 text-xs text-fg-soft transition-colors hover:border-line-emphasis hover:text-fg">
                  <Gauge className="h-3.5 w-3.5" /> Pronunciation
                </button>
              </Tooltip>
            </div>
          </div>

          {/* Voice */}
          <div className="rounded-card border border-line bg-surface p-5">
            <p className="mb-2 text-sm font-medium text-fg-soft">Voice</p>
            <VoicePicker voices={voices} value={studio.voiceId} onChange={studio.setVoiceId} />
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">Selected:</span>
              <span className="font-semibold text-fg">{displayNameFor(studio.voiceId)}</span>
              <Badge tone={studio.voiceId.includes("-GB-") ? "violet" : "blue"}>{studio.voiceId.includes("-GB-") ? "British" : "American"}</Badge>
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-5 rounded-card border border-line bg-surface p-5">
            <p className="text-sm font-medium text-fg-soft">Voice Settings</p>
            <Slider
              label="Speed"
              value={studio.voiceSettings.speed}
              onChange={(v) => studio.setVoiceSettings({ speed: v })}
              min={0.5} max={2} step={0.1}
              format={(v) => `${v.toFixed(1)}x`}
            />
            <Slider
              label="Pitch"
              value={studio.voiceSettings.pitch}
              onChange={(v) => studio.setVoiceSettings({ pitch: v })}
              min={-50} max={50} step={1}
              format={(v) => `${v > 0 ? "+" : ""}${v}%`}
            />
            <Slider
              label="Volume"
              value={studio.voiceSettings.volume}
              onChange={(v) => studio.setVoiceSettings({ volume: v })}
              min={0} max={100} step={1}
              format={(v) => `${v}%`}
            />
          </div>

          {/* Generate */}
          <div className="rounded-card border border-line bg-surface p-5">
            <div className="flex gap-3">
              <Button
                size="lg"
                fullWidth
                onClick={handleGenerate}
                disabled={!canGenerate}
                loading={generating}
                icon={!generating ? <Mic className="h-5 w-5" /> : undefined}
              >
                {generateLabel}
              </Button>
              {generating && (
                <Tooltip content="Cancel generation">
                  <button
                    onClick={tts.cancel}
                    aria-label="Cancel generation"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-btn border border-danger/50 text-danger transition-colors hover:bg-danger/10"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </Tooltip>
              )}
            </div>
            {generating && (
              <div className="mt-3">
                <ProgressBar indeterminate tone="default" label="Generating audio" />
                <p className="mt-2 text-center text-xs text-faint">
                  Generating with Microsoft Neural voice…
                </p>
              </div>
            )}
            {tts.status === "error" && (
              <p className="mt-3 text-sm text-danger">Speech generation failed — try a shorter text or a different voice.</p>
            )}
            <p className="mt-3 text-xs text-faint">
              🔒 Audio is generated securely on our servers with Microsoft Neural voices. Your text is used only to synthesize the audio and is not stored.
            </p>
          </div>
        </div>

        {/* ── RIGHT: preview & output ──────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-5">
          <div className="rounded-card border border-line bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-fg-soft">Preview & Output</p>
              {tts.status === "done" && <Badge tone="green" dot>Ready</Badge>}
            </div>
            <AudioPlayer ref={playerRef} audioBuffer={tts.audioBuffer} onDownload={() => setDownloadModalOpen(true)} />

            {tts.audioBuffer && (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <QuickAction icon={<Download className="h-4 w-4" />} label="Download" onClick={() => setDownloadModalOpen(true)} />
                <QuickAction icon={<Captions className="h-4 w-4" />} label="Add Subtitles" onClick={goSubtitles} />
                <QuickAction icon={<Film className="h-4 w-4" />} label="Create Video" onClick={goVideo} />
                <QuickAction icon={<Save className="h-4 w-4" />} label="Save Project" onClick={saveProject} loading={saving} />
              </div>
            )}

            {tts.status === "done" && (
              <button
                onClick={handleGenerate}
                className="mt-4 flex items-center gap-2 text-sm text-accent transition-colors hover:text-accent-strong"
              >
                <RefreshCw className="h-4 w-4" /> Regenerate
              </button>
            )}
          </div>

          {/* Word timings */}
          {studio.wordTimings.length > 0 && (
            <div className="rounded-card border border-line bg-surface p-5">
              <p className="mb-3 text-sm font-medium text-fg-soft">Word Timing Data</p>
              <p className="text-xs text-faint">
                {studio.wordTimings.length} words aligned — used to auto-populate the subtitle editor.
              </p>
              <div className="mt-3 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {studio.wordTimings.slice(0, 120).map((w, i) => (
                  <span key={i} className="rounded bg-tint px-2 py-0.5 text-xs text-fg-soft" title={`${w.start.toFixed(2)}s – ${w.end.toFixed(2)}s`}>
                    {w.word}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* History */}
          <div className="rounded-card border border-line bg-surface p-5">
            <p className="mb-3 text-sm font-medium text-fg-soft">This Session</p>
            {studio.history.length === 0 ? (
              <p className="text-sm text-faint">Generations you make will appear here.</p>
            ) : (
              <ul className="divide-y divide-line">
                {studio.history.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 py-2.5">
                    <button
                      onClick={() => {
                        studio.setVoiceId(h.voiceId);
                        studio.setText(h.text);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-sm text-fg">{truncate(h.text, 60)}</span>
                      <span className="block text-xs text-faint">
                        {displayNameFor(h.voiceId)} · {formatDuration(h.duration)} · {new Date(h.createdAt).toLocaleTimeString()}
                      </span>
                    </button>
                    <button
                      onClick={() => studio.removeHistory(h.id)}
                      aria-label="Remove from history"
                      className="rounded p-1 text-faint hover:text-danger"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Download modal */}
      <Modal
        open={downloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
        title="Download audio"
        description="All encoding happens in your browser — nothing is uploaded."
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            {(["mp3", "wav", "ogg"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                aria-pressed={format === f}
                className={cn(
                  "rounded-card border py-4 text-center transition-all",
                  format === f ? "border-accent bg-accent/10" : "border-line-strong hover:border-line-emphasis",
                )}
              >
                <span className="block text-lg font-semibold uppercase text-fg">{f}</span>
                <span className="block text-xs text-faint">{f === "mp3" ? "Compressed" : f === "wav" ? "Lossless" : "Efficient"}</span>
              </button>
            ))}
          </div>
          <Button fullWidth onClick={() => { void download(); setDownloadModalOpen(false); }} loading={encoding}>
            Download {format.toUpperCase()}
          </Button>
        </div>
      </Modal>

    </div>
  );
}

function QuickAction({ icon, label, onClick, loading }: { icon: React.ReactNode; label: string; onClick: () => void; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex min-w-0 flex-col items-center gap-1.5 rounded-card border border-line-strong px-2 py-3 text-center transition-all duration-200 hover:border-accent/60 disabled:opacity-50"
    >
      <span className="text-accent">{icon}</span>
      <span className="w-full truncate text-xs font-medium text-fg-soft">{label}</span>
    </button>
  );
}
