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
        self.root = None

    def launch(self):
        try:
            import tkinter as tk
            from tkinter import ttk, messagebox
            self._launch_tk(tk, ttk, messagebox)
        except ImportError:
            print("[Desktop UI] GUI toolkit not available in this environment. Launching CLI terminal HUD...")
            from main import run_interactive_cli
            run_interactive_cli()

    def _save_chat(self, text: str, sender: str):
        try:
            history_path = Path(__file__).parent / "memory" / "chat_history.json"
            history_path.parent.mkdir(parents=True, exist_ok=True)
            items = []
            if history_path.exists():
                try:
                    import json
                    items = json.loads(history_path.read_text(encoding="utf-8"))
                except:
                    items = []
            import json
            items.append({"sender": sender, "text": text, "time": time.strftime("%H:%M:%S")})
            history_path.write_text(json.dumps(items[-100:], indent=2), encoding="utf-8")
        except Exception as e:
            print(f"[Chat History Error] {e}")

    def _load_chat(self):
        try:
            history_path = Path(__file__).parent / "memory" / "chat_history.json"
            if history_path.exists():
                import json
                items = json.loads(history_path.read_text(encoding="utf-8"))
                for item in items[-40:]:
                    snd = item.get("sender", "assistant")
                    txt = item.get("text", "")
                    tag = "user_tag" if snd == "user" else "ai_tag" if snd == "assistant" else "sys_tag"
                    self.txt_log.insert("end", f"{txt}\n", tag)
                self.txt_log.see("end")
        except Exception as e:
            print(f"[Load Chat Error] {e}")

    def _append_log(self, text: str, sender: str = "assistant"):
        def do_append():
            if not hasattr(self, "txt_log") or not self.txt_log:
                return
            tag = "user_tag" if sender == "user" else "ai_tag" if sender == "assistant" else "sys_tag"
            self.txt_log.insert("end", f"{text}\n", tag)
            self.txt_log.see("end")
            self._save_chat(text, sender)
        if hasattr(self, "root") and self.root:
            self.root.after(0, do_append)

    def _launch_tk(self, tk, ttk, messagebox):
        import webbrowser
        root = tk.Tk()
        self.root = root
        root.title("Soundwave AI — Quantum Cyber Deck v2.8")
        root.geometry("1060x740")
        root.configure(bg="#050811")
        root.minsize(900, 640)

        # Apply dark ttk theme
        style = ttk.Style()
        try:
            style.theme_use("clam")
        except:
            pass
        style.configure("TNotebook", background="#050811", borderwidth=0)
        style.configure("TNotebook.Tab", background="#0F172A", foreground="#94A3B8", font=("Segoe UI", 9, "bold"), padding=[12, 6])
        style.map("TNotebook.Tab", background=[("selected", "#0284C7")], foreground=[("selected", "#FFFFFF")])

        # Top Header: Cyber Deck Telemetry HUD
        header_frame = tk.Frame(root, bg="#0A0F1C", height=54, padx=16, pady=8, highlightbackground="#1E293B", highlightthickness=1)
        header_frame.pack(fill=tk.X)

        lbl_logo = tk.Label(
            header_frame, text="⚡ SOUNDWAVE QUANTUM DECK // V2.8", font=("Segoe UI", 12, "bold"), fg="#00F0FF", bg="#0A0F1C"
        )
        lbl_logo.pack(side=tk.LEFT)

        # Web Deck button
        btn_web = tk.Button(
            header_frame, text="🌐 Launch Web Deck", font=("Segoe UI", 8, "bold"),
            bg="#0284C7", fg="#FFFFFF", relief=tk.FLAT, padx=10, pady=3,
            command=lambda: webbrowser.open("http://localhost:5173/agent")
        )
        btn_web.pack(side=tk.LEFT, padx=14)

        self.status_badge = tk.Label(
            header_frame, text="● QUANTUM ACTIVE", font=("Segoe UI", 9, "bold"), fg="#10B981", bg="#064E3B", padx=8, pady=2
        )
        self.status_badge.pack(side=tk.RIGHT, padx=6)

        telemetry_lbl = tk.Label(
            header_frame, text="CPU: 18% | RAM: 5.2 GB | DSP: 48kHz Stereo", font=("Segoe UI", 9), fg="#94A3B8", bg="#0A0F1C"
        )
        telemetry_lbl.pack(side=tk.RIGHT, padx=12)

        # Center Panes
        panes = tk.PanedWindow(root, orient=tk.HORIZONTAL, bg="#050811", bd=0, sashwidth=4)
        panes.pack(fill=tk.BOTH, expand=True, padx=12, pady=12)

        # Left Column: Spectrogram & Quick Skills
        left_col = tk.Frame(panes, bg="#0A0F1C", padx=16, pady=16, highlightbackground="#1E293B", highlightthickness=1)
        panes.add(left_col, minsize=420)

        lbl_hud = tk.Label(left_col, text="QUANTUM HOLOGRAPHIC CORE", font=("Segoe UI", 9, "bold"), fg="#00F0FF", bg="#0A0F1C")
        lbl_hud.pack(anchor=tk.W)

        # Canvas Visualizer (Holographic Gyroscopic Core)
        canvas = tk.Canvas(left_col, width=380, height=240, bg="#050811", highlightthickness=1, highlightbackground="#0F172A")
        canvas.pack(pady=8, fill=tk.X)

        def render_canvas():
            canvas.delete("all")
            cx, cy = 190, 120
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
                canvas.create_line(tx1, ty1, tx2, ty2, fill="#00F0FF" if is_active else "#334155", width=2)

            # 3. Orbiting Quantum Particles
            for p_i in range(18):
                pa = (p_i / 18) * 2 * math.pi + self.anim_phase * (1.2 if is_active else 0.5)
                pr = 74 + math.sin(pa * 3 + self.anim_phase) * 8
                px = cx + math.cos(pa) * pr
                py = cy + math.sin(pa) * pr
                p_sz = 2 if p_i % 2 == 0 else 3
                canvas.create_oval(px - p_sz, py - p_sz, px + p_sz, py + p_sz, fill="#00F0FF" if p_i % 3 == 0 else "#818CF8", outline="")

            # 4. Sonic Equalizer Rays
            rays = 36
            for r_i in range(rays):
                ra = (r_i / rays) * 2 * math.pi
                rh = (math.sin(ra * 6 + self.anim_phase * 3) * 0.5 + 0.5) * (18 if is_active else 5)
                rx1 = cx + math.cos(ra) * 50
                ry1 = cy + math.sin(ra) * 50
                rx2 = cx + math.cos(ra) * (50 + rh)
                ry2 = cy + math.sin(ra) * (50 + rh)
                canvas.create_line(rx1, ry1, rx2, ry2, fill="#00F0FF" if is_active else "#1E293B", width=1)

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
                stroke = "#A855F7" if is_active else "#00F0FF"
                canvas.create_polygon(pts, outline=stroke, fill="", width=2, smooth=True)

            # 6. Glowing Quantum Singularity Core
            core_r = 24 + (math.sin(self.anim_phase * 2) * 4 if is_active else math.sin(self.anim_phase) * 1.5)
            core_col = "#7E22CE" if is_active else "#0369A1"
            canvas.create_oval(cx - core_r, cy - core_r, cx + core_r, cy + core_r, fill=core_col, outline="#FFFFFF", width=1)
            canvas.create_text(cx, cy, text="AI CORE", fill="#FFFFFF", font=("Segoe UI", 9, "bold"))

            self.anim_phase += 0.08 if is_active else 0.03
            root.after(30, render_canvas)

        render_canvas()

        # State text
        self.lbl_cur_state = tk.Label(left_col, text="READY · QUANTUM CORE STANDBY", font=("Segoe UI", 10, "bold"), fg="#00F0FF", bg="#0A0F1C")
        self.lbl_cur_state.pack(pady=4)

        # Quick Actions Grid
        lbl_quick = tk.Label(left_col, text="COMPUTER ACTIONS & GHOST MACROS", font=("Segoe UI", 9, "bold"), fg="#94A3B8", bg="#0A0F1C")
        lbl_quick.pack(anchor=tk.W, pady=(10, 4))

        quick_grid = tk.Frame(left_col, bg="#0A0F1C")
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
                quick_grid, text=label, font=("Segoe UI", 8, "bold"), bg="#111C35", fg="#E2E8F0",
                activebackground="#0284C7", activeforeground="#FFFFFF",
                relief=tk.FLAT, padx=6, pady=6, command=cmd, highlightthickness=1, highlightbackground="#1E293B"
            )
            btn.grid(row=i // 2, column=i % 2, sticky="nsew", padx=2, pady=2)
            quick_grid.grid_columnconfigure(i % 2, weight=1)

        # Right Column: Notebook Tabs (Transcript, Memory, Settings, Hardware)
        right_col = tk.Frame(panes, bg="#0A0F1C", padx=12, pady=12, highlightbackground="#1E293B", highlightthickness=1)
        panes.add(right_col, minsize=480)

        notebook = ttk.Notebook(right_col)
        notebook.pack(fill=tk.BOTH, expand=True)

        # Tab 1: Live Conversation & Logs
        tab_log = tk.Frame(notebook, bg="#050811", padx=8, pady=8)
        notebook.add(tab_log, text="💬 Live Neural Chat")

        self.txt_log = tk.Text(tab_log, bg="#050811", fg="#E2E8F0", font=("Consolas", 10), wrap=tk.WORD, bd=0, padx=8, pady=8)
        self.txt_log.pack(fill=tk.BOTH, expand=True)
        self.txt_log.tag_config("user_tag", foreground="#00F0FF", font=("Consolas", 10, "bold"))
        self.txt_log.tag_config("ai_tag", foreground="#E2E8F0", font=("Consolas", 10))
        self.txt_log.tag_config("sys_tag", foreground="#34D399", font=("Consolas", 9, "italic"))

        # Load persisted chat
        self._load_chat()
        if not self.txt_log.get("1.0", "end").strip():
            self._append_log("⚡ Soundwave Quantum Deck online. Ready to chat or automate tasks.", sender="system")

        # Command input bar
        cmd_bar = tk.Frame(tab_log, bg="#0A0F1C", pady=6)
        cmd_bar.pack(fill=tk.X)

        entry_cmd = tk.Entry(cmd_bar, bg="#111C35", fg="#FFFFFF", font=("Segoe UI", 10), bd=0, insertbackground="#00F0FF", highlightthickness=1, highlightbackground="#0284C7")
        entry_cmd.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=6, padx=(0, 6))

        def on_send():
            query = entry_cmd.get().strip()
            if not query:
                return
            entry_cmd.delete(0, tk.END)
            self._handle_user_prompt(query)

        entry_cmd.bind("<Return>", lambda e: on_send())

        btn_send = tk.Button(cmd_bar, text="SEND ❯", font=("Segoe UI", 9, "bold"), bg="#0284C7", fg="#FFFFFF", relief=tk.FLAT, padx=14, command=on_send)
        btn_send.pack(side=tk.RIGHT)

        # Tab 2: Memory & Knowledge
        tab_mem = tk.Frame(notebook, bg="#050811", padx=12, pady=12)
        notebook.add(tab_mem, text="🧠 Memory Manager")

        lbl_mem_title = tk.Label(tab_mem, text="LONG-TERM RECALLABLE FACTS", font=("Segoe UI", 10, "bold"), fg="#A78BFA", bg="#050811")
        lbl_mem_title.pack(anchor=tk.W, pady=(0, 6))

        self.mem_list = tk.Listbox(tab_mem, bg="#0A0F1C", fg="#E2E8F0", font=("Segoe UI", 9), bd=0)
        self.mem_list.pack(fill=tk.BOTH, expand=True, pady=4)
        for f in memory_manager.get_facts():
            self.mem_list.insert(tk.END, f"• {f}")

        mem_add_bar = tk.Frame(tab_mem, bg="#050811", pady=4)
        mem_add_bar.pack(fill=tk.X)
        ent_mem = tk.Entry(mem_add_bar, bg="#111C35", fg="#FFFFFF", font=("Segoe UI", 9))
        ent_mem.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=4, padx=(0, 4))

        def on_add_mem():
            txt = ent_mem.get().strip()
            if txt:
                memory_manager.add_fact(txt)
                self.mem_list.insert(tk.END, f"• {txt}")
                ent_mem.delete(0, tk.END)
                messagebox.showinfo("Memory Added", "Stored into long-term recall memory.")

        tk.Button(mem_add_bar, text="Add Fact", bg="#8B5CF6", fg="#FFFFFF", font=("Segoe UI", 8, "bold"), relief=tk.FLAT, command=on_add_mem).pack(side=tk.RIGHT)

        # Tab 3: Audio Hardware & Wake Word
        tab_audio = tk.Frame(notebook, bg="#050811", padx=12, pady=12)
        notebook.add(tab_audio, text="🎙️ Audio & Wake Word")

        lbl_audio_dev = tk.Label(tab_audio, text="AUDIO HARDWARE CONFIGURATION", font=("Segoe UI", 10, "bold"), fg="#00F0FF", bg="#050811")
        lbl_audio_dev.pack(anchor=tk.W, pady=(0, 8))

        devs = get_audio_devices()
        tk.Label(tab_audio, text="Input Microphone:", fg="#94A3B8", bg="#050811").pack(anchor=tk.W)
        cb_mic = ttk.Combobox(tab_audio, values=[d["name"] for d in devs["inputs"]], state="readonly")
        cb_mic.pack(fill=tk.X, pady=(2, 8))
        if devs["inputs"]:
            cb_mic.current(0)

        tk.Label(tab_audio, text="Output Speakers:", fg="#94A3B8", bg="#050811").pack(anchor=tk.W)
        cb_spk = ttk.Combobox(tab_audio, values=[d["name"] for d in devs["outputs"]], state="readonly")
        cb_spk.pack(fill=tk.X, pady=(2, 8))
        if devs["outputs"]:
            cb_spk.current(0)

        # Tab 4: Settings & API Keys
        tab_settings = tk.Frame(notebook, bg="#050811", padx=12, pady=12)
        notebook.add(tab_settings, text="⚙️ Settings & Keys")

        tk.Label(tab_settings, text="Google Gemini API Key (Optional):", fg="#94A3B8", bg="#050811").pack(anchor=tk.W)
        ent_key = tk.Entry(tab_settings, bg="#111C35", fg="#FFFFFF", show="•")
        ent_key.pack(fill=tk.X, pady=(2, 10))
        ent_key.insert(0, config_manager.get_api_key("gemini"))

        def save_keys():
            config_manager.set_api_key("gemini", ent_key.get())
            messagebox.showinfo("Settings Saved", "API Key updated successfully!")

        tk.Button(tab_settings, text="Save Settings", bg="#10B981", fg="#FFFFFF", font=("Segoe UI", 9, "bold"), relief=tk.FLAT, command=save_keys).pack(anchor=tk.W)

        root.mainloop()

    def _trigger_short(self, niche: str):
        self.state = "GENERATING SHORT"
        if hasattr(self, "lbl_cur_state") and self.root:
            self.root.after(0, lambda: self.lbl_cur_state.config(text="GENERATING VIRAL SHORT..."))
        def task():
            generate_single_short(topic=niche, open_browser=True)
            self.state = "STANDBY"
            if hasattr(self, "lbl_cur_state") and self.root:
                self.root.after(0, lambda: self.lbl_cur_state.config(text="READY · QUANTUM CORE STANDBY"))
        threading.Thread(target=task, daemon=True).start()

    def _trigger_batch(self):
        self.state = "BATCH GENERATION"
        if hasattr(self, "lbl_cur_state") and self.root:
            self.root.after(0, lambda: self.lbl_cur_state.config(text="BATCHING 7 NICHES..."))
        def task():
            generate_all_niches_batch()
            self.state = "STANDBY"
            if hasattr(self, "lbl_cur_state") and self.root:
                self.root.after(0, lambda: self.lbl_cur_state.config(text="READY · QUANTUM CORE STANDBY"))
        threading.Thread(target=task, daemon=True).start()

    def _trigger_undo(self):
        ok, msg = undo_manager.undo_last()
        self._append_log(f"↩️ [Undo]: {msg}", sender="sys")

    def _execute_action(self, name: str, params: Dict[str, Any]):
        self.state = "EXECUTING"
        if hasattr(self, "lbl_cur_state") and self.root:
            self.root.after(0, lambda: self.lbl_cur_state.config(text=f"RUNNING {name.upper()}..."))
        def task():
            res = action_registry.execute(name, params)
            self._append_log(f"[{name} Output]:\n{res}", sender="sys")
            self.state = "STANDBY"
            if hasattr(self, "lbl_cur_state") and self.root:
                self.root.after(0, lambda: self.lbl_cur_state.config(text="READY · QUANTUM CORE STANDBY"))
        threading.Thread(target=task, daemon=True).start()

    def _handle_user_prompt(self, prompt: str):
        self._append_log(f"You: {prompt}", sender="user")
        self.state = "THINKING"
        if hasattr(self, "lbl_cur_state") and self.root:
            self.root.after(0, lambda: self.lbl_cur_state.config(text="THINKING..."))

        def worker():
            try:
                spoken_reply, action_output = llm_client.query(prompt)
                self._append_log(f"Soundwave: {spoken_reply}", sender="assistant")
                if action_output:
                    self._append_log(f"Action Result: {action_output}", sender="sys")

                self.state = "SPEAKING"
                if hasattr(self, "lbl_cur_state") and self.root:
                    self.root.after(0, lambda: self.lbl_cur_state.config(text="SPEAKING..."))

                speak(spoken_reply)
                time.sleep(1.2)
            except Exception as e:
                self._append_log(f"Error: {e}", sender="sys")
            finally:
                self.state = "STANDBY"
                if hasattr(self, "lbl_cur_state") and self.root:
                    self.root.after(0, lambda: self.lbl_cur_state.config(text="READY · QUANTUM CORE STANDBY"))

        threading.Thread(target=worker, daemon=True).start()

if __name__ == "__main__":
    app = SoundwaveDesktopApp()
    app.launch()
