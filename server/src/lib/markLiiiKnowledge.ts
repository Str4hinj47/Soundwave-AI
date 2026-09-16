/**
 * MARK LIII Expert Knowledge Base
 * Comprehensive, structured knowledge about https://github.com/FatihMakes/Mark-LIII
 * This module powers the JARVIS expert that makes Soundwave-AI an expert at using Mark-LIII.
 */

export interface ActionDef {
  name: string;
  file: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
  exampleUsage: string[];
  category: "system" | "file" | "web" | "media" | "communication" | "productivity" | "vision" | "other";
  osSupport: "all" | "windows" | "macos" | "linux" | "win_mac";
}

export interface CoreModule {
  name: string;
  file: string;
  purpose: string;
  keyConcepts: string[];
  apiSurface: string[];
}

export interface Capability {
  icon: string;
  title: string;
  description: string;
  howToUse: string;
}

export const MARK_LIII_OVERVIEW = {
  name: "MARK LIII (53)",
  tagline: "The Ultimate Cross-Platform Personal AI Assistant",
  author: "FatihMakes",
  repo: "https://github.com/FatihMakes/Mark-LIII",
  stars: "1.2k+",
  forks: "519+",
  license: "CC BY-NC 4.0 (Personal & non-commercial)",
  model: "gemini-3.1-flash-live-preview",
  osSupport: ["Windows 10/11", "macOS", "Linux"],
  python: "3.11 or 3.12",
  coreStack: [
    "Gemini Live API (native audio streaming)",
    "PyQt6 HUD",
    "sounddevice + numpy (audio I/O)",
    "PortAudio (device probing)",
    "openwakeword (optional wake word)",
  ],
  description: `
MARK LIII is the hands-free & scalable release of JARVIS.
Say "Hey Jarvis" and it wakes; stay quiet and it slips back to sleep on its own — while asleep, your microphone never leaves the machine.
Under the hood it runs on the faster Gemini 3.1 Flash Live engine, and the moment you ask for something that takes a beat — analysing a file, searching the web — it answers instantly ("On it — going through that now…") so you never wonder whether it heard you.
It's also built to grow: every skill — bundled or drop-in — now describes itself in its own file, so adding a tool is a one-file operation and the core stays lean.
`.trim(),
  whatsNew: [
    {
      title: '🎙️ Wake Word — "Hey Jarvis"',
      desc: "Local detector runs in its own thread, zero cloud while asleep. Auto-sleeps after 2 min silence. Opt-in one-click download. Toggle & manual sleep/wake from UI.",
    },
    {
      title: "⚡ Instant Acknowledgment",
      desc: "When a tool needs time (file analysis, web search, code building), JARVIS immediately says one short, natural sentence in YOUR language, then runs the tool. No more silent gaps.",
    },
    {
      title: "🚀 Faster Live Engine — Gemini 3.1 Flash Live",
      desc: "Moved to gemini-3.1-flash-live-preview, ~2× faster time-to-first-word vs previous model, keeping tools, 5 voices, transcription, session resumption, sliding-window compression.",
    },
    {
      title: "🧩 Self-Describing Skills — Scalable Core",
      desc: "Every bundled action now carries its own TOOL declaration in its own file (exactly like a drop-in plugin's PLUGIN dict), and the core auto-discovers them at launch. main.py shrank by hundreds of lines. Adding a new skill = moving a file.",
    },
  ],
  foundationFixes: [
    "🧠 Recallable Memory — No size limit, prompt carries core (971 chars for 62 facts), rest fetched on demand via recall_memory tool + index of keys. Memory panel UI with delete.",
    "↩️ Undo — Reverses files (move/rename/create/copy/write/delete/organize desktop) and settings (volume/brightness/dark mode). Files >1MB excluded, copy undo removes copy only.",
    "⚠️ Real Confirmation — Shutdown, restart, WiFi wait for a button YOU press — model cannot confirm its own irreversible actions. Returns immediately, JARVIS keeps talking while banner up.",
    "🎧 Audio Device Picker — Filters 41 PortAudio entries → 8 real devices (drops Sound Mapper, pseudo-devices, dedup per host API). Measures each device (MME vs DirectSound vs WASAPI) to find one that actually works. Stores by name, not index.",
    "🔗 Session Continuity — Captures and replays session_resumption handle. Dropped connection, voice change, device change no longer wipes conversation. Handle held in memory only, not disk, so fresh launch doesn't continue yesterday.",
  ],
};

export const MARK_LIII_PROJECT_STRUCTURE = `
Mark LIII/
├── main.py                   # Core loop — Gemini Live session, audio I/O, wake/sleep state, tool dispatch
├── ui.py                     # PyQt6 HUD — reactive waveform, log panel, settings drawer, plugin manager, camera feed
├── setup.py                  # OS-aware installer (skips wrong-OS deps)
├── requirements.txt          # Core + optional deps, platform markers
├── plugins/
│   ├── _template.py          # Copy this to write a new plugin — one file, drop in, done
│   └── ...                   # Drop-in skills (each self-describes via PLUGIN dict + run())
├── actions/                  # Bundled skills — each self-describes via TOOL dict + handler
│   ├── web_search.py         # Gemini + DDG parallel search (news, research, price, compare)
│   ├── screen_processor.py   # Screen & webcam capture for vision
│   ├── background_monitor.py # User-configured topic watching — daily DDG check
│   ├── proactive.py          # Proactive 2.0 — time/context/rotation-aware check-ins
│   ├── reminder.py           # OS-native scheduled notifications
│   ├── system_monitor.py     # CPU / RAM / GPU / temp telemetry
│   ├── computer_settings.py  # Volume, brightness, WiFi, power (per-OS)
│   ├── computer_control.py   # Keyboard shortcuts, mouse, window management
│   ├── open_app.py           # Application launcher (per-OS name map)
│   ├── browser_control.py    # Web browser control
│   ├── file_controller.py    # File system operations
│   ├── file_processor.py     # Document reading and summarization
│   ├── send_message.py       # Messaging integration
│   ├── weather_report.py     # Live weather
│   ├── flight_finder.py      # Flight search
│   ├── youtube_video.py      # YouTube playback
│   ├── game_updater.py       # Steam / Epic update management
│   ├── code_helper.py        # Code review and generation
│   ├── dev_agent.py          # Developer task agent
│   └── desktop.py            # Desktop and taskbar control
├── memory/
│   ├── memory_manager.py     # Load/save long_term.json — sessions, monitors, identity
│   ├── config_manager.py     # api_keys.json access — key, OS, name, voice, colour, toggles
│   └── long_term.json        # Persistent store: identity, preferences, projects, sessions, monitors
├── core/
│   ├── prompt.txt            # Assistant personality and tool-routing rules
│   ├── undo.py               # One shared undo stack — actions register how to reverse themselves
│   ├── confirm.py            # Irreversible-action gate — token issued by UI, not model
│   ├── audio_devices.py      # Microphone / speaker list — filtered, measured, resolved by name
│   ├── plugin_loader.py      # Plugin engine — discovery, validation, crash isolation
│   ├── action_loader.py      # Bundled-action engine — built-in twin of plugin_loader
│   └── wake_word.py          # Local "Hey Jarvis" detector — own thread, offline, opt-in
└── config/
    └── api_keys.json         # API key, OS setting, assistant name, user name, voice, UI colour, toggles
`.trim();

