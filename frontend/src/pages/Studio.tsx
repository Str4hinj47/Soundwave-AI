import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Captions,
  Download,
  Film,
  FolderOpen,
  Gauge,
  Mic,
  Pause,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  Wand2,
  WifiOff,
  X,
} from "lucide-react";
import { useTTS, isCloneVoiceId, type TTSResult } from "../hooks/useTTS";
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
import { Select } from "../components/ui/Select";
import { TextField } from "../components/ui/TextField";
import { Slider } from "../components/ui/Slider";
import { ProgressBar } from "../components/ui/ProgressBar";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { Tooltip } from "../components/ui/Tooltip";
import { saveLocalProject } from "../lib/localProjects";
import type { ProjectMeta } from "../lib/types";

const BREAK_TAG = '<break time="500ms"/>';

interface CloneProfile {
  id: string;
  name: string;
  createdAt: string;
  hasRefText?: boolean;
}

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

  // ── Voice cloning (OmniVoice sidecar) ────────────────────────────────────
  const [voiceTab, setVoiceTab] = useState<"neural" | "clone">(() => (isCloneVoiceId(studio.voiceId) ? "clone" : "neural"));
  const [cloneConfigured, setCloneConfigured] = useState(false);
  const [cloneAvailable, setCloneAvailable] = useState(false);
  const [cloneProfiles, setCloneProfiles] = useState<CloneProfile[]>([]);
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [cloneName, setCloneName] = useState("");
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const [cloneRefText, setCloneRefText] = useState("");
  const [cloneConsent, setCloneConsent] = useState(false);
  const [cloneSaving, setCloneSaving] = useState(false);

  const nameFor = useCallback(
    (id: string) =>
      isCloneVoiceId(id)
        ? cloneProfiles.find((p) => `clone:${p.id}` === id)?.name ?? "Cloned voice"
        : displayNameFor(id),
    [cloneProfiles],
  );

  const refreshCloneProfiles = useCallback(async () => {
    try {
      const r = await http.get<{ profiles: CloneProfile[] }>("/tts/clone/profiles");
      setCloneProfiles(r.profiles);
    } catch {
      // Status banner still reflects availability; avoid noisy errors here.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await http.get<{ configured: boolean; available: boolean }>("/tts/clone/status");
        if (cancelled) return;
        setCloneConfigured(s.configured);
        setCloneAvailable(s.available);
        if (s.available) void refreshCloneProfiles();
      } catch {
        // Not configured (or request failed) → keep the feature hidden.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshCloneProfiles]);

  const submitClone = async () => {
    if (!cloneFile || !cloneName.trim() || cloneSaving) return;
    setCloneSaving(true);
    try {
      const fd = new FormData();
      fd.append("file", cloneFile);
      fd.append("name", cloneName.trim());
      if (cloneRefText.trim()) fd.append("refText", cloneRefText.trim());
      fd.append("consent", String(cloneConsent));
      const r = await http.upload<{ profile: CloneProfile }>("/tts/clone/profiles", fd, { timeout: 300_000 });
      await refreshCloneProfiles();
      studio.setVoiceId(`clone:${r.profile.id}`);
      setCloneModalOpen(false);
      setCloneName("");
      setCloneFile(null);
      setCloneRefText("");
      setCloneConsent(false);
      toast.success("Voice cloned", `"${r.profile.name}" is ready — generate away.`);
    } catch (e) {
      toast.error("Cloning failed", (e as Error).message);
    } finally {
      setCloneSaving(false);
    }
  };

  const removeCloneProfile = async (id: string) => {
    try {
      await http.del(`/tts/clone/profiles/${id}`);
      await refreshCloneProfiles();
      if (studio.voiceId === `clone:${id}`) studio.setVoiceId(DEFAULT_VOICES[0]?.id ?? "");
      toast.success("Voice deleted", "The cloned voice and its reference clip were removed.");
    } catch (e) {
      toast.error("Delete failed", (e as Error).message);
    }
  };

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
      // Usage is accounted server-side by /tts/synthesize (and /tts/clone) — just refresh quota.
      refreshQuota();
      toast.success("Audio ready", `Generated ${formatDuration(r.duration)} with ${nameFor(r.voiceId)}.`);
    },
    [nameFor, refreshQuota, studio],
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
  const countTone = charCount >= hardLimit ? "text-red-400" : countRatio > 0.95 ? "text-red-400" : countRatio > 0.8 ? "text-orange-400" : countRatio > 0.5 ? "text-amber-400" : "text-emerald-400";

  const canGenerate = studio.text.trim().length > 0 && !limitReached && tts.status !== "generating";
  const generating = tts.status === "generating";

  const generateLabel = generating ? "Generating… ⚡" : "Generate Speech";

  const handleGenerate = () => {
    if (studio.text.trim().length === 0) return;
    if (voiceTab === "clone" && cloneConfigured && !isCloneVoiceId(studio.voiceId)) {
      toast.warning("Pick a cloned voice", "Select one of your cloned voices, or clone a new one.");
      if (cloneAvailable) setCloneModalOpen(true);
      return;
    }
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
    if (!tts.audioBlob) return;
    // If the generated audio is already in the requested format (Edge/cloned
    // voices are MP3, the offline voice is WAV), download it as-is — faster,
    // lossless, and doesn't depend on client-side encoders.
    const byMime: Record<string, string> = {
      "audio/mpeg": "mp3",
      "audio/mp3": "mp3",
      "audio/wav": "wav",
      "audio/x-wav": "wav",
      "audio/wave": "wav",
      "audio/ogg": "ogg",
    };
    if (byMime[tts.audioBlob.type] === format) {
      downloadBlob(tts.audioBlob, `soundwave-${studio.voiceId}-${Date.now()}.${format}`);
      return;
    }
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
        <div className="mb-4 flex items-center gap-3 rounded-card border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <WifiOff className="h-5 w-5 shrink-0" />
          <span className="min-w-0">
            You appear to be offline. TTS will fall back to the built-in demo voice, and project saving and video export require a connection.
          </span>
        </div>
      )}

      {/* Error banner */}
      {tts.status === "error" && tts.error && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-card border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <span className="min-w-0 flex-1">{tts.error}</span>
        </div>
      )}

      {/* Demo-voice fallback banner */}
      {tts.engine === "offline" && tts.status === "done" && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-card border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <Mic className="h-5 w-5 shrink-0 text-amber-300" />
          <span className="min-w-0 flex-1">
            The Microsoft Neural voice service wasn't reachable, so this clip used the built-in demo voice. Check your connection and regenerate.
          </span>
        </div>
      )}

      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">Text-to-Speech Studio</h1>
          <p className="text-sm text-gray-400">Generate professional voice audio with Microsoft Neural voices.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" icon={<FolderOpen className="h-4 w-4" />} onClick={() => navigate("/projects")}>
            Saved projects
          </Button>
          <Badge tone="green" dot>Microsoft Neural</Badge>
          {tts.engine === "clone" && <Badge tone="violet">OmniVoice clone</Badge>}
          {tts.engine === "offline" && <Badge tone="amber">Demo fallback</Badge>}
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* ── LEFT: input & controls ───────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-5">
          <div className="rounded-card border border-gray-800 bg-panel p-5">
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="studio-text" className="text-sm font-medium text-gray-300">Text</label>
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
              className="w-full resize-y overflow-y-auto rounded-input border border-gray-700 bg-gray-900 px-3.5 py-3 text-base text-white placeholder-gray-500 [overflow-wrap:break-word] transition-colors focus:border-blue-500"
            />
            {limitReached && (
              <p className="mt-2 text-sm text-red-400">Monthly character limit reached. Upgrade to Pro for more.</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Tooltip content="Insert a pause at the cursor">
                <button onClick={() => insertTag(BREAK_TAG)} className="flex h-8 items-center gap-1.5 rounded border border-gray-700 px-2.5 text-xs text-gray-300 transition-colors hover:border-gray-500 hover:text-white">
                  <Pause className="h-3.5 w-3.5" /> Add pause
                </button>
              </Tooltip>
              <Tooltip content="Insert emphasis markers">
                <button onClick={() => insertTag(" *emphasized* ")} className="flex h-8 items-center gap-1.5 rounded border border-gray-700 px-2.5 text-xs text-gray-300 transition-colors hover:border-gray-500 hover:text-white">
                  <Wand2 className="h-3.5 w-3.5" /> Emphasis
                </button>
              </Tooltip>
              <Tooltip content="Insert a pronunciation guide">
                <button onClick={() => insertTag(' {pronounce:"example|ig-zam-pul"} ')} className="flex h-8 items-center gap-1.5 rounded border border-gray-700 px-2.5 text-xs text-gray-300 transition-colors hover:border-gray-500 hover:text-white">
                  <Gauge className="h-3.5 w-3.5" /> Pronunciation
                </button>
              </Tooltip>
            </div>
          </div>

          {/* Voice */}
          <div className="rounded-card border border-gray-800 bg-panel p-5">
            <p className="mb-2 text-sm font-medium text-gray-300">Voice</p>
            {cloneConfigured && (
              <div className="mb-3 grid grid-cols-2 gap-1 rounded-input border border-gray-700 bg-gray-900 p-1 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setVoiceTab("neural");
                    if (isCloneVoiceId(studio.voiceId)) studio.setVoiceId(DEFAULT_VOICES[0]?.id ?? studio.voiceId);
                  }}
                  className={cn("rounded px-2 py-1.5 font-medium transition-colors", voiceTab === "neural" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white")}
                >
                  Microsoft Neural
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVoiceTab("clone");
                    if (!isCloneVoiceId(studio.voiceId) && cloneProfiles[0]) studio.setVoiceId(`clone:${cloneProfiles[0].id}`);
                  }}
                  className={cn("rounded px-2 py-1.5 font-medium transition-colors", voiceTab === "clone" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white")}
                >
                  Cloned voices
                </button>
              </div>
            )}

            {voiceTab === "clone" && cloneConfigured ? (
              !cloneAvailable ? (
                <div className="rounded-input border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-sm leading-relaxed text-amber-200">
                  The voice-clone service isn't running. In a separate terminal, start it from the <code>voiceclone/</code> folder
                  (<code className="text-amber-100">uvicorn server:app --port 8100</code> — first start downloads the model), then refresh this page.
                </div>
              ) : cloneProfiles.length === 0 ? (
                <div className="flex flex-col items-start gap-3 rounded-input border border-dashed border-gray-700 px-3.5 py-4 text-sm text-gray-400">
                  <p>No cloned voices yet. Upload a 3–10&nbsp;s clean reference clip to create one.</p>
                  <Button size="sm" variant="outline" onClick={() => setCloneModalOpen(true)} icon={<Upload className="h-4 w-4" />}>
                    Clone a new voice
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <Select
                        ariaLabel="Cloned voice"
                        options={cloneProfiles.map((p) => ({
                          value: `clone:${p.id}`,
                          label: p.name,
                          sublabel: new Date(p.createdAt).toLocaleDateString(),
                        }))}
                        value={isCloneVoiceId(studio.voiceId) ? studio.voiceId : ""}
                        onChange={(v) => studio.setVoiceId(v)}
                        placeholder="Select a cloned voice"
                      />
                    </div>
                    <Button size="sm" variant="subtle" onClick={() => setCloneModalOpen(true)} icon={<Upload className="h-4 w-4" />}>
                      New voice
                    </Button>
                    {isCloneVoiceId(studio.voiceId) && (
                      <button
                        type="button"
                        onClick={() => removeCloneProfile(studio.voiceId.slice("clone:".length))}
                        title="Delete this cloned voice"
                        aria-label="Delete this cloned voice"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-input border border-gray-700 text-gray-400 transition-colors hover:border-red-500/50 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Powered by OmniVoice running on your machine — on CPU each generation takes longer than the neural voices.
                  </p>
                </>
              )
            ) : (
              <VoicePicker voices={voices} value={studio.voiceId} onChange={studio.setVoiceId} />
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-gray-400">Selected:</span>
              <span className="font-semibold text-white">{nameFor(studio.voiceId)}</span>
              {isCloneVoiceId(studio.voiceId) ? (
                <Badge tone="violet">Cloned (OmniVoice)</Badge>
              ) : (
                <Badge tone={studio.voiceId.includes("-GB-") ? "violet" : "blue"}>{studio.voiceId.includes("-GB-") ? "British" : "American"}</Badge>
              )}
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-5 rounded-card border border-gray-800 bg-panel p-5">
            <p className="text-sm font-medium text-gray-300">Voice Settings</p>
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
          <div className="rounded-card border border-gray-800 bg-panel p-5">
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
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-btn border border-danger/50 text-red-300 transition-colors hover:bg-danger/10"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </Tooltip>
              )}
            </div>
            {generating && (
              <div className="mt-3">
                <ProgressBar indeterminate tone="default" label="Generating audio" />
                <p className="mt-2 text-center text-xs text-gray-500">
                  Generating with Microsoft Neural voice…
                </p>
              </div>
            )}
            {tts.status === "error" && (
              <p className="mt-3 text-sm text-red-400">Speech generation failed — try a shorter text or a different voice.</p>
            )}
            <p className="mt-3 text-xs text-gray-500">
              🔒 Audio is generated securely on our servers with Microsoft Neural voices. Your text is used only to synthesize the audio and is not stored.
            </p>
          </div>
        </div>

        {/* ── RIGHT: preview & output ──────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-5">
          <div className="rounded-card border border-gray-800 bg-panel p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-300">Preview & Output</p>
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
                className="mt-4 flex items-center gap-2 text-sm text-blue-400 transition-colors hover:text-blue-300"
              >
                <RefreshCw className="h-4 w-4" /> Regenerate
              </button>
            )}
          </div>

          {/* Word timings */}
          {studio.wordTimings.length > 0 && (
            <div className="rounded-card border border-gray-800 bg-panel p-5">
              <p className="mb-3 text-sm font-medium text-gray-300">Word Timing Data</p>
              <p className="text-xs text-gray-500">
                {studio.wordTimings.length} words aligned — used to auto-populate the subtitle editor.
              </p>
              <div className="mt-3 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {studio.wordTimings.slice(0, 120).map((w, i) => (
                  <span key={i} className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-300" title={`${w.start.toFixed(2)}s – ${w.end.toFixed(2)}s`}>
                    {w.word}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* History */}
          <div className="rounded-card border border-gray-800 bg-panel p-5">
            <p className="mb-3 text-sm font-medium text-gray-300">This Session</p>
            {studio.history.length === 0 ? (
              <p className="text-sm text-gray-500">Generations you make will appear here.</p>
            ) : (
              <ul className="divide-y divide-gray-800">
                {studio.history.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 py-2.5">
                    <button
                      onClick={() => {
                        studio.setVoiceId(h.voiceId);
                        studio.setText(h.text);
                        if (cloneConfigured) setVoiceTab(isCloneVoiceId(h.voiceId) ? "clone" : "neural");
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-sm text-white">{truncate(h.text, 60)}</span>
                      <span className="block text-xs text-gray-500">
                        {nameFor(h.voiceId)} · {formatDuration(h.duration)} · {new Date(h.createdAt).toLocaleTimeString()}
                      </span>
                    </button>
                    <button
                      onClick={() => studio.removeHistory(h.id)}
                      aria-label="Remove from history"
                      className="rounded p-1 text-gray-500 hover:text-red-400"
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

      {/* Clone-a-new-voice modal */}
      <Modal
        open={cloneModalOpen}
        onClose={() => !cloneSaving && setCloneModalOpen(false)}
        title="Clone a new voice"
        description="Upload a 3–10 second clip of clean single-speaker speech. The voice is cloned on your machine (OmniVoice) and nothing leaves your computer."
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setCloneModalOpen(false)} disabled={cloneSaving}>
              Cancel
            </Button>
            <Button onClick={submitClone} loading={cloneSaving} disabled={!cloneFile || !cloneName.trim() || !cloneConsent} icon={<Upload className="h-4 w-4" />}>
              {cloneSaving ? "Cloning…" : "Clone voice"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <TextField
            label="Voice name"
            placeholder='e.g. "My voice" or "Narrator"'
            value={cloneName}
            onChange={(e) => setCloneName(e.target.value)}
            maxLength={80}
            autoFocus
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">Reference audio</label>
            <input
              type="file"
              accept="audio/*,.wav,.mp3,.flac,.ogg,.m4a"
              onChange={(e) => setCloneFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-400 file:mr-3 file:rounded-input file:border-0 file:bg-gray-800 file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-gray-100 hover:file:bg-gray-700"
            />
            <p className="mt-1.5 text-xs text-gray-500">
              WAV, MP3, FLAC, OGG, or M4A · 3–10&nbsp;s is ideal — same language as the text you'll generate, minimal background noise.
            </p>
          </div>
          <div>
            <label htmlFor="clone-ref-text" className="mb-1.5 block text-sm font-medium text-gray-300">
              Transcript of the clip <span className="font-normal text-gray-500">(optional)</span>
            </label>
            <textarea
              id="clone-ref-text"
              rows={3}
              value={cloneRefText}
              onChange={(e) => setCloneRefText(e.target.value)}
              placeholder="Exactly what is said in the clip — improves cloning quality. If empty, the service transcribes it automatically (slower)."
              className="w-full resize-y rounded-input border border-gray-700 bg-gray-900 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 transition-colors focus:border-blue-500"
            />
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-input border border-gray-800 bg-gray-900/50 px-3.5 py-3 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={cloneConsent}
              onChange={(e) => setCloneConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-blue-500"
            />
            <span>
              This is my voice, or I have the speaker's explicit permission to clone it. Cloning someone's voice
              without consent may be illegal where you live.
            </span>
          </label>
        </div>
      </Modal>

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
                  format === f ? "border-blue-500 bg-blue-500/10" : "border-gray-700 hover:border-gray-500",
                )}
              >
                <span className="block text-lg font-bold uppercase text-white">{f}</span>
                <span className="block text-xs text-gray-500">{f === "mp3" ? "Compressed" : f === "wav" ? "Lossless" : "Efficient"}</span>
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
      className="flex min-w-0 flex-col items-center gap-1.5 rounded-card border border-gray-700 px-2 py-3 text-center transition-all duration-200 hover:border-blue-500/60 disabled:opacity-50"
    >
      <span className="text-blue-300">{icon}</span>
      <span className="w-full truncate text-xs font-medium text-gray-300">{label}</span>
    </button>
  );
}
