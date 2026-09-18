@echo off
title Soundwave AI Suite Launcher
echo =================================================================
echo   🌊 Starting Soundwave AI Studio & Autonomous Agent
echo =================================================================

:: Check for Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please download and install Node.js 20+ from https://nodejs.org
    pause
    exit /b 1
)

:: Check for Python
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Python is not in PATH. Desktop agent requires Python 3.10+.
)

:: Prepare server .env if missing
if not exist server\.env (
    echo [INFO] Creating server\.env from .env.example...
    copy server\.env.example server\.env >nul
)

:: Ensure DATABASE_URL is disabled for zero-infra local JSON store (no postgres needed)
powershell -Command "if (Test-Path 'server\.env') { (Get-Content 'server\.env') -replace '^DATABASE_URL=postgresql:', '#DATABASE_URL=postgresql:' | Set-Content 'server\.env' }"

:: Install server dependencies if needed
if not exist server\node_modules (
    echo [INFO] Installing server dependencies...
    cd server && call npm install && cd ..
)

:: Install frontend dependencies if needed
if not exist frontend\node_modules (
    echo [INFO] Installing frontend dependencies...
    cd frontend && call npm install && cd ..
)

:: Start Backend API Server in a new window
echo [INFO] Starting Backend API Server on http://localhost:4000 ...
start "Soundwave API Server" cmd /k "cd server && npm run dev"

:: Wait 3 seconds for server startup
timeout /t 3 /nobreak >nul

:: Start Frontend Vite Dev Server in a new window
echo [INFO] Starting Frontend Studio on http://localhost:5173 ...
start "Soundwave Frontend Studio" cmd /k "cd frontend && npm run dev"

:: Wait 3 seconds
timeout /t 3 /nobreak >nul

:: Open browser directly to Soundwave Agent Hub
echo [INFO] Opening Soundwave Agent in your default browser...
start http://localhost:5173/agent

echo =================================================================
echo   🎉 Soundwave AI is now running!
echo   - Web Studio & Agent Hub: http://localhost:5173/agent
echo   - Backend API: http://localhost:4000
echo
echo   To launch the Standalone Python Desktop Agent & HUD:
echo   Run in terminal: python soundwave_agent.py --gui
echo =================================================================
pause