export const MARK_LIII_CAPABILITIES: Capability[] = [
  {
    icon: "🎙️",
    title: "Wake Word",
    description: 'Local "Hey Jarvis" detection — sleeps until called, auto-sleeps after 2 min, never streams audio while asleep.',
    howToUse: "Enable via ⚙ → WAKE WORD (one-click download of openwakeword tiny model). Mic processed only on your machine until wake word heard.",
  },
  {
    icon: "⚡",
    title: "Instant Acknowledgment",
    description: "Speaks short, context-aware reply in your language instantly when longer task starts.",
    howToUse: "Automatic — triggers for file analysis, web/research search, code building. Instant actions (open app, volume) stay snappy.",
  },
  {
    icon: "🚀",
    title: "Faster Live Engine",
    description: "Runs on Gemini 3.1 Flash Live — ~2× faster time-to-first-word.",
    howToUse: "Set LIVE_MODEL = 'models/gemini-3.1-flash-live-preview' in main.py. No code change needed, it's default.",
  },
  {
    icon: "🧩",
    title: "Self-Describing Skills",
    description: "Actions and plugins share one shape (TOOL/PLUGIN dict + run()), auto-discovered at launch.",
    howToUse: "To add skill: create file in actions/ with TOOL dict + handler, or plugins/ with PLUGIN dict + run(). No core edits.",
  },
  {
    icon: "🧠",
    title: "Recallable Memory",
    description: "No size limit, prompt carries what fits, rest looked up on demand from local search.",
    howToUse: "Memory stored in memory/long_term.json. Use recall_memory tool to search. Prompt carries identity full + recent facts + index of keys not shown.",
  },
  {
    icon: "👁️",
    title: "Memory Panel",
    description: "See every fact JARVIS stored, when learned, delete any in one click.",
    howToUse: "Open ⚙ → 🧠 MEMORY in UI. Shows categories: identity, preferences, projects, relationships, wishes, notes.",
  },
  {
    icon: "↩️",
    title: "Undo",
    description: "Take back what assistant did — files moved/renamed/created/wrote, settings changed.",
    howToUse: 'Say "undo" in any language. Reverses last action. Handles organize_desktop specially (journals every move).',
  },
  {
    icon: "⚠️",
    title: "Real Confirmation",
    description: "Shutdown, restart, WiFi wait for button you press — model cannot confirm its own irreversible actions.",
    howToUse: "Tool puts banner on HUD and returns [CONFIRMATION_PENDING]. You must press CONFIRM. JARVIS keeps talking while banner up.",
  },
  {
    icon: "🎧",
    title: "Audio Device Picker",
    description: "Choose mic and speakers by name, filtered to short list your OS shows — and measured so every entry actually works.",
    howToUse: "⚙ → 🎧 AUDIO DEVICES. List filtered 41→8 on Windows. Probe measures real audio flow (MME 2.02s real-time vs DirectSound 0.00s swallowed). Stores by name not index.",
  },
  {
    icon: "🔗",
    title: "Session Continuity",
    description: "Dropped connection, voice change, device change no longer wipes conversation.",
    howToUse: "Handle captured and replayed automatically. Held in memory only, deliberately not disk, so fresh launch starts clean and morning briefing summary works.",
  },
  {
    icon: "🧩",
    title: "Plugin System",
    description: "Drop single .py file into plugins/ — JARVIS learns new skill on next launch.",
    howToUse: "Copy plugins/_template.py, rename (no leading underscore), fill PLUGIN dict + run(). Restart or reload.",
  },
  {
    icon: "🎙️",
    title: "Real-time Voice",
    description: "Ultra-low latency conversation in any language via Gemini Live API.",
    howToUse: "Requires Gemini API key in config/api_keys.json. SEND_SAMPLE_RATE 16000, RECEIVE 24000, CHUNK_SIZE 1024. PCM level mapping for HUD waveform.",
  },
  {
    icon: "🎨",
    title: "Live Theming",
    description: "Recolour entire HUD from hue wheel or hex — applied instantly across every panel.",
    howToUse: "apply_ui_accent(hex) re-derives teal-family palette via hue shift. retheme_all_widgets() replaces old colours in every widget stylesheet instantly.",
  },
  {
    icon: "〰️",
    title: "Reactive HUD",
    description: "Waveform and reactor core pulse to real audio — your mic while listening, JARVIS while speaking.",
    howToUse: "PCM level via _pcm_level(): RMS floor 60, full 2600, mapped 0-1. Bars move for quiet talker, language-independent.",
  },
  {
    icon: "🎙️",
    title: "Voice Picker",
    description: "Choose from 5 native Gemini voices and switch live from UI — no restart.",
    howToUse: "⚙ → voice picker. Changing voice starts clean session on purpose (resumption would restore old voice).",
  },
  {
    icon: "♾️",
    title: "Unlimited Sessions",
    description: "Sliding-window context compression — one conversation can last hours.",
    howToUse: "Automatic context compression in Live API. Session resumption handle prevents wipes.",
  },
];

export const MARK_LIII_ACTIONS: ActionDef[] = [
  {
    name: "open_app",
    file: "actions/open_app.py",
    description: "Launches applications by name, cross-platform. Maps friendly names to OS-specific executables. Falls back to Start Menu search (Windows) or open -a (macOS).",
    parameters: {
      app_name: { type: "STRING", description: "Name of app to open (e.g. chrome, vscode, spotify, terminal, calculator)", required: true },
    },
    exampleUsage: ["Open Chrome", "Launch VS Code", "Start Spotify", "Open terminal"],
    category: "system",
    osSupport: "all",
  },
  {
    name: "computer_settings",
    file: "actions/computer_settings.py",
    description: "All single OS actions: volume (up/down/mute/set/get), brightness (up/down/set/get), WiFi toggle, power (shutdown/restart/sleep), dark mode, shortcuts. 56 actions with difflib fuzzy matching.",
    parameters: {
      action: { type: "STRING", description: "One of 56 actions: volume_up, volume_down, volume_mute, brightness_up, brightness_down, toggle_wifi, shutdown, restart, etc.", required: true },
      value: { type: "NUMBER", description: "Optional value for set actions (0-100 for volume/brightness)" },
    },
    exampleUsage: ["Volume up", "Set brightness to 50%", "Mute", "Toggle WiFi", "Shutdown"],
    category: "system",
    osSupport: "all",
  },
  {
    name: "computer_control",
    file: "actions/computer_control.py",
    description: "Keyboard shortcuts, mouse control, window management. Uses pyautogui, pygetwindow, pywinauto (Windows).",
    parameters: {
      action: { type: "STRING", description: "Action: press_key, hotkey, type_text, click, etc.", required: true },
      key: { type: "STRING", description: "Key or hotkey combination" },
      text: { type: "STRING", description: "Text to type" },
    },
    exampleUsage: ["Press F to fullscreen", "Type hello world", "Alt+Tab", "Click at 100,200"],
    category: "system",
    osSupport: "all",
  },
  {
    name: "web_search",
    file: "actions/web_search.py",
    description: "Multi-mode web search: search/research/news/price/compare. Gemini Grounded first, DDG fallback. News mode runs Gemini + DDG news in parallel, returns first valid.",
    parameters: {
      query: { type: "STRING", description: "Search query", required: true },
      mode: { type: "STRING", description: "Mode: search, research, news, price, compare" },
    },
    exampleUsage: ["Search for latest AI news", "Research quantum computing", "Price of MacBook Pro", "Compare iPhone vs Pixel"],
    category: "web",
    osSupport: "all",
  },
  {
    name: "screen_process",
    file: "actions/screen_processor.py",
    description: "Captures screen or webcam and lets Gemini analyze it. MUST be called when user asks what is on screen, what you see, look at camera. After capture, image sent directly to Gemini — describe what you see.",
    parameters: {
      angle: { type: "STRING", description: "'screen' to capture display, 'camera' for webcam. Default: 'screen'" },
      text: { type: "STRING", description: "Question or instruction about captured image", required: true },
    },
    exampleUsage: ["What do you see on my screen?", "Look at camera", "Analyze this error message"],
    category: "vision",
    osSupport: "all",
  },
  {
    name: "close_camera",
    file: "actions/screen_processor.py",
    description: "Closes live camera view shown on screen. Call when user says close camera, stop camera, turn off camera in ANY language.",
    parameters: {},
    exampleUsage: ["Close camera", "Stop camera", "Turn off camera"],
    category: "vision",
    osSupport: "all",
  },
  {
    name: "file_controller",
    file: "actions/file_controller.py",
    description: "File system operations: move, rename, create, copy, write, delete, organize desktop. Journals moves for undo. Files >1MB excluded from undo write backup.",
    parameters: {
      action: { type: "STRING", description: "Action: move, rename, create, copy, write, delete, organize_desktop, etc.", required: true },
      source: { type: "STRING", description: "Source path" },
      destination: { type: "STRING", description: "Destination path" },
      content: { type: "STRING", description: "Content for write/create" },
    },
    exampleUsage: ["Move file a.txt to Documents", "Organize my desktop", "Create folder projects", "Delete temp file"],
    category: "file",
    osSupport: "all",
  },
  {
    name: "file_processor",
    file: "actions/file_processor.py",
    description: "Read, summarize, answer questions about local files. Supports txt, pdf, docx, xlsx, pptx, code files. Uses instant acknowledgment pattern.",
    parameters: {
      file_path: { type: "STRING", description: "Path to file to process", required: true },
      question: { type: "STRING", description: "Question about file content" },
    },
    exampleUsage: ["Read my resume.pdf", "Summarize report.docx", "What's in this file?"],
    category: "file",
    osSupport: "all",
  },
  {
    name: "browser_control",
    file: "actions/browser_control.py",
    description: "Web browser control: open URLs, navigate tabs, interact via Playwright. Opens browser, types URL, handles navigation.",
    parameters: {
      action: { type: "STRING", description: "Action: open, navigate, close_tab, etc.", required: true },
      url: { type: "STRING", description: "URL to open" },
    },
    exampleUsage: ["Open youtube.com", "Go to github.com", "Open google.com"],
    category: "web",
    osSupport: "all",
  },
  {
    name: "youtube_video",
    file: "actions/youtube_video.py",
    description: "Search, play, control YouTube playback by voice. Uses browser control or direct search.",
    parameters: {
      query: { type: "STRING", description: "Video to search/play", required: true },
      action: { type: "STRING", description: "Action: search, play, pause, etc." },
    },
    exampleUsage: ["Play relaxing rainy video", "Search for Python tutorial", "Pause YouTube"],
    category: "media",
    osSupport: "all",
  },
  {
    name: "system_monitor",
    file: "actions/system_monitor.py",
    description: "Returns real-time system metrics: CPU, RAM, GPU load, CPU temp, uptime, process count. Uses psutil, pynvml (GPU), WMI (Windows temp).",
    parameters: {},
    exampleUsage: ["How's my computer performance?", "Check CPU usage", "What's my GPU load?"],
    category: "system",
    osSupport: "all",
  },
  {
    name: "weather_report",
    file: "actions/weather_report.py",
    description: "Live weather data for user's city, personalized from memory. Uses weather API.",
    parameters: {
      city: { type: "STRING", description: "City name (optional, from memory if not provided)" },
    },
    exampleUsage: ["What's the weather?", "Weather in Istanbul", "Will it rain today?"],
    category: "other",
    osSupport: "all",
  },
  {
    name: "flight_finder",
    file: "actions/flight_finder.py",
    description: "Live flight price and availability lookup. Searches flights.",
    parameters: {
      from: { type: "STRING", description: "Departure city/airport" },
      to: { type: "STRING", description: "Destination city/airport" },
      date: { type: "STRING", description: "Travel date" },
    },
    exampleUsage: ["Find flights from Istanbul to London", "Cheap flights to Paris tomorrow"],
    category: "other",
    osSupport: "all",
  },
  {
    name: "reminder",
    file: "actions/reminder.py",
    description: "OS-native scheduled notifications: Windows Task Scheduler, macOS LaunchAgent, Linux systemd. Set reminders that fire even when JARVIS closed.",
    parameters: {
      text: { type: "STRING", description: "Reminder text", required: true },
      time: { type: "STRING", description: "When to remind (e.g. in 10 minutes, tomorrow 9am)" },
    },
    exampleUsage: ["Remind me to call mom in 30 minutes", "Set reminder for meeting tomorrow 9am"],
    category: "productivity",
    osSupport: "all",
  },
  {
    name: "background_monitor",
    file: "actions/background_monitor.py",
    description: "User-configured topic watching — checks for new headlines once a day and alerts naturally. No crypto. Stores monitors in memory.",
    parameters: {
      topic: { type: "STRING", description: "Topic to monitor", required: true },
      action: { type: "STRING", description: "Action: add, remove, list" },
    },
    exampleUsage: ["Monitor AI news", "Watch for new Python releases", "Stop monitoring crypto"],
    category: "productivity",
    osSupport: "all",
  },
  {
    name: "send_message",
    file: "actions/send_message.py",
    description: "Compose and send messages through WhatsApp, Telegram, and more. Uses browser automation or API.",
    parameters: {
      platform: { type: "STRING", description: "Platform: whatsapp, telegram, etc.", required: true },
      recipient: { type: "STRING", description: "Recipient name or number" },
      message: { type: "STRING", description: "Message content", required: true },
    },
    exampleUsage: ["Send WhatsApp to mom: I'll be late", "Message John on Telegram"],
    category: "communication",
    osSupport: "all",
  },
  {
    name: "code_helper",
    file: "actions/code_helper.py",
    description: "Inline code review, debugging, generation. Reads code files, suggests fixes, generates snippets.",
    parameters: {
      task: { type: "STRING", description: "Task: review, debug, generate", required: true },
      code: { type: "STRING", description: "Code snippet or file path" },
      language: { type: "STRING", description: "Programming language" },
    },
    exampleUsage: ["Review this Python code", "Debug my JavaScript", "Generate a React component"],
    category: "productivity",
    osSupport: "all",
  },
  {
    name: "game_updater",
    file: "actions/game_updater.py",
    description: "Checks and triggers game updates on Steam and Epic Games on demand. Uses process detection and launcher automation.",
    parameters: {
      game: { type: "STRING", description: "Game name to update" },
      platform: { type: "STRING", description: "Platform: steam, epic" },
    },
    exampleUsage: ["Update my Steam games", "Check for Epic game updates"],
    category: "other",
    osSupport: "all",
  },
  {
    name: "dev_agent",
    file: "actions/dev_agent.py",
    description: "Developer task agent for complex multi-step planning (3+ steps). High-level planning for autonomous tasks. Only for complex goals.",
    parameters: {
      goal: { type: "STRING", description: "Complex goal requiring multi-step planning", required: true },
    },
    exampleUsage: ["Build a todo app with React", "Create a Python script that scrapes news"],
    category: "productivity",
    osSupport: "all",
  },
  {
    name: "desktop",
    file: "actions/desktop.py",
    description: "Desktop and taskbar control: minimize, maximize, window management, taskbar operations.",
    parameters: {
      action: { type: "STRING", description: "Action: minimize, maximize, close, etc.", required: true },
    },
    exampleUsage: ["Minimize all windows", "Close current window"],
    category: "system",
    osSupport: "all",
  },
];

