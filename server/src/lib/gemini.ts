/**
 * Free-tier Google Gemini brain (server side).
 *
 * Set GEMINI_API_KEY (free key from https://aistudio.google.com/apikey)
 * and the agent's general-answer branch runs on Gemini models instead of
 * the canned responder. No key → zero behaviour change.
 */
import { config } from "../config.js";

export const GEMINI_DEFAULT_MODEL = "gemini-3.5-flash";

export function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || GEMINI_DEFAULT_MODEL;
}

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export interface GeminiTurn {
  role: "user" | "assistant";
  text: string;
}

export async function askGemini(
  message: string,
  history: GeminiTurn[] = [],
  opts: { system?: string; maxOutputTokens?: number; temperature?: number } = {}
): Promise<string> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  const model = geminiModel();
  const url = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(key)}`;

  const contents = [
    ...history.slice(-12).map((t) => ({
      role: t.role === "assistant" ? "model" : "user",
      parts: [{ text: t.text }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                opts.system ??
                "You are Soundwave, the AI behind the Soundwave Companion desktop app. Be warm, concise and practical (1-3 short paragraphs unless asked for detail).",
            },
          ],
        },
        contents,
        generationConfig: {
          temperature: opts.temperature ?? 0.9,
          maxOutputTokens: opts.maxOutputTokens ?? 1024,
          topP: 0.95,
        },
      }),
    });
    const data = (await res.json()) as any;
    if (!res.ok) {
      const msg = data?.error?.message || `Gemini request failed (${res.status})`;
      throw new Error(msg);
    }
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("").trim();
    if (!text) throw new Error("Gemini returned an empty response");
    return text;
  } finally {
    clearTimeout(timer);
  }
}
