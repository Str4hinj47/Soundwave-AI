import { useState } from "react";
import { Bot, X, Send } from "lucide-react";
import { useJarvisExpert } from "../hooks/useJarvisExpert";

export function JarvisWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, isThinking, sendMessage } = useJarvisExpert();

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput("");
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 shadow-[0_0_20px_rgba(0,212,255,0.5)] hover:from-cyan-400 hover:to-blue-500 transition-all hover:scale-105"
        aria-label="Open JARVIS Expert"
      >
        <Bot className="h-7 w-7 text-white" />
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white border-2 border-black">LIII</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[500px] w-[380px] flex-col rounded-2xl border border-cyan-500/20 bg-[#010d14] shadow-[0_0_30px_rgba(0,0,0,0.8)]">
      <div className="flex items-center justify-between border-b border-gray-800 p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">JARVIS LIII</div>
            <div className="text-[10px] text-cyan-300">Mark-LIII Expert</div>
          </div>
          <span className="ml-2 h-2 w-2 animate-pulse rounded-full bg-green-400" />
        </div>
        <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-800 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.slice(-8).map((m) => (
          <div key={m.id} className={`rounded-xl px-3 py-2 text-xs ${m.role === "user" ? "bg-blue-600 text-white ml-8" : "bg-gray-800 text-gray-200 mr-4 border border-gray-700"}`}>
            <div className="line-clamp-6">{m.content.slice(0, 300)}</div>
          </div>
        ))}
        {isThinking && (
          <div className="rounded-xl bg-gray-800 border border-gray-700 px-3 py-2 text-xs text-gray-400 mr-4">
            <span className="animate-pulse">Thinking...</span>
          </div>
        )}
      </div>

      <div className="border-t border-gray-800 p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
            placeholder="Ask about Mark-LIII..."
            className="flex-1 rounded-full border border-gray-700 bg-black/50 px-4 py-2 text-xs text-white placeholder-gray-600 focus:border-cyan-500/30 focus:outline-none"
          />
          <button onClick={handleSend} className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 p-2.5 text-white hover:from-cyan-400 hover:to-blue-500">
            <Send className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 flex gap-1">
          {["Plugins?", "Memory?", "Wake word?"].map((q) => (
            <button key={q} onClick={() => sendMessage(q)} className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700">
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
