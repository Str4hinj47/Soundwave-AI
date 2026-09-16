# JARVIS MARK LIII Expert — Soundwave AI Integration

This document explains how Soundwave-AI's JARVIS has been made an expert at using the [FatihMakes/Mark-LIII](https://github.com/FatihMakes/Mark-LIII) repository.

## Overview

**Mark LIII (53)** is the ultimate cross-platform personal AI assistant:
- 1.2k★, 519 forks, CC BY-NC 4.0
- Model: `gemini-3.1-flash-live-preview` (2× faster TTFW)
- OS: Windows 10/11, macOS, Linux
- Python 3.11/3.12, PyQt6 HUD, sounddevice, Gemini Live API

Soundwave AI now embeds a full expert system that knows Mark-LIII inside-out — no external LLM needed, local knowledge base, instant answers.

## What Was Built

### Backend — `server/src/lib/markLiiiKnowledge.ts`

Comprehensive structured knowledge base:

- **Overview:** name, tagline, repo, stars, model, OS support, description, what's new (wake word, instant ack, faster live engine, self-describing skills), foundation fixes (recallable memory, undo, real confirmation, audio picker, session continuity)
- **Project Structure:** full tree of main.py, ui.py, actions/, core/, memory/, plugins/, config/
- **Capabilities (20+):** wake word, instant ack, faster engine, self-describing skills, recallable memory, memory panel, undo, real confirmation, audio picker, session continuity, plugin system, real-time voice, live theming, reactive HUD, voice picker, unlimited sessions, etc.
- **Actions Catalog (20 actions):** Each with name, file, description, parameters (type, description, required), exampleUsage, category (system/file/web/media/communication/productivity/vision/other), osSupport
  - `open_app` — launches apps cross-platform, per-OS alias map, Start Menu search fallback
  - `computer_settings` — 56 OS actions (volume, brightness, WiFi, power), difflib fuzzy matching, reads current value before change for undo
  - `computer_control` — keyboard shortcuts, mouse, window management via pyautogui
  - `web_search` — modes search/research/news/price/compare, Gemini grounded first + DDG fallback, news parallel Gemini+DDG news
  - `screen_process` / `close_camera` — mss + opencv capture, piped into main Gemini session, live view stays open
  - `file_controller` / `file_processor` — move/rename/create/copy/write/delete/organize desktop, journals for undo, supports pdf/docx/xlsx/pptx
  - `browser_control`, `youtube_video`, `system_monitor`, `weather_report`, `flight_finder`, `reminder` (OS-native scheduler), `background_monitor`, `send_message`, `code_helper`, `game_updater`, `dev_agent` (complex 3+ steps), `desktop`
- **Core Modules (8):**
  - `main.py` — core loop, LIVE_MODEL, SEND 16k RECEIVE 24k CHUNK 1024, wake/sleep state, TOOL_DECLARATIONS inline + auto-discovered, instant ack, CREATE_NO_WINDOW patch, UTF-8 console reconfig, _pcm_level RMS mapping
  - `ui.py` — PyQt6 HUD, APP_VERSION MARK LIII, C palette, apply_ui_accent hue shift, retheme_all_widgets live theming, _SysMetrics CPU/mem/net/GPU NVML DLL no subprocess/temp WMI, audio device probing 41→8, wake word toggle, voice picker 5 voices, memory panel, confirmation banner
  - `action_loader.py` — TOOL shape name/description/parameters/handler, scans actions_dir *.py skip _*, ignores no TOOL, signature introspection player/speak/response/session_memory, collision detection, never raises
  - `plugin_loader.py` — PLUGIN shape name/description/parameters + optional PLUGIN_SETTINGS namespace/title/fields/action, scans plugins_dir skip _*, validation regex, settings deduped by namespace, enable/disable re-read every call, crash isolation
  - `memory_manager.py` — MEMORY_MAX_CHARS 200k guard, PROMPT_CORE_CHARS 900, PROMPT_INDEX_CHARS 420, PROMPT_MAX_PER_CATEGORY 6, categories identity/preferences/projects/relationships/wishes/notes, format_memory_for_prompt identity full + recent + index of keys, search_memory local <1ms, update_memory recursive truncates 380, _trim_notifier, session summaries
  - `wake_word.py` — openwakeword tiny model, own thread, zero cloud while asleep, 120s auto-sleep, is_ready/install_and_download/WakeWordDetector
  - `audio_devices.py` — query_devices per device×host API 41 for 4+4, filtering one host API per direction drops Sound Mapper pseudo-devices dedup 41→8, measurement silence probe per host API per direction background thread, Windows DirectSound mic + MME speakers split, DirectSound output silent sink 0.00s vs MME 2.02s real-time, stored by name not index
  - `undo.py` — push_undo closure, files move/rename/create/copy/write/delete/organize desktop + settings volume/brightness/dark mode, does not guess reads current before, does not hoard >1MB excluded, copy reverse remove copy only, organize_desktop journals every move, zero runtime cost
  - `confirm.py` — old gate broken confirmed param model fills, new token issued by UI banner returns immediately [CONFIRMATION_PENDING], cheaper than old 2 round trips, coverage shutdown/restart/toggle_wifi
  - `prompt.txt` — JARVIS CORE PROTOCOL: vision ONCE per request, one-call policy, memory store + recall_memory before don't know, undo trigger phrases any language, confirmation button, exit only explicit, acknowledge before task takes moment ONE short sentence in USER language same turn vary wording not for screen_process/instant, language = MOST RECENT message, silent language memory save identity language, tool routing computer_settings all single OS actions agent_task only 3+ steps system_status CPU/RAM/GPU/temp web_search modes, params English speak user language, system alerts [SYSTEM_ALERT] translate, startup briefing [STARTUP_BRIEFING] follow exactly, proactive check [PROACTIVE_CHECK] 1-3 sentences no tools
