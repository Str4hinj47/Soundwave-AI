// ── The agent's brain: one chat turn with Gemini ────────────────────────────
// Recent conversation + the new message go to Gemini with the agent's tools.
// When Gemini calls tools we run them and send the results back (keeping the
// model's parts exactly as received — Gemini 3 validates its thought
// signatures), until it answers in words. The answer becomes a ChatReply,
// the same shape the Command Center, the voice bar and the phone already use.

import { config } from "../../config.js";
import type { ChatReply } from "../chatMessages.js";
import {
  GeminiError,
  generateContent,
  isGemini3,
  visibleText,
  type GeminiContent,
  type GeminiFunctionDeclaration,
  type GeminiPart,
  type GeminiTool,
  type GenerateRequest,
  type GenerateResponse,
  type GroundingMetadata,
} from "./gemini.js";
import { FALLBACK_MODEL, brainHealth, markSearchUnavailable, noteBrainError, noteBrainOk, type ActiveBrain, type ThinkingLevel } from "./settings.js";
import { toolsFor, type AgentTool, type ToolContext, type ToolEffects } from "./tools.js";
import { agentInstruction, plainReply } from "./prompt.js";

export interface BrainChatInput {
  message: string;
  history?: Array<{ sender: "user" | "assistant" | "system"; text: string }>;
  voice?: string;
  resolution?: "720p" | "1080p";
  userId?: string;
  signal?: AbortSignal;
  /** Sent from the phone app (Gemini is told; its tools still act on the PC). */
  via?: "phone";
}

export interface BrainDeps {
  generate: typeof generateContent;
  now: () => Date;
  tools?: AgentTool[];
}

const defaultDeps: BrainDeps = { generate: generateContent, now: () => new Date() };

/** Tool round trips per message (a short + a follow-up question is two). */
const MAX_STEPS = 6;
/** Messages of earlier conversation sent along. */
export const HISTORY_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 4000;
/** The whole turn, tools included — the phone app waits up to 45 s for the answer. */
export const TURN_BUDGET_MS = 42_000;
const CALL_TIMEOUT_MS = 30_000;
/** No new Gemini call (or retry) with less time than this left in the turn. */
const MIN_CALL_MS = 5_000;
const RETRY_DELAY_MS = 700;

// ── Conversation → Gemini contents ──────────────────────────────────────────

export function contentsFor(history: BrainChatInput["history"], message: string): GeminiContent[] {
  const contents: GeminiContent[] = [];
  const add = (role: GeminiContent["role"], text: string) => {
    const last = contents.at(-1);
    if (last && last.role === role) last.parts[0]!.text = `${last.parts[0]!.text}\n\n${text}`;
    else contents.push({ role, parts: [{ text }] });
  };
  for (const h of (history ?? []).slice(-HISTORY_MESSAGES)) {
    const text = String(h?.text ?? "").trim().slice(0, MAX_MESSAGE_CHARS);
    if (!text || h.sender === "system") continue;
    add(h.sender === "user" ? "user" : "model", text);
  }
  // Gemini wants the user first; the greeting before the first question isn't needed.
  while (contents[0]?.role === "model") contents.shift();
  // An earlier message that never got an answer stays separate from the new one
  // (merging "make a short about cats" into a new question could re-run it).
  if (contents.at(-1)?.role === "user") contents.push({ role: "model", parts: [{ text: "(no reply)" }] });
  contents.push({ role: "user", parts: [{ text: message.trim().slice(0, MAX_MESSAGE_CHARS) }] });
  return contents;
}

export function buildRequest(
  contents: GeminiContent[],
  opts: { model: string; thinking: ThinkingLevel; declarations: GeminiFunctionDeclaration[]; search: boolean; instruction: string },
): GenerateRequest {
  const tools: GeminiTool[] = [];
  if (opts.search) tools.push({ googleSearch: {} });
  if (opts.declarations.length) tools.push({ functionDeclarations: opts.declarations });
  return {
    contents,
    systemInstruction: { role: "user", parts: [{ text: opts.instruction }] },
    ...(tools.length ? { tools } : {}),
    // Google Search next to our own functions needs tool context circulation.
    ...(opts.search && opts.declarations.length ? { toolConfig: { includeServerSideToolInvocations: true } } : {}),
    generationConfig: {
      maxOutputTokens: 8192,
      ...(isGemini3(opts.model) ? { thinkingConfig: { thinkingLevel: opts.thinking.toUpperCase() as "LOW" | "MEDIUM" | "HIGH" } } : {}),
    },
  };
}

