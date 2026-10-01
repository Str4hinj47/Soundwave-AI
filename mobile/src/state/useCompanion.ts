// ── App state: paired PC, live connection, conversation, voice replies ──────
// …and chatting while the PC is off: with the brain kit the PC shared (its
// Gemini key + settings) and its memory snapshot, messages are answered on
// the phone (lib/offline.ts) and queued in an outbox that goes back to the PC
// as soon as it's reachable (the client flushes it before syncing).

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CompanionClient,
  CompanionError,
  pairWithPc,
  type ChatMessage,
  type ConnectionState,
  type Conversation,
  type JobSnapshot,
  type Outbox,
  type PairingRecord,
  type PcInfo,
} from "../lib/client";
import type { PairingLink } from "../lib/protocol";
import { deviceInfo, onForegroundChange } from "../lib/native";
import { DEFAULT_SETTINGS, storage, type AppSettings } from "../lib/storage";
import { playReply, speakable, stopSpeaking } from "../lib/voice";
import {
  effectiveMemory,
  offlineMorning,
  offlineReply,
  phoneMessageId,
  transcribeOffline,
  type MemoryOp,
  type MemorySnapshot,
  type PhoneKit,
} from "../lib/offline";

export type PairingPhase = { kind: "idle" } | { kind: "working"; pcName: string } | { kind: "failed"; message: string; code: string };

/** Can the phone chat on its own right now (and if not, why)? */
export type PhoneChat =
  | { ready: true; modelLabel: string }
  | { ready: false; reason: "sharing_off" | "no_key" | "old_pc" | "unknown" };

export interface Companion {
  /** undefined while loading from storage. */
  record: PairingRecord | null | undefined;
  state: ConnectionState;
  conversation: Conversation | null;
  jobs: JobSnapshot[];
  pc: PcInfo | null;
  settings: AppSettings;
  speaking: boolean;
  pairing: PairingPhase;
  client: CompanionClient | null;
  /** The PC can't be reached but the phone can answer by itself. */
  phoneMode: boolean;
  phoneChat: PhoneChat;
  memory: MemorySnapshot | null;
  /** Messages and memory changes waiting to go back to the PC. */
  pendingForPc: number;
  pair: (link: PairingLink) => Promise<boolean>;
  resetPairing: () => void;
  unpair: () => Promise<void>;
  send: (text: string, opts?: { viaVoice?: boolean }) => Promise<ChatMessage | null>;
  morning: () => Promise<ChatMessage | null>;
  transcribe: (wav: Uint8Array, signal?: AbortSignal) => Promise<{ text: string; noSpeech: boolean }>;
  speak: (m: ChatMessage) => Promise<void>;
  stopSpeaking: () => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  retry: () => void;
}

const EMPTY_OUTBOX: Outbox = { messages: [], memoryOps: [] };
const timeLabel = (at: number) => new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

