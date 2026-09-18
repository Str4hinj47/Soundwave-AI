#!/usr/bin/env bash
set -e

echo "================================================================="
echo "  🌊 Starting Soundwave AI Studio & Autonomous Agent"
echo "================================================================="

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed!"
    echo "Please install Node.js 20+ from https://nodejs.org"
    exit 1
fi

# Prepare server/.env
if [ ! -f server/.env ]; then
    echo "[INFO] Creating server/.env..."
    cp server/.env.example server/.env
    # disable postgres by default for zero-infra json store
    sed -i.bak 's/^DATABASE_URL=/#DATABASE_URL=/' server/.env 2>/dev/null || true
fi

# Install dependencies if missing
if [ ! -d server/node_modules ]; then
    echo "[INFO] Installing server dependencies..."
    (cd server && npm install)
fi

if [ ! -d frontend/node_modules ]; then
    echo "[INFO] Installing frontend dependencies..."
    (cd frontend && npm install)
fi

echo "[INFO] Starting Backend API Server (port 4000)..."
(cd server && npm run dev) &
SERVER_PID=$!

sleep 3

echo "[INFO] Starting Frontend Web Studio (port 5173)..."
(cd frontend && npm run dev) &
FRONTEND_PID=$!

sleep 3

echo ""
echo "================================================================="
echo "  🎉 Soundwave AI is running!"
echo "  - Web Studio & Agent Hub: http://localhost:5173/agent"
echo "  - Backend API: http://localhost:4000"
echo ""
echo "  To launch the Standalone Python Desktop HUD:"
echo "  python3 soundwave_agent.py --gui"
echo "================================================================="

trap "kill $SERVER_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
