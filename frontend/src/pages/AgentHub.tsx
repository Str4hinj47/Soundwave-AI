import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { 
  Sparkles, 
  Download, 
  RefreshCw, 
  Film, 
  CheckCircle2, 
  Volume2, 
  Cpu, 
  Clock, 
  Settings as SettingsIcon, 
  Send, 
  Play, 
  Mic, 
  MicOff, 
  Activity, 
  Trash2, 
  Workflow, 
  Compass, 
  TrendingUp, 
  Flame, 
  Eye, 
  Youtube, 
  ExternalLink, 
  Loader2,
  Smartphone,
} from "lucide-react";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { toast } from "../store/toast";
import { ThinkingOrbVisualizer, ALL_ORB_STATES } from "../components/agent/ThinkingOrbVisualizer";
import type { OrbState } from "thinking-orbs";
import { AGENT_VOICES, agentVoiceLabel, displayNameFor, isSoundwaveVoice, loadAgentVoice, saveAgentVoice } from "../lib/voices";
import {
  CHAT_STORAGE_KEY,
  CHAT_SYNCED_EVENT,
  chatTime,
  completionMessage,
  describeSection,
  failureMessage,
  historyForRequest,
  loadChatHistory,
  mergeChat,
  newMessageId,
  openJobs,
  parseChatHistory,
  replyToMessage,
  saveChatHistory,
  sendChat,
  startedShortJob,
  type ChatMessage,
  type ShortBackground,
  type ShortJob,
} from "../lib/agentChat";
import { speak, stopSpeaking, voiceProblemReason } from "../lib/speech";
import { HOLD_MS, useVoiceCapture } from "../hooks/useVoiceCapture";
import { VOICE_PREFS_EVENT, VoiceInputError, fetchVoiceInputStatus, isVoicePrefKey, loadVoicePrefs, saveVoicePrefs, type VoiceInputStatus } from "../lib/voiceInput";
import { DEFAULT_HOTKEY, getDesktop, hotkeyLabel } from "../lib/desktop";
import { JOB_STARTED_EVENT, VOICE_COMMAND_EVENT } from "../components/agent/BackgroundServices";
import { notifyJobOutcome } from "../lib/notify";
import { clearSharedConversation, type ChatSyncedDetail } from "../lib/conversationSync";

export type { ShortBackground };

interface NicheInfo {
  id: string;
  name: string;
  desc: string;
  iconName: "sparkles" | "compass" | "clock" | "trending" | "cpu" | "flame" | "eye";
}

const NICHES: NicheInfo[] = [
  { id: "psychology", name: "Psychology", desc: "Mind tricks & human behavior", iconName: "sparkles" },
  { id: "facts", name: "Mind-Bending Facts", desc: "Science & nature oddities", iconName: "compass" },
  { id: "history", name: "Untold History", desc: "Bizarre timelines & lost events", iconName: "clock" },
  { id: "finance", name: "Money & Wealth", desc: "Rules of money & investing traps", iconName: "trending" },
  { id: "ai", name: "AI & Future Tech", desc: "Automation tools & secrets", iconName: "cpu" },
  { id: "motivation", name: "Deep Mindset", desc: "Discipline, consistency & grit", iconName: "flame" },
  { id: "horror", name: "Unexplained Horror", desc: "Eerie true stories & anomalies", iconName: "eye" },
];

function getNicheIcon(iconName: string) {
  switch (iconName) {
    case "sparkles": return <Sparkles className="h-4 w-4 text-cyan-400" />;
    case "compass": return <Compass className="h-4 w-4 text-emerald-400" />;
    case "clock": return <Clock className="h-4 w-4 text-amber-400" />;
    case "trending": return <TrendingUp className="h-4 w-4 text-purple-400" />;
    case "cpu": return <Cpu className="h-4 w-4 text-cyan-300" />;
    case "flame": return <Flame className="h-4 w-4 text-rose-400" />;
    case "eye": return <Eye className="h-4 w-4 text-indigo-400" />;
    default: return <Sparkles className="h-4 w-4 text-cyan-400" />;
  }
}

interface OrbitalUsedEntry {
  id: string;
  url: string;
  title: string;
  usedAt: string;
  jobId?: string;
  topic?: string;
  section?: { start: number; end: number } | null;
}

/** GET /api/v1/agent/orbital — which Orbital NCG videos were used / are left. */
export interface OrbitalStatus {
  channelUrl: string;
  channelName: string;
  importer: string;
  catalogSize: number | null;
  catalogFetchedAt: string | null;
  available: number | null;
  usedCount: number;
  skippedCount: number;
  inProgress: number;
  lastUsed: OrbitalUsedEntry | null;
  used: OrbitalUsedEntry[];
  skipped: Array<{ id: string; url: string; title: string; reason: string; skippedAt: string }>;
}

const ORBITAL_CHANNEL_URL = "https://www.youtube.com/@OrbitalNCG";

/** The center column (orb + dock) never scrolls: the orb shrinks to fit the window. */
const ORB_MAX = 300;
const ORB_MIN = 120;
/** Height the center column needs besides the orb: name, status, dock, spacing. */
const CENTER_RESERVED_PX = 214;

interface MacroWorkflow {
  id: string;
  name: string;
  description: string;
  category: "creator" | "productivity" | "system" | "custom";
  triggerPhrases?: string[];
  steps: Array<{ id: string; action: string; description?: string }>;
  isBuiltin?: boolean;
}

