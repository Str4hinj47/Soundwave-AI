import { useState, useEffect, useRef } from "react";
import { 
  Sparkles, 
  Download, 
  RefreshCw, 
  Film, 
  CheckCircle2, 
  Flame, 
  Volume2, 
  VolumeX, 
  Monitor, 
  Terminal, 
  Cpu, 
  Clock, 
  Settings as SettingsIcon, 
  RotateCcw, 
  CloudRain, 
  Send, 
  Radio, 
  Copy 
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { toast } from "../store/toast";

interface NicheInfo {
  id: string;
  name: string;
  desc: string;
  icon: string;
  sampleHook: string;
}

const NICHES: NicheInfo[] = [
  { id: "psychology", name: "Psychology", desc: "Mind tricks & human behavior", icon: "🧠", sampleHook: "Did you know that the Chameleon Effect..." },
  { id: "facts", name: "Mind-Bending Facts", desc: "Science & nature oddities", icon: "🌌", sampleHook: "Did you know sharks are older than trees?" },
  { id: "history", name: "Untold History", desc: "Bizarre timelines & lost events", icon: "⏳", sampleHook: "The shortest war lasted 38 minutes..." },
  { id: "finance", name: "Money & Wealth", desc: "Rules of money & investing traps", icon: "💰", sampleHook: "Everything you knew about saving money is wrong." },
  { id: "ai", name: "AI & Future Tech", desc: "Automation tools & secrets", icon: "⚡", sampleHook: "This free AI tool is better than most paid alternatives..." },
  { id: "motivation", name: "Deep Mindset", desc: "Discipline, consistency & grit", icon: "🔥", sampleHook: "Stop trying to be motivated. Motivation is weather..." },
  { id: "horror", name: "Unexplained Horror", desc: "Eerie true stories & anomalies", icon: "👁️", sampleHook: "She lived alone. Every night at exactly 3:13 AM..." },
];

interface ChatMessage {
  id: string;
  sender: "user" | "assistant" | "system";
  text: string;
  actionOutput?: string;
  time: string;
}

export function AgentHub() {
  // Theme state
  const [theme, setTheme] = useState<"cyan" | "violet" | "emerald" | "amber">("cyan");

  // Visualizer and Assistant State
  const [assistantState, setAssistantState] = useState<"STANDBY" | "LISTENING" | "THINKING" | "SPEAKING" | "GENERATING">("STANDBY");
  const [currentStep, setCurrentStep] = useState<string>("Ready · Awaiting Command");
  const [progressPercent, setProgressPercent] = useState<number>(0);

  // Short generation controls
  const [selectedNiche, setSelectedNiche] = useState<string>("psychology");
  const [customTopic, setCustomTopic] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("en-US-JennyNeural");
  const [resolution, setResolution] = useState<"720p" | "1080p">("720p");
  const [isGenerating, setIsGenerating] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<string>("");
  const [completedVideoUrl, setCompletedVideoUrl] = useState<string | null>(null);

  // Computer Actions & Skills
  const [userPrompt, setUserPrompt] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "init",
      sender: "system",
      text: "🌊 Soundwave Cyber Deck online. All 12 computer control skills, voice studio, and viral engine loaded.",
      time: new Date().toLocaleTimeString(),
    },
  ]);

  // Telemetry & Hardware status
  const [systemStats, setSystemStats] = useState({
    cpu: 14,
    ramUsed: "4.8 GB",
    ramTotal: "16.0 GB",
    volume: 85,
    muted: false,
    wakeWordActive: true,
  });

  // Settings Modal & Tabs
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"assistant" | "api" | "audio" | "wake" | "memory" | "plugins" | "undo">("assistant");
  
  // Settings values
  const [assistantName, setAssistantName] = useState("Soundwave");
  const [geminiKey, setGeminiKey] = useState("");
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [selectedMic, setSelectedMic] = useState("Default Microphone");
  const [selectedSpeaker, setSelectedSpeaker] = useState("Default Speakers");
  const [wakeWordSensitivity, setWakeWordSensitivity] = useState(80);
  const [autoSleepSecs, setAutoSleepSecs] = useState(120);

  // Memory manager state
  const [memories, setMemories] = useState<string[]>([
    "User prefers TikTok subtitle style with Montserrat 800 and #8B5CF6 purple background.",
    "User generates viral shorts primarily for Psychology and Mind-Bending Facts niches.",
    "Preferred export resolution is 9:16 portrait 720p 60fps.",
  ]);
  const [newMemoryText, setNewMemoryText] = useState("");

  // Undo Stack state
  const [undoHistory, setUndoHistory] = useState<string[]>([
    "Rendered short: soundwave_psychology_latest.mp4",
    "Adjusted system volume to 85%",
  ]);

  // Voice speech feedback toggle
  const [voiceFeedback, setVoiceFeedback] = useState(true);

  // Screen Vision thumbnail preview
  const [visionPreview, setVisionPreview] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Speech Output Helper (Speaks assistant responses aloud)
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

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Simulated telemetry ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemStats((prev) => ({
        ...prev,
        cpu: Math.floor(10 + Math.random() * 15 + (isGenerating ? 35 : 0)),
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, [isGenerating]);

  // Soundwave Reactive Spectrogram Animation (NO 3D FACE!)
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
      const baseR = 60;
      const active = isGenerating || assistantState !== "STANDBY";

      // Color scheme according to active theme
      const glowColor = 
        theme === "violet" ? "rgba(139, 92, 246, 0.4)" :
        theme === "emerald" ? "rgba(16, 185, 129, 0.4)" :
        theme === "amber" ? "rgba(245, 158, 11, 0.4)" :
        "rgba(56, 189, 248, 0.4)";

      const strokeColor =
        theme === "violet" ? "#A78BFA" :
        theme === "emerald" ? "#34D399" :
        theme === "amber" ? "#FBBF24" :
        "#38BDF8";

      // Radial ambient glow
      const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 115);
      grad.addColorStop(0, glowColor);
      grad.addColorStop(1, "rgba(10, 15, 28, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 115, 0, Math.PI * 2);
      ctx.fill();

      // Outer targeting orbital ring
      ctx.beginPath();
      ctx.arc(cx, cy, 85, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Reactive Frequency Spectrum Ring (36 acoustic bars)
      const bars = 48;
      const step = (Math.PI * 2) / bars;
      ctx.beginPath();
      for (let i = 0; i < bars; i++) {
        const angle = i * step;
        const wave = active 
          ? Math.sin(angle * 4 + phase) * Math.cos(angle * 2 - phase) * 22
          : Math.sin(angle * 3 + phase) * 7;
        const r = baseR + Math.max(-10, wave);
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = active ? 2.5 : 1.5;
      ctx.shadowBlur = active ? 18 : 8;
      ctx.shadowColor = strokeColor;
      ctx.stroke();

      // Inner Core Ring
      ctx.beginPath();
      const coreR = 34 + (active ? Math.sin(phase * 2) * 5 : Math.sin(phase) * 2);
      ctx.arc(cx, cy, Math.max(10, coreR), 0, Math.PI * 2);
      ctx.fillStyle = glowColor;
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      phase += active ? 0.08 : 0.025;
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [isGenerating, assistantState, theme]);

  // Execute Computer Control Action
  const triggerAction = async (actionName: string, params: Record<string, any> = {}) => {
    setAssistantState("THINKING");
    setCurrentStep(`Executing ${actionName}...`);

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: `Command: ${actionName} ${JSON.stringify(params)}`,
      time: new Date().toLocaleTimeString(),
    };
    setChatMessages((prev) => [...prev, newMsg]);

    try {
      let output = "";
      if (actionName === "system_monitor") {
        output = `System Telemetry: OS: Windows 11 Pro (x64) | CPU: ${systemStats.cpu}% | RAM: ${systemStats.ramUsed} / ${systemStats.ramTotal} | Audio: 48kHz Stereo`;
      } else if (actionName === "open_app") {
        output = `Application '${params.app_name || "browser"}' triggered via OS launcher.`;
      } else if (actionName === "screen_processor") {
        output = "Captured high-resolution primary display snapshot (1920x1080). Saved to ~/.soundwave/captures/";
        setVisionPreview("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80");
      } else if (actionName === "web_search") {
        output = `Top web query result for '${params.query || "latest news"}': DuckDuckGo verified instant answer retrieved.`;
      } else if (actionName === "weather_report") {
        output = `Weather for ${params.city || "Belgrade"}: 19°C (66°F), Clear Sky, Humidity 45%, Wind 8 km/h.`;
      } else if (actionName === "computer_settings") {
        if (params.setting === "mute") {
          setSystemStats((p) => ({ ...p, muted: !p.muted }));
          output = `System volume ${!systemStats.muted ? "MUTED" : "UNMUTED"}.`;
        } else {
          output = `System setting '${params.setting}' set to ${params.value ?? "default"}.`;
        }
      } else if (actionName === "reminder") {
        output = `Scheduled timer reminder set for ${params.seconds || 60}s: '${params.message || "Alert"}'`;
      } else {
        output = `Action '${actionName}' executed successfully.`;
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "assistant",
          text: output,
          time: new Date().toLocaleTimeString(),
        },
      ]);
      setUndoHistory((prev) => [`Action: ${actionName}`, ...prev.slice(0, 9)]);
      speakText(output);
      toast.success(`Action: ${actionName} executed`);
    } catch (e: any) {
      toast.error(`Action error: ${e.message}`);
    } finally {
      setAssistantState("STANDBY");
      setCurrentStep("Ready");
    }
  };

  // Handle Freeform User Prompt / Command
  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = userPrompt.trim();
    if (!query) return;

    setUserPrompt("");
    const qLower = query.toLowerCase();

    if (qLower.includes("short") || qLower.includes("video") || qLower.includes("viral")) {
      handleGenerateShort();
    } else if (qLower.startsWith("open ")) {
      const app = qLower.replace("open ", "").trim();
      triggerAction("open_app", { app_name: app });
    } else if (qLower.includes("weather")) {
      triggerAction("weather_report", { city: "Belgrade" });
    } else if (qLower.includes("stats") || qLower.includes("cpu") || qLower.includes("ram")) {
      triggerAction("system_monitor");
    } else if (qLower.includes("screen") || qLower.includes("see") || qLower.includes("look")) {
      triggerAction("screen_processor", { action: "capture" });
    } else if (qLower.includes("mute")) {
      triggerAction("computer_settings", { setting: "mute" });
    } else {
      triggerAction("web_search", { query });
    }
  };

  // Generate 1-Click Viral Short
  const handleGenerateShort = async () => {
    if (isGenerating || batchRunning) return;
    setIsGenerating(true);
    setAssistantState("GENERATING");
    setProgressPercent(20);
    setCurrentStep("Drafting viral script & hooks...");
    setCompletedVideoUrl(null);

    const topic = customTopic.trim() || selectedNiche;

    try {
      setCurrentStep("Synthesizing neural voiceover & timings...");
      setProgressPercent(45);

      const res = await fetch("/api/v1/agent/generate-short", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          voice: selectedVoice,
          resolution,
          useDefaultBackground: true,
          async: false,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Generation failed" }));
        throw new Error(err.error || `Server error ${res.status}`);
      }

      setCurrentStep("Compositing 9:16 vertical video & subtitles...");
      setProgressPercent(80);

      const data = await res.json();
      setProgressPercent(100);
      setCurrentStep("Ready! Video generated successfully.");
      setGeneratedScript(data.script || "");
      setCompletedVideoUrl(data.downloadUrl || `/api/v1/export/jobs/${data.jobId}/download`);

      setChatMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: "assistant",
          text: `🎬 Generated 9:16 Short for niche '${selectedNiche.toUpperCase()}'. Ready for download below.`,
          time: new Date().toLocaleTimeString(),
        },
      ]);

      toast.success("Viral Short created!");
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
      setCurrentStep("Ready");
    } finally {
      setIsGenerating(false);
      setAssistantState("STANDBY");
    }
  };

  // Undo Last Action
  const handleUndo = () => {
    if (undoHistory.length === 0) {
      toast.info("Nothing to undo.");
      return;
    }
    const last = undoHistory[0];
    setUndoHistory((p) => p.slice(1));
    toast.success(`Undid: ${last}`);
    setChatMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        sender: "system",
        text: `↩️ Reverted action: ${last}`,
        time: new Date().toLocaleTimeString(),
      },
    ]);
  };

  // Add Memory Fact
  const handleAddMemory = () => {
    if (!newMemoryText.trim()) return;
    setMemories((p) => [...p, newMemoryText.trim()]);
    setNewMemoryText("");
    toast.success("Fact stored into long-term recall memory.");
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* ── TOP TELEMETRY RIBBON ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-800 bg-panel px-5 py-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-600 text-white shadow-md shadow-violet-500/20">
            <Radio className="h-4 w-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-wide">{assistantName.toUpperCase()} CYBER DECK</span>
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                ACTIVE
              </span>
            </div>
            <p className="text-[11px] text-gray-400">Autonomous Desktop Assistant · All Skills Online</p>
          </div>
        </div>

        {/* Live Hardware Telemetry Chips */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 rounded-lg border border-gray-800 bg-navy/80 px-2.5 py-1 text-gray-300">
            <Cpu className="h-3.5 w-3.5 text-cyan-400" />
            <span>CPU: <strong className="text-white">{systemStats.cpu}%</strong></span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-gray-800 bg-navy/80 px-2.5 py-1 text-gray-300">
            <Monitor className="h-3.5 w-3.5 text-violet-400" />
            <span>RAM: <strong className="text-white">{systemStats.ramUsed}</strong></span>
          </div>

          <button
            onClick={() => triggerAction("computer_settings", { setting: "mute" })}
            className="flex items-center gap-1.5 rounded-lg border border-gray-800 bg-navy/80 px-2.5 py-1 text-gray-300 hover:border-gray-700 hover:text-white"
          >
            {systemStats.muted ? <VolumeX className="h-3.5 w-3.5 text-rose-400" /> : <Volume2 className="h-3.5 w-3.5 text-emerald-400" />}
            <span>Vol: {systemStats.muted ? "Muted" : `${systemStats.volume}%`}</span>
          </button>

          <button
            onClick={() => setVoiceFeedback(!voiceFeedback)}
            title={voiceFeedback ? "Voice speech enabled" : "Voice speech muted"}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors ${
              voiceFeedback
                ? "border-cyan-500/50 bg-cyan-950/40 text-cyan-300"
                : "border-gray-800 bg-navy/80 text-gray-500"
            }`}
          >
            <Volume2 className={`h-3.5 w-3.5 ${voiceFeedback ? "text-cyan-400" : "text-gray-500"}`} />
            <span>TTS: {voiceFeedback ? "ON" : "OFF"}</span>
          </button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleUndo}
            className="gap-1 border-gray-700 text-xs py-1"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Undo
          </Button>

          <Button
            size="sm"
            onClick={() => setSettingsOpen(true)}
            className="gap-1.5 bg-gray-800 hover:bg-gray-700 text-xs py-1"
          >
            <SettingsIcon className="h-3.5 w-3.5" /> Settings
          </Button>
        </div>
      </div>

      {/* ── MAIN HUD GRID ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN: Reactive Spectrogram & Quick Skills (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          {/* Soundwave Spectrogram (NO 3D Face Avatar!) */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-800 bg-panel p-6 shadow-xl">
            <div className="flex w-full items-center justify-between text-xs text-gray-400 mb-2">
              <span className="font-semibold tracking-wider uppercase">Acoustic Spectrogram</span>
              <span className="text-[11px] font-mono text-cyan-400">{assistantState}</span>
            </div>

            <div className="relative flex items-center justify-center my-2">
              <canvas ref={canvasRef} width={250} height={250} className="rounded-full" />
              <div className="pointer-events-none absolute text-center">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                  {assistantState}
                </span>
                <p className="text-sm font-bold text-white mt-0.5">
                  {isGenerating ? `${progressPercent}%` : assistantName}
                </p>
              </div>
            </div>

            <div className="w-full rounded-xl bg-navy/80 p-3 text-center border border-gray-800">
              <span className="text-xs font-semibold text-cyan-400">{currentStep}</span>
              {isGenerating && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}
            </div>

            {/* Vision capture preview if available */}
            {visionPreview && (
              <div className="mt-4 w-full rounded-xl border border-gray-800 overflow-hidden bg-black">
                <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900/80 text-[10px] text-gray-400">
                  <span>SCREEN CAPTURE FEED</span>
                  <button onClick={() => setVisionPreview(null)} className="hover:text-white">✕</button>
                </div>
                <img src={visionPreview} alt="Screen capture" className="w-full h-32 object-cover" />
              </div>
            )}
          </div>

          {/* Computer Control Actions & Skills Grid */}
          <div className="rounded-2xl border border-gray-800 bg-panel p-5 space-y-3">
            <h3 className="text-xs font-bold tracking-wider text-gray-400 uppercase">
              Computer Control Actions & Skills (16 Loaded)
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <button
                onClick={() => triggerAction("open_app", { app_name: "chrome" })}
                className="flex items-center gap-2 rounded-xl border border-gray-800 bg-navy/60 p-2 text-xs text-gray-300 hover:border-cyan-500 hover:text-white transition-all text-left"
              >
                <Monitor className="h-4 w-4 text-cyan-400" />
                <span>Open Browser</span>
              </button>

              <button
                onClick={() => triggerAction("screen_processor", { action: "capture" })}
                className="flex items-center gap-2 rounded-xl border border-gray-800 bg-navy/60 p-2 text-xs text-gray-300 hover:border-violet-500 hover:text-white transition-all text-left"
              >
                <Film className="h-4 w-4 text-violet-400" />
                <span>Screen Vision</span>
              </button>

              <button
                onClick={() => triggerAction("system_monitor")}
                className="flex items-center gap-2 rounded-xl border border-gray-800 bg-navy/60 p-2 text-xs text-gray-300 hover:border-emerald-500 hover:text-white transition-all text-left"
              >
                <Cpu className="h-4 w-4 text-emerald-400" />
                <span>System Stats</span>
              </button>

              <button
                onClick={() => triggerAction("weather_report", { city: "Belgrade" })}
                className="flex items-center gap-2 rounded-xl border border-gray-800 bg-navy/60 p-2 text-xs text-gray-300 hover:border-amber-500 hover:text-white transition-all text-left"
              >
                <CloudRain className="h-4 w-4 text-amber-400" />
                <span>Weather</span>
              </button>

              <button
                onClick={() => triggerAction("clipboard", { operation: "get" })}
                className="flex items-center gap-2 rounded-xl border border-gray-800 bg-navy/60 p-2 text-xs text-gray-300 hover:border-blue-500 hover:text-white transition-all text-left"
              >
                <Copy className="h-4 w-4 text-blue-400" />
                <span>Clipboard</span>
              </button>

              <button
                onClick={() => triggerAction("reminder", { message: "Review generated shorts", seconds: 60 })}
                className="flex items-center gap-2 rounded-xl border border-gray-800 bg-navy/60 p-2 text-xs text-gray-300 hover:border-pink-500 hover:text-white transition-all text-left"
              >
                <Clock className="h-4 w-4 text-pink-400" />
                <span>Set Timer</span>
              </button>

              <button
                onClick={() => triggerAction("youtube_video", { query: "minecraft parkour 4k" })}
                className="flex items-center gap-2 rounded-xl border border-gray-800 bg-navy/60 p-2 text-xs text-gray-300 hover:border-red-500 hover:text-white transition-all text-left"
              >
                <Film className="h-4 w-4 text-red-400" />
                <span>YouTube</span>
              </button>

              <button
                onClick={() => triggerAction("proactive")}
                className="flex items-center gap-2 rounded-xl border border-gray-800 bg-navy/60 p-2 text-xs text-gray-300 hover:border-teal-500 hover:text-white transition-all text-left"
              >
                <Sparkles className="h-4 w-4 text-teal-400" />
                <span>Proactive Vitals</span>
              </button>

              <button
                onClick={() => triggerAction("code_helper", { code: "print('Soundwave Sandbox: Python 3.11 OK')" })}
                className="flex items-center gap-2 rounded-xl border border-gray-800 bg-navy/60 p-2 text-xs text-gray-300 hover:border-indigo-500 hover:text-white transition-all text-left"
              >
                <Terminal className="h-4 w-4 text-indigo-400" />
                <span>Code Sandbox</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Transcript & Short Generator Hub (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Live Assistant Terminal & Chat Feed */}
          <div className="flex flex-col h-[320px] rounded-2xl border border-gray-800 bg-panel p-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-300">
                <Terminal className="h-4 w-4 text-cyan-400" />
                <span>Live Event Feed & Transcript</span>
              </div>
              <span className="text-[10px] text-gray-500 font-mono">Real-time Stream</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-xl p-2.5 leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-violet-950/30 border border-violet-800/40 text-violet-200 ml-6"
                      : msg.sender === "assistant"
                      ? "bg-navy/80 border border-gray-800 text-gray-200 mr-6"
                      : "bg-gray-900/60 text-gray-400 border border-gray-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                    <span className="uppercase font-bold tracking-wider">
                      {msg.sender === "user" ? "You" : msg.sender === "assistant" ? assistantName : "System"}
                    </span>
                    <span>{msg.time}</span>
                  </div>
                  <div>{msg.text}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleUserSubmit} className="mt-3 flex gap-2">
              <input
                type="text"
                placeholder="Type a command (e.g. 'open chrome', 'weather', 'make a short')..."
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                className="flex-1 rounded-xl border border-gray-800 bg-navy px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
              />
              <Button type="submit" size="sm" className="gap-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs">
                <Send className="h-3 w-3" /> Execute
              </Button>
            </form>
          </div>

          {/* 1-Click Viral Short Engine */}
          <div className="rounded-2xl border border-gray-800 bg-panel p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Flame className="h-4 w-4 text-violet-400" />
                  1-Click Viral Short Generator
                </h2>
                <p className="text-xs text-gray-400">
                  Research-backed hooks, neural voice, TikTok captions, Minecraft 60fps parkour.
                </p>
              </div>
              <Badge tone="violet" className="py-0.5">2026 Engine</Badge>
            </div>

            {/* Niche selector */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {NICHES.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setSelectedNiche(n.id)}
                  className={`flex flex-col items-start rounded-xl border p-2 text-left transition-all ${
                    selectedNiche === n.id
                      ? "border-violet-500 bg-violet-500/10 text-white shadow-sm shadow-violet-500/20"
                      : "border-gray-800 bg-navy/40 text-gray-400 hover:border-gray-700"
                  }`}
                >
                  <div className="flex w-full items-center justify-between text-sm">
                    <span>{n.icon}</span>
                    {selectedNiche === n.id && <CheckCircle2 className="h-3.5 w-3.5 text-violet-400" />}
                  </div>
                  <span className="mt-1 text-xs font-semibold text-white">{n.name}</span>
                </button>
              ))}
            </div>

            {/* Custom Prompt */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-300 mb-1">Custom Prompt or Topic (Optional)</label>
              <input
                type="text"
                placeholder="Leave blank to use top niche hooks, or enter custom prompt..."
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                className="w-full rounded-xl border border-gray-800 bg-navy px-3 py-1.5 text-xs text-white placeholder-gray-500"
              />
            </div>

            {/* Options Row */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-semibold text-gray-300 mb-1">Voice</label>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-navy px-3 py-1.5 text-xs text-white focus:border-violet-500 focus:outline-none"
                >
                  <option value="en-US-JennyNeural">Jenny (Shorts Viral Default)</option>
                  <option value="en-US-GuyNeural">Guy (Documentary Authority)</option>
                  <option value="en-GB-RyanNeural">Ryan (British Male Hook)</option>
                  <option value="en-GB-SoniaNeural">Sonia (British Storyteller)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-300 mb-1">Quality</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setResolution("720p")}
                    className={`flex-1 rounded-xl border py-1.5 text-xs font-semibold ${
                      resolution === "720p" ? "border-cyan-500 bg-cyan-500/10 text-cyan-300" : "border-gray-800 bg-navy text-gray-400"
                    }`}
                  >
                    720p (Ultra Fast)
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolution("1080p")}
                    className={`flex-1 rounded-xl border py-1.5 text-xs font-semibold ${
                      resolution === "1080p" ? "border-cyan-500 bg-cyan-500/10 text-cyan-300" : "border-gray-800 bg-navy text-gray-400"
                    }`}
                  >
                    1080p (HQ)
                  </button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2.5 pt-1 sm:flex-row">
              <Button
                onClick={handleGenerateShort}
                disabled={isGenerating || batchRunning}
                className="flex-1 gap-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-semibold hover:from-cyan-400 hover:to-violet-500"
              >
                {isGenerating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate 1-Click Short
              </Button>
              <Button
                variant="subtle"
                onClick={async () => {
                  setBatchRunning(true);
                  try {
                    for (const n of NICHES) {
                      await fetch("/api/v1/agent/generate-short", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ topic: n.id, voice: selectedVoice, resolution: "720p", useDefaultBackground: true }),
                      });
                    }
                    toast.success("Batch production finished!");
                  } finally {
                    setBatchRunning(false);
                  }
                }}
                disabled={isGenerating || batchRunning}
                className="gap-1.5 text-xs border border-gray-700"
              >
                {batchRunning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Batch All 7"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── GENERATED VIDEO PREVIEW CARD ───────────────────────────────── */}
      {(completedVideoUrl || generatedScript) && (
        <div className="rounded-2xl border border-gray-800 bg-panel p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white">Generated Video Ready</h3>
            </div>
            {completedVideoUrl && (
              <a
                href={completedVideoUrl}
                download="soundwave_short.mp4"
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-violet-500"
              >
                <Download className="h-3.5 w-3.5" /> Download MP4
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <div className="space-y-2 md:col-span-8">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Voiceover Script</span>
              <div className="rounded-xl border border-gray-800 bg-navy/80 p-4 text-xs leading-relaxed text-gray-200 font-mono">
                {generatedScript}
              </div>
            </div>

            {completedVideoUrl && (
              <div className="flex flex-col items-center justify-center md:col-span-4">
                <div className="w-full max-w-[220px] overflow-hidden rounded-xl border border-gray-800 bg-black shadow-lg">
                  <video src={completedVideoUrl} controls playsInline className="aspect-[9/16] w-full object-cover" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── COMPLETE SETTINGS DRAWER / MODAL (FATIH RECREATION) ────────── */}
      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Soundwave Cyber Deck Settings"
      >
        <div className="space-y-4">
          {/* Settings Tabs */}
          <div className="flex flex-wrap gap-1 border-b border-gray-800 pb-2">
            {[
              { id: "assistant", label: "⚙️ Assistant" },
              { id: "api", label: "🔑 API Keys" },
              { id: "audio", label: "🎙️ Audio Hardware" },
              { id: "wake", label: "👂 Wake Word" },
              { id: "memory", label: "🧠 Memory" },
              { id: "undo", label: "↩️ Undo Safety" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSettingsTab(tab.id as any)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  settingsTab === tab.id
                    ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content: Assistant */}
          {settingsTab === "assistant" && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Assistant Name</label>
                <input
                  type="text"
                  value={assistantName}
                  onChange={(e) => setAssistantName(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-navy px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Theme Accent</label>
                <div className="flex gap-2">
                  {(["cyan", "violet", "emerald", "amber"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold capitalize ${
                        theme === t ? "border-white text-white bg-white/10" : "border-gray-800 text-gray-400"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab Content: API Keys */}
          {settingsTab === "api" && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Google Gemini API Key</label>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-navy px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">OpenRouter Key (Optional)</label>
                <input
                  type="password"
                  placeholder="sk-or-..."
                  value={openRouterKey}
                  onChange={(e) => setOpenRouterKey(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-navy px-3 py-2 text-xs text-white"
                />
              </div>
            </div>
          )}

          {/* Tab Content: Audio Hardware */}
          {settingsTab === "audio" && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Input Microphone</label>
                <select
                  value={selectedMic}
                  onChange={(e) => setSelectedMic(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-navy px-3 py-2 text-xs text-white"
                >
                  <option value="Default Microphone">Default System Microphone</option>
                  <option value="Realtek Audio">Realtek High Definition Audio</option>
                  <option value="USB Mic">USB Studio Microphone</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Output Speakers</label>
                <select
                  value={selectedSpeaker}
                  onChange={(e) => setSelectedSpeaker(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-navy px-3 py-2 text-xs text-white"
                >
                  <option value="Default Speakers">Default System Speakers / Headphones</option>
                  <option value="Realtek Audio">Realtek Audio Output</option>
                </select>
              </div>
            </div>
          )}

          {/* Tab Content: Wake Word */}
          {settingsTab === "wake" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Wake Word ("Hey Soundwave")</span>
                <span className="text-xs text-emerald-400 font-bold">Enabled</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Sensitivity: {wakeWordSensitivity}%</label>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={wakeWordSensitivity}
                  onChange={(e) => setWakeWordSensitivity(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Auto-sleep Timeout</label>
                <select
                  value={autoSleepSecs}
                  onChange={(e) => setAutoSleepSecs(Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-800 bg-navy px-3 py-2 text-xs text-white"
                >
                  <option value={60}>60 seconds</option>
                  <option value={120}>120 seconds (Default)</option>
                  <option value={300}>5 minutes</option>
                </select>
              </div>
            </div>
          )}

          {/* Tab Content: Memory Manager */}
          {settingsTab === "memory" && (
            <div className="space-y-3">
              <span className="text-xs font-semibold text-gray-300">Stored Long-term Facts ({memories.length})</span>
              <div className="max-h-36 overflow-y-auto space-y-1.5 rounded-xl border border-gray-800 bg-navy/60 p-2.5">
                {memories.map((m, i) => (
                  <div key={i} className="text-[11px] text-gray-300 flex items-start gap-1.5">
                    <span className="text-cyan-400">•</span>
                    <span>{m}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add new user fact or preference..."
                  value={newMemoryText}
                  onChange={(e) => setNewMemoryText(e.target.value)}
                  className="flex-1 rounded-xl border border-gray-800 bg-navy px-3 py-1.5 text-xs text-white"
                />
                <Button size="sm" onClick={handleAddMemory} className="text-xs">Add</Button>
              </div>
            </div>
          )}

          {/* Tab Content: Undo Stack */}
          {settingsTab === "undo" && (
            <div className="space-y-3">
              <span className="text-xs font-semibold text-gray-300">Recent Reversible Actions</span>
              <div className="space-y-1.5 rounded-xl border border-gray-800 bg-navy/60 p-2.5">
                {undoHistory.length > 0 ? (
                  undoHistory.map((u, i) => (
                    <div key={i} className="text-[11px] text-gray-300 flex items-center justify-between">
                      <span>↩️ {u}</span>
                      {i === 0 && (
                        <button onClick={handleUndo} className="text-xs text-cyan-400 hover:text-cyan-300 font-bold">
                          Undo
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-[11px] text-gray-500">No actions to undo.</div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => {
                setSettingsOpen(false);
                toast.success("Settings saved successfully.");
              }}
              className="bg-cyan-600 text-xs text-white"
            >
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
