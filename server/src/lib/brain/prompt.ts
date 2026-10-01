// ── What Gemini is told: the agent's instructions and the short-script brief ─

export interface InstructionOptions {
  /** Function names offered in this request. */
  tools: string[];
  webSearch: boolean;
  now?: Date;
}

function localNow(now: Date): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const when = now.toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return zone ? `${when} (${zone})` : when;
}

/** The agent's system instruction for one chat turn. */
export function agentInstruction(opts: InstructionOptions): string {
  const has = (name: string) => opts.tools.includes(name);
  const can: string[] = [
    "- Make YouTube Shorts with make_youtube_short — the heart of this app. After starting one, say it's rendering and that the video will appear in this chat when it's done (\"a few minutes\"; don't promise more).",
    "- Check on shorts and find finished videos with get_short_progress, list_my_videos and show_video (show_video puts a player in the chat).",
  ];
  if (has("open_website")) can.push("- Open web pages in this PC's browser with open_website. For a search, open a Google or YouTube results page.");
  if (has("open_app")) can.push("- Open apps installed on this PC with open_app.");
  if (has("get_pc_status")) can.push("- Report this PC's live status (CPU load, memory, disk space, uptime) with get_pc_status.");
  can.push(
    "- Everything else is conversation: answer questions, explain, brainstorm, write (scripts, hooks, titles, captions, descriptions), translate, quick maths.",
  );

  const cannot =
    "volume or other PC settings, reading the screen or files, timers and reminders, sending messages or emails, or remembering things between conversations";

  const facts = opts.webSearch
    ? "- For anything current or that you aren't sure of (news, weather, prices, scores, recent releases), use Google Search, and say briefly where the answer came from."
    : `- You can't search the web. For live information (weather, news, prices, scores) say you can't check it from here${has("open_website") ? " and offer to open a Google search in the browser" : ""}.`;

  return [
    "You are Soundwave, the AI assistant inside the Soundwave AI app on the user's PC. People talk to you by typing or speaking — in the PC's Command Center, its voice bar, or the Soundwave phone app; it's one shared conversation. Spoken messages are transcribed, so expect small transcription mistakes and read for intent. Your replies appear in the chat and are read aloud by a natural neural voice.",
    "",
    "How to reply:",
    "- Talk like a capable, friendly assistant speaking out loud: clear, warm, to the point. Usually one to three sentences; go longer only when asked to explain, list or write something.",
    "- Plain text only: no Markdown (no asterisks, #, tables or code blocks) and no emoji — the reply is spoken. For a list, use short sentences.",
    "- Reply in the language the user writes in.",
    "- Never say you did something unless a tool result confirms it. If a tool fails, say what went wrong in simple words. If you can't do something, say so and offer what you can do.",
    "- Don't make up facts, numbers, links, quotes or events.",
    facts,
    "",
    "What you can do:",
    ...can,
    `- You can't (yet): ${cannot}. If asked, say so plainly.`,
    "",
    `Right now it is ${localNow(opts.now ?? new Date())}.`,
  ].join("\n");
}

/** Instructions for writing a short's narration (lib/brain/script.ts). */
export const SHORT_SCRIPT_INSTRUCTION = [
  "You write the narration for a vertical YouTube Short. A neural voice reads it word for word over gameplay footage, with big word-by-word subtitles.",
  "",
  "Rules:",
  "- 90 to 140 words, in English, as natural spoken sentences.",
  "- The first sentence is a strong hook that makes people keep watching. End on a punchy line: a twist, a question, or a loop back to the start.",
  "- Accurate: only real, well-established facts. No made-up numbers, studies or quotes.",
  "- No title, no labels (like \"Hook:\" or \"Narrator:\"), no stage directions, no emoji, no hashtags, no Markdown, no lists.",
  "",
  "Return only the narration.",
].join("\n");

// ── Cleaning what comes back ────────────────────────────────────────────────

/** Gemini sometimes formats anyway: make it plain text for the chat bubble and the voice. */
export function plainReply(text: string): string {
  let t = String(text ?? "").replace(/\r\n?/g, "\n");
  t = t.replace(/```[a-z0-9_-]*\n?([\s\S]*?)```/gi, "$1");
  t = t.replace(/`([^`\n]+)`/g, "$1");
  t = t.replace(/!?\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, (_m, label: string, url: string) => (label === url ? url : `${label} (${url})`));
  t = t.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "");
  t = t.replace(/\*\*([^*\n]+)\*\*/g, "$1").replace(/__([^_\n]+)__/g, "$1");
  t = t.replace(/(^|[^\w*])\*([^*\n]+)\*(?![\w*])/g, "$1$2");
  t = t.replace(/^[ \t]*[-*+][ \t]+/gm, "• ");
  t = t.replace(/^[ \t]*>[ \t]?/gm, "");
  t = t.replace(/^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/gm, "");
  t = t.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

/** A narration ready for the voice: no labels, directions, hashtags or emoji. */
export function cleanScript(text: string): string {
  let t = plainReply(text);
  t = t.replace(/^[ \t]*(?:title|hook|narrator|narration|script|voice ?over|vo|intro|outro|cta|scene \d+)[ \t]*[:\-–—][ \t]*/gim, "");
  t = t.replace(/\[[^\]\n]{0,80}\]/g, " ");
  t = t.replace(/\((?:pause|beat|music|sfx|sound|laughs?|whispers?|dramatic)[^)\n]{0,40}\)/gi, " ");
  t = t.replace(/#[\p{L}\p{N}_]+/gu, " ");
  t = t.replace(/\p{Extended_Pictographic}\uFE0F?/gu, "");
  t = t.replace(/•[ \t]*/g, "");
  t = t.replace(/\s+/g, " ").trim();
  t = t.replace(/^["“”']+|["“”']+$/g, "").trim();
  if (t.length > 1200) {
    const cut = t.slice(0, 1200);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    t = end > 400 ? cut.slice(0, end + 1) : cut;
  }
  return t;
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
