# Soundwave Companion

**Your computer's little buddy** — a Taby-style desktop agent for Soundwave AI.

While the **content generation platform stays on the web** (`/frontend` — voice
studio, subtitle editor, video compositor, projects), the *agent* now lives on
your desktop as a drop-down companion, exactly like [heytaby.com](https://www.heytaby.com):

```
 ┌──────────────── screen top ────────────────┐
 │          ╭─────────────────────╮           │
 │          │  ◐ Soundwave  LOCAL │           │
 │          ├──────┬──────────────┤           │
 │          │      │  Today       │           │
 │          │ rail │  Chat        │           │
 │          │      │  Tasks       │           │
 │          │      │  Notes       │           │
 │          │      │  Focus       │           │
 │          │      │  Habits      │           │
 │          │      │  Calendar    │           │
 │          │      │  Settings    │           │
 │          ╰──────┴──────────────╯           │
 └────────────────────────────────────────────┘
```

## What it does

| Area | Details |
| --- | --- |
| **Buddy** | `Echo`, an animated face that blinks, listens, thinks and reacts to your day |
| **Chat** | On-device intent engine + optional bigger “Soundwave Cloud” brain (`/api/v1/agent/chat`) |
| **Tasks** | Quick capture, due dates, overdue/today/upcoming groups, “plan my day” |
| **Notes** | Quick capture + search + full editor — say `note …` to Echo |
| **Habits** | Streaks, 7-day check grid, emoji markers |
| **Focus** | Pomodoro ring (15/25/50 + 5-min break), session log, spoken completions |
| **Calendar** | Local month grid, events, `add meeting … at 4pm` by voice or chat |
| **Today** | Greeting, next-up, day plan, habit strip, 7-day activity bars |
| **Personalities** | Echo · Butler · Bro · Anime · Coach · Chill (switchable by voice) |
| **Voice** | Mic input (Web Speech), spoken replies (system voice or neural Edge TTS) |
| **Privacy** | Tasks/notes/habits/calendar are stored **locally** — never leave the machine |
| **Onboarding** | Language → Look → Microphone → Brain, the same five-step first run as Taby |

### Like Taby, it behaves like a real desktop buddy

- Hangs from the **top center of the screen** and drops down / tucks away
- **Hover the top edge** of the screen to reveal it; move away and it hides
- Global shortcut **Ctrl + Alt + Space** (Cmd + Option + Space on macOS)
- Tray menu (Show / Hide / Quit), no dock icon, skips the taskbar
- Frameless, transparent, always-on-top window

## Run it

```bash
cd desktop
npm install

# 1) UI in the browser (fake desktop preview, hotkey + hover simulated)
npm run dev                # http://localhost:5174

# 2) The real desktop app (Electron)
npm run electron:dev       # Vite + Electron together
```

From the repo root you can also use `./start_companion.sh` (macOS/Linux) or
`start_companion.bat` (Windows) — add `--electron` for the desktop window.

Or through the existing Python agent: `python soundwave_agent.py --companion`.

## Package installers

```bash
npm run dist:win     # Windows NSIS  → release/
npm run dist:mac     # macOS DMG     → release/
npm run dist:linux   # AppImage      → release/
```

## Wiring

- The renderer proxies `/api` → `http://localhost:4000` (the Soundwave API),
  same as the web app. Start it with `cd server && npm run dev`.
- **Local brain** (default) is fully offline. **Soundwave Cloud** unlocks
  scripts, 1-click shorts, neural voice, weather and workstation commands.
- **Settings → Web platform URL** points the workspace buttons at your
  content studio (default `http://localhost:5173`).

## Layout

```
desktop/
├── electron/main.cjs      # top-edge hover, slide animation, shortcut, tray
├── electron/preload.cjs   # safe bridge (hide / quit / openExternal)
├── scripts/electron-dev.mjs
├── build/icon.png
└── src/
    ├── App.tsx            # fake desktop + drop-down panel (browser mode)
    ├── store.ts           # zustand + persistence (local-first)
    ├── components/
    │   ├── BuddyFace.tsx  # the animated face
    │   ├── Panel.tsx      # window chrome + left rail
    │   ├── Onboarding.tsx # 5-step first run
    │   └── views/         # Today, Chat, Tasks, Notes, Focus, Habits, Calendar, Settings
    └── lib/
        ├── brain.ts       # local intent engine + personalities
        ├── cloudBrain.ts  # /api/v1/agent/chat + /speak
        ├── schedule.ts    # plan-my-day engine
        └── voice.ts       # Web Speech STT + TTS
```
