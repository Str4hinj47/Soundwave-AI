// ── Short scripts written by Gemini ─────────────────────────────────────────
// When a Gemini key is set, every short (Generate button or chat) gets a
// narration written for its topic. Without a key — or if Gemini fails — the
// short still renders with the built-in template script (agentShort.ts).

import { GeminiError, generateContent, isGemini3, visibleText, type GenerateRequest } from "./gemini.js";
import { activeBrain, FALLBACK_MODEL, noteBrainError } from "./settings.js";
import { SHORT_SCRIPT_INSTRUCTION, cleanScript, wordCount } from "./prompt.js";

export function scriptRequest(topic: string, brief: string | undefined, model: string): GenerateRequest {
  const ask = [`Topic: ${topic.trim()}`];
  if (brief?.trim()) ask.push(`What the viewer asked for: ${brief.trim()}`);
  return {
    contents: [{ role: "user", parts: [{ text: ask.join("\n") }] }],
    systemInstruction: { role: "user", parts: [{ text: SHORT_SCRIPT_INSTRUCTION }] },
    generationConfig: {
      maxOutputTokens: 4096,
      ...(isGemini3(model) ? { thinkingConfig: { thinkingLevel: "LOW" as const } } : {}),
    },
  };
}

/** A narration for the short, or null (no key, or nothing usable came back). */
export async function writeShortScript(
  topic: string,
  brief?: string,
  opts: { signal?: AbortSignal } = {},
): Promise<{ script: string; model: string } | null> {
  const brain = activeBrain();
  if (!brain) return null;
  const models = [...new Set([brain.model, FALLBACK_MODEL])];
  for (const model of models) {
    try {
      const resp = await generateContent({
        apiKey: brain.apiKey,
        model,
        request: scriptRequest(topic, brief, model),
        signal: opts.signal,
        timeoutMs: 40_000,
      });
      const script = cleanScript(visibleText(resp.candidates?.[0]?.content?.parts));
      return wordCount(script) >= 25 ? { script, model } : null;
    } catch (err) {
      const retryable = err instanceof GeminiError && (err.kind === "quota" || err.kind === "overloaded" || err.kind === "timeout");
      if (retryable && model !== models.at(-1)) continue;
      noteBrainError(err, model);
      throw err;
    }
  }
  return null;
}