export const MARK_LIII_CORE_MODULES: CoreModule[] = [
  {
    name: "main.py — Core Loop",
    file: "main.py",
    purpose: "Gemini Live session, audio I/O, wake/sleep state, tool dispatch, session continuity, instant acknowledgment",
    keyConcepts: [
      "LIVE_MODEL = gemini-3.1-flash-live-preview",
      "SEND_SAMPLE_RATE 16000, RECEIVE 24000, CHUNK_SIZE 1024",
      "Wake word thread (opt-in, local, zero cloud while asleep)",
      "WAKE_SLEEP_TIMEOUT 120s auto-sleep",
      "Session resumption handle captured & replayed",
      "TOOL_DECLARATIONS inline (screen_process, close_camera, save_memory, manage_monitor, shutdown_jarvis, system_status) + auto-discovered from actions/",
      "Instant acknowledgment: says short sentence in user language before long tool",
      "Nuclear CREATE_NO_WINDOW patch on Windows for all subprocess",
      "UTF-8 console reconfig with errors=replace",
      "_pcm_level() RMS mapping for HUD waveform",
    ],
    apiSurface: ["JarvisLive class", "_execute_tool()", "_capture_camera/_capture_screen", "get_base_dir()", "TOOL_DECLARATIONS"],
  },
  {
    name: "ui.py — PyQt6 HUD",
    file: "ui.py",
    purpose: "Reactive waveform, log panel, settings drawer, plugin manager, camera feed, theming, audio device picker, memory panel",
    keyConcepts: [
      "APP_VERSION = MARK LIII, PROTOCOL derived",
      "C class palette (BG, PANEL, BORDER, PRI, etc.)",
      "apply_ui_accent() hue shift re-derives palette",
      "retheme_all_widgets() instant live theming",
      "_SysMetrics: CPU, mem, net, GPU (NVML DLL no subprocess), temp (WMI)",
      "Audio device probing: filters 41→8 entries, measures MME vs DirectSound",
      "Wake word toggle, voice picker (5 voices), memory panel",
      "Confirmation banner for shutdown/restart/WiFi",
    ],
    apiSurface: ["JarvisUI", "apply_ui_accent()", "current_palette()", "retheme_all_widgets()", "_SysMetrics"],
  },
  {
    name: "action_loader.py",
    file: "core/action_loader.py",
    purpose: "Bundled-action engine — built-in twin of plugin_loader. Auto-discovers actions/*.py with TOOL dict",
    keyConcepts: [
      "TOOL shape: name, description, parameters (type OBJECT), handler callable",
      "Scans actions_dir for *.py, skips _* files, ignores files without TOOL",
      "Signature introspection: handler receives parameters + player/speak/response/session_memory if declared",
      "Name collision detection: reserved core tools, duplicate names rejected",
      "Never raises — logs and skips invalid files",
      "get_tool_declarations(), has(), names(), run()",
    ],
    apiSurface: ["ActionRecord", "ActionRegistry", "discover_actions()"],
  },
  {
    name: "plugin_loader.py",
    file: "core/plugin_loader.py",
    purpose: "Plugin engine — discovery, validation, crash isolation, enable/disable, settings schemas",
    keyConcepts: [
      "PLUGIN shape: name, description, parameters, optional PLUGIN_SETTINGS",
      "Scans plugins_dir, skips _* (e.g. _template.py, __init__.py)",
      "Validation: name regex ^[a-zA-Z_][a-zA-Z0-9_]{0,63}$, description non-empty, parameters type OBJECT, run callable",
      "Settings schemas deduped by namespace",
      "get_tool_declarations() respects get_plugin_enabled()",
      "run() crash isolation + traceback",
      "list_for_ui() for plugin manager overlay",
    ],
    apiSurface: ["PluginRecord", "PluginRegistry", "discover_plugins()", "_call_run()", "_validate()"],
  },
  {
    name: "memory_manager.py",
    file: "memory/memory_manager.py",
    purpose: "Load/save long_term.json, recallable memory, prompt budgeting, session summaries",
    keyConcepts: [
      "MEMORY_MAX_CHARS 200k runaway guard, PROMPT_CORE_CHARS 900, PROMPT_INDEX_CHARS 420",
      "Categories: identity (always in prompt), preferences, projects, relationships, wishes, notes",
      "format_memory_for_prompt(): identity full + recent (PROMPT_MAX_PER_CATEGORY 6) + index of keys not shown",
      "search_memory(): local file search <1ms, no network, no second model",
      "update_memory() recursive, truncates values 380 chars, tracks updated date",
      "_trim_to_limit() only if >200k, notifies via _trim_notifier to activity log",
      "Session memory: save_session_summary(), pop_last_session() for morning briefing",
      "Thread-safe Lock",
    ],
    apiSurface: ["load_memory()", "save_memory()", "update_memory()", "format_memory_for_prompt()", "search_memory()", "set_trim_notifier()"],
  },
  {
    name: "wake_word.py",
    file: "core/wake_word.py",
    purpose: 'Local "Hey Jarvis" detector — own thread, offline, opt-in, zero cost when off',
    keyConcepts: [
      "Uses openwakeword tiny model, few MB, fully local",
      "Runs in own thread, doesn't slow app",
      "Mic processed only on machine until wake word heard",
      "Auto-sleeps after 2 min silence",
      "is_ready(), install_and_download(), WakeWordDetector class",
      "Toggle via config, manual sleep/wake from UI",
    ],
    apiSurface: ["WakeWordDetector", "is_ready()", "install_and_download()"],
  },
  {
    name: "audio_devices.py",
    file: "core/audio_devices.py",
    purpose: "Microphone / speaker list — filtered, measured, resolved by name",
    keyConcepts: [
      "query_devices() returns device×host API entries (41 for 4 mics+4 speakers on Windows)",
      "Filtering: one host API per direction, drops Sound Mapper/Primary Sound Driver, dedup",
      "Measurement: silence probe per host API per direction, background thread at startup",
      "Windows lands on DirectSound mic + MME speakers (split no reasoning would produce)",
      "DirectSound output is silent sink: write returns success ~0ms, no samples reach speakers",
      "MME write(2.0s) took 2.02s consumed real-time",
      "Probe runs in mode app actually ships (callback vs blocking)",
      "Stored by name not index (indices shift on plug)",
      "Fallback to default + log if saved device gone",
    ],
    apiSurface: ["list_devices()", "resolve_device()", "probe_devices()"],
  },
  {
    name: "undo.py",
    file: "core/undo.py",
    purpose: "One shared undo stack — actions register how to reverse themselves",
    keyConcepts: [
      "push_undo(closure) appends, nothing runs unless user asks",
      "Files: move·rename·create·copy·write·delete·organize desktop",
      "Settings: volume·brightness·dark mode",
      "Does not guess: reads current value before changing",
      "Does not hoard: files >1MB excluded",
      "Copy reverse = removing copy; create folder reverse = remove only if empty",
      "organize_desktop journals every move, puts all back, cleans folders if empty",
      "Zero runtime cost",
    ],
    apiSurface: ["push_undo()", "pop_undo()", "undo()"],
  },
  {
    name: "confirm.py",
    file: "core/confirm.py",
    purpose: "Irreversible-action gate — token issued by UI, not model",
    keyConcepts: [
      "Old gate: if action in _DANGEROUS_ACTIONS confirmed = params.get(confirmed) — model fills it, can send confirmed=yes first call, not a gate",
      "New: token issued by interface, banner on HUD, returns immediately, action runs only if user presses CONFIRM",
      "Cheaper than old gate (old burned 2 tool round trips)",
      "Coverage: shutdown, restart, toggle_wifi (cuts own connection, cannot undo)",
      "Split reversibility vs alarming word: undoable done at once, irreversible asks",
    ],
    apiSurface: ["request_confirmation()", "is_confirmed()", "confirm()"],
  },
  {
    name: "prompt.txt",
    file: "core/prompt.txt",
    purpose: "Assistant personality and tool-routing rules — efficient, professional, direct, slightly witty, Iron Man JARVIS",
    keyConcepts: [
      "Vision: call screen_process ONCE per request, never retry due to echo",
      "One-Call Policy: never guess, call tools exactly once, no retries",
      "Memory: store critical preferences/context automatically, recall via recall_memory before saying don't know, index under [ALSO REMEMBERED]",
      "Undo: if user says undo/revert/put it back/cancel that/no not that one, call undo tool",
      "Confirmation: restart/shutdown/toggle_wifi puts button, when returns [CONFIRMATION_PENDING] say one short sentence asking confirm on HUD, never say done",
      "Exit: only shutdown_jarvis if explicit",
      "Acknowledge before task takes moment: ONE short natural sentence in USER language, then tool same turn, vary wording, not for screen_process, not for instant actions",
      "Language: reply in user's MOST RECENT message language, silent language memory via save_memory category identity key language",
      "Tool routing: computer_settings all single OS actions, agent_task only complex 3+ steps, system_status for CPU/RAM/GPU/temp, web_search modes news/research/price/compare, params always extracted in English",
      "System alerts [SYSTEM_ALERT] hardware warnings, translate naturally",
      "Startup briefing [STARTUP_BRIEFING] internal, follow exactly, never read aloud",
      "Proactive check [PROACTIVE_CHECK] silent for while, 1-3 short useful sentences, no tools",
    ],
    apiSurface: ["System prompt text"],
  },
];

