import { useState, useEffect, useRef } from "react";
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
  Check,
} from "lucide-react";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { toast } from "../store/toast";
import { ThinkingOrbVisualizer, ALL_ORB_STATES } from "../components/agent/ThinkingOrbVisualizer";
import type { OrbState } from "thinking-orbs";

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

interface ChatMessage {
  id: string;
  sender: "user" | "assistant" | "system";
  text: string;
  actionOutput?: string;
  time: string;
  tag?: "SYS" | "RPA" | "VOICE" | "USER" | "AUDIO";
  videoUrl?: string;
  downloadUrl?: string;
  youtubeUrl?: string;
  youtubeTitle?: string;
}

export interface YouTubeConfigState {
  connected: boolean;
  channelTitle?: string;
  autoPostEnabled: boolean;
  defaultPrivacy: "public" | "unlisted" | "private";
  hasClientId: boolean;
  hasRefreshToken: boolean;
}

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
  const [isMicActive, setIsMicActive] = useState(false);
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

  // Background Gameplay 60s Pool Telemetry
  const [poolStatus, setPoolStatus] = useState<{
    clipsRemaining: number;
    clipNames: string[];
    usedUrlsCount: number;
    usedUrls: string[];
    customUrlsCount: number;
    totalClipsConsumed: number;
    totalClipsGenerated: number;
    lastReplenishedAt: string | null;
    isProcessing: boolean;
  }>({
    clipsRemaining: 0,
    clipNames: [],
    usedUrlsCount: 0,
    usedUrls: [],
    customUrlsCount: 0,
    totalClipsConsumed: 0,
    totalClipsGenerated: 0,
    lastReplenishedAt: null,
    isProcessing: false,
  });
  const [customPoolUrl, setCustomPoolUrl] = useState("");
  const [isReplenishingPool, setIsReplenishingPool] = useState(false);

  // Orb Visualizer Mode State (persisted)
  const [orbMode, setOrbMode] = useState<OrbState | "auto">(() => {
    return (localStorage.getItem("soundwave_orb_mode") as any) || "auto";
  });

  // Chat conversation stream
  const [userPrompt, setUserPrompt] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem("soundwave_agent_chat_history");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        id: "init",
        sender: "assistant",
        text: "Hello, I am Soundwave. Neural acoustic core online, 16 desktop controls loaded, and Ghost Operator RPA standby. How can I assist you today, creator?",
        time: "2:45 PM",
        tag: "VOICE",
      },
    ];
  });

  // Modals & Tools
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [generatorModalOpen, setGeneratorModalOpen] = useState(false);
  const [macrosModalOpen, setMacrosModalOpen] = useState(false);

  // Shorts Generator State
  const [selectedNiche, setSelectedNiche] = useState<string>("psychology");
  const [customTopic, setCustomTopic] = useState("");
  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("soundwave_voice") || "en-US-GuyNeural";
    }
    return "en-US-GuyNeural";
  });

  const handleVoiceChange = (v: string) => {
    setSelectedVoice(v);
    if (typeof window !== "undefined") {
      localStorage.setItem("soundwave_voice", v);
    }
  };

  const [resolution, setResolution] = useState<"720p" | "1080p">("720p");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentStep, setCurrentStep] = useState("Ready");
  const [generatedScript, setGeneratedScript] = useState<string>("");
  const [completedVideoUrl, setCompletedVideoUrl] = useState<string | null>(null);

  // YouTube Channel & Publishing State
  const [ytConfig, setYtConfig] = useState<YouTubeConfigState>({
    connected: false,
    channelTitle: undefined,
    autoPostEnabled: false,
    defaultPrivacy: "public",
    hasClientId: false,
    hasRefreshToken: false,
  });
  const [ytClientIdInput, setYtClientIdInput] = useState("");
  const [ytClientSecretInput, setYtClientSecretInput] = useState("");
  const [ytRefreshTokenInput, setYtRefreshTokenInput] = useState("");
  const [isSavingYt, setIsSavingYt] = useState(false);
  const [isPublishingYt, setIsPublishingYt] = useState(false);
  const [latestYtVideo, setLatestYtVideo] = useState<{
    videoId: string;
    videoUrl: string;
    title: string;
  } | null>(null);

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
  const [voiceFeedback, setVoiceFeedback] = useState(true);

  // Refs
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Save chat to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("soundwave_agent_chat_history", JSON.stringify(chatMessages.slice(-60)));
    } catch {}
  }, [chatMessages]);

  // Load macros & restore recent generated video
  useEffect(() => {
    fetch("/api/v1/ghost/macros")
      .then((r) => (r.ok ? r.json() : { macros: [] }))
      .then((d) => setMacrosList(d.macros || []))
      .catch(() => {});

    fetch("/api/v1/export/jobs")
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((d) => {
        const jobs = d.jobs || [];
        const completed = jobs.filter((j: any) => j.status === "COMPLETED");
        if (completed.length > 0) {
          const latest = completed[0];
          const dlUrl = latest.outputUrl || `/api/v1/export/jobs/${latest.id}/download`;
          setCompletedVideoUrl(dlUrl);
        }
      })
      .catch(() => {});

    // Initial background pool status
    fetchPoolStatus();

    // Initial YouTube connection status
    fetchYouTubeConfig();
  }, []);

  const fetchYouTubeConfig = async () => {
    try {
      const res = await fetch("/api/v1/youtube/status");
      if (res.ok) {
        const data = await res.json();
        setYtConfig(data);
      }
    } catch (e) {
      console.warn("Failed to fetch YouTube status:", e);
    }
  };

  const handleToggleAutoPost = async (enabled: boolean) => {
    try {
      const res = await fetch("/api/v1/youtube/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoPostEnabled: enabled }),
      });
      const data = await res.json();
      if (res.ok && data.config) {
        setYtConfig(data.config);
        toast.success(
          enabled ? "YouTube Auto-Post Enabled" : "YouTube Auto-Post Disabled",
          enabled ? "Rendered shorts will automatically publish to YouTube." : "Manual publishing active."
        );
      }
    } catch (err: any) {
      toast.error("Config Error", err.message);
    }
  };

  const handleConnectYouTubeOAuth = async () => {
    try {
      const res = await fetch("/api/v1/youtube/auth-url");
      const data = await res.json();
      if (res.ok && data.url) {
        window.open(data.url, "_blank", "width=600,height=700");
        toast.info("Google Authorization", "Complete sign-in in the popup window.");
      } else {
        toast.error("OAuth Notice", data.message || "Please provide Google Client ID and Secret in settings.");
      }
    } catch (err: any) {
      toast.error("OAuth Error", err.message);
    }
  };

  const handleSaveYouTubeCredentials = async () => {
    setIsSavingYt(true);
    try {
      const body: any = {};
      if (ytClientIdInput.trim()) body.clientId = ytClientIdInput.trim();
      if (ytClientSecretInput.trim()) body.clientSecret = ytClientSecretInput.trim();
      if (ytRefreshTokenInput.trim()) body.refreshToken = ytRefreshTokenInput.trim();
      body.defaultPrivacy = ytConfig.defaultPrivacy;
      body.autoPostEnabled = ytConfig.autoPostEnabled;

      const res = await fetch("/api/v1/youtube/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.config) {
        setYtConfig(data.config);
        toast.success("YouTube Configuration Saved", "Credentials recorded successfully.");
      } else {
        throw new Error(data.message || "Failed to save configuration");
      }
    } catch (err: any) {
      toast.error("Config Error", err.message);
    } finally {
      setIsSavingYt(false);
    }
  };

  const handleDisconnectYouTube = async () => {
    try {
      const res = await fetch("/api/v1/youtube/disconnect", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.config) {
        setYtConfig(data.config);
        setLatestYtVideo(null);
        toast.info("YouTube Disconnected", "Channel unlinked.");
      }
    } catch (err: any) {
      toast.error("Disconnect Error", err.message);
    }
  };

  const handlePublishToYouTube = async (targetVideoUrl?: string, customTitle?: string) => {
    const vid = targetVideoUrl || completedVideoUrl;
    if (!vid) {
      toast.error("No Video Found", "Please generate or select a video first.");
      return;
    }
    if (!ytConfig.connected) {
      toast.error("YouTube Not Connected", "Connect your YouTube channel in Settings first.");
      setSettingsOpen(true);
      return;
    }
    setIsPublishingYt(true);
    try {
      const defaultTitle = `${customTopic || selectedNiche || "Mind-Blowing Truth"} #shorts #facts`.slice(0, 100);
      const title = customTitle || defaultTitle;
      const res = await fetch("/api/v1/youtube/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: vid,
          title,
          description: `${generatedScript || "Viral short rendered with Soundwave AI"}\n\n#shorts #minecraftparkour #facts #viral`,
          privacy: ytConfig.defaultPrivacy || "public",
          tags: ["shorts", "minecraft", "parkour", "ai", "soundwave", "facts"],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Publishing to YouTube failed");

      setLatestYtVideo({
        videoId: data.videoId,
        videoUrl: data.videoUrl,
        title: data.title,
      });
      toast.success("Short Published to YouTube!", `Available at: ${data.videoUrl}`);
    } catch (err: any) {
      toast.error("YouTube Publish Error", err.message || "Failed to publish");
    } finally {
      setIsPublishingYt(false);
    }
  };

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

  // Speech Output Helper (Neural Edge TTS 24kHz + Natural Speech Fallback)
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const browserVoicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const updateVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        browserVoicesRef.current = v;
      }
    };
    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
  }, []);

  const fallbackNaturalBrowser = (cleanText: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setAssistantState("STANDBY");
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(cleanText);
      const voices =
        browserVoicesRef.current.length > 0
          ? browserVoicesRef.current
          : window.speechSynthesis.getVoices();

      const isMale =
        selectedVoice.includes("Guy") ||
        selectedVoice.includes("Christopher") ||
        selectedVoice.includes("Ryan");

      // Prioritize high-definition natural neural voices matching requested gender
      const naturalVoice = isMale
        ? voices.find(
            (v) =>
              (v.name.includes("Guy") ||
                v.name.includes("Christopher") ||
                v.name.includes("Ryan") ||
                v.name.includes("George") ||
                v.name.includes("Male") ||
                v.name.includes("Daniel") ||
                v.name.includes("David")) &&
              v.lang.startsWith("en")
          ) ||
          voices.find((v) => v.name.includes("Online (Natural)") && v.lang.startsWith("en")) ||
          voices.find((v) => v.lang.startsWith("en"))
        : voices.find(
            (v) =>
              (v.name.includes("Jenny") ||
                v.name.includes("Aria") ||
                v.name.includes("Sonia") ||
                v.name.includes("Female") ||
                v.name.includes("Samantha") ||
                v.name.includes("Karen") ||
                v.name.includes("Zira")) &&
              v.lang.startsWith("en")
          ) ||
          voices.find((v) => v.name.includes("Online (Natural)") && v.lang.startsWith("en")) ||
          voices.find((v) => v.lang.startsWith("en"));

      if (naturalVoice) {
        utter.voice = naturalVoice;
      }
      utter.rate = 1.0;
      utter.pitch = 1.0;
      utter.onstart = () => setAssistantState("SPEAKING");
      utter.onend = () => setAssistantState("STANDBY");
      utter.onerror = () => setAssistantState("STANDBY");
      window.speechSynthesis.speak(utter);
    } catch {
      setAssistantState("STANDBY");
    }
  };

  const speakText = (text: string) => {
    if (!voiceFeedback || typeof window === "undefined") return;
    const clean = text.replace(/[*_#`\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 320);
    if (!clean) return;

    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }

    setAssistantState("THINKING");

    fetch("/api/v1/agent/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: clean,
        voice: selectedVoice || "en-US-GuyNeural",
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.audioBase64) {
          const snd = new Audio(`data:${data.mimeType || "audio/mpeg"};base64,${data.audioBase64}`);
          activeAudioRef.current = snd;
          snd.onplay = () => setAssistantState("SPEAKING");
          snd.onended = () => setAssistantState("STANDBY");
          snd.onerror = () => fallbackNaturalBrowser(clean);
          snd.play().catch(() => fallbackNaturalBrowser(clean));
        } else {
          fallbackNaturalBrowser(clean);
        }
      })
      .catch(() => {
        fallbackNaturalBrowser(clean);
      });
  };

  // Scroll to bottom of conversation
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Format seconds to HH:MM:SS
  const formatUptime = (secs: number) => {
    const h = String(Math.floor(secs / 3600)).padStart(2, "0");
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
    const s = String(secs % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  // ── Conversation Dispatcher ─────────────────────────────────────────────
  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPrompt.trim()) return;

    const query = userPrompt.trim();
    setUserPrompt("");
    setCommandsCount((c) => c + 1);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: query,
      time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setAssistantState("THINKING");

    try {
      const historyContext = chatMessages.slice(-6).map((m) => ({
        sender: m.sender,
        text: m.text,
      }));

      const res = await fetch("/api/v1/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          prompt: query,
          history: historyContext,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const videoLink = data.videoUrl || data.downloadUrl;
        const aiMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: "assistant",
          text: data.reply || "Command executed.",
          actionOutput: data.actionOutput,
          videoUrl: videoLink,
          downloadUrl: videoLink,
          time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
          tag: data.tag || (data.action === "ghost_macro" ? "RPA" : "VOICE"),
        };
        if (videoLink) {
          setCompletedVideoUrl(videoLink);
        }
        setChatMessages((prev) => [...prev, aiMsg]);
        speakText(aiMsg.text);
      } else {
        const fallbackMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: "assistant",
          text: `Processed command: "${query}". Neural dispatch complete.`,
          time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
          tag: "VOICE",
        };
        setChatMessages((prev) => [...prev, fallbackMsg]);
        speakText(fallbackMsg.text);
      }
    } catch {
      const fallbackMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        text: `Command "${query}" logged into buffer.`,
        time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
        tag: "VOICE",
      };
      setChatMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setAssistantState("STANDBY");
    }
  };

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

  // ── Background Gameplay Pool Handlers ──────────────────────────────────
  const fetchPoolStatus = async () => {
    try {
      const res = await fetch("/api/v1/agent/background-pool");
      if (res.ok) {
        const data = await res.json();
        setPoolStatus(data);
      }
    } catch {}
  };

  const handleReplenishPool = async (url?: string) => {
    setIsReplenishingPool(true);
    toast.info("Replenishing Pool", "Downloading & slicing new long Minecraft video...");
    try {
      const res = await fetch("/api/v1/agent/background-pool/replenish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {}
      if (res.ok && data.status) {
        setPoolStatus(data.status);
        toast.success("Pool Updated", `${data.status.clipsRemaining} 60s clips ready in pool.`);
        if (url) setCustomPoolUrl("");
      } else {
        toast.error("Pool replenishment", data.error || "Replenishment failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to replenish pool");
    } finally {
      setIsReplenishingPool(false);
    }
  };

  // ── 1-Click Viral Short Generator ───────────────────────────────────────
  const handleGenerateShort = async () => {
    if (isGenerating) return;

    try {
      setIsGenerating(true);
      setCompletedVideoUrl(null);
      setProgressPercent(8);
      setAssistantState("GENERATING");
      setCurrentStep("Initiating generation...");

      const payload = {
        topic: customTopic.trim() || selectedNiche,
        voice: selectedVoice,
        resolution,
        useDefaultBackground: true,
        async: true,
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

      // Track REAL progress from FFmpeg and generation stages
      await new Promise<void>((resolve, reject) => {
        let isDone = false;
        let eventSource: EventSource | null = null;
        let pollTimer: any = null;

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

          if (resultData.script) setGeneratedScript(resultData.script);
          setCompletedVideoUrl(finalVideoUrl);

          let ytLink: string | undefined;
          let ytTitle: string | undefined;
          if (resultData.youtube && resultData.youtube.status === "PUBLISHED" && resultData.youtube.videoUrl) {
            ytLink = resultData.youtube.videoUrl;
            ytTitle = resultData.youtube.title;
            setLatestYtVideo({
              videoId: resultData.youtube.videoId,
              videoUrl: resultData.youtube.videoUrl,
              title: resultData.youtube.title,
            });
            toast.success("YouTube Short Auto-Posted!", "Live on YouTube Shorts.");
          }

          const successNotice: ChatMessage = {
            id: Date.now().toString(),
            sender: "assistant",
            text: ytLink
              ? `Rendered viral short for "${payload.topic}" (${resolution} 60fps) and auto-published directly to YouTube Shorts!`
              : `Rendered viral short for "${payload.topic}" (${resolution} 60fps). Your video is ready to preview, download, or post to YouTube!`,
            time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
            tag: "AUDIO",
            videoUrl: finalVideoUrl,
            downloadUrl: finalVideoUrl,
            youtubeUrl: ytLink,
            youtubeTitle: ytTitle,
          };
          setChatMessages((prev) => [...prev, successNotice]);
          speakText("Your video has finished rendering and is ready!");
          toast.success("Video Ready", "Short generated successfully.");
          resolve();
        };

        const finishFail = (errMessage: string) => {
          if (isDone) return;
          cleanup();
          reject(new Error(errMessage));
        };

        // 1. Real-time EventSource SSE listener
        try {
          eventSource = new EventSource(`/api/v1/export/jobs/${jobId}/events`);
          eventSource.onmessage = (e) => {
            try {
              const msg = JSON.parse(e.data);
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

        // 2. High-frequency 350ms Polling fallback
        pollTimer = setInterval(async () => {
          if (isDone) return;
          try {
            const pollRes = await fetch(`/api/v1/export/jobs/${jobId}`);
            if (pollRes.ok) {
              const pollData = await pollRes.json();
              const j = pollData.job;
              if (j) {
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
        }, 350);

        // Safety timeout
        setTimeout(() => {
          if (!isDone) {
            finishFail("Generation timed out");
          }
        }, 180_000);
      });
    } catch (err: any) {
      toast.error("Generation Error", err.message);
      setAssistantState("STANDBY");
      setProgressPercent(0);
    } finally {
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
    <div className="flex flex-col min-h-screen bg-[#070B14] text-gray-100 select-none font-sans p-3 sm:p-5 space-y-4">
      {/* ── 1. TOP HUD STATUS BAR ─────────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 rounded-xl border border-[#14233D] bg-[#0A1224]/80 backdrop-blur-md">
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
          <span className="text-gray-500">|</span>
          <span className="text-gray-300">{currentDateStr || "September 20, 2026"}</span>
        </div>

        {/* Right: Voice Capsule, Background Pool Capsule & Settings Gear Button */}
        <div className="flex items-center gap-2">
          {/* Quick Male Voice Selector Capsule */}
          <div className="flex items-center gap-1.5 rounded-full border border-[#172A4A] bg-[#0C172E] px-2.5 py-1 text-xs text-gray-300 font-mono">
            <Volume2 className="h-3.5 w-3.5 text-cyan-400" />
            <select
              value={selectedVoice}
              onChange={(e) => handleVoiceChange(e.target.value)}
              className="bg-transparent text-cyan-400 font-semibold focus:outline-none cursor-pointer text-xs"
              title="Select Assistant Voice"
            >
              <option value="en-US-ChristopherNeural" className="bg-[#0A1224] text-white">Christopher (US Male - Studio)</option>
              <option value="en-US-GuyNeural" className="bg-[#0A1224] text-white">Guy (US Male - Deep)</option>
              <option value="en-US-EricNeural" className="bg-[#0A1224] text-white">Eric (US Male - Narrator)</option>
              <option value="en-GB-RyanNeural" className="bg-[#0A1224] text-white">Ryan (UK Male - British)</option>
              <option value="en-US-AndrewNeural" className="bg-[#0A1224] text-white">Andrew (US Male - Warm)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-[#172A4A] bg-[#0C172E] px-3 py-1 text-xs text-gray-300 font-mono">
            <Film className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-white font-semibold">{poolStatus.clipsRemaining}</span>
            <span className="hidden sm:inline text-gray-400">clips in pool</span>
          </div>

          {/* YouTube Status Capsule */}
          <div
            onClick={() => setSettingsOpen(true)}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-mono cursor-pointer transition-colors ${
              ytConfig.connected
                ? "border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                : "border-[#172A4A] bg-[#0C172E] text-gray-400 hover:text-white"
            }`}
            title={ytConfig.connected ? `YouTube: Connected (${ytConfig.channelTitle || "Channel"})` : "Click to configure YouTube API"}
          >
            <Youtube className={`h-3.5 w-3.5 ${ytConfig.connected ? "text-red-500" : "text-gray-500"}`} />
            <span className="hidden sm:inline">
              {ytConfig.connected ? (ytConfig.autoPostEnabled ? "Auto-Post ON" : "YouTube Linked") : "YouTube: Off"}
            </span>
          </div>

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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        {/* ── LEFT COLUMN: SYSTEM TELEMETRY & WIDGETS (3.5 cols) ──────── */}
        <div className="lg:col-span-3 space-y-3 flex flex-col justify-between">
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
                <span className="text-xs font-bold text-white">{stats.diskUsedGB}/{stats.diskTotalGB} GB</span>
              </div>
            </div>
          </div>

          {/* Card 2: Minecraft Parkour 60s Background Pool */}
          <div className="rounded-xl border border-[#14233D] bg-[#0A1224] p-3.5 space-y-2.5 font-mono">
            <div className="flex items-center justify-between border-b border-[#14233D] pb-1.5 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-gray-200">
                <Film className="h-3.5 w-3.5 text-cyan-400" />
                Background Gameplay Pool
              </span>
              <button
                onClick={fetchPoolStatus}
                className="text-gray-400 hover:text-cyan-400 transition-colors"
                title="Refresh pool status"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-2xl font-bold text-white tracking-tight">{poolStatus.clipsRemaining}</span>
                <span className="text-xs text-gray-400 ml-1.5">clips ready</span>
                <p className="text-[11px] text-cyan-400/90 mt-0.5">60s clips · Auto-rotates & deletes on use</p>
              </div>
              <div className="text-right">
                <span className="rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold block">
                  {poolStatus.usedUrlsCount} LONG VIDEOS
                </span>
                <span className="text-[9px] text-gray-400 mt-1 block">Zero duplicates</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-center">
              <div className="rounded-lg border border-[#14233D] bg-[#070D18] p-1.5">
                <span className="text-[10px] text-gray-400 block">Consumed</span>
                <span className="text-xs font-bold text-white">{poolStatus.totalClipsConsumed}</span>
              </div>
              <div className="rounded-lg border border-[#14233D] bg-[#070D18] p-1.5">
                <span className="text-[10px] text-gray-400 block">Unique Sources</span>
                <span className="text-xs font-bold text-white">{poolStatus.usedUrlsCount}</span>
              </div>
            </div>

            {/* Quick URL Adder & Replenish */}
            <div className="pt-1 space-y-2">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Paste YouTube parkour URL..."
                  value={customPoolUrl}
                  onChange={(e) => setCustomPoolUrl(e.target.value)}
                  className="flex-1 rounded-lg border border-[#14233D] bg-[#070D18] px-2.5 py-1 text-[11px] text-white placeholder-gray-500 focus:border-cyan-400 focus:outline-none"
                />
                <button
                  onClick={() => handleReplenishPool(customPoolUrl || undefined)}
                  disabled={isReplenishingPool}
                  className="rounded-lg bg-cyan-500/20 border border-cyan-500/40 hover:bg-cyan-500 hover:text-[#070B14] text-cyan-300 px-2.5 py-1 text-[11px] font-bold transition-all disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                  title="Download and slice a new 60s clip pool"
                >
                  <RefreshCw className={`h-3 w-3 ${isReplenishingPool ? "animate-spin" : ""}`} />
                  {isReplenishingPool ? "Slicing..." : "Replenish"}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 italic">
                *Clips are consumed and deleted 1-by-1. When empty, Soundwave auto-downloads a fresh unused video.
              </p>
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
              <div className="space-y-1.5 pt-1">
                <a
                  href={completedVideoUrl}
                  download="soundwave_viral_short.mp4"
                  className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-cyan-500 hover:bg-cyan-400 text-[#070B14] font-bold py-1.5 text-xs transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Short (MP4)
                </a>

                {ytConfig.connected ? (
                  <button
                    onClick={() => handlePublishToYouTube()}
                    disabled={isPublishingYt}
                    className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold py-1.5 text-xs transition-all shadow-md shadow-red-950/40 cursor-pointer disabled:opacity-50"
                  >
                    <Youtube className="h-3.5 w-3.5" />
                    {isPublishingYt ? "Uploading to YouTube..." : "Post to YouTube Shorts"}
                  </button>
                ) : (
                  <button
                    onClick={() => setSettingsOpen(true)}
                    className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300 font-bold py-1.5 text-xs transition-all cursor-pointer"
                  >
                    <Youtube className="h-3.5 w-3.5 text-red-400" />
                    Connect YouTube to 1-Click Post
                  </button>
                )}

                {latestYtVideo && (
                  <a
                    href={latestYtVideo.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-bold py-1 text-[11px] transition-all"
                  >
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span>View on YouTube Shorts</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
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

        {/* ── CENTER COLUMN: ARC REACTOR ORB & DOCK (5.5 cols) ────────── */}
        <div className="lg:col-span-5 flex flex-col items-center justify-between py-6 px-4">
          <div className="flex-1 flex flex-col items-center justify-center w-full">
            {/* Jakubantalik Thinking Orb Visualizer (9 Hand-Tuned Cognitive States) */}
            <ThinkingOrbVisualizer
              assistantState={assistantState}
              isMicActive={isMicActive}
              size={280}
              orbMode={orbMode}
              className="my-3"
              onOrbClick={() => {
                if (assistantState === "STANDBY") {
                  setIsMicActive(!isMicActive);
                }
              }}
            />

            {/* Assistant Name Label */}
            <h2 className="text-lg font-bold tracking-[0.25em] text-white font-mono mt-1">
              {assistantName}
            </h2>

            {/* Dynamic Status Capsule */}
            <div className="mt-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#172A4A] bg-[#0C172E] px-4 py-1 text-xs text-gray-300 font-mono shadow-inner">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                {assistantState === "LISTENING" || isMicActive
                  ? "Listening to voice input..."
                  : assistantState === "THINKING"
                  ? "Neural processing..."
                  : assistantState === "SPEAKING"
                  ? "Synthesizing voice response..."
                  : assistantState === "GENERATING"
                  ? `Rendering short (${progressPercent}%)...`
                  : "Listening for wake word..."}
              </span>
            </div>
          </div>

          {/* Bottom Dock Control Buttons (Shorts, Mic, Automation, Settings) */}
          <div className="flex items-center gap-3 mt-8">
            <button
              onClick={() => setGeneratorModalOpen(true)}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#172A4A] bg-[#0C172E] text-cyan-400 hover:border-cyan-500/50 hover:text-white transition-all cursor-pointer shadow-md shadow-cyan-950/20"
              title="1-Click Viral Short Generator"
            >
              <Film className="h-5 w-5" />
            </button>

            <button
              onClick={() => {
                const next = !isMicActive;
                setIsMicActive(next);
                setAssistantState(next ? "LISTENING" : "STANDBY");
                if (next) {
                  toast.info("Microphone Engaged", "Listening for voice instructions...");
                } else {
                  toast.info("Microphone Standby", "Muted.");
                }
              }}
              className={`flex h-12 w-12 items-center justify-center rounded-xl border transition-all cursor-pointer ${
                isMicActive
                  ? "border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-lg shadow-emerald-500/25 animate-pulse"
                  : "border-[#172A4A] bg-[#0C172E] text-gray-300 hover:border-cyan-500/50 hover:text-white"
              }`}
              title={isMicActive ? "Mute Microphone" : "Push-to-Talk"}
            >
              {isMicActive ? <Mic className="h-5 w-5 text-emerald-400" /> : <MicOff className="h-5 w-5" />}
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
        <div className="lg:col-span-4 rounded-xl border border-[#14233D] bg-[#0A1224] p-4 flex flex-col h-[700px] justify-between font-mono">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#14233D] pb-3">
            <h3 className="text-sm font-semibold text-white">Conversation</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setChatMessages([
                    {
                      id: "init",
                      sender: "assistant",
                      text: "Conversation cleared. Ready for your next command.",
                      time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
                      tag: "SYS",
                    },
                  ]);
                  toast.info("Log Cleared", "Message buffer reset.");
                }}
                className="flex items-center gap-1 rounded-md border border-[#172A4A] bg-[#070D18] px-2 py-1 text-[11px] text-gray-400 hover:text-cyan-400 transition-colors"
                title="Clear conversation"
              >
                <Trash2 className="h-3 w-3" />
                <span>Clear</span>
              </button>

              <button
                onClick={handleExtractConversation}
                className="flex items-center gap-1 rounded-md border border-[#172A4A] bg-[#070D18] px-2 py-1 text-[11px] text-gray-400 hover:text-cyan-400 transition-colors"
                title="Extract and download conversation"
              >
                <Download className="h-3 w-3" />
                <span>Extract Conversation</span>
              </button>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1 text-xs">
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

                    <div className="flex flex-col gap-1.5 pt-1">
                      <div className="flex items-center gap-2">
                        <a
                          href={msg.downloadUrl || msg.videoUrl}
                          download="soundwave_viral_short.mp4"
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-[#070B14] font-bold py-1.5 px-3 text-xs transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download MP4
                        </a>

                        {ytConfig.connected ? (
                          <button
                            onClick={() => handlePublishToYouTube(msg.videoUrl || msg.downloadUrl)}
                            disabled={isPublishingYt}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold py-1.5 px-3 text-xs transition-all shadow-md shadow-red-950/40 cursor-pointer disabled:opacity-50"
                          >
                            <Youtube className="h-3.5 w-3.5" />
                            {isPublishingYt ? "Posting..." : "Post to YouTube"}
                          </button>
                        ) : (
                          <button
                            onClick={() => setSettingsOpen(true)}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300 font-bold py-1.5 px-2 text-xs transition-all cursor-pointer"
                          >
                            <Youtube className="h-3.5 w-3.5 text-red-400" />
                            YouTube API
                          </button>
                        )}
                      </div>

                      {Boolean(msg.youtubeUrl || latestYtVideo?.videoUrl) && (
                        <a
                          href={msg.youtubeUrl || latestYtVideo?.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-bold py-1 px-3 text-[11px] transition-all"
                        >
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span>Watch on YouTube Shorts</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] text-gray-500 mt-2 pt-1 border-t border-white/[0.04]">
                  <span className="uppercase text-[9px] font-bold tracking-wider text-cyan-400">
                    {msg.tag || (msg.sender === "user" ? "USER" : "AGENT")}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {msg.sender === "assistant" && (
                      <button
                        onClick={() => speakText(msg.text)}
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
            <div ref={chatEndRef} />
          </div>

          {/* Command Prompt Input Bar */}
          <div className="pt-2 border-t border-[#14233D] space-y-2">
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
                      if (!customTopic) setCustomTopic(n.name);
                    }}
                    className={`p-2 rounded-lg border text-left transition-all ${
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
                <label className="text-gray-300 font-semibold">Voice Talent</label>
                <select
                  value={selectedVoice}
                  onChange={(e) => handleVoiceChange(e.target.value)}
                  className="w-full rounded-lg border border-[#172A4A] bg-[#070D18] px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                >
                  <option value="en-US-ChristopherNeural">Christopher (en-US Male - Authority)</option>
                  <option value="en-US-GuyNeural">Guy (en-US Male - Deep & Natural)</option>
                  <option value="en-US-EricNeural">Eric (en-US Male - Dynamic Narrator)</option>
                  <option value="en-GB-RyanNeural">Ryan (en-GB Male - British Sophisticated)</option>
                  <option value="en-US-AndrewNeural">Andrew (en-US Male - Warm Storyteller)</option>
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

            {/* YouTube Auto-Post Option */}
            <div className="flex items-center justify-between rounded-lg border border-[#172A4A] bg-[#070D18] p-2.5">
              <div className="flex items-center gap-2">
                <Youtube className="h-4 w-4 text-red-500" />
                <div>
                  <span className="font-semibold text-gray-200 text-xs">Auto-Post to YouTube Shorts</span>
                  <p className="text-[10px] text-gray-500">
                    {ytConfig.connected
                      ? `Channel connected (${ytConfig.channelTitle || "Ready"}). Uploads automatically on render completion.`
                      : "Channel not connected. You can link your YouTube API in settings."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggleAutoPost(!ytConfig.autoPostEnabled)}
                className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                  ytConfig.autoPostEnabled
                    ? "bg-red-600 text-white shadow-sm shadow-red-600/30"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                {ytConfig.autoPostEnabled ? "ON" : "OFF"}
              </button>
            </div>

            {/* Background Footage Source Info */}
            <div className="rounded-lg border border-[#172A4A] bg-[#070D18] p-2.5 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-gray-300">Background Footage Source</span>
                <span className="text-cyan-400 font-bold">Auto-Scans Soundwave Pool & Cache</span>
              </div>
              <p className="text-[10px] text-gray-500 leading-normal">
                Soundwave auto-detects your local clips in <span className="text-cyan-400">background_cache</span>, <span className="text-cyan-400">clips</span>, or your <span className="text-cyan-400">Videos</span> folder. Any .mp4 clip placed in those folders will be sliced and used automatically.
              </p>
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
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                    <a
                      href={completedVideoUrl.includes("?") ? `${completedVideoUrl}&download=1` : `${completedVideoUrl}?download=1`}
                      download="soundwave_viral_short.mp4"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 text-[#070B14] px-4 py-1.5 text-xs font-bold hover:bg-cyan-400 transition-colors cursor-pointer shadow-md shadow-cyan-500/20"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download Short (MP4)
                    </a>

                    {ytConfig.connected ? (
                      <button
                        type="button"
                        onClick={() => handlePublishToYouTube()}
                        disabled={isPublishingYt}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 text-white px-4 py-1.5 text-xs font-bold hover:bg-red-500 transition-colors cursor-pointer shadow-md shadow-red-950/40 disabled:opacity-50"
                      >
                        <Youtube className="h-3.5 w-3.5" />
                        {isPublishingYt ? "Uploading..." : "Post to YouTube Shorts"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setGeneratorModalOpen(false);
                          setSettingsOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 px-3 py-1.5 text-xs font-bold hover:bg-red-500/20 transition-colors cursor-pointer"
                      >
                        <Youtube className="h-3.5 w-3.5 text-red-400" />
                        Connect YouTube
                      </button>
                    )}
                  </div>
                )}

                {latestYtVideo && (
                  <div className="pt-1 text-center">
                    <a
                      href={latestYtVideo.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 text-xs font-bold transition-colors"
                    >
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      Watch live on YouTube Shorts: {latestYtVideo.title}
                      <ExternalLink className="h-3 w-3" />
                    </a>
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
        >
          <div className="space-y-4 font-mono text-xs">
            <div className="space-y-1">
              <label className="text-gray-300 font-semibold">Assistant Name</label>
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
                  <p className="text-xs font-bold text-white">Neural Voice Talent</p>
                  <p className="text-[10px] text-gray-400">High-fidelity 24kHz Studio Speech Engine (Natural Male Pacing)</p>
                </div>
                <button
                  type="button"
                  onClick={() => speakText("Voice system operational. Natural neural synthesis online.")}
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
                <option value="en-US-ChristopherNeural">Christopher (en-US Male - Studio JARVIS)</option>
                <option value="en-US-GuyNeural">Guy (en-US Male - Deep & Natural)</option>
                <option value="en-US-EricNeural">Eric (en-US Male - Dynamic Narrator)</option>
                <option value="en-GB-RyanNeural">Ryan (en-GB Male - British Sophisticated)</option>
                <option value="en-US-AndrewNeural">Andrew (en-US Male - Warm Storyteller)</option>
              </select>
            </div>

            {/* Thinking Orb Visualizer Mode Selection */}
            <div className="space-y-2 p-3 rounded-lg border border-[#172A4A] bg-[#070D18]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Thinking Orb Visualizer Mode</p>
                  <p className="text-[10px] text-gray-400">Auto Sync dynamically reacts to listening, thinking, & speaking</p>
                </div>
                <span className="rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 text-[10px] font-bold">
                  {orbMode === "auto" ? "AUTO SYNC (DEFAULT)" : orbMode.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
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

            <div className="flex items-center justify-between p-2.5 rounded-lg border border-[#172A4A] bg-[#070D18]">
              <div>
                <p className="text-xs font-bold text-white">Voice Speech Synthesis</p>
                <p className="text-[10px] text-gray-400">Speak assistant replies aloud via browser speech audio</p>
              </div>
              <button
                type="button"
                onClick={() => setVoiceFeedback(!voiceFeedback)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold transition-colors ${
                  voiceFeedback ? "bg-cyan-500 text-[#070B14]" : "bg-gray-800 text-gray-400"
                }`}
              >
                {voiceFeedback ? "Enabled" : "Disabled"}
              </button>
            </div>

            {/* YouTube Shorts Publisher & API Automation */}
            <div className="space-y-3 p-3 rounded-lg border border-red-950/60 bg-[#0c0812]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Youtube className="h-4 w-4 text-red-500" />
                  <div>
                    <p className="text-xs font-bold text-white">YouTube Shorts Auto-Publisher</p>
                    <p className="text-[10px] text-gray-400">Google OAuth 2.0 & YouTube Data API v3 integration</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                      ytConfig.connected
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border-gray-700 bg-gray-900 text-gray-400"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${ytConfig.connected ? "bg-emerald-400 animate-pulse" : "bg-gray-500"}`} />
                    {ytConfig.connected ? (ytConfig.channelTitle || "Connected") : "Not Connected"}
                  </span>
                  {ytConfig.connected && (
                    <button
                      type="button"
                      onClick={handleDisconnectYouTube}
                      className="text-[10px] text-gray-400 hover:text-red-400 transition-colors"
                      title="Disconnect channel"
                    >
                      Unlink
                    </button>
                  )}
                </div>
              </div>

              {/* Auto-Post Switch & Default Privacy */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/[0.06]">
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-300 font-semibold">Auto-Publish to YouTube</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleAutoPost(!ytConfig.autoPostEnabled)}
                      className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                        ytConfig.autoPostEnabled
                          ? "bg-red-600 text-white shadow-md shadow-red-900/40"
                          : "bg-gray-800 text-gray-400"
                      }`}
                    >
                      {ytConfig.autoPostEnabled ? "Enabled" : "Disabled"}
                    </button>
                    <span className="text-[10px] text-gray-500">Auto-posts on render</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-gray-300 font-semibold">Default Privacy</label>
                  <select
                    value={ytConfig.defaultPrivacy}
                    onChange={(e) => {
                      const val = e.target.value as "public" | "unlisted" | "private";
                      setYtConfig((p) => ({ ...p, defaultPrivacy: val }));
                      fetch("/api/v1/youtube/config", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ defaultPrivacy: val }),
                      }).catch(() => {});
                    }}
                    className="w-full rounded-lg border border-[#172A4A] bg-[#070D18] px-2 py-1 text-xs text-white focus:border-red-500 focus:outline-none"
                  >
                    <option value="public">Public (Immediate Live)</option>
                    <option value="unlisted">Unlisted (Share Link)</option>
                    <option value="private">Private (Draft)</option>
                  </select>
                </div>
              </div>

              {/* OAuth Sign-In or API Token Setup */}
              <div className="space-y-2 pt-1 border-t border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-300">Google OAuth 2.0 Connection</span>
                  <button
                    type="button"
                    onClick={handleConnectYouTubeOAuth}
                    className="rounded-lg bg-red-600 hover:bg-red-500 text-white px-2.5 py-1 text-[11px] font-bold transition-all shadow-sm shadow-red-950/40 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Youtube className="h-3.5 w-3.5" />
                    Sign in with Google
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-1">
                  <input
                    type="text"
                    placeholder="Client ID (Optional)"
                    value={ytClientIdInput}
                    onChange={(e) => setYtClientIdInput(e.target.value)}
                    className="rounded border border-[#172A4A] bg-[#070D18] px-2 py-1 text-[11px] text-white placeholder-gray-600 focus:border-red-400 focus:outline-none"
                  />
                  <input
                    type="password"
                    placeholder="Client Secret (Optional)"
                    value={ytClientSecretInput}
                    onChange={(e) => setYtClientSecretInput(e.target.value)}
                    className="rounded border border-[#172A4A] bg-[#070D18] px-2 py-1 text-[11px] text-white placeholder-gray-600 focus:border-red-400 focus:outline-none"
                  />
                  <div className="flex gap-1">
                    <input
                      type="password"
                      placeholder="Refresh Token"
                      value={ytRefreshTokenInput}
                      onChange={(e) => setYtRefreshTokenInput(e.target.value)}
                      className="flex-1 rounded border border-[#172A4A] bg-[#070D18] px-2 py-1 text-[11px] text-white placeholder-gray-600 focus:border-red-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveYouTubeCredentials}
                      disabled={isSavingYt}
                      className="rounded bg-gray-800 hover:bg-gray-700 text-cyan-400 px-2 py-1 text-[10px] font-bold border border-gray-700 cursor-pointer disabled:opacity-50"
                    >
                      {isSavingYt ? "..." : "Save"}
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500">
                  Tip: Provide your Google Cloud OAuth Client ID & Secret or Refresh Token. Token refreshes automatically in the background.
                </p>
              </div>
            </div>

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

            <div className="pt-3 border-t border-[#172A4A] flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setSettingsOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