/** Did Google refuse the request because of web search (e.g. not on the free tier)? */
export function searchRefused(err: GeminiError): boolean {
  return ["bad_request", "permission", "quota", "region"].includes(err.kind) && /search|grounding/i.test(err.detail);
}

function sourcesLine(grounding: GroundingMetadata | undefined): string {
  const names: string[] = [];
  for (const chunk of grounding?.groundingChunks ?? []) {
    const title = chunk.web?.title?.trim();
    if (title && !names.includes(title)) names.push(title);
    if (names.length === 3) break;
  }
  return names.length ? `\n\nSources: ${names.join(", ")}` : "";
}

const BLOCKED = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION", "IMAGE_SAFETY", "BLOCKED"]);

/** Words for the reply when Gemini didn't give any (it acted, or it was blocked). */
function fallbackText(effects: ToolEffects, finish: string): string {
  if (effects.short?.alreadyRunning) return `I'm still rendering the short about “${effects.short.topic}”. I'll post it here as soon as it's done.`;
  if (effects.short) return `On it — I'm making a short about “${effects.short.topic}”. It'll show up here when it's rendered.`;
  if (effects.video) return `Here's your short about “${effects.video.topic}”.`;
  if (effects.log.length) return `Done: ${effects.log.join("; ")}.`;
  if (BLOCKED.has(finish)) return "Sorry, I can't help with that one.";
  return "Sorry — Gemini didn't give me an answer that time. Try asking again.";
}

/** One call, retried once when Google is busy or the connection hiccuped — if the retry still fits in the turn. */
async function generateWithRetry(deps: BrainDeps, args: Parameters<typeof generateContent>[0], deadline: number): Promise<GenerateResponse> {
  try {
    return await deps.generate(args);
  } catch (err) {
    if (err instanceof GeminiError && (err.kind === "overloaded" || err.kind === "network")) {
      const left = deadline - Date.now() - RETRY_DELAY_MS;
      if (left < MIN_CALL_MS) throw err;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return deps.generate({ ...args, timeoutMs: Math.min(args.timeoutMs ?? CALL_TIMEOUT_MS, left) });
    }
    throw err;
  }
}

// ── One turn ────────────────────────────────────────────────────────────────