export const MARK_LIII_PLUGIN_TEMPLATE = `
"""
Drop-in JARVIS plugin template.

Copy this file, rename it (no leading underscore), fill in PLUGIN and run().
No other file needs to change — JARVIS discovers this automatically at startup.
"""

PLUGIN = {
    "name": "my_plugin",                     # snake_case, unique, ^[a-zA-Z_][a-zA-Z0-9_]{0,63}$
    "description": (
        "One or two sentences Gemini uses to decide when to call this tool. "
        "Be explicit about trigger phrases and, if it could be confused with "
        "another tool, say which tool NOT to use instead (see game_updater's "
        "description in main.py for the pattern)."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "example_arg": {"type": "STRING", "description": "What this argument means"},
        },
        "required": [],   # omit or leave empty for a zero-argument tool
    },
}

# Optional self-describing settings schema (rendered by settings UI)
PLUGIN_SETTINGS = {
    "namespace": "my_plugin",  # shared namespace groups multiple plugins into one form
    "title": "My Plugin Settings",
    "fields": [
        {"key": "api_key", "label": "API Key", "type": "password", "required": True},
        {"key": "enabled", "label": "Enable feature", "type": "checkbox", "default": True},
    ],
    "action": {"label": "Test Connection", "type": "test"},  # optional button
}

def run(parameters: dict, player=None, session_memory=None) -> str:
    """
    parameters: dict of the args Gemini extracted, matching PLUGIN['parameters'].
    player: the JarvisUI instance — use player.write_log(f"JARVIS: ...") to log,
            same as actions/*.py. May be None.
    session_memory: reserved, usually None today (core tools mostly pass None too).
    Return a short natural-language string — this is spoken back to the user.
    Never raise: catch your own errors and return a spoken error string instead
    (the loader also catches exceptions as a second safety net, but don't rely on it).
    """
    example_arg = parameters.get("example_arg", "")
    try:
        result_text = f"Did the thing with {example_arg}."
    except Exception as e:
        return f"Sir, my_plugin failed: {e}"
    if player:
        try:
            player.write_log(f"JARVIS: {result_text}")
        except Exception:
            pass
    return result_text
`.trim();

export const MARK_LIII_ACTION_TEMPLATE = `
"""
Bundled action example — self-describing via TOOL dict.
This is the built-in twin of plugins/_template.py, auto-discovered by core/action_loader.
"""

def open_app(parameters: dict, player=None, speak=None, response=None, session_memory=None) -> str:
    # implementation here
    app_name = parameters.get("app_name", "")
    # ... launch logic per OS ...
    return f"Opened {app_name}."

TOOL = {
    "name": "open_app",
    "description": "Launches applications by name, cross-platform. Maps friendly names to OS-specific executables.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "app_name": {"type": "STRING", "description": "Name of app to open (e.g. chrome, vscode, spotify)"},
        },
        "required": ["app_name"],
    },
    "handler": open_app,  # the callable to run
}
`.trim();

export const MARK_LIII_SETUP_GUIDE = {
  clone: "git clone https://github.com/FatihMakes/Mark-LIII.git && cd Mark-LIII",
  install: "python setup.py  # installs deps for YOUR OS + browser automation engine (skips wrong-OS deps) OR pip install -r requirements.txt",
  run: "python main.py",
  requirements: {
    os: "Windows 10/11, macOS, or Linux",
    python: "3.11 or 3.12",
    mic: "Required for voice interaction and wake word",
    speakers: "Required for voice replies",
    apiKey: "Free Gemini API key (entered on first launch → config/api_keys.json)",
    wakeWord: "Optional one-click download from ⚙ → WAKE WORD (openwakeword, few MB, fully local)",
  },
  firstLaunch: [
    "App creates config/api_keys.json on first launch if missing",
    "Enter Gemini API key (free from aistudio.google.com)",
    "Choose assistant name, your name, voice (5 native Gemini voices), UI colour",
    "Pick audio devices via ⚙ → 🎧 AUDIO DEVICES (filtered, measured list)",
    "Optional: enable wake word via ⚙ → WAKE WORD (downloads tiny model)",
    "Say 'Hey Jarvis' or click mic to start conversation",
  ],
  configFile: {
    path: "config/api_keys.json",
    fields: ["gemini_api_key", "os", "assistant_name", "user_name", "voice", "ui_color", "wake_word_enabled", "input_device", "output_device", "brief_enabled", "plugin_enabled dict", "plugin_config dict"],
  },
  troubleshooting: [
    "ModuleNotFoundError for OS-specific package: pip install <module_name>. setup.py skips wrong-OS deps automatically.",
    "JARVIS can't hear me: check ⚙ → 🎧 AUDIO DEVICES — likely listening to webcam not headset. Pick mic by name.",
    "Wake word not working: ensure openwakeword installed via ⚙ → WAKE WORD one-click download, mic permission granted.",
    "Console UnicodeEncodeError: fixed in Mark LIII via _sys.stdout.reconfigure(encoding='utf-8', errors='replace') — update to LIII.",
    "Session wiped on reconnect: fixed in LIII — handle captured & replayed, held in memory only.",
    "Volume/brightness undo wrong: fixed — reads current value before changing, where platform won't report value nothing registered.",
    "Shutdown without confirmation: fixed — token issued by UI not model, banner on HUD, must press CONFIRM.",
    "Memory forgetting sister's name: old cap 2200 chars whole store, deleted oldest silently. New: 200k guard, prompt 900 chars core + 420 index, recall_memory tool searches rest.",
  ],
};

