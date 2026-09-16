import { useEffect, useState, useRef } from "react";
import {
  Bot,
  Cpu,
  Code2,
  Puzzle,
  Brain,
  Mic,
  Volume2,
  Layers,
  FileCode,
  Settings2,
  Copy,
  Check,
  Sparkles,
  MessageSquare,
  BookOpen,
  Wrench,
  Lightbulb,
  Download,
  Trash2,
  Send,
  ChevronDown,
  Github,
  Terminal,
  Music,
  Video,
  Film,
  Youtube,
  FolderKanban,
  Clapperboard,
} from "lucide-react";
import { useJarvisExpert, usePluginGenerator } from "../hooks/useJarvisExpert";
import { jarvisApi, type JarvisAction, type JarvisCoreModule, type JarvisCapability, type SoundwavePluginFile, type SoundwavePluginMeta } from "../lib/jarvisApi";
import { useTTS } from "../hooks/useTTS";
import { toast } from "../store/toast";

function MarkdownLite({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return (
    <div className="prose prose-invert max-w-none text-sm leading-relaxed">
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const code = part.replace(/^```[a-z]*\n?/, "").replace(/```$/, "");
          return (
            <pre key={i} className="my-3 overflow-x-auto rounded-lg border border-gray-700 bg-gray-900/80 p-3 text-xs">
              <code className="text-gray-200">{code}</code>
            </pre>
          );
        }
        const lines = part.split("\n");
        return (
          <div key={i}>
            {lines.map((line, li) => {
              if (line.startsWith("- ") || line.startsWith("* ")) {
                return (
                  <div key={li} className="ml-4 flex gap-2 py-0.5">
                    <span className="text-blue-400">•</span>
                    <span dangerouslySetInnerHTML={{ __html: inlineFormat(line.slice(2)) }} />
                  </div>
                );
              }
              if (line.startsWith("### ")) return <h4 key={li} className="mt-3 font-semibold text-white">{line.slice(4)}</h4>;
              if (line.startsWith("## ")) return <h3 key={li} className="mt-4 text-base font-bold text-white">{line.slice(3)}</h3>;
              if (line.startsWith("# ")) return <h2 key={li} className="mt-4 text-lg font-bold text-white">{line.slice(2)}</h2>;
              if (line.trim() === "") return <div key={li} className="h-2" />;
              return <p key={li} className="py-1" dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />;
            })}
          </div>
        );
      })}
    </div>
  );
}

function inlineFormat(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="rounded bg-gray-800 px-1.5 py-0.5 text-xs text-blue-300">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-blue-400 hover:text-blue-300 underline">$1</a>');
}

type TabId = "chat" | "soundwave" | "actions" | "core" | "capabilities" | "setup" | "generator" | "plugins";
type ExpertMode = "mark" | "soundwave";

