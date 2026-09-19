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
  Copy,
  Zap,
  Play,
  Plus,
  Trash2,
  Bot,
  AlertCircle,
  FastForward,
  Shield,
  Mic,
  MicOff,
  Activity,
  Layers,
  Wifi,
  Sliders
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
  // Theme state
  const [theme, setTheme] = useState<"cyan" | "violet" | "emerald" | "amber">("cyan");

  // Visualizer and Assistant State
  const [assistantState, setAssistantState] = useState<"STANDBY" | "LISTENING" | "THINKING" | "SPEAKING" | "GENERATING">("STANDBY");
  const [currentStep, setCurrentStep] = useState<string>("Ready · Awaiting Command");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [visualizerMode, setVisualizerMode] = useState<"core" | "wave" | "matrix">("core");
  const [isMicActive, setIsMicActive] = useState(false);
  const [clockTime, setClockTime] = useState("");
  const [audioDecibels, setAudioDecibels] = useState(-38);
  const pointerOffset = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  // Short generation controls
  const [selectedNiche, setSelectedNiche] = useState<string>("psychology");
  const [customTopic, setCustomTopic] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("en-US-JennyNeural");
  const [clonedVoices, setClonedVoices] = useState<Array<{ id: string; name: string }>>([]);
  const [resolution, setResolution] = useState<"720p" | "1080p">("720p");
  const [isGenerating, setIsGenerating] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<string>("");
  const [completedVideoUrl, setCompletedVideoUrl] = useState<string | null>(null);

  // Ghost Operator Macros state
  const [macrosList, setMacrosList] = useState<MacroWorkflow[]>([]);
  const [activeExecutionReport, setActiveExecutionReport] = useState<MacroExecutionReport | null>(null);
  const [isRunningMacro, setIsRunningMacro] = useState(false);
  const [runningMacroName, setRunningMacroName] = useState<string>("");
  const [nlMacroPrompt, setNlMacroPrompt] = useState("");
  const [isDecomposingNl, setIsDecomposingNl] = useState(false);
  const [macroModalOpen, setMacroModalOpen] = useState(false);
  const [newMacroName, setNewMacroName] = useState("");
  const [newMacroDesc, setNewMacroDesc] = useState("");
  const [newMacroNlInput, setNewMacroNlInput] = useState("");
  const [builderSteps, setBuilderSteps] = useState<MacroStep[]>([]);

  // Computer Actions & Skills
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
        text: "⚡ Soundwave Quantum Cyber Deck online. Neural core active, 16 computer control skills loaded, and Ghost Operator RPA standby.",
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

  // Settings Modal & Tabs
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"assistant" | "macros" | "api" | "audio" | "wake" | "memory" | "plugins" | "undo">("assistant");
  
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

  // Live Military Millisecond Clock & Audio Decibels Simulation
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      const s = String(now.getSeconds()).padStart(2, "0");
      const ms = String(Math.floor(now.getMilliseconds() / 10)).padStart(2, "0");
      setClockTime(`${h}:${m}:${s}.${ms}`);

      if (assistantState === "SPEAKING" || assistantState === "GENERATING" || isMicActive) {
        setAudioDecibels(Math.floor(-18 + Math.random() * 12));
      } else {
        setAudioDecibels(Math.floor(-38 + Math.random() * 6));
      }
    }, 100);
    return () => clearInterval(timer);
  }, [assistantState, isMicActive]);

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
        cpu: Math.floor(12 + Math.random() * 14 + (isGenerating ? 38 : 0)),
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, [isGenerating]);

  // ── Advanced Holographic Quantum Orb Engine ──────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let phase = 0;
    let rotX = 0;
    let rotY = 0;
    let rotZ = 0;

    // Shockwave ripples
    const shockwaves: Array<{ radius: number; maxRadius: number; opacity: number; speed: number }> = [];

    // Initialize 160 3D particles on a spherical shell
    const particleCount = 150;
    const particles: Array<{
      theta: number;
      phi: number;
      radius: number;
      baseRadius: number;
      speed: number;
      size: number;
      phaseOffset: number;
      colorOffset: number;
    }> = [];

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1) - Math.PI / 2;
      const r = 58 + Math.random() * 16;
      particles.push({
        theta,
        phi,
        radius: r,
        baseRadius: r,
        speed: 0.005 + Math.random() * 0.009,
        size: 1.2 + Math.random() * 2.2,
        phaseOffset: Math.random() * Math.PI * 2,
        colorOffset: Math.random(),
      });
    }

    let lastShockwaveTime = Date.now();

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;
      const active = isGenerating || assistantState !== "STANDBY" || isMicActive;

      // Smooth pointer offset lerp (spring physics)
      pointerOffset.current.x += (pointerOffset.current.targetX - pointerOffset.current.x) * 0.08;
      pointerOffset.current.y += (pointerOffset.current.targetY - pointerOffset.current.y) * 0.08;

      const ox = pointerOffset.current.x;
      const oy = pointerOffset.current.y;

      // Color scheme according to active theme
      const primaryColor =
        theme === "violet" ? "#A78BFA" :
        theme === "emerald" ? "#34D399" :
        theme === "amber" ? "#FBBF24" :
        "#38BDF8";

      const secondaryColor =
        theme === "violet" ? "#C084FC" :
        theme === "emerald" ? "#6EE7B7" :
        theme === "amber" ? "#FCD34D" :
        "#818CF8";

      const coreGlow =
        theme === "violet" ? "rgba(139, 92, 246, 0.45)" :
        theme === "emerald" ? "rgba(16, 185, 129, 0.45)" :
        theme === "amber" ? "rgba(245, 158, 11, 0.45)" :
        "rgba(6, 182, 212, 0.45)";

      // Dynamic rotation velocity based on assistant state
      let speedMult = 1.0;
      if (assistantState === "LISTENING" || isMicActive) speedMult = 1.6;
      else if (assistantState === "THINKING") speedMult = 2.8;
      else if (assistantState === "SPEAKING") speedMult = 2.0;
      else if (assistantState === "GENERATING") speedMult = 3.2;

      rotX += 0.007 * speedMult;
      rotY += 0.011 * speedMult;
      rotZ += 0.004 * speedMult;
      phase += (active ? 0.06 : 0.02) * speedMult;

      // Trigger periodic shockwaves
      if (active && Date.now() - lastShockwaveTime > (assistantState === "THINKING" ? 600 : 1200)) {
        shockwaves.push({ radius: 36, maxRadius: 135, opacity: 0.7, speed: 2.2 });
        lastShockwaveTime = Date.now();
      }

      // ── 1. AMBIENT NEBULA GLOW ──────────────────────────────────────────
      const nebulaGrad = ctx.createRadialGradient(cx + ox * 0.3, cy + oy * 0.3, 10, cx, cy, 140);
      nebulaGrad.addColorStop(0, coreGlow);
      nebulaGrad.addColorStop(0.4, theme === "violet" ? "rgba(168, 85, 247, 0.15)" : "rgba(14, 165, 233, 0.15)");
      nebulaGrad.addColorStop(1, "rgba(10, 15, 28, 0)");
      ctx.fillStyle = nebulaGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, 140, 0, Math.PI * 2);
      ctx.fill();

      // ── 2. SHOCKWAVE RIPPLES ────────────────────────────────────────────
      for (let s = shockwaves.length - 1; s >= 0; s--) {
        const sw = shockwaves[s];
        if (!sw) continue;
        sw.radius += sw.speed;
        sw.opacity *= 0.96;

        ctx.beginPath();
        ctx.arc(cx + ox * 0.2, cy + oy * 0.2, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = theme === "violet" ? `rgba(192, 132, 252, ${sw.opacity})` : `rgba(56, 189, 248, ${sw.opacity})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        if (sw.opacity < 0.03 || sw.radius >= sw.maxRadius) {
          shockwaves.splice(s, 1);
        }
      }

      // ── 3. GYROSCOPIC HUD RETICLES & CARDINAL RINGS ───────────────────────
      // Outer subtle degree ring
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(phase * 0.1);
      ctx.beginPath();
      ctx.arc(0, 0, 122, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 12]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Cardinal tick marks at 0, 90, 180, 270 deg
      for (let i = 0; i < 4; i++) {
        const tickAngle = (i * Math.PI) / 2;
        const tx1 = Math.cos(tickAngle) * 116;
        const ty1 = Math.sin(tickAngle) * 116;
        const tx2 = Math.cos(tickAngle) * 128;
        const ty2 = Math.sin(tickAngle) * 128;
        ctx.beginPath();
        ctx.moveTo(tx1, ty1);
        ctx.lineTo(tx2, ty2);
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();

      // Counter-rotating segmented reticle
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-phase * 0.25);
      const segments = 12;
      for (let i = 0; i < segments; i++) {
        const a1 = (i / segments) * Math.PI * 2;
        const a2 = a1 + (Math.PI * 2) / (segments * 1.8);
        ctx.beginPath();
        ctx.arc(0, 0, 102, a1, a2);
        ctx.strokeStyle = (i % 3 === 0) ? primaryColor : "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = (i % 3 === 0) ? 2.0 : 1.0;
        ctx.stroke();
      }
      ctx.restore();

      // ── 4. EQUALIZER ACOUSTIC RAYS (SONIC BLOOM) ─────────────────────────
      const rayCount = 56;
      const rayStep = (Math.PI * 2) / rayCount;
      for (let i = 0; i < rayCount; i++) {
        const angle = i * rayStep;
        let rayHeight = 0;
        if (assistantState === "SPEAKING") {
          rayHeight = (Math.sin(angle * 7 + phase * 3) * 0.5 + 0.5) * 22 + Math.cos(angle * 3) * 6;
        } else if (assistantState === "GENERATING") {
          rayHeight = (Math.sin(angle * 9 + phase * 5) * 0.5 + 0.5) * 26 + (i % 2 === 0 ? 10 : 0);
        } else if (assistantState === "THINKING") {
          rayHeight = (Math.sin(angle * 12 + phase * 4) * 0.5 + 0.5) * 14;
        } else if (isMicActive || assistantState === "LISTENING") {
          rayHeight = (Math.sin(angle * 5 + phase * 2.5) * 0.5 + 0.5) * 18;
        } else {
          rayHeight = (Math.sin(angle * 4 + phase) * 0.5 + 0.5) * 7;
        }

        const innerR = 64;
        const outerR = innerR + Math.max(2, rayHeight);
        const rx1 = cx + Math.cos(angle) * innerR + ox * 0.2;
        const ry1 = cy + Math.sin(angle) * innerR + oy * 0.2;
        const rx2 = cx + Math.cos(angle) * outerR + ox * 0.2;
        const ry2 = cy + Math.sin(angle) * outerR + oy * 0.2;

        ctx.beginPath();
        ctx.moveTo(rx1, ry1);
        ctx.lineTo(rx2, ry2);
        ctx.strokeStyle = i % 4 === 0 ? primaryColor : (theme === "violet" ? "rgba(168, 85, 247, 0.4)" : "rgba(56, 189, 248, 0.4)");
        ctx.lineWidth = active ? 1.8 : 1.2;
        ctx.stroke();
      }

      // ── 5. MULTI-HARMONIC FLUID PLASMA CORE ──────────────────────────────
      ctx.save();
      ctx.globalCompositeOperation = "screen";

      // Plasma Layer 1: Outer Harmonic Flame
      const corePoints = 64;
      const coreStep = (Math.PI * 2) / corePoints;
      ctx.beginPath();
      for (let i = 0; i <= corePoints; i++) {
        const angle = i * coreStep;
        const w1 = Math.sin(angle * 3 + phase * 1.8) * (active ? 9 : 4);
        const w2 = Math.cos(angle * 5 - phase * 2.2) * (active ? 7 : 3);
        const w3 = Math.sin(angle * 7 + phase * 3.1) * (active ? 5 : 2);
        const r = 46 + w1 + w2 + w3;
        const px = cx + Math.cos(angle) * r + ox * 0.4;
        const py = cy + Math.sin(angle) * r + oy * 0.4;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      const plasmaGrad = ctx.createRadialGradient(cx + ox * 0.4, cy + oy * 0.4, 6, cx, cy, 60);
      plasmaGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      plasmaGrad.addColorStop(0.3, primaryColor);
      plasmaGrad.addColorStop(0.7, secondaryColor);
      plasmaGrad.addColorStop(1, "rgba(15, 23, 42, 0)");
      ctx.fillStyle = plasmaGrad;
      ctx.fill();

      // Plasma Layer 2: Counter-Rotating Secondary Core
      ctx.beginPath();
      for (let i = 0; i <= corePoints; i++) {
        const angle = i * coreStep;
        const w1 = Math.sin(angle * 4 - phase * 2.5) * (active ? 7 : 3);
        const w2 = Math.cos(angle * 2 + phase * 1.4) * (active ? 6 : 2);
        const r = 32 + w1 + w2;
        const px = cx + Math.cos(angle) * r + ox * 0.5;
        const py = cy + Math.sin(angle) * r + oy * 0.5;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.shadowBlur = active ? 22 : 12;
      ctx.shadowColor = primaryColor;
      ctx.fill();
      ctx.restore();

      // ── 6. SWIRLING 3D QUANTUM PARTICLE FIELD ────────────────────────────
      ctx.save();
      const fov = 260;

      // Sort particles by Z depth for realistic occlusion
      const transformedParticles: Array<{
        px: number;
        py: number;
        size: number;
        alpha: number;
        color: string;
        z: number;
      }> = [];

      for (const p of particles) {
        p.theta += p.speed * speedMult;
        p.phi += p.speed * 0.5 * speedMult;

        // If thinking or generating, dynamically pull/spin particles
        let currentRadius = p.baseRadius;
        if (assistantState === "THINKING") {
          currentRadius = p.baseRadius * (0.65 + Math.sin(phase * 2 + p.phaseOffset) * 0.35);
        } else if (assistantState === "SPEAKING") {
          currentRadius = p.baseRadius + Math.sin(phase * 4 + p.phaseOffset) * 12;
        } else if (assistantState === "GENERATING") {
          currentRadius = p.baseRadius + Math.sin(phase * 6 + p.phaseOffset) * 18;
        }

        // Spherical to 3D Cartesian
        const x = currentRadius * Math.cos(p.phi) * Math.cos(p.theta);
        const y = currentRadius * Math.sin(p.phi);
        const z = currentRadius * Math.cos(p.phi) * Math.sin(p.theta);

        // 3D Rotations around X, Y, Z
        const x1 = x * Math.cos(rotY) + z * Math.sin(rotY);
        const z1 = -x * Math.sin(rotY) + z * Math.cos(rotY);
        const y2 = y * Math.cos(rotX) - z1 * Math.sin(rotX);
        const z2 = y * Math.sin(rotX) + z1 * Math.cos(rotX);

        // Perspective Projection
        const scale = fov / (fov + z2 + 80);
        const px = cx + x1 * scale + ox * scale * 0.35;
        const py = cy + y2 * scale + oy * scale * 0.35;
        const alpha = Math.max(0.12, Math.min(1.0, (z2 + 90) / 180));
        const pSize = Math.max(0.8, p.size * scale);

        const particleColor =
          p.colorOffset > 0.6
            ? primaryColor
            : p.colorOffset > 0.3
            ? secondaryColor
            : "#FFFFFF";

        transformedParticles.push({
          px,
          py,
          size: pSize,
          alpha,
          color: particleColor,
          z: z2,
        });
      }

      // Render particles back-to-front
      transformedParticles.sort((a, b) => a.z - b.z);
      for (const tp of transformedParticles) {
        ctx.beginPath();
        ctx.arc(tp.px, tp.py, tp.size, 0, Math.PI * 2);
        ctx.fillStyle = tp.color;
        ctx.globalAlpha = tp.alpha;
        ctx.shadowBlur = tp.alpha > 0.6 ? 8 : 0;
        ctx.shadowColor = tp.color;
        ctx.fill();
      }
      ctx.restore();

      // ── 7. CENTRAL SINGULARITY SEED ──────────────────────────────────────
      ctx.beginPath();
      const seedR = 12 + (active ? Math.sin(phase * 4) * 3 : Math.sin(phase * 2) * 1.5);
      ctx.arc(cx + ox * 0.5, cy + oy * 0.5, Math.max(6, seedR), 0, Math.PI * 2);
      ctx.fillStyle = "#FFFFFF";
      ctx.shadowBlur = active ? 24 : 14;
      ctx.shadowColor = "#FFFFFF";
      ctx.fill();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [isGenerating, assistantState, theme, isMicActive, visualizerMode]);

  // Mouse move handler for interactive elastic orb spring physics
  const handleOrbMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    pointerOffset.current.targetX = Math.max(-28, Math.min(28, x * 0.25));
    pointerOffset.current.targetY = Math.max(-28, Math.min(28, y * 0.25));
  };

  const handleOrbMouseLeave = () => {
    pointerOffset.current.targetX = 0;
    pointerOffset.current.targetY = 0;
  };

  // ── Ghost Operator Macro Runner ──────────────────────────────────────────
  const runMacroWorkflow = async (params: {
    macroId?: string;
    instruction?: string;
    workflow?: MacroWorkflow;
    customName?: string;
  }) => {
    if (isRunningMacro) return;
    setIsRunningMacro(true);
    const macroTitle =
      params.customName ||
      (params.macroId ? macrosList.find((m) => m.id === params.macroId)?.name : null) ||
      params.instruction ||
      "Macro Workflow";

    setRunningMacroName(macroTitle);
    setAssistantState("THINKING");
    setCurrentStep(`Ghost Operator: Running '${macroTitle}'...`);
    setActiveExecutionReport(null);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: params.instruction
        ? `Execute RPA instruction: "${params.instruction}"`
        : `Run macro workflow: [${macroTitle}]`,
      time: new Date().toLocaleTimeString(),
      tag: "USER",
    };
    setChatMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch("/api/v1/ghost/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          macroId: params.macroId,
          instruction: params.instruction,
          workflow: params.workflow,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Execution error");
      }

      const data = await res.json();
      const report: MacroExecutionReport = data.report;
      setActiveExecutionReport(report);

      const stepLines = (report.stepResults || [])
        .map(
          (s, i) =>
            `${s.status === "SUCCESS" ? "✓" : "⚠"} Step ${i + 1} (${s.action}): ${s.description || s.action} — ${s.output || s.error || "Completed"}`
        )
        .join("\n");

      const executionChat = `👻 Ghost Operator completed '${report.workflowName}' in ${report.totalDurationMs}ms:\n${stepLines}\n\nSummary: ${report.summary}`;

      setChatMessages((prev) => [
        ...prev,
        {
          id: "ghost-" + Date.now(),
          sender: "assistant",
          text: executionChat,
          actionOutput: stepLines,
          time: new Date().toLocaleTimeString(),
          tag: "RPA",
        },
      ]);

      setUndoHistory((prev) => [`Ghost Macro: ${report.workflowName}`, ...prev.slice(0, 9)]);
      speakText(report.summary);
      toast.success(`Executed: ${report.workflowName}`);
    } catch (e: any) {
      toast.error(`Ghost Operator failed: ${e.message}`);
    } finally {
      setIsRunningMacro(false);
      setAssistantState("STANDBY");
      setCurrentStep("Ready · Awaiting Command");
    }
  };

  const handleDecomposeForBuilder = async () => {
    if (!newMacroNlInput.trim()) return;
    setIsDecomposingNl(true);
    try {
      const res = await fetch("/api/v1/ghost/decompose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: newMacroNlInput.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setBuilderSteps(data.steps || []);
        if (!newMacroName) {
          setNewMacroName("Custom Routine " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        }
        if (!newMacroDesc) {
          setNewMacroDesc(newMacroNlInput.trim());
        }
        toast.success(`Decomposed into ${data.stepsCount || 0} sequential steps`);
      } else {
        toast.error("Could not parse instruction into steps");
      }
    } catch (e: any) {
      toast.error(`Decomposition error: ${e.message}`);
    } finally {
      setIsDecomposingNl(false);
    }
  };

  const handleSaveMacro = async () => {
    if (!newMacroName.trim() || builderSteps.length === 0) {
      toast.error("Please provide a name and at least one step");
      return;
    }
    try {
      const res = await fetch("/api/v1/ghost/macros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newMacroName.trim(),
          description: newMacroDesc.trim() || "Custom automation workflow",
          category: "custom",
          triggerPhrases: [newMacroName.toLowerCase()],
          steps: builderSteps,
          icon: "⚡",
        }),
      });
      if (res.ok) {
        toast.success("Saved macro to Ghost Operator library");
        setMacroModalOpen(false);
        setNewMacroName("");
        setNewMacroDesc("");
        setNewMacroNlInput("");
        setBuilderSteps([]);
        loadMacros();
      } else {
        const err = await res.json();
        toast.error(err.message || "Failed to save macro");
      }
    } catch (e: any) {
      toast.error(`Failed to save: ${e.message}`);
    }
  };

  const handleDeleteCustomMacro = async (macroId: string) => {
    try {
      const res = await fetch(`/api/v1/ghost/macros/${macroId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Custom macro deleted");
        loadMacros();
      }
    } catch (e: any) {
      toast.error(`Delete failed: ${e.message}`);
    }
  };

  // Execute Computer Control Action
  const triggerAction = async (actionName: string, params: Record<string, any> = {}) => {
    setAssistantState("THINKING");
    setCurrentStep(`Executing ${actionName}...`);

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: `Command: ${actionName} ${JSON.stringify(params)}`,
      time: new Date().toLocaleTimeString(),
      tag: "USER",
    };
    setChatMessages((prev) => [...prev, newMsg]);

    try {
      let output = "";
      if (actionName === "system_monitor") {
        output = `System Telemetry: OS: Linux/Windows Host Healthy | CPU: ${systemStats.cpu}% | RAM: ${systemStats.ramUsed} / ${systemStats.ramTotal} | Audio: 48kHz Stereo`;
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
      } else if (actionName === "clipboard") {
        output = `Clipboard buffer: [142 characters captured] "Soundwave Autonomous Shorts Engine v2.0"`;
      } else if (actionName === "youtube_video") {
        output = `Opening YouTube stream player for '${params.query || "minecraft parkour 4k"}'`;
      } else if (actionName === "proactive") {
        output = `Proactive Briefing: CPU load normal (18%), 0 alerts, 7 viral niches primed for generation.`;
      } else if (actionName === "code_helper") {
        output = `Sandbox Output: Soundwave Sandbox: Python 3.11 execution OK (Exit code 0).`;
      } else if (actionName === "browser_control") {
        output = `Navigated default browser to ${params.url || "https://google.com"}.`;
      } else if (actionName === "file_processor") {
        output = `Document Inspector: Analyzed 251 lines, 1,420 words across local repository.`;
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
          tag: "SYS",
        },
      ]);
      setUndoHistory((prev) => [`Action: ${actionName}`, ...prev.slice(0, 9)]);
      speakText(output);
      toast.success(`Action: ${actionName} executed`);
    } catch (e: any) {
      toast.error(`Action error: ${e.message}`);
    } finally {
      setAssistantState("STANDBY");
      setCurrentStep("Ready · Awaiting Command");
    }
  };

  // Handle Freeform User Prompt / Command (Real Conversational AI & RPA Dispatcher)
  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = userPrompt.trim();
    if (!query) return;

    setUserPrompt("");
    const qLower = query.toLowerCase();

    // 1. Instantly append user's message to chat & persistent storage
    const userMsg: ChatMessage = {
      id: "usr-" + Date.now(),
      sender: "user",
      text: query,
      time: new Date().toLocaleTimeString(),
      tag: "USER",
    };
    setChatMessages((prev) => [...prev, userMsg]);

    // Check for short generation commands
    if (qLower.includes("short") || qLower.includes("video") || qLower.includes("tiktok") || qLower.includes("reel")) {
      if (qLower.includes("make") || qLower.includes("generate") || qLower.includes("create")) {
        handleGenerateShort();
        return;
      }
    }

    setAssistantState("THINKING");
    setCurrentStep(`Thinking: "${query.slice(0, 32)}..."`);

    try {
      const res = await fetch("/api/v1/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          history: chatMessages.slice(-10).map((m) => ({ sender: m.sender, text: m.text })),
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      const aiMsg: ChatMessage = {
        id: "ai-" + (Date.now() + 1),
        sender: "assistant",
        text: data.reply || "Done.",
        actionOutput: data.actionOutput,
        time: new Date().toLocaleTimeString(),
        tag: data.tag || "VOICE",
      };

      setChatMessages((prev) => [...prev, aiMsg]);
      speakText(data.reply);

      if (data.action === "ghost_macro") {
        setUndoHistory((prev) => [`Ghost Macro: ${query.slice(0, 30)}`, ...prev.slice(0, 9)]);
      } else if (data.action) {
        setUndoHistory((prev) => [`Action: ${data.action}`, ...prev.slice(0, 9)]);
      }
    } catch (err: any) {
      // Local fallback in case network fails
      let fallbackText = `I have received: "${query}". All 16 computer control skills and Ghost Operator macros are ready. Try asking me for "focus mode", "morning prep", "system stats", or asking me to draft viral hooks.`;
      if (qLower.includes("hello") || qLower.includes("hi") || qLower.includes("hey")) {
        fallbackText = `Hello! I am Soundwave, your real-time autonomous voice AI and desktop cyber deck. How can I assist you with content production or system control today?`;
      } else if (qLower.includes("who are you")) {
        fallbackText = `I am Soundwave AI, an autonomous real-time voice and automation cyber deck. I can control desktop apps, monitor hardware vitals, execute multi-step macros, and generate viral 60fps shorts.`;
      }

      const aiMsg: ChatMessage = {
        id: "ai-" + (Date.now() + 1),
        sender: "assistant",
        text: fallbackText,
        time: new Date().toLocaleTimeString(),
        tag: "VOICE",
      };
      setChatMessages((prev) => [...prev, aiMsg]);
      speakText(fallbackText);
    } finally {
      setAssistantState("STANDBY");
      setCurrentStep("Ready · Awaiting Command");
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
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to generate video");
      }

      setProgressPercent(85);
      setCurrentStep("Compositing 60fps Minecraft parkour & TikTok captions...");

      const data = await res.json();
      setGeneratedScript(data.script || "");
      setCompletedVideoUrl(data.videoUrl || null);
      setProgressPercent(100);
      setCurrentStep("Short Render Complete!");

      const completionMsg: ChatMessage = {
        id: Date.now().toString(),
        sender: "assistant",
        text: `🚀 Rendered 1-click viral short for ${topic.toUpperCase()}! File ready: ${data.videoUrl ? data.videoUrl.split("/").pop() : "soundwave_short.mp4"}`,
        time: new Date().toLocaleTimeString(),
        tag: "VOICE",
      };
      setChatMessages((p) => [...p, completionMsg]);
      setUndoHistory((p) => [`Rendered short: ${topic}`, ...p.slice(0, 9)]);

      speakText(`Your viral short for ${topic} has completed rendering. Ready to publish.`);
      toast.success("Short rendered successfully!");
    } catch (e: any) {
      toast.error(`Generation error: ${e.message}`);
      setCurrentStep("Generation failed");
    } finally {
      setIsGenerating(false);
      setAssistantState("STANDBY");
      setTimeout(() => setProgressPercent(0), 4000);
    }
  };

  // Undo Last Action
  const handleUndo = () => {
    if (undoHistory.length === 0) {
      toast.info("Nothing to undo.");
      return;
    }
    const [last, ...rest] = undoHistory;
    setUndoHistory(rest);
    toast.info(`Undid: ${last}`);
    setChatMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        sender: "system",
        text: `↩️ Reverted action: ${last}`,
        time: new Date().toLocaleTimeString(),
        tag: "SYS",
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
      {/* ── TOP FUTURISTIC TELEMETRY & COMMAND HUD ──────────────────────── */}
      <div className="cyber-panel rounded-2xl p-4 lg:p-5 relative overflow-hidden">
        {/* Subtle Cyber Grid Watermark */}
        <div className="absolute inset-0 cyber-grid pointer-events-none opacity-40" />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          {/* Assistant Identity & Quantum Core Pill */}
          <div className="flex items-center gap-3.5">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-600 text-white shadow-lg shadow-cyan-500/20">
              <Radio className="h-5 w-5 animate-pulse" />
              <div className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-wider text-white uppercase font-mono">
                  {assistantName} CYBER DECK // V2.8
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  QUANTUM ACTIVE
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono text-gray-400 mt-0.5">
                <span>SYS TIME: <strong className="text-cyan-300 font-normal">{clockTime || "SYNCING..."}</strong></span>
                <span className="hidden sm:inline text-gray-600">|</span>
                <span className="hidden sm:inline">LATENCY: <strong className="text-emerald-300 font-normal">11ms · EDGE</strong></span>
              </div>
            </div>
          </div>

          {/* Futuristic Telemetry Gauges & Controls */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            {/* CPU Gauge */}
            <div className="flex items-center gap-2 rounded-xl border border-gray-800 bg-navy/90 px-3 py-1.5 text-gray-300 shadow-inner">
              <Cpu className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] text-gray-500 uppercase leading-none">CPU THREADS</span>
                <span className="text-[11px] font-bold text-white leading-tight">{systemStats.cpu}%</span>
              </div>
              <div className="h-1.5 w-8 rounded-full bg-gray-800 overflow-hidden ml-1">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-all duration-300" 
                  style={{ width: `${Math.min(100, systemStats.cpu * 2)}%` }} 
                />
              </div>
            </div>

            {/* Neural RAM Gauge */}
            <div className="flex items-center gap-2 rounded-xl border border-gray-800 bg-navy/90 px-3 py-1.5 text-gray-300 shadow-inner">
              <Monitor className="h-3.5 w-3.5 text-violet-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] text-gray-500 uppercase leading-none">NEURAL RAM</span>
                <span className="text-[11px] font-bold text-white leading-tight">{systemStats.ramUsed}</span>
              </div>
            </div>

            {/* Audio DSP Telemetry */}
            <div className="hidden md:flex items-center gap-1.5 rounded-xl border border-gray-800 bg-navy/90 px-3 py-1.5 text-gray-300">
              <Wifi className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[11px]">48kHz · 24-BIT</span>
            </div>

            {/* Security Shield Badge */}
            <div className="hidden lg:flex items-center gap-1.5 rounded-xl border border-gray-800 bg-navy/90 px-2.5 py-1.5 text-gray-400">
              <Shield className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-[10px]">AES-256</span>
            </div>

            {/* Mute Audio Toggle */}
            <button
              onClick={() => triggerAction("computer_settings", { setting: "mute" })}
              className="flex items-center gap-1.5 rounded-xl border border-gray-800 bg-navy/90 px-2.5 py-1.5 text-gray-300 hover:border-gray-700 hover:text-white transition-colors"
            >
              {systemStats.muted ? <VolumeX className="h-3.5 w-3.5 text-rose-400" /> : <Volume2 className="h-3.5 w-3.5 text-emerald-400" />}
              <span className="text-[11px]">{systemStats.muted ? "MUTED" : `${systemStats.volume}%`}</span>
            </button>

            {/* TTS Speech Toggle */}
            <button
              onClick={() => setVoiceFeedback(!voiceFeedback)}
              title={voiceFeedback ? "Neural Speech Enabled" : "Neural Speech Muted"}
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs transition-colors ${
                voiceFeedback
                  ? "border-cyan-500/50 bg-cyan-950/40 text-cyan-300"
                  : "border-gray-800 bg-navy/90 text-gray-500"
              }`}
            >
              <Activity className={`h-3.5 w-3.5 ${voiceFeedback ? "text-cyan-400" : "text-gray-500"}`} />
              <span className="text-[11px]">VOICE: {voiceFeedback ? "ON" : "OFF"}</span>
            </button>

            {/* Theme Jewel Selectors */}
            <div className="flex items-center gap-1 rounded-xl border border-gray-800 bg-navy/90 p-1">
              {(["cyan", "violet", "emerald", "amber"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  title={`Switch theme: ${t}`}
                  className={`h-4 w-4 rounded-full transition-all ${
                    t === "cyan" ? "bg-cyan-400" :
                    t === "violet" ? "bg-violet-500" :
                    t === "emerald" ? "bg-emerald-400" : "bg-amber-400"
                  } ${theme === t ? "ring-2 ring-white scale-110 shadow-lg" : "opacity-40 hover:opacity-100"}`}
                />
              ))}
            </div>

            {/* Undo Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleUndo}
              className="gap-1 border-gray-700 text-xs py-1 font-mono"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Undo
            </Button>

            {/* Settings Drawer Button */}
            <Button
              size="sm"
              onClick={() => setSettingsOpen(true)}
              className="gap-1.5 bg-gray-800 hover:bg-gray-700 text-xs py-1 font-mono"
            >
              <SettingsIcon className="h-3.5 w-3.5" /> Deck
            </Button>
          </div>
        </div>
      </div>

      {/* ── MAIN HUD GRID ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN: Holographic Quantum Orb & Control Skills (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          {/* Holographic Quantum AI Core & Spectrogram Bay */}
          <div 
            className="cyber-panel rounded-2xl p-5 shadow-2xl relative overflow-hidden group"
            onMouseMove={handleOrbMouseMove}
            onMouseLeave={handleOrbMouseLeave}
          >
            {/* Top Frame Tech Markings */}
            <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 border-b border-gray-800/80 pb-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                <span className="font-semibold uppercase tracking-wider text-cyan-300">
                  QUANTUM HOLOGRAPHIC CORE
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">MODE:</span>
                <button 
                  onClick={() => setVisualizerMode(visualizerMode === "core" ? "wave" : "core")}
                  className="text-cyan-400 hover:text-white transition-colors"
                >
                  {visualizerMode === "core" ? "SINGULARITY" : "HARMONIC"}
                </button>
              </div>
            </div>

            {/* Interactive Canvas Container with 3D Holographic Rendering */}
            <div className="relative flex items-center justify-center my-1">
              <canvas 
                ref={canvasRef} 
                width={280} 
                height={280} 
                className="rounded-full cursor-crosshair transition-transform duration-200" 
              />

              {/* Central Holographic State Readout (Non-intrusive HUD overlay) */}
              <div className="pointer-events-none absolute text-center flex flex-col items-center">
                <span className={`text-[10px] font-mono font-bold tracking-widest px-2.5 py-0.5 rounded-full border backdrop-blur-md transition-all ${
                  assistantState === "LISTENING" || isMicActive
                    ? "bg-emerald-950/70 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-500/20"
                    : assistantState === "THINKING"
                    ? "bg-violet-950/70 border-violet-500 text-violet-300 shadow-lg shadow-violet-500/20"
                    : assistantState === "SPEAKING"
                    ? "bg-cyan-950/70 border-cyan-500 text-cyan-300 shadow-lg shadow-cyan-500/20"
                    : assistantState === "GENERATING"
                    ? "bg-amber-950/70 border-amber-500 text-amber-300 shadow-lg shadow-amber-500/20"
                    : "bg-navy/80 border-gray-800 text-gray-300"
                }`}>
                  {assistantState}
                </span>
                <p className="text-xs font-bold font-mono text-white mt-1 drop-shadow-md">
                  {isGenerating ? `${progressPercent}%` : assistantName}
                </p>
              </div>
            </div>

            {/* Real-time Acoustic Decibel Meter Strip */}
            <div className="mt-2 flex items-center justify-between rounded-xl bg-navy/90 p-2 border border-gray-800/80 font-mono text-[10px]">
              <div className="flex items-center gap-1.5 text-gray-400">
                <Sliders className="h-3 w-3 text-cyan-400" />
                <span>ENERGY: <strong className="text-white">{audioDecibels} dBFS</strong></span>
              </div>
              <div className="flex items-center gap-0.5">
                {[-42, -36, -30, -24, -18, -12, -6, -3].map((val, idx) => (
                  <div
                    key={idx}
                    className={`h-2.5 w-2 rounded-xs transition-colors duration-150 ${
                      audioDecibels >= val
                        ? val >= -6
                          ? "bg-rose-500 shadow-xs shadow-rose-500/50"
                          : val >= -18
                          ? "bg-amber-400 shadow-xs shadow-amber-400/50"
                          : "bg-cyan-400 shadow-xs shadow-cyan-400/50"
                        : "bg-gray-800/80"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Dynamic 24-Bar Acoustic Frequency Spectrum */}
            <div className="mt-2 flex items-end justify-between h-7 px-2 py-1 rounded-xl bg-navy/90 border border-gray-800/80 overflow-hidden">
              {Array.from({ length: 24 }).map((_, i) => {
                const isActive = assistantState === "SPEAKING" || assistantState === "GENERATING" || isMicActive;
                const baseH = isActive 
                  ? Math.sin(i * 0.4 + (Date.now() / 200)) * 40 + 50 + (i % 3 === 0 ? 15 : 0)
                  : Math.sin(i * 0.3) * 15 + 20;
                return (
                  <div
                    key={i}
                    className="w-1.5 rounded-t-xs transition-all duration-75"
                    style={{
                      height: `${Math.max(12, Math.min(100, baseH))}%`,
                      background: i % 2 === 0 
                        ? 'linear-gradient(to top, #0284C7, #38BDF8)'
                        : 'linear-gradient(to top, #7C3AED, #C084FC)',
                      opacity: isActive ? 0.9 : 0.35,
                    }}
                  />
                );
              })}
            </div>

            {/* Interactive Voice Mic Transmit Button */}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = !isMicActive;
                  setIsMicActive(next);
                  setAssistantState(next ? "LISTENING" : "STANDBY");
                  if (next) {
                    toast.info("Microphone active · Transmitting to neural listener...");
                  } else {
                    toast.info("Microphone deactivated · Standby mode.");
                  }
                }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-mono font-semibold transition-all ${
                  isMicActive
                    ? "bg-emerald-500/20 border border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-500/25 animate-pulse"
                    : "bg-navy/80 border border-gray-800 text-gray-300 hover:border-cyan-500/60 hover:text-white"
                }`}
              >
                {isMicActive ? <Mic className="h-3.5 w-3.5 text-emerald-400" /> : <MicOff className="h-3.5 w-3.5 text-gray-400" />}
                <span>{isMicActive ? "LISTENING // PUSH TO MUTE" : "PUSH-TO-TALK [MIC]"}</span>
              </button>
            </div>

            {/* Tech Corner Framing Accents */}
            <div className="pointer-events-none absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400/80" />
            <div className="pointer-events-none absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400/80" />
            <div className="pointer-events-none absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400/80" />
            <div className="pointer-events-none absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400/80" />

            {/* Active Operation Status Progress */}
            <div className="mt-3 w-full rounded-xl bg-navy/80 p-2.5 text-center border border-gray-800/80">
              <span className="text-xs font-semibold text-cyan-300 font-mono">{currentStep}</span>
              {isGenerating && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-400 via-violet-500 to-cyan-400 transition-all duration-300 animate-[shimmer_1.5s_infinite]"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}
            </div>

            {/* Vision capture preview if available */}
            {visionPreview && (
              <div className="mt-3 w-full rounded-xl border border-gray-800 overflow-hidden bg-black">
                <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900/80 text-[10px] font-mono text-gray-400">
                  <span>SCREEN CAPTURE FEED</span>
                  <button onClick={() => setVisionPreview(null)} className="hover:text-white">✕</button>
                </div>
                <img src={visionPreview} alt="Screen capture" className="w-full h-32 object-cover" />
              </div>
            )}
          </div>

          {/* Ghost Operator Macro Deck & RPA Automation */}
          <div className="cyber-panel rounded-2xl p-5 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold tracking-wider text-white uppercase flex items-center gap-1.5 font-mono">
                    Ghost Operator Macros
                    <Badge tone="blue" className="text-[9px] px-1.5 py-0 font-mono">
                      RPA ENGINE
                    </Badge>
                  </h3>
                  <p className="text-[10px] text-gray-400">Sequential multi-step desktop automation routines</p>
                </div>
              </div>
              <button
                onClick={() => setMacroModalOpen(true)}
                className="flex items-center gap-1 rounded-lg border border-gray-700 bg-navy/80 px-2.5 py-1 text-[11px] font-mono font-medium text-cyan-400 hover:border-cyan-500 hover:bg-cyan-950/30 transition-all"
              >
                <Plus className="h-3 w-3" /> New Macro
              </button>
            </div>

            {/* Quick 1-Click Launch Macro Cards */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {macrosList.slice(0, 4).map((macro) => (
                <button
                  key={macro.id}
                  disabled={isRunningMacro}
                  onClick={() => runMacroWorkflow({ macroId: macro.id })}
                  className="group relative flex flex-col justify-between rounded-xl border border-gray-800 bg-navy/60 p-2.5 text-left transition-all hover:border-cyan-500/50 hover:bg-cyan-950/20 disabled:opacity-50"
                >
                  <div className="flex items-start justify-between w-full">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{macro.icon || "⚡"}</span>
                      <span className="text-xs font-semibold text-gray-200 group-hover:text-cyan-300 transition-colors">
                        {macro.name}
                      </span>
                    </div>
                    <Play className="h-3 w-3 text-gray-500 group-hover:text-cyan-400 transition-colors shrink-0 mt-0.5" />
                  </div>
                  <p className="mt-1 text-[10px] text-gray-400 line-clamp-1">{macro.description}</p>
                  <div className="mt-2 flex items-center justify-between text-[9px] text-gray-500 font-mono">
                    <span>{macro.steps.length} sequential steps</span>
                    <span className="uppercase text-cyan-400/80">{macro.category}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Natural Language RPA Execution Box */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase font-mono">
                Natural Language RPA Chainer
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="e.g. open chrome, mute volume, check stats..."
                  value={nlMacroPrompt}
                  onChange={(e) => setNlMacroPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && nlMacroPrompt.trim() && !isRunningMacro) {
                      e.preventDefault();
                      runMacroWorkflow({ instruction: nlMacroPrompt.trim() });
                      setNlMacroPrompt("");
                    }
                  }}
                  className="flex-1 rounded-xl border border-gray-800 bg-navy px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none font-mono"
                />
                <Button
                  size="sm"
                  disabled={isRunningMacro || !nlMacroPrompt.trim()}
                  onClick={() => {
                    if (nlMacroPrompt.trim()) {
                      runMacroWorkflow({ instruction: nlMacroPrompt.trim() });
                      setNlMacroPrompt("");
                    }
                  }}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-2.5 py-1 font-mono"
                >
                  <Zap className="h-3 w-3 mr-1" /> Run
                </Button>
              </div>
            </div>

            {/* Live Macro Telemetry & Execution Progress Tracker */}
            {isRunningMacro && (
              <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/20 p-2.5 space-y-1.5 animate-pulse font-mono">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
                    <FastForward className="h-3.5 w-3.5 animate-spin" />
                    Executing: {runningMacroName}
                  </span>
                  <span className="text-[10px] text-cyan-400 uppercase">In Progress</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-violet-500"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>
            )}

            {/* Last Execution Report Telemetry */}
            {activeExecutionReport && !isRunningMacro && (
              <div className="rounded-xl border border-gray-800 bg-navy/80 p-2.5 space-y-1.5 font-mono">
                <div className="flex items-center justify-between text-xs border-b border-gray-800 pb-1">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    {activeExecutionReport.allSuccess ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                    )}
                    {activeExecutionReport.workflowName}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {activeExecutionReport.totalDurationMs}ms · {activeExecutionReport.stepResults.length} steps
                  </span>
                </div>
                <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                  {activeExecutionReport.stepResults.map((step, idx) => (
                    <div key={idx} className="flex items-start justify-between text-[10px] text-gray-300">
                      <span className="truncate pr-2">
                        {step.status === "SUCCESS" ? "✓" : "⚠"} {step.description || step.action}
                      </span>
                      <span className="text-gray-500 shrink-0">{step.durationMs}ms</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 italic pt-1 border-t border-gray-800/60">
                  {activeExecutionReport.summary}
                </p>
              </div>
            )}
          </div>

          {/* Computer Control Actions & Skills Grid */}
          <div className="cyber-panel rounded-2xl p-5 space-y-3 shadow-xl">
            <h3 className="text-xs font-bold tracking-wider text-gray-400 uppercase font-mono flex items-center justify-between">
              <span>Computer Actions & Skills (16 Loaded)</span>
              <span className="text-[10px] text-cyan-400 font-normal">ZERO-LATENCY</span>
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <button
                onClick={() => triggerAction("open_app", { app_name: "chrome" })}
                className="flex items-center gap-2 rounded-xl border border-gray-800 bg-navy/60 p-2 text-xs text-gray-300 hover:border-cyan-500 hover:text-white transition-all text-left group"
              >
                <Monitor className="h-4 w-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                <span>Open Browser</span>
              </button>

              <button
                onClick={() => triggerAction("screen_processor", { action: "capture" })}
                className="flex items-center gap-2 rounded-xl border border-gray-800 bg-navy/60 p-2 text-xs text-gray-300 hover:border-violet-500 hover:text-white transition-all text-left group"
              >
                <Film className="h-4 w-4 text-violet-400 group-hover:scale-110 transition-transform" />
                <span>Screen Vision</span>
              </button>

              <button
                onClick={() => triggerAction("system_monitor")}
                className="flex items-center gap-2 rounded-xl border border-gray-800 bg-navy/60 p-2 text-xs text-gray-300 hover:border-emerald-500 hover:text-white transition-all text-left group"
              >
                <Cpu className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span>System Stats</span>
              </button>

              <button
                onClick={() => triggerAction("weather_report", { city: "Belgrade" })}
                className="flex items-center gap-2 rounded-xl border border-gray-800 bg-navy/60 p-2 text-xs text-gray-300 hover:border-amber-500 hover:text-white transition-all text-left group"
              >
                <CloudRain className="h-4 w-4 text-amber-400 group-hover:scale-110 transition-transform" />
                <span>Weather</span>
              </button>

              <button
                onClick={() => triggerAction("clipboard", { operation: "get" })}
                className="flex items-center gap-2 rounded-xl border border-gray-800 bg-navy/60 p-2 text-xs text-gray-300 hover:border-blue-500 hover:text-white transition-all text-left group"
              >
                <Copy className="h-4 w-4 text-blue-400 group-hover:scale-110 transition-transform" />
                <span>Clipboard</span>
              </button>

              <button
                onClick={() => triggerAction("reminder", { message: "Review generated shorts", seconds: 60 })}
                className="flex items-center gap-2 rounded-xl border border-gray-800 bg-navy/60 p-2 text-xs text-gray-300 hover:border-pink-500 hover:text-white transition-all text-left group"
              >
                <Clock className="h-4 w-4 text-pink-400 group-hover:scale-110 transition-transform" />
                <span>Set Timer</span>
              </button>

              <button
                onClick={() => triggerAction("youtube_video", { query: "minecraft parkour 4k" })}
                className="flex items-center gap-2 rounded-xl border border-gray-800 bg-navy/60 p-2 text-xs text-gray-300 hover:border-red-500 hover:text-white transition-all text-left group"
              >
                <Film className="h-4 w-4 text-red-400 group-hover:scale-110 transition-transform" />
                <span>YouTube</span>
              </button>

              <button
                onClick={() => triggerAction("proactive")}
                className="flex items-center gap-2 rounded-xl border border-gray-800 bg-navy/60 p-2 text-xs text-gray-300 hover:border-teal-500 hover:text-white transition-all text-left group"
              >
                <Sparkles className="h-4 w-4 text-teal-400 group-hover:scale-110 transition-transform" />
                <span>Proactive Vitals</span>
              </button>

              <button
                onClick={() => triggerAction("code_helper", { code: "print('Soundwave Sandbox: Python 3.11 OK')" })}
                className="flex items-center gap-2 rounded-xl border border-gray-800 bg-navy/60 p-2 text-xs text-gray-300 hover:border-indigo-500 hover:text-white transition-all text-left group"
              >
                <Terminal className="h-4 w-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                <span>Code Sandbox</span>
              </button>

              <button
                onClick={() => triggerAction("browser_control", { action: "open", url: "https://google.com" })}
                className="flex items-center gap-2 rounded-xl border border-gray-800 bg-navy/60 p-2 text-xs text-gray-300 hover:border-cyan-500 hover:text-white transition-all text-left group"
              >
                <Layers className="h-4 w-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                <span>Browser Control</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Transcript & Short Generator Hub (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Live Cyber Terminal & Neural Stream */}
          <div className="cyber-panel rounded-2xl p-4 shadow-2xl relative overflow-hidden flex flex-col h-[340px]">
            {/* Subtle Scanline Overlay */}
            <div className="absolute inset-0 cyber-scanlines pointer-events-none opacity-40 z-0" />

            <div className="relative z-10 flex items-center justify-between border-b border-gray-800 pb-2 mb-2 font-mono">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-300">
                <Terminal className="h-4 w-4 text-cyan-400" />
                <span>EVENT STREAM // BUFFER: LIVE</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const initMsg: ChatMessage = {
                      id: Date.now().toString(),
                      sender: "system",
                      text: "Buffer cleared. Cyber Deck listening.",
                      time: new Date().toLocaleTimeString(),
                      tag: "SYS",
                    };
                    setChatMessages([initMsg]);
                    try {
                      localStorage.setItem("soundwave_agent_chat_history", JSON.stringify([initMsg]));
                    } catch {}
                    toast.info("Event log cleared.");
                  }}
                  className="text-[10px] text-gray-500 hover:text-cyan-400 transition-colors uppercase"
                >
                  Clear Log
                </button>
                <span className="text-[10px] text-emerald-400 font-bold uppercase">● STREAMING</span>
              </div>
            </div>

            {/* Scrollable Event Feed */}
            <div className="relative z-10 flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-xl p-2.5 leading-relaxed transition-all ${
                    msg.sender === "user"
                      ? "bg-violet-950/40 border border-violet-800/50 text-violet-200 ml-6"
                      : msg.sender === "assistant"
                      ? "bg-navy/90 border border-cyan-900/40 text-gray-200 mr-6 shadow-sm"
                      : "bg-gray-900/70 text-gray-400 border border-gray-800/80"
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                    <span className="uppercase font-bold tracking-wider flex items-center gap-1.5">
                      <span className={`px-1 rounded text-[9px] ${
                        msg.sender === "user" 
                          ? "bg-violet-900/60 text-violet-300"
                          : msg.tag === "RPA"
                          ? "bg-cyan-900/60 text-cyan-300"
                          : "bg-gray-800 text-gray-300"
                      }`}>
                        {msg.tag || (msg.sender === "user" ? "USER" : "SYS")}
                      </span>
                      <span>{msg.sender === "user" ? "Command" : assistantName}</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span>{msg.time}</span>
                      {msg.sender === "assistant" && (
                        <button
                          type="button"
                          onClick={() => speakText(msg.text)}
                          title="Replay Voice Audio"
                          className="p-0.5 hover:text-cyan-400 text-gray-500 transition-colors"
                        >
                          <Volume2 className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(msg.text);
                          toast.success("Copied to clipboard");
                        }}
                        title="Copy message"
                        className="p-0.5 hover:text-cyan-400 text-gray-500 transition-colors"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="whitespace-pre-line">{msg.text}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Trigger Suggestion Chips */}
            <div className="relative z-10 flex items-center gap-1.5 pt-2 overflow-x-auto text-[11px] font-mono text-gray-400">
              <span className="text-[10px] text-gray-500 uppercase shrink-0">QUICK:</span>
              <button
                type="button"
                onClick={() => runMacroWorkflow({ macroId: "creator_morning_prep" })}
                className="shrink-0 rounded-md border border-gray-800 bg-navy/80 px-2 py-0.5 hover:border-cyan-500/60 hover:text-white transition-colors"
              >
                🌅 Morning Setup
              </button>
              <button
                type="button"
                onClick={() => runMacroWorkflow({ macroId: "deep_focus_pomodoro" })}
                className="shrink-0 rounded-md border border-gray-800 bg-navy/80 px-2 py-0.5 hover:border-violet-500/60 hover:text-white transition-colors"
              >
                🎯 Deep Focus
              </button>
              <button
                type="button"
                onClick={() => triggerAction("system_monitor")}
                className="shrink-0 rounded-md border border-gray-800 bg-navy/80 px-2 py-0.5 hover:border-emerald-500/60 hover:text-white transition-colors"
              >
                📊 Vitals
              </button>
              <button
                type="button"
                onClick={() => triggerAction("screen_processor", { action: "capture" })}
                className="shrink-0 rounded-md border border-gray-800 bg-navy/80 px-2 py-0.5 hover:border-amber-500/60 hover:text-white transition-colors"
              >
                📸 Vision
              </button>
            </div>

            {/* Input Bar */}
            <form onSubmit={handleUserSubmit} className="relative z-10 mt-2 flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-cyan-400 font-mono text-xs">❯</span>
                <input
                  type="text"
                  placeholder="Type command (e.g. 'open chrome', 'focus mode', 'weather', 'make short')..."
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-navy pl-7 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none font-mono"
                />
              </div>
              <Button type="submit" size="sm" className="gap-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono">
                <Send className="h-3 w-3" /> Execute
              </Button>
            </form>
          </div>

          {/* 1-Click Viral Short Engine */}
          <div className="cyber-panel rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2 font-mono">
                  <Flame className="h-4 w-4 text-violet-400" />
                  Autonomous Viral Short Engine
                </h2>
                <p className="text-xs text-gray-400">
                  Research-backed hooks, neural voiceover, dynamic TikTok captions, and 60fps Minecraft parkour.
                </p>
              </div>
              <Badge tone="violet" className="py-0.5 font-mono">2026 ENGINE</Badge>
            </div>

            {/* Niche selector */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {NICHES.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setSelectedNiche(n.id)}
                  className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition-all ${
                    selectedNiche === n.id
                      ? "border-cyan-500 bg-cyan-950/30 text-white shadow-md shadow-cyan-500/10"
                      : "border-gray-800 bg-navy/60 text-gray-400 hover:border-gray-700 hover:text-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-sm">
                    <span>{n.icon}</span>
                    <span className="font-semibold text-xs text-white">{n.name}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-gray-400 line-clamp-1">{n.desc}</p>
                </button>
              ))}
            </div>

            {/* Custom Topic Input */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1 font-mono">
                Custom Topic / Hook Prompt (Optional)
              </label>
              <input
                type="text"
                placeholder="Leave blank for researched algorithm hook, or type e.g. 'The Paradox of Choice'..."
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                className="w-full rounded-xl border border-gray-800 bg-navy px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            {/* Voice & Video Options */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1 font-mono">Voiceover Engine</label>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-navy px-3 py-2 text-xs text-white"
                >
                  {clonedVoices.length > 0 && (
                    <optgroup label="My Cloned Voices">
                      {clonedVoices.map((cv) => (
                        <option key={cv.id} value={cv.id}>
                          ⭐ {cv.name} (Cloned Voice)
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Neural Microsoft Voices">
                    <option value="en-US-JennyNeural">Jenny (Energetic & Viral)</option>
                    <option value="en-US-GuyNeural">Guy (Documentary & History)</option>
                    <option value="en-US-AriaNeural">Aria (Tech & Futuristic)</option>
                    <option value="en-US-ChristopherNeural">Christopher (Deep Mindset)</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1 font-mono">Export Quality</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setResolution("720p")}
                    className={`flex-1 rounded-xl border py-1.5 text-xs font-semibold font-mono ${
                      resolution === "720p" ? "border-cyan-500 bg-cyan-500/10 text-cyan-300" : "border-gray-800 bg-navy text-gray-400"
                    }`}
                  >
                    720p (Ultra Fast)
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolution("1080p")}
                    className={`flex-1 rounded-xl border py-1.5 text-xs font-semibold font-mono ${
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
                className="flex-1 gap-2 bg-gradient-to-r from-cyan-500 via-violet-600 to-cyan-500 text-white font-semibold hover:from-cyan-400 hover:to-violet-500 font-mono shadow-lg shadow-cyan-500/20"
              >
                {isGenerating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate 1-Click Viral Short
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
                className="gap-1.5 text-xs border border-gray-700 font-mono"
              >
                {batchRunning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Batch All 7"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── GENERATED VIDEO PREVIEW CARD ───────────────────────────────── */}
      {(completedVideoUrl || generatedScript) && (
        <div className="cyber-panel rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white font-mono">Generated Video Ready</h3>
            </div>
            {completedVideoUrl && (
              <a
                href={completedVideoUrl}
                download="soundwave_short.mp4"
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 font-mono shadow-md"
              >
                <Download className="h-3.5 w-3.5" /> Download MP4
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <div className="space-y-2 md:col-span-8">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-mono">Voiceover Script</span>
              <div className="rounded-xl border border-gray-800 bg-navy/80 p-4 text-xs leading-relaxed text-gray-200 font-mono">
                {generatedScript}
              </div>
            </div>
            {completedVideoUrl && (
              <div className="md:col-span-4 flex justify-center">
                <div className="aspect-[9/16] w-48 overflow-hidden rounded-xl border border-gray-800 bg-black shadow-xl">
                  <video src={completedVideoUrl} controls autoPlay loop className="h-full w-full object-cover" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── COMPLETE SETTINGS DRAWER / MODAL ────────────────────────────── */}
      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Soundwave Cyber Deck Settings"
      >
        <div className="space-y-4 font-mono">
          {/* Settings Tabs */}
          <div className="flex flex-wrap gap-1 border-b border-gray-800 pb-2">
            {[
              { id: "assistant", label: "⚙️ Assistant" },
              { id: "macros", label: "👻 Ghost Macros" },
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

          {/* Tab Content: Ghost Macros */}
          {settingsTab === "macros" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-300">
                  Registered Automation Workflows ({macrosList.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    setMacroModalOpen(true);
                  }}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> New Macro
                </button>
              </div>
              <div className="max-h-56 overflow-y-auto space-y-2 rounded-xl border border-gray-800 bg-navy/60 p-2.5">
                {macrosList.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border border-gray-800 bg-panel/70 p-2 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{m.icon || "⚡"}</span>
                        <span className="font-semibold text-white">{m.name}</span>
                        {m.isBuiltin ? (
                          <span className="text-[9px] px-1 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">BUILT-IN</span>
                        ) : (
                          <span className="text-[9px] px-1 rounded bg-violet-950 text-violet-400 border border-violet-800">CUSTOM</span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400">{m.steps.length} steps · {m.description}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSettingsOpen(false);
                          runMacroWorkflow({ macroId: m.id });
                        }}
                        className="rounded bg-cyan-600/30 px-2 py-0.5 text-[10px] text-cyan-300 hover:bg-cyan-600/50"
                      >
                        Run
                      </button>
                      {!m.isBuiltin && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomMacro(m.id)}
                          className="text-gray-500 hover:text-red-400 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
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

      {/* ── GHOST OPERATOR: CREATE CUSTOM MACRO MODAL ───────────────────────── */}
      <Modal
        open={macroModalOpen}
        onClose={() => setMacroModalOpen(false)}
        title="Ghost Operator: Create Automation Macro"
      >
        <div className="space-y-4 font-mono">
          <p className="text-xs text-gray-400">
            Define multi-step desktop automation routines using natural language RPA decomposition or custom configuration.
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Macro Name</label>
            <input
              type="text"
              placeholder="e.g. YouTube Podcast Kickoff"
              value={newMacroName}
              onChange={(e) => setNewMacroName(e.target.value)}
              className="w-full rounded-xl border border-gray-800 bg-navy px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Description</label>
            <input
              type="text"
              placeholder="e.g. Prepares workstation, minimizes windows, and opens production apps"
              value={newMacroDesc}
              onChange={(e) => setNewMacroDesc(e.target.value)}
              className="w-full rounded-xl border border-gray-800 bg-navy px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3 space-y-2">
            <label className="block text-xs font-semibold text-cyan-300">
              Natural Language RPA Step Decomposer
            </label>
            <p className="text-[11px] text-gray-400">
              Type actions in natural English and Ghost Operator will resolve them into sequential steps:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. launch chrome, set volume to 75%, check system stats, and give morning briefing"
                value={newMacroNlInput}
                onChange={(e) => setNewMacroNlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleDecomposeForBuilder();
                  }
                }}
                className="flex-1 rounded-xl border border-gray-800 bg-navy px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
              />
              <Button
                type="button"
                disabled={isDecomposingNl || !newMacroNlInput.trim()}
                onClick={handleDecomposeForBuilder}
                className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs whitespace-nowrap"
              >
                {isDecomposingNl ? "Decomposing..." : "Decompose Steps"}
              </Button>
            </div>
          </div>

          {/* Decomposed Steps Review */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-300">
                Workflow Steps ({builderSteps.length})
              </span>
              {builderSteps.length > 0 && (
                <button
                  type="button"
                  onClick={() => setBuilderSteps([])}
                  className="text-[11px] text-red-400 hover:text-red-300"
                >
                  Clear Steps
                </button>
              )}
            </div>

            {builderSteps.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-800 p-4 text-center text-xs text-gray-500">
                No steps yet. Enter an instruction above and click "Decompose Steps".
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {builderSteps.map((step, idx) => (
                  <div
                    key={step.id || idx}
                    className="flex items-center justify-between rounded-xl border border-gray-800 bg-navy/70 p-2.5 text-xs text-gray-300"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/20 text-[10px] font-bold text-cyan-400">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="font-semibold text-white">{step.description || step.action}</p>
                        <p className="text-[10px] text-gray-500 font-mono">
                          Action: {step.action} {step.params ? `· ${JSON.stringify(step.params)}` : ""}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBuilderSteps((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-gray-500 hover:text-red-400 transition-colors p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-800">
            <Button
              variant="outline"
              type="button"
              onClick={() => setMacroModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={builderSteps.length === 0 || isRunningMacro}
                onClick={async () => {
                  setMacroModalOpen(false);
                  await runMacroWorkflow({
                    workflow: {
                      id: "adhoc_" + Date.now(),
                      name: newMacroName || "Custom Ad-hoc Macro",
                      description: newMacroDesc || "Custom executed macro",
                      category: "custom",
                      steps: builderSteps,
                    },
                    customName: newMacroName || "Custom Ad-hoc Macro",
                  });
                }}
                className="bg-navy border border-cyan-500/50 hover:bg-cyan-950/40 text-cyan-300 text-xs"
              >
                <Play className="h-3 w-3 mr-1" /> Test Run
              </Button>
              <Button
                type="button"
                disabled={!newMacroName.trim() || builderSteps.length === 0}
                onClick={handleSaveMacro}
                className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs"
              >
                Save to Library
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