export const MARK_LIII_BEST_PRACTICES = [
  {
    title: "One-File Skill",
    desc: "Adding a tool is a single file operation. No core edits. Define TOOL/PLUGIN dict + handler/run in its own file, drop into actions/ or plugins/.",
  },
  {
    title: "Self-Describing",
    desc: "TOOL['description'] is what Gemini reads to route calls. Be explicit about trigger phrases and say which tool NOT to use instead if confusion possible.",
  },
  {
    title: "Crash Isolation",
    desc: "Plugin loader catches exceptions, logs, returns spoken error string. Never let plugin crash kill session. Always wrap run() in try/except and return error string.",
  },
  {
    title: "OS-Agnostic",
    desc: "No hardcoded language, no bundled asset files, works same on Windows/macOS/Linux. Use platform.system() to branch, not sys.platform. Use shutil.which, subprocess with CREATE_NO_WINDOW on Windows.",
  },
  {
    title: "Instant Acknowledgment",
    desc: "For tools taking >instant (file_processor, web_search, flight_finder, code_helper, dev_agent, game_updater), first say ONE short natural sentence in user's language, then call tool same turn. Vary wording, never template.",
  },
  {
    title: "Memory Hygiene",
    desc: "Store critical prefs/context automatically via save_memory. Categories: identity (name, age, city, language, etc.), preferences, projects, relationships, wishes, notes. Value truncated 380 chars, updated date tracked.",
  },
  {
    title: "Undo Registration",
    desc: "For file/setting changes, push undo closure via core.undo.push_undo(). Read current value before changing. Exclude files >1MB. Copy reverse = remove copy only.",
  },
  {
    title: "Confirmation Gate",
    desc: "For irreversible actions (shutdown, restart, toggle_wifi), request_confirmation() puts banner, returns [CONFIRMATION_PENDING] immediately. Never say done — wait for user press.",
  },
  {
    title: "Audio Device by Name",
    desc: "Store device choice by name not index. Indices shift on plug. If saved device gone, fallback to default + log.",
  },
  {
    title: "Prompt Language",
    desc: "Reply in user's MOST RECENT message language. Params extracted in English. Tool results English but speak in user language. Silent language memory: save category identity key language value English name.",
  },
];

// Simple intent matching for chat expert
export interface ExpertAnswer {
  answer: string;
  sources: string[];
  relatedActions?: string[];
  codeExample?: string;
  followUp?: string[];
}

