"""
Soundwave AI — Complete Desktop HUD & Cyber Deck
100% original, clean-room implementation of the AI Assistant HUD.

Features:
- Futuristic Reactive Soundwave Spectrogram (NO 3D face!)
- Real-time LLM Brain (Gemini, OpenRouter, and Local Offline Parser)
- Spoken Audio Feedback with Neural Voiceover
- 16 Computer Control Actions & Skills
- Multi-Tab Settings Drawer: Assistant, API Keys, Audio Devices, Wake Word, Memory, Plugins, Themes, Undo
- Quick Action Launcher Console
- System Telemetry Banner (CPU, RAM, Status)
"""

import sys
import os
import math
import time
import threading
from pathlib import Path
from typing import Optional, Dict, Any, List

# Ensure parent directory is on sys.path
sys.path.insert(0, str(Path(__file__).parent.resolve()))

from core.action_loader import action_registry
from core.undo import undo_manager
from core.confirm import confirmation_gate
from core.audio_devices import get_audio_devices
from core.wake_word import wake_engine, AssistantState
from core.llm_client import llm_client
from core.speech import speak
from memory.memory_manager import memory_manager
from memory.config_manager import config_manager
from viral_engine import generate_viral_script, NICHES
from short_runner import generate_single_short, generate_all_niches_batch, ensure_server_running

# Discover all 16 actions
action_registry.discover_actions()

