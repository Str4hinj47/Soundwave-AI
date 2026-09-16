import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import {
  MARK_LIII_OVERVIEW,
  MARK_LIII_PROJECT_STRUCTURE,
  MARK_LIII_CAPABILITIES,
  MARK_LIII_ACTIONS,
  MARK_LIII_CORE_MODULES,
  MARK_LIII_PLUGIN_TEMPLATE,
  MARK_LIII_ACTION_TEMPLATE,
  MARK_LIII_SETUP_GUIDE,
  MARK_LIII_BEST_PRACTICES,
  MARK_LIII_QUICK_PROMPTS,
  answerMarkLiiiQuestion,
  generatePluginCode,
} from "../lib/markLiiiKnowledge.js";

const router = Router();

// Public — no auth needed for knowledge base (helps onboarding), but chat requires auth to prevent abuse
router.get("/overview", (_req, res) => {
  res.json({ overview: MARK_LIII_OVERVIEW });
});

router.get("/structure", (_req, res) => {
  res.json({ structure: MARK_LIII_PROJECT_STRUCTURE });
});

router.get("/capabilities", (_req, res) => {
  res.json({ capabilities: MARK_LIII_CAPABILITIES, count: MARK_LIII_CAPABILITIES.length });
});

router.get("/actions", (_req, res) => {
  res.json({ actions: MARK_LIII_ACTIONS, count: MARK_LIII_ACTIONS.length });
});

router.get("/actions/:name", (req, res) => {
  const action = MARK_LIII_ACTIONS.find((a) => a.name === req.params.name);
  if (!action) return res.status(404).json({ error: "Action not found", available: MARK_LIII_ACTIONS.map((a) => a.name) });
  res.json({ action });
});

router.get("/core", (_req, res) => {
  res.json({ modules: MARK_LIII_CORE_MODULES, count: MARK_LIII_CORE_MODULES.length });
});

router.get("/core/:file", (req, res) => {
  const mod = MARK_LIII_CORE_MODULES.find((m) => m.file.includes(req.params.file || "") || m.name.toLowerCase().includes((req.params.file || "").toLowerCase()));
  if (!mod) return res.status(404).json({ error: "Core module not found" });
  res.json({ module: mod });
});

router.get("/templates", (_req, res) => {
  res.json({
    pluginTemplate: MARK_LIII_PLUGIN_TEMPLATE,
    actionTemplate: MARK_LIII_ACTION_TEMPLATE,
  });
});

router.get("/setup", (_req, res) => {
  res.json({ setup: MARK_LIII_SETUP_GUIDE });
});

router.get("/best-practices", (_req, res) => {
  res.json({ practices: MARK_LIII_BEST_PRACTICES });
});

router.get("/prompts", (_req, res) => {
  res.json({ prompts: MARK_LIII_QUICK_PROMPTS });
});

router.get("/knowledge", (_req, res) => {
  res.json({
    overview: MARK_LIII_OVERVIEW,
    structure: MARK_LIII_PROJECT_STRUCTURE,
    capabilities: MARK_LIII_CAPABILITIES,
    actions: MARK_LIII_ACTIONS,
    coreModules: MARK_LIII_CORE_MODULES,
    setup: MARK_LIII_SETUP_GUIDE,
    bestPractices: MARK_LIII_BEST_PRACTICES,
    quickPrompts: MARK_LIII_QUICK_PROMPTS,
    templates: {
      plugin: MARK_LIII_PLUGIN_TEMPLATE,
      action: MARK_LIII_ACTION_TEMPLATE,
    },
  });
});

// Chat — expert Q&A
const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .optional()
    .default([]),
});

router.post("/chat", validate({ body: chatSchema }), async (req, res) => {
  const { message } = req.body as z.infer<typeof chatSchema>;

  try {
    // Local expert — no external LLM needed, instant response
    const result = answerMarkLiiiQuestion(message);

    // Simulate slight thinking time for realism (optional, but keep fast)
    res.json({
      answer: result.answer,
      sources: result.sources,
      relatedActions: result.relatedActions || [],
      codeExample: result.codeExample,
      followUp: result.followUp || [],
      meta: {
        model: "mark-liii-expert-v1",
        knowledgeCutoff: "2026-09-16",
        repo: MARK_LIII_OVERVIEW.repo,
        latency: "local",
      },
    });
  } catch (e) {
    res.status(500).json({ error: "Expert failed", detail: (e as Error).message });
  }
});

// Plugin generator
const generateSchema = z.object({
  description: z.string().min(5).max(500),
  name: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
    .optional(),
});

router.post("/generate-plugin", validate({ body: generateSchema }), async (req, res) => {
  const { description, name } = req.body as z.infer<typeof generateSchema>;
  try {
    const { code, explanation } = generatePluginCode(description, name);
    res.json({
      pluginName: name || description.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30),
      code,
      explanation,
      fileName: `${name || description.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30) || "my_plugin"}.py`,
      installPath: "plugins/",
      instructions: [
        "Save the file in Mark-LIII/plugins/ (no leading underscore)",
        "Install any extra pip dependencies mentioned in code comments",
        "Restart Mark-LIII — it auto-discovers plugins on launch",
        "Enable/disable via ⚙ → Plugin Manager",
        "Test by saying trigger phrase described in PLUGIN['description']",
      ],
    });
  } catch (e) {
    res.status(500).json({ error: "Generation failed", detail: (e as Error).message });
  }
});

// Action generator (similar to plugin but for bundled actions)
const actionGenerateSchema = z.object({
  description: z.string().min(5).max(500),
  name: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
    .optional(),
});

router.post("/generate-action", validate({ body: actionGenerateSchema }), async (req, res) => {
  const { description, name } = req.body as z.infer<typeof actionGenerateSchema>;
  try {
    const { code, explanation } = generatePluginCode(description, name);
    // Convert plugin template to action template shape
    const actionCode = code
      .replace("PLUGIN =", "def handler_placeholder(parameters: dict, player=None, speak=None, response=None, session_memory=None) -> str:\n    # Implement your logic here\n    return \"Done.\"\n\nTOOL = {")
      .replace('"name":', '"name":')
      .replace("def run(", "def handler_placeholder(")
      .replace("PLUGIN_SETTINGS", "# For bundled actions, no PLUGIN_SETTINGS — use TOOL only\n# TOOL_SETTINGS = ");

    res.json({
      actionName: name || "my_action",
      code: actionCode,
      explanation: explanation.replace("plugin", "action").replace("plugins/", "actions/"),
      fileName: `${name || "my_action"}.py`,
      installPath: "actions/",
    });
  } catch (e) {
    res.status(500).json({ error: "Generation failed", detail: (e as Error).message });
  }
});

export default router;