export async function brainChat(input: BrainChatInput, brain: ActiveBrain, deps: BrainDeps = defaultDeps): Promise<ChatReply> {
  const ctx: ToolContext = {
    userId: input.userId || "local-user",
    voice: input.voice || "en-US-GuyNeural",
    resolution: input.resolution || "720p",
    desktop: config.desktopApp,
    platform: process.platform,
    effects: { log: [] },
  };
  const tools = deps.tools ?? toolsFor(ctx);
  const declarations = tools.map((t) => t.declaration);
  const initial = contentsFor(input.history, input.message);
  const started = Date.now();
  const deadline = started + TURN_BUDGET_MS;
  const fromPhone = input.via === "phone";

  let contents: GeminiContent[] = structuredClone(initial);
  let model = brain.model;
  let search = brain.webSearch && !brainHealth().searchUnavailable && isGemini3(model);
  let switched = false;
  let acted = false;
  let malformedRetries = 0;
  let finalText = "";
  let interimText = "";
  let grounding: GroundingMetadata | undefined;
  let finish = "";
  let answered = false;

  for (let step = 0; step < MAX_STEPS; step++) {
    const remaining = deadline - Date.now();
    if (remaining < MIN_CALL_MS) break;
    const request = buildRequest(contents, {
      model,
      thinking: brain.thinking,
      declarations,
      search,
      instruction: agentInstruction({ tools: declarations.map((d) => d.name), webSearch: search, now: deps.now(), fromPhone }),
    });

    let resp: GenerateResponse;
    try {
      resp = await generateWithRetry(
        deps,
        { apiKey: brain.apiKey, model, request, signal: input.signal, timeoutMs: Math.min(CALL_TIMEOUT_MS, remaining) },
        deadline,
      );
    } catch (err) {
      if (!(err instanceof GeminiError)) throw err;
      if (search && searchRefused(err)) {
        console.warn(`[brain] Google Search isn't available for this key — answering without it (${err.detail.split("\n")[0]})`);
        markSearchUnavailable();
        search = false;
        step--;
        continue;
      }
      // Over the limit / overloaded: the lighter model has its own quota. Start
      // the turn over with it — unless something already happened (a short
      // started, an app opened): that must never run twice.
      if (!switched && !acted && model !== FALLBACK_MODEL && ["quota", "overloaded", "timeout"].includes(err.kind)) {
        console.warn(`[brain] ${model}: ${err.kind} — trying ${FALLBACK_MODEL}`);
        model = FALLBACK_MODEL;
        switched = true;
        search = search && isGemini3(model);
        contents = structuredClone(initial);
        interimText = "";
        step = -1;
        continue;
      }
      if (switched) err.models = [brain.model, model];
      noteBrainError(err, model);
      if (acted) break; // the action happened — answer from what the tools said
      throw err;
    }

    const candidate = resp.candidates?.[0];
    if (!candidate) {
      finish = resp.promptFeedback?.blockReason ? "BLOCKED" : "EMPTY";
      answered = true;
      break;
    }
    finish = candidate.finishReason ?? "";
    const parts = candidate.content?.parts ?? [];
    const calls = parts.filter((p) => p.functionCall && typeof p.functionCall.name === "string");

    if (calls.length === 0) {
      if ((finish === "MALFORMED_FUNCTION_CALL" || finish === "UNEXPECTED_TOOL_CALL") && malformedRetries < 1) {
        malformedRetries++;
        step--;
        continue;
      }
      finalText = visibleText(parts);
      grounding = candidate.groundingMetadata;
      answered = true;
      break;
    }

    const said = visibleText(parts);
    if (said) interimText = said;
    contents.push({ role: "model", parts }); // exactly as received

    const responses: GeminiPart[] = [];
    for (const part of calls) {
      const call = part.functionCall!;
      const tool = tools.find((t) => t.declaration.name === call.name);
      let result: Record<string, unknown>;
      if (!tool) {
        result = { ok: false, error: `There is no tool called ${call.name}.` };
      } else {
        try {
          result = await tool.run(call.args && typeof call.args === "object" ? call.args : {}, ctx);
        } catch (err) {
          result = { ok: false, error: (err as Error).message || "it failed" };
        }
        if (tool.sideEffect) acted = true;
      }
      responses.push({ functionResponse: { ...(call.id ? { id: call.id } : {}), name: call.name, response: result } });
    }
    contents.push({ role: "user", parts: responses });
  }

  if (answered) noteBrainOk(model, Date.now() - started);

  let text = plainReply(finalText || interimText);
  if (!text) text = fallbackText(ctx.effects, finish);
  text += sourcesLine(grounding);

  const reply: ChatReply = {
    success: true,
    reply: text,
    tag: ctx.effects.tag ?? "VOICE",
    brain: { provider: "gemini", model, ...(switched ? { fallbackFrom: brain.model } : {}) },
  };
  const { short, video, log } = ctx.effects;
  if (short) {
    Object.assign(reply, {
      action: "soundwave_shorts",
      status: "PROCESSING",
      jobId: short.jobId,
      topic: short.topic,
      pollUrl: `/api/v1/export/jobs/${short.jobId}`,
      eventsUrl: `/api/v1/export/jobs/${short.jobId}/events`,
    });
  }
  if (video) {
    Object.assign(reply, { action: "soundwave_shorts", videoUrl: video.url, downloadUrl: video.url, ...(short ? {} : { topic: video.topic }) });
  }
  if (log.length) reply.actionOutput = log.join("\n");
  return reply;
}