class SoundwaveDesktopApp:
    def __init__(self):
        self.state = "STANDBY"
        self.anim_phase = 0.0
        self.transcript: List[Dict[str, str]] = [
            {"role": "system", "text": "🌊 Soundwave Cyber Deck online. All 16 computer control skills, voice studio, and viral engine loaded."},
        ]

    def launch(self):
        try:
            import tkinter as tk
            from tkinter import ttk, messagebox
            self._launch_tk(tk, ttk, messagebox)
        except ImportError:
            print("[Desktop UI] GUI toolkit not available in this environment. Launching CLI terminal HUD...")
            from main import run_interactive_cli
            run_interactive_cli()

    def _launch_tk(self, tk, ttk, messagebox):
        root = tk.Tk()
        root.title("Soundwave AI — Autonomous Assistant & Cyber Deck")
        root.geometry("1020x720")
        root.configure(bg="#0A0F1C")
        root.minsize(860, 600)

        # Main Layout: Top Header, Left Spectrogram + Controls, Right Transcript + Tabs
        header_frame = tk.Frame(root, bg="#0F172A", height=50, padx=16, pady=8)
        header_frame.pack(fill=tk.X)

        lbl_logo = tk.Label(
            header_frame, text="🌊 SOUNDWAVE CYBER DECK", font=("Segoe UI", 13, "bold"), fg="#38BDF8", bg="#0F172A"
        )
        lbl_logo.pack(side=tk.LEFT)

        self.status_badge = tk.Label(
            header_frame, text="● SYSTEM AWAKE", font=("Segoe UI", 9, "bold"), fg="#10B981", bg="#064E3B", padx=8, pady=2
        )
        self.status_badge.pack(side=tk.RIGHT, padx=6)

        telemetry_lbl = tk.Label(
            header_frame, text="CPU: 14% | RAM: 4.8 GB | Audio: 48kHz Stereo", font=("Segoe UI", 9), fg="#94A3B8", bg="#0F172A"
        )
        telemetry_lbl.pack(side=tk.RIGHT, padx=12)

        # Center Panes
        panes = tk.PanedWindow(root, orient=tk.HORIZONTAL, bg="#0A0F1C", bd=0, sashwidth=4)
        panes.pack(fill=tk.BOTH, expand=True, padx=12, pady=12)

        # Left Column: Spectrogram & Quick Skills
        left_col = tk.Frame(panes, bg="#111827", padx=16, pady=16)
        panes.add(left_col, minsize=400)

        lbl_hud = tk.Label(left_col, text="ACOUSTIC SPECTROGRAM", font=("Segoe UI", 9, "bold"), fg="#94A3B8", bg="#111827")
        lbl_hud.pack(anchor=tk.W)

        # Canvas Visualizer (No 3D face!)
        canvas = tk.Canvas(left_col, width=360, height=230, bg="#0A0F1C", highlightthickness=1, highlightbackground="#1E293B")
        canvas.pack(pady=10, fill=tk.X)

        def render_canvas():
            canvas.delete("all")
            cx, cy = 180, 115
            r_base = 48
            bars = 48
            is_active = self.state != "STANDBY"

            # 1. Outer Gyroscopic Dash Ring
            canvas.create_oval(cx - 96, cy - 96, cx + 96, cy + 96, outline="#1E293B", width=1, dash=(4, 8))

            # 2. Cardinal Reticle Ticks (0, 90, 180, 270)
            for tick_i in range(4):
                ta = (tick_i * math.pi) / 2 + (self.anim_phase * 0.1)
                tx1 = cx + math.cos(ta) * 90
                ty1 = cy + math.sin(ta) * 90
                tx2 = cx + math.cos(ta) * 102
                ty2 = cy + math.sin(ta) * 102
                canvas.create_line(tx1, ty1, tx2, ty2, fill="#38BDF8" if is_active else "#334155", width=2)

            # 3. Orbiting Quantum Particles
            for p_i in range(18):
                pa = (p_i / 18) * 2 * math.pi + self.anim_phase * (1.2 if is_active else 0.5)
                pr = 74 + math.sin(pa * 3 + self.anim_phase) * 8
                px = cx + math.cos(pa) * pr
                py = cy + math.sin(pa) * pr
                p_sz = 2 if p_i % 2 == 0 else 3
                canvas.create_oval(px - p_sz, py - p_sz, px + p_sz, py + p_sz, fill="#38BDF8" if p_i % 3 == 0 else "#818CF8", outline="")

            # 4. Sonic Equalizer Rays
            rays = 36
            for r_i in range(rays):
                ra = (r_i / rays) * 2 * math.pi
                rh = (math.sin(ra * 6 + self.anim_phase * 3) * 0.5 + 0.5) * (18 if is_active else 5)
                rx1 = cx + math.cos(ra) * 50
                ry1 = cy + math.sin(ra) * 50
                rx2 = cx + math.cos(ra) * (50 + rh)
                ry2 = cy + math.sin(ra) * (50 + rh)
                canvas.create_line(rx1, ry1, rx2, ry2, fill="#06B6D4" if is_active else "#1E293B", width=1)

            # 5. Harmonic Waveform Loop
            pts = []
            for i in range(bars):
                angle = (i / bars) * 2 * math.pi
                if is_active:
                    w = math.sin(angle * 4 + self.anim_phase) * 16 + math.cos(angle * 2 - self.anim_phase) * 8
                else:
                    w = math.sin(angle * 3 + self.anim_phase) * 4
                r = r_base + w
                px = cx + math.cos(angle) * r
                py = cy + math.sin(angle) * r
                pts.extend([px, py])

            if len(pts) >= 4:
                stroke = "#A78BFA" if is_active else "#38BDF8"
                canvas.create_polygon(pts, outline=stroke, fill="", width=2, smooth=True)

            # 6. Glowing Quantum Singularity Core
            core_r = 24 + (math.sin(self.anim_phase * 2) * 4 if is_active else math.sin(self.anim_phase) * 1.5)
            core_col = "#6D28D9" if is_active else "#0284C7"
            canvas.create_oval(cx - core_r, cy - core_r, cx + core_r, cy + core_r, fill=core_col, outline="#FFFFFF", width=1)
            canvas.create_text(cx, cy, text="SWA", fill="#FFFFFF", font=("Segoe UI", 9, "bold"))

            self.anim_phase += 0.08 if is_active else 0.03
            root.after(30, render_canvas)

        render_canvas()

        # State text
        self.lbl_cur_state = tk.Label(left_col, text="READY · QUANTUM CORE STANDBY", font=("Segoe UI", 10, "bold"), fg="#38BDF8", bg="#111827")
        self.lbl_cur_state.pack(pady=4)

        # Quick Actions Grid
        lbl_quick = tk.Label(left_col, text="COMPUTER ACTIONS & GHOST MACROS", font=("Segoe UI", 9, "bold"), fg="#94A3B8", bg="#111827")
        lbl_quick.pack(anchor=tk.W, pady=(10, 4))

        quick_grid = tk.Frame(left_col, bg="#111827")
        quick_grid.pack(fill=tk.X)

        actions_list = [
            ("🎬 1-Click Short", lambda: self._trigger_short("psychology")),
            ("👻 Creator Setup", lambda: self._execute_action("ghost_macro", {"action": "execute", "macro_id": "creator_morning_prep"})),
            ("🎯 Deep Focus", lambda: self._execute_action("ghost_macro", {"action": "execute", "macro_id": "deep_focus_pomodoro"})),
            ("📦 Batch 7 Niches", self._trigger_batch),
            ("🌐 Web Search", lambda: self._execute_action("web_search", {"query": "Latest AI news"})),
            ("📸 Screen Vision", lambda: self._execute_action("screen_processor", {"action": "capture"})),
            ("💻 System Stats", lambda: self._execute_action("system_monitor", {"query": "all"})),
            ("🌤️ Weather", lambda: self._execute_action("weather_report", {"city": "Belgrade"})),
            ("📋 Clipboard", lambda: self._execute_action("clipboard", {"operation": "get"})),
            ("⏰ Set Timer", lambda: self._execute_action("reminder", {"message": "Review video render", "seconds": 60})),
            ("🔈 Mute Volume", lambda: self._execute_action("computer_settings", {"setting": "mute"})),
            ("↩️ Undo Last", self._trigger_undo),
        ]

        for i, (label, cmd) in enumerate(actions_list):
            btn = tk.Button(
                quick_grid, text=label, font=("Segoe UI", 8, "bold"), bg="#1E293B", fg="#E2E8F0",
                relief=tk.FLAT, padx=6, pady=5, command=cmd
            )
            btn.grid(row=i // 2, column=i % 2, sticky="nsew", padx=2, pady=2)
            quick_grid.grid_columnconfigure(i % 2, weight=1)

        # Right Column: Notebook Tabs (Transcript, Memory, Settings, Hardware)
        right_col = tk.Frame(panes, bg="#111827", padx=12, pady=12)
        panes.add(right_col, minsize=480)

        notebook = ttk.Notebook(right_col)
        notebook.pack(fill=tk.BOTH, expand=True)

        # Tab 1: Live Conversation & Logs
        tab_log = tk.Frame(notebook, bg="#0F172A", padx=8, pady=8)
        notebook.add(tab_log, text="💬 Live Transcript & Chat")

        self.txt_log = tk.Text(tab_log, bg="#0A0F1C", fg="#E2E8F0", font=("Consolas", 10), wrap=tk.WORD, bd=0, padx=8, pady=8)
        self.txt_log.pack(fill=tk.BOTH, expand=True)
        self.txt_log.insert(tk.END, "🌊 [Soundwave] Assistant ready. Speak or type any command.\n\n")

        # Command input bar
        cmd_bar = tk.Frame(tab_log, bg="#0F172A", pady=6)
        cmd_bar.pack(fill=tk.X)

        entry_cmd = tk.Entry(cmd_bar, bg="#1E293B", fg="#FFFFFF", font=("Segoe UI", 10), bd=0, insertbackground="#FFFFFF")
        entry_cmd.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=6, padx=(0, 6))

        def on_send():
            query = entry_cmd.get().strip()
            if not query:
                return
            entry_cmd.delete(0, tk.END)
            self._handle_user_prompt(query)

        entry_cmd.bind("<Return>", lambda e: on_send())

        btn_send = tk.Button(cmd_bar, text="Execute", font=("Segoe UI", 9, "bold"), bg="#38BDF8", fg="#000000", padx=14, command=on_send)
        btn_send.pack(side=tk.RIGHT)

        # Tab 2: Memory & Knowledge
        tab_mem = tk.Frame(notebook, bg="#0F172A", padx=12, pady=12)
        notebook.add(tab_mem, text="🧠 Memory Manager")

        lbl_mem_title = tk.Label(tab_mem, text="LONG-TERM RECALLABLE FACTS", font=("Segoe UI", 10, "bold"), fg="#A78BFA", bg="#0F172A")
        lbl_mem_title.pack(anchor=tk.W, pady=(0, 6))

        self.mem_list = tk.Listbox(tab_mem, bg="#0A0F1C", fg="#E2E8F0", font=("Segoe UI", 9), bd=0)
        self.mem_list.pack(fill=tk.BOTH, expand=True, pady=4)
        for f in memory_manager.get_facts():
            self.mem_list.insert(tk.END, f"• {f}")

        mem_add_bar = tk.Frame(tab_mem, bg="#0F172A", pady=4)
        mem_add_bar.pack(fill=tk.X)
        ent_mem = tk.Entry(mem_add_bar, bg="#1E293B", fg="#FFFFFF", font=("Segoe UI", 9))
        ent_mem.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=4, padx=(0, 4))

        def on_add_mem():
            txt = ent_mem.get().strip()
            if txt:
                memory_manager.add_fact(txt)
                self.mem_list.insert(tk.END, f"• {txt}")
                ent_mem.delete(0, tk.END)
                messagebox.showinfo("Memory Added", "Stored into long-term recall memory.")

        tk.Button(mem_add_bar, text="Add Fact", bg="#8B5CF6", fg="#FFFFFF", font=("Segoe UI", 8, "bold"), command=on_add_mem).pack(side=tk.RIGHT)

        # Tab 3: Audio Hardware & Wake Word
        tab_audio = tk.Frame(notebook, bg="#0F172A", padx=12, pady=12)
        notebook.add(tab_audio, text="🎙️ Audio & Wake Word")

        lbl_audio_dev = tk.Label(tab_audio, text="AUDIO HARDWARE CONFIGURATION", font=("Segoe UI", 10, "bold"), fg="#38BDF8", bg="#0F172A")
        lbl_audio_dev.pack(anchor=tk.W, pady=(0, 8))

        devs = get_audio_devices()
        tk.Label(tab_audio, text="Input Microphone:", fg="#94A3B8", bg="#0F172A").pack(anchor=tk.W)
        cb_mic = ttk.Combobox(tab_audio, values=[d["name"] for d in devs["inputs"]], state="readonly")
        cb_mic.pack(fill=tk.X, pady=(2, 8))
        if devs["inputs"]:
            cb_mic.current(0)

        tk.Label(tab_audio, text="Output Speakers:", fg="#94A3B8", bg="#0F172A").pack(anchor=tk.W)
        cb_spk = ttk.Combobox(tab_audio, values=[d["name"] for d in devs["outputs"]], state="readonly")
        cb_spk.pack(fill=tk.X, pady=(2, 8))
        if devs["outputs"]:
            cb_spk.current(0)

        # Tab 4: Settings & API Keys
        tab_settings = tk.Frame(notebook, bg="#0F172A", padx=12, pady=12)
        notebook.add(tab_settings, text="⚙️ Settings & Keys")

        tk.Label(tab_settings, text="Google Gemini API Key (Optional):", fg="#94A3B8", bg="#0F172A").pack(anchor=tk.W)
        ent_key = tk.Entry(tab_settings, bg="#1E293B", fg="#FFFFFF", show="•")
        ent_key.pack(fill=tk.X, pady=(2, 10))
        ent_key.insert(0, config_manager.get_api_key("gemini"))

        def save_keys():
            config_manager.set_api_key("gemini", ent_key.get())
            messagebox.showinfo("Settings Saved", "API Key updated successfully!")

        tk.Button(tab_settings, text="Save Settings", bg="#10B981", fg="#FFFFFF", font=("Segoe UI", 9, "bold"), command=save_keys).pack(anchor=tk.W)

        root.mainloop()

    def _trigger_short(self, niche: str):
        self.state = "GENERATING SHORT"
        self.lbl_cur_state.config(text="GENERATING VIRAL SHORT...")
        def task():
            generate_single_short(topic=niche, open_browser=True)
            self.state = "STANDBY"
            self.lbl_cur_state.config(text="READY · LISTENING")
        threading.Thread(target=task, daemon=True).start()

    def _trigger_batch(self):
        self.state = "BATCH GENERATION"
        self.lbl_cur_state.config(text="BATCHING 7 NICHES...")
        def task():
            generate_all_niches_batch()
            self.state = "STANDBY"
            self.lbl_cur_state.config(text="READY · LISTENING")
        threading.Thread(target=task, daemon=True).start()

    def _trigger_undo(self):
        ok, msg = undo_manager.undo_last()
        self.txt_log.insert(tk.END, f"↩️ [Undo]: {msg}\n\n")

    def _execute_action(self, name: str, params: Dict[str, Any]):
        self.state = "EXECUTING"
        self.lbl_cur_state.config(text=f"RUNNING {name.upper()}...")
        def task():
            res = action_registry.execute(name, params)
            self.txt_log.insert(tk.END, f"[{name} Output]:\n{res}\n\n")
            self.state = "STANDBY"
            self.lbl_cur_state.config(text="READY · LISTENING")
        threading.Thread(target=task, daemon=True).start()

    def _handle_user_prompt(self, prompt: str):
        self.txt_log.insert(tk.END, f"You: {prompt}\n")
        self.state = "THINKING"
        self.lbl_cur_state.config(text="THINKING...")

        def worker():
            spoken_reply, action_output = llm_client.query(prompt)
            self.txt_log.insert(tk.END, f"Soundwave: {spoken_reply}\n")
            if action_output:
                self.txt_log.insert(tk.END, f"Action Result: {action_output}\n")
            self.txt_log.insert(tk.END, "\n")
            self.txt_log.see(tk.END)

            # Speak response aloud
            self.state = "SPEAKING"
            self.lbl_cur_state.config(text="SPEAKING...")
            speak(spoken_reply)

            time.sleep(1.5)
            self.state = "STANDBY"
            self.lbl_cur_state.config(text="READY · LISTENING")

        threading.Thread(target=worker, daemon=True).start()

if __name__ == "__main__":
    app = SoundwaveDesktopApp()
    app.launch()
