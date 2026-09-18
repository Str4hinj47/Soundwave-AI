@echo off
title Soundwave AI — Desktop HUD
cd /d "%~dp0"
echo Starting Soundwave AI Desktop Reactive HUD...
python soundwave_agent.py --gui
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo If Python is not recognized, make sure Python 3.10+ is installed from python.org
    echo and that "Add Python to PATH" was checked during installation.
    pause
)
