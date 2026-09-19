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
  Camera, 
  Power, 
  Mic, 
  MicOff, 
  Activity, 
  CloudRain, 
  Trash2, 
  Workflow, 
  Compass, 
  TrendingUp, 
  Flame, 
  Eye, 
} from "lucide-react";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { toast } from "../store/toast";

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

  // Weather Telemetry
  const [weather] = useState({
    city: "Belgrade, RS",
    temp: 24.5,
    condition: "clear sky",
    humidity: 48,
    wind: "3.4 m/s",
    feelsLike: 25.1,
  });

  // Vision / Camera Stream State
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedSnapshot, setCapturedSnapshot] = useState<string | null>(null);

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
  const [selectedVoice, setSelectedVoice] = useState("en-US-JennyNeural");
  const [resolution, setResolution] = useState<"720p" | "1080p">("720p");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentStep, setCurrentStep] = useState("Ready");
  const [generatedScript, setGeneratedScript] = useState<string>("");
  const [completedVideoUrl, setCompletedVideoUrl] = useState<string | null>(null);

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const pointerOffset = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  // Save chat to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("soundwave_agent_chat_history", JSON.stringify(chatMessages.slice(-60)));
    } catch {}
  }, [chatMessages]);

  // Load macros
  useEffect(() => {
    fetch("/api/v1/ghost/macros")
      .then((r) => (r.ok ? r.json() : { macros: [] }))
      .then((d) => setMacrosList(d.macros || []))
      .catch(() => {});
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

  // Speech Output Helper
  const speakText = (text: string) => {
    if (!voiceFeedback || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const clean = text.replace(/[*_#`]/g, "").slice(0, 220);
      const utter = new SpeechSynthesisUtterance(clean);
      utter.rate = 1.05;
      utter.pitch = 1.0;
      utter.onstart = () => setAssistantState("SPEAKING");
      utter.onend = () => setAssistantState("STANDBY");
      window.speechSynthesis.speak(utter);
    } catch {}
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

  // ── Central Concentric Arc Reactor / Soundwave Orb ──────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;
      const active = isGenerating || assistantState !== "STANDBY" || isMicActive;

      pointerOffset.current.x += (pointerOffset.current.targetX - pointerOffset.current.x) * 0.08;
      pointerOffset.current.y += (pointerOffset.current.targetY - pointerOffset.current.y) * 0.08;

      const ox = pointerOffset.current.x;
      const oy = pointerOffset.current.y;

      let speedMult = 1.0;
      if (assistantState === "LISTENING" || isMicActive) speedMult = 1.8;
      else if (assistantState === "THINKING") speedMult = 2.6;
      else if (assistantState === "SPEAKING") speedMult = 2.0;
      else if (assistantState === "GENERATING") speedMult = 3.0;

      phase += 0.03 * speedMult;

      // 1. Ambient Background Cyan Core Glow
      const bgGrad = ctx.createRadialGradient(cx + ox * 0.3, cy + oy * 0.3, 10, cx, cy, 140);
      bgGrad.addColorStop(0, active ? "rgba(0, 240, 255, 0.25)" : "rgba(0, 240, 255, 0.1)");
      bgGrad.addColorStop(0.5, active ? "rgba(0, 180, 255, 0.08)" : "rgba(0, 180, 255, 0.03)");
      bgGrad.addColorStop(1, "rgba(8, 12, 20, 0)");
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, 140, 0, Math.PI * 2);
      ctx.fill();

      // 2. Outermost Concentric Faint Ring (R ~135)
      ctx.beginPath();
      ctx.arc(cx, cy, 132, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0, 240, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // 3. Concentric Ring 2 (R ~112) with subtle rotational ticks
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(phase * 0.15);
      ctx.beginPath();
      ctx.arc(0, 0, 110, 0, Math.PI * 2);
      ctx.strokeStyle = active ? "rgba(0, 240, 255, 0.3)" : "rgba(0, 240, 255, 0.14)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 16]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // 4. Concentric Ring 3 (R ~88) with 4 cardinal tick marks
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-phase * 0.2);
      ctx.beginPath();
      ctx.arc(0, 0, 86, 0, Math.PI * 2);
      ctx.strokeStyle = active ? "rgba(0, 240, 255, 0.5)" : "rgba(0, 240, 255, 0.25)";
      ctx.lineWidth = 1.4;
      ctx.stroke();

      for (let i = 0; i < 4; i++) {
        const ang = (i * Math.PI) / 2;
        const tx1 = Math.cos(ang) * 82;
        const ty1 = Math.sin(ang) * 82;
        const tx2 = Math.cos(ang) * 90;
        const ty2 = Math.sin(ang) * 90;
        ctx.beginPath();
        ctx.moveTo(tx1, ty1);
        ctx.lineTo(tx2, ty2);
        ctx.strokeStyle = "#00F0FF";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();

      // 5. Concentric Ring 4 (R ~66) - Glowing Cyan Orbit
      ctx.beginPath();
      ctx.arc(cx + ox * 0.2, cy + oy * 0.2, 66, 0, Math.PI * 2);
      ctx.strokeStyle = active ? "rgba(0, 240, 255, 0.8)" : "rgba(0, 240, 255, 0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // 6. Deep Dark Arc Core (R ~48)
      const coreGrad = ctx.createRadialGradient(cx + ox * 0.4, cy + oy * 0.4, 4, cx, cy, 48);
      coreGrad.addColorStop(0, "#081E36");
      coreGrad.addColorStop(0.7, "#051120");
      coreGrad.addColorStop(1, "#030A14");
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx + ox * 0.4, cy + oy * 0.4, 48, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0, 240, 255, 0.6)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // 7. Center Audio Visualizer EQ Bars (5 vertical glowing bars like screenshot)
      const barCount = 5;
      const barWidth = 4;
      const barGap = 4;
      const totalWidth = barCount * barWidth + (barCount - 1) * barGap;
      const startX = cx + ox * 0.4 - totalWidth / 2;

      for (let i = 0; i < barCount; i++) {
        const bx = startX + i * (barWidth + barGap);
        const barH = active
          ? Math.sin(phase * 2.5 + i * 1.2) * 14 + 18
          : Math.sin(phase + i * 0.8) * 4 + 8;
        const by = cy + oy * 0.4 - barH / 2;

        ctx.fillStyle = "#00F0FF";
        ctx.beginPath();
        ctx.roundRect(bx, by, barWidth, barH, 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [assistantState, isGenerating, isMicActive]);

  const handleOrbMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    pointerOffset.current.targetX = Math.max(-20, Math.min(20, x * 0.2));
    pointerOffset.current.targetY = Math.max(-20, Math.min(20, y * 0.2));
  };

  const handleOrbMouseLeave = () => {
    pointerOffset.current.targetX = 0;
    pointerOffset.current.targetY = 0;
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
        const aiMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: "assistant",
          text: data.reply || "Command executed.",
          actionOutput: data.actionOutput,
          time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
          tag: data.tag || (data.action === "ghost_macro" ? "RPA" : "VOICE"),
        };
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

  // ── Camera / Screen Capture Toggle ──────────────────────────────────────
  const toggleCamera = () => {
    if (cameraActive) {
      setCameraActive(false);
      toast.info("Vision Inactive", "Camera / Screen stream deactivated.");
    } else {
      setCameraActive(true);
      // Generate synthetic frame for HUD view
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 180;
      const c = canvas.getContext("2d");
      if (c) {
        c.fillStyle = "#0A1424";
        c.fillRect(0, 0, 320, 180);
        c.strokeStyle = "#00F0FF";
        c.strokeRect(10, 10, 300, 160);
        c.fillStyle = "#00F0FF";
        c.font = "bold 11px JetBrains Mono, monospace";
        c.fillText("OPTICAL FEED // ACTIVE", 24, 40);
        c.fillStyle = "#7E90A8";
        c.fillText(`FPS: 60 | RES: 1920x1080 | ${new Date().toLocaleTimeString()}`, 24, 70);
        c.fillText("VISION OCR READY", 24, 100);
      }
      setCapturedSnapshot(canvas.toDataURL());
      toast.success("Vision Active", "Display viewport initialized.");
    }
  };

  // ── 1-Click Viral Short Generator ───────────────────────────────────────
  const handleGenerateShort = async () => {
    if (isGenerating) return;

    try {
      setIsGenerating(true);
      setCompletedVideoUrl(null);
      setProgressPercent(15);
      setAssistantState("GENERATING");
      setCurrentStep("Synthesizing script & audio...");

      const payload = {
        topic: customTopic.trim() || selectedNiche,
        voice: selectedVoice,
        resolution,
        useDefaultBackground: true,
      };

      const res = await fetch("/api/v1/agent/generate-short", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      setProgressPercent(100);
      setCurrentStep("Completed");
      setAssistantState("STANDBY");

      if (data.script) setGeneratedScript(data.script);
      if (data.videoUrl) setCompletedVideoUrl(data.videoUrl);

      const successNotice: ChatMessage = {
        id: Date.now().toString(),
        sender: "assistant",
        text: `Rendered viral short for "${payload.topic}" in ${data.durationSeconds || 4}s (${resolution} 60fps). Video ready in preview.`,
        time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
        tag: "AUDIO",
      };
      setChatMessages((prev) => [...prev, successNotice]);
      speakText("Your video has finished rendering and is ready to download!");
      toast.success("Video Ready", `Generated in ${data.durationSeconds || "4"}s`);
    } catch (err: any) {
      toast.error("Generation Error", err.message);
      setAssistantState("STANDBY");
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

        {/* Right: Weather Capsule & Settings Gear Button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-[#172A4A] bg-[#0C172E] px-3 py-1 text-xs text-gray-300 font-mono">
            <CloudRain className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-white font-semibold">{weather.temp}°C</span>
            <span className="hidden sm:inline text-gray-400">{weather.city}</span>
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

          {/* Card 2: Weather */}
          <div className="rounded-xl border border-[#14233D] bg-[#0A1224] p-3.5 space-y-2.5 font-mono">
            <div className="flex items-center justify-between border-b border-[#14233D] pb-1.5 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-gray-200">
                <CloudRain className="h-3.5 w-3.5 text-cyan-400" />
                Weather
              </span>
              <button
                onClick={() => toast.info("Weather Synchronized", "Belgrade telemetry refreshed.")}
                className="text-gray-400 hover:text-cyan-400 transition-colors"
                title="Refresh weather"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-2xl font-bold text-white tracking-tight">{weather.temp}°C</span>
                <p className="text-xs text-gray-300">{weather.city}</p>
                <p className="text-[11px] text-gray-400">{weather.condition}</p>
              </div>
              <div className="p-2 rounded-xl border border-[#14233D] bg-[#070D18] text-cyan-400">
                <CloudRain className="h-7 w-7" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="rounded-lg border border-[#14233D] bg-[#070D18] p-1.5">
                <span className="text-[10px] text-gray-400 block">Humidity</span>
                <span className="text-xs font-bold text-white">{weather.humidity}%</span>
              </div>
              <div className="rounded-lg border border-[#14233D] bg-[#070D18] p-1.5">
                <span className="text-[10px] text-gray-400 block">Wind</span>
                <span className="text-xs font-bold text-white">{weather.wind}</span>
              </div>
              <div className="rounded-lg border border-[#14233D] bg-[#070D18] p-1.5">
                <span className="text-[10px] text-gray-400 block">Feels Like</span>
                <span className="text-xs font-bold text-white">{weather.feelsLike}°C</span>
              </div>
            </div>
          </div>

          {/* Card 3: Camera / Vision Screen */}
          <div className="rounded-xl border border-[#14233D] bg-[#0A1224] p-3.5 space-y-2.5 font-mono">
            <div className="flex items-center justify-between border-b border-[#14233D] pb-1.5 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-gray-200">
                <Camera className="h-3.5 w-3.5 text-cyan-400" />
                Camera
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleCamera}
                  className="text-gray-400 hover:text-cyan-400 transition-colors"
                  title="Snap frame"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={toggleCamera}
                  className={`transition-colors ${cameraActive ? "text-cyan-400" : "text-gray-400 hover:text-white"}`}
                  title={cameraActive ? "Turn off camera" : "Turn on camera"}
                >
                  <Power className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Viewport Box */}
            <div className="relative aspect-video w-full rounded-lg border border-[#14233D] bg-[#070D18] overflow-hidden flex flex-col items-center justify-center text-center p-3">
              {cameraActive && capturedSnapshot ? (
                <img src={capturedSnapshot} alt="Optical Feed" className="h-full w-full object-cover" />
              ) : (
                <>
                  <Camera className="h-8 w-8 text-cyan-400/40 mb-1" />
                  <span className="text-xs font-semibold text-gray-300">Camera Off</span>
                  <span className="text-[10px] text-gray-500 mt-1">Camera is inactive. Click power to start.</span>
                </>
              )}
            </div>
          </div>

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
            {/* Holographic Concentric Arc Reactor Visualizer */}
            <div
              className="relative flex items-center justify-center my-6 cursor-pointer"
              onMouseMove={handleOrbMouseMove}
              onMouseLeave={handleOrbMouseLeave}
            >
              <canvas
                ref={canvasRef}
                width={300}
                height={300}
                className="rounded-full"
              />
            </div>

            {/* Assistant Name Label */}
            <h2 className="text-lg font-bold tracking-[0.25em] text-white font-mono mt-2">
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

          {/* 3 Bottom Control Buttons (Camera, Mic, Shorts) */}
          <div className="flex items-center gap-3 mt-8">
            <button
              onClick={toggleCamera}
              className={`flex h-12 w-12 items-center justify-center rounded-xl border transition-all cursor-pointer ${
                cameraActive
                  ? "border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow-lg shadow-cyan-500/25"
                  : "border-[#172A4A] bg-[#0C172E] text-gray-300 hover:border-cyan-500/50 hover:text-white"
              }`}
              title="Camera / Vision Feed"
            >
              <Camera className="h-5 w-5" />
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
              onClick={() => setGeneratorModalOpen(true)}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#172A4A] bg-[#0C172E] text-cyan-400 hover:border-cyan-500/50 hover:text-white transition-all cursor-pointer"
              title="1-Click Viral Short Generator"
            >
              <Film className="h-5 w-5" />
            </button>

            <button
              onClick={() => setMacrosModalOpen(true)}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#172A4A] bg-[#0C172E] text-purple-400 hover:border-purple-500/50 hover:text-white transition-all cursor-pointer"
              title="Ghost Operator Macro Automations"
            >
              <Workflow className="h-5 w-5" />
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
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="w-full rounded-lg border border-[#172A4A] bg-[#070D18] px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                >
                  <option value="en-US-JennyNeural">Jenny (en-US Female)</option>
                  <option value="en-US-GuyNeural">Guy (en-US Male)</option>
                  <option value="en-US-ChristopherNeural">Christopher (en-US Authority)</option>
                  <option value="en-US-AriaNeural">Aria (en-US Expressive)</option>
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
                  <div className="text-center pt-1">
                    <a
                      href={completedVideoUrl}
                      download
                      className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 text-[#070B14] px-4 py-1.5 text-xs font-bold hover:bg-cyan-400 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download 9:16 Short
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
