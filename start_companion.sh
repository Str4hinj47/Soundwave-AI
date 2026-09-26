#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Soundwave Companion — your computer's little buddy
#  Taby-style desktop agent (chat, tasks, notes, habits, focus, calendar)
# ─────────────────────────────────────────────────────────────────────────────
set -e
cd "$(dirname "$0")"

if [ ! -d desktop/node_modules ]; then
  echo "[Companion] Installing desktop dependencies (first run)…"
  (cd desktop && npm install)
fi

if [ "$1" = "--electron" ] || [ "$1" = "-e" ]; then
  echo "[Companion] Starting desktop app (Vite + Electron)…"
  cd desktop && npm run electron:dev
else
  echo "[Companion] Starting companion UI on http://localhost:5174"
  echo "            (hover the top edge to drop the panel down, Esc to hide)"
  echo "            pass --electron to run it as a real desktop window"
  cd desktop && npm run dev
fi
