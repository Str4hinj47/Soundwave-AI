@echo off
title Soundwave Companion — your computer's little buddy
cd /d "%~dp0"

if not exist desktop\node_modules (
    echo [Companion] Installing desktop dependencies ^(first run^)...
    pushd desktop
    call npm install
    popd
)

if /i "%1"=="--electron" (
    echo [Companion] Starting desktop app ^(Vite + Electron^)...
    pushd desktop
    call npm run electron:dev
    popd
) else (
    echo [Companion] Starting companion UI on http://localhost:5174
    echo             Hover the top edge to drop the panel down, Esc to hide.
    echo             Pass --electron to run it as a real desktop window.
    pushd desktop
    call npm run dev
    popd
)