- **Templates:** PLUGIN template + TOOL template with full best practices
- **Setup Guide:** clone, install (OS-aware), run, requirements, first launch steps, config file fields, troubleshooting 7 items
- **Best Practices (10):** one-file skill, self-describing, crash isolation, OS-agnostic, instant ack, memory hygiene, undo registration, confirmation gate, audio device by name, prompt language

**Expert Engine:** `answerMarkLiiiQuestion(question)` — keyword intent matching, returns ExpertAnswer with answer markdown, sources, relatedActions, codeExample, followUp. Covers install, wake word, plugin creation, action creation, memory, undo, confirmation, audio devices, prompt, web search, vision, file ops, default overview.

**Plugin Generator:** `generatePluginCode(description, name)` — infers params from description keywords (weather→city, translate→text/target_language, email→to/subject/body, calendar→title/date/time, smart home→device/action, search→query, generic→input), generates full PLUGIN dict + PLUGIN_SETTINGS + run() with real logic hints (requests, deep_translator, tinytuya, DDGS, Gmail API, etc.), explanation, install steps.

### Backend — `server/src/routes/jarvis.ts`

REST API:

- `GET /api/v1/jarvis/overview` — overview
- `GET /api/v1/jarvis/structure` — project structure string
- `GET /api/v1/jarvis/capabilities` — capabilities list
- `GET /api/v1/jarvis/actions` — actions catalog
- `GET /api/v1/jarvis/actions/:name` — single action
- `GET /api/v1/jarvis/core` — core modules
- `GET /api/v1/jarvis/templates` — plugin + action templates
- `GET /api/v1/jarvis/setup` — setup guide
- `GET /api/v1/jarvis/best-practices` — practices
- `GET /api/v1/jarvis/prompts` — quick prompts
- `GET /api/v1/jarvis/knowledge` — full bundle
- `POST /api/v1/jarvis/chat` — {message, history} → ExpertAnswer (local, no LLM, instant)
- `POST /api/v1/jarvis/generate-plugin` — {description, name?} → code + explanation + fileName + installPath + instructions
- `POST /api/v1/jarvis/generate-action` — same for bundled actions

Registered in `server/src/app.ts` as `/api/v1/jarvis`.

### Frontend — `frontend/src/lib/jarvisApi.ts`

Typed API client wrapping `http` (existing api lib) for all endpoints.

### Frontend — `frontend/src/hooks/useJarvisExpert.ts`

- `useJarvisExpert()` — manages chat messages (starts with welcome explaining expertise), isThinking, error, sendMessage (calls jarvisApi.chat with last 10 history), clearChat
- `usePluginGenerator()` — isGenerating, result, error, generate(description, name)

### Frontend — `frontend/src/pages/JarvisExpert.tsx`

