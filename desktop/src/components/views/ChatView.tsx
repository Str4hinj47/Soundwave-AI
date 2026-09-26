import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Send, Sparkles, Trash2, Zap } from "lucide-react";
import { useStore, useUI } from "../../store";
import type { ChatMsg, Personality } from "../../lib/types";
import { localBrain, smallTalk, PERSONALITIES, type Actions, type BrainCtx } from "../../lib/brain";
import { cloudBrain } from "../../lib/cloudBrain";
import { geminiBrain, GeminiError, geminiErrorMessage } from "../../lib/gemini";
import { speakText, startListening, speechSupported, stopSpeaking } from "../../lib/voice";
import { BuddyFace } from "../BuddyFace";
import { ChatCard, RichText } from "./ChatCards";

const CHIPS = [
  "Plan my day",
  "Create a task to learn how to use Echo, due today",
  "Start focus for 25",
  "What can you do?",
];

function buildCtx(): BrainCtx {
  const s = useStore.getState();
  return {
    settings: s.settings,
    tasks: s.tasks,
    notes: s.notes,
    habits: s.habits,
    events: s.events,
    focusLog: s.focusLog,
  };
}

function buildActions(): Actions {
  const s = useStore.getState();
  return {
    addTask: s.addTask,
    toggleTask: s.toggleTask,
    removeTask: s.removeTask,
    addNote: s.addNote,
    addHabit: s.addHabit,
    toggleHabitDay: s.toggleHabitDay,
    addEvent: s.addEvent,
    logFocus: s.logFocus,
    patchSettings: s.patchSettings,
    openTab: (tab) => useUI.getState().setTab(tab),
  };
}

