/**
 * Free Google Gemini brain (desktop side).
 *
 * Paste a free AI Studio key in Settings → the companion talks to
 * free-tier Gemini models directly from this machine. The key is stored
 * only in this browser's localStorage (settings.geminiKey).
 */
import type { ChatMsg, Settings } from "./types";
import type { BrainCtx } from "./brain";
import { PERSONALITIES } from "./brain";

export const GEMINI_MODELS: Array<{ id: string; label: string }> = [
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash · newest" },
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite · light" },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash · classic" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite" },
];

export const GEMINI_KEY_URL = "https://aistudio.google.com/apikey";

export class GeminiError extends Error {
  kind: "no-key" | "auth" | "quota" | "network" | "empty";
  constructor(kind: GeminiError["kind"], message: string) {
    super(message);
    this.kind = kind;
  }
}

function dayContext(ctx: BrainCtx): string {
  const now = new Date();
  const open = ctx.tasks.filter((t) => !t.done).slice(0, 8);
  const today = now.toISOString().slice(0, 10);
  const events = ctx.events.filter((e) => e.date === today);
  const lines = [
    `Right now: ${now.toLocaleString([], { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}.`,
  ];
  if (ctx.settings.userName) lines.push(`The user goes by ${ctx.settings.userName}.`);
  if (open.length) {
    lines.push("Open tasks: " + open.map((t) => `“${t.title}”${t.due ? ` (due ${t.due})` : ""}`).join("; ") + ".");
  } else lines.push("They have no open tasks right now.");
  if (events.length) lines.push("Today's calendar: " + events.map((e) => `${e.time} ${e.title}`).join("; ") + ".");
  if (ctx.habits.length) {
    lines.push(
      "Habits: " +
        ctx.habits
          .slice(0, 6)
          .map((h) => `${h.title} (${h.days.length} check-ins)`)
          .join("; ") +
        "."
    );
  }
  return lines.join("\n");
}

function systemPrompt(ctx: BrainCtx, settings: Settings): string {
  const persona = PERSONALITIES[settings.personality].label;
  return [
    `You are Echo — “your computer's little buddy” inside the Soundwave Companion desktop app${persona !== "Echo" ? `, currently speaking in the "${persona}" personality style` : ""}.`,
    "Be warm, playful and concise: 1-3 short paragraphs (or a tidy list) unless the user asks for depth. Use light emoji sparingly.",
    "You help with questions, writing, ideas, planning and creator work (viral scripts, hooks, YouTube strategy, voiceover copy).",
    "Tasks, notes, habits and calendars live on-device: when the user wants to record something, suggest exact commands like “add a task … due today”, “note …”, “add habit …”, “start focus 25”, or “plan my day”.",
    "You cannot run those commands yourself — the on-device intent engine handles them before your turn.",
    "",
    "Context about their day:",
    dayContext(ctx),
  ].join("\n");
}

/** One-shot chat turn against the free Gemini API. Throws GeminiError. */
export async function geminiBrain(
  message: string,
  history: Array<Pick<ChatMsg, "sender" | "text">>,
  ctx: BrainCtx,
  settings: Settings
): Promise<string> {
  const key = settings.geminiKey.trim();
  if (!key) {
    throw new GeminiError("no-key", "NO_KEY");
  }
  const model = settings.geminiModel || "gemini-3.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(key)}`;

  const contents = [
    ...history
      .slice(-12)
      .filter((m) => m.text.trim())
      .map((m) => ({
        role: m.sender === "echo" ? "model" : "user",
        parts: [{ text: m.text }],
      })),
    { role: "user", parts: [{ text: message }] },
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt(ctx, settings) }] },
        contents,
        generationConfig: { temperature: 0.9, maxOutputTokens: 1024, topP: 0.95 },
      }),
    });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      /* non-JSON error body */
    }
    if (!res.ok) {
      const msg = String(data?.error?.message || "");
      if (res.status === 400 || res.status === 403) throw new GeminiError("auth", msg || "Gemini rejected the API key");
      if (res.status === 429) throw new GeminiError("quota", "Gemini free-tier rate limit hit — give it a minute.");
      throw new GeminiError("network", msg || `Gemini request failed (${res.status})`);
    }
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
      .join("")
      .trim();
    if (!text) throw new GeminiError("empty", "Gemini returned an empty response");
    return text;
  } catch (e) {
    if (e instanceof GeminiError) throw e;
    if ((e as any)?.name === "AbortError") throw new GeminiError("network", "Gemini timed out");
    throw new GeminiError("network", "Couldn't reach Gemini — check your connection.");
  } finally {
    clearTimeout(timer);
  }
}

/** Human-readable message for a GeminiError (or null when it should be silent). */
export function geminiErrorMessage(e: GeminiError): string {
  switch (e.kind) {
    case "no-key":
      return "I need a free Gemini key first — grab one at aistudio.google.com/apikey and paste it in Settings → Brain. (Everything else stays on-device.)";
    case "auth":
      return `Gemini didn't accept that key: ${e.message || "invalid API key"}. Double-check it in Settings → Brain.`;
    case "quota":
      return `${e.message} The free tier resets quickly.`;
    default:
      return e.message;
  }
}
