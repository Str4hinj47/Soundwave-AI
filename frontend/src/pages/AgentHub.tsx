import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { 
  Sparkles, 
  Download, 
  RefreshCw, 
  Film, 
  CheckCircle2, 
  Flame, 
  Volume2, 
  Terminal, 
  Cpu, 
  Clock, 
  Settings as SettingsIcon, 
  Send, 
  Copy,
  Zap,
  Play,
  Plus,
  Mic,
  MicOff,
  Activity,
  Compass,
  TrendingUp,
  Eye,
  Workflow,
  Check,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { toast } from "../store/toast";
import { AgentCard } from "../components/agent/AgentCard";

interface NicheInfo {
  id: string;
  name: string;
  desc: string;
  iconName: "sparkles" | "compass" | "clock" | "trending" | "cpu" | "flame" | "eye";
  sampleHook: string;
}

const NICHES: NicheInfo[] = [
  { id: "psychology", name: "Psychology", desc: "Mind tricks & human behavior", iconName: "sparkles", sampleHook: "Did you know that the Chameleon Effect..." },
  { id: "facts", name: "Mind-Bending Facts", desc: "Science & nature oddities", iconName: "compass", sampleHook: "Did you know sharks are older than trees?" },
  { id: "history", name: "Untold History", desc: "Bizarre timelines & lost events", iconName: "clock", sampleHook: "The shortest war lasted 38 minutes..." },
  { id: "finance", name: "Money & Wealth", desc: "Rules of money & investing traps", iconName: "trending", sampleHook: "Everything you knew about saving money is wrong." },
  { id: "ai", name: "AI & Future Tech", desc: "Automation tools & secrets", iconName: "cpu", sampleHook: "This free AI tool is better than most paid alternatives..." },
  { id: "motivation", name: "Deep Mindset", desc: "Discipline, consistency & grit", iconName: "flame", sampleHook: "Stop trying to be motivated. Motivation is weather..." },
  { id: "horror", name: "Unexplained Horror", desc: "Eerie true stories & anomalies", iconName: "eye", sampleHook: "She lived alone. Every night at exactly 3:13 AM..." },
];

function getNicheIcon(iconName: string) {
  switch (iconName) {
    case "sparkles": return <Sparkles className="h-4 w-4 text-blue-400" />;
    case "compass": return <Compass className="h-4 w-4 text-emerald-400" />;
    case "clock": return <Clock className="h-4 w-4 text-amber-400" />;
    case "trending": return <TrendingUp className="h-4 w-4 text-purple-400" />;
    case "cpu": return <Cpu className="h-4 w-4 text-cyan-400" />;
    case "flame": return <Flame className="h-4 w-4 text-rose-400" />;
    case "eye": return <Eye className="h-4 w-4 text-indigo-400" />;
    default: return <Sparkles className="h-4 w-4 text-blue-400" />;
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

interface MacroStep {
  id: string;
  action: string;
  params?: Record<string, unknown>;
  description?: string;
  delayMs?: number;
}

interface MacroWorkflow {
  id: string;
  name: string;
  description: string;
  category: "creator" | "productivity" | "system" | "custom";
  triggerPhrases?: string[];
  steps: MacroStep[];
  isBuiltin?: boolean;
  icon?: string;
}

interface StepExecutionResult {
  stepId: string;
  action: string;
  description?: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  output?: string;
  error?: string;
  durationMs: number;
}

interface MacroExecutionReport {
  workflowId: string;
  workflowName: string;
  startedAt: string;
  completedAt: string;
  totalDurationMs: number;
  allSuccess: boolean;
  stepResults: StepExecutionResult[];
  summary: string;
}

export function AgentHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Active Workspace Tab: "console" | "generator" | "macros" | "activity"
  const activeTab = (searchParams.get("tab") as "console" | "generator" | "macros" | "activity") || "console";
  const setActiveTab = (tab: "console" | "generator" | "macros" | "activity") => {
    setSearchParams({ tab });
  };

  // Visualizer and Assistant State
  const [assistantState, setAssistantState] = useState<"STANDBY" | "LISTENING" | "THINKING" | "SPEAKING" | "GENERATING">("STANDBY");
  const [currentStep, setCurrentStep] = useState<string>("Ready · Awaiting Command");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [isMicActive, setIsMicActive] = useState(false);
  const [audioDecibels, setAudioDecibels] = useState(-38);
  const pointerOffset = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  // Autonomous Shorts Generator Form State
  const [selectedNiche, setSelectedNiche] = useState<string>("psychology");
  const [customTopic, setCustomTopic] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("en-US-JennyNeural");
  const [clonedVoices, setClonedVoices] = useState<Array<{ id: string; name: string }>>([]);
  const [resolution, setResolution] = useState<"720p" | "1080p">("720p");
  const [isGenerating, setIsGenerating] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<string>("");
  const [completedVideoUrl, setCompletedVideoUrl] = useState<string | null>(null);

  // Ghost Operator Macro State
  const [macrosList, setMacrosList] = useState<MacroWorkflow[]>([]);
  const [activeExecutionReport, setActiveExecutionReport] = useState<MacroExecutionReport | null>(null);
  const [isRunningMacro, setIsRunningMacro] = useState(false);
  const [nlMacroPrompt, setNlMacroPrompt] = useState("");
  const [isDecomposingNl, setIsDecomposingNl] = useState(false);
  const [macroModalOpen, setMacroModalOpen] = useState(false);
  const [newMacroName, setNewMacroName] = useState("");
  const [newMacroDesc, setNewMacroDesc] = useState("");
  const [newMacroNlInput, setNewMacroNlInput] = useState("");
  const [builderSteps, setBuilderSteps] = useState<MacroStep[]>([]);

  // Conversational Chat Stream State
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
        sender: "system",
        text: "Soundwave Workspace initialized. 4 autonomous agents active, 16 desktop controls loaded, and Ghost Operator RPA ready.",
        time: new Date().toLocaleTimeString(),
        tag: "SYS",
      },
    ];
  });

  // Save chat to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("soundwave_agent_chat_history", JSON.stringify(chatMessages.slice(-60)));
    } catch {}
  }, [chatMessages]);

  // Telemetry & Hardware status
  const [systemStats, setSystemStats] = useState({
    cpu: 18,
    ramUsed: "5.2 GB",
    ramTotal: "16.0 GB",
    volume: 85,
    muted: false,
    wakeWordActive: true,
  });

  // Settings Modal
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Settings values
  const [assistantName, setAssistantName] = useState("Soundwave");

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

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const workspaceSectionRef = useRef<HTMLDivElement | null>(null);

  // Load user's cloned voices & macros
  const loadMacros = async () => {
    try {
      const res = await fetch("/api/v1/ghost/macros");
      if (res.ok) {
        const data = await res.json();
        setMacrosList(data.macros || []);
      }
    } catch {}
  };

  useEffect(() => {
    loadMacros();
    fetch("/api/v1/tts/clone/profiles")
      .then((r) => (r.ok ? r.json() : { profiles: [] }))
      .then((d) => setClonedVoices(d.profiles || []))
      .catch(() => {});

    try {
      const params = new URLSearchParams(window.location.search);
      const v = params.get("voice");
      if (v) setSelectedVoice(v);
    } catch {}
  }, []);

  // Audio Decibels Simulation
  useEffect(() => {
    const timer = setInterval(() => {
      if (assistantState === "SPEAKING" || assistantState === "GENERATING" || isMicActive) {
        setAudioDecibels(Math.floor(-18 + Math.random() * 12));
      } else {
        setAudioDecibels(Math.floor(-38 + Math.random() * 6));
      }
    }, 120);
    return () => clearInterval(timer);
  }, [assistantState, isMicActive]);

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

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Simulated telemetry ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemStats((prev) => ({
        ...prev,
        cpu: Math.floor(14 + Math.random() * 10 + (isGenerating ? 35 : 0)),
      }));
    }, 4000);
    return () => clearInterval(interval);
  }, [isGenerating]);

  // ── Calm Acoustic Particle Sphere Engine ────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let phase = 0;
    let rotX = 0;
    let rotY = 0;

    // Initialize 120 particles on a sphere
    const particleCount = 110;
    const particles: Array<{
      theta: number;
      phi: number;
      radius: number;
      size: number;
      speed: number;
    }> = [];

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1) - Math.PI / 2;
      const r = 44 + Math.random() * 14;
      particles.push({
        theta,
        phi,
        radius: r,
        size: 1.2 + Math.random() * 1.8,
        speed: 0.004 + Math.random() * 0.006,
      });
    }

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
      if (assistantState === "LISTENING" || isMicActive) speedMult = 1.5;
      else if (assistantState === "THINKING") speedMult = 2.4;
      else if (assistantState === "SPEAKING") speedMult = 1.8;
      else if (assistantState === "GENERATING") speedMult = 2.8;

      rotX += 0.005 * speedMult;
      rotY += 0.008 * speedMult;
      phase += (active ? 0.05 : 0.02) * speedMult;

      // Subtle radial ambient glow
      const ambientGrad = ctx.createRadialGradient(cx + ox * 0.3, cy + oy * 0.3, 10, cx, cy, 100);
      ambientGrad.addColorStop(0, active ? "rgba(37, 99, 235, 0.2)" : "rgba(37, 99, 235, 0.08)");
      ambientGrad.addColorStop(1, "rgba(12, 13, 18, 0)");
      ctx.fillStyle = ambientGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, 100, 0, Math.PI * 2);
      ctx.fill();

      // Outer delicate ring
      ctx.beginPath();
      ctx.arc(cx, cy, 82, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Render 3D particles
      const sorted = particles.map((p) => {
        p.theta += p.speed * speedMult;
        const curR = p.radius + (active ? Math.sin(phase + p.theta * 3) * 6 : 0);

        let x = curR * Math.cos(p.phi) * Math.sin(p.theta);
        let y = curR * Math.sin(p.phi);
        let z = curR * Math.cos(p.phi) * Math.cos(p.theta);

        // Rotation around X
        const cosX = Math.cos(rotX);
        const sinX = Math.sin(rotX);
        const y1 = y * cosX - z * sinX;
        const z1 = y * sinX + z * cosX;

        // Rotation around Y
        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);
        const x2 = x * cosY + z1 * sinY;
        const z2 = -x * sinY + z1 * cosY;

        return { x: x2, y: y1, z: z2, size: p.size };
      });

      sorted.sort((a, b) => a.z - b.z);

      const fov = 160;
      for (const p of sorted) {
        const scale = fov / (fov + p.z + 90);
        const projX = cx + (p.x + ox * 0.4) * scale;
        const projY = cy + (p.y + oy * 0.4) * scale;
        const depthAlpha = Math.max(0.15, Math.min(0.9, (p.z + 60) / 120));

        ctx.beginPath();
        ctx.arc(projX, projY, Math.max(0.8, p.size * scale), 0, Math.PI * 2);
        ctx.fillStyle = active
          ? `rgba(96, 165, 250, ${depthAlpha})`
          : `rgba(156, 163, 175, ${depthAlpha * 0.6})`;
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
    pointerOffset.current.targetX = Math.max(-25, Math.min(25, x * 0.25));
    pointerOffset.current.targetY = Math.max(-25, Math.min(25, y * 0.25));
  };

  const handleOrbMouseLeave = () => {
    pointerOffset.current.targetX = 0;
    pointerOffset.current.targetY = 0;
  };

  // ── Ghost Operator Execution Helper ─────────────────────────────────────
  const runMacroWorkflow = async (params: {
    macroId?: string;
    workflow?: MacroWorkflow;
    promptText?: string;
  }) => {
    try {
      setIsRunningMacro(true);
      setAssistantState("THINKING");
      setCurrentStep("Ghost Operator: Initializing macro sequence...");

      const res = await fetch("/api/v1/ghost/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to execute macro");

      setActiveExecutionReport(data.report);
      setCurrentStep(`Macro Complete: ${data.report?.summary || "All steps finished"}`);
      setAssistantState("STANDBY");

      const sysMsg: ChatMessage = {
        id: Date.now().toString(),
        sender: "assistant",
        text: `Ghost Operator Workflow Finished: ${data.report?.workflowName}\n${data.report?.summary}\nTotal runtime: ${data.report?.totalDurationMs}ms`,
        time: new Date().toLocaleTimeString(),
        tag: "RPA",
      };
      setChatMessages((prev) => [...prev, sysMsg]);
      speakText(data.report?.summary || "Macro executed successfully.");

      toast.success(
        "Macro Completed",
        `${data.report?.workflowName}: ${data.report?.stepResults?.length || 0} steps executed`,
      );
    } catch (e: any) {
      toast.error("Execution Failed", e.message || "Ghost Operator failed to run macro");
      setCurrentStep("Macro Execution Aborted");
      setAssistantState("STANDBY");
    } finally {
      setIsRunningMacro(false);
    }
  };

  // Natural language command decomposition
  const handleDecomposePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlMacroPrompt.trim() || isDecomposingNl) return;

    try {
      setIsDecomposingNl(true);
      setCurrentStep(`Decomposing prompt into automated steps...`);
      setAssistantState("THINKING");

      const res = await fetch("/api/v1/ghost/decompose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: nlMacroPrompt }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to decompose prompt");

      if (data.steps && data.steps.length > 0) {
        toast.info("Workflow Decomposed", `Generated ${data.steps.length} sequential execution steps`);
        await runMacroWorkflow({
          workflow: {
            id: `adhoc_${Date.now()}`,
            name: nlMacroPrompt.slice(0, 32),
            description: nlMacroPrompt,
            category: "custom",
            steps: data.steps,
          },
        });
        setNlMacroPrompt("");
      } else {
        toast.warning("No Steps Identified", "Try phrasing as: 'open chrome, set volume to 80, check stats'");
      }
    } catch (e: any) {
      toast.error("Decomposition Error", e.message);
    } finally {
      setIsDecomposingNl(false);
      setAssistantState("STANDBY");
    }
  };

  // Builder Decompose helper
  const handleDecomposeForBuilder = async () => {
    if (!newMacroNlInput.trim()) return;
    try {
      setIsDecomposingNl(true);
      const res = await fetch("/api/v1/ghost/decompose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: newMacroNlInput }),
      });
      const data = await res.json();
      if (res.ok && data.steps) {
        setBuilderSteps(data.steps);
        if (!newMacroName) {
          setNewMacroName(newMacroNlInput.slice(0, 28));
        }
        if (!newMacroDesc) {
          setNewMacroDesc(newMacroNlInput);
        }
        toast.success("Steps Generated", `${data.steps.length} steps added to builder.`);
      }
    } catch {
      toast.error("Failed to parse prompt");
    } finally {
      setIsDecomposingNl(false);
    }
  };

  // Save new custom macro
  const handleSaveMacro = async () => {
    if (!newMacroName.trim()) {
      toast.error("Validation Error", "Macro name is required");
      return;
    }
    if (builderSteps.length === 0) {
      toast.error("Validation Error", "Add at least one step");
      return;
    }

    try {
      const res = await fetch("/api/v1/ghost/macros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newMacroName,
          description: newMacroDesc || newMacroName,
          category: "custom",
          steps: builderSteps,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Macro Created", `Saved '${newMacroName}' to your workflow catalog`);
      setMacroModalOpen(false);
      setNewMacroName("");
      setNewMacroDesc("");
      setNewMacroNlInput("");
      setBuilderSteps([]);
      loadMacros();
    } catch (e: any) {
      toast.error("Failed to save", e.message);
    }
  };

  // Delete custom macro
  const handleDeleteCustomMacro = async (macroId: string) => {
    try {
      const res = await fetch(`/api/v1/ghost/macros?id=${macroId}`, { method: "DELETE" });
      if (res.ok) {
        toast.info("Macro Deleted", "Removed custom workflow from catalog");
        loadMacros();
      }
    } catch {}
  };

  // ── Computer Control Actions Helper ─────────────────────────────────────
  const triggerAction = async (actionName: string, params: Record<string, any> = {}) => {
    try {
      setAssistantState("THINKING");
      setCurrentStep(`Executing skill: ${actionName}...`);

      let replyText = "";
      if (actionName === "system_monitor") {
        replyText = `System Vitals: CPU load normal (${systemStats.cpu}%), Memory ${systemStats.ramUsed} / ${systemStats.ramTotal} utilized. Audio DSP: 48kHz Stereo operational.`;
      } else if (actionName === "weather_report") {
        replyText = `Belgrade Weather: 19°C (66°F), Clear Skies, Humidity 45%, Wind 8 km/h. Ideal creator conditions.`;
      } else if (actionName === "computer_settings") {
        const nextMute = !systemStats.muted;
        setSystemStats((p) => ({ ...p, muted: nextMute }));
        replyText = `Toggled master system volume mute state to ${nextMute ? "MUTED" : "UNMUTED"}.`;
      } else if (actionName === "browser_control") {
        const targetUrl = params.url || "https://google.com";
        window.open(targetUrl, "_blank");
        replyText = `Launched web browser tab navigating to: ${targetUrl}`;
      } else if (actionName === "screen_processor") {
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 180;
        const c = canvas.getContext("2d");
        if (c) {
          c.fillStyle = "#111827";
          c.fillRect(0, 0, 320, 180);
          c.fillStyle = "#38BDF8";
          c.font = "12px sans-serif";
          c.fillText("SCREEN SNAPSHOT CAPTURED", 20, 90);
          c.fillStyle = "#94A3B8";
          c.fillText(new Date().toLocaleTimeString(), 20, 110);
        }
        replyText = `Captured active display at 1920x1080. Visual OCR and screen inspection buffer loaded.`;
      } else if (actionName === "open_app") {
        replyText = `Signal sent to launch workstation application: ${params.appName || "Editor"}`;
      } else {
        replyText = `Dispatched skill ${actionName} successfully.`;
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: "assistant",
          text: replyText,
          time: new Date().toLocaleTimeString(),
          tag: "SYS",
        },
      ]);

      setCurrentStep(`Skill Complete: ${actionName}`);
      speakText(replyText);
      setAssistantState("STANDBY");
      toast.success("Skill Executed", actionName);
    } catch {
      setAssistantState("STANDBY");
    }
  };

  // ── Conversational Chat Dispatcher ──────────────────────────────────────
  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPrompt.trim()) return;

    const query = userPrompt.trim();
    setUserPrompt("");

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: query,
      time: new Date().toLocaleTimeString(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setAssistantState("THINKING");
    setCurrentStep(`Processing prompt...`);

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
          time: new Date().toLocaleTimeString(),
          tag: data.tag || (data.action === "ghost_macro" ? "RPA" : "VOICE"),
        };
        setChatMessages((prev) => [...prev, aiMsg]);
        speakText(aiMsg.text);
        setCurrentStep("Ready · Awaiting Command");

        if (data.executionReport) {
          setActiveExecutionReport(data.executionReport);
        }
      } else {
        const fallbackMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: "assistant",
          text: `Processed command: "${query}". Autonomous orchestrator active.`,
          time: new Date().toLocaleTimeString(),
          tag: "VOICE",
        };
        setChatMessages((prev) => [...prev, fallbackMsg]);
        speakText(fallbackMsg.text);
      }
    } catch {
      const fallbackMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        text: `Executing: "${query}". Neural dispatch complete.`,
        time: new Date().toLocaleTimeString(),
        tag: "VOICE",
      };
      setChatMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setAssistantState("STANDBY");
    }
  };

  // ── 1-Click Viral Short Generator ───────────────────────────────────────
  const handleGenerateShort = async () => {
    if (isGenerating || batchRunning) return;

    try {
      setIsGenerating(true);
      setCompletedVideoUrl(null);
      setProgressPercent(10);
      setAssistantState("GENERATING");
      setCurrentStep("Synthesizing viral retention script & hooks...");

      const payload = {
        topic: customTopic.trim() || selectedNiche,
        voice: selectedVoice,
        resolution,
        useDefaultBackground: true,
      };

      const progressSteps = [
        { percent: 25, label: "Generating high-retention script..." },
        { percent: 50, label: "Synthesizing 24kHz studio voiceover..." },
        { percent: 75, label: "Aligning TikTok karaoke subtitles..." },
        { percent: 90, label: "Rendering 9:16 vertical video composition..." },
      ];

      let stepIdx = 0;
      const progressTimer = setInterval(() => {
        if (stepIdx < progressSteps.length) {
          const s = progressSteps[stepIdx]!;
          setProgressPercent(s.percent);
          setCurrentStep(s.label);
          stepIdx++;
        }
      }, 900);

      const res = await fetch("/api/v1/agent/generate-short", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      clearInterval(progressTimer);

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      setProgressPercent(100);
      setCurrentStep("Complete · 9:16 vertical video ready");
      setAssistantState("STANDBY");

      if (data.script) setGeneratedScript(data.script);
      if (data.videoUrl) setCompletedVideoUrl(data.videoUrl);

      const successNotice: ChatMessage = {
        id: Date.now().toString(),
        sender: "assistant",
        text: `Successfully generated viral short for topic "${payload.topic}"!\nRender duration: ${data.durationSeconds || "4"}s · Resolution: ${resolution} (60fps)\nVideo ready in preview player.`,
        time: new Date().toLocaleTimeString(),
        tag: "AUDIO",
      };
      setChatMessages((prev) => [...prev, successNotice]);
      speakText(`Your video has finished rendering and is ready to download!`);

      toast.success(
        "Video Rendered",
        `Short generated in ${data.durationSeconds || "4.1"}s. Ready to preview.`,
      );
    } catch (err: any) {
      toast.error("Generation Failed", err.message || "Failed to render viral short");
      setCurrentStep("Generation aborted due to error");
      setAssistantState("STANDBY");
    } finally {
      setIsGenerating(false);
    }
  };

  // Undo Helper
  const handleUndo = () => {
    if (undoHistory.length === 0) {
      toast.info("Undo Stack Empty", "No reversible operations to roll back.");
      return;
    }
    const lastOp = undoHistory[undoHistory.length - 1];
    setUndoHistory((p) => p.slice(0, -1));
    toast.success("Action Reverted", `Undone: ${lastOp}`);
    setChatMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        sender: "system",
        text: `Reverted previous action: ${lastOp}`,
        time: new Date().toLocaleTimeString(),
        tag: "SYS",
      },
    ]);
  };

  // Memory Helper
  const handleAddMemory = () => {
    if (!newMemoryText.trim()) return;
    setMemories((p) => [...p, newMemoryText.trim()]);
    setNewMemoryText("");
    toast.success("Memory Added", "Saved preference to persistent assistant memory");
  };

  return (
    <div className="space-y-8 pb-12">
      {/* ── 1. PAGE HEADER ────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.06] pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Your AI creative team
          </h1>
          <p className="mt-1 text-sm text-gray-400 max-w-2xl">
            Autonomous specialized agents that research viral hooks, generate video content, narrate in studio voices, and automate your creator workstation.
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen(true)}
            icon={<SettingsIcon className="h-3.5 w-3.5" />}
          >
            Settings
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActiveTab("macros");
              workspaceSectionRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
            icon={<Workflow className="h-3.5 w-3.5" />}
          >
            Run Macro
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setActiveTab("generator");
              workspaceSectionRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
            icon={<Sparkles className="h-3.5 w-3.5" />}
          >
            Create with an agent
          </Button>
        </div>
      </div>

      {/* ── 2. METRICS STRIP ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/[0.07] bg-[#13141C] p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Fleet Status</span>
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <p className="mt-1.5 text-base font-semibold text-white">4 Online · Ready</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Autonomous collaboration active</p>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-[#13141C] p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Ghost Operator</span>
            <span className="text-[10px] rounded bg-blue-500/10 px-1 text-blue-400 font-medium">v2.4</span>
          </div>
          <p className="mt-1.5 text-base font-semibold text-white">16 Desktop Skills</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Macro RPA sequencing enabled</p>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-[#13141C] p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Speech Engine</span>
            <span className="text-[10px] rounded bg-purple-500/10 px-1 text-purple-400 font-medium">24kHz</span>
          </div>
          <p className="mt-1.5 text-base font-semibold text-white">Neural Edge TTS</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Word-boundary subtitle alignment</p>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-[#13141C] p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Workstation Vitals</span>
            <span className="text-[10px] text-emerald-400 font-medium">Healthy</span>
          </div>
          <p className="mt-1.5 text-base font-semibold text-white">CPU {systemStats.cpu}% · {systemStats.ramUsed}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Audio DSP 48kHz Stereo</p>
        </div>
      </div>

      {/* ── 3. THE AI AGENT FLEET (CARDS GRID) ─────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <div>
            <h2 className="text-base font-semibold text-white tracking-tight">Active Agents</h2>
            <p className="text-xs text-gray-400">Specialized autonomous roles available in your studio</p>
          </div>
          <span className="text-xs text-gray-400">4 of 4 agents ready</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Agent 1: Director Agent */}
          <AgentCard
            id="director"
            name="Director Agent"
            role="Production"
            description="Researches retention hooks, crafts viral scripts, and renders complete 9:16 vertical shorts with 60fps gameplay."
            icon={<Sparkles className="h-5 w-5 text-blue-400" />}
            status={isGenerating ? "running" : "ready"}
            statusText={isGenerating ? "Rendering Video..." : "Ready"}
            capabilities={["Hook Generator", "24kHz Edge TTS", "TikTok Subtitles", "Gameplay Canvas"]}
            recentActivity="Generated psychology viral short in 4.1s"
            primaryActionLabel="Generate Short"
            onPrimaryAction={() => {
              setActiveTab("generator");
              workspaceSectionRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
          />

          {/* Agent 2: Operator Agent */}
          <AgentCard
            id="operator"
            name="Operator Agent"
            role="Automation"
            description="Executes multi-step workstation macros, manages windows, mutes distracting alerts, and chains desktop routines."
            icon={<Workflow className="h-5 w-5 text-purple-400" />}
            status={isRunningMacro ? "running" : "ready"}
            statusText={isRunningMacro ? "Executing Macro..." : "Standby"}
            capabilities={["Pomodoro Focus", "Window Control", "Macro Chaining", "App Launcher"]}
            recentActivity="Executed Creator Workstation Setup (3 steps)"
            primaryActionLabel="Run Workflow"
            onPrimaryAction={() => {
              setActiveTab("macros");
              workspaceSectionRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
          />

          {/* Agent 3: Voice Studio Agent */}
          <AgentCard
            id="voice"
            name="Voice Studio Agent"
            role="Acoustics"
            description="Synthesizes multi-lingual studio narration with word-boundary alignment and custom creator voice cloning."
            icon={<Volume2 className="h-5 w-5 text-emerald-400" />}
            status="ready"
            statusText="Ready"
            capabilities={["Microsoft Neural Edge", "Zero-Shot Cloning", "Word Alignment", "Audio Normalizer"]}
            recentActivity="Synthesized JennyNeural sample at 24kHz"
            primaryActionLabel="Open Studio"
            onPrimaryAction={() => navigate("/studio")}
          />

          {/* Agent 4: Editor Agent */}
          <AgentCard
            id="editor"
            name="Editor Agent"
            role="Post-Production"
            description="Detects acoustic pauses, trims dead air with frame-accurate jump cutting, and auto-frames camera zoom."
            icon={<Film className="h-5 w-5 text-amber-400" />}
            status="ready"
            statusText="Ready"
            capabilities={["Silence Removal", "Auto-Zoom Framing", "Multi-Track Concat", "1080p Export"]}
            recentActivity="Trimmed 14.2s of dead air from screen recording"
            primaryActionLabel="Launch Cutter"
            onPrimaryAction={() => navigate("/creator")}
          />
        </div>
      </div>

      {/* ── 4. INTERACTIVE WORKSPACE DECK ─────────────────────────────── */}
      <div ref={workspaceSectionRef} className="rounded-xl border border-white/[0.08] bg-[#13141C] overflow-hidden">
        {/* Workspace Segmented Tabs */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2 bg-[#0E1017]">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("console")}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === "console"
                  ? "bg-white/[0.08] text-white"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.03]"
              }`}
            >
              <Terminal className="h-3.5 w-3.5 text-blue-400" />
              <span>Assistant Console</span>
            </button>

            <button
              onClick={() => setActiveTab("generator")}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === "generator"
                  ? "bg-white/[0.08] text-white"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.03]"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-purple-400" />
              <span>1-Click Short Generator</span>
            </button>

            <button
              onClick={() => setActiveTab("macros")}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === "macros"
                  ? "bg-white/[0.08] text-white"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.03]"
              }`}
            >
              <Workflow className="h-3.5 w-3.5 text-emerald-400" />
              <span>Ghost Operator Macros</span>
            </button>

            <button
              onClick={() => setActiveTab("activity")}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === "activity"
                  ? "bg-white/[0.08] text-white"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.03]"
              }`}
            >
              <Activity className="h-3.5 w-3.5 text-amber-400" />
              <span>Recent Activity</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400">
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Telemetry Online</span>
          </div>
        </div>

        {/* ── TAB CONTENT 1: ASSISTANT CONSOLE ───────────────────────── */}
        {activeTab === "console" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-white/[0.06]">
            {/* Left Col: Interactive Chat & Quick Commands (8 cols) */}
            <div className="lg:col-span-8 p-5 flex flex-col h-[520px]">
              {/* Event Stream Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-3">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-300">
                  <Terminal className="h-3.5 w-3.5 text-blue-400" />
                  <span>Interaction Stream</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const initMsg: ChatMessage = {
                        id: Date.now().toString(),
                        sender: "system",
                        text: "Interaction log cleared. Workspace listening.",
                        time: new Date().toLocaleTimeString(),
                        tag: "SYS",
                      };
                      setChatMessages([initMsg]);
                      try {
                        localStorage.setItem("soundwave_agent_chat_history", JSON.stringify([initMsg]));
                      } catch {}
                      toast.info("Log Cleared", "Assistant transcript cleared.");
                    }}
                    className="text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    Clear Log
                  </button>
                  <span className="text-gray-400">·</span>
                  <span className="text-xs text-emerald-400 font-medium">Listening</span>
                </div>
              </div>

              {/* Chat Message Stream */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-2 text-xs">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-xl p-3 leading-relaxed transition-all ${
                      msg.sender === "user"
                        ? "bg-blue-600/10 border border-blue-500/20 text-gray-100 ml-8"
                        : msg.sender === "assistant"
                        ? "bg-white/[0.03] border border-white/[0.06] text-gray-200 mr-8"
                        : "bg-white/[0.02] border border-white/[0.04] text-gray-400"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          msg.sender === "user"
                            ? "bg-blue-500/20 text-blue-400"
                            : msg.tag === "RPA"
                            ? "bg-purple-500/20 text-purple-400"
                            : msg.tag === "AUDIO"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-white/[0.06] text-gray-300"
                        }`}>
                          {msg.tag || (msg.sender === "user" ? "USER" : "AGENT")}
                        </span>
                        <span className="font-medium text-gray-300">
                          {msg.sender === "user" ? "You" : assistantName}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span>{msg.time}</span>
                        {msg.sender === "assistant" && (
                          <button
                            type="button"
                            onClick={() => speakText(msg.text)}
                            title="Replay Voice Speech"
                            className="p-1 hover:text-white text-gray-400 transition-colors"
                          >
                            <Volume2 className="h-3 w-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(msg.text);
                            toast.success("Copied", "Copied to clipboard");
                          }}
                          title="Copy text"
                          className="p-1 hover:text-white text-gray-400 transition-colors"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="whitespace-pre-line text-xs">{msg.text}</div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Quick Trigger Suggestion Chips */}
              <div className="flex items-center gap-1.5 pt-3 overflow-x-auto text-xs text-gray-400">
                <span className="text-[11px] font-medium text-gray-400 uppercase shrink-0">Quick:</span>
                <button
                  type="button"
                  onClick={() => runMacroWorkflow({ macroId: "creator_morning_prep" })}
                  className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs text-gray-300 hover:border-blue-500/30 hover:bg-white/[0.06] hover:text-white transition-colors"
                >
                  Morning Setup
                </button>
                <button
                  type="button"
                  onClick={() => runMacroWorkflow({ macroId: "deep_focus_pomodoro" })}
                  className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs text-gray-300 hover:border-blue-500/30 hover:bg-white/[0.06] hover:text-white transition-colors"
                >
                  Deep Focus Mode
                </button>
                <button
                  type="button"
                  onClick={() => triggerAction("system_monitor")}
                  className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs text-gray-300 hover:border-blue-500/30 hover:bg-white/[0.06] hover:text-white transition-colors"
                >
                  System Vitals
                </button>
                <button
                  type="button"
                  onClick={() => triggerAction("screen_processor", { action: "capture" })}
                  className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs text-gray-300 hover:border-blue-500/30 hover:bg-white/[0.06] hover:text-white transition-colors"
                >
                  Screen Capture
                </button>
              </div>

              {/* Input Command Bar */}
              <form onSubmit={handleUserSubmit} className="mt-2.5 flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Ask assistant or enter action (e.g. 'open browser', 'focus mode', 'suggest hook')..."
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white placeholder-gray-400 transition-colors focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <Button type="submit" size="sm" variant="primary" icon={<Send className="h-3 w-3" />}>
                  Send
                </Button>
              </form>
            </div>

            {/* Right Col: Acoustic Sphere & Audio Energy Monitor (4 cols) */}
            <div className="lg:col-span-4 p-5 flex flex-col justify-between h-[520px] bg-[#0F1017]">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                  <span className="text-xs font-semibold text-white">Acoustic Listener</span>
                  <span className="text-[11px] text-gray-400 font-mono">{audioDecibels} dBFS</span>
                </div>

                {/* Calm Particle Sphere Canvas */}
                <div 
                  className="relative flex items-center justify-center my-4 cursor-pointer"
                  onMouseMove={handleOrbMouseMove}
                  onMouseLeave={handleOrbMouseLeave}
                >
                  <canvas 
                    ref={canvasRef} 
                    width={220} 
                    height={220} 
                    className="rounded-full" 
                  />

                  <div className="pointer-events-none absolute text-center flex flex-col items-center">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
                      assistantState === "LISTENING" || isMicActive
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                        : assistantState === "THINKING"
                        ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                        : assistantState === "SPEAKING"
                        ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                        : assistantState === "GENERATING"
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                        : "bg-white/[0.04] border-white/[0.08] text-gray-300"
                    }`}>
                      {assistantState}
                    </span>
                    <p className="text-xs font-medium text-white mt-1">
                      {isGenerating ? `${progressPercent}%` : assistantName}
                    </p>
                  </div>
                </div>

                {/* Energy dBFS Meter */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span>Input Energy</span>
                    <span>{audioDecibels} dBFS</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[-42, -36, -30, -24, -18, -12, -6, -3].map((val, idx) => (
                      <div
                        key={idx}
                        className={`h-2 flex-1 rounded-xs transition-colors duration-150 ${
                          audioDecibels >= val
                            ? val >= -6
                              ? "bg-rose-500"
                              : val >= -18
                              ? "bg-amber-400"
                              : "bg-blue-500"
                            : "bg-white/[0.08]"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Mic PTT Button */}
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isMicActive;
                      setIsMicActive(next);
                      setAssistantState(next ? "LISTENING" : "STANDBY");
                      if (next) {
                        toast.info("Microphone Active", "Listening for voice instructions...");
                      } else {
                        toast.info("Microphone Off", "Standby mode.");
                      }
                    }}
                    className={`w-full flex items-center justify-center gap-2 rounded-lg py-2 px-3 text-xs font-medium transition-all ${
                      isMicActive
                        ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-sm"
                        : "bg-white/[0.04] border border-white/[0.08] text-gray-300 hover:border-white/[0.14] hover:text-white"
                    }`}
                  >
                    {isMicActive ? <Mic className="h-3.5 w-3.5 text-emerald-400" /> : <MicOff className="h-3.5 w-3.5 text-gray-400" />}
                    <span>{isMicActive ? "Microphone Active (Click to Mute)" : "Push-to-Talk Microphone"}</span>
                  </button>
                </div>
              </div>

              {/* Operation Status */}
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-center">
                <span className="text-xs font-medium text-gray-300">{currentStep}</span>
                {isGenerating && (
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB CONTENT 2: 1-CLICK VIRAL SHORT GENERATOR ───────────── */}
        {activeTab === "generator" && (
          <div className="p-6 space-y-6">
            <div className="max-w-3xl">
              <h3 className="text-base font-semibold text-white">Autonomous Viral Short Generator</h3>
              <p className="mt-1 text-xs text-gray-400">
                Select a high-retention niche or specify a custom topic. Soundwave scripts the curiosity hook, synthesizes 24kHz studio narration, generates word-level TikTok subtitles, and renders 9:16 vertical video at 60fps.
              </p>
            </div>

            {/* Niche Selector Grid */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-300">Select Content Niche</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {NICHES.map((n) => {
                  const isSelected = selectedNiche === n.id;
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        setSelectedNiche(n.id);
                        if (!customTopic) setCustomTopic(n.name);
                      }}
                      className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                        isSelected
                          ? "border-blue-500 bg-blue-500/10 text-white shadow-sm"
                          : "border-white/[0.06] bg-white/[0.02] text-gray-300 hover:border-white/[0.12] hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="p-1 rounded-md bg-white/[0.06]">
                          {getNicheIcon(n.iconName)}
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 text-blue-400" />}
                      </div>
                      <span className="text-xs font-semibold text-white mt-1">{n.name}</span>
                      <span className="text-[11px] text-gray-400 line-clamp-1">{n.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Topic Input & Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-gray-300">Custom Topic or Hook (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. The Psychology of Why We Procrastinate"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-300">Voiceover Talent</label>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="en-US-JennyNeural">Jenny (en-US, Expressive Female)</option>
                  <option value="en-US-GuyNeural">Guy (en-US, Confident Male)</option>
                  <option value="en-US-ChristopherNeural">Christopher (en-US, Authority Male)</option>
                  <option value="en-US-AriaNeural">Aria (en-US, Engaging Female)</option>
                  <option value="en-GB-SoniaNeural">Sonia (en-GB, British Female)</option>
                  {clonedVoices.map((v) => (
                    <option key={v.id} value={`clone:${v.id}`}>Cloned: {v.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Resolution & CTA */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-white/[0.06]">
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">Resolution:</span>
                <div className="flex items-center rounded-lg border border-white/[0.08] p-0.5 bg-white/[0.02]">
                  <button
                    type="button"
                    onClick={() => setResolution("720p")}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      resolution === "720p" ? "bg-white/[0.08] text-white" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    720p (Fast)
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolution("1080p")}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      resolution === "1080p" ? "bg-white/[0.08] text-white" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    1080p (HQ)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      setBatchRunning(true);
                      toast.info("Batch Started", "Generating 7 shorts across all niches...");
                      for (const n of NICHES) {
                        await fetch("/api/v1/agent/generate-short", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ topic: n.id, voice: selectedVoice, resolution: "720p", useDefaultBackground: true }),
                        });
                      }
                      toast.success("Batch Completed", "All 7 viral shorts generated.");
                    } finally {
                      setBatchRunning(false);
                    }
                  }}
                  disabled={isGenerating || batchRunning}
                >
                  {batchRunning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Batch All 7 Niches"}
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleGenerateShort}
                  loading={isGenerating}
                  icon={<Sparkles className="h-3.5 w-3.5" />}
                >
                  {isGenerating ? `Rendering (${progressPercent}%)` : "Generate 1-Click Short"}
                </Button>
              </div>
            </div>

            {/* Completed Output Preview Card */}
            {(completedVideoUrl || generatedScript) && (
              <div className="mt-6 rounded-xl border border-white/[0.08] bg-[#0E1017] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <h4 className="text-sm font-semibold text-white">Generated Video Ready</h4>
                  </div>
                  {completedVideoUrl && (
                    <a
                      href={completedVideoUrl}
                      download
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download Video (.mp4)
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {completedVideoUrl && (
                    <div className="rounded-lg overflow-hidden border border-white/[0.08] bg-black max-w-[240px] mx-auto">
                      <video
                        src={completedVideoUrl}
                        controls
                        autoPlay
                        loop
                        className="w-full aspect-[9/16] object-cover"
                      />
                    </div>
                  )}

                  {generatedScript && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-400">Viral Narration Script</label>
                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-gray-300 font-mono whitespace-pre-wrap max-h-56 overflow-y-auto">
                        {generatedScript}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB CONTENT 3: GHOST OPERATOR MACROS ────────────────────── */}
        {activeTab === "macros" && (
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-white">Ghost Operator Macro RPA</h3>
                <p className="mt-1 text-xs text-gray-400">
                  Automate workstation routines with natural language prompt decomposition and multi-step chaining.
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setMacroModalOpen(true)}
                icon={<Plus className="h-3.5 w-3.5" />}
              >
                Create Custom Macro
              </Button>
            </div>

            {/* Natural Language Prompt Decomposer */}
            <form onSubmit={handleDecomposePrompt} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter compound prompt (e.g. 'open chrome, set volume to 75%, and check vitals')..."
                value={nlMacroPrompt}
                onChange={(e) => setNlMacroPrompt(e.target.value)}
                className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={isDecomposingNl}
                icon={<Zap className="h-3.5 w-3.5" />}
              >
                Decompose & Run
              </Button>
            </form>

            {/* Built-in & Custom Workflows Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {macrosList.map((macro) => (
                <div
                  key={macro.id}
                  className="rounded-xl border border-white/[0.07] bg-[#161822] p-4 flex flex-col justify-between hover:border-white/[0.12] transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-white">{macro.name}</h4>
                      <span className="text-[10px] rounded bg-white/[0.06] px-1.5 py-0.5 text-gray-400">
                        {macro.steps.length} steps
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">{macro.description}</p>

                    <div className="mt-3 flex flex-wrap gap-1">
                      {macro.steps.map((st, i) => (
                        <span
                          key={i}
                          className="rounded bg-white/[0.03] border border-white/[0.05] px-1.5 py-0.5 text-[10px] text-gray-400"
                        >
                          {st.action}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                    {!macro.isBuiltin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomMacro(macro.id)}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => runMacroWorkflow({ macroId: macro.id })}
                      disabled={isRunningMacro}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
                    >
                      <Play className="h-3 w-3" />
                      Run Workflow
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Telemetry Execution Report */}
            {activeExecutionReport && (
              <div className="rounded-xl border border-white/[0.08] bg-[#0E1017] p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-white">{activeExecutionReport.workflowName}</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {activeExecutionReport.totalDurationMs}ms · {activeExecutionReport.stepResults.length} steps
                  </span>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {activeExecutionReport.stepResults.map((step, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs text-gray-300">
                      <span className="truncate">
                        {step.status === "SUCCESS" ? "✓" : "⚠"} {step.description || step.action}
                      </span>
                      <span className="text-gray-400 shrink-0 text-[11px]">{step.durationMs}ms</span>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-gray-400 pt-2 border-t border-white/[0.06]">
                  {activeExecutionReport.summary}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── TAB CONTENT 4: RECENT ACTIVITY ─────────────────────────── */}
        {activeTab === "activity" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Recent Activity & Execution Logs</h3>
                <p className="mt-1 text-xs text-gray-400">
                  Chronological audit of automated actions, video renders, and macro executions
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setChatMessages([]);
                  setActiveExecutionReport(null);
                  toast.info("History Cleared", "Cleared recent activity buffer.");
                }}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                Clear History
              </button>
            </div>

            {chatMessages.length === 0 && !activeExecutionReport ? (
              <div className="text-center py-12 border border-dashed border-white/[0.08] rounded-xl">
                <Activity className="h-8 w-8 text-gray-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-300">No recent activity</p>
                <p className="text-xs text-gray-400 mt-1">Actions performed by your AI agents will appear here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {chatMessages.slice().reverse().map((msg) => (
                  <div
                    key={msg.id}
                    className="flex items-start justify-between rounded-lg border border-white/[0.05] bg-white/[0.02] p-3 text-xs"
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 flex h-2 w-2 rounded-full ${
                        msg.sender === "user" ? "bg-blue-400" : msg.tag === "RPA" ? "bg-purple-400" : "bg-emerald-400"
                      }`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">
                            {msg.sender === "user" ? "User Command" : msg.tag === "RPA" ? "Ghost Macro" : assistantName}
                          </span>
                          <span className="text-[11px] text-gray-400">{msg.time}</span>
                        </div>
                        <p className="mt-1 text-gray-300 line-clamp-2">{msg.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 5. SETTINGS DRAWER / MODAL ─────────────────────────────────── */}
      {settingsOpen && (
        <Modal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          title="Studio Agent Settings"
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-300">Assistant Name</label>
              <input
                type="text"
                value={assistantName}
                onChange={(e) => setAssistantName(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <div>
                <p className="text-xs font-medium text-white">Voice Speech Feedback</p>
                <p className="text-[11px] text-gray-400">Speak assistant replies aloud via neural audio synthesis</p>
              </div>
              <button
                type="button"
                onClick={() => setVoiceFeedback(!voiceFeedback)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  voiceFeedback ? "bg-blue-600 text-white" : "bg-white/[0.08] text-gray-400"
                }`}
              >
                {voiceFeedback ? "Enabled" : "Disabled"}
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-300">Learned Preferences & Memory</label>
              <div className="max-h-28 overflow-y-auto space-y-1 border border-white/[0.06] rounded-lg p-2 bg-white/[0.02]">
                {memories.map((m, i) => (
                  <div key={i} className="text-xs text-gray-300 py-0.5 flex items-start gap-1.5">
                    <span className="text-blue-400">·</span>
                    <span>{m}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Add custom preference to memory..."
                  value={newMemoryText}
                  onChange={(e) => setNewMemoryText(e.target.value)}
                  className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                />
                <Button variant="outline" size="sm" onClick={handleAddMemory}>
                  Add
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-300">Undo & Confirmation Stack</label>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-300">Reversible Operations: {undoHistory.length}</span>
                  <Button variant="outline" size="sm" onClick={handleUndo}>
                    Undo Last Action
                  </Button>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/[0.06] flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setSettingsOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── 6. CREATE CUSTOM MACRO MODAL ───────────────────────────────── */}
      {macroModalOpen && (
        <Modal
          open={macroModalOpen}
          onClose={() => setMacroModalOpen(false)}
          title="Create Ghost Operator Macro"
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-300">Macro Name</label>
              <input
                type="text"
                placeholder="e.g. Creator Evening Backup"
                value={newMacroName}
                onChange={(e) => setNewMacroName(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-300">Prompt Decomposition</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. open browser, set volume to 50%, check stats"
                  value={newMacroNlInput}
                  onChange={(e) => setNewMacroNlInput(e.target.value)}
                  className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDecomposeForBuilder}
                  loading={isDecomposingNl}
                >
                  Generate Steps
                </Button>
              </div>
            </div>

            {builderSteps.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-300">Steps ({builderSteps.length})</label>
                <div className="max-h-36 overflow-y-auto space-y-1 border border-white/[0.06] rounded-lg p-2 bg-white/[0.02]">
                  {builderSteps.map((st, i) => (
                    <div key={i} className="flex items-center justify-between text-xs text-gray-300 py-1">
                      <span>{i + 1}. {st.description || st.action}</span>
                      <span className="text-gray-500 text-[10px]">{st.action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setMacroModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveMacro}>
                Save Macro
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
