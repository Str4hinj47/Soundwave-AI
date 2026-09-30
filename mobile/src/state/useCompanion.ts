// ── App state: paired PC, live connection, conversation, voice replies ──────

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CompanionClient,
  CompanionError,
  pairWithPc,
  type ChatMessage,
  type ConnectionState,
  type Conversation,
  type JobSnapshot,
  type PairingRecord,
  type PcInfo,
} from "../lib/client";
import type { PairingLink } from "../lib/protocol";
import { deviceInfo, onForegroundChange } from "../lib/native";
import { DEFAULT_SETTINGS, storage, type AppSettings } from "../lib/storage";
import { playReply, speakable, stopSpeaking } from "../lib/voice";

export type PairingPhase = { kind: "idle" } | { kind: "working"; pcName: string } | { kind: "failed"; message: string; code: string };

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
  pair: (link: PairingLink) => Promise<boolean>;
  resetPairing: () => void;
  unpair: () => Promise<void>;
  send: (text: string, opts?: { viaVoice?: boolean }) => Promise<ChatMessage | null>;
  speak: (m: ChatMessage) => Promise<void>;
  stopSpeaking: () => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  retry: () => void;
}

export function useCompanion(): Companion {
  const [record, setRecord] = useState<PairingRecord | null | undefined>(undefined);
  const [state, setState] = useState<ConnectionState>({ kind: "connecting" });
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [jobs, setJobs] = useState<JobSnapshot[]>([]);
  const [pc, setPc] = useState<PcInfo | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [speaking, setSpeaking] = useState(false);
  const [pairing, setPairing] = useState<PairingPhase>({ kind: "idle" });
  const [client, setClient] = useState<CompanionClient | null>(null);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const pcRef = useRef(pc);
  pcRef.current = pc;
  /** Shorts asked for by voice: their "ready" message is read aloud too. */
  const voiceJobs = useRef(new Set<string>());
  const seenIds = useRef<Set<string> | null>(null);
  const speakRef = useRef<(m: ChatMessage) => Promise<void>>(async () => undefined);

  // Load what we remember.
  useEffect(() => {
    void (async () => {
      const [r, c, s] = await Promise.all([storage.loadPairing(), storage.loadConversation(), storage.loadSettings()]);
      setSettings(s);
      if (r && c) setConversation(c);
      setRecord(r);
    })();
  }, []);

  // One client per paired PC; it runs while the app is in front.
  useEffect(() => {
    if (!record) {
      setClient(null);
      return;
    }
    const c = new CompanionClient(record, { conversation });
    seenIds.current = conversation ? new Set(conversation.messages.map((m) => m.id)) : null;
    const offs = [
      c.on("state", setState),
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
      c.on("pc", setPc),
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

  const speak = useCallback(
    async (m: ChatMessage) => {
      const c = client;
      const text = speakable(m);
      if (!c || !text) return;
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

  const send = useCallback(
    async (text: string, opts: { viaVoice?: boolean } = {}) => {
      const c = client;
      if (!c) return null;
      stopSpeaking();
      const reply = await c.send(text, { viaVoice: opts.viaVoice, voice: settingsRef.current.voice ?? undefined });
      if (reply.jobId && reply.jobState === "started" && opts.viaVoice) voiceJobs.current.add(reply.jobId);
      const mode = settingsRef.current.speak;
      if (mode === "always" || (mode === "voice" && opts.viaVoice)) void speak(reply);
      return reply;
    },
    [client, speak],
  );

  const pair = useCallback(async (link: PairingLink) => {
    setPairing({ kind: "working", pcName: link.pcName });
    try {
      const r = await pairWithPc(link, await deviceInfo());
      await storage.clearAll();
      await storage.savePairing(r);
      setConversation(null);
      setJobs([]);
      setPc(null);
      setRecord(r);
      setPairing({ kind: "idle" });
      return true;
    } catch (err) {
      const e = err instanceof CompanionError ? err : new CompanionError("FAILED", (err as Error).message || "Pairing failed.");
      setPairing({ kind: "failed", message: e.message, code: e.code });
      return false;
    }
  }, []);

  const unpair = useCallback(async () => {
    stopSpeaking();
    await client?.unpair();
    await storage.clearAll();
    setConversation(null);
    setJobs([]);
    setPc(null);
    setRecord(null);
  }, [client]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void storage.saveSettings(next);
      if (next.speak === "never") stopSpeaking();
      return next;
    });
  }, []);

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
    pair,
    resetPairing: () => setPairing({ kind: "idle" }),
    unpair,
    send,
    speak,
    stopSpeaking: () => {
      stopSpeaking();
      setSpeaking(false);
    },
    updateSettings,
    retry: () => client?.retryNow(),
  };
}