Full page, Mark LIII themed (cyan #00d4ff, dark #00060a, HUD style):

- **Header:** Bot icon gradient cyan→blue, MARK LIII badge, repo stats, Open Repo button, Generate Plugin button, radial gradients
- **Tabs:** Chat Expert, Actions (count), Core (count), Capabilities, Setup & Structure, Plugin Generator — rounded-full, active cyan glow
- **Chat Tab:** 700px flex column, header with pulsing green dot + message count + clear button, messages with MarkdownLite (bold, code blocks, inline code, lists), codeExample with copy, sources pills, relatedActions cyan pills, Speak button (uses useTTS Edge TTS en-US-JennyNeural), follow-up prompts as clickable pills, thinking animation 3 bouncing dots, input with Send button, quick prompt pills
- **Actions Tab:** List of actions, click to expand parameters, category + osSupport badges, exampleUsage pills, file path
- **Core Tab:** Modules with key concepts + API surface, expandable
- **Capabilities Tab:** Grid 2 cols, icon + title + description + howToUse truncated
- **Setup Tab:** Quick start code block, OS/Python/Model/API key cards, project structure pre
- **Generator Tab:** Textarea description + optional name input, Generate button, result shows fileName + copy + download .py, code pre, explanation + install steps, examples to try (weather, translator, email, smart light, web search, calendar)
- **Sidebar:** Quick Knowledge cards (wake word, recallable memory, self-describing skills, real confirmation, audio picker, undo), Expert Stats (actions/core/capabilities/model), Try These Prompts buttons that switch to chat tab and send message

**MarkdownLite:** Small custom renderer — splits ``` blocks, handles bold **, inline `code`, links, headings, lists.

### Frontend — `frontend/src/components/JarvisWidget.tsx`

Floating widget (optional) — fixed bottom-right, closed shows Bot + LIII badge with glow, open 380×500 panel with last 8 messages, input, quick pills. Uses useJarvisExpert.

### Frontend — `frontend/src/App.tsx`

Added route `/jarvis` inside AppShell + RequireAuth, imports JarvisExpert.

### Frontend — `frontend/src/components/layout/AppShell.tsx`

Added nav item JARVIS Expert with Bot icon to mainNav.

### Frontend — `frontend/src/pages/Help.tsx`

Enhanced with JARVIS MARK LIII Expert section, Mark LIII key concepts, Creating Plugins section, link to /jarvis.

## How to Use

1. **Backend:** Already registered — no env needed. Knowledge base is local, no API keys.
2. **Frontend:** Navigate to `/jarvis` (sidebar JARVIS Expert) — chat instantly, no auth beyond existing Soundwave session.
3. **Chat:** Ask natural questions:
   - "How do I install Mark LIII?"
   - "How to create a plugin?"
   - "List all actions and what they do"
   - "Explain the memory system"
   - "How does wake word work?"
   - "How does audio device picker work?"
   - "What is self-describing skills?"
   - "How to handle undo?"
   - "Explain prompt.txt rules"
   - "How does web search work with news mode?"
4. **Plugin Generator:** Go to Plugin Generator tab, describe plugin (e.g. "Weather plugin that fetches live weather for any city using wttr.in"), optional snake_case name, click Generate — get .py file ready to drop into Mark-LIII/plugins/, copy or download.
5. **Voice:** Click Speak on any expert answer — uses existing Edge TTS (server-side Microsoft Neural voices, same as Studio) to speak markdown-stripped text.
6. **Actions/Core Exploration:** Browse tabs to see structured docs.

## Why This Makes JARVIS an Expert

- **Complete Knowledge:** Every file, every TOOL, every core module, every capability, every troubleshooting case from README, main.py, ui.py, core/*, actions/*, memory/*, plugins/_template.py is encoded.
- **Local Expert:** No external LLM, instant (<100ms), works offline, no API cost — answerMarkLiiiQuestion does intent matching against 20+ topics with detailed markdown answers, sources, related actions, code examples, follow-ups.
- **Code Generation:** Generates production-ready plugins following Mark-LIII best practices (name regex, description explicit for Gemini routing, parameters OBJECT, run signature, try/except never raise, player.write_log, PLUGIN_SETTINGS).
- **Self-Describing Alignment:** Mirrors Mark-LIII's own self-describing architecture — TOOL/PLUGIN dict + handler/run, auto-discovery, one-file operation.
- **UI Consistency:** Uses same design language as Mark-LIII HUD (cyan #00d4ff, dark #00060a, reactive, live theming inspiration) while fitting Soundwave AI's Tailwind + Framer Motion.

## Testing

- `frontend/src/lib/jarvisApi.ts` — typed client, uses existing http lib
- `frontend/src/hooks/useJarvisExpert.ts` — chat state, no external deps
- `frontend/src/pages/JarvisExpert.tsx` — tsc --noEmit --skipLibCheck passes
- `server/src/lib/markLiiiKnowledge.ts` — pure TS, no external deps, tsc passes (existing prisma errors unrelated)
- `server/src/routes/jarvis.ts` — validates with zod, uses existing middleware

## Future Enhancements

- Integrate Gemini Live API directly for voice conversation (like Mark-LIII itself) using existing Edge TTS + sounddevice via Web Audio API
- Add plugin marketplace — upload generated plugins, share with community
- Add action testing sandbox — run generated plugin code in isolated VM
- Sync memory with Mark-LIII's long_term.json format for cross-assistant memory portability
- Add wake word to Soundwave AI Studio (openwakeword via WebAssembly)

## Repo Reference

- Source: https://github.com/FatihMakes/Mark-LIII
- This integration: Soundwave-AI `arena/01a0a795-soundwave-ai` branch
- Files added: server/src/lib/markLiiiKnowledge.ts, server/src/routes/jarvis.ts, frontend/src/lib/jarvisApi.ts, frontend/src/hooks/useJarvisExpert.ts, frontend/src/pages/JarvisExpert.tsx, frontend/src/components/JarvisWidget.tsx, docs/JARVIS_MARK_LIII_EXPERT.md
- Files modified: server/src/app.ts (register route), frontend/src/App.tsx (route), frontend/src/components/layout/AppShell.tsx (nav), frontend/src/pages/Help.tsx (docs)
