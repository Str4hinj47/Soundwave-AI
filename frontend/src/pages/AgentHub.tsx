import { useState, useEffect, useRef } from "react";
import { 
  Bot, 
  Sparkles, 
  Download, 
  RefreshCw, 
  Layers, 
  Film, 
  CheckCircle2, 
  Copy,
  Flame
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
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

export function AgentHub() {
  const [selectedNiche, setSelectedNiche] = useState<string>("psychology");
  const [customTopic, setCustomTopic] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("en-US-JennyNeural");
  const [resolution, setResolution] = useState<"720p" | "1080p">("720p");
  const [isGenerating, setIsGenerating] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; activeNiche: string } | null>(null);
  
  // Current active generation status
  const [currentStep, setCurrentStep] = useState<string>("Ready to create");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [generatedScript, setGeneratedScript] = useState<string>("");
  const [completedVideoUrl, setCompletedVideoUrl] = useState<string | null>(null);

  // System status
  const [agentStatus, setAgentStatus] = useState<{
    online: boolean;
    cachedClips: number;
    cacheSizeMb: number;
    ffmpeg: boolean;
  }>({
    online: true,
    cachedClips: 0,
    cacheSizeMb: 0,
    ffmpeg: true,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load system status
  useEffect(() => {
    fetch("/api/v1/agent/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setAgentStatus({
            online: true,
            cachedClips: data.cachedBackgroundClips ?? 0,
            cacheSizeMb: data.cachedBackgroundSizeMb ?? 0,
            ffmpeg: data.ffmpegAvailable ?? true,
          });
        }
      })
      .catch(() => {
        setAgentStatus((prev) => ({ ...prev, online: true }));
      });
  }, []);

  // Visualizer animation
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
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = 65;

      // Draw glowing background glow
      const grad = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, 100);
      grad.addColorStop(0, isGenerating ? "rgba(139, 92, 246, 0.45)" : "rgba(59, 130, 246, 0.2)");
      grad.addColorStop(1, "rgba(10, 15, 28, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 100, 0, Math.PI * 2);
      ctx.fill();

      // Draw reactive wave circles
      const bars = 48;
      const step = (Math.PI * 2) / bars;
      ctx.beginPath();
      for (let i = 0; i < bars; i++) {
        const angle = i * step;
        const wave = Math.sin(angle * 4 + phase) * Math.cos(angle * 2 - phase);
        const amp = isGenerating ? 22 * Math.abs(wave) + 6 : 8 * Math.abs(wave) + 2;
        const r = baseRadius + amp;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = isGenerating ? "#A78BFA" : "#38BDF8";
      ctx.lineWidth = 3;
      ctx.shadowBlur = isGenerating ? 16 : 8;
      ctx.shadowColor = isGenerating ? "#8B5CF6" : "#0EA5E9";
      ctx.stroke();

      // Inner pulsating ring
      ctx.beginPath();
      const innerR = 40 + (isGenerating ? Math.sin(phase * 2) * 5 : Math.sin(phase) * 2);
      ctx.arc(centerX, centerY, Math.max(10, innerR), 0, Math.PI * 2);
      ctx.fillStyle = isGenerating ? "rgba(139, 92, 246, 0.3)" : "rgba(14, 165, 233, 0.15)";
      ctx.fill();
      ctx.strokeStyle = isGenerating ? "#C084FC" : "#38BDF8";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      phase += isGenerating ? 0.07 : 0.02;
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [isGenerating]);

  // Generate 1 Short
  const handleGenerateShort = async () => {
    if (isGenerating || batchRunning) return;
    setIsGenerating(true);
    setProgressPercent(15);
    setCurrentStep("Drafting viral script & hooks...");
    setCompletedVideoUrl(null);

    const topic = customTopic.trim() || selectedNiche;

    try {
      setCurrentStep("Synthesizing neural voiceover & timings...");
      setProgressPercent(35);

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
        throw new Error(err.error || `Server responded with ${res.status}`);
      }

      setCurrentStep("Compositing 9:16 vertical video & subtitles...");
      setProgressPercent(75);

      const data = await res.json();
      setProgressPercent(100);
      setCurrentStep("Ready! Video generated successfully.");
      setGeneratedScript(data.script || "");
      setCompletedVideoUrl(data.downloadUrl || `/api/v1/export/jobs/${data.jobId}/download`);

      toast.success("Viral Short generated and ready for download!");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate short");
      setCurrentStep("Generation failed. Check server logs.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate All 7 Niches Batch
  const handleBatchGenerate = async () => {
    if (isGenerating || batchRunning) return;
    setBatchRunning(true);
    const nichesToRun = NICHES.map((n) => n.id);
    setBatchProgress({ current: 0, total: nichesToRun.length, activeNiche: nichesToRun[0]! });

    try {
      for (let i = 0; i < nichesToRun.length; i++) {
        const niche = nichesToRun[i]!;
        setBatchProgress({ current: i + 1, total: nichesToRun.length, activeNiche: niche });
        setCurrentStep(`[${i + 1}/${nichesToRun.length}] Generating ${niche}...`);

        const res = await fetch("/api/v1/agent/generate-short", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: niche,
            voice: selectedVoice,
            resolution: "720p",
            useDefaultBackground: true,
            async: false,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setCompletedVideoUrl(data.downloadUrl);
          setGeneratedScript(data.script);
        }
      }
      toast.success("Batch completed! All 7 viral shorts created.");
      setCurrentStep("Batch production complete!");
    } catch (e: any) {
      toast.error("Batch encountered an error: " + e.message);
    } finally {
      setBatchRunning(false);
      setBatchProgress(null);
    }
  };

  const copyScript = () => {
    if (!generatedScript) return;
    navigator.clipboard.writeText(generatedScript);
    toast.success("Script copied to clipboard!");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-800 bg-gradient-to-r from-navy via-panel to-navy p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-600 text-white shadow-lg shadow-violet-500/20">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Soundwave Agent Hub</h1>
              <p className="text-xs text-gray-400">Autonomous Viral Shorts Creator & Audio Automation Suite</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={agentStatus.online ? "green" : "red"} className="gap-1.5 py-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Agent Engine: Online
          </Badge>
          <Badge tone="blue" className="gap-1.5 py-1">
            <Film className="h-3.5 w-3.5" />
            {agentStatus.cachedClips > 0 ? `${agentStatus.cachedClips} Cached Backgrounds` : "Auto Gameplay Fetch"}
          </Badge>
          <Badge tone="violet" className="gap-1.5 py-1">
            <Flame className="h-3.5 w-3.5" />
            7 Viral Niches
          </Badge>
        </div>
      </div>

      {/* Main Grid: HUD & Quick Generate */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Soundwave HUD Visualizer */}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-800 bg-panel p-6 lg:col-span-4">
          <h2 className="mb-1 text-sm font-semibold tracking-wider text-gray-400 uppercase">Soundwave HUD</h2>
          <p className="mb-4 text-xs text-gray-500">Acoustic Status & Rendering Core</p>

          <div className="relative flex items-center justify-center">
            <canvas ref={canvasRef} width={260} height={260} className="rounded-full" />
            <div className="pointer-events-none absolute text-center">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                {isGenerating || batchRunning ? "PROCESSING" : "STANDBY"}
              </span>
              <p className="mt-0.5 text-sm font-bold text-white">
                {isGenerating ? `${progressPercent}%` : "Soundwave AI"}
              </p>
            </div>
          </div>

          <div className="mt-4 w-full rounded-xl bg-navy/60 p-3 text-center border border-gray-800/80">
            <span className="text-xs font-medium text-cyan-400">{currentStep}</span>
            {isGenerating && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}
            {batchRunning && batchProgress && (
              <div className="mt-2">
                <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                  <span>Batch: {batchProgress.activeNiche}</span>
                  <span>{batchProgress.current}/{batchProgress.total}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
                  <div 
                    className="h-full bg-violet-500 transition-all duration-300"
                    style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Short Generator Controls */}
        <div className="space-y-5 rounded-2xl border border-gray-800 bg-panel p-6 lg:col-span-8">
          <div>
            <h2 className="text-lg font-bold text-white">1-Click Viral Short Generator</h2>
            <p className="text-xs text-gray-400">
              Generates research-backed viral hooks (Did you know, Only 1%, 3 mistakes), neural narration, TikTok #8B5CF6 captions, and high-FPS gameplay in 1 click.
            </p>
          </div>

          {/* Niche Selector Cards */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Select Proven Niche
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {NICHES.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setSelectedNiche(n.id)}
                  className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition-all ${
                    selectedNiche === n.id
                      ? "border-violet-500 bg-violet-500/10 text-white shadow-sm shadow-violet-500/20"
                      : "border-gray-800 bg-navy/40 text-gray-400 hover:border-gray-700 hover:text-gray-200"
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-base">{n.icon}</span>
                    {selectedNiche === n.id && <CheckCircle2 className="h-3.5 w-3.5 text-violet-400" />}
                  </div>
                  <span className="mt-1 text-xs font-semibold text-white">{n.name}</span>
                  <span className="line-clamp-1 text-[10px] text-gray-400">{n.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Topic / Prompt */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-300">
              Custom Topic or Prompt (Optional)
            </label>
            <input
              type="text"
              placeholder={`Leave blank to use top ${selectedNiche} hooks, or enter e.g. "dark psychology tricks"`}
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              className="w-full rounded-xl border border-gray-800 bg-navy px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:border-violet-500 focus:outline-none"
            />
          </div>

          {/* Voice & Resolution Options */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-300">Voice Narrator</label>
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="w-full rounded-xl border border-gray-800 bg-navy px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
              >
                <option value="en-US-JennyNeural">Jenny (Female - Default Shorts Voice)</option>
                <option value="en-US-GuyNeural">Guy (Male - Deep Documentary)</option>
                <option value="en-GB-RyanNeural">Ryan (British Male - Authority Hook)</option>
                <option value="en-GB-SoniaNeural">Sonia (British Female - Storyteller)</option>
                <option value="en-US-ChristopherNeural">Christopher (Male - Crisp & Energetic)</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-300">Video Quality & Format</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setResolution("720p")}
                  className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition-all ${
                    resolution === "720p"
                      ? "border-cyan-500 bg-cyan-500/10 text-cyan-300"
                      : "border-gray-800 bg-navy text-gray-400"
                  }`}
                >
                  9:16 Portrait · 720p (Ultra Fast)
                </button>
                <button
                  type="button"
                  onClick={() => setResolution("1080p")}
                  className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition-all ${
                    resolution === "1080p"
                      ? "border-cyan-500 bg-cyan-500/10 text-cyan-300"
                      : "border-gray-800 bg-navy text-gray-400"
                  }`}
                >
                  9:16 Portrait · 1080p (HQ)
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button
              onClick={handleGenerateShort}
              disabled={isGenerating || batchRunning}
              className="flex-1 gap-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-semibold hover:from-cyan-400 hover:to-violet-500 shadow-md shadow-violet-500/20"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Generating Short...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate 1-Click Short
                </>
              )}
            </Button>

            <Button
              onClick={handleBatchGenerate}
              disabled={isGenerating || batchRunning}
              variant="subtle"
              className="gap-2 border-violet-500/40 text-violet-300 hover:bg-violet-500/10"
            >
              {batchRunning ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Running 7-Niche Batch...
                </>
              ) : (
                <>
                  <Layers className="h-4 w-4" />
                  Batch All 7 Niches
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Generated Result & Preview Area */}
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
                download="soundwave_viral_short.mp4"
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 transition-colors"
              >
                <Download className="h-3.5 w-3.5" /> Download MP4
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            {/* Script Display */}
            <div className="space-y-2 md:col-span-7">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Voiceover Script</span>
                <button
                  onClick={copyScript}
                  className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
              <div className="rounded-xl border border-gray-800 bg-navy/80 p-4 text-sm leading-relaxed text-gray-200 font-mono">
                {generatedScript}
              </div>
            </div>

            {/* Video Player */}
            {completedVideoUrl && (
              <div className="flex flex-col items-center justify-center md:col-span-5">
                <div className="w-full max-w-[260px] overflow-hidden rounded-xl border border-gray-800 bg-black shadow-lg">
                  <video
                    src={completedVideoUrl}
                    controls
                    playsInline
                    className="aspect-[9/16] w-full object-cover"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Autonomous Desktop Agent Info Section */}
      <div className="rounded-2xl border border-gray-800 bg-navy/60 p-6 space-y-3">
        <div className="flex items-center gap-2 text-white font-semibold">
          <Bot className="h-4 w-4 text-cyan-400" />
          <span>Standalone Desktop Soundwave Agent</span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          Soundwave AI includes a 100% original, cross-platform Python desktop runner (<code className="text-violet-300">soundwave-agent/</code>). It can run headlessly or with a reactive Soundwave HUD on your PC, generate bulk viral shorts automatically, manage background caches, and execute batch pipelines with zero cloud subscription fees.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <code className="rounded-lg bg-gray-900 border border-gray-800 px-3 py-1.5 text-xs text-cyan-300 font-mono">
            python soundwave-agent/main.py --batch
          </code>
          <code className="rounded-lg bg-gray-900 border border-gray-800 px-3 py-1.5 text-xs text-cyan-300 font-mono">
            python soundwave-agent/main.py --niche psychology
          </code>
        </div>
      </div>
    </div>
  );
}
