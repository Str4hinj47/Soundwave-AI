# Soundwave AI — Autonomous Shorts & Voice Agent

**Autonomous, high-retention vertical video (Shorts, TikTok, Reels) generator and voice assistant.**

100% original, clean-room implementation. Commercial-grade and ready to sell with full commercial rights under the MIT License.

---

## Highlights

- **No Weird 3D Face Avatar**: Replaced with the sleek, modern **Soundwave Reactive HUD** (acoustic waveform visualizer with pulsating cyber ring, zero graphics driver dependencies).
- **2026 Viral Engine**: 7 proven high-performing niches (Psychology, Mind-Bending Facts, Untold History, Money & Wealth, AI & Future Tech, Deep Motivation, Cosmic Horror) using research-backed hooks (Did you know, Only 1% know, 3 mistakes, You're doing X wrong, Curiosity loops).
- **1-Click Pipeline**: Generates scripts → narrates it in a Soundwave voice (Microsoft neural: Guy, Christopher, Ryan, Jenny, Ana or Sonia) → aligns dynamic word-level TikTok #8B5CF6 subtitles → composites an Orbital NCG gameplay background (an unused video from youtube.com/@OrbitalNCG, imported via the YouTube link importer) → exports 9:16 vertical video with FFmpeg.
- **Fresh Backgrounds, Never Reused**: Every short gets an Orbital NCG video the agent hasn't used before. Its link is pasted into the YouTube link importer, which imports only the gameplay the short needs. The history lives on the server (`GET /api/v1/agent/orbital`) and can be reset from the Agent Hub or the CLI menu.
- **Batch Production**: Create all 7 niches with a single command.
- **Live HTML Progress Monitor**: Auto-refreshing 2s progress dashboard with step-by-step indicators, audio preview, and direct download links.

---

## Quick Start

### 1. Requirements
- Python 3.10+
- Running Soundwave AI backend (`cd server && npm run dev` on port 4000)

### 2. Command Line Usage

```bash
# Check status & Orbital NCG background history
python soundwave-agent/main.py --status

# Generate a single viral short
python soundwave-agent/main.py --niche psychology

# Batch generate all 7 niches
python soundwave-agent/main.py --batch

# Launch the desktop reactive HUD visualizer
python soundwave-agent/main.py --gui

# Interactive CLI menu
python soundwave-agent/main.py
```

### 3. Output
Generated videos are saved directly to your `Downloads/` or `exports/` folder as `soundwave_<niche>_<timestamp>.mp4`.
