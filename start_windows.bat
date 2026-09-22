@echo off
setlocal enabledelayedexpansion
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

:: Ensure vendor\ffmpeg directory exists
if not exist vendor\ffmpeg mkdir vendor\ffmpeg

:: Check for FFmpeg: check PATH, vendor\ffmpeg\ffmpeg.exe, or auto-install
set FFMPEG_FOUND=0
where ffmpeg >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set FFMPEG_FOUND=1
    echo [INFO] FFmpeg detected on system PATH.
) else (
    if exist vendor\ffmpeg\ffmpeg.exe (
        set FFMPEG_FOUND=1
        set "PATH=%CD%\vendor\ffmpeg;!PATH!"
        set "FFMPEG_PATH=%CD%\vendor\ffmpeg\ffmpeg.exe"
        echo [INFO] Using vendored FFmpeg at vendor\ffmpeg\ffmpeg.exe.
    ) else (
        echo [INFO] FFmpeg was not detected on PATH or in vendor\ffmpeg.
        echo [INFO] Attempting automatic FFmpeg installation for Windows...
        
        where winget >nul 2>&1
        if %ERRORLEVEL% EQU 0 (
            echo [INFO] Installing FFmpeg via winget (Gyan.FFmpeg)...
            winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements --silent
            if exist "%LOCALAPPDATA%\Microsoft\WinGet\Links\ffmpeg.exe" (
                set "PATH=%LOCALAPPDATA%\Microsoft\WinGet\Links;!PATH!"
                set "FFMPEG_PATH=%LOCALAPPDATA%\Microsoft\WinGet\Links\ffmpeg.exe"
                set FFMPEG_FOUND=1
            )
        )

        where ffmpeg >nul 2>&1
        if %ERRORLEVEL% EQU 0 (
            set FFMPEG_FOUND=1
        ) else if not "!FFMPEG_FOUND!"=="1" (
            echo [INFO] Downloading portable FFmpeg for Windows...
            powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { $zip = 'vendor\ffmpeg.zip'; Invoke-WebRequest -Uri 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' -OutFile $zip; Expand-Archive $zip -DestinationPath 'vendor\ffmpeg_tmp' -Force; $bin = (Get-ChildItem -Path 'vendor\ffmpeg_tmp' -Filter 'ffmpeg.exe' -Recurse | Select-Object -First 1).FullName; Copy-Item $bin -Destination 'vendor\ffmpeg\ffmpeg.exe'; Remove-Item -Recurse -Force $zip, 'vendor\ffmpeg_tmp'; Write-Host '[SUCCESS] FFmpeg installed to vendor\ffmpeg\ffmpeg.exe' } catch { Write-Warning ('Download failed: ' + $_.Exception.Message) }"
            if exist vendor\ffmpeg\ffmpeg.exe (
                set "PATH=%CD%\vendor\ffmpeg;!PATH!"
                set "FFMPEG_PATH=%CD%\vendor\ffmpeg\ffmpeg.exe"
                set FFMPEG_FOUND=1
            )
        )
    )
)

if not "!FFMPEG_FOUND!"=="1" (
    echo [WARNING] FFmpeg is required for video export and audio conversion.
    echo To install manually, open PowerShell and run: winget install ffmpeg
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

:: Pass FFMPEG_PATH to the child command shell if found
if defined FFMPEG_PATH (
    echo [INFO] Setting FFMPEG_PATH=!FFMPEG_PATH!
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