export function answerMarkLiiiQuestion(question: string): ExpertAnswer {
  const q = question.toLowerCase();

  // Setup / install
  if (q.includes("install") || q.includes("setup") || q.includes("requirements") || q.includes("clone")) {
    return {
      answer: `**Setup Mark LIII:**

1. Clone: \`${MARK_LIII_SETUP_GUIDE.clone}\`
2. Install: \`${MARK_LIII_SETUP_GUIDE.install}\` — OS-aware, skips Windows-only libs on macOS/Linux and vice versa
3. Run: \`${MARK_LIII_SETUP_GUIDE.run}\`

**Requirements:** OS ${MARK_LIII_SETUP_GUIDE.requirements.os}, Python ${MARK_LIII_SETUP_GUIDE.requirements.python}, mic & speakers, free Gemini API key (aistudio.google.com) → stored in config/api_keys.json

**First launch:** ${MARK_LIII_SETUP_GUIDE.firstLaunch.join(" → ")}

If you hit ModuleNotFoundError for OS-specific package, just \`pip install <module>\`. Wake word engine is opt-in, not installed by default — grab via ⚙ → WAKE WORD one-click.`,
      sources: ["readme.md Quick Start", "setup.py", "config/api_keys.json"],
      followUp: ["How do I get a Gemini API key?", "What is wake word mode?", "How to choose audio devices?"],
    };
  }

  if (q.includes("wake word") || q.includes("hey jarvis") || q.includes("sleep") || q.includes("wake")) {
    return {
      answer: `**🎙️ Wake Word — "Hey Jarvis" (Mark LIII headline feature):**

JARVIS can sit quietly until you call it. Turn on **⚙ → WAKE WORD** (one-click opt-in download of tiny openwakeword model, few MB, fully local) and it goes to sleep: microphone processed **only on your machine** by local detector in its own thread, nothing sent to cloud until it hears "Hey Jarvis." Once awake it listens normally, then **auto-sleeps after 2 minutes** of silence (WAKE_SLEEP_TIMEOUT=120s). You can also sleep/wake by clicking in settings.

Because it's a local gate, background chatter — "I'm coming!" to someone at home — never wakes it. Costs **zero** when off (model not even loaded), detection runs own thread so nothing else slows.

**Code:** core/wake_word.py — WakeWordDetector class, is_ready(), install_and_download(). Config via get_wake_word_enabled()/save_wake_word_enabled() in memory/config_manager.py`,
      sources: ["core/wake_word.py", "ui.py wake word toggle", "main.py wake/sleep state"],
      relatedActions: [],
      followUp: ["How to enable wake word?", "How does auto-sleep work?", "Is wake word private?"],
    };
  }

  if (q.includes("plugin") && (q.includes("create") || q.includes("make") || q.includes("write") || q.includes("generate") || q.includes("how"))) {
    return {
      answer: `**🧩 Plugin System — Drop a single .py file into plugins/ — JARVIS learns new skill on next launch:**

**Template:** plugins/_template.py

Every plugin self-describes via PLUGIN dict + run() — same shape as bundled actions' TOOL dict + handler.

**PLUGIN dict:**
- name: snake_case, unique, regex ^[a-zA-Z_][a-zA-Z0-9_]{0,63}$
- description: 1-2 sentences Gemini uses to decide when to call. Be explicit about trigger phrases and say which tool NOT to use instead if confusion possible.
- parameters: {type: OBJECT, properties: {arg: {type: STRING, description: ...}}, required: []}

**Optional PLUGIN_SETTINGS:** namespace, title, fields (key, label, type password/checkbox/text, required, default), action button.

**run() signature:** \`def run(parameters: dict, player=None, session_memory=None) -> str\`
- parameters: args Gemini extracted
- player: JarvisUI instance — use player.write_log() to log
- Return short natural-language string spoken back to user
- Never raise — catch own errors and return spoken error string. Loader also catches as safety net.

**Discovery:** core/plugin_loader.py discover_plugins() scans plugins_dir for *.py, skips _* files (like _template.py, __init__.py, helper modules prefixed _). Import errors, validation errors, name collisions logged and skipped — never abort scan.

**Enable/disable:** stored in config/api_keys.json plugin_enabled dict, re-read every call to get_tool_declarations()/run()/list_for_ui() so toggling doesn't require restart.

**Settings UI:** settings_schemas() deduped by namespace, merges stored values from get_plugin_config(ns).

Use the Plugin Generator in this expert UI to scaffold a new plugin from description!`,
      sources: ["plugins/_template.py", "core/plugin_loader.py", "memory/config_manager.py"],
      codeExample: MARK_LIII_PLUGIN_TEMPLATE,
      followUp: ["Show me a plugin example for weather", "How to add settings to plugin?", "How to handle errors in plugin?"],
    };
  }

  if (q.includes("action") && (q.includes("create") || q.includes("add") || q.includes("bundled") || q.includes("self-describing") || q.includes("tool"))) {
    return {
      answer: `**🧩 Self-Describing Skills — Scalable Core (Mark LIII):**

Every bundled **action** now carries its own TOOL declaration in its own file (exactly like drop-in plugin's PLUGIN dict), and core auto-discovers them at launch. main.py no longer holds giant list of tool definitions and dispatch branches — shrank by hundreds of lines. Adding new built-in skill or promoting actions/*.py file into shareable plugin is now just moving file.

**TOOL shape:**
\`\`\`python
TOOL = {
  "name": "open_app",              # unique, ^[a-zA-Z_][a-zA-Z0-9_]{0,63}$
  "description": "...",             # what Gemini reads to route call
  "parameters": {"type": "OBJECT", ...}, # Gemini function-declaration schema
  "handler": open_app,              # callable to run
}
\`\`\`

**Handler signature introspection:** handler invoked through inspect.signature — receives parameters plus whichever of player/speak/response/session_memory it actually declares, so existing signatures work unchanged. Has **kwargs → gets all.

**Discovery:** core/action_loader.py discover_actions() scans actions_dir for *.py, skips _*, only treats file as action if exposes module-level TOOL dict (shared helpers without TOOL silently ignored). Import/validation errors, name collisions logged and skipped — never raises.

**Current actions (${MARK_LIII_ACTIONS.length}):** ${MARK_LIII_ACTIONS.map((a) => a.name).join(", ")}

**Inline tools staying in main.py:** system_status, screen_process, close_camera, manage_monitor, save_memory, shutdown_jarvis — because handling woven into live-session state (vision capture/injection, camera stream, memory writes, monitor engine, shutdown).

Use Actions tab to explore each action's parameters and examples.`,
      sources: ["core/action_loader.py", "actions/*.py", "main.py TOOL_DECLARATIONS"],
      codeExample: MARK_LIII_ACTION_TEMPLATE,
      relatedActions: MARK_LIII_ACTIONS.slice(0, 5).map((a) => a.name),
      followUp: ["List all actions", "How to create a new action?", "Difference between action and plugin?"],
    };
  }

  if (q.includes("memory") || q.includes("remember") || q.includes("recall") || q.includes("forget")) {
    return {
      answer: `**🧠 Memory that actually remembers — Foundation fix shipped to LIII, LIV, LV:**

**Old problem:** Store capped at 2,200 chars — whole memory, not per entry — because all pasted into system prompt every connect, so growing memory grew every request. When filled, oldest entries deleted and one line printed to console nobody reads. Assistant advertised as remembering "projects, preferences, personal context" was in practice two-page notepad that quietly forgot sister's name after weeks.

**New: Storage and prompt budget separate problems:**
- **Nothing deleted.** Cap is runaway guard 200k (MEMORY_MAX_CHARS), normal use never approaches, if ever hit says so in activity log not stdout.
- **Prompt carries core, not dump.** Identity full, then most recently updated facts, budgeted — measured at **971 chars on memory holding 62 stored facts** (smaller than old whole-store cap, so sessions connect with fewer tokens).
- **Rest fetched on demand.** \`recall_memory\` tool searches full store locally — no network, no second model, <1ms.
- **Index of keys:** Prompt also carries index of keys it had no room for (PROMPT_INDEX_CHARS 420, PROMPT_MAX_PER_CATEGORY 6 interleaves categories). Without it, "who is Ayşe?" gets "I don't know" while ayse_sister sits on disk unread.

**Implementation:** memory/memory_manager.py
- _empty_memory(): identity, preferences, projects, relationships, wishes, notes
- load_memory() thread-safe Lock, handles bare string legacy entries
- update_memory() recursive, truncates value 380 chars (MAX_VALUE_LENGTH), tracks updated date YYYY-MM-DD
- format_memory_for_prompt(): identity always + recent per category by recency + index
- search_memory(): local search
- save_session_summary(), pop_last_session() for morning briefing (consumed after use, never repeats)
- _trim_notifier set by main.py so trim surfaces to activity log

**UI:** ⚙ → 🧠 MEMORY shows every stored fact, when learned, ✕ to forget. Everything stays in memory/long_term.json on your machine.

**Prompt rule:** Memory may say which language person used before. That's record of past, not instruction for now: if they write/speak another language today, answer in that one.`,
      sources: ["memory/memory_manager.py", "core/prompt.txt Memory section", "ui.py Memory Panel"],
      relatedActions: ["save_memory", "recall_memory"],
      followUp: ["How to save memory?", "What is recall_memory tool?", "How does session memory work?"],
    };
  }

  if (q.includes("undo")) {
    return {
      answer: `**↩️ Undo — it can take back what it did:**

JARVIS moves files, renames them, writes to them and changes settings. None had way back; if misheard, only remedy fix by hand.

Say **"undo" — in any language** — and it reverses own last action:

**Files:** move · rename · create · copy · write · delete · organize desktop
**Settings:** volume · brightness · dark mode

**Three things it deliberately does NOT do:**
- Does not guess. Settings undo reads current value BEFORE changing it. Where platform won't report value, nothing registered — undo that restores guess worse than no undo.
- Does not hoard. Undoing write means keeping old contents in memory, so files >1MB excluded and says so rather than holding 200MB log for session.
- Does not delete your files to undo copy. Reverse of copy is removing copy; reverse of "create folder" is removing it only while still empty.

**organize_desktop special:** one command moves dozens files, least reversible. Journals every move and puts all back in one go, cleaning up folders it created if still empty.

**Costs nothing at runtime.** Appends closure to list; nothing runs unless you ask.

**Code:** core/undo.py — push_undo(closure), pop_undo(), undo(). Actions register how to reverse themselves.

**Prompt:** "If user says undo / revert / put it back / cancel that / 'no, not that one', call undo tool. Do not apologise and leave it broken; reverse it."`,
      sources: ["core/undo.py", "actions/file_controller.py", "actions/computer_settings.py"],
      followUp: ["What can be undone?", "How does organize_desktop undo work?", "Does undo work for settings?"],
    };
  }

  if (q.includes("confirm") || q.includes("shutdown") || q.includes("restart") || q.includes("wifi")) {
    return {
      answer: `**⚠️ Real Confirmation — model can't forge:**

**Old gate (broken):**
\`\`\`python
if action in _DANGEROUS_ACTIONS:  # {"restart", "shutdown"}
  confirmed = str(params.get("confirmed", "")).lower()
\`\`\`
confirmed is tool parameter, which means model fills it in. Nothing stopped it sending confirmed=yes on first call and nothing checked human involved. Convention, not gate. Coverage only 2 actions — so toggle_wifi, which cuts assistant's own connection to Live API and therefore cannot be asked to undo itself, went through no gate.

**New:** Token issued by interface. Shutdown, restart, WiFi put banner on HUD and **return immediately**; action runs only if you press CONFIRM. Nothing blocks — JARVIS keeps talking while banner up — so cheaper than old gate which burned 2 tool round trips on every power command.

**Split reversibility vs alarming word:** Anything undoable done at once; only genuinely irreversible asks. Assistant that checks before turning volume down is one you stop talking to.

**Code:** core/confirm.py — request_confirmation(), is_confirmed(), confirm(). UI banner.

**Prompt:** "restart, shutdown and toggle_wifi put a button on user's screen and DO NOT happen until they press it. When such tool returns [CONFIRMATION_PENDING], say one short sentence asking them to confirm on HUD. Never say it is done — it is not."`,
      sources: ["core/confirm.py", "ui.py confirmation banner", "actions/computer_settings.py"],
      followUp: ["Which actions need confirmation?", "How does confirmation work?", "Why WiFi needs confirmation?"],
    };
  }

  if (q.includes("audio") || q.includes("microphone") || q.includes("speaker") || q.includes("device")) {
    return {
      answer: `**🎧 Audio Device Picker — finally asks which microphone:**

Both audio streams opened with no device argument, always took whatever OS called "default" — and on Windows that moves on its own moment you plug headset in. "JARVIS can't hear me" almost always meant "JARVIS listening to webcam".

**⚙ → 🎧 AUDIO DEVICES** lets you pick mic and speakers by name. Two things matter more than dropdown:

**List is short.** query_devices() returns one entry per device × host API, not per device — measured on ordinary Windows machine, **41 entries for what sound settings show as 4 mics and 4 speakers**. Same mic appears 4 times under MME, DirectSound, WASAPI, WDM-KS, nothing to say which is which. Not choice, it's quiz. Picker takes one host API per direction, drops "Sound Mapper" and "Primary Sound Driver" pseudo-devices that just mean "default", and deduplicates. **41 → 8.**

**Every entry measured, not assumed.** Obvious approach pick host API with nicest names — WASAPI on Windows, which in shared mode doesn't resample, so with 16kHz in and 24kHz out against 48kHz hardware every open failed. Adding rate check and moving to DirectSound passes test both sides, and PortAudio's DirectSound output is silent sink: stream opens, every write returns success in ~0ms, not one sample reaches speakers.

| write(2.0s) took | |
|---|---|
| MME | 2.02s consumed real-time |
| DirectSound | 0.00s swallowed instantly |

No capability flag reports that. So app measures it — once per host API per direction, background thread at startup, using silence.

**Consequences:**
- Each direction picks own host API. On Windows lands on DirectSound for mic and MME for speakers — split no reasoning would produce.
- Probe runs in mode app actually ships. DirectSound input passes callback stream and fails blocking read; probing wrong mode rejected mic that works perfectly.

**Storage:** Choice stored by name not index — indices shift whenever something plugged in. If saved device gone, falls back to system default and says so in log rather than failing to start.

**Code:** core/audio_devices.py — list_devices(), resolve_device(), probe_devices(). Config via get_input_device()/get_output_device() in memory/config_manager.py`,
      sources: ["core/audio_devices.py", "ui.py AUDIO DEVICES", "memory/config_manager.py"],
      followUp: ["How to fix microphone not working?", "Why does speaker list show duplicates?", "How does device probing work?"],
    };
  }

  if (q.includes("prompt") || q.includes("personality") || q.includes("routing") || q.includes("language")) {
    return {
      answer: `**core/prompt.txt — JARVIS CORE PROTOCOL:**

**Identity:** Efficient, professional, direct, no fluff. Always act like Jarvis from Iron Man — professional, efficient, slightly witty. Greet warmly in user's own language.

**Execution Rules:**
- Vision (screen_process): Call ONCE per user request. Never again due to echo/ambient/uncertainty. After image captured sent directly to you — describe what you see and answer.
- One-Call Policy: Never guess. Call tools exactly once. No retries.
- Memory: Store critical prefs/context automatically. Recall: memory block holds what fits. Anything under [ALSO REMEMBERED] stored but NOT shown — if user asks about those names or anything personal you cannot see, call recall_memory BEFORE saying don't know. Local file search: instant, free, no round trip.
- Undo: Take back own changes — files moved/renamed/created/wrote, settings adjusted. If user says undo/revert/put it back/cancel that/"no not that one", call undo tool. Don't apologise and leave broken; reverse it.
- Confirmation: restart, shutdown, toggle_wifi put button on screen and DO NOT happen until press. When returns [CONFIRMATION_PENDING], say one short sentence asking confirm on HUD. Never say done.
- Exit: Only shutdown_jarvis if session termination explicit.
- Response time: fast as can. Speed #1 priority.

**Acknowledge before task takes moment:** When user asks something whose tool needs more than instant — reading/analyzing uploaded file, web/news/research/price searches, finding flights, writing/building code, building project, updating game — FIRST say exactly ONE short natural sentence in USER'S OWN language that fits THIS specific request, then call tool same turn. Compose fresh each time, own words, language of conversation — naming what you're about to do. Do NOT reuse remembered phrase and do NOT lift wording from tool description. When tool returns, deliver result. Instant actions (opening app, volume, brightness, single keypress, quick setting) need NO ack — just do them. Do NOT pre-acknowledge for screen_process.

**Language:** Reply language = user's MOST RECENT message language. Nothing else decides — not memory, not instructions, not tool result language. Memory may say which language person used before. That's record of past, not instruction: if they write/speak another language today, answer in that one. Tool results, log lines, prompt English because code written in English. None reason to switch. Never answer in language user not used. Address user with ordinary respectful form of language speaking — never form from different language. Do not mix two languages in one reply.

**Tool Routing:**
- computer_settings: ALL single OS actions (volume, brightness, wifi, close, shortcuts, power)
- agent_task: ONLY complex multi-step planning (3+ steps) and if user really specifies it. Do not call agent_task while can accomplish with tool
- system_status: when user asks CPU/RAM/GPU/temp/performance
- web_search: mode news for current events, research for deep topics, price for product costs
- Tool params always extracted in English; see LANGUAGE for what you SPEAK
- Wants to open video = youtube. Always know context for better UX
- If user wants task more than 1, attain them and do them one by one (e.g. "open relax rainy video and make it fullscreen" → open video first, wait 3-4s load, then press F)

**Language Detection:** First time detect user's language (or if changes), silently call save_memory with category identity key language value English name. Do NOT announce — save silently background.

**System Alerts:** Messages starting [SYSTEM_ALERT] hardware warnings from monitoring. Translate and speak naturally in user's language. Brief, helpful.

**Startup Briefing:** Messages starting [STARTUP_BRIEFING] internal instructions for morning briefing. Follow exactly. Never read instruction text aloud.

**Proactive Check:** Messages starting [PROACTIVE_CHECK] mean user silent for while. Read time and memory context. Say something genuinely useful, timely, caring in 1-3 short sentences. Natural — like thoughtful assistant who noticed something relevant. Never read tag aloud. Do NOT call any tools during proactive check.

Full prompt is 6k chars, efficiently guides tool routing, language, memory, undo, confirmation.`,
      sources: ["core/prompt.txt"],
      followUp: ["What is instant acknowledgment rule?", "How does language detection work?", "What are tool routing rules?"],
    };
  }

  if (q.includes("web search") || q.includes("search") || q.includes("news") || q.includes("research") || q.includes("price") || q.includes("compare")) {
    return {
      answer: `**🔍 Multi-Mode Web Search — Gemini Grounded first, DDG fallback:**

**File:** actions/web_search.py

**Modes:**
- **search:** Default — Gemini grounded, DDG fallback. _gemini_search(query) uses client.models.generate_content with tools google_search. _ddg_search via DDGS().text() max 6 results. _format_ddg formats title/snippet/url.
- **news:** Runs Gemini grounded + DDG news in parallel, returns whichever valid first, cancels other. gemini_query "latest news today: {query}", ddg_query same. Threading with result_box[0], lock, done_evt, failures counter. Timeout 10s. _ddg_news() uses ddgs.news() max 8, fallback to text search if fails. _format_news shows title [source] + snippet 140 chars + url. Optimized for speed: minimal prompt + strict token cap. Also _gemini_headlines(n=5) for morning briefing — fetches current headlines via grounded search, numbered list titles only, regex filters lines starting with number.
- **research:** Deep dive — asks Gemini comprehensive detailed explanation with background, key facts, current state, nuances. Wider DDG fetch max 10 fallback.
- **price:** Product price lookup — "current price of {query} — how much does it cost today" + DDG "{query} price buy" max 6 fallback.
- **compare:** Compare items list + aspect.

**Usage:** web_search tool with query + mode param. In prompt routing: mode news for current events, research for deep topics, price for product costs.

**Dynamic Content Panel:** Scrollable display layer beneath HUD renders web results, news, search data.

**Example:** User "What's latest AI news?" → mode news → parallel Gemini + DDG news → first valid result spoken + displayed in content panel.`,
      sources: ["actions/web_search.py", "core/prompt.txt Tool Routing", "ui.py Dynamic Content Panel"],
      relatedActions: ["web_search"],
      followUp: ["How does news mode work?", "What is DDG fallback?", "How to search for prices?"],
    };
  }

  if (q.includes("screen") || q.includes("vision") || q.includes("camera") || q.includes("see")) {
    return {
      answer: `**👁️ Visual Awareness — Real-time screen capture and webcam vision piped into main Gemini session:**

**File:** actions/screen_processor.py

**Two angles:**
- **screen:** Captures display via mss (cross-platform screenshot) + PIL. Must be called when user asks what is on screen, what you see, analyze screen, etc. You have NO visual ability without this tool.
- **camera:** Webcam capture via opencv-python cv2.VideoCapture(0). Live view stays open until user says close it or calls close_camera. When using camera, UI shows camera feed.

**Flow:**
1. User "What do you see?" → call screen_process with angle screen + text question
2. Tool captures image (screen: mss, camera: cv2)
3. Image sent directly to Gemini Live session — no separate model, piped into main session
4. Gemini describes what it sees and answers user's question
5. For camera: live view remains open, user can ask follow-ups, close via close_camera tool when says "close camera" in ANY language

**Prompt rules:** Call tool ONCE per user request. Never again due to echo, ambient sound, uncertainty. After calling, wait for image result — do NOT call second time.

**Dependencies:** pillow, opencv-python, mss

**Close camera:** close_camera tool closes live view. Trigger phrases in any language: close camera, stop camera, turn off camera, that's creepy, etc.

**Example:** User "Look at my screen and tell me what's wrong" → screen_process angle screen text "User asks what's wrong on screen" → captures, Gemini analyzes, describes error, suggests fix.`,
      sources: ["actions/screen_processor.py", "core/prompt.txt Vision"],
      relatedActions: ["screen_process", "close_camera"],
      followUp: ["How to capture screen?", "How does camera stay open?", "What if vision fails?"],
    };
  }

  if (q.includes("file") && (q.includes("controller") || q.includes("organize") || q.includes("move") || q.includes("desktop"))) {
    return {
      answer: `**📂 File Controller + Processor:**

**file_controller.py:** File system operations — move, rename, create, copy, write, delete, organize desktop.

**Key features:**
- Journals moves for undo (especially organize_desktop which moves dozens files)
- Files >1MB excluded from undo write backup (says so rather than holding 200MB log)
- Copy reverse = removing copy only; create folder reverse = remove only if still empty
- Uses send2trash for safe delete where available
- Path handling cross-platform, expands ~, handles spaces

**organize_desktop special:** One command moves dozens files, least reversible. Journals every move and puts all back in one go, cleaning up folders it created if still empty. Creates categories like Documents, Images, etc.

**file_processor.py:** Read, summarize, answer questions about local files. Supports txt, pdf (via pdfminer or PyPDF2), docx (python-pptx), xlsx (openpyxl), pptx, code files. Uses instant acknowledgment pattern: says short sentence in user language before reading file ("On it — going through that file now...") then runs tool.

**Example flows:**
- "Organize my desktop" → file_controller action organize_desktop → scans desktop, creates folders, moves files by extension, journals for undo
- "Read my resume.pdf and summarize" → instant ack "Right away — going through that file now" → file_processor reads PDF → summarizes

**Undo:** Say "undo" in any language → reverses last file action.`,
      sources: ["actions/file_controller.py", "actions/file_processor.py", "core/undo.py"],
      relatedActions: ["file_controller", "file_processor"],
      followUp: ["How to organize desktop?", "What file types supported?", "How does undo work for files?"],
    };
  }

  // Default: general overview
  return {
    answer: `**MARK LIII Expert — Overview:**

**What is Mark LIII?** ${MARK_LIII_OVERVIEW.description}

**Core Stats:** ${MARK_LIII_OVERVIEW.stars} stars, ${MARK_LIII_OVERVIEW.forks} forks, ${MARK_LIII_OVERVIEW.license}, Model ${MARK_LIII_OVERVIEW.model}, Python ${MARK_LIII_OVERVIEW.python}, OS ${MARK_LIII_OVERVIEW.osSupport.join(", ")}

**What's New in LIII:**
${MARK_LIII_OVERVIEW.whatsNew.map((w) => `- **${w.title}:** ${w.desc}`).join("\n")}

**Foundation Fixes (shipped to LII, LIII, LIV, LV):**
${MARK_LIII_OVERVIEW.foundationFixes.map((f) => `- ${f}`).join("\n")}

**Project Structure:** See Structure tab — main.py core loop, ui.py PyQt6 HUD, actions/ 20 self-describing skills, core/ 8 modules, memory/, plugins/, config/

**Quick Start:**
\`\`\`
${MARK_LIII_SETUP_GUIDE.clone}
${MARK_LIII_SETUP_GUIDE.install}
${MARK_LIII_SETUP_GUIDE.run}
\`\`\`

**Capabilities (${MARK_LIII_CAPABILITIES.length}):** Wake Word, Instant Ack, Faster Live Engine, Self-Describing Skills, Recallable Memory, Memory Panel, Undo, Real Confirmation, Audio Device Picker, Session Continuity, Plugin System, Real-time Voice, Live Theming, Reactive HUD, Voice Picker, Unlimited Sessions, System Control, Autonomous Tasks, Visual Awareness, Persistent Memory, Hybrid Input, Morning Briefing, Proactive 2.0, Session Memory, Background Monitoring, Hardware Monitoring, Weather, Dynamic Content Panel, Multi-Mode Web Search, Smart Reminders, Flight Finder, Game Updater, File Processor, Code Helper, Browser Control, Send Message, YouTube Control, Desktop Control, Silent Language Memory, Remote Dashboard, Auto-Start, Clipboard Intelligence, Assistant Customization

Ask me about any specific feature, action, core module, plugin creation, setup, or troubleshooting!`,
    sources: ["readme.md", "main.py", "core/prompt.txt"],
    followUp: ["How to create a plugin?", "List all actions", "How does memory work?", "Explain wake word"],
    relatedActions: MARK_LIII_ACTIONS.slice(0, 3).map((a) => a.name),
  };
}