function MessageBubble({ m, openUrl }: { m: ChatMsg; openUrl: (url: string) => void }) {
  const isEcho = m.sender === "echo";
  if (!isEcho) {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="max-w-[85%] rounded-[18px] rounded-br-[6px] bg-[var(--bubble-user)] text-[var(--bubble-user-ink)] px-3.5 py-2.5 text-[13.5px] font-medium leading-relaxed shadow-pill">
          <RichText text={m.text} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5 animate-fade-in">
      <BuddyFace size={28} mood={m.pending ? "thinking" : "idle"} className="shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="rounded-[18px] rounded-tl-[6px] bg-card ring-1 ring-line px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink shadow-card">
          {m.pending ? (
            <span className="inline-flex items-center gap-1.5 text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce [animation-delay:300ms]" />
            </span>
          ) : (
            <RichText text={m.text} />
          )}
        </div>
        {m.cards?.map((c, i) => <ChatCard key={i} card={c} openUrl={openUrl} />)}
        {m.tag && !m.pending && (
          <div className="mt-1 text-[9.5px] font-bold uppercase tracking-wider text-faint">
            {m.tag === "local"
              ? "local brain"
              : m.tag === "gemini"
              ? "gemini · free"
              : m.tag === "voice"
              ? "voice"
              : "soundwave cloud"}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatView({ openUrl }: { openUrl: (url: string) => void }) {
  const messages = useStore((s) => s.messages);
  const settings = useStore((s) => s.settings);
  const setMood = useUI((s) => s.setMood);
  const pendingSend = useUI((s) => s.pendingSend);
  const consumePendingSend = useUI((s) => s.consumePendingSend);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [micNote, setMicNote] = useState<string | null>(null);
  const stopMicRef = useRef<(() => void) | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, messages[messages.length - 1]?.text]);

  useEffect(() => () => stopSpeaking(), []);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setMicNote(null);
      setInput("");

      const store = useStore.getState();
      const userMsg = store.pushMessage({ sender: "user", text });
      setMood("thinking");
      const pendingId = store.pushMessage({ sender: "echo", text: "", pending: true }).id;

      const local = localBrain(text, buildCtx(), buildActions());
      let replyText = "";
      let cards: ChatMsg["cards"];
      let tag = "local";

      const brainNow = () => useStore.getState().settings.brain;
      const historyFor = () => useStore.getState().messages.filter((m) => !m.pending && m.id !== userMsg.id);

      type Reply = { text: string; cards?: ChatMsg["cards"]; tag: string };

      const runGemini = async (): Promise<Reply> => {
        try {
          const g = await geminiBrain(text, historyFor(), buildCtx(), useStore.getState().settings);
          return { text: g, tag: "gemini" };
        } catch (e) {
          const err = e instanceof GeminiError ? e : new GeminiError("network", (e as Error).message || "unknown error");
          if (err.kind === "no-key") return { text: geminiErrorMessage(err), tag: "local" };
          const fb = smallTalk(text, buildCtx());
          return {
            text: `*(Gemini: ${err.message} — staying on my local brain for now)*\n\n${fb.text}`,
            tag: "local",
          };
        }
      };

      const runCloud = async (): Promise<Reply> => {
        try {
          const cloud = await cloudBrain(text, historyFor());
          return { text: cloud.text, cards: cloud.cards, tag: cloud.tag || "cloud" };
        } catch {
          const fb = smallTalk(text, buildCtx());
          return {
            text: `*(Soundwave Cloud is unreachable — staying local)*\n\n${fb.text}`,
            tag: "local",
          };
        }
      };

      try {
        if (local.handled && !local.needsCloud) {
          replyText = local.text;
          cards = local.cards;
          tag = local.tag || "local";
        } else if (local.needsCloud) {
          if (brainNow() === "gemini") {
            const r = await runGemini();
            replyText = r.text;
            cards = r.cards;
            tag = r.tag;
          } else if (brainNow() === "cloud") {
            const r = await runCloud();
            replyText = r.text;
            cards = r.cards;
            tag = r.tag;
          } else {
            replyText = local.text;
            tag = "local";
          }
        } else if (brainNow() === "gemini") {
          const r = await runGemini();
          replyText = r.text;
          cards = r.cards;
          tag = r.tag;
        } else if (brainNow() === "cloud") {
          const r = await runCloud();
          replyText = r.text;
          cards = r.cards;
          tag = r.tag;
        } else {
          const talk = smallTalk(text, buildCtx());
          replyText = talk.text;
          cards = talk.cards;
          tag = "local";
        }
      } catch {
        replyText = "Something glitched on my side — mind trying that again?";
        tag = "local";
      }

      useStore.getState().updateMessage(pendingId, {
        text: replyText,
        cards,
        tag,
        pending: false,
      });

      if (local.openUrl) openUrl(local.openUrl);

      // spoken reply
      const s = useStore.getState();
      if (s.settings.voiceReplies && replyText) {
        setMood("talking");
        setBusy(false);
        busyRef.current = false;
        await speakText(replyText, { neuralVoice: s.settings.neuralVoice, preferNeural: s.settings.brain === "cloud" });
        setMood("idle");
      } else {
        setMood("happy");
        setTimeout(() => {
          if (useUI.getState().mood === "happy") setMood("idle");
        }, 1400);
        setBusy(false);
        busyRef.current = false;
      }
    },
    [openUrl, setMood]
  );

  // one-shot messages pushed from other tabs ("Plan my day" etc.)
  useEffect(() => {
    if (pendingSend) {
      const text = pendingSend;
      consumePendingSend();
      void send(text);
    }
  }, [pendingSend, consumePendingSend, send]);

  const toggleMic = () => {
    if (listening) {
      stopMicRef.current?.();
      stopMicRef.current = null;
      return;
    }
    setMicNote(null);
    setMood("listening");
    setListening(true);
    stopMicRef.current = startListening({
      onPartial: (t) => setInput(t),
      onFinal: (t) => {
        setInput("");
        void send(t);
      },
      onError: (msg) => setMicNote(msg),
      onEnd: () => {
        setListening(false);
        stopMicRef.current = null;
        if (useUI.getState().mood === "listening") setMood("idle");
      },
    });
  };

  const grow = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 110)}px`;
  };

  const persona: Personality = settings.personality;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* chat header */}
      <div className="shrink-0 px-4 pt-3 pb-2 flex items-center gap-2 border-b border-line bg-sunken">
        <div className="min-w-0">
          <div className="text-[14.5px] font-extrabold tracking-tight leading-tight">
            {PERSONALITIES[persona].label}
          </div>
          <div className="text-[10.5px] text-muted">
            {settings.brain === "cloud" ? "Soundwave cloud brain" : "on-device · private"}
          </div>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => {
            if (confirm("Clear the conversation?")) useStore.getState().clearMessages();
          }}
          className="rounded-full p-2 text-muted hover:text-ink hover:bg-card transition"
          title="Clear conversation"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3.5 space-y-4">
        {messages.length === 0 && (
          <div className="text-center pt-8 text-muted text-[13px]">
            <BuddyFace size={84} mood="happy" className="mx-auto bob" />
            <p className="mt-3 font-semibold text-ink">Say hi to Echo</p>
            <p className="mt-1 text-[12.5px]">Type anything — or try a chip below.</p>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} m={m} openUrl={openUrl} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* quick chips */}
      <div className="shrink-0 px-3 pb-1 flex gap-1.5 overflow-x-auto">
        {CHIPS.map((c) => (
          <button
            key={c}
            onClick={() => void send(c)}
            disabled={busy}
            className="shrink-0 rounded-full bg-card ring-1 ring-line px-3 py-1.5 text-[11.5px] font-semibold text-muted hover:text-accent hover:ring-accent/40 transition disabled:opacity-50"
          >
            {c.length > 30 ? `${c.slice(0, 28)}…` : c}
          </button>
        ))}
      </div>

      {/* composer */}
      <div className="shrink-0 px-3 pb-3 pt-1">
        {micNote && <div className="mb-1.5 text-[11px] text-red-500 font-medium">{micNote}</div>}
        <div className="flex items-end gap-2 rounded-[22px] bg-card ring-1 ring-line px-2 py-1.5 focus-within:ring-accent/50 transition">
          <button
            onClick={toggleMic}
            disabled={!speechSupported() && !listening}
            className={`rounded-full p-2 transition ${
              listening ? "bg-accent text-accent-ink animate-pulse" : "text-muted hover:text-ink hover:bg-sunken"
            } disabled:opacity-40`}
            title={speechSupported() ? (listening ? "Stop listening" : "Talk to Echo") : "Voice input unavailable in this browser"}
          >
            {listening ? <MicOff className="h-4.5 w-4.5" style={{ height: 18, width: 18 }} /> : <Mic className="h-[18px] w-[18px]" />}
          </button>
          <textarea
            ref={taRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              grow();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            placeholder={listening ? "Listening…" : "Ask Echo anything…"}
            className="flex-1 resize-none bg-transparent text-[13.5px] leading-snug py-1.5 outline-none placeholder:text-faint max-h-[110px]"
          />
          <button
            onClick={() => void send(input)}
            disabled={!input.trim() || busy}
            className="rounded-full p-2 bg-accent text-accent-ink disabled:opacity-35 hover:brightness-105 active:scale-90 transition"
            title="Send (Enter)"
          >
            <Send className="h-[18px] w-[18px]" />
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[9.5px] text-faint font-semibold uppercase tracking-wider">
          <Zap className="h-3 w-3" />
          {settings.brain === "cloud" ? "bigger brain · soundwave cloud" : "free · runs on your computer"}
          {settings.voiceReplies && (
            <>
              <span className="mx-1 opacity-40">·</span>
              <Sparkles className="h-3 w-3" /> voice on
            </>
          )}
        </div>
      </div>
    </div>
  );
}
