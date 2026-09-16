import { useState, useCallback } from "react";
import { jarvisApi, type ChatResponse, type GeneratePluginResponse } from "../lib/jarvisApi";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  sources?: string[];
  relatedActions?: string[];
  codeExample?: string;
  followUp?: string[];
  meta?: ChatResponse["meta"];
}

export function useJarvisExpert() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `**JARVIS MARK LIII Expert Online.** ⚙️

I'm an expert at using the Mark-LIII repo by FatihMakes — the ultimate cross-platform personal AI assistant.

**I know:**
- All 20+ bundled actions (web_search, file_controller, open_app, computer_settings, screen_processor, etc.)
- Self-describing skills architecture (TOOL dict + handler, PLUGIN dict + run)
- Core modules: action_loader, plugin_loader, memory_manager, wake_word, audio_devices, undo, confirm, prompt.txt
- Memory system: 200k guard, 900 char core + 420 index, recall_memory tool, local <1ms search
- Wake word: local openwakeword, zero cloud while asleep, 120s auto-sleep
- Audio picker: 41→8 filtered devices, MME vs DirectSound measurement
- Confirmation gate: token issued by UI not model
- Live theming, reactive HUD, session continuity, instant acknowledgment

**Ask me anything:**
- "How to create a plugin?"
- "List all actions"
- "Explain memory system"
- "How does wake word work?"
- "Generate a weather plugin"

What would you like to know about Mark-LIII?`,
      timestamp: Date.now(),
      followUp: [
        "How do I install Mark LIII?",
        "How to create a plugin?",
        "List all actions",
        "Explain memory system",
        "How does wake word work?",
      ],
    },
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: content.trim(),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsThinking(true);
      setError(null);

      try {
        const history = [...messages, userMsg].slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const res = await jarvisApi.chat(content.trim(), history as any);

        const assistantMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: res.answer,
          timestamp: Date.now(),
          sources: res.sources,
          relatedActions: res.relatedActions,
          codeExample: res.codeExample,
          followUp: res.followUp,
          meta: res.meta,
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (e) {
        setError((e as Error).message);
        const errMsg: ChatMessage = {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: `**Expert encountered an error:** ${(e as Error).message}\n\nTry rephrasing your question, or check the Knowledge tabs for direct documentation.`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setIsThinking(false);
      }
    },
    [messages],
  );

  const clearChat = useCallback(() => {
    setMessages((prev) => prev.slice(0, 1));
  }, []);

  return {
    messages,
    isThinking,
    error,
    sendMessage,
    clearChat,
    setMessages,
  };
}

export function usePluginGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GeneratePluginResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (description: string, name?: string) => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await jarvisApi.generatePlugin(description, name);
      setResult(res);
      return res;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { isGenerating, result, error, generate, setResult };
}