export function generatePluginCode(description: string, name?: string): { code: string; explanation: string } {
  const safeName = (name || description.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30) || "my_plugin")
    .replace(/^[^a-z_]+/, "")
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 32) || "my_plugin";

  const q = description.toLowerCase();

  // Infer parameters from description
  let params: string[] = [];
  let paramDefs: string = "";
  let logicHint = "";

  if (q.includes("weather") || q.includes("temperature")) {
    params = ["city"];
    paramDefs = `"city": {"type": "STRING", "description": "City name for weather lookup"},`;
    logicHint = `
    city = parameters.get("city", "Istanbul")
    # Use requests to fetch weather from wttr.in or openweathermap
    try:
        import requests
        # Simple wttr.in example (no API key)
        r = requests.get(f"https://wttr.in/{city}?format=3", timeout=8)
        result_text = r.text.strip() if r.ok else f"Weather for {city} unavailable"
    except Exception as e:
        result_text = f"Weather lookup failed: {e}"`;
  } else if (q.includes("translate") || q.includes("language")) {
    params = ["text", "target_language"];
    paramDefs = `"text": {"type": "STRING", "description": "Text to translate"},
            "target_language": {"type": "STRING", "description": "Target language (e.g. Spanish, French)"},`;
    logicHint = `
    text = parameters.get("text", "")
    target = parameters.get("target_language", "English")
    # For real translation, use googletrans or deep-translator
    # pip install deep-translator
    try:
        from deep_translator import GoogleTranslator
        result_text = GoogleTranslator(source='auto', target=target[:2].lower()).translate(text)
    except Exception:
        result_text = f"Translation to {target}: {text} (install deep-translator for real translation)"`;
  } else if (q.includes("email") || q.includes("gmail")) {
    params = ["to", "subject", "body"];
    paramDefs = `"to": {"type": "STRING", "description": "Recipient email"},
            "subject": {"type": "STRING", "description": "Email subject"},
            "body": {"type": "STRING", "description": "Email body"},`;
    logicHint = `
    to = parameters.get("to", "")
    subject = parameters.get("subject", "")
    body = parameters.get("body", "")
    # Use Gmail API via google-api-python-client if configured
    # See plugins/ examples for OAuth flow
    try:
        # Placeholder — implement Gmail send via googleapiclient.discovery
        result_text = f"Email to {to} with subject '{subject}' would be sent (configure Gmail plugin)"
        if player:
            player.write_log(f"JARVIS: Email draft to {to}")
    except Exception as e:
        result_text = f"Email failed: {e}"`;
  } else if (q.includes("calendar") || q.includes("event") || q.includes("schedule")) {
    params = ["title", "date", "time"];
    paramDefs = `"title": {"type": "STRING", "description": "Event title"},
            "date": {"type": "STRING", "description": "Event date (e.g. tomorrow, 2026-09-20)"},
            "time": {"type": "STRING", "description": "Event time (e.g. 3pm, 14:00)"},`;
    logicHint = `
    title = parameters.get("title", "Meeting")
    date = parameters.get("date", "today")
    time = parameters.get("time", "now")
    try:
        # Use Google Calendar API or local ics
        result_text = f"Event '{title}' scheduled for {date} at {time}"
    except Exception as e:
        result_text = f"Calendar scheduling failed: {e}"`;
  } else if (q.includes("smart") || q.includes("light") || q.includes("home") || q.includes("tuya")) {
    params = ["device", "action"];
    paramDefs = `"device": {"type": "STRING", "description": "Smart device name"},
            "action": {"type": "STRING", "description": "Action: on, off, brightness, color"},`;
    logicHint = `
    device = parameters.get("device", "light")
    action = parameters.get("action", "on")
    try:
        # For Tuya/Smart Life: pip install tinytuya
        import tinytuya
        # Configure via PLUGIN_SETTINGS with device id, ip, local key
        result_text = f"Smart device {device} turned {action}"
    except Exception as e:
        result_text = f"Smart home control failed: {e} — configure tinytuya credentials"`;
  } else if (q.includes("search") || q.includes("web") || q.includes("google")) {
    params = ["query"];
    paramDefs = `"query": {"type": "STRING", "description": "Search query"},`;
    logicHint = `
    query = parameters.get("query", "")
    try:
        from ddgs import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=5))
        if results:
            result_text = "\\n".join([f"{r['title']}: {r['body'][:100]}" for r in results[:3]])
        else:
            result_text = f"No results for {query}"
    except Exception as e:
        result_text = f"Search failed: {e}"`;
  } else {
    // Generic
    params = ["input"];
    paramDefs = `"input": {"type": "STRING", "description": "Input for ${safeName}"},`;
    logicHint = `
    user_input = parameters.get("input", "")
    # TODO: Implement your logic here for: ${description}
    # Examples:
    # - Use requests for API calls
    # - Use pyautogui for automation
    # - Use pathlib for file ops
    # - Always handle exceptions and return spoken string
    result_text = f"Processed {safeName} with input: {user_input}"`;
  }

  const code = `"""
${description}
Drop-in JARVIS plugin — auto-discovered by Mark LIII.
Place this file in plugins/ (no leading underscore), restart JARVIS.
"""

PLUGIN = {
    "name": "${safeName}",
    "description": "${description.replace(/"/g, "'").slice(0, 200)} — triggers when user ${q.includes("when") ? description : `asks to ${description.toLowerCase()}`}",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            ${paramDefs}
        },
        "required": [${params.map((p) => `"${p}"`).join(", ")}],
    },
}

# Optional settings schema for UI
PLUGIN_SETTINGS = {
    "namespace": "${safeName}",
    "title": "${safeName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} Settings",
    "fields": [
        {"key": "enabled", "label": "Enable ${safeName}", "type": "checkbox", "default": True},
    ],
}

def run(parameters: dict, player=None, session_memory=None) -> str:
    """
    Main plugin logic — must return string spoken to user.
    Never raise — catch errors and return error string.
    """
    try:${logicHint}
    except Exception as e:
        return f"Sir, ${safeName} failed: {e}"

    if player:
        try:
            player.write_log(f"JARVIS: {result_text}")
        except Exception:
            pass

    return result_text
`.trim();

  const explanation = `
**Generated plugin: ${safeName}**

**What it does:** ${description}

**Inferred parameters:** ${params.join(", ") || "none"}

**How to use:**
1. Save as \`plugins/${safeName}.py\` (no leading underscore)
2. \`pip install\` any extra deps mentioned in code (e.g. requests, deep-translator, tinytuya)
3. Restart Mark LIII — discover_plugins() auto-discovers it
4. Enable/disable via ⚙ → Plugin Manager (stored in config/api_keys.json plugin_enabled)
5. Configure via ⚙ → Settings if PLUGIN_SETTINGS defined

**Best practices applied:**
- Name regex valid ^[a-zA-Z_][a-zA-Z0-9_]{0,63}$
- Description explicit for Gemini routing
- Parameters type OBJECT with STRING types
- run() signature with player + session_memory optional
- Try/except never raises, returns spoken error
- player.write_log() for activity log
- Returns short natural string

**Next steps:** Replace TODO logic with real implementation. For API plugins, add PLUGIN_SETTINGS with api_key field and use get_plugin_config(namespace) via memory/config_manager.

Ask expert for specific implementation help!
`.trim();

  return { code, explanation };
}

export const MARK_LIII_QUICK_PROMPTS = [
  "How do I install Mark LIII?",
  "How to create a plugin?",
  "List all actions and what they do",
  "Explain the memory system",
  "How does wake word work?",
  "How does audio device picker work?",
  "What is self-describing skills?",
  "How to handle undo?",
  "Explain prompt.txt rules",
  "How does web search work with news mode?",
  "How to capture screen and camera?",
  "How to generate a weather plugin?",
  "What needs confirmation?",
  "Troubleshoot microphone not working",
];
