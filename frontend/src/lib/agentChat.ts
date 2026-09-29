// ── The agent conversation, shared by every window ──────────────────────────
// The Command Center and the desktop voice bar (/overlay) talk to the same
// /api/v1/agent/chat and keep ONE conversation in localStorage: the voice bar
// appends its turns there, and an open Command Center picks them up through
// the browser's `storage` event.

/** Where a rendered short's background came from (server: ShortBackgroundInfo). */
export interface ShortBackground {
  source: "orbital_ncg";
  channelName: string;
  channelUrl: string;
  videoId: string;
  url: string;
  title: string;
  section: { start: number; end: number } | null;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant" | "system";
  text: string;
  actionOutput?: string;
  time: string;
  tag?: "SYS" | "RPA" | "VOICE" | "USER" | "AUDIO";
  videoUrl?: string;
  downloadUrl?: string;
  youtubeUrl?: string;
  /** Orbital NCG video the short's background was imported from. */
  background?: ShortBackground;
  /** Short job this message is about. */
  jobId?: string;
  /** "started" = the agent began rendering; "done"/"failed" = its outcome was posted. */
  jobState?: "started" | "done" | "failed";
  /** Topic of the short (for job messages). */
  topic?: string;
  /** The person said this (voice input) rather than typed it. */
  viaVoice?: boolean;
}

export const CHAT_STORAGE_KEY = "soundwave_agent_chat_history";
export const CHAT_HISTORY_LIMIT = 60;

export function chatTime(date = new Date()): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

/** Unique across windows (two windows can post in the same millisecond). */
export function newMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function parseChatHistory(raw: string | null): ChatMessage[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as ChatMessage[]) : null;
  } catch {
    return null;
  }
}

export function loadChatHistory(): ChatMessage[] | null {
  try {
    return parseChatHistory(localStorage.getItem(CHAT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveChatHistory(messages: ChatMessage[]): void {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-CHAT_HISTORY_LIMIT)));
  } catch {
    /* storage full / unavailable */
  }
}

/** Append to the stored conversation (used by windows that don't render it). */
export function appendToChatHistory(...messages: ChatMessage[]): void {
  saveChatHistory([...(loadChatHistory() ?? []), ...messages]);
}

/** The last few turns, as the chat endpoint wants them. */
export function historyForRequest(messages: ChatMessage[]): Array<{ sender: ChatMessage["sender"]; text: string }> {
  return messages.slice(-6).map((m) => ({ sender: m.sender, text: m.text }));
}

export interface ChatReply {
  success?: boolean;
  reply?: string;
  action?: string;
  status?: string;
  jobId?: string;
  topic?: string;
  actionOutput?: string;
  videoUrl?: string;
  downloadUrl?: string;
  tag?: ChatMessage["tag"];
  error?: string | { message?: string };
}

export async function sendChat(
  body: {
    message: string;
    history: Array<{ sender: ChatMessage["sender"]; text: string }>;
    voice: string;
    resolution?: "720p" | "1080p";
  },
  signal?: AbortSignal,
): Promise<ChatReply> {
  const res = await fetch("/api/v1/agent/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: body.message, prompt: body.message, history: body.history, voice: body.voice, resolution: body.resolution }),
    signal,
  });
  if (!res.ok) throw new Error(`The agent couldn't answer (HTTP ${res.status}).`);
  return (await res.json()) as ChatReply;
}

/** True when the reply means "I started rendering a short" (a background job to follow). */
export function startedShortJob(data: ChatReply): data is ChatReply & { jobId: string } {
  return data.action === "soundwave_shorts" && data.status === "PROCESSING" && typeof data.jobId === "string";
}

/** The assistant message for a /chat reply. */
export function replyToMessage(data: ChatReply, query: string): ChatMessage {
  const videoLink = data.videoUrl || data.downloadUrl;
  const started = startedShortJob(data);
  return {
    id: newMessageId(),
    sender: "assistant",
    text: data.reply || "Command executed.",
    actionOutput: data.actionOutput,
    videoUrl: videoLink,
    downloadUrl: videoLink,
    time: chatTime(),
    tag: data.tag || (data.action === "ghost_macro" ? "RPA" : "VOICE"),
    ...(started ? { jobId: data.jobId, jobState: "started" as const, topic: data.topic || query } : {}),
  };
}

// ── Short jobs in the conversation ──────────────────────────────────────────

/** GET /api/v1/export/jobs/:id → job (the fields the chat needs). */
export interface ShortJob {
  id: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  progress?: number;
  outputUrl?: string | null;
  errorMessage?: string | null;
  settings?: { topic?: string; step?: string; youtubeUrl?: string; background?: ShortBackground; script?: string } | null;
}

function formatClock(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function describeSection(section: { start: number; end: number } | null | undefined): string {
  return section ? `${formatClock(section.start)}–${formatClock(section.end)}` : "full video";
}

/** The "your short is ready" message (with player + download) for a finished job. */
export function completionMessage(
  jobId: string,
  topic: string,
  result: { videoUrl: string; youtubeUrl?: string | null; background?: ShortBackground | null },
): ChatMessage {
  const { videoUrl, youtubeUrl, background } = result;
  const backgroundLine = background
    ? `\nBackground: "${background.title}" (${describeSection(background.section)}) — Orbital NCG video imported via the YouTube link importer: ${background.url}`
    : "";
  return {
    id: newMessageId(),
    sender: "assistant",
    text:
      (youtubeUrl
        ? `Rendered viral short for "${topic}" and automatically published it to YouTube Shorts: ${youtubeUrl}`
        : `Rendered viral short for "${topic}". Your video is ready to preview, download, or post to YouTube!`) + backgroundLine,
    time: chatTime(),
    tag: "AUDIO",
    videoUrl,
    downloadUrl: videoUrl,
    youtubeUrl: youtubeUrl || undefined,
    background: background || undefined,
    jobId,
    jobState: "done",
    topic,
  };
}

export function failureMessage(jobId: string, topic: string, error: string): ChatMessage {
  return {
    id: newMessageId(),
    sender: "assistant",
    text: `I couldn't finish the short about "${topic}": ${error}`,
    time: chatTime(),
    tag: "SYS",
    jobId,
    jobState: "failed",
    topic,
  };
}

/** Jobs the agent announced ("started") whose outcome isn't in the conversation yet. */
export function openJobs(messages: ChatMessage[]): Array<{ jobId: string; topic: string }> {
  const closed = new Set(messages.filter((m) => m.jobId && (m.jobState === "done" || m.jobState === "failed")).map((m) => m.jobId));
  const open = new Map<string, string>();
  for (const m of messages) {
    if (m.jobId && m.jobState === "started" && !closed.has(m.jobId)) open.set(m.jobId, m.topic || "your short");
  }
  return [...open].map(([jobId, topic]) => ({ jobId, topic }));
}
