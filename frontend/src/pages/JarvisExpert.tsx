import { useEffect, useState, useRef } from "react";
import {
  Bot,
  Cpu,
  Code2,
  Puzzle,
  Brain,
  Mic,
  Volume2,
  Zap,
  Layers,
  FileCode,
  Settings2,
  Search,
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
  ExternalLink,
  Github,
  Terminal,
  Shield,
  Headphones,
  Undo2,
} from "lucide-react";
import { useJarvisExpert, usePluginGenerator } from "../hooks/useJarvisExpert";
import { jarvisApi, type JarvisAction, type JarvisCoreModule, type JarvisCapability } from "../lib/jarvisApi";
import { useTTS } from "../hooks/useTTS";
import { toast } from "../store/toast";

function MarkdownLite({ text }: { text: string }) {
  // Very small markdown renderer for bold, code blocks, inline code, lists
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
        // Process bold and inline code
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
              if (line.startsWith("### ")) {
                return <h4 key={li} className="mt-3 font-semibold text-white">{line.slice(4)}</h4>;
              }
              if (line.startsWith("## ")) {
                return <h3 key={li} className="mt-4 text-base font-bold text-white">{line.slice(3)}</h3>;
              }
              if (line.startsWith("# ")) {
                return <h2 key={li} className="mt-4 text-lg font-bold text-white">{line.slice(2)}</h2>;
              }
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

export function JarvisExpert() {
  const { messages, isThinking, sendMessage, clearChat } = useJarvisExpert();
  const { isGenerating, result: pluginResult, generate } = usePluginGenerator();
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "actions" | "core" | "capabilities" | "setup" | "generator">("chat");
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

  const tts = useTTS((r) => {
    toast.success("Jarvis speaking", `Generated ${r.duration.toFixed(1)}s audio`);
  });

  useEffect(() => {
    // Load knowledge bases
    jarvisApi.getActions().then((r) => setActions(r.actions)).catch(() => {});
    jarvisApi.getCore().then((r) => setCoreModules(r.modules)).catch(() => {});
    jarvisApi.getCapabilities().then((r) => setCapabilities(r.capabilities)).catch(() => {});
    jarvisApi.getKnowledge().then((r) => setStructure(r.structure)).catch(() => {});
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const handleSend = () => {
    if (!input.trim() || isThinking) return;
    sendMessage(input);
    setInput("");
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    toast.success("Copied", "Code copied to clipboard");
  };

  const speakMessage = (text: string) => {
    // Strip markdown for TTS
    const clean = text.replace(/\*\*/g, "").replace(/`[^`]+`/g, "").replace(/```[\s\S]*?```/g, "").slice(0, 4000);
    if (clean.trim()) {
      tts.generate(clean, "en-US-JennyNeural", { speed: 1, pitch: 0, volume: 100 });
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
                JARVIS MARK LIII Expert
                <span className="rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-xs font-medium text-cyan-300 border border-cyan-500/30">LIII • 53</span>
              </h1>
              <p className="mt-1 text-sm text-cyan-200/70">Cross-platform personal AI assistant — Full repo expertise • Gemini 3.1 Flash Live • Self-describing skills</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-2.5 py-1 text-xs text-gray-300"><Github className="h-3 w-3" /> FatihMakes/Mark-LIII</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-2.5 py-1 text-xs text-gray-300"><Zap className="h-3 w-3 text-yellow-400" /> 1.2k★ • 519 forks</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-2.5 py-1 text-xs text-gray-300"><Cpu className="h-3 w-3 text-cyan-400" /> Gemini 3.1 Flash Live</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <a href="https://github.com/FatihMakes/Mark-LIII" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/15 border border-white/10">
              <Github className="h-4 w-4" /> Open Repo <ExternalLink className="h-3 w-3" />
            </a>
            <button onClick={() => setActiveTab("generator")} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_15px_rgba(0,212,255,0.3)] hover:from-cyan-400 hover:to-blue-500">
              <Sparkles className="h-4 w-4" /> Generate Plugin
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap gap-2 border-b border-gray-800 pb-2">
        {[
          { id: "chat", label: "Chat Expert", icon: <MessageSquare className="h-4 w-4" /> },
          { id: "actions", label: `Actions (${actions.length})`, icon: <Wrench className="h-4 w-4" /> },
          { id: "core", label: `Core (${coreModules.length})`, icon: <Layers className="h-4 w-4" /> },
          { id: "capabilities", label: "Capabilities", icon: <Lightbulb className="h-4 w-4" /> },
          { id: "setup", label: "Setup & Structure", icon: <Terminal className="h-4 w-4" /> },
          { id: "generator", label: "Plugin Generator", icon: <FileCode className="h-4 w-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
              activeTab === tab.id ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 shadow-[0_0_10px_rgba(0,212,255,0.2)]" : "bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-gray-200 border border-transparent"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main */}
        <div className="lg:col-span-2">
          {activeTab === "chat" && (
            <div className="flex h-[700px] flex-col rounded-2xl border border-gray-800 bg-[#010d14]">
              {/* Chat header */}
              <div className="flex items-center justify-between border-b border-gray-800 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                  <span className="text-sm font-medium text-white">JARVIS Expert • Local Knowledge • No API needed</span>
                  <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">{messages.length} messages</span>
                </div>
                <button onClick={clearChat} className="rounded-lg p-2 text-gray-500 hover:bg-gray-800 hover:text-gray-300">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((m) => (
                  <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    {m.role === "assistant" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                    )}
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-gradient-to-br from-blue-600 to-violet-600 text-white" : "bg-gray-800/80 border border-gray-700/50 text-gray-100"}`}>
                      <MarkdownLite text={m.content} />
                      {m.codeExample && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-cyan-300">Code Example</span>
                            <button onClick={() => copyToClipboard(m.codeExample!, `code-${m.id}`)} className="inline-flex items-center gap-1 rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600">
                              {copied === `code-${m.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copy
                            </button>
                          </div>
                          <pre className="mt-2 overflow-x-auto rounded-lg bg-black/50 p-3 text-xs text-gray-300 border border-gray-700">{m.codeExample.slice(0, 2000)}</pre>
                        </div>
                      )}
                      {m.sources && m.sources.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {m.sources.map((s, i) => (
                            <span key={i} className="rounded-full bg-gray-900 px-2 py-0.5 text-[10px] text-gray-400 border border-gray-700">{s}</span>
                          ))}
                        </div>
                      )}
                      {m.relatedActions && m.relatedActions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {m.relatedActions.map((a) => (
                            <span key={a} className="rounded bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-300 border border-cyan-500/20">{a}</span>
                          ))}
                        </div>
                      )}
                      {m.role === "assistant" && (
                        <div className="mt-3 flex gap-2">
                          <button onClick={() => speakMessage(m.content)} className="inline-flex items-center gap-1 rounded-full bg-gray-700/50 px-2.5 py-1 text-xs text-gray-300 hover:bg-gray-700">
                            <Volume2 className="h-3 w-3" /> Speak
                          </button>
                        </div>
                      )}
                      {m.followUp && m.followUp.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <span className="text-xs text-gray-500">Follow-up:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {m.followUp.map((f, i) => (
                              <button key={i} onClick={() => sendMessage(f)} className="rounded-full border border-gray-700 bg-gray-800 px-2.5 py-1 text-xs text-gray-300 hover:border-cyan-500/30 hover:text-cyan-300 hover:bg-cyan-500/10 text-left">
                                {f}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {m.role === "user" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-700">
                        <span className="text-xs font-bold text-white">U</span>
                      </div>
                    )}
                  </div>
                ))}
                {isThinking && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                    <div className="rounded-2xl bg-gray-800/80 border border-gray-700/50 px-4 py-3">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400" style={{ animationDelay: "0ms" }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400" style={{ animationDelay: "150ms" }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-gray-800 p-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="Ask about Mark-LIII: plugins, actions, memory, wake word, setup..."
                      className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 pr-12 text-sm text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
                    />
                    <button onClick={handleSend} disabled={!input.trim() || isThinking} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 p-2 text-white hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50">
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {["How to create a plugin?", "List all actions", "Explain memory", "Wake word setup", "Generate weather plugin"].map((q) => (
                    <button key={q} onClick={() => sendMessage(q)} className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200 border border-gray-700">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "actions" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                {actions.map((action) => (
                  <div key={action.name} onClick={() => setSelectedAction(action)} className={`cursor-pointer rounded-xl border p-4 transition-all ${selectedAction?.name === action.name ? "border-cyan-500/50 bg-cyan-500/5 shadow-[0_0_15px_rgba(0,212,255,0.1)]" : "border-gray-800 bg-gray-900/50 hover:border-gray-700 hover:bg-gray-900"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-gray-800 px-2 py-1 text-xs font-mono text-cyan-300 border border-gray-700">{action.name}</span>
                          <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400">{action.category}</span>
                          <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400">{action.osSupport}</span>
                        </div>
                        <p className="mt-2 text-sm text-gray-300">{action.description}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {action.exampleUsage.slice(0, 3).map((ex, i) => (
                            <span key={i} className="rounded-full bg-gray-800/80 px-2 py-0.5 text-xs text-gray-400">"{ex}"</span>
                          ))}
                        </div>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${selectedAction?.name === action.name ? "rotate-180" : ""}`} />
                    </div>
                    {selectedAction?.name === action.name && (
                      <div className="mt-4 border-t border-gray-800 pt-4">
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Parameters</h4>
                        <div className="mt-2 space-y-2">
                          {Object.entries(action.parameters).map(([key, param]) => (
                            <div key={key} className="flex gap-2 text-xs">
                              <span className="font-mono text-cyan-300">{key}</span>
                              <span className="text-gray-500">{param.type}</span>
                              {param.required && <span className="rounded bg-red-500/20 px-1 text-red-300">required</span>}
                              <span className="text-gray-400">{param.description}</span>
                            </div>
                          ))}
                          {Object.keys(action.parameters).length === 0 && <span className="text-xs text-gray-500">No parameters — zero-arg tool</span>}
                        </div>
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
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-white flex items-center gap-2"><Layers className="h-4 w-4 text-violet-400" /> {mod.name}</h3>
                      <p className="mt-1 text-sm text-gray-400">{mod.purpose}</p>
                      <span className="mt-2 inline-block rounded bg-gray-800 px-2 py-0.5 text-xs font-mono text-gray-400">{mod.file}</span>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-gray-500 ${selectedCore?.file === mod.file ? "rotate-180" : ""}`} />
                  </div>
                  {selectedCore?.file === mod.file && (
                    <div className="mt-4 grid grid-cols-1 gap-4 border-t border-gray-800 pt-4 md:grid-cols-2">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-400 uppercase">Key Concepts</h4>
                        <ul className="mt-2 space-y-1">
                          {mod.keyConcepts.map((c, i) => (
                            <li key={i} className="flex gap-2 text-xs text-gray-300"><span className="text-violet-400">•</span> {c}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-gray-400 uppercase">API Surface</h4>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {mod.apiSurface.map((api) => (
                            <span key={api} className="rounded bg-gray-800 px-2 py-0.5 text-xs font-mono text-gray-300">{api}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === "capabilities" && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {capabilities.map((cap, i) => (
                <div key={i} className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 hover:border-gray-700">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{cap.icon}</span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{cap.title}</h3>
                      <p className="mt-1 text-sm text-gray-400">{cap.description}</p>
                      <p className="mt-2 text-xs text-cyan-300/80"><span className="text-gray-500">How:</span> {cap.howToUse.slice(0, 120)}...</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "setup" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
                <h3 className="flex items-center gap-2 font-semibold text-white"><Terminal className="h-4 w-4 text-cyan-400" /> Quick Start</h3>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-black/60 p-4 text-sm text-gray-300 border border-gray-800">
{`git clone https://github.com/FatihMakes/Mark-LIII.git
cd Mark-LIII
python setup.py        # OS-aware installer
python main.py`}
                </pre>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-gray-800/50 p-3"><span className="text-gray-500">OS:</span> <span className="text-white">Win 10/11, macOS, Linux</span></div>
                  <div className="rounded-lg bg-gray-800/50 p-3"><span className="text-gray-500">Python:</span> <span className="text-white">3.11 or 3.12</span></div>
                  <div className="rounded-lg bg-gray-800/50 p-3"><span className="text-gray-500">Model:</span> <span className="text-white">gemini-3.1-flash-live-preview</span></div>
                  <div className="rounded-lg bg-gray-800/50 p-3"><span className="text-gray-500">API Key:</span> <span className="text-white">Free Gemini (aistudio.google.com)</span></div>
                </div>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
                <h3 className="font-semibold text-white flex items-center gap-2"><FileCode className="h-4 w-4 text-violet-400" /> Project Structure</h3>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-black/60 p-4 text-xs text-gray-400 border border-gray-800 whitespace-pre-wrap">{structure || "Loading structure..."}</pre>
              </div>
            </div>
          )}

          {activeTab === "generator" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
                <h3 className="flex items-center gap-2 font-semibold text-white"><Sparkles className="h-4 w-4 text-cyan-400" /> Generate Mark-LIII Plugin</h3>
                <p className="mt-1 text-sm text-gray-400">Describe what your plugin should do — I'll generate a self-describing PLUGIN dict + run() ready to drop into plugins/</p>
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-400">Plugin Description (what should it do?)</label>
                    <textarea value={pluginDesc} onChange={(e) => setPluginDesc(e.target.value)} placeholder="e.g. A weather plugin that fetches live weather for a city, or a translator that translates text to any language" className="mt-1 w-full rounded-xl border border-gray-700 bg-black/50 px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-cyan-500/50 focus:outline-none" rows={3} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-400">Plugin Name (optional, snake_case)</label>
                    <input value={pluginName} onChange={(e) => setPluginName(e.target.value)} placeholder="e.g. weather_lookup, translator" className="mt-1 w-full rounded-xl border border-gray-700 bg-black/50 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-cyan-500/50 focus:outline-none" />
                  </div>
                  <button onClick={() => generate(pluginDesc, pluginName || undefined)} disabled={!pluginDesc.trim() || isGenerating} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50">
                    {isGenerating ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Code2 className="h-4 w-4" />} Generate Plugin
                  </button>
                </div>
              </div>

              {pluginResult && (
                <div className="rounded-xl border border-cyan-500/20 bg-[#010d14] p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-white flex items-center gap-2"><FileCode className="h-4 w-4 text-cyan-400" /> {pluginResult.fileName}</h3>
                    <div className="flex gap-2">
                      <button onClick={() => copyToClipboard(pluginResult.code, "plugin-code")} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700">
                        {copied === "plugin-code" ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />} Copy Code
                      </button>
                      <button onClick={() => { const blob = new Blob([pluginResult.code], { type: "text/x-python" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = pluginResult.fileName; a.click(); URL.revokeObjectURL(url); }} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/20 px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/20">
                        <Download className="h-3 w-3" /> Download .py
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg border border-gray-800 bg-black/60 p-4">
                    <pre className="overflow-x-auto text-xs text-gray-300 whitespace-pre-wrap">{pluginResult.code}</pre>
                  </div>
                  <div className="mt-4 rounded-lg bg-gray-900/50 p-4 border border-gray-800">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase">Explanation</h4>
                    <div className="mt-2 text-sm text-gray-300 whitespace-pre-wrap">{pluginResult.explanation}</div>
                    <h4 className="mt-4 text-xs font-semibold text-gray-400 uppercase">Install Steps</h4>
                    <ol className="mt-2 space-y-1 text-xs text-gray-400 list-decimal list-inside">
                      {pluginResult.instructions.map((inst, i) => <li key={i}>{inst}</li>)}
                    </ol>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-gray-800 bg-gray-900/30 p-4">
                <h4 className="text-sm font-semibold text-white">💡 Plugin Examples to Try</h4>
                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {[
                    "Weather plugin that fetches live weather for any city using wttr.in",
                    "Translator plugin that translates text to any language",
                    "Email sender via Gmail API",
                    "Smart light control for Tuya devices",
                    "Web search plugin using DuckDuckGo",
                    "Calendar event creator for Google Calendar",
                  ].map((ex) => (
                    <button key={ex} onClick={() => setPluginDesc(ex)} className="text-left rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2 text-xs text-gray-400 hover:border-cyan-500/20 hover:text-cyan-300">
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-800 bg-[#010d14] p-5">
            <h3 className="flex items-center gap-2 font-semibold text-white"><BookOpen className="h-4 w-4 text-cyan-400" /> Quick Knowledge</h3>
            <div className="mt-4 space-y-3 text-xs">
              <div className="rounded-lg bg-gray-900/50 p-3 border border-gray-800">
                <div className="flex items-center gap-2 text-cyan-300 font-medium"><Mic className="h-3 w-3" /> Wake Word</div>
                <p className="mt-1 text-gray-400">Local openwakeword, zero cloud while asleep, 120s auto-sleep, own thread.</p>
              </div>
              <div className="rounded-lg bg-gray-900/50 p-3 border border-gray-800">
                <div className="flex items-center gap-2 text-violet-300 font-medium"><Brain className="h-3 w-3" /> Recallable Memory</div>
                <p className="mt-1 text-gray-400">200k guard, 900 core + 420 index, local search &lt;1ms, no deletions.</p>
              </div>
              <div className="rounded-lg bg-gray-900/50 p-3 border border-gray-800">
                <div className="flex items-center gap-2 text-green-300 font-medium"><Puzzle className="h-3 w-3" /> Self-Describing Skills</div>
                <p className="mt-1 text-gray-400">TOOL/PLUGIN dict + run(), auto-discovered, one-file operation, no core edits.</p>
              </div>
              <div className="rounded-lg bg-gray-900/50 p-3 border border-gray-800">
                <div className="flex items-center gap-2 text-yellow-300 font-medium"><Shield className="h-3 w-3" /> Real Confirmation</div>
                <p className="mt-1 text-gray-400">Token issued by UI not model, banner on HUD, must press CONFIRM for shutdown/restart/WiFi.</p>
              </div>
              <div className="rounded-lg bg-gray-900/50 p-3 border border-gray-800">
                <div className="flex items-center gap-2 text-blue-300 font-medium"><Headphones className="h-3 w-3" /> Audio Picker</div>
                <p className="mt-1 text-gray-400">41→8 filtered, MME 2.02s real-time vs DirectSound 0.00s swallowed, by name not index.</p>
              </div>
              <div className="rounded-lg bg-gray-900/50 p-3 border border-gray-800">
                <div className="flex items-center gap-2 text-orange-300 font-medium"><Undo2 className="h-3 w-3" /> Undo</div>
                <p className="mt-1 text-gray-400">Move/rename/create/copy/write/delete/desktop + volume/brightness, &gt;1MB excluded.</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900/30 p-5">
            <h3 className="font-semibold text-white flex items-center gap-2"><Settings2 className="h-4 w-4" /> Expert Stats</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-black/40 p-3 border border-gray-800"><div className="text-gray-500">Actions</div><div className="text-lg font-bold text-white">{actions.length}</div></div>
              <div className="rounded-lg bg-black/40 p-3 border border-gray-800"><div className="text-gray-500">Core Modules</div><div className="text-lg font-bold text-white">{coreModules.length}</div></div>
              <div className="rounded-lg bg-black/40 p-3 border border-gray-800"><div className="text-gray-500">Capabilities</div><div className="text-lg font-bold text-white">{capabilities.length}</div></div>
              <div className="rounded-lg bg-black/40 p-3 border border-gray-800"><div className="text-gray-500">Model</div><div className="text-sm font-bold text-cyan-300">Gemini 3.1 Flash Live</div></div>
            </div>
            <div className="mt-4 rounded-lg bg-gradient-to-br from-cyan-500/10 to-blue-600/10 p-3 border border-cyan-500/20">
              <div className="text-xs text-cyan-200 font-medium">💡 Pro Tip</div>
              <p className="mt-1 text-xs text-gray-400">Ask Jarvis to generate plugins, explain actions, or troubleshoot. It knows every file in Mark-LIII and can scaffold new skills in seconds.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900/30 p-5">
            <h3 className="font-semibold text-white">Try These Prompts</h3>
            <div className="mt-3 space-y-2">
              {[
                "How to add a new action?",
                "Explain instant acknowledgment",
                "How does session continuity work?",
                "Show me plugin template",
                "Troubleshoot mic not working",
              ].map((p) => (
                <button key={p} onClick={() => { setActiveTab("chat"); setTimeout(() => sendMessage(p), 100); }} className="w-full text-left rounded-lg border border-gray-800 bg-black/30 px-3 py-2 text-xs text-gray-400 hover:border-cyan-500/20 hover:text-white">
                  <Search className="inline h-3 w-3 mr-1" /> {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
