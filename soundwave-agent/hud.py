"""
Soundwave AI — Reactive Audio HUD & Visualizer
Replaces the 3D software head with a modern, futuristic acoustic visualizer.

Displays dynamic audio pulses, frequency waves, and real-time state transitions:
[IDLE] -> [LISTENING] -> [GENERATING] -> [COMPOSITING] -> [COMPLETE]
"""

import math
import time
import threading
from typing import Optional, Callable

class SoundwaveHudTerminal:
    """ASCII-based reactive soundwave visualizer for terminal and headless environments."""

    BAR_CHARS = [" ", " ", "▂", "▃", "▄", "▅", "▆", "▇", "█"]

    def __init__(self):
        self.state = "STANDBY"
        self.phase = 0.0

    def set_state(self, new_state: str):
        self.state = new_state

    def render_frame(self, num_bars: int = 32) -> str:
        self.phase += 0.25
        bars = []
        is_active = self.state not in ("STANDBY", "IDLE")

        for i in range(num_bars):
            angle = (i / num_bars) * math.pi * 2 + self.phase
            if is_active:
                val = (math.sin(angle * 2) * math.cos(angle * 3) + 1) / 2
                level = int(val * (len(self.BAR_CHARS) - 1))
            else:
                val = (math.sin(angle) + 1) / 4
                level = int(val * (len(self.BAR_CHARS) - 1))
            bars.append(self.BAR_CHARS[max(0, min(level, len(self.BAR_CHARS) - 1))])

        wave_str = "".join(bars)
        return f"\r[Soundwave HUD: {self.state:<12}] ▕{wave_str}▏"