export function JarvisExpert() {
  const { messages, isThinking, sendMessage, clearChat } = useJarvisExpert();
  const { isGenerating, result: pluginResult, generate } = usePluginGenerator();
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("chat");
  const [expertMode, setExpertMode] = useState<ExpertMode>("mark");
  const [actions, setActions] = useState<JarvisAction[]>([]);
  const [coreModules, setCoreModules] = useState<JarvisCoreModule[]>([]);
  const [capabilities, setCapabilities] = useState<JarvisCapability[]>([]);
  const [selectedAction, setSelectedAction] = useState<JarvisAction | null>(null);
  const [selectedCore, setSelectedCore] = useState<JarvisCoreModule | null>(null);
  const [pluginDesc, setPluginDesc] = useState("");
  const [pluginName, setPluginName] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [structure, setStructure] = useState<string>("");
  const [soundwavePlugins, setSoundwavePlugins] = useState<SoundwavePluginMeta[]>([]);
  const [soundwaveFiles, setSoundwaveFiles] = useState<SoundwavePluginFile[]>([]);
  const [selectedPluginFile, setSelectedPluginFile] = useState<{ name: string; content: string } | null>(null);
  const [soundwaveMessages, setSoundwaveMessages] = useState<{ role: "user" | "assistant"; content: string; id: string }[]>([
    {
      id: "sw-welcome",
      role: "assistant",
      content: `**JARVIS ↔ Soundwave Bridge Online.** 🎙️➡️🎬 + 📋 YouTube Paste Ready

I'm teaching **Mark LIII JARVIS** to use **Soundwave AI** — production TTS + video studio.

**Soundwave has 6 Neural voices** (Jenny, Ana, Sonia, Christopher, Guy, Ryan) via free Edge TTS, same engine Mark LIII uses. I've created **8 drop-in plugins** for Mark LIII that let JARVIS:

- **soundwave_tts** — Generate speech with Jenny etc., save MP3 + auto-play
- **soundwave_voices** — List/describe/recommend voices, play samples
- **soundwave_studio** — Master control (TTS, projects, video export, YouTube import)
- **soundwave_projects** — Manage projects in ~/Soundwave/projects/
- **soundwave_video** — Burn subtitles into video, 16:9 + 9:16 portrait for Shorts/TikTok
- **soundwave_clone** — Voice cloning via OmniVoice sidecar
- **soundwave_youtube** — YouTube import as background via yt-dlp (now with paste_guide)
- **soundwave_youtube_paste** — ⭐ NEW: Paste YouTube link into Video Editor — exact UI flow, 3 methods api/browser/clipboard/auto

**YouTube Paste Workflow (NEW):**
- UI: /studio/video → Video Background → Import from YouTube card → input aria-label="YouTube video URL" placeholder "Paste a link — youtube.com/watch?v=…, youtu.be/…, /shorts/…" + Import button
- Backend: POST /api/v1/upload/youtube {url} timeout 300s → fileKey UUIDv7 → streamUrl /api/v1/upload/file/:key Range → Badge violet YouTube
- JARVIS methods: api (fastest, direct API), browser (open UI + playwright fill + click Import), clipboard (pyperclip copy + ctrl+v + enter)
- Plugin: soundwave_youtube_paste url=https://... method=auto → tries api then clipboard

**Ask me:**
- "How to install Soundwave plugins into Mark LIII?"
- "Generate speech with Jenny"
- "How to make video with subtitles portrait?"
- "How to clone my voice?"
- "Import YouTube video"
- "Paste YouTube link https://... into video editor" ⭐ NEW
- "How to paste a YouTube link into Soundwave video editor?"

All plugins are in \`mark-liii-plugins/\` folder — ready to copy to Mark-LIII/plugins/.`,
    },
  ]);
  const [swInput, setSwInput] = useState("");
  const [swThinking, setSwThinking] = useState(false);

  const tts = useTTS((r) => {
    toast.success("Jarvis speaking", `Generated ${r.duration.toFixed(1)}s audio`);
  });

  useEffect(() => {
    jarvisApi.getActions().then((r) => setActions(r.actions)).catch(() => {});
    jarvisApi.getCore().then((r) => setCoreModules(r.modules)).catch(() => {});
    jarvisApi.getCapabilities().then((r) => setCapabilities(r.capabilities)).catch(() => {});
    jarvisApi.getKnowledge().then((r) => setStructure(r.structure)).catch(() => {});
    jarvisApi.getSoundwavePlugins().then((r) => setSoundwavePlugins(r.plugins)).catch(() => {});
    jarvisApi.getSoundwavePluginFiles().then((r) => setSoundwaveFiles(r.files)).catch(() => {});
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking, soundwaveMessages, swThinking]);

  const handleSend = () => {
    if (!input.trim() || isThinking) return;
    sendMessage(input);
    setInput("");
  };

  const handleSoundwaveSend = async () => {
    if (!swInput.trim() || swThinking) return;
    const userMsg = { id: `sw-u-${Date.now()}`, role: "user" as const, content: swInput.trim() };
    setSoundwaveMessages((prev) => [...prev, userMsg]);
    setSwInput("");
    setSwThinking(true);
    try {
      const res = await jarvisApi.soundwaveChat(userMsg.content, soundwaveMessages.map((m) => ({ role: m.role, content: m.content })));
      setSoundwaveMessages((prev) => [...prev, { id: `sw-a-${Date.now()}`, role: "assistant", content: res.answer }]);
    } catch (e) {
      setSoundwaveMessages((prev) => [...prev, { id: `sw-e-${Date.now()}`, role: "assistant", content: `Error: ${(e as Error).message}` }]);
    } finally {
      setSwThinking(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    toast.success("Copied", "Code copied to clipboard");
  };

  const speakMessage = (text: string) => {
    const clean = text.replace(/\*\*/g, "").replace(/`[^`]+`/g, "").replace(/```[\s\S]*?```/g, "").slice(0, 4000);
    if (clean.trim()) tts.generate(clean, "en-US-JennyNeural", { speed: 1, pitch: 0, volume: 100 });
  };

  const loadPluginFile = async (filename: string) => {
    try {
      const res = await jarvisApi.getSoundwavePluginFile(filename);
      setSelectedPluginFile({ name: res.filename, content: res.content });
      toast.success("Loaded", `${filename} — ${res.size} chars`);
    } catch (e) {
      toast.error("Failed", (e as Error).message);
    }
  };

  return (
    <div className="mx-auto max-w-[1600px]">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-gray-900 via-[#010d14] to-black p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(0,212,255,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,107,0,0.1),transparent_50%)]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_0_20px_rgba(0,212,255,0.4)]">
              <Bot className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-white">
                JARVIS Expert Bridge
                <span className="rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-xs font-medium text-cyan-300 border border-cyan-500/30">LIII ↔ Soundwave</span>
              </h1>
              <p className="mt-1 text-sm text-cyan-200/70">Teach Soundwave to use Mark-LIII • Teach Mark-LIII to use Soundwave • Bidirectional expert</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-2.5 py-1 text-xs text-gray-300"><Github className="h-3 w-3" /> FatihMakes/Mark-LIII 1.2k★</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-2.5 py-1 text-xs text-gray-300"><Music className="h-3 w-3 text-violet-400" /> Soundwave AI • 6 Neural Voices</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-2.5 py-1 text-xs text-gray-300"><Cpu className="h-3 w-3 text-cyan-400" /> Gemini 3.1 Flash Live</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex rounded-xl bg-black/40 border border-gray-700 p-1">
              <button onClick={() => setExpertMode("mark")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${expertMode === "mark" ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/30" : "text-gray-400 hover:text-white"}`}>Soundwave knows Mark LIII</button>
              <button onClick={() => setExpertMode("soundwave")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${expertMode === "soundwave" ? "bg-violet-500/20 text-violet-200 border border-violet-500/30" : "text-gray-400 hover:text-white"}`}>JARVIS knows Soundwave</button>
            </div>
            <a href="https://github.com/FatihMakes/Mark-LIII" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/15 border border-white/10">
              <Github className="h-4 w-4" /> Mark-LIII
            </a>
          </div>
        </div>
      </div>

      {/* Mode banner */}
      <div className="mt-4 rounded-xl border p-3 text-sm flex items-center gap-3" style={{ background: expertMode === "mark" ? "rgba(0,212,255,0.05)" : "rgba(139,92,246,0.05)", borderColor: expertMode === "mark" ? "rgba(0,212,255,0.2)" : "rgba(139,92,246,0.2)" }}>
        {expertMode === "mark" ? <><Bot className="h-4 w-4 text-cyan-400" /> <span className="text-cyan-200"><strong>Mode: Soundwave knows Mark-LIII</strong> — This page is Soundwave AI expert at using Mark-LIII repo. Chat about Mark-LIII actions, core, memory, wake word, plugins.</span></> : <><Music className="h-4 w-4 text-violet-400" /> <span className="text-violet-200"><strong>Mode: JARVIS knows Soundwave</strong> — Teaching Mark LIII JARVIS to use Soundwave AI studio. Chat about TTS, voices, video export, YouTube import, cloning. Plugins in mark-liii-plugins/ ready to copy to Mark-LIII/plugins/.</span></>}
      </div>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap gap-2 border-b border-gray-800 pb-2">
        {[
          { id: "chat", label: expertMode === "mark" ? "Mark-LIII Chat" : "Soundwave Chat", icon: <MessageSquare className="h-4 w-4" /> },
          { id: "soundwave", label: "JARVIS ↔ Soundwave", icon: <Music className="h-4 w-4" />, highlight: true },
          { id: "plugins", label: `Soundwave Plugins (${soundwaveFiles.length})`, icon: <Puzzle className="h-4 w-4" /> },
          { id: "actions", label: `Mark Actions (${actions.length})`, icon: <Wrench className="h-4 w-4" /> },
          { id: "core", label: `Core (${coreModules.length})`, icon: <Layers className="h-4 w-4" /> },
          { id: "capabilities", label: "Capabilities", icon: <Lightbulb className="h-4 w-4" /> },
          { id: "setup", label: "Setup", icon: <Terminal className="h-4 w-4" /> },
          { id: "generator", label: "Generator", icon: <FileCode className="h-4 w-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabId)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
              activeTab === tab.id
                ? (tab as any).highlight
                  ? "bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-white border border-cyan-500/30 shadow-[0_0_15px_rgba(0,212,255,0.2)]"
                  : "bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 shadow-[0_0_10px_rgba(0,212,255,0.2)]"
                : "bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-gray-200 border border-transparent"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {activeTab === "chat" && (
            <div className="space-y-4">
              {/* Mode toggle inside chat */}
              <div className="flex gap-2">
                <button onClick={() => setExpertMode("mark")} className={`flex-1 rounded-xl border p-3 text-left transition-all ${expertMode === "mark" ? "border-cyan-500/30 bg-cyan-500/5" : "border-gray-800 bg-gray-900/30 hover:border-gray-700"}`}>
                  <div className="flex items-center gap-2 text-sm font-semibold text-white"><Bot className="h-4 w-4 text-cyan-400" /> Soundwave knows Mark-LIII</div>
                  <div className="mt-1 text-xs text-gray-400">Expert at using Mark-LIII repo — actions, core, memory, wake word, plugins</div>
                </button>
                <button onClick={() => setExpertMode("soundwave")} className={`flex-1 rounded-xl border p-3 text-left transition-all ${expertMode === "soundwave" ? "border-violet-500/30 bg-violet-500/5" : "border-gray-800 bg-gray-900/30 hover:border-gray-700"}`}>
                  <div className="flex items-center gap-2 text-sm font-semibold text-white"><Music className="h-4 w-4 text-violet-400" /> JARVIS knows Soundwave</div>
                  <div className="mt-1 text-xs text-gray-400">Teach Mark-LIII JARVIS to use Soundwave — TTS, voices, video, cloning</div>
                </button>
              </div>

              {expertMode === "mark" ? (
                <div className="flex h-[700px] flex-col rounded-2xl border border-gray-800 bg-[#010d14]">
                  <div className="flex items-center justify-between border-b border-gray-800 p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                      <span className="text-sm font-medium text-white">Mark-LIII Expert • Local • No API</span>
                      <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">{messages.length} msgs</span>
                    </div>
                    <button onClick={clearChat} className="rounded-lg p-2 text-gray-500 hover:bg-gray-800 hover:text-gray-300"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((m) => (
                      <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        {m.role === "assistant" && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600"><Bot className="h-4 w-4 text-white" /></div>}
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-gradient-to-br from-blue-600 to-violet-600 text-white" : "bg-gray-800/80 border border-gray-700/50 text-gray-100"}`}>
                          <MarkdownLite text={m.content} />
                          {m.codeExample && (
                            <div className="mt-3">
                              <div className="flex items-center justify-between"><span className="text-xs font-medium text-cyan-300">Code</span><button onClick={() => copyToClipboard(m.codeExample!, `code-${m.id}`)} className="inline-flex items-center gap-1 rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600">{copied === `code-${m.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copy</button></div>
                              <pre className="mt-2 overflow-x-auto rounded-lg bg-black/50 p-3 text-xs text-gray-300 border border-gray-700">{m.codeExample.slice(0, 2000)}</pre>
                            </div>
                          )}
                          {m.sources && <div className="mt-3 flex flex-wrap gap-1.5">{m.sources.map((s, i) => <span key={i} className="rounded-full bg-gray-900 px-2 py-0.5 text-[10px] text-gray-400 border border-gray-700">{s}</span>)}</div>}
                          {m.relatedActions && <div className="mt-2 flex flex-wrap gap-1">{m.relatedActions.map((a) => <span key={a} className="rounded bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-300 border border-cyan-500/20">{a}</span>)}</div>}
                          {m.role === "assistant" && <div className="mt-3 flex gap-2"><button onClick={() => speakMessage(m.content)} className="inline-flex items-center gap-1 rounded-full bg-gray-700/50 px-2.5 py-1 text-xs text-gray-300 hover:bg-gray-700"><Volume2 className="h-3 w-3" /> Speak</button></div>}
                          {m.followUp && <div className="mt-3 space-y-1"><span className="text-xs text-gray-500">Follow-up:</span><div className="flex flex-wrap gap-1.5">{m.followUp.map((f, i) => <button key={i} onClick={() => sendMessage(f)} className="rounded-full border border-gray-700 bg-gray-800 px-2.5 py-1 text-xs text-gray-300 hover:border-cyan-500/30 hover:text-cyan-300 hover:bg-cyan-500/10 text-left">{f}</button>)}</div></div>}
                        </div>
                        {m.role === "user" && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-700"><span className="text-xs font-bold text-white">U</span></div>}
                      </div>
                    ))}
                    {isThinking && <div className="flex gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600"><Bot className="h-4 w-4 text-white" /></div><div className="rounded-2xl bg-gray-800/80 border border-gray-700/50 px-4 py-3"><div className="flex gap-1"><span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400" /><span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400" style={{ animationDelay: "150ms" }} /><span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400" style={{ animationDelay: "300ms" }} /></div></div></div>}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="border-t border-gray-800 p-4">
                    <div className="flex gap-2"><div className="relative flex-1"><input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="Ask about Mark-LIII: plugins, actions, memory, wake word..." className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 pr-12 text-sm text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none" /><button onClick={handleSend} disabled={!input.trim() || isThinking} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 p-2 text-white hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50"><Send className="h-4 w-4" /></button></div></div>
                    <div className="mt-3 flex flex-wrap gap-1.5">{["How to create a plugin?", "List all actions", "Explain memory", "Wake word setup", "Generate weather plugin"].map((q) => <button key={q} onClick={() => sendMessage(q)} className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200 border border-gray-700">{q}</button>)}</div>
                  </div>
                </div>
              ) : (
                <div className="flex h-[700px] flex-col rounded-2xl border border-violet-500/20 bg-[#0a0a14]">
                  <div className="flex items-center justify-between border-b border-gray-800 p-4">
                    <div className="flex items-center gap-3"><div className="h-2 w-2 animate-pulse rounded-full bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.6)]" /><span className="text-sm font-medium text-white">Soundwave Expert • Teaching JARVIS to use Soundwave</span><span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-xs text-violet-300 border border-violet-500/20">{soundwaveMessages.length} msgs</span></div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {soundwaveMessages.map((m) => (
                      <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        {m.role === "assistant" && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600"><Music className="h-4 w-4 text-white" /></div>}
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-gradient-to-br from-violet-600 to-purple-600 text-white" : "bg-gray-800/80 border border-gray-700/50 text-gray-100"}`}><MarkdownLite text={m.content} />{m.role === "assistant" && <div className="mt-3 flex gap-2"><button onClick={() => speakMessage(m.content)} className="inline-flex items-center gap-1 rounded-full bg-gray-700/50 px-2.5 py-1 text-xs text-gray-300 hover:bg-gray-700"><Volume2 className="h-3 w-3" /> Speak</button></div>}</div>
                        {m.role === "user" && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-700"><span className="text-xs font-bold text-white">U</span></div>}
                      </div>
                    ))}
                    {swThinking && <div className="flex gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600"><Music className="h-4 w-4 text-white" /></div><div className="rounded-2xl bg-gray-800/80 border border-gray-700/50 px-4 py-3"><div className="flex gap-1"><span className="h-2 w-2 animate-bounce rounded-full bg-violet-400" /><span className="h-2 w-2 animate-bounce rounded-full bg-violet-400" style={{ animationDelay: "150ms" }} /><span className="h-2 w-2 animate-bounce rounded-full bg-violet-400" style={{ animationDelay: "300ms" }} /></div></div></div>}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="border-t border-gray-800 p-4">
                    <div className="flex gap-2"><div className="relative flex-1"><input value={swInput} onChange={(e) => setSwInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSoundwaveSend(); } }} placeholder="Ask how JARVIS uses Soundwave: TTS, voices, video, cloning..." className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 pr-12 text-sm text-white placeholder-gray-500 focus:border-violet-500/50 focus:outline-none" /><button onClick={handleSoundwaveSend} disabled={!swInput.trim() || swThinking} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 p-2 text-white hover:from-violet-400 hover:to-purple-500 disabled:opacity-50"><Send className="h-4 w-4" /></button></div></div>
                    <div className="mt-3 flex flex-wrap gap-1.5">{["How to install plugins?", "Generate speech with Jenny", "Make video portrait 9:16", "How to clone voice?", "Import YouTube video", "Paste YouTube link into video editor ⭐"].map((q) => <button key={q} onClick={() => { setSwInput(q); setTimeout(() => { const ev = new KeyboardEvent("keydown", { key: "Enter" }); document.dispatchEvent(ev); }, 100); jarvisApi.soundwaveChat(q).then((r) => setSoundwaveMessages((prev) => [...prev, { id: `sw-a-${Date.now()}`, role: "assistant", content: r.answer }])); }} className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200 border border-gray-700">{q}</button>)}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "soundwave" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 via-[#0a0a14] to-black p-6">
                <h2 className="flex items-center gap-2 text-xl font-bold text-white"><Music className="h-5 w-5 text-violet-400" /> Teach JARVIS to Use Soundwave — Complete Bridge</h2>
                <p className="mt-2 text-sm text-gray-400">Soundwave AI is a production TTS + video studio (6 Microsoft Neural voices via free Edge TTS, FFmpeg video export, yt-dlp YouTube import). These 7 plugins make Mark-LIII JARVIS an expert at using it.</p>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {soundwavePlugins.map((p, i) => (
                    <div key={i} className="rounded-xl border border-gray-800 bg-black/40 p-4">
                      <div className="flex items-center gap-2"><span className={`rounded-lg px-2 py-1 text-xs font-mono border ${p.isPlugin ? "bg-violet-500/10 text-violet-300 border-violet-500/20" : "bg-gray-800 text-gray-400 border-gray-700"}`}>{p.file}</span>{p.isPlugin && <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] text-green-300 border border-green-500/20">PLUGIN</span>}</div>
                      <div className="mt-2 text-sm font-medium text-white">{(p as any).name || p.file} — {p.purpose}</div>
                      {p.triggers && <div className="mt-2 flex flex-wrap gap-1">{p.triggers.slice(0, 3).map((t) => <span key={t} className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400">"{t}"</span>)}</div>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
                <h3 className="font-semibold text-white flex items-center gap-2"><Terminal className="h-4 w-4 text-cyan-400" /> Installation — 3 Steps</h3>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-black/60 p-4 text-sm text-gray-300 border border-gray-800">
{`# 1. Install Mark LIII + deps
git clone https://github.com/FatihMakes/Mark-LIII.git
cd Mark-LIII
python setup.py
pip install edge-tts requests yt-dlp

# 2. Copy Soundwave plugins (from this repo)
cp /path/to/Soundwave-AI/mark-liii-plugins/soundwave_*.py ./plugins/
cp /path/to/Soundwave-AI/mark-liii-plugins/_soundwave_client.py ./plugins/

# 3. Configure (optional) + Restart
export SOUNDWAVE_API_URL=http://localhost:4000
export SOUNDWAVE_API_KEY=swa_live_...
python main.py
# Logs: Plugin loaded: soundwave_tts, soundwave_voices, soundwave_studio, etc.`}
                </pre>
              </div>

              <div className="rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 via-black/40 to-black p-5">
                <h3 className="font-semibold text-white flex items-center gap-2"><Youtube className="h-5 w-5 text-red-400" /> ⭐ NEW: Paste YouTube Link into Video Editor — Exact Workflow for JARVIS</h3>
                <div className="mt-3 space-y-3 text-xs text-gray-300">
                  <div className="rounded-lg bg-black/60 border border-gray-800 p-3">
                    <div className="text-white font-medium">UI Location — VideoCompositor.tsx /studio/video</div>
                    <div className="mt-2 text-gray-400 space-y-1">
                      <div>• Page: <code className="text-cyan-300">/studio/video</code> — left column Video Background section (rounded-card border-gray-800 bg-panel p-5)</div>
                      <div>• If no video: drag & drop zone + <span className="text-white">Import from YouTube card</span> (Youtube icon red)</div>
                      <div>• Card: mt-4 rounded-card border border-gray-800 bg-gray-900/50 p-4 → Title + Form + Input + Button</div>
                      <div>• Input: <code className="text-violet-300">aria-label="YouTube video URL"</code> placeholder <code className="text-yellow-300">"Paste a link — youtube.com/watch?v=…, youtu.be/…, /shorts/…"</code> class h-10 w-full rounded-input border-gray-700 bg-gray-900</div>
                      <div>• Button: <code className="text-white">Import</code> with Youtube icon h-10 type submit size sm loading ytImporting</div>
                      <div>• Importing: ProgressBar indeterminate + "Downloading from YouTube — long videos can take a minute."</div>
                    </div>
                  </div>
                  <div className="rounded-lg bg-black/60 border border-gray-800 p-3">
                    <div className="text-white font-medium">Backend — importYouTube()</div>
                    <pre className="mt-2 overflow-x-auto text-[11px] text-gray-300">{
`const res = await http.post<{fileKey, name, size}>("/upload/youtube", { url }, { timeout: 300_000 });
const streamUrl = \`/api/v1/upload/file/\${res.fileKey}\`;
setVideoFileKey(res.fileKey); setVideoUrl(streamUrl); setVideoName(res.name);
studio.setVideo({ blob: null, url: streamUrl, name: res.name, fileKey: res.fileKey });
// Badge violet YouTube, videoFromYouTube = videoUrl.startsWith("/api/v1/upload/file/")
`}</pre>
                  </div>
                  <div className="rounded-lg bg-black/60 border border-gray-800 p-3">
                    <div className="text-white font-medium">JARVIS 3 Methods (plugin soundwave_youtube_paste.py)</div>
                    <div className="mt-2 space-y-2">
                      <div><span className="text-green-300 font-medium">A) API Direct (fastest, recommended):</span><br/>
                      <code className="text-cyan-300">from _soundwave_client import api_request; res = api_request("POST", "/api/v1/upload/youtube", json_data={"{"}"url": "https://..."{"}"}, timeout=300); fileKey = res["fileKey"]</code></div>
                      <div><span className="text-blue-300 font-medium">B) Browser Automation:</span><br/>
                      browser_control open url=http://localhost:5173/studio/video → wait 3-4s → focus [aria-label="YouTube video URL"] via playwright → fill url → click button:has-text("Import") → wait Badge YouTube<br/>
                      <code className="text-gray-400">await page.goto("http://localhost:5173/studio/video"); await page.wait_for_selector('[aria-label="YouTube video URL"]'); await page.fill('[aria-label="YouTube video URL"]', url); await page.click('button:has-text("Import")');</code></div>
                      <div><span className="text-yellow-300 font-medium">C) Clipboard:</span><br/>
                      <code className="text-gray-400">pyperclip.copy(url) + pyautogui.hotkey('ctrl','v') + press enter — input aria-label="YouTube video URL"</code></div>
                    </div>
                  </div>
                  <div className="text-gray-500">Supported: youtube.com/watch?v=..., youtu.be/..., /shorts/..., m.youtube.com with &t=30s &list=... — yt-dlp vendored vendor/yt-dlp/yt-dlp needs python3, YTDLP_COOKIES for age/bot-gated, YTDLP_MAX_DURATION 1200s cap</div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
                  <h3 className="font-semibold text-white flex items-center gap-2"><Mic className="h-4 w-4 text-cyan-400" /> Voice Commands for JARVIS</h3>
                  <div className="mt-3 space-y-2 text-xs text-gray-400">
                    <div><span className="text-white">TTS:</span> "Generate speech with Jenny: Hello world"</div>
                    <div><span className="text-white">Voices:</span> "List Soundwave voices", "Recommend voice for TikTok"</div>
                    <div><span className="text-white">Studio:</span> "Use Soundwave studio to create voiceover"</div>
                    <div><span className="text-white">Projects:</span> "List my Soundwave projects"</div>
                    <div><span className="text-white">Video:</span> "Make video with subtitles portrait 9:16"</div>
                    <div><span className="text-white">Clone:</span> "Clone my voice", "List cloned voices"</div>
                    <div><span className="text-white">YouTube:</span> "Import YouTube video https://..."</div>
                    <div className="rounded bg-violet-500/10 border border-violet-500/20 p-2 mt-2"><span className="text-violet-300">Paste YouTube ⭐ NEW:</span> "Paste YouTube link https://youtube.com/watch?v=... into video editor" → soundwave_youtube_paste method=auto</div>
                  </div>
                </div>
                <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
                  <h3 className="font-semibold text-white flex items-center gap-2"><Film className="h-4 w-4 text-violet-400" /> Soundwave Architecture for JARVIS</h3>
                  <div className="mt-3 space-y-2 text-xs text-gray-400">
                    <div><span className="text-white">TTS:</span> server/src/lib/edgeTts.ts (Node) ↔ _soundwave_client.py synthesize_edge_tts() (Python edge-tts) — same free Microsoft Edge TTS</div>
                    <div><span className="text-white">Voices:</span> 6 Neural: Jenny warm, Ana energetic, Sonia British elegant, Christopher deep, Guy casual, Ryan British clear</div>
                    <div><span className="text-white">API:</span> /api/v1/voices (no auth), /api/v1/tts/synthesize (auth, MP3 base64 + timings), /api/v1/projects (Pro+), /api/v1/export/video (FFmpeg)</div>
                    <div><span className="text-white">Video:</span> FFmpeg libx264/libvpx-vp9 + libass, 16:9 + 9:16 portrait (Shorts/TikTok/Reels), looping if shorter</div>
                    <div><span className="text-white">YouTube:</span> vendor/yt-dlp/yt-dlp zipapp needs python3, YTDLP_COOKIES, YTDLP_MAX_DURATION</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "plugins" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                <h3 className="font-semibold text-white flex items-center gap-2"><FolderKanban className="h-4 w-4 text-violet-400" /> mark-liii-plugins/ — Files ready to copy to Mark-LIII/plugins/</h3>
                <p className="mt-1 text-xs text-gray-400">These files teach JARVIS to use Soundwave. Copy soundwave_*.py + _soundwave_client.py to Mark-LIII/plugins/, restart.</p>
                <div className="mt-4 grid grid-cols-1 gap-2">
                  {soundwaveFiles.map((f) => (
                    <div key={f.name} className="flex items-center justify-between rounded-lg border border-gray-800 bg-black/40 px-3 py-2">
                      <div className="flex items-center gap-2"><FileCode className={`h-4 w-4 ${f.isPlugin ? "text-violet-400" : "text-gray-500"}`} /><span className="text-sm font-mono text-white">{f.name}</span><span className="text-xs text-gray-500">{(f.size / 1024).toFixed(1)} KB</span>{f.isPlugin ? <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300 border border-violet-500/20">PLUGIN</span> : <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400">helper</span>}</div>
                      <div className="flex gap-1"><button onClick={() => loadPluginFile(f.name)} className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700">View</button><a href={`/api/v1/jarvis/soundwave/plugins/files/${f.name}`} target="_blank" className="rounded bg-violet-500/10 px-2 py-1 text-xs text-violet-300 hover:bg-violet-500/20 border border-violet-500/20">Raw</a></div>
                    </div>
                  ))}
                </div>
              </div>
              {selectedPluginFile && (
                <div className="rounded-xl border border-violet-500/20 bg-[#0a0a14] p-5">
                  <div className="flex items-center justify-between"><h3 className="font-semibold text-white flex items-center gap-2"><FileCode className="h-4 w-4 text-violet-400" /> {selectedPluginFile.name}</h3><div className="flex gap-2"><button onClick={() => copyToClipboard(selectedPluginFile.content, "plugin-file")} className="inline-flex items-center gap-1 rounded-lg bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700">{copied === "plugin-file" ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />} Copy</button><button onClick={() => { const blob = new Blob([selectedPluginFile.content], { type: "text/x-python" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = selectedPluginFile.name; a.click(); URL.revokeObjectURL(url); }} className="inline-flex items-center gap-1 rounded-lg bg-violet-500/20 px-3 py-1.5 text-xs text-violet-300 hover:bg-violet-500/30 border border-violet-500/20"><Download className="h-3 w-3" /> Download</button></div></div>
                  <pre className="mt-3 max-h-[600px] overflow-auto rounded-lg border border-gray-800 bg-black/60 p-4 text-xs text-gray-300 whitespace-pre-wrap">{selectedPluginFile.content}</pre>
                </div>
              )}
            </div>
          )}

          {activeTab === "actions" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                {actions.map((action) => (
                  <div key={action.name} onClick={() => setSelectedAction(action)} className={`cursor-pointer rounded-xl border p-4 transition-all ${selectedAction?.name === action.name ? "border-cyan-500/50 bg-cyan-500/5 shadow-[0_0_15px_rgba(0,212,255,0.1)]" : "border-gray-800 bg-gray-900/50 hover:border-gray-700 hover:bg-gray-900"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2"><span className="rounded-lg bg-gray-800 px-2 py-1 text-xs font-mono text-cyan-300 border border-gray-700">{action.name}</span><span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400">{action.category}</span><span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400">{action.osSupport}</span></div>
                        <p className="mt-2 text-sm text-gray-300">{action.description}</p>
                        <div className="mt-2 flex flex-wrap gap-1">{action.exampleUsage.slice(0, 3).map((ex, i) => <span key={i} className="rounded-full bg-gray-800/80 px-2 py-0.5 text-xs text-gray-400">"{ex}"</span>)}</div>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${selectedAction?.name === action.name ? "rotate-180" : ""}`} />
                    </div>
                    {selectedAction?.name === action.name && (
                      <div className="mt-4 border-t border-gray-800 pt-4">
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Parameters</h4>
                        <div className="mt-2 space-y-2">{Object.entries(action.parameters).map(([key, param]) => <div key={key} className="flex gap-2 text-xs"><span className="font-mono text-cyan-300">{key}</span><span className="text-gray-500">{param.type}</span>{param.required && <span className="rounded bg-red-500/20 px-1 text-red-300">required</span>}<span className="text-gray-400">{param.description}</span></div>)}{Object.keys(action.parameters).length === 0 && <span className="text-xs text-gray-500">No parameters — zero-arg tool</span>}</div>
                        <div className="mt-3 text-xs text-gray-500">File: <span className="font-mono text-gray-400">{action.file}</span></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "core" && (
            <div className="space-y-3">
              {coreModules.map((mod) => (
                <div key={mod.file} onClick={() => setSelectedCore(selectedCore?.file === mod.file ? null : mod)} className={`cursor-pointer rounded-xl border p-4 ${selectedCore?.file === mod.file ? "border-violet-500/30 bg-violet-500/5" : "border-gray-800 bg-gray-900/50 hover:border-gray-700"}`}>
                  <div className="flex items-start justify-between"><div><h3 className="font-semibold text-white flex items-center gap-2"><Layers className="h-4 w-4 text-violet-400" /> {mod.name}</h3><p className="mt-1 text-sm text-gray-400">{mod.purpose}</p><span className="mt-2 inline-block rounded bg-gray-800 px-2 py-0.5 text-xs font-mono text-gray-400">{mod.file}</span></div><ChevronDown className={`h-4 w-4 text-gray-500 ${selectedCore?.file === mod.file ? "rotate-180" : ""}`} /></div>
                  {selectedCore?.file === mod.file && <div className="mt-4 grid grid-cols-1 gap-4 border-t border-gray-800 pt-4 md:grid-cols-2"><div><h4 className="text-xs font-semibold text-gray-400 uppercase">Key Concepts</h4><ul className="mt-2 space-y-1">{mod.keyConcepts.map((c, i) => <li key={i} className="flex gap-2 text-xs text-gray-300"><span className="text-violet-400">•</span> {c}</li>)}</ul></div><div><h4 className="text-xs font-semibold text-gray-400 uppercase">API Surface</h4><div className="mt-2 flex flex-wrap gap-1">{mod.apiSurface.map((api) => <span key={api} className="rounded bg-gray-800 px-2 py-0.5 text-xs font-mono text-gray-300">{api}</span>)}</div></div></div>}
                </div>
              ))}
            </div>
          )}

          {activeTab === "capabilities" && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {capabilities.map((cap, i) => <div key={i} className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 hover:border-gray-700"><div className="flex items-start gap-3"><span className="text-2xl">{cap.icon}</span><div className="flex-1"><h3 className="font-semibold text-white">{cap.title}</h3><p className="mt-1 text-sm text-gray-400">{cap.description}</p><p className="mt-2 text-xs text-cyan-300/80"><span className="text-gray-500">How:</span> {cap.howToUse.slice(0, 120)}...</p></div></div></div>)}
            </div>
          )}

          {activeTab === "setup" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
                <h3 className="flex items-center gap-2 font-semibold text-white"><Terminal className="h-4 w-4 text-cyan-400" /> Mark-LIII Quick Start</h3>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-black/60 p-4 text-sm text-gray-300 border border-gray-800">{`git clone https://github.com/FatihMakes/Mark-LIII.git
cd Mark-LIII
python setup.py
python main.py`}</pre>
              </div>
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5">
                <h3 className="flex items-center gap-2 font-semibold text-white"><Music className="h-4 w-4 text-violet-400" /> Soundwave → Mark-LIII Integration</h3>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-black/60 p-4 text-sm text-gray-300 border border-gray-800">
{`# Install Mark LIII plugins teaching JARVIS to use Soundwave
pip install edge-tts requests yt-dlp
cp mark-liii-plugins/soundwave_*.py /path/to/Mark-LIII/plugins/
cp mark-liii-plugins/_soundwave_client.py /path/to/Mark-LIII/plugins/
export SOUNDWAVE_API_URL=http://localhost:4000
python main.py
# Say: "Generate speech with Jenny: Hello Soundwave"`}
                </pre>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
                <h3 className="font-semibold text-white flex items-center gap-2"><FileCode className="h-4 w-4 text-violet-400" /> Project Structure</h3>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-black/60 p-4 text-xs text-gray-400 border border-gray-800 whitespace-pre-wrap">{structure || "Loading..."}</pre>
              </div>
            </div>
          )}

          {activeTab === "generator" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
                <h3 className="flex items-center gap-2 font-semibold text-white"><Sparkles className="h-4 w-4 text-cyan-400" /> Generate Mark-LIII Plugin</h3>
                <p className="mt-1 text-sm text-gray-400">Describe what plugin should do — generates PLUGIN dict + run() ready for plugins/</p>
                <div className="mt-4 space-y-3">
                  <div><label className="text-xs font-medium text-gray-400">Description</label><textarea value={pluginDesc} onChange={(e) => setPluginDesc(e.target.value)} placeholder="e.g. Weather plugin that fetches live weather for any city" className="mt-1 w-full rounded-xl border border-gray-700 bg-black/50 px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-cyan-500/50 focus:outline-none" rows={3} /></div>
                  <div><label className="text-xs font-medium text-gray-400">Name (optional, snake_case)</label><input value={pluginName} onChange={(e) => setPluginName(e.target.value)} placeholder="e.g. weather_lookup" className="mt-1 w-full rounded-xl border border-gray-700 bg-black/50 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-cyan-500/50 focus:outline-none" /></div>
                  <button onClick={() => generate(pluginDesc, pluginName || undefined)} disabled={!pluginDesc.trim() || isGenerating} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50">{isGenerating ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Code2 className="h-4 w-4" />} Generate Plugin</button>
                </div>
              </div>
              {pluginResult && (
                <div className="rounded-xl border border-cyan-500/20 bg-[#010d14] p-5">
                  <div className="flex items-center justify-between"><h3 className="font-semibold text-white flex items-center gap-2"><FileCode className="h-4 w-4 text-cyan-400" /> {pluginResult.fileName}</h3><div className="flex gap-2"><button onClick={() => copyToClipboard(pluginResult.code, "plugin-code")} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700">{copied === "plugin-code" ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />} Copy</button><button onClick={() => { const blob = new Blob([pluginResult.code], { type: "text/x-python" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = pluginResult.fileName; a.click(); URL.revokeObjectURL(url); }} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/20 px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/20"><Download className="h-3 w-3" /> Download</button></div></div>
                  <div className="mt-3 rounded-lg border border-gray-800 bg-black/60 p-4"><pre className="overflow-x-auto text-xs text-gray-300 whitespace-pre-wrap">{pluginResult.code}</pre></div>
                  <div className="mt-4 rounded-lg bg-gray-900/50 p-4 border border-gray-800"><h4 className="text-xs font-semibold text-gray-400 uppercase">Explanation</h4><div className="mt-2 text-sm text-gray-300 whitespace-pre-wrap">{pluginResult.explanation}</div></div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-800 bg-[#010d14] p-5">
            <h3 className="flex items-center gap-2 font-semibold text-white"><BookOpen className="h-4 w-4 text-cyan-400" /> Quick Knowledge</h3>
            <div className="mt-4 space-y-3 text-xs">
              <div className="rounded-lg bg-violet-500/5 p-3 border border-violet-500/20"><div className="flex items-center gap-2 text-violet-300 font-medium"><Music className="h-3 w-3" /> Soundwave TTS</div><p className="mt-1 text-gray-400">6 Neural voices via Edge TTS free, no API key, 24kHz MP3. Jenny warm, Ana energetic, Sonia British elegant, Christopher deep, Guy casual, Ryan British clear.</p></div>
              <div className="rounded-lg bg-gray-900/50 p-3 border border-gray-800"><div className="flex items-center gap-2 text-cyan-300 font-medium"><Mic className="h-3 w-3" /> Wake Word</div><p className="mt-1 text-gray-400">Local openwakeword, zero cloud while asleep, 120s auto-sleep, own thread.</p></div>
              <div className="rounded-lg bg-gray-900/50 p-3 border border-gray-800"><div className="flex items-center gap-2 text-violet-300 font-medium"><Brain className="h-3 w-3" /> Recallable Memory</div><p className="mt-1 text-gray-400">200k guard, 900 core + 420 index, local search &lt;1ms, no deletions.</p></div>
              <div className="rounded-lg bg-gray-900/50 p-3 border border-gray-800"><div className="flex items-center gap-2 text-green-300 font-medium"><Puzzle className="h-3 w-3" /> Self-Describing Skills</div><p className="mt-1 text-gray-400">TOOL/PLUGIN dict + run(), auto-discovered, one-file operation.</p></div>
              <div className="rounded-lg bg-gray-900/50 p-3 border border-gray-800"><div className="flex items-center gap-2 text-orange-300 font-medium"><Video className="h-3 w-3" /> Video Export</div><p className="mt-1 text-gray-400">FFmpeg libx264 + libass, 16:9 + 9:16 portrait for Shorts/TikTok, looping if shorter.</p></div>
              <div className="rounded-lg bg-gray-900/50 p-3 border border-gray-800"><div className="flex items-center gap-2 text-red-300 font-medium"><Youtube className="h-3 w-3" /> YouTube Import</div><p className="mt-1 text-gray-400">yt-dlp vendored zipapp needs python3, Range supported, cookies for age-gated.</p></div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900/30 p-5">
            <h3 className="font-semibold text-white flex items-center gap-2"><Settings2 className="h-4 w-4" /> Expert Stats</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-black/40 p-3 border border-gray-800"><div className="text-gray-500">Mark Actions</div><div className="text-lg font-bold text-white">{actions.length}</div></div>
              <div className="rounded-lg bg-black/40 p-3 border border-gray-800"><div className="text-gray-500">Soundwave Plugins</div><div className="text-lg font-bold text-violet-300">{soundwaveFiles.filter((f) => f.isPlugin).length}</div></div>
              <div className="rounded-lg bg-black/40 p-3 border border-gray-800"><div className="text-gray-500">Voices</div><div className="text-lg font-bold text-white">6 Neural</div></div>
              <div className="rounded-lg bg-black/40 p-3 border border-gray-800"><div className="text-gray-500">Model</div><div className="text-sm font-bold text-cyan-300">Gemini 3.1 Flash Live</div></div>
            </div>
            <div className="mt-4 rounded-lg bg-gradient-to-br from-violet-500/10 to-cyan-500/10 p-3 border border-violet-500/20">
              <div className="text-xs text-violet-200 font-medium">💡 JARVIS + Soundwave</div>
              <p className="mt-1 text-xs text-gray-400">JARVIS now generates voiceovers via Soundwave's Edge TTS, manages projects, burns subtitles into video (16:9 + 9:16 portrait), imports YouTube, clones voices. All via 7 drop-in plugins in mark-liii-plugins/.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5">
            <h3 className="font-semibold text-white flex items-center gap-2"><Youtube className="h-5 w-5 text-red-400" /> Paste YouTube Workflow for JARVIS ⭐</h3>
            <div className="mt-3 space-y-2 text-xs text-gray-300">
              <div><span className="text-white">UI:</span> /studio/video → Video Background → Import from YouTube card → input <code className="text-violet-300">[aria-label="YouTube video URL"]</code> + Import button</div>
              <div><span className="text-white">API:</span> POST /api/v1/upload/youtube {"{"}url{"}"} timeout 300s → fileKey → /api/v1/upload/file/:key Range</div>
              <div><span className="text-white">JARVIS:</span> soundwave_youtube_paste url=... method=auto (api→clipboard fallback)</div>
              <div><span className="text-white">Browser:</span> browser_control open + playwright fill + click Import</div>
              <div><span className="text-white">Badge:</span> YouTube violet appears, videoName + Remove button</div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900/30 p-5">
            <h3 className="font-semibold text-white flex items-center gap-2"><Clapperboard className="h-4 w-4 text-violet-400" /> Soundwave Workflow for JARVIS</h3>
            <div className="mt-3 space-y-2 text-xs text-gray-400">
              <div><span className="text-white">1. TTS:</span> soundwave_tts text="..." voice=Jenny → MP3 + SRT + auto-play</div>
              <div><span className="text-white">2. Projects:</span> soundwave_projects list / create</div>
              <div><span className="text-white">3. Video:</span> soundwave_video prepare text="..." aspect=9:16 → project folder</div>
              <div><span className="text-white">4. YouTube:</span> soundwave_youtube url=... download OR soundwave_youtube_paste url=... method=api ⭐</div>
              <div><span className="text-white">5. Export:</span> Soundwave UI http://localhost:5173/studio/video → upload + style + export MP4</div>
              <div><span className="text-white">6. Clone:</span> soundwave_clone clone_info + generate</div>
              <div><span className="text-white">7. Paste:</span> /studio/video → Video Background → Import from YouTube → paste link → Import → fileKey → Badge YouTube</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
