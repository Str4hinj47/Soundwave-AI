import { useMemo, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mic,
  Play,
  Square,
  Trash2,
  Plus,
  Sparkles,
  Flame,
  UploadCloud,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { Navbar } from "../components/layout/Navbar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { DEFAULT_VOICES } from "../lib/voices";
import { cn } from "../lib/cn";
import { useAuth } from "../store/auth";
import { toast } from "../store/toast";

type GenderFilter = "all" | "Female" | "Male";
type AccentFilter = "all" | "American" | "British";

interface ClonedProfile {
  id: string;
  name: string;
  createdAt: string;
  hasRefText: boolean;
  engine?: string;
  sampleUrl?: string;
}

export function VoiceLibrary({ standalone = true }: { standalone?: boolean }) {
  const [query, setQuery] = useState("");
  const [gender, setGender] = useState<GenderFilter>("all");
  const [accent, setAccent] = useState<AccentFilter>("all");
  const [playing, setPlaying] = useState<string | null>(null);

  // Cloned Voices State
  const [clonedVoices, setClonedVoices] = useState<ClonedProfile[]>([]);
  const [loadingClones, setLoadingClones] = useState(false);
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [cloneMethod, setCloneMethod] = useState<"record" | "upload">("record");
  const [cloneName, setCloneName] = useState("");
  const [cloneRefText, setCloneRefText] = useState("");
  const [cloneConsent, setCloneConsent] = useState(false);
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const [isCloning, setIsCloning] = useState(false);

  // Microphone Recording State
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [micSeconds, setMicSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Load user's cloned voices
  const fetchClonedVoices = async () => {
    try {
      setLoadingClones(true);
      const res = await fetch("/api/v1/tts/clone/profiles");
      if (res.ok) {
        const data = await res.json();
        setClonedVoices(data.profiles || []);
      }
    } catch {
      // offline or unconfigured fallback
    } finally {
      setLoadingClones(false);
    }
  };

  useEffect(() => {
    fetchClonedVoices();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DEFAULT_VOICES.filter(
      (v) =>
        (gender === "all" || v.gender === gender) &&
        (accent === "all" || v.accent === accent) &&
        (!q || v.displayName.toLowerCase().includes(q) || v.id.toLowerCase().includes(q)),
    );
  }, [query, gender, accent]);

  const toggle = (id: string, url: string) => {
    if (playing === id) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.play().catch(() => {});
    }
    setPlaying(id);
  };

  // Start in-browser microphone recording
  const startMicRecording = async () => {
    try {
      recordedChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `my_voice_sample_${Date.now()}.webm`, { type: "audio/webm" });
        setCloneFile(file);
      };

      recorder.start(500);
      setIsRecordingMic(true);
      setMicSeconds(0);

      timerRef.current = setInterval(() => {
        setMicSeconds((s) => {
          if (s >= 15) {
            stopMicRecording();
            return 15;
          }
          return s + 1;
        });
      }, 1000);
    } catch (err: any) {
      toast.error(`Microphone error: ${err.message}`);
    }
  };

  // Stop microphone recording
  const stopMicRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsRecordingMic(false);
    toast.success("Voice sample recorded! Now submit below to clone.");
  };

  // Submit Clone Voice
  const handleCloneSubmit = async () => {
    if (!cloneFile) {
      toast.error("Please record or select an audio sample first.");
      return;
    }
    if (!cloneName.trim()) {
      toast.error("Please enter a name for your cloned voice.");
      return;
    }
    if (!cloneConsent) {
      toast.error("Please confirm consent to clone this voice.");
      return;
    }

    try {
      setIsCloning(true);
      const fd = new FormData();
      fd.append("file", cloneFile);
      fd.append("name", cloneName.trim());
      if (cloneRefText.trim()) fd.append("refText", cloneRefText.trim());
      fd.append("consent", "true");

      const res = await fetch("/api/v1/tts/clone/profiles", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to clone voice" }));
        throw new Error(err.error?.message || err.message || "Failed to clone voice");
      }

      toast.success(`Voice "${cloneName.trim()}" successfully cloned!`);
      setCloneModalOpen(false);
      setCloneName("");
      setCloneRefText("");
      setCloneFile(null);
      setCloneConsent(false);
      fetchClonedVoices();
    } catch (err: any) {
      toast.error(err.message || "Voice cloning failed");
    } finally {
      setIsCloning(false);
    }
  };

  // Delete Cloned Voice Profile
  const handleDeleteClone = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete cloned voice "${name}"?`)) return;
    try {
      const res = await fetch(`/api/v1/tts/clone/profiles/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setClonedVoices((prev) => prev.filter((p) => p.id !== id));
        toast.success(`Deleted cloned voice "${name}".`);
      }
    } catch {
      toast.error("Failed to delete voice.");
    }
  };

  return (
    <div className={standalone ? "min-h-screen bg-navy" : undefined}>
      {standalone && <Navbar />}
      <audio ref={audioRef} onEnded={() => setPlaying(null)} className="hidden" />
      <div
        className={cn(
          "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8",
          standalone ? "pb-24 pt-28" : "pb-16 pt-2",
        )}
      >
        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-wide flex items-center gap-2.5">
              <Sparkles className="h-7 w-7 text-violet-400" />
              Voice Library & Cloning Studio
            </h1>
            <p className="mt-1 max-w-2xl text-xs sm:text-sm text-gray-400">
              Clone your own voice in 10 seconds or choose from studio-grade Microsoft Neural voices.
            </p>
          </div>

          <Button
            onClick={() => setCloneModalOpen(true)}
            className="gap-2 bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 font-bold text-white shadow-lg shadow-violet-500/25 hover:from-violet-500 hover:to-cyan-400"
          >
            <Mic className="h-4 w-4" /> + Clone Your Voice (10s)
          </Button>
        </div>

        {/* ── SECTION 1: MY CLONED VOICES ─────────────────────────────────── */}
        <div className="mt-10 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                My Cloned Voices (Zero-Shot Neural)
              </span>
              <span className="rounded-full bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                {clonedVoices.length} ACTIVE
              </span>
            </div>

            <button
              onClick={fetchClonedVoices}
              disabled={loadingClones}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <RefreshCw className={`h-3 w-3 ${loadingClones ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>

          {clonedVoices.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {clonedVoices.map((cv) => (
                <div
                  key={cv.id}
                  className="flex flex-col gap-3 rounded-2xl border border-violet-500/40 bg-gradient-to-br from-violet-950/20 to-panel p-5 shadow-lg hover:border-violet-400 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggle(cv.id, cv.sampleUrl || `/api/v1/tts/clone/profiles/${cv.id}/sample`)}
                      aria-label={playing === cv.id ? `Stop ${cv.name}` : `Play ${cv.name} sample`}
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
                        playing === cv.id
                          ? "bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-md shadow-violet-500/30"
                          : "bg-navy border border-gray-700 text-gray-300 hover:text-white",
                      )}
                    >
                      {playing === cv.id ? <Square className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-white text-sm">{cv.name}</p>
                      <p className="truncate font-mono text-[10px] text-gray-500">ID: {cv.id.slice(0, 8)}...</p>
                    </div>
                    <button
                      onClick={() => handleDeleteClone(cv.id, cv.name)}
                      className="text-gray-500 hover:text-rose-400 p-1"
                      title="Delete this cloned voice"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px]">
                    <Badge tone="violet">MY CLONE</Badge>
                    <Badge tone="blue">NEURAL</Badge>
                  </div>

                  <div className="mt-auto space-y-1.5 pt-2">
                    <button
                      onClick={() => navigate(`/agent?voice=clone:${cv.id}`)}
                      className="flex h-8 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 text-xs font-semibold text-white hover:from-violet-500 hover:to-cyan-500 shadow-sm"
                    >
                      <Flame className="h-3.5 w-3.5" /> Make Viral Short
                    </button>
                    <button
                      onClick={() => navigate(`/studio?voice=clone:${cv.id}`)}
                      className="flex h-8 w-full items-center justify-center gap-1.5 rounded-xl border border-gray-700 text-xs font-semibold text-gray-300 hover:border-gray-500 hover:text-white"
                    >
                      <Mic className="h-3.5 w-3.5" /> Open in Studio
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-800 bg-panel/40 p-8 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                <Mic className="h-6 w-6" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-sm font-bold text-white">No Cloned Voices Yet</h3>
                <p className="mt-1 text-xs text-gray-400 leading-relaxed">
                  Record a 10-second voice sample or upload an audio file to narrate your TikToks, YouTube Shorts, and voiceovers in your exact personal voice.
                </p>
              </div>
              <Button
                onClick={() => setCloneModalOpen(true)}
                size="sm"
                className="gap-1.5 bg-violet-600 hover:bg-violet-500 text-xs"
              >
                <Plus className="h-3.5 w-3.5" /> Clone Your Voice Now
              </Button>
            </div>
          )}
        </div>

        {/* ── SECTION 2: MICROSOFT NEURAL DIRECTORY ───────────────────────── */}
        <div className="mt-14 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-800 pb-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Microsoft Neural Voice Directory
              </span>
              <p className="text-xs text-gray-500 mt-0.5">High-RPM narrator voices for documentary and viral content.</p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search voices…"
                className="rounded-xl border border-gray-800 bg-navy px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
              />
              <div className="flex flex-wrap gap-1.5">
                {(["all", "Female", "Male"] as GenderFilter[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all ${
                      gender === g ? "border-cyan-500 bg-cyan-500/15 text-cyan-300" : "border-gray-800 text-gray-400 hover:text-white"
                    }`}
                  >
                    {g === "all" ? "All" : g}
                  </button>
                ))}
                {(["all", "American", "British"] as AccentFilter[]).map((a) => (
                  <button
                    key={a}
                    onClick={() => setAccent(a)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all ${
                      accent === a ? "border-violet-500 bg-violet-500/15 text-violet-300" : "border-gray-800 text-gray-400 hover:text-white"
                    }`}
                  >
                    {a === "all" ? "All" : a}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((v) => (
              <div
                key={v.id}
                className="flex flex-col gap-3 rounded-2xl border border-gray-800 bg-panel p-5 transition-all duration-200 hover:border-gray-700"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggle(v.id, v.sampleUrl)}
                    aria-label={playing === v.id ? `Stop ${v.displayName}` : `Play ${v.displayName} sample`}
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
                      playing === v.id
                        ? "bg-gradient-to-r from-blue-500 to-violet-500 text-white"
                        : "bg-navy border border-gray-800 text-gray-300 hover:text-white",
                    )}
                  >
                    {playing === v.id ? <Square className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white text-sm">{v.displayName}</p>
                    <p className="truncate font-mono text-[10px] text-gray-500">{v.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge tone={v.gender === "Female" ? "violet" : "blue"}>{v.gender}</Badge>
                  <Badge tone="gray">{v.accent}</Badge>
                </div>
                <button
                  onClick={() => navigate(user ? `/studio?voice=${v.id}` : `/agent?voice=${v.id}`)}
                  className="mt-auto flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-gray-700 text-xs font-semibold text-gray-300 transition-all hover:border-cyan-500 hover:text-white"
                >
                  <Mic className="h-3.5 w-3.5" /> Use This Voice
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── CLONE VOICE MODAL ─────────────────────────────────────────── */}
        <Modal
          open={cloneModalOpen}
          onClose={() => !isCloning && setCloneModalOpen(false)}
          title="Clone Your Personal Voice"
          description="Speak for 10 seconds or upload a clean audio clip. Your custom voice will be available across the entire studio and viral short generator."
        >
          <div className="space-y-4 pt-2">
            {/* Method switch: Record vs Upload */}
            <div className="flex rounded-xl border border-gray-800 bg-navy p-1">
              <button
                type="button"
                onClick={() => setCloneMethod("record")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  cloneMethod === "record"
                    ? "bg-violet-600 text-white shadow-md shadow-violet-500/20"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Mic className="h-3.5 w-3.5" /> Record with Mic (10s)
              </button>
              <button
                type="button"
                onClick={() => setCloneMethod("upload")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  cloneMethod === "upload"
                    ? "bg-violet-600 text-white shadow-md shadow-violet-500/20"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <UploadCloud className="h-3.5 w-3.5" /> Upload File (.wav/.mp3)
              </button>
            </div>

            {/* Voice Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Voice Profile Name</label>
              <input
                type="text"
                placeholder='e.g. "Strahinja - Host Voice", "Narrator"'
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                className="w-full rounded-xl border border-gray-800 bg-navy px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-violet-500 focus:outline-none"
              />
            </div>

            {/* Input Method Content */}
            {cloneMethod === "record" ? (
              <div className="rounded-xl border border-gray-800 bg-navy/60 p-4 text-center space-y-3">
                <div className="text-xs text-gray-300 font-medium leading-relaxed bg-navy/80 p-3 rounded-lg border border-gray-800/80">
                  <p className="text-[11px] text-gray-500 mb-1 uppercase font-bold">Suggested Script to Read:</p>
                  "The future of content creation is automated. Soundwave AI is generating hyper-realistic voiceovers and viral videos in my authentic voice."
                </div>

                <div className="flex flex-col items-center gap-2 pt-1">
                  {!isRecordingMic ? (
                    <Button
                      type="button"
                      onClick={startMicRecording}
                      className="gap-2 bg-gradient-to-r from-rose-500 to-violet-600 text-white font-bold px-5 text-xs"
                    >
                      <Mic className="h-4 w-4" /> Start 10-Second Recording
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={stopMicRecording}
                      className="gap-2 bg-rose-600 text-white font-bold px-5 text-xs animate-pulse"
                    >
                      <Square className="h-4 w-4" /> Stop Recording ({micSeconds}s / 15s)
                    </Button>
                  )}

                  {cloneFile && !isRecordingMic && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 mt-1 font-semibold">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Audio sample recorded ({cloneFile.name})</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Select Audio Clip</label>
                <input
                  type="file"
                  accept="audio/*,.wav,.mp3,.flac,.ogg,.m4a,.webm"
                  onChange={(e) => setCloneFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-xs text-gray-400 file:mr-3 file:rounded-xl file:border-0 file:bg-gray-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-gray-100 hover:file:bg-gray-700"
                />
                <p className="mt-1 text-[11px] text-gray-500">
                  Clean single-speaker speech (3–15 seconds) · WAV, MP3, M4A, OGG, or WEBM.
                </p>
              </div>
            )}

            {/* Transcript (Optional) */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Transcript of clip <span className="text-gray-500 font-normal">(Optional, improves precision)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Type what was said in the audio clip..."
                value={cloneRefText}
                onChange={(e) => setCloneRefText(e.target.value)}
                className="w-full rounded-xl border border-gray-800 bg-navy px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-violet-500 focus:outline-none"
              />
            </div>

            {/* Consent Checkbox */}
            <label className="flex items-start gap-2 text-xs text-gray-400 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={cloneConsent}
                onChange={(e) => setCloneConsent(e.target.checked)}
                className="mt-0.5 rounded accent-violet-600"
              />
              <span>
                I confirm this is my own voice or I have explicit permission to synthesize this speaker's voice.
              </span>
            </label>

            {/* Submit */}
            <div className="pt-2 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCloneModalOpen(false)}
                disabled={isCloning}
                className="border-gray-800 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCloneSubmit}
                disabled={!cloneFile || !cloneName.trim() || !cloneConsent || isCloning}
                className="gap-2 bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-bold text-xs"
              >
                {isCloning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {isCloning ? "Cloning Voice Profile..." : "Clone Voice Now"}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
export default VoiceLibrary;