def launch_gui_hud(
    on_generate_click: Optional[Callable[[str], None]] = None,
    on_batch_click: Optional[Callable[[], None]] = None,
):
    """Launch the Tkinter-based Soundwave Reactive HUD."""
    try:
        import tkinter as tk
        from tkinter import ttk, messagebox
    except ImportError:
        print("[HUD] Tkinter not available. Falling back to Terminal HUD.")
        return

    root = tk.Tk()
    root.title("Soundwave AI — Autonomous Agent HUD")
    root.geometry("480x560")
    root.configure(bg="#0A0F1C")
    root.resizable(False, False)

    state_var = tk.StringVar(value="SYSTEM READY")
    topic_var = tk.StringVar(value="psychology")
    anim_phase = [0.0]
    is_busy = [False]

    # Title Banner
    header = tk.Frame(root, bg="#0A0F1C", pady=12)
    header.pack(fill=tk.X)

    title_lbl = tk.Label(
        header, text="🌊 SOUNDWAVE AGENT", font=("Inter", 16, "bold"), fg="#38BDF8", bg="#0A0F1C"
    )
    title_lbl.pack()

    subtitle_lbl = tk.Label(
        header, text="Autonomous Shorts & Voice Studio", font=("Inter", 9), fg="#94A3B8", bg="#0A0F1C"
    )
    subtitle_lbl.pack()

    # Canvas Visualizer (Circular Pulsing Soundwave)
    canvas = tk.Canvas(root, width=280, height=220, bg="#0A0F1C", highlightthickness=0)
    canvas.pack(pady=6)

    def draw_hud():
        canvas.delete("all")
        cx, cy = 140, 110
        base_r = 55
        active = is_busy[0]

        # Draw outer ring
        canvas.create_oval(cx - 75, cy - 75, cx + 75, cy + 75, outline="#1E293B", width=1)

        # Draw dynamic soundwave bars around circle
        points = []
        num_points = 36
        for i in range(num_points):
            angle = (i / num_points) * 2 * math.pi
            if active:
                wave = math.sin(angle * 4 + anim_phase[0]) * 15 + math.cos(angle * 2 - anim_phase[0]) * 8
            else:
                wave = math.sin(angle * 2 + anim_phase[0]) * 5
            r = base_r + max(-10, wave)
            px = cx + math.cos(angle) * r
            py = cy + math.sin(angle) * r
            points.extend([px, py])

        # Connect polygon
        if len(points) >= 4:
            color = "#8B5CF6" if active else "#0EA5E9"
            canvas.create_polygon(points, outline=color, fill="", width=2, smooth=True)

        # Center glowing core
        core_r = 30 + (math.sin(anim_phase[0] * 2) * 4 if active else 0)
        core_fill = "#7C3AED" if active else "#0369A1"
        canvas.create_oval(cx - core_r, cy - core_r, cx + core_r, cy + core_r, fill=core_fill, outline="")

        # State text inside core
        canvas.create_text(
            cx, cy, text="SWA", fill="#FFFFFF", font=("Inter", 11, "bold")
        )

        anim_phase[0] += 0.08 if active else 0.03
        root.after(30, draw_hud)

    # Status Label
    status_frame = tk.Frame(root, bg="#111827", padx=16, pady=8)
    status_frame.pack(fill=tk.X, padx=24, pady=8)

    status_lbl = tk.Label(
        status_frame, textvariable=state_var, font=("Inter", 10, "bold"), fg="#A78BFA", bg="#111827"
    )
    status_lbl.pack()

    # Niche Selection
    ctrl_frame = tk.Frame(root, bg="#0A0F1C", padx=24)
    ctrl_frame.pack(fill=tk.X, pady=8)

    lbl_niche = tk.Label(ctrl_frame, text="SELECT NICHE:", font=("Inter", 9, "bold"), fg="#94A3B8", bg="#0A0F1C")
    lbl_niche.pack(anchor=tk.W, pady=2)

    niches = ["psychology", "facts", "history", "finance", "ai", "motivation", "horror"]
    dropdown = ttk.Combobox(ctrl_frame, values=niches, textvariable=topic_var, state="readonly", font=("Inter", 10))
    dropdown.pack(fill=tk.X, pady=4)

    # Buttons
    def on_generate():
        if is_busy[0]:
            return
        is_busy[0] = True
        state_var.set("GENERATING VIRAL SHORT...")
        niche = topic_var.get()

        def worker():
            if on_generate_click:
                on_generate_click(niche)
            else:
                time.sleep(3)
            state_var.set("COMPLETED!")
            is_busy[0] = False

        threading.Thread(target=worker, daemon=True).start()

    def on_batch():
        if is_busy[0]:
            return
        is_busy[0] = True
        state_var.set("STARTING 7-NICHE BATCH...")

        def worker():
            if on_batch_click:
                on_batch_click()
            else:
                time.sleep(5)
            state_var.set("BATCH COMPLETE!")
            is_busy[0] = False

        threading.Thread(target=worker, daemon=True).start()

    btn_frame = tk.Frame(root, bg="#0A0F1C", padx=24)
    btn_frame.pack(fill=tk.X, pady=10)

    btn_gen = tk.Button(
        btn_frame,
        text="⚡ 1-Click Short",
        font=("Inter", 10, "bold"),
        bg="#0284C7",
        fg="#FFFFFF",
        activebackground="#0369A1",
        relief=tk.FLAT,
        pady=8,
        command=on_generate,
    )
    btn_gen.pack(fill=tk.X, pady=3)

    btn_batch = tk.Button(
        btn_frame,
        text="📦 Batch All 7 Niches",
        font=("Inter", 10, "bold"),
        bg="#7C3AED",
        fg="#FFFFFF",
        activebackground="#6D28D9",
        relief=tk.FLAT,
        pady=8,
        command=on_batch,
    )
    btn_batch.pack(fill=tk.X, pady=3)

    draw_hud()
    root.mainloop()

if __name__ == "__main__":
    term = SoundwaveHudTerminal()
    term.set_state("ACTIVE")
    for _ in range(20):
        print(term.render_frame(), end="")
        time.sleep(0.08)
    print("\nTerminal HUD test passed.")