export function useCompanion(): Companion {
  const [record, setRecord] = useState<PairingRecord | null | undefined>(undefined);
  const [state, setState] = useState<ConnectionState>({ kind: "connecting" });
  const [conversation, setConversationState] = useState<Conversation | null>(null);
  const [jobs, setJobs] = useState<JobSnapshot[]>([]);
  const [pc, setPc] = useState<PcInfo | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [speaking, setSpeaking] = useState(false);
  const [pairing, setPairing] = useState<PairingPhase>({ kind: "idle" });
  const [client, setClient] = useState<CompanionClient | null>(null);
  const [kit, setKitState] = useState<PhoneKit | null>(null);
  const [kitRefusal, setKitRefusal] = useState<"sharing_off" | "no_key" | null>(null);
  const [memory, setMemoryState] = useState<MemorySnapshot | null>(null);
  const [outbox, setOutboxState] = useState<Outbox>(EMPTY_OUTBOX);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const pcRef = useRef(pc);
  pcRef.current = pc;
  const conversationRef = useRef<Conversation | null>(null);
  const kitRef = useRef<PhoneKit | null>(null);
  const memoryRef = useRef<MemorySnapshot | null>(null);
  const outboxRef = useRef<Outbox>(EMPTY_OUTBOX);
  const stateRef = useRef(state);
  stateRef.current = state;
  /** Shorts asked for by voice: their "ready" message is read aloud too. */
  const voiceJobs = useRef(new Set<string>());
  const seenIds = useRef<Set<string> | null>(null);
  const speakRef = useRef<(m: ChatMessage) => Promise<void>>(async () => undefined);

  const setConversation = useCallback((c: Conversation | null) => {
    conversationRef.current = c;
    setConversationState(c);
  }, []);
  const setKit = useCallback((k: PhoneKit | null) => {
    kitRef.current = k;
    setKitState(k);
    void storage.saveKit(k);
  }, []);
  const setMemory = useCallback((m: MemorySnapshot | null) => {
    memoryRef.current = m;
    setMemoryState(m);
    void storage.saveMemory(m);
  }, []);
  const setOutbox = useCallback((o: Outbox) => {
    outboxRef.current = o;
    setOutboxState(o);
    void storage.saveOutbox(o);
  }, []);

  // Load what we remember.
  useEffect(() => {
    void (async () => {
      const [r, c, s, k, m, o] = await Promise.all([
        storage.loadPairing(),
        storage.loadConversation(),
        storage.loadSettings(),
        storage.loadKit(),
        storage.loadMemory(),
        storage.loadOutbox(),
      ]);
      setSettings(s);
      if (r && c) setConversation(c);
      if (r) {
        kitRef.current = k;
        setKitState(k);
        memoryRef.current = m;
        setMemoryState(m);
        outboxRef.current = o;
        setOutboxState(o);
      }
      // A soundwave:// link may have paired already while this loaded: keep that.
      setRecord((prev) => (prev === undefined ? r : prev));
    })();
  }, [setConversation]);

  /** Shows messages made on the phone and queues them (and memory changes) for the PC. */
  const addLocal = useCallback(
    (msgs: ChatMessage[], ops: MemoryOp[] = []) => {
      const conv = conversationRef.current ?? { epoch: "", rev: -1, messages: [] };
      const next = { ...conv, messages: [...conv.messages, ...msgs].slice(-100) };
      setConversation(next);
      void storage.saveConversation(next);
      setOutbox({ messages: [...outboxRef.current.messages, ...msgs], memoryOps: [...outboxRef.current.memoryOps, ...ops] });
    },
    [setConversation, setOutbox],
  );

  // One client per paired PC; it runs while the app is in front.
  useEffect(() => {
    if (!record) {
      setClient(null);
      return;
    }
    const c = new CompanionClient(record, { conversation: conversationRef.current, memoryRev: memoryRef.current?.rev ?? null, kitRev: kitRef.current?.rev ?? null });
    c.setOutbox(() => outboxRef.current);
    seenIds.current = conversationRef.current ? new Set(conversationRef.current.messages.map((m) => m.id)) : null;

    const refreshKit = async () => {
      try {
        const k = await c.fetchKit();
        if (k.enabled) {
          setKit(k);
          setKitRefusal(null);
        } else {
          setKit(null); // sharing turned off or no key on the PC: the phone forgets the key
          setKitRefusal(k.reason);
        }
      } catch (err) {
        if ((err as CompanionError).code === "UNKNOWN_OP") setKitRefusal(null); // an older Soundwave AI on the PC
      }
    };

    const offs = [
      c.on("state", (s) => {
        setState(s);
        if (s.kind === "forgotten") {
          // The PC removed this phone: don't keep its key or memory.
          setKit(null);
          setMemory(null);
          setOutbox(EMPTY_OUTBOX);
        }
      }),
      c.on("conversation", (conv) => {
        setConversation(conv);
        void storage.saveConversation(conv);
        // Read aloud the outcome of a short you asked for by voice.
        const seen = seenIds.current;
        if (seen) {
          for (const m of conv.messages) {
            if (seen.has(m.id)) continue;
            if (m.jobId && (m.jobState === "done" || m.jobState === "failed") && voiceJobs.current.has(m.jobId)) {
              voiceJobs.current.delete(m.jobId);
              if (settingsRef.current.speak !== "never") void speakRef.current(m);
            }
          }
        }
        seenIds.current = new Set(conv.messages.map((m) => m.id));
      }),
      c.on("jobs", setJobs),
      c.on("pc", (info) => {
        setPc(info);
        if (info.brain && info.brain.kitRev !== kitRef.current?.rev) void refreshKit();
        if (info.brain && !info.brain.phoneChat) setKitRefusal(info.brain.reason ?? null);
      }),
      c.on("kitRev", () => void refreshKit()),
      c.on("memory", (m) => setMemory(m)),
      c.on("flushed", (sent) => {
        const ids = new Set(sent.messages.map((m) => m.id));
        const rest = outboxRef.current;
        setOutbox({ messages: rest.messages.filter((m) => !ids.has(m.id)), memoryOps: rest.memoryOps.slice(sent.memoryOps.length) });
      }),
      c.on("record", (r) => void storage.savePairing(r)),
    ];
    setClient(c);
    setState(c.state);
    c.start();
    const offForeground = onForegroundChange((active) => {
      if (active) {
        c.start();
        c.retryNow();
      } else {
        c.stop();
        stopSpeaking();
      }
    });
    return () => {
      offs.forEach((off) => off());
      offForeground();
      c.stop();
    };
    // The client is rebuilt only when the pairing itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.deviceId]);

  const online = state.kind === "online";
  const phoneMode = !online && state.kind !== "forgotten" && Boolean(kit);

  const speak = useCallback(
    async (m: ChatMessage) => {
      const c = client;
      const text = speakable(m);
      if (!c || !text || stateRef.current.kind !== "online") return;
      try {
        setSpeaking(true);
        const voice = settingsRef.current.voice ?? pcRef.current?.voice ?? undefined;
        const { audio, mime } = await c.speak(text, voice);
        await playReply(audio, mime);
      } catch {
        /* the voice service is down: the reply is on screen anyway */
      } finally {
        setSpeaking(false);
      }
    },
    [client],
  );
  speakRef.current = speak;

  /** Said while the PC is off: Gemini answers here, the PC gets it all later. */
  const sendOffline = useCallback(
    async (text: string, viaVoice: boolean): Promise<ChatMessage> => {
      const k = kitRef.current!;
      const now = Date.now();
      const history = (conversationRef.current?.messages ?? []).map((m) => ({ sender: m.sender, text: m.text }));
      addLocal([{ id: phoneMessageId(now), sender: "user", text, time: timeLabel(now), at: now, via: "phone", ...(viaVoice ? { viaVoice: true } : {}) }]);
      const ops: MemoryOp[] = [];
      const reply = await offlineReply({
        kit: k,
        memory: effectiveMemory(memoryRef.current, outboxRef.current.memoryOps),
        history,
        message: text,
        record: (op) => ops.push(op),
      });
      const at = Math.max(Date.now(), now + 1);
      const msg: ChatMessage = { id: phoneMessageId(at), sender: "assistant", text: reply.text, time: timeLabel(at), at, tag: reply.failed ? "SYS" : "VOICE", answeredBy: "phone" };
      addLocal([msg], ops);
      return msg;
    },
    [addLocal],
  );

  const send = useCallback(
    async (text: string, opts: { viaVoice?: boolean } = {}) => {
      const c = client;
      if (!c) return null;
      stopSpeaking();
      if (stateRef.current.kind !== "online") {
        if (!kitRef.current) throw new CompanionError("OFFLINE", `Can't reach ${c.record.pcName} right now.`);
        return sendOffline(text, Boolean(opts.viaVoice));
      }
      const reply = await c.send(text, { viaVoice: opts.viaVoice, voice: settingsRef.current.voice ?? undefined });
      if (reply.jobId && reply.jobState === "started" && opts.viaVoice) voiceJobs.current.add(reply.jobId);
      const mode = settingsRef.current.speak;
      if (mode === "always" || (mode === "voice" && opts.viaVoice)) void speak(reply);
      return reply;
    },
    [client, speak, sendOffline],
  );

  const morning = useCallback(async () => {
    const c = client;
    if (!c) return null;
    stopSpeaking();
    if (stateRef.current.kind === "online") {
      const reply = await c.morning();
      if (settingsRef.current.speak === "always") void speak(reply);
      return reply;
    }
    const k = kitRef.current;
    if (!k) throw new CompanionError("OFFLINE", `Can't reach ${c.record.pcName} right now.`);
    const now = Date.now();
    addLocal([{ id: phoneMessageId(now), sender: "user", text: "🌅 Morning Setup", time: timeLabel(now), at: now, via: "phone" }]);
    const r = await offlineMorning({ kit: k, memory: effectiveMemory(memoryRef.current, outboxRef.current.memoryOps) });
    const at = Math.max(Date.now(), now + 1);
    const msg: ChatMessage = {
      id: phoneMessageId(at),
      sender: "assistant",
      text: r.text,
      time: timeLabel(at),
      at,
      tag: "SYS",
      answeredBy: "phone",
      actionOutput: `Your PC is off, so nothing was opened there.${r.weatherNote ? `\nWeather: ${r.weatherNote}` : ""}`,
    };
    addLocal([msg]);
    return msg;
  }, [client, speak, addLocal]);

  const transcribe = useCallback(
    async (wav: Uint8Array, signal?: AbortSignal) => {
      const c = client;
      if (c && stateRef.current.kind === "online") return c.transcribe(wav, signal);
      const k = kitRef.current;
      if (!k) throw new Error("Voice input needs your PC (or chatting without the PC turned on).");
      return transcribeOffline({ kit: k, wav, signal });
    },
    [client],
  );

  const pair = useCallback(
    async (link: PairingLink) => {
      setPairing({ kind: "working", pcName: link.pcName });
      try {
        const r = await pairWithPc(link, await deviceInfo());
        await storage.clearAll();
        await storage.savePairing(r);
        setConversation(null);
        setJobs([]);
        setPc(null);
        kitRef.current = null;
        setKitState(null);
        setKitRefusal(null);
        memoryRef.current = null;
        setMemoryState(null);
        outboxRef.current = EMPTY_OUTBOX;
        setOutboxState(EMPTY_OUTBOX);
        setRecord(r);
        setPairing({ kind: "idle" });
        return true;
      } catch (err) {
        const e = err instanceof CompanionError ? err : new CompanionError("FAILED", (err as Error).message || "Pairing failed.");
        setPairing({ kind: "failed", message: e.message, code: e.code });
        return false;
      }
    },
    [setConversation],
  );

  const unpair = useCallback(async () => {
    stopSpeaking();
    await client?.unpair();
    await storage.clearAll();
    setConversation(null);
    setJobs([]);
    setPc(null);
    kitRef.current = null;
    setKitState(null);
    memoryRef.current = null;
    setMemoryState(null);
    outboxRef.current = EMPTY_OUTBOX;
    setOutboxState(EMPTY_OUTBOX);
    setRecord(null);
  }, [client, setConversation]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void storage.saveSettings(next);
      if (next.speak === "never") stopSpeaking();
      return next;
    });
  }, []);

  const phoneChat: PhoneChat = kit
    ? { ready: true, modelLabel: kit.modelLabel }
    : { ready: false, reason: kitRefusal ?? (pc && !pc.brain ? "old_pc" : "unknown") };

  return {
    record,
    state,
    conversation,
    jobs,
    pc,
    settings,
    speaking,
    pairing,
    client,
    phoneMode,
    phoneChat,
    memory,
    pendingForPc: outbox.messages.length + outbox.memoryOps.length,
    pair,
    resetPairing: () => setPairing({ kind: "idle" }),
    unpair,
    send,
    morning,
    transcribe,
    speak,
    stopSpeaking: () => {
      stopSpeaking();
      setSpeaking(false);
    },
    updateSettings,
    retry: () => client?.retryNow(),
  };
}