export function AgentHub() {
  // Assistant Identity & State
  const [assistantName, setAssistantName] = useState("S.O.U.N.D.W.A.V.E");
  const [assistantState, setAssistantState] = useState<"STANDBY" | "LISTENING" | "THINKING" | "SPEAKING" | "GENERATING">("STANDBY");
  const [currentTimeStr, setCurrentTimeStr] = useState("");
  const [currentDateStr, setCurrentDateStr] = useState("");
  const [uptimeSeconds, setUptimeSeconds] = useState(439);
  const [commandsCount, setCommandsCount] = useState(1);
  const [sessionCount] = useState(1);

  // Telemetry & Hardware Stats
  const [stats, setStats] = useState({
    cpuUsage: 8,
    ramUsageGB: 5.2,
    ramTotalGB: 16.0,
    memoryPercent: 32,
    diskUsedGB: 184,
    diskTotalGB: 512,
    systemLoad: "Optimal",
    loadPercent: 18,
  });

  // Orbital NCG background source (unused videos, history)
  const [orbitalStatus, setOrbitalStatus] = useState<OrbitalStatus | null>(null);
  const [orbitalHistoryOpen, setOrbitalHistoryOpen] = useState(false);
  const [isRefreshingOrbital, setIsRefreshingOrbital] = useState(false);
  const [isResettingOrbital, setIsResettingOrbital] = useState(false);
  /** Background of the most recently rendered short. */
  const [lastBackground, setLastBackground] = useState<ShortBackground | null>(null);
  /** Job currently tracked by the progress UI (Generate button or chat). */
  const activeJobIdRef = useRef<string | null>(null);

  // Orb Visualizer Mode State (persisted)
  const [orbMode, setOrbMode] = useState<OrbState | "auto">(() => {
    return (localStorage.getItem("soundwave_orb_mode") as any) || "auto";
  });

  // Chat conversation stream
  const [userPrompt, setUserPrompt] = useState("");
  // One conversation for every window: the desktop voice bar (/overlay) adds
  // its turns to the same stored history (see lib/agentChat).
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(
    () =>
      loadChatHistory() ?? [
        {
          id: "init",
          sender: "assistant",
          text: "Hello, I am Soundwave. Talk to me with the mic button, or type below. I write, narrate and render your YouTube Shorts. How can I help today, creator?",
          time: chatTime(),
          tag: "VOICE",
        },
      ],
  );
  /** Latest messages, for callbacks that outlive a render. */
  const chatMessagesRef = useRef(chatMessages);
  chatMessagesRef.current = chatMessages;
  /** Set when an update came from another window (don't write it straight back). */
  const skipPersistRef = useRef(false);

  // Modals & Tools
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"general" | "youtube" | "orb">("general");
  const [generatorModalOpen, setGeneratorModalOpen] = useState(false);
  const [macrosModalOpen, setMacrosModalOpen] = useState(false);

  // Shorts Generator State
  const [selectedNiche, setSelectedNiche] = useState<string>("psychology");
  const [customTopic, setCustomTopic] = useState("");
  // The agent's Soundwave voice: replies AND shorts (shared with Settings / Voice Library).
  const [selectedVoice, setSelectedVoice] = useState<string>(() => loadAgentVoice());

  const handleVoiceChange = (v: string) => {
    if (!isSoundwaveVoice(v)) return;
    setSelectedVoice(v);
    saveAgentVoice(v);
  };

  const [resolution, setResolution] = useState<"720p" | "1080p">("720p");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentStep, setCurrentStep] = useState("Ready");
  const [generatedScript, setGeneratedScript] = useState<string>("");
  const [completedVideoUrl, setCompletedVideoUrl] = useState<string | null>(null);

  // YouTube Automation State
  const [ytStatus, setYtStatus] = useState<{
    connected: boolean;
    configured: boolean;
    channelTitle: string | null;
    channelId: string | null;
    autoPublish: boolean;
    defaultPrivacy: "public" | "unlisted" | "private";
    defaultTags: string[];
  }>({
    connected: false,
    configured: false,
    channelTitle: null,
    channelId: null,
    autoPublish: false,
    defaultPrivacy: "public",
    defaultTags: ["shorts", "minecraft", "viral"],
  });
  const [ytClientId, setYtClientId] = useState("");
  const [ytClientSecret, setYtClientSecret] = useState("");
  const [ytRefreshToken, setYtRefreshToken] = useState("");
  const [ytAutoPublish, setYtAutoPublish] = useState(false);
  const [ytPrivacy, setYtPrivacy] = useState<"public" | "unlisted" | "private">("public");
  const [isTestingYt, setIsTestingYt] = useState(false);
  const [isSavingYt, setIsSavingYt] = useState(false);
  const [isUploadingToYt, setIsUploadingToYt] = useState(false);
  const [uploadedYoutubeUrl, setUploadedYoutubeUrl] = useState<string | null>(null);

  // Ghost Operator Macros State
  const [macrosList, setMacrosList] = useState<MacroWorkflow[]>([]);
  const [isRunningMacro, setIsRunningMacro] = useState(false);

  // Memory manager state
  const [memories, setMemories] = useState<string[]>([
    "User prefers TikTok subtitle style with Montserrat 800 and #00F0FF cyan glow.",
    "User generates viral shorts primarily for Psychology and Mind-Bending Facts niches.",
    "Preferred export resolution is 9:16 vertical 720p 60fps.",
  ]);
  const [newMemoryText, setNewMemoryText] = useState("");
  // "Speak replies aloud" — stored, so the desktop voice bar follows it too.
  const [voiceFeedback, setVoiceFeedbackState] = useState(() => loadVoicePrefs().speakReplies);
  const setVoiceFeedback = (on: boolean) => {
    setVoiceFeedbackState(on);
    saveVoicePrefs({ speakReplies: on });
  };
  /** Local speech engine (whisper.cpp) status, for the mic's tooltip and errors. */
  const [voiceInputStatus, setVoiceInputStatus] = useState<VoiceInputStatus | null>(null);
  const desktop = getDesktop();
  const [voiceHotkey, setVoiceHotkey] = useState<string | null>(desktop ? DEFAULT_HOTKEY : null);

  // Refs
  /** The chat's own scroll box — the only thing (besides the left column) that scrolls. */
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const centerColumnRef = useRef<HTMLDivElement | null>(null);
  const [orbSize, setOrbSize] = useState(280);
  /** Left column: fade its bottom edge while more cards wait below (it scrolls). */
  const leftColumnRef = useRef<HTMLDivElement | null>(null);
  const [leftMoreBelow, setLeftMoreBelow] = useState(false);

  // ?tab=generator (sidebar "Generate Short") and ?voice=… (Voice Library)
  const [searchParams, setSearchParams] = useSearchParams();

  // Status Fetchers
  const fetchOrbitalStatus = async () => {
    try {
      const res = await fetch("/api/v1/agent/orbital");
      if (res.ok) {
        const data = (await res.json()) as OrbitalStatus;
        setOrbitalStatus(data);
      }
    } catch {}
  };

  const fetchYtStatus = async () => {
    try {
      const res = await fetch("/api/v1/youtube/status");
      if (res.ok) {
        const data = await res.json();
        setYtStatus(data);
        setYtAutoPublish(data.autoPublish || false);
        setYtPrivacy(data.defaultPrivacy || "public");
      }
    } catch {}
  };

  // Save chat to localStorage (shared with the desktop voice bar)
  useEffect(() => {
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    saveChatHistory(chatMessages);
  }, [chatMessages]);

  // Load macros & restore recent generated video
  useEffect(() => {
    fetch("/api/v1/ghost/macros")
      .then((r) => (r.ok ? r.json() : { macros: [] }))
      .then((d) => setMacrosList(d.macros || []))
      .catch(() => {});

    fetch("/api/v1/agent/jobs?status=COMPLETED&kind=short&limit=1")
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((d) => {
        const jobs = d.jobs || [];
        const completed = jobs.filter((j: any) => j.status === "COMPLETED");
        if (completed.length > 0) {
          const latest = completed[0];
          const dlUrl = latest.outputUrl || `/api/v1/export/jobs/${latest.id}/download`;
          setCompletedVideoUrl(dlUrl);
          if (latest.settings?.background?.url) setLastBackground(latest.settings.background);
        }
      })
      .catch(() => {});

    // Initial Orbital background status & YouTube status
    fetchOrbitalStatus();
    fetchYtStatus();
  }, []);

  // Clock & Uptime Ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }));
      setCurrentDateStr(now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }));
      setUptimeSeconds((s) => s + 1);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Simulated Hardware Load Ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setStats((prev) => ({
        ...prev,
        cpuUsage: Math.floor(6 + Math.random() * 8 + (isGenerating ? 42 : 0)),
        loadPercent: Math.floor(14 + Math.random() * 10 + (isGenerating ? 38 : 0)),
      }));
    }, 4000);
    return () => clearInterval(interval);
  }, [isGenerating]);

  // ── Agent speech: always a Soundwave voice ─────────────────────────────
  // Replies stream from /api/v1/agent/speak/stream while Microsoft renders
  // them (lib/speech). Same-origin audio, which the desktop app's CSP allows.
  // There is no non-neural fallback: if the voice service is down, a toast
  // says why.
  const lastVoiceErrorAtRef = useRef(0);
  // Latest picks, for callbacks that outlive a render (e.g. a short finishing minutes later).
  const selectedVoiceRef = useRef(selectedVoice);
  selectedVoiceRef.current = selectedVoice;
  const voiceFeedbackRef = useRef(voiceFeedback);
  voiceFeedbackRef.current = voiceFeedback;

  const idleState = () => (activeJobIdRef.current ? "GENERATING" : "STANDBY");

  useEffect(() => () => stopSpeaking(), []);

  const reportVoiceProblem = async () => {
    const now = Date.now();
    if (now - lastVoiceErrorAtRef.current < 15_000) return;
    lastVoiceErrorAtRef.current = now;
    toast.error("Soundwave voice unavailable", await voiceProblemReason());
  };

  /** Speak `text`. Pass `voice` to speak even when "Speak replies aloud" is off (explicit replay/test). */
  const speakText = (text: string, voiceOverride?: string) => {
    if (!voiceFeedbackRef.current && !voiceOverride) return;
    const current = selectedVoiceRef.current;
    const voice = isSoundwaveVoice(voiceOverride) ? voiceOverride : isSoundwaveVoice(current) ? current : loadAgentVoice();
    speak(text, voice, {
      onStart: () => setAssistantState("SPEAKING"),
      onEnd: () => setAssistantState(idleState()),
      onError: () => {
        setAssistantState(idleState());
        void reportVoiceProblem();
      },
      onBlocked: () => {
        setAssistantState(idleState());
        toast.info("Click anywhere to let Soundwave talk", "The browser blocks sound until you interact with the page.");
      },
    });
  };

  // Turning replies off also silences the current one.
  useEffect(() => {
    if (!voiceFeedback) stopSpeaking();
  }, [voiceFeedback]);

  // Voice settings changed (here, in Settings, or in another window).
  useEffect(() => {
    const sync = () => setVoiceFeedbackState(loadVoicePrefs().speakReplies);
    const onStorage = (e: StorageEvent) => {
      if (isVoicePrefKey(e.key)) sync();
    };
    window.addEventListener(VOICE_PREFS_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(VOICE_PREFS_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Sidebar "Generate Short" (?tab=generator) and the Voice Library's
  // "Use in Command Center" (?voice=…) land here.
  const handledSearchRef = useRef<string | null>(null);
  useEffect(() => {
    const voice = searchParams.get("voice");
    const openGenerator = searchParams.get("tab") === "generator";
    const listen = searchParams.get("listen") === "1";
    if (!voice && !openGenerator && !listen) {
      handledSearchRef.current = null;
      return;
    }
    // React's dev double-run of effects must not toast twice.
    if (handledSearchRef.current === searchParams.toString()) return;
    handledSearchRef.current = searchParams.toString();
    if (isSoundwaveVoice(voice)) {
      handleVoiceChange(voice);
      toast.success("Voice selected", `${displayNameFor(voice)} now speaks for the agent and narrates your shorts.`);
    }
    if (openGenerator) setGeneratorModalOpen(true);
    if (listen) window.setTimeout(() => toggleListening(), 150);
    const next = new URLSearchParams(searchParams);
    next.delete("voice");
    next.delete("listen");
    if (openGenerator) next.delete("tab");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Keep the newest message in view — scrolling only the chat box, never the page.
  useEffect(() => {
    const box = chatScrollRef.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  }, [chatMessages]);

  const updateLeftFade = () => {
    const el = leftColumnRef.current;
    if (el) setLeftMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  };

  useEffect(() => {
    const el = leftColumnRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    updateLeftFade();
    const observer = new ResizeObserver(updateLeftFade);
    observer.observe(el);
    for (const card of Array.from(el.children)) observer.observe(card);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedVideoUrl]);

  // Size the orb from the space the center column really has, so the dock
  // under it is always on screen (down to the desktop app's 1024×640 minimum).
  useEffect(() => {
    const el = centerColumnRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const wide = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      const byWidth = width - 72;
      // Below lg the page scrolls normally and the column's height follows the orb.
      const byHeight = wide.matches ? height - CENTER_RESERVED_PX : 280;
      const next = Math.round(Math.max(ORB_MIN, Math.min(ORB_MAX, byWidth, byHeight)));
      setOrbSize((prev) => (Math.abs(prev - next) >= 2 ? next : prev));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    wide.addEventListener("change", update);
    return () => {
      observer.disconnect();
      wide.removeEventListener("change", update);
    };
  }, []);

  // Format seconds to HH:MM:SS
  const formatUptime = (secs: number) => {
    const h = String(Math.floor(secs / 3600)).padStart(2, "0");
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
    const s = String(secs % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  // ── Conversation Dispatcher ─────────────────────────────────────────────
  /** Send a typed or spoken message to the agent and show / speak its reply. */
  const sendMessage = async (text: string, opts: { viaVoice?: boolean } = {}) => {
    const query = text.trim();
    if (!query) return;
    setCommandsCount((c) => c + 1);

    const userMsg: ChatMessage = {
      id: newMessageId(),
      sender: "user",
      text: query,
      time: chatTime(),
      at: Date.now(),
      ...(opts.viaVoice ? { viaVoice: true } : {}),
    };
    const history = historyForRequest(chatMessagesRef.current);
    setChatMessages((prev) => [...prev, userMsg]);
    setAssistantState("THINKING");

    try {
      const data = await sendChat({ message: query, history, voice: selectedVoiceRef.current, resolution });
      // "generate a yt short …" → the server started a background job
      // (unused Orbital NCG video → YouTube link importer → render); follow it.
      const aiMsg = replyToMessage(data, query);
      const videoLink = aiMsg.videoUrl;
      if (videoLink) {
        setCompletedVideoUrl(videoLink);
      }
      setChatMessages((prev) => [...prev, aiMsg]);
      speakText(aiMsg.text);
      if (startedShortJob(data) && activeJobIdRef.current !== data.jobId) {
        void trackShortJob(data.jobId, data.topic || query);
      }
    } catch {
      const fallbackMsg: ChatMessage = {
        id: newMessageId(),
        sender: "assistant",
        text: `I couldn't process "${query}" just now — the local agent server didn't answer. Try again in a moment.`,
        time: chatTime(),
        tag: "SYS",
      };
      setChatMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setAssistantState((prev) => (prev === "SPEAKING" ? prev : idleState()));
    }
  };

  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPrompt.trim()) return;
    const query = userPrompt.trim();
    setUserPrompt("");
    void sendMessage(query);
  };

  // ── Voice input: mic button, orb, Ctrl+Shift+Space ─────────────────────
  // Recorded here, transcribed on this PC by whisper.cpp (nothing goes to a
  // cloud service), then sent exactly like a typed message. Tap = talk until
  // you pause; hold = push-to-talk (release to send).
  const capture = useVoiceCapture({
    onTranscript: (text) => void sendMessage(text, { viaVoice: true }),
    onNothingHeard: () => {
      setAssistantState(idleState());
      toast.info("I didn't catch that", "Nothing was heard — try again, a little closer to the microphone.");
    },
    onError: (err) => {
      setAssistantState(idleState());
      const engine = err instanceof VoiceInputError && err.code === "engine";
      toast.error(engine ? "Voice input unavailable" : "Microphone problem", err.message);
      if (engine) void fetchVoiceInputStatus().then(setVoiceInputStatus);
    },
  });
  const micPhase = capture.phase;
  const isMicActive = micPhase === "starting" || micPhase === "listening";
  const { toggle: toggleListening, finish: finishListening, cancel: cancelListening, holdStarted, tapConfirmed } = capture;

  useEffect(() => {
    if (micPhase === "starting" || micPhase === "listening") setAssistantState("LISTENING");
    else if (micPhase === "transcribing") setAssistantState("THINKING");
    else setAssistantState((prev) => (prev === "LISTENING" ? idleState() : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micPhase]);

  // Mic button: a tap toggles listening, holding it is push-to-talk.
  const micPressRef = useRef<{ at: number; wasActive: boolean; holdTimer?: number } | null>(null);
  const onMicPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const wasActive = capture.phaseRef.current !== "idle";
    // Event timestamps, not the clock: a busy page can deliver the release late.
    const press: { at: number; wasActive: boolean; holdTimer?: number } = { at: e.timeStamp, wasActive };
    micPressRef.current = press;
    if (!wasActive) {
      void capture.start();
      press.holdTimer = window.setTimeout(holdStarted, HOLD_MS);
    }
  };
  const onMicPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const press = micPressRef.current;
    micPressRef.current = null;
    if (!press) return;
    window.clearTimeout(press.holdTimer);
    const phase = capture.phaseRef.current;
    const recording = phase === "listening" || phase === "starting";
    if (press.wasActive) {
      if (recording) void finishListening("manual"); // second tap: send
      return;
    }
    if (recording && e.timeStamp - press.at >= HOLD_MS) {
      void finishListening("manual"); // push-to-talk released
      return;
    }
    // A quick tap keeps listening until the speaker pauses (or taps again).
    tapConfirmed();
  };

  // Ctrl+Shift+Space on this page (the desktop app registers it system-wide
  // and routes it here while this window has focus).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && !e.repeat) {
        e.preventDefault();
        toggleListening();
      }
    };
    const onCommand = (e: Event) => {
      const command = (e as CustomEvent<string>).detail;
      if (command === "cancel") cancelListening();
      else if (command === "stop") void finishListening("manual");
      else toggleListening();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(VOICE_COMMAND_EVENT, onCommand);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(VOICE_COMMAND_EVENT, onCommand);
    };
  }, [toggleListening, finishListening, cancelListening]);

  // Speech engine + shortcut status (tooltips, Settings hints).
  useEffect(() => {
    void fetchVoiceInputStatus().then(setVoiceInputStatus);
    desktop
      ?.getState()
      .then((st) => setVoiceHotkey(st.hotkeyEnabled && st.hotkeyRegistered ? st.hotkey : null))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The voice bar (another window) added to the conversation: show it here,
  // and follow any short it started.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== CHAT_STORAGE_KEY) return;
      const next = parseChatHistory(e.newValue);
      if (!next) return;
      skipPersistRef.current = true;
      setChatMessages(next);
      if (!activeJobIdRef.current) {
        const open = openJobs(next);
        const latest = open[open.length - 1];
        if (latest) void trackShortJob(latest.jobId, latest.topic);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The phone companion added to the conversation (lib/conversationSync put it
  // in storage): merge — never replace, so a message this window is adding
  // right now can't be lost — and follow any short the phone started.
  useEffect(() => {
    const onSynced = (e: Event) => {
      const stored = loadChatHistory();
      if (!stored) return;
      if ((e as CustomEvent<ChatSyncedDetail>).detail?.replaced) {
        setChatMessages(stored); // a new conversation ("Clear")
        return;
      }
      setChatMessages((prev) => {
        const next = mergeChat(prev, stored);
        return next.length === prev.length && next.every((m, i) => m === prev[i]) ? prev : next;
      });
      if (!activeJobIdRef.current) {
        const open = openJobs(mergeChat(chatMessagesRef.current, stored));
        const latest = open[open.length - 1];
        if (latest) void trackShortJob(latest.jobId, latest.topic);
      }
    };
    window.addEventListener(CHAT_SYNCED_EVENT, onSynced);
    return () => window.removeEventListener(CHAT_SYNCED_EVENT, onSynced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On open: settle shorts the conversation announced but never reported on
  // (started from the voice bar, or finished while another page was open),
  // and pick up a render that's still running.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const { jobId, topic } of openJobs(chatMessagesRef.current)) {
        try {
          const res = await fetch(`/api/v1/export/jobs/${jobId}`);
          if (cancelled) return;
          if (res.status === 404) {
            setChatMessages((prev) =>
              prev.some((m) => m.jobId === jobId && m.jobState !== "started") ? prev : [...prev, failureMessage(jobId, topic, "that render is no longer available.")],
            );
            continue;
          }
          if (!res.ok) continue;
          const { job } = (await res.json()) as { job: ShortJob };
          if (cancelled) return;
          if (job.status === "COMPLETED") {
            const videoUrl = job.outputUrl || `/api/v1/export/jobs/${jobId}/download`;
            setCompletedVideoUrl(videoUrl);
            setChatMessages((prev) =>
              prev.some((m) => m.jobId === jobId && m.jobState === "done")
                ? prev
                : [...prev, completionMessage(jobId, topic, { videoUrl, youtubeUrl: job.settings?.youtubeUrl, background: job.settings?.background })],
            );
          } else if (job.status === "FAILED") {
            setChatMessages((prev) =>
              prev.some((m) => m.jobId === jobId && m.jobState === "failed") ? prev : [...prev, failureMessage(jobId, topic, job.errorMessage || "rendering failed")],
            );
          } else if (!activeJobIdRef.current) {
            void trackShortJob(jobId, topic);
          }
        } catch {
          /* server busy — try on the next visit */
        }
      }
      if (cancelled || activeJobIdRef.current) return;
      try {
        const res = await fetch("/api/v1/agent/jobs?status=PROCESSING&kind=short&limit=1");
        const { jobs } = (await res.json()) as { jobs?: Array<{ id: string; settings?: { topic?: string } }> };
        const running = jobs?.[0];
        if (!cancelled && running && !activeJobIdRef.current) void trackShortJob(running.id, running.settings?.topic || "your short");
      } catch {
        /* nothing running */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Ghost Operator Macro Runner ─────────────────────────────────────────
  const runMacro = async (macroId: string) => {
    try {
      setIsRunningMacro(true);
      setAssistantState("THINKING");
      setCommandsCount((c) => c + 1);

      const res = await fetch("/api/v1/ghost/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ macroId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to execute macro");

      const sysMsg: ChatMessage = {
        id: Date.now().toString(),
        sender: "assistant",
        text: `Ghost Operator Executed: ${data.report?.workflowName}\n${data.report?.summary}\nTotal runtime: ${data.report?.totalDurationMs}ms`,
        time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
        tag: "RPA",
      };
      setChatMessages((prev) => [...prev, sysMsg]);
      speakText(data.report?.summary || "Macro finished.");
      toast.success("Macro Complete", data.report?.workflowName);
    } catch (e: any) {
      toast.error("Execution Failed", e.message);
    } finally {
      setIsRunningMacro(false);
      setAssistantState("STANDBY");
    }
  };

  // ── YouTube API & Automation Handlers ──────────────────────────────────
  const handleTestYt = async () => {
    try {
      setIsTestingYt(true);
      const res = await fetch("/api/v1/youtube/test", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        toast.success("YouTube Connected", `Authenticated channel: ${data.channelTitle || "Active"}`);
        fetchYtStatus();
      } else {
        toast.error("Connection Failed", data.error || "Could not verify credentials with Google");
      }
    } catch (err: any) {
      toast.error("Test Failed", err.message);
    } finally {
      setIsTestingYt(false);
    }
  };

  const handleSaveYtConfig = async () => {
    try {
      setIsSavingYt(true);
      const payload: any = {
        autoPublish: ytAutoPublish,
        defaultPrivacy: ytPrivacy,
      };
      if (ytClientId.trim()) payload.clientId = ytClientId.trim();
      if (ytClientSecret.trim()) payload.clientSecret = ytClientSecret.trim();
      if (ytRefreshToken.trim()) payload.refreshToken = ytRefreshToken.trim();

      const res = await fetch("/api/v1/youtube/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast.success("YouTube Settings Saved", data.connected ? "Channel linked and auto-publish ready!" : "Preferences updated.");
        fetchYtStatus();
      } else {
        toast.error("Save Error", data.error || "Failed to update configuration");
      }
    } catch (err: any) {
      toast.error("Save Error", err.message);
    } finally {
      setIsSavingYt(false);
    }
  };

  const handleManualUploadYt = async (targetVideoUrl: string, scriptText?: string) => {
    if (!ytStatus.connected && !ytStatus.configured) {
      toast.error("YouTube Not Connected", "Please enter your YouTube API credentials in Settings first.");
      setSettingsOpen(true);
      return;
    }

    try {
      setIsUploadingToYt(true);
      toast.info("Uploading to YouTube", "Transmitting short to YouTube Shorts API...");
      const rawTitle = (scriptText || generatedScript || customTopic || selectedNiche)
        .split("\n")[0]
        ?.replace(/^[#\s*]+/, "")
        .slice(0, 75) || `Viral Short #${Math.floor(Math.random() * 1000)}`;

      const res = await fetch("/api/v1/youtube/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: targetVideoUrl,
          title: rawTitle,
          description: scriptText || generatedScript || "",
          privacy: ytPrivacy,
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setUploadedYoutubeUrl(data.youtubeUrl);
        toast.success("Published to YouTube Shorts!", data.youtubeUrl);
        speakText("Short successfully published to YouTube Shorts!");
      } else {
        throw new Error(data.error || "Upload failed");
      }
    } catch (err: any) {
      toast.error("YouTube Upload Failed", err.message);
    } finally {
      setIsUploadingToYt(false);
    }
  };

  // ── Orbital NCG Background Handlers ───────────────────────────────────
  const handleRefreshOrbital = async () => {
    setIsRefreshingOrbital(true);
    try {
      const res = await fetch("/api/v1/agent/orbital/refresh", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (data.status) setOrbitalStatus(data.status);
      if (res.ok && data.ok) {
        toast.success("Orbital NCG channel checked", `${data.status?.catalogSize ?? 0} videos · ${data.status?.available ?? 0} not used yet`);
      } else {
        toast.error("Couldn't reach the Orbital NCG channel", data.error || "Channel listing failed");
      }
    } catch (err: any) {
      toast.error("Couldn't reach the Orbital NCG channel", err.message);
    } finally {
      setIsRefreshingOrbital(false);
    }
  };

  const handleResetOrbital = async () => {
    if (!window.confirm("Forget which Orbital NCG videos were already used? Future shorts may reuse them.")) return;
    setIsResettingOrbital(true);
    try {
      const res = await fetch("/api/v1/agent/orbital/reset", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status) {
        setOrbitalStatus(data.status);
        toast.success("Orbital history reset", "Every Orbital NCG video is available again.");
      } else {
        toast.error("Reset failed", data.error || "Could not reset the Orbital history");
      }
    } catch (err: any) {
      toast.error("Reset failed", err.message);
    } finally {
      setIsResettingOrbital(false);
    }
  };

  // ── Short Job Tracker (Generate button + chat) ─────────────────────────
  // Follows a background short job via SSE with a polling fallback. Steps
  // include the Orbital NCG link being pasted into the YouTube link importer.
  const trackShortJob = (jobId: string, topic: string): Promise<void> => {
    activeJobIdRef.current = jobId;
    window.dispatchEvent(new CustomEvent(JOB_STARTED_EVENT, { detail: jobId }));
    setIsGenerating(true);
    setCompletedVideoUrl(null);
    setUploadedYoutubeUrl(null);
    setAssistantState("GENERATING");
    setProgressPercent((prev) => Math.max(prev, 8));
    setCurrentStep("Picking an Orbital NCG video the agent hasn't used yet...");

    return new Promise<void>((resolve) => {
      let isDone = false;
      let eventSource: EventSource | null = null;
      let pollTimer: ReturnType<typeof setInterval> | null = null;
      // Imports of long videos can take a while — only give up after a long silence.
      const STALL_MS = 10 * 60_000;
      let lastActivity = Date.now();
      let lastSignature = "";

      const noteActivity = (progress?: unknown, step?: unknown) => {
        const signature = `${String(progress)}|${String(step)}`;
        if (signature !== lastSignature) {
          lastSignature = signature;
          lastActivity = Date.now();
        }
      };

      const cleanup = () => {
        isDone = true;
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      };

      const finish = () => {
        if (activeJobIdRef.current === jobId) activeJobIdRef.current = null;
        setIsGenerating(false);
        fetchOrbitalStatus();
        resolve();
      };

      const finishSuccess = (resultData: any) => {
        if (isDone) return;
        cleanup();

        setProgressPercent(100);
        setCurrentStep("Completed!");
        setAssistantState("STANDBY");

        const finalVideoUrl =
          resultData.outputUrl ||
          resultData.videoUrl ||
          resultData.downloadUrl ||
          `/api/v1/export/jobs/${jobId}/download`;
        const background: ShortBackground | undefined = resultData.background || resultData.settings?.background;

        if (resultData.script) setGeneratedScript(resultData.script);
        setCompletedVideoUrl(finalVideoUrl);
        setLastBackground(background ?? null);
        if (resultData.youtubeUrl) {
          setUploadedYoutubeUrl(resultData.youtubeUrl);
        }

        const hasYt = !!resultData.youtubeUrl;
        const successNotice = completionMessage(jobId, topic, {
          videoUrl: finalVideoUrl,
          youtubeUrl: resultData.youtubeUrl,
          background,
        });
        setChatMessages((prev) => (prev.some((m) => m.jobId === jobId && m.jobState === "done") ? prev : [...prev, successNotice]));
        speakText(hasYt ? "Your short has been rendered and posted to YouTube Shorts!" : "Your video has finished rendering and is ready to download!");
        void notifyJobOutcome({ id: jobId, status: "COMPLETED", topic, youtubeUrl: resultData.youtubeUrl });
        toast.success(hasYt ? "Published to YouTube!" : "Video Ready", hasYt ? resultData.youtubeUrl : "Short generated successfully.");
        finish();
      };

      const finishFail = (errMessage: string) => {
        if (isDone) return;
        cleanup();
        setAssistantState("STANDBY");
        setProgressPercent(0);
        setCurrentStep("Ready");
        setChatMessages((prev) =>
          prev.some((m) => m.jobId === jobId && m.jobState === "failed") ? prev : [...prev, failureMessage(jobId, topic, errMessage)],
        );
        toast.error("Generation Error", errMessage);
        void notifyJobOutcome({ id: jobId, status: "FAILED", topic, error: errMessage });
        finish();
      };

      // 1. Real-time EventSource SSE listener
      try {
        eventSource = new EventSource(`/api/v1/export/jobs/${jobId}/events`);
        eventSource.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            noteActivity(msg.progress, msg.step);
            if (typeof msg.progress === "number") {
              setProgressPercent((prev) => Math.max(prev, msg.progress));
            }
            if (msg.step) {
              setCurrentStep(msg.step);
            }
            if (msg.status === "COMPLETED") {
              finishSuccess(msg);
            } else if (msg.status === "FAILED") {
              finishFail(msg.error || "Video export failed");
            }
          } catch {}
        };
        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
        };
      } catch {}

      // 2. Polling fallback (+ stall detection)
      pollTimer = setInterval(async () => {
        if (isDone) return;
        if (Date.now() - lastActivity > STALL_MS) {
          finishFail("Generation stalled — no progress for 10 minutes");
          return;
        }
        try {
          const pollRes = await fetch(`/api/v1/export/jobs/${jobId}`);
          if (pollRes.ok) {
            const pollData = await pollRes.json();
            const j = pollData.job;
            if (j) {
              noteActivity(j.progress, j.settings?.step);
              if (typeof j.progress === "number" && j.progress > 0) {
                setProgressPercent((prev) => Math.max(prev, j.progress));
              }
              if (j.settings?.step) {
                setCurrentStep(j.settings.step);
              }
              if (j.status === "COMPLETED") {
                finishSuccess(j);
              } else if (j.status === "FAILED") {
                finishFail(j.errorMessage || "Export failed");
              }
            }
          }
        } catch {}
        // SSE is the primary channel; poll gently — the API allows 120 req/min
        // per user, and an Orbital import + render can take a few minutes.
      }, 1500);
    });
  };

  // ── 1-Click Viral Short Generator ───────────────────────────────────────
  const handleGenerateShort = async () => {
    if (isGenerating) return;
    const topic = customTopic.trim() || selectedNiche;

    try {
      setIsGenerating(true);
      setCompletedVideoUrl(null);
      setProgressPercent(8);
      setAssistantState("GENERATING");
      setCurrentStep("Initiating generation...");

      const payload = {
        topic,
        voice: selectedVoice,
        resolution,
        async: true,
        autoPublishYouTube: ytAutoPublish,
        youtubePrivacy: ytPrivacy,
      };

      const res = await fetch("/api/v1/agent/generate-short", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let initData: any = {};
      try { initData = JSON.parse(text); } catch {}
      if (!res.ok) throw new Error(initData.error || text || "Generation failed to start");

      const jobId = initData.jobId;
      if (!jobId) throw new Error("No job ID received from server");

      await trackShortJob(jobId, topic);
    } catch (err: any) {
      toast.error("Generation Error", err.message);
      setAssistantState("STANDBY");
      setProgressPercent(0);
      setIsGenerating(false);
    }
  };

  // Export Conversation
  const handleExtractConversation = () => {
    const text = chatMessages
      .map((m) => `[${m.time}] ${m.sender.toUpperCase()}: ${m.text}`)
      .join("\n\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `soundwave_conversation_${Date.now()}.txt`;
    a.click();
    toast.success("Conversation Exported", "Transcript downloaded as .txt");
  };

  return (
    // lg+: exactly the window's height — nothing on the page scrolls except the
    // left column's cards and the conversation. The middle (orb + dock) is fixed.
    <div className="flex flex-col gap-3 bg-[#070B14] text-gray-100 select-none font-sans p-3 sm:p-4 lg:h-full lg:min-h-0 lg:overflow-hidden">
      {/* ── 1. TOP HUD STATUS BAR ─────────────────────────────────────── */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-3 py-2 rounded-xl border border-[#14233D] bg-[#0A1224]/80 backdrop-blur-md">
        {/* Left: Assistant Title & Online Status */}
        <div className="flex items-center gap-3">
          <span className="text-sm sm:text-base font-extrabold tracking-[0.25em] text-cyan-400 font-mono">
            {assistantName}
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Online
          </span>
        </div>

        {/* Center: Time & Date Capsule */}
        <div className="flex items-center gap-2 rounded-full border border-[#172A4A] bg-[#0C172E] px-4 py-1 text-xs text-gray-300 font-mono shadow-inner">
          <Clock className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-white font-semibold">{currentTimeStr || "2:52:27 PM"}</span>
          <span className="hidden text-gray-500 xl:inline">|</span>
          <span className="hidden text-gray-300 xl:inline">{currentDateStr || "September 20, 2026"}</span>
        </div>

        {/* Right: Voice Capsule, Orbital Background Capsule & Settings Gear Button */}
        <div className="flex items-center gap-2">
          {/* Soundwave voice (replies + shorts) */}
          <div className="flex items-center gap-1.5 rounded-full border border-[#172A4A] bg-[#0C172E] px-2.5 py-1 text-xs text-gray-300 font-mono">
            <Volume2 className="h-3.5 w-3.5 text-cyan-400" />
            <select
              value={selectedVoice}
              onChange={(e) => handleVoiceChange(e.target.value)}
              className="bg-transparent text-cyan-400 font-semibold focus:outline-none cursor-pointer text-xs"
              title="The agent's Soundwave voice — used for replies and for the shorts it makes"
              aria-label="Agent voice"
            >
              {AGENT_VOICES.map((v) => (
                <option key={v.id} value={v.id} className="bg-[#0A1224] text-white">
                  {agentVoiceLabel(v.id)}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setOrbitalHistoryOpen(true);
              fetchOrbitalStatus();
            }}
            className="flex items-center gap-1.5 rounded-full border border-[#172A4A] bg-[#0C172E] px-3 py-1 text-xs text-gray-300 font-mono hover:border-cyan-500/40 transition-colors cursor-pointer"
            title="Orbital NCG videos the agent hasn't used yet"
          >
            <Youtube className="h-3.5 w-3.5 text-red-500" />
            <span className="text-white font-semibold">{orbitalStatus?.available ?? "—"}</span>
            <span className="hidden xl:inline text-gray-400">unused Orbital videos</span>
          </button>

          <button
            onClick={() => setSettingsOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#172A4A] bg-[#0C172E] text-gray-300 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors cursor-pointer"
            title="Assistant Settings"
            aria-label="Settings"
          >
            <SettingsIcon className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ── 2. THREE-COLUMN WORKSPACE DECK ────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:grid-rows-[minmax(0,1fr)] lg:flex-1 lg:min-h-0">
        {/* ── LEFT COLUMN: SYSTEM TELEMETRY & WIDGETS — scrolls on its own ── */}
        <div
          ref={leftColumnRef}
          onScroll={updateLeftFade}
          className={`lg:col-span-3 flex flex-col gap-3 [&>*]:shrink-0 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-1 ${
            leftMoreBelow ? "sw-fade-bottom" : ""
          }`}
        >
          {/* Card 1: System Stats */}
          <div className="rounded-xl border border-[#14233D] bg-[#0A1224] p-3.5 space-y-3 font-mono">
            <div className="flex items-center justify-between border-b border-[#14233D] pb-1.5 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-gray-200">
                <Cpu className="h-3.5 w-3.5 text-cyan-400" />
                System Stats
              </span>
              <button
                onClick={() => setStats((p) => ({ ...p, cpuUsage: Math.floor(6 + Math.random() * 8) }))}
                className="text-gray-400 hover:text-cyan-400 transition-colors"
                title="Refresh stats"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>

            {/* CPU Usage Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-gray-300">
                <span>CPU Usage</span>
                <span className="text-cyan-400 font-bold">{stats.cpuUsage}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#070D18]">
                <div
                  className="h-full bg-cyan-400 transition-all duration-300"
                  style={{ width: `${stats.cpuUsage}%` }}
                />
              </div>
            </div>

            {/* RAM Usage Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-gray-300">
                <span>RAM Usage</span>
                <span className="text-cyan-400 font-bold">{stats.ramUsageGB} GB</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#070D18]">
                <div
                  className="h-full bg-cyan-400 transition-all duration-300"
                  style={{ width: `${stats.memoryPercent}%` }}
                />
              </div>
            </div>

            {/* 3 Metric Tiles */}
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="rounded-lg border border-[#14233D] bg-[#070D18] p-1.5">
                <span className="text-[10px] text-gray-400 block">CPU</span>
                <span className="text-xs font-bold text-white">{stats.cpuUsage}%</span>
              </div>
              <div className="rounded-lg border border-[#14233D] bg-[#070D18] p-1.5">
                <span className="text-[10px] text-gray-400 block">Memory</span>
                <span className="text-xs font-bold text-white">{stats.memoryPercent}%</span>
              </div>
              <div className="rounded-lg border border-[#14233D] bg-[#070D18] p-1.5">
                <span className="text-[10px] text-gray-400 block">Disk</span>
                <span className="block text-xs font-bold leading-tight text-white">
                  {stats.diskUsedGB}/<wbr />
                  {stats.diskTotalGB} GB
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Orbital NCG Background Source */}
          <div className="rounded-xl border border-[#14233D] bg-[#0A1224] p-3.5 space-y-2.5 font-mono">
            <div className="flex items-center justify-between border-b border-[#14233D] pb-1.5 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-gray-200">
                <Film className="h-3.5 w-3.5 text-cyan-400" />
                Orbital NCG Backgrounds
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOrbitalHistoryOpen(true);
                    fetchOrbitalStatus();
                  }}
                  className="text-gray-400 hover:text-cyan-300 transition-colors cursor-pointer"
                  title="Show the Orbital videos already used"
                >
                  <Clock className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleRefreshOrbital}
                  disabled={isRefreshingOrbital}
                  className="text-gray-400 hover:text-cyan-400 transition-colors cursor-pointer disabled:opacity-50"
                  title="Re-check the channel for new uploads"
                >
                  <RefreshCw className={`h-3 w-3 ${isRefreshingOrbital ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-2xl font-bold text-white tracking-tight">{orbitalStatus?.available ?? "—"}</span>
                <span className="text-xs text-gray-400 ml-1.5">unused videos</span>
                <p className="text-[11px] text-cyan-400/90 mt-0.5">
                  {orbitalStatus?.catalogSize != null
                    ? `of ${orbitalStatus.catalogSize} on the channel`
                    : "Channel gets listed on the first Generate"}
                </p>
              </div>
              <div className="text-right">
                <span className="rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold block">
                  {orbitalStatus?.usedCount ?? 0} USED
                </span>
                <span className="text-[9px] text-gray-400 mt-1 block">Never reused</span>
              </div>
            </div>

            <div className="rounded-lg border border-[#14233D] bg-[#070D18] p-2 space-y-0.5">
              <span className="text-[10px] text-gray-400 block">Last imported background</span>
              {orbitalStatus?.lastUsed ? (
                <a
                  href={orbitalStatus.lastUsed.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-cyan-300 hover:text-cyan-200"
                  title={orbitalStatus.lastUsed.url}
                >
                  <span className="truncate">{orbitalStatus.lastUsed.title}</span>
                  <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                </a>
              ) : (
                <span className="text-[11px] text-gray-500 block">None yet</span>
              )}
            </div>

            <a
              href={ORBITAL_CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full rounded-lg border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 px-2.5 py-1.5 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-cyan-950/40"
            >
              <Youtube className="h-3.5 w-3.5 text-red-500" />
              youtube.com/@OrbitalNCG
              <ExternalLink className="h-3 w-3" />
            </a>

            <p className="text-[10px] text-gray-400 italic">
              *On every Generate (button or chat) the agent picks an Orbital NCG video it hasn't used before, pastes its link into the YouTube link importer, and uses the imported gameplay as the background.
            </p>
          </div>

          {/* YouTube Shorts Studio & Automation Card */}
          <div className="rounded-xl border border-[#14233D] bg-[#0A1224] p-3.5 space-y-2.5 font-mono">
            <div className="flex items-center justify-between border-b border-[#14233D] pb-1.5 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-gray-200">
                <Youtube className="h-3.5 w-3.5 text-red-500" />
                YouTube Automation
              </span>
              <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                ytStatus.connected || ytStatus.configured
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-gray-800 text-gray-400 border border-gray-700"
              }`}>
                {ytStatus.connected || ytStatus.configured ? (ytStatus.channelTitle || "CONNECTED") : "NOT LINKED"}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Auto-Post Shorts:</span>
              <button
                type="button"
                onClick={() => {
                  const next = !ytAutoPublish;
                  setYtAutoPublish(next);
                  fetch("/api/v1/youtube/config", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ autoPublish: next }),
                  }).then(() => fetchYtStatus());
                }}
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer ${
                  ytAutoPublish ? "bg-red-600 text-white shadow-sm shadow-red-500/40" : "bg-gray-800 text-gray-400"
                }`}
              >
                {ytAutoPublish ? "ENABLED" : "DISABLED"}
              </button>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Default Visibility:</span>
              <span className="font-bold uppercase text-white text-[11px]">{ytPrivacy}</span>
            </div>

            <div className="pt-1 flex gap-1.5">
              {completedVideoUrl && !uploadedYoutubeUrl && (
                <button
                  type="button"
                  onClick={() => handleManualUploadYt(completedVideoUrl, generatedScript)}
                  disabled={isUploadingToYt}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold py-1.5 text-[11px] transition-all shadow-md shadow-red-600/30 cursor-pointer disabled:opacity-50"
                >
                  <Youtube className="h-3 w-3" />
                  {isUploadingToYt ? "Posting..." : "Post to YouTube"}
                </button>
              )}
              {uploadedYoutubeUrl && (
                <a
                  href={uploadedYoutubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-red-600/20 border border-red-500/40 hover:bg-red-600/30 text-red-300 font-bold py-1.5 text-[11px] transition-all cursor-pointer"
                >
                  <Youtube className="h-3 w-3 text-red-400" />
                  View on YouTube
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="rounded-lg border border-[#14233D] bg-[#070D18] hover:border-cyan-400 text-gray-300 hover:text-white px-2 py-1 text-[11px] transition-all cursor-pointer flex items-center gap-1"
                title="Configure YouTube API Keys"
              >
                <SettingsIcon className="h-3 w-3" />
                Setup
              </button>
            </div>
          </div>

          {/* Persistent Latest Rendered Video Card */}
          {completedVideoUrl && (
            <div className="rounded-xl border border-cyan-500/40 bg-[#0A1224] p-3.5 space-y-2.5 font-mono shadow-lg shadow-cyan-950/30">
              <div className="flex items-center justify-between border-b border-[#14233D] pb-1.5 text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-cyan-300">
                  <Film className="h-3.5 w-3.5 text-cyan-400" />
                  Latest Rendered Video
                </span>
                <span className="rounded bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 text-[9px] font-bold">
                  READY
                </span>
              </div>
              <div className="relative aspect-[9/16] max-h-44 w-full rounded-lg border border-[#14233D] bg-black overflow-hidden flex items-center justify-center mx-auto">
                <video
                  src={completedVideoUrl}
                  controls
                  playsInline
                  className="h-full w-full object-contain"
                />
              </div>
              {lastBackground && (
                <a
                  href={lastBackground.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-md border border-[#172A4A] bg-[#070D18] px-2 py-1 text-[10px] text-gray-300 hover:text-cyan-300 transition-colors"
                  title={`Imported via the YouTube link importer: ${lastBackground.url}`}
                >
                  <Youtube className="h-3 w-3 shrink-0 text-red-500" />
                  <span className="truncate">
                    Background: {lastBackground.title} · Orbital NCG · {describeSection(lastBackground.section)}
                  </span>
                  <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                </a>
              )}
              <div className="space-y-1.5">
                <a
                  href={completedVideoUrl}
                  download="soundwave_viral_short.mp4"
                  className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-cyan-500 hover:bg-cyan-400 text-[#070B14] font-bold py-1.5 text-xs transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Short (MP4)
                </a>
                {uploadedYoutubeUrl ? (
                  <a
                    href={uploadedYoutubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-red-950/50 border border-red-500/40 text-red-300 hover:bg-red-900/60 font-bold py-1.5 text-xs transition-all cursor-pointer"
                  >
                    <Youtube className="h-3.5 w-3.5 text-red-500" />
                    Live on YouTube Shorts
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleManualUploadYt(completedVideoUrl, generatedScript)}
                    disabled={isUploadingToYt}
                    className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 font-bold py-1.5 text-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Youtube className="h-3.5 w-3.5 text-red-500" />
                    {isUploadingToYt ? "Posting..." : "1-Click Post to YouTube Shorts"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Card 4: System Uptime & Automation */}
          <div className="rounded-xl border border-[#14233D] bg-[#0A1224] p-3.5 space-y-2.5 font-mono">
            <div className="flex items-center justify-between border-b border-[#14233D] pb-1.5 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-gray-200">
                <Activity className="h-3.5 w-3.5 text-cyan-400" />
                System Uptime
              </span>
              <span className="text-[11px] text-cyan-400">{formatUptime(uptimeSeconds)}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400">System Running For:</span>
              <span className="font-bold text-white">{formatUptime(uptimeSeconds)}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg border border-[#14233D] bg-[#070D18] p-1.5">
                <span className="text-[10px] text-gray-400 block">Session</span>
                <span className="text-xs font-bold text-white">{sessionCount}</span>
              </div>
              <div className="rounded-lg border border-[#14233D] bg-[#070D18] p-1.5">
                <span className="text-[10px] text-gray-400 block">Commands</span>
                <span className="text-xs font-bold text-white">{commandsCount}</span>
              </div>
            </div>

            {/* System Load */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>System Load</span>
                <span>{stats.loadPercent}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#070D18]">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-500"
                  style={{ width: `${stats.loadPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── CENTER COLUMN: ORB & DOCK — fixed, never scrolls ─────────── */}
        <div ref={centerColumnRef} className="lg:col-span-5 flex flex-col items-center px-4 py-4 lg:min-h-0 lg:overflow-hidden">
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center w-full">
            {/* Jakubantalik Thinking Orb Visualizer (9 Hand-Tuned Cognitive States) */}
            <ThinkingOrbVisualizer
              assistantState={assistantState}
              isMicActive={isMicActive}
              size={orbSize}
              orbMode={orbMode}
              className="my-3"
              onOrbClick={toggleListening}
            />

            {/* Assistant Name Label */}
            <h2 className="text-lg font-bold tracking-[0.25em] text-white font-mono mt-1">
              {assistantName}
            </h2>

            {/* Dynamic Status Capsule */}
            <div className="mt-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#172A4A] bg-[#0C172E] px-4 py-1 text-xs text-gray-300 font-mono shadow-inner">
                <span className={`h-2 w-2 rounded-full animate-pulse ${isMicActive ? "bg-emerald-400" : micPhase === "transcribing" ? "bg-cyan-400" : "bg-emerald-400"}`} />
                {micPhase === "starting"
                  ? "Starting microphone..."
                  : isMicActive
                  ? "Listening... pause or tap the mic to send"
                  : micPhase === "transcribing"
                  ? "Transcribing your voice..."
                  : assistantState === "THINKING"
                  ? "Neural processing..."
                  : assistantState === "SPEAKING"
                  ? `Speaking as ${displayNameFor(selectedVoice)}...`
                  : assistantState === "GENERATING" || isGenerating
                  ? `Rendering short (${progressPercent}%)...`
                  : voiceHotkey
                  ? `Tap the mic or press ${hotkeyLabel(voiceHotkey)} to talk`
                  : "Tap the mic to talk"}
              </span>
            </div>
          </div>

          {/* Bottom Dock Control Buttons (Shorts, Mic, Automation, Settings) */}
          <div className="flex shrink-0 items-center gap-3 pt-4">
            <button
              onClick={() => setGeneratorModalOpen(true)}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#172A4A] bg-[#0C172E] text-cyan-400 hover:border-cyan-500/50 hover:text-white transition-all cursor-pointer shadow-md shadow-cyan-950/20"
              title="1-Click Viral Short Generator"
            >
              <Film className="h-5 w-5" />
            </button>

            <button
              type="button"
              onPointerDown={onMicPointerDown}
              onPointerUp={onMicPointerUp}
              onPointerCancel={onMicPointerUp}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
                  e.preventDefault();
                  toggleListening();
                }
              }}
              onContextMenu={(e) => e.preventDefault()}
              className={`relative flex h-12 w-12 touch-none items-center justify-center rounded-xl border transition-all cursor-pointer ${
                isMicActive
                  ? "border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-lg shadow-emerald-500/25"
                  : micPhase === "transcribing"
                  ? "border-cyan-400/60 bg-cyan-500/10 text-cyan-300"
                  : voiceInputStatus && !voiceInputStatus.available
                  ? "border-[#172A4A] bg-[#0C172E] text-gray-500 hover:border-amber-500/40"
                  : "border-[#172A4A] bg-[#0C172E] text-gray-300 hover:border-cyan-500/50 hover:text-white"
              }`}
              style={isMicActive ? { boxShadow: `0 0 0 ${2 + Math.round(capture.level * 10)}px rgba(52, 211, 153, 0.22)` } : undefined}
              title={
                voiceInputStatus && !voiceInputStatus.available
                  ? `Voice input unavailable: ${voiceInputStatus.reason ?? "speech engine missing"}`
                  : isMicActive
                  ? "Tap to send (or just pause)"
                  : `Talk to Soundwave — tap, or hold to talk${voiceHotkey ? ` · ${hotkeyLabel(voiceHotkey)}` : ""}`
              }
              aria-label={isMicActive ? "Stop listening and send" : "Talk to Soundwave"}
              aria-pressed={isMicActive}
            >
              {micPhase === "transcribing" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isMicActive ? (
                <Mic className="h-5 w-5 text-emerald-400" />
              ) : voiceInputStatus && !voiceInputStatus.available ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>

            <button
              onClick={() => setMacrosModalOpen(true)}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#172A4A] bg-[#0C172E] text-purple-400 hover:border-purple-500/50 hover:text-white transition-all cursor-pointer"
              title="Ghost Operator Macro Automations"
            >
              <Workflow className="h-5 w-5" />
            </button>

            <button
              onClick={() => setSettingsOpen(true)}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#172A4A] bg-[#0C172E] text-cyan-400 hover:border-cyan-500/50 hover:text-white transition-all cursor-pointer"
              title="Orb States & Assistant Settings"
            >
              <SettingsIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ── RIGHT COLUMN: CONVERSATION STREAM & INPUT (3.5 cols) ─────── */}
        <div className="lg:col-span-4 rounded-xl border border-[#14233D] bg-[#0A1224] p-4 flex flex-col h-[640px] lg:h-auto lg:min-h-0 font-mono">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-[#14233D] pb-3">
            <h3 className="text-sm font-semibold text-white">Conversation</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const cleared: ChatMessage = {
                    id: newMessageId(),
                    sender: "assistant",
                    text: "Conversation cleared. Ready for your next command.",
                    time: chatTime(),
                    at: Date.now(),
                    tag: "SYS",
                  };
                  setChatMessages([cleared]);
                  // The phone shows the same conversation: start over there too.
                  void clearSharedConversation([cleared]);
                  toast.info("Log Cleared", "Message buffer reset.");
                }}
                className="flex items-center gap-1 rounded-md border border-[#172A4A] bg-[#070D18] px-2 py-1 text-[11px] text-gray-400 hover:text-cyan-400 transition-colors"
                title="Clear conversation"
              >
                <Trash2 className="h-3 w-3" />
                {/* Icon-only while the chat column is narrow (lg, below xl). */}
                <span className="lg:hidden xl:inline">Clear</span>
              </button>

              <button
                onClick={handleExtractConversation}
                className="flex items-center gap-1 rounded-md border border-[#172A4A] bg-[#070D18] px-2 py-1 text-[11px] text-gray-400 hover:text-cyan-400 transition-colors"
                title="Extract and download conversation"
              >
                <Download className="h-3 w-3" />
                <span className="hidden xl:inline 2xl:hidden">Export</span>
                <span className="lg:hidden 2xl:inline">Extract Conversation</span>
              </button>
            </div>
          </div>

          {/* Messages Feed — the conversation scrolls inside its own box */}
          <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-3 py-3 pr-1 text-xs">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-xl p-3 leading-relaxed transition-all ${
                  msg.sender === "user"
                    ? "bg-[#0A1F38] border border-cyan-800/40 text-cyan-100 ml-6"
                    : "bg-[#070F1E] border border-[#172A4A] text-gray-200 mr-2"
                }`}
              >
                <div className="whitespace-pre-line text-xs">{msg.text}</div>

                {/* Inline Video Player & Download Button */}
                {Boolean(msg.videoUrl || msg.downloadUrl) && (
                  <div className="mt-2.5 rounded-lg border border-cyan-500/30 bg-[#040814] p-2.5 space-y-2 font-mono">
                    <div className="flex items-center justify-between text-[11px] text-cyan-300 font-bold border-b border-[#14233D] pb-1">
                      <span className="flex items-center gap-1.5">
                        <Film className="h-3.5 w-3.5 text-cyan-400" />
                        9:16 Viral Short Video
                      </span>
                      <span className="rounded bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 text-[9px] font-bold">
                        READY
                      </span>
                    </div>

                    <div className="relative rounded-lg overflow-hidden border border-[#172A4A] bg-black max-h-52 flex justify-center items-center">
                      <video
                        src={msg.videoUrl || msg.downloadUrl}
                        controls
                        playsInline
                        className="max-h-52 rounded-md aspect-[9/16] object-contain shadow-lg"
                      />
                    </div>

                    {msg.background && (
                      <a
                        href={msg.background.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-md border border-[#172A4A] bg-[#070D18] px-2 py-1 text-[10px] text-gray-300 hover:text-cyan-300 transition-colors"
                        title={`Imported via the YouTube link importer: ${msg.background.url}`}
                      >
                        <Youtube className="h-3 w-3 shrink-0 text-red-500" />
                        <span className="truncate">
                          Background: {msg.background.title} · Orbital NCG · {describeSection(msg.background.section)}
                        </span>
                        <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                      </a>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <a
                        href={msg.downloadUrl || msg.videoUrl}
                        download="soundwave_viral_short.mp4"
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-[#070B14] font-bold py-1.5 px-3 text-xs transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download Video (MP4)
                      </a>
                      {msg.youtubeUrl ? (
                        <a
                          href={msg.youtubeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/80 border border-red-500/50 text-red-300 font-bold py-1.5 px-3 text-xs transition-all cursor-pointer"
                        >
                          <Youtube className="h-3.5 w-3.5 text-red-500" />
                          Shorts Link
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleManualUploadYt(msg.videoUrl || msg.downloadUrl!, msg.text)}
                          disabled={isUploadingToYt}
                          className="flex items-center gap-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 font-bold py-1.5 px-3 text-xs transition-all cursor-pointer disabled:opacity-50"
                          title="Post this video to YouTube Shorts"
                        >
                          <Youtube className="h-3.5 w-3.5 text-red-500" />
                          {isUploadingToYt ? "Posting..." : "Post to YouTube"}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] text-gray-500 mt-2 pt-1 border-t border-white/[0.04]">
                  <span className="flex items-center gap-1 uppercase text-[9px] font-bold tracking-wider text-cyan-400">
                    {msg.via === "phone" && <Smartphone className="h-2.5 w-2.5" aria-label="From your phone" />}
                    {msg.viaVoice && <Mic className="h-2.5 w-2.5" aria-label="Spoken" />}
                    {msg.via === "phone"
                      ? msg.viaVoice
                        ? "YOU (PHONE, VOICE)"
                        : "YOU (PHONE)"
                      : msg.viaVoice
                        ? "YOU (VOICE)"
                        : msg.tag || (msg.sender === "user" ? "USER" : "AGENT")}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {msg.sender === "assistant" && (
                      <button
                        onClick={() => speakText(msg.text, selectedVoice)}
                        title="Replay Voice Speech"
                        className="text-gray-400 hover:text-cyan-400 transition-colors"
                      >
                        <Volume2 className="h-3 w-3" />
                      </button>
                    )}
                    <span>{msg.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Command Prompt Input Bar */}
          <div className="shrink-0 pt-2 border-t border-[#14233D] space-y-2">
            {/* Live short progress (Generate button or chat request) */}
            {isGenerating && (
              <div className="rounded-lg border border-cyan-500/30 bg-[#070D18] px-2.5 py-1.5 space-y-1 font-mono">
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="truncate text-gray-300" title={currentStep}>
                    🎬 {currentStep}
                  </span>
                  <span className="shrink-0 text-cyan-400 font-bold">{progressPercent}%</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-gray-800">
                  <div className="h-full bg-cyan-400 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            )}

            {/* Quick Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-[10px] text-gray-400 pb-1">
              <button
                onClick={() => runMacro("creator_morning_prep")}
                className="shrink-0 rounded-md border border-[#172A4A] bg-[#070D18] px-2 py-0.5 hover:text-cyan-300 transition-colors"
              >
                🌅 Morning Setup
              </button>
              <button
                onClick={() => runMacro("deep_focus_pomodoro")}
                className="shrink-0 rounded-md border border-[#172A4A] bg-[#070D18] px-2 py-0.5 hover:text-purple-300 transition-colors"
              >
                🎯 Deep Focus
              </button>
              <button
                onClick={() => setGeneratorModalOpen(true)}
                className="shrink-0 rounded-md border border-[#172A4A] bg-[#070D18] px-2 py-0.5 hover:text-cyan-300 transition-colors"
              >
                🎬 Make Short
              </button>
            </div>

            <form onSubmit={handleUserSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="Type a message..."
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                className="flex-1 rounded-xl border border-[#172A4A] bg-[#070D18] px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:border-cyan-400 focus:outline-none transition-colors"
              />
              <button
                type="submit"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-[#070B14] font-bold shadow-lg shadow-cyan-500/30 transition-all cursor-pointer"
                title="Send Command"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ── 3. MODAL: 1-CLICK VIRAL SHORT GENERATOR ───────────────────── */}
      {generatorModalOpen && (
        <Modal
          open={generatorModalOpen}
          onClose={() => setGeneratorModalOpen(false)}
          title="1-Click Viral Short Generator"
          size="lg"
        >
          <div className="space-y-4 font-mono text-xs">
            <p className="text-gray-400 text-[11px]">
              Soundwave crafts high-retention curiosity hooks, synthesizes 24kHz Edge TTS narration, renders word-by-word TikTok subtitles, and composes 9:16 vertical video at 60fps.
            </p>

            {/* Niche Grid */}
            <div className="space-y-1.5">
              <label className="text-gray-300 font-semibold">Select Topic Niche</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {NICHES.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      setSelectedNiche(n.id);
                    }}
                    className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                      selectedNiche === n.id
                        ? "border-cyan-400 bg-cyan-500/10 text-white"
                        : "border-[#172A4A] bg-[#070D18] text-gray-400 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {getNicheIcon(n.iconName)}
                      <span className="font-bold text-[11px] text-white">{n.name}</span>
                    </div>
                    <span className="text-[10px] text-gray-500 line-clamp-1">{n.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Topic Input */}
            <div className="space-y-1">
              <label className="text-gray-300 font-semibold">Custom Hook or Topic (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Why Intelligent People Procrastinate More"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                className="w-full rounded-lg border border-[#172A4A] bg-[#070D18] px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            {/* Voice & Resolution */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-gray-300 font-semibold">Narrator (Soundwave voice)</label>
                <select
                  value={selectedVoice}
                  onChange={(e) => handleVoiceChange(e.target.value)}
                  className="w-full rounded-lg border border-[#172A4A] bg-[#070D18] px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                >
                  {AGENT_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {agentVoiceLabel(v.id)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-gray-300 font-semibold">Resolution</label>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as any)}
                  className="w-full rounded-lg border border-[#172A4A] bg-[#070D18] px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                >
                  <option value="720p">720p (Ultra Fast Render)</option>
                  <option value="1080p">1080p (High Definition)</option>
                </select>
              </div>
            </div>

            {/* Background Footage Source: Orbital NCG via the YouTube link importer */}
            <div className="rounded-lg border border-[#172A4A] bg-[#070D18] p-2.5 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-gray-300">Background Footage Source</span>
                <span className="text-cyan-400 font-bold">
                  {orbitalStatus?.available != null ? `${orbitalStatus.available} unused Orbital videos` : "Orbital NCG"}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 leading-normal">
                The agent picks a video from{" "}
                <a href={ORBITAL_CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline hover:text-cyan-200">
                  youtube.com/@OrbitalNCG
                </a>{" "}
                that it hasn't used before, pastes its link into the YouTube link importer, and composites the imported gameplay behind your captions.
              </p>
              <div className="pt-1 flex items-center gap-2">
                <a
                  href={ORBITAL_CHANNEL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 px-2.5 py-1.5 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Youtube className="h-3 w-3 text-red-500" />
                  Open Orbital NCG
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setOrbitalHistoryOpen(true);
                    fetchOrbitalStatus();
                  }}
                  className="rounded-lg border border-[#172A4A] bg-[#070D18] hover:border-cyan-400/50 hover:bg-cyan-500/10 text-gray-300 hover:text-cyan-300 px-2.5 py-1.5 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Orbital videos already used as backgrounds"
                >
                  <Clock className="h-3 w-3 text-cyan-400" />
                  Used Videos ({orbitalStatus?.usedCount ?? 0})
                </button>
              </div>
            </div>

            {/* YouTube Shorts Auto-Publish Section */}
            <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-2.5 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-gray-200 flex items-center gap-1.5">
                  <Youtube className="h-3.5 w-3.5 text-red-500" />
                  YouTube Shorts Auto-Publish
                </span>
                <span className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${
                  ytStatus.connected || ytStatus.configured
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-gray-800 text-gray-400 border border-gray-700"
                }`}>
                  {ytStatus.connected || ytStatus.configured ? (ytStatus.channelTitle || "LINKED") : "NOT LINKED"}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-0.5">
                <label className="text-gray-300 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ytAutoPublish}
                    onChange={(e) => setYtAutoPublish(e.target.checked)}
                    className="rounded border-[#172A4A] bg-[#070D18] text-red-600 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                  />
                  <span>Automatically post to YouTube Shorts after rendering</span>
                </label>
                <select
                  value={ytPrivacy}
                  onChange={(e) => setYtPrivacy(e.target.value as any)}
                  className="rounded border border-[#172A4A] bg-[#070D18] px-2 py-0.5 text-[10px] text-white focus:outline-none"
                >
                  <option value="public">Public</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="private">Private</option>
                </select>
              </div>

              {(!ytStatus.connected && !ytStatus.configured) && (
                <p className="text-[10px] text-gray-400">
                  Tip: Add your Google OAuth keys in{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setGeneratorModalOpen(false);
                      setSettingsOpen(true);
                    }}
                    className="text-red-400 underline hover:text-red-300 cursor-pointer"
                  >
                    Assistant Settings
                  </button>{" "}
                  to enable automatic posting.
                </p>
              )}
            </div>

            {/* Progress Bar */}
            {isGenerating && (
              <div className="space-y-1 rounded-lg border border-[#172A4A] bg-[#070D18] p-2.5">
                <div className="flex justify-between text-[11px] text-gray-300">
                  <span>{currentStep}</span>
                  <span className="text-cyan-400 font-bold">{progressPercent}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Video & Script Preview */}
            {(completedVideoUrl || generatedScript) && (
              <div className="rounded-lg border border-cyan-500/30 bg-[#070D18] p-3 space-y-2">
                <p className="text-cyan-300 font-bold text-xs flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Video Render Complete
                </p>
                {completedVideoUrl && (
                  <video
                    src={completedVideoUrl}
                    controls
                    autoPlay
                    className="max-h-48 mx-auto rounded-lg aspect-[9/16] object-cover"
                  />
                )}
                {generatedScript && (
                  <div className="text-[10px] text-gray-300 bg-[#050B14] p-2 rounded border border-[#172A4A] max-h-24 overflow-y-auto whitespace-pre-wrap">
                    {generatedScript}
                  </div>
                )}
                {completedVideoUrl && (
                  <div className="flex flex-col gap-1.5 pt-1">
                    <a
                      href={completedVideoUrl.includes("?") ? `${completedVideoUrl}&download=1` : `${completedVideoUrl}?download=1`}
                      download="soundwave_viral_short.mp4"
                      className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-cyan-500 text-[#070B14] py-1.5 text-xs font-bold hover:bg-cyan-400 transition-colors cursor-pointer shadow-md shadow-cyan-500/20"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download 9:16 Short (MP4)
                    </a>
                    {uploadedYoutubeUrl ? (
                      <a
                        href={uploadedYoutubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-red-600/30 border border-red-500/50 text-red-300 hover:bg-red-600/40 py-1.5 text-xs font-bold transition-all cursor-pointer"
                      >
                        <Youtube className="h-3.5 w-3.5 text-red-500" />
                        Watch on YouTube Shorts
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleManualUploadYt(completedVideoUrl, generatedScript)}
                        disabled={isUploadingToYt}
                        className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-red-600/20 border border-red-500/40 text-red-300 hover:bg-red-600/30 py-1.5 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Youtube className="h-3.5 w-3.5 text-red-500" />
                        {isUploadingToYt ? "Uploading..." : "Post to YouTube Shorts Now"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-[#172A4A] flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setGeneratorModalOpen(false)}>
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleGenerateShort}
                loading={isGenerating}
                icon={<Sparkles className="h-3.5 w-3.5" />}
              >
                {isGenerating ? "Rendering..." : "Generate Short"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── 4. MODAL: GHOST OPERATOR MACROS ───────────────────────────── */}
      {macrosModalOpen && (
        <Modal
          open={macrosModalOpen}
          onClose={() => setMacrosModalOpen(false)}
          title="Ghost Operator Macros"
        >
          <div className="space-y-3 font-mono text-xs">
            <p className="text-gray-400 text-[11px]">
              Execute chained workstation automations, Pomodoro focus mode, and browser routines.
            </p>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {macrosList.map((m) => (
                <div
                  key={m.id}
                  className="rounded-lg border border-[#172A4A] bg-[#070D18] p-3 flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-xs font-bold text-white">{m.name}</h4>
                    <p className="text-[11px] text-gray-400 mt-0.5">{m.description}</p>
                    <span className="text-[10px] text-cyan-400 mt-1 block">
                      {m.steps?.length || 0} automated steps
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      runMacro(m.id);
                      setMacrosModalOpen(false);
                    }}
                    disabled={isRunningMacro}
                    className="flex items-center gap-1 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 px-3 py-1.5 text-xs font-bold hover:bg-cyan-500 hover:text-[#070B14] transition-all cursor-pointer"
                  >
                    <Play className="h-3 w-3" />
                    Run
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-[#172A4A] flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setMacrosModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── 5. MODAL: SETTINGS ────────────────────────────────────────── */}
      {settingsOpen && (
        <Modal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          title="Assistant Configuration"
          size="lg"
          footer={
            <div className="flex w-full items-center justify-between font-mono text-xs">
              <span className="text-[11px] text-gray-500">Soundwave AI Control Center</span>
              <Button variant="primary" size="sm" onClick={() => setSettingsOpen(false)}>
                Done
              </Button>
            </div>
          }
        >
          <div className="space-y-4 font-mono text-xs">
            {/* Settings Tab Navigation */}
            <div className="flex border-b border-[#172A4A] pb-2 gap-2">
              <button
                type="button"
                onClick={() => setSettingsTab("general")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  settingsTab === "general"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "text-gray-400 hover:text-white bg-[#0A1224] border border-[#14233D]"
                }`}
              >
                <SettingsIcon className="h-3.5 w-3.5" />
                General & Voice
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab("youtube")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  settingsTab === "youtube"
                    ? "bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm"
                    : "text-gray-400 hover:text-white bg-[#0A1224] border border-[#14233D]"
                }`}
              >
                <Youtube className="h-3.5 w-3.5 text-red-500" />
                YouTube API & Shorts
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab("orb")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  settingsTab === "orb"
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm"
                    : "text-gray-400 hover:text-white bg-[#0A1224] border border-[#14233D]"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                Thinking Orb
              </button>
            </div>

            {/* TAB 1: General & Voice */}
            {settingsTab === "general" && (
              <div className="space-y-3.5 animate-fadeIn">
                <div className="space-y-1">
                  <label className="text-gray-300 font-semibold">Assistant Identity Name</label>
                  <input
                    type="text"
                    value={assistantName}
                    onChange={(e) => setAssistantName(e.target.value)}
                    className="w-full rounded-lg border border-[#172A4A] bg-[#070D18] px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                {/* Voice Talent Selection */}
                <div className="space-y-2 p-3 rounded-lg border border-[#172A4A] bg-[#070D18]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white">Soundwave Voice</p>
                      <p className="text-[10px] text-gray-400">Microsoft neural voice for the agent's replies and for the shorts it narrates</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        speakText(
                          `Hi, I'm ${displayNameFor(selectedVoice)}. This is the voice I'll use for my replies and for your shorts.`,
                          selectedVoice,
                        )
                      }
                      className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-bold text-cyan-400 hover:bg-cyan-500 hover:text-[#070B14] transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Volume2 className="h-3 w-3" /> Test Voice
                    </button>
                  </div>

                  <select
                    value={selectedVoice}
                    onChange={(e) => handleVoiceChange(e.target.value)}
                    className="w-full rounded-lg border border-[#172A4A] bg-[#0C172E] px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  >
                    {AGENT_VOICES.map((v) => (
                      <option key={v.id} value={v.id}>
                        {agentVoiceLabel(v.id)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border border-[#172A4A] bg-[#070D18]">
                  <div>
                    <p className="text-xs font-bold text-white">Speak Replies Aloud</p>
                    <p className="text-[10px] text-gray-400">Reads every reply in the selected Soundwave voice</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVoiceFeedback(!voiceFeedback)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold transition-colors cursor-pointer ${
                      voiceFeedback ? "bg-cyan-500 text-[#070B14]" : "bg-gray-800 text-gray-400"
                    }`}
                  >
                    {voiceFeedback ? "Enabled" : "Disabled"}
                  </button>
                </div>

                {/* Voice input (local speech recognition) */}
                <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-[#172A4A] bg-[#070D18]">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white">Voice Input</p>
                    <p className="text-[10px] text-gray-400">
                      {voiceInputStatus?.available
                        ? `Recognized on this PC (whisper.cpp · ${voiceInputStatus.model}) — nothing is uploaded. Tap the mic, hold it to talk${
                            voiceHotkey ? `, or press ${hotkeyLabel(voiceHotkey)} from any app` : ""
                          }.`
                        : voiceInputStatus
                        ? `Unavailable: ${voiceInputStatus.reason ?? "speech engine missing"}`
                        : "Checking the speech engine..."}
                    </p>
                  </div>
                  <Link
                    to="/settings/voice"
                    onClick={() => setSettingsOpen(false)}
                    className="shrink-0 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-bold text-cyan-400 hover:bg-cyan-500 hover:text-[#070B14] transition-all"
                  >
                    Options
                  </Link>
                </div>

                {/* Learned Memory */}
                <div className="space-y-1.5">
                  <label className="text-gray-300 font-semibold">Learned Memory & Preferences</label>
                  <div className="max-h-24 overflow-y-auto space-y-1 border border-[#172A4A] rounded-lg p-2 bg-[#070D18]">
                    {memories.map((m, i) => (
                      <div key={i} className="text-[11px] text-gray-300 flex items-start gap-1.5">
                        <span className="text-cyan-400">·</span>
                        <span>{m}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add memory..."
                      value={newMemoryText}
                      onChange={(e) => setNewMemoryText(e.target.value)}
                      className="flex-1 rounded-lg border border-[#172A4A] bg-[#070D18] px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:border-cyan-400 focus:outline-none"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (newMemoryText.trim()) {
                          setMemories((p) => [...p, newMemoryText.trim()]);
                          setNewMemoryText("");
                          toast.success("Saved", "Preference recorded in memory.");
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: YouTube API & Shorts Auto-Publish */}
            {settingsTab === "youtube" && (
              <div className="space-y-3.5 animate-fadeIn">
                <div className="p-3 rounded-lg border border-red-500/30 bg-[#070D18] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Youtube className="h-4 w-4 text-red-500" />
                      <span className="text-xs font-bold text-white">YouTube Data API v3 & Auto-Publish</span>
                    </div>
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                      ytStatus.connected || ytStatus.configured
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-gray-800 text-gray-400"
                    }`}>
                      {ytStatus.connected || ytStatus.configured ? (ytStatus.channelTitle || "CONNECTED") : "NOT CONFIGURED"}
                    </span>
                  </div>

                  <p className="text-[10px] text-gray-400">
                    Connect your Google Cloud OAuth2 credentials to automatically publish viral Shorts directly to your YouTube channel.
                  </p>

                  <div className="space-y-2 pt-1">
                    <div>
                      <label className="text-[10px] text-gray-400 block mb-0.5">Google OAuth Client ID</label>
                      <input
                        type="text"
                        placeholder="e.g. 123456789-abc.apps.googleusercontent.com"
                        value={ytClientId}
                        onChange={(e) => setYtClientId(e.target.value)}
                        className="w-full rounded border border-[#172A4A] bg-[#0A1224] px-2.5 py-1.5 text-xs text-white placeholder-gray-600 focus:border-red-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-0.5">Client Secret</label>
                        <input
                          type="password"
                          placeholder="GOCSPX-..."
                          value={ytClientSecret}
                          onChange={(e) => setYtClientSecret(e.target.value)}
                          className="w-full rounded border border-[#172A4A] bg-[#0A1224] px-2.5 py-1.5 text-xs text-white placeholder-gray-600 focus:border-red-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-gray-400 block mb-0.5">OAuth Refresh Token</label>
                        <input
                          type="password"
                          placeholder="1//04..."
                          value={ytRefreshToken}
                          onChange={(e) => setYtRefreshToken(e.target.value)}
                          className="w-full rounded border border-[#172A4A] bg-[#0A1224] px-2.5 py-1.5 text-xs text-white placeholder-gray-600 focus:border-red-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className="text-gray-300 text-[11px] flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ytAutoPublish}
                          onChange={(e) => setYtAutoPublish(e.target.checked)}
                          className="rounded border-[#172A4A] bg-[#070D18] text-red-600 focus:ring-0 cursor-pointer"
                        />
                        <span>Auto-Publish Shorts to YouTube upon generation</span>
                      </label>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400">Privacy:</span>
                        <select
                          value={ytPrivacy}
                          onChange={(e) => setYtPrivacy(e.target.value as any)}
                          className="rounded border border-[#172A4A] bg-[#0A1224] px-2 py-1 text-[10px] text-white focus:outline-none"
                        >
                          <option value="public">Public</option>
                          <option value="unlisted">Unlisted</option>
                          <option value="private">Private</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-[#172A4A]/60">
                      <a
                        href="/api/v1/youtube/oauth-guide"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 underline"
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                        OAuth 2.0 Setup Guide
                      </a>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleTestYt}
                          disabled={isTestingYt}
                          className="rounded border border-[#172A4A] bg-[#0A1224] hover:bg-[#111E3A] text-gray-200 px-3 py-1.5 text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isTestingYt ? "Testing..." : "Test Connection"}
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveYtConfig}
                          disabled={isSavingYt}
                          className="rounded bg-red-600 hover:bg-red-500 text-white px-3.5 py-1.5 text-[11px] font-bold transition-all cursor-pointer shadow-sm shadow-red-600/30 disabled:opacity-50"
                        >
                          {isSavingYt ? "Saving..." : "Save API Keys"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Thinking Orb Visualizer */}
            {settingsTab === "orb" && (
              <div className="space-y-3 animate-fadeIn">
                <div className="p-3 rounded-lg border border-[#172A4A] bg-[#070D18] space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white">Thinking Orb Visualizer Mode</p>
                      <p className="text-[10px] text-gray-400">Auto Sync dynamically reacts to listening, thinking, & speaking</p>
                    </div>
                    <span className="rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 text-[10px] font-bold">
                      {orbMode === "auto" ? "AUTO SYNC (DEFAULT)" : orbMode.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                    {ALL_ORB_STATES.map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          setOrbMode(st.id);
                          localStorage.setItem("soundwave_orb_mode", st.id);
                          toast.info("Orb Mode Set", `${st.label} mode active.`);
                        }}
                        className={`rounded-lg px-2.5 py-2 text-left text-[11px] font-mono transition-all border cursor-pointer ${
                          orbMode === st.id
                            ? "border-cyan-400 bg-cyan-500/20 text-cyan-200 font-bold shadow-sm shadow-cyan-500/30"
                            : "border-[#14233D] bg-[#0A1224] text-gray-400 hover:text-white hover:border-[#1F3660]"
                        }`}
                      >
                        <div className="font-semibold">{st.label}</div>
                        <div className="text-[9px] text-gray-500 truncate">{st.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── 6. MODAL: ORBITAL NCG BACKGROUND HISTORY ──────────────────── */}
      {orbitalHistoryOpen && (
        <Modal
          open={orbitalHistoryOpen}
          onClose={() => setOrbitalHistoryOpen(false)}
          title="Orbital NCG Background History"
          size="xl"
          footer={
            <div className="flex w-full items-center justify-between gap-2 font-mono text-xs">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetOrbital}
                loading={isResettingOrbital}
                disabled={!orbitalStatus || (orbitalStatus.usedCount === 0 && orbitalStatus.skippedCount === 0)}
                icon={<Trash2 className="h-3.5 w-3.5" />}
              >
                Reset History
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshOrbital}
                  loading={isRefreshingOrbital}
                  icon={<RefreshCw className="h-3.5 w-3.5" />}
                >
                  Re-check Channel
                </Button>
                <Button variant="primary" size="sm" onClick={() => setOrbitalHistoryOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-3 font-mono text-xs">
            <p className="text-[11px] text-gray-400 leading-normal">
              Every short uses a video from{" "}
              <a href={ORBITAL_CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline hover:text-cyan-200">
                youtube.com/@OrbitalNCG
              </a>{" "}
              that was never used before. The agent pastes its link into the YouTube link importer and imports just the stretch of gameplay the short needs. A video counts as used once a short has been rendered from it.
            </p>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-[#14233D] bg-[#070D18] p-2">
                <span className="text-[10px] text-gray-400 block">On channel</span>
                <span className="text-sm font-bold text-white">{orbitalStatus?.catalogSize ?? "—"}</span>
              </div>
              <div className="rounded-lg border border-[#14233D] bg-[#070D18] p-2">
                <span className="text-[10px] text-gray-400 block">Not used yet</span>
                <span className="text-sm font-bold text-cyan-300">{orbitalStatus?.available ?? "—"}</span>
              </div>
              <div className="rounded-lg border border-[#14233D] bg-[#070D18] p-2">
                <span className="text-[10px] text-gray-400 block">Used</span>
                <span className="text-sm font-bold text-emerald-400">{orbitalStatus?.usedCount ?? 0}</span>
              </div>
            </div>
            {orbitalStatus?.catalogFetchedAt && (
              <p className="text-[10px] text-gray-500">
                Channel last checked {new Date(orbitalStatus.catalogFetchedAt).toLocaleString()}
              </p>
            )}

            <div className="space-y-1.5">
              <h4 className="text-[11px] font-bold text-gray-200">Used videos ({orbitalStatus?.usedCount ?? 0})</h4>
              {!orbitalStatus || orbitalStatus.used.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#14233D] bg-[#070D18] p-3 text-center text-[11px] text-gray-500">
                  No Orbital videos used yet. Generate a short and its background video will show up here.
                </p>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                  {orbitalStatus.used.map((u) => (
                    <div key={u.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#14233D] bg-[#070D18] px-2.5 py-1.5">
                      <div className="min-w-0">
                        <span className="block truncate text-[11px] text-white" title={u.title}>
                          {u.title}
                        </span>
                        <span className="block truncate text-[10px] text-gray-500">
                          {new Date(u.usedAt).toLocaleString()} · {describeSection(u.section)}
                          {u.topic ? ` · "${u.topic}"` : ""}
                        </span>
                      </div>
                      <a
                        href={u.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex shrink-0 items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                        title={u.url}
                      >
                        <ExternalLink className="h-3 w-3" />
                        YouTube
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {orbitalStatus && orbitalStatus.skipped.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-bold text-amber-300">Skipped: couldn't be imported ({orbitalStatus.skipped.length})</h4>
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {orbitalStatus.skipped.map((sk) => (
                    <div key={sk.id} className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/20 bg-[#070D18] px-2.5 py-1.5">
                      <div className="min-w-0">
                        <span className="block truncate text-[11px] text-white" title={sk.title}>
                          {sk.title}
                        </span>
                        <span className="block truncate text-[10px] text-amber-200/70" title={sk.reason}>
                          {sk.reason}
                        </span>
                      </div>
                      <a
                        href={sk.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex shrink-0 items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                      >
                        <ExternalLink className="h-3 w-3" />
                        YouTube
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
