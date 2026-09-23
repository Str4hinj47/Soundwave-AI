@echo off
title Soundwave AI Suite Launcher
echo =================================================================
echo   Waves Starting Soundwave AI Studio and Autonomous Agent
echo =================================================================

:: Check for Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please download and install Node.js 20+ from https://nodejs.org
    pause
    exit /b 1
)

:: Check for Python (optional)
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Python is not in PATH. Desktop agent requires Python 3.10+.
) else (
    where pip >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo [INFO] Verifying Python dependencies for YouTube Parkour Clipper...
        pip install -r requirements.txt --quiet
    )
)

:: Ensure vendor\ffmpeg directory exists
if not exist vendor\ffmpeg mkdir vendor\ffmpeg

:: Detect FFmpeg
where ffmpeg >nul 2>&1
if %ERRORLEVEL% EQU 0 goto :ffmpeg_ready

if exist vendor\ffmpeg\ffmpeg.exe goto :ffmpeg_vendored

:: FFmpeg missing on PATH and vendor - check WinGet Links folder
if exist "%LOCALAPPDATA%\Microsoft\WinGet\Links\ffmpeg.exe" (
    set "PATH=%LOCALAPPDATA%\Microsoft\WinGet\Links;%PATH%"
    set "FFMPEG_PATH=%LOCALAPPDATA%\Microsoft\WinGet\Links\ffmpeg.exe"
    goto :ffmpeg_ready
)

:: Try installing via winget if available
echo [INFO] FFmpeg not found on system PATH. Attempting automatic installation...
where winget >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Installing FFmpeg via winget...
    winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements --silent
)

:: Check again after winget
where ffmpeg >nul 2>&1
if %ERRORLEVEL% EQU 0 goto :ffmpeg_ready

if exist "%LOCALAPPDATA%\Microsoft\WinGet\Links\ffmpeg.exe" (
    set "PATH=%LOCALAPPDATA%\Microsoft\WinGet\Links;%PATH%"
    set "FFMPEG_PATH=%LOCALAPPDATA%\Microsoft\WinGet\Links\ffmpeg.exe"
    goto :ffmpeg_ready
)

:: Download standalone portable ffmpeg.exe via clean PowerShell script
if exist scripts\download_ffmpeg.ps1 (
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\download_ffmpeg.ps1
)

if exist vendor\ffmpeg\ffmpeg.exe goto :ffmpeg_vendored

echo [WARNING] FFmpeg was not detected. Video export may require manual install: winget install ffmpeg
goto :continue_boot

:ffmpeg_vendored
set "PATH=%CD%\vendor\ffmpeg;%PATH%"
set "FFMPEG_PATH=%CD%\vendor\ffmpeg\ffmpeg.exe"
echo [INFO] Using vendored FFmpeg at vendor\ffmpeg\ffmpeg.exe.

:ffmpeg_ready
echo [INFO] FFmpeg is ready.

:: Check for yt-dlp
where yt-dlp >nul 2>&1
if %ERRORLEVEL% EQU 0 goto :ytdlp_ready

if exist vendor\yt-dlp\yt-dlp.exe goto :ytdlp_vendored

:: Download standalone portable yt-dlp.exe via PowerShell script
if exist scripts\download_ytdlp.ps1 (
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\download_ytdlp.ps1
)

if exist vendor\yt-dlp\yt-dlp.exe goto :ytdlp_vendored
goto :continue_boot

:ytdlp_vendored
set "PATH=%CD%\vendor\yt-dlp;%PATH%"
set "YTDLP_PATH=%CD%\vendor\yt-dlp\yt-dlp.exe"
echo [INFO] Using vendored yt-dlp at vendor\yt-dlp\yt-dlp.exe.

:ytdlp_ready
echo [INFO] yt-dlp is ready.

:continue_boot
:: Prepare server .env if missing
if not exist server\.env (
    echo [INFO] Creating server\.env from .env.example...
    copy server\.env.example server\.env >nul
)

:: Ensure DATABASE_URL is disabled for zero-infra local JSON store (no postgres needed)
powershell -NoProfile -Command "if (Test-Path 'server\.env') { (Get-Content 'server\.env') -replace '^DATABASE_URL=postgresql:', '#DATABASE_URL=postgresql:' | Set-Content 'server\.env' }"

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
echo   Soundwave AI is now running!
echo   - Web Studio and Agent Hub: http://localhost:5173/agent
echo   - Backend API: http://localhost:4000
echo
echo   To launch the Standalone Python Desktop Agent and HUD:
echo   Run in terminal: python soundwave_agent.py --gui
echo =================================================================
pause
