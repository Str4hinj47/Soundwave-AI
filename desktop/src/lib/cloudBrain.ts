import type { Card, ChatMsg } from "./types";

export interface CloudReply {
  text: string;
  tag?: string;
  cards?: Card[];
  openUrl?: string;
}

/**
 * The bigger "Soundwave brain" — the local API server (`/api/v1/agent/chat`).
 * It handles creator tools: viral scripts, 1-click shorts, neural voice,
 * workstation commands, weather, multi-step Ghost Operator macros …
 */
export async function cloudBrain(
  message: string,
  history: Array<Pick<ChatMsg, "sender" | "text">>
): Promise<CloudReply> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch("/api/v1/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      signal: ctrl.signal,
      body: JSON.stringify({
        message,
        history: history.slice(-12).map((m) => ({ sender: m.sender === "echo" ? "assistant" : m.sender, text: m.text })),
      }),
    });
    if (!res.ok) throw new Error(`chat failed: ${res.status}`);
    const data = (await res.json()) as {
      success?: boolean;
      reply?: string;
      action?: string;
      tag?: string;
      videoUrl?: string;
      downloadUrl?: string;
      script?: string;
    };
    const cards: Card[] = [];
    if (data.videoUrl || data.downloadUrl) {
      cards.push({
        kind: "video",
        title: "Your rendered short",
        videoUrl: data.videoUrl,
        downloadUrl: data.downloadUrl,
      });
    } else if (data.script) {
      cards.push({ kind: "script", topic: "Viral script", body: data.script });
    }
    return {
      text: data.reply || "The brain came back empty — try again?",
      tag: data.tag || "cloud",
      cards: cards.length ? cards : undefined,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Ping the API server — drives the "brain" status pill in Settings. */
export async function pingBrain(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3500);
    const res = await fetch("/api/v1/agent/status", { signal: ctrl.signal, credentials: "include" });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

/** Ask the server for a neural voice sample (24 kHz MP3, base64). */
export async function neuralSpeak(text: string, voice: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch("/api/v1/agent/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      signal: ctrl.signal,
      body: JSON.stringify({ text: text.slice(0, 900), voice }),
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = (await res.json()) as { success?: boolean; audioBase64?: string; mimeType?: string };
    if (!data.success || !data.audioBase64) return null;
    const mime = data.mimeType || "audio/mpeg";
    const bin = atob(data.audioBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  } catch {
    return null;
  }
}
