import { Clapperboard, Mic, MessageCircleQuestion, Bot, Cpu, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

/** Soundwave AI — Complete Documentation & Architecture Guide */
export function Help() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Help & Documentation</h1>
        <p className="mt-1 text-sm text-gray-400">
          Everything you need to master Soundwave AI, the Autonomous Viral Shorts Agent, and commercial distribution.
        </p>
      </div>

      <div className="space-y-5">
        {/* Soundwave Agent */}
        <Section icon={<Bot className="h-4 w-4" />} title="Soundwave Agent — Autonomous Viral Shorts">
          <p className="text-sm text-gray-300">
            Soundwave AI includes an integrated <span className="text-cyan-300 font-semibold">Soundwave Agent</span> — an autonomous engine designed to generate high-retention, faceless vertical videos (YouTube Shorts, TikTok, Reels) in one click or automated batches.
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-gray-300">
            <li><strong className="text-white">Research-Backed Hooks:</strong> Built-in 2026 viral hooks (Did you know, Only 1% know, 3 mistakes, You're doing X wrong, Curiosity loop, Contrarian take).</li>
            <li><strong className="text-white">7 Proven Niches:</strong> Psychology & Dark Mind Tricks, Mind-Bending Facts, Untold History, Money & Wealth, AI & Future Tech, Deep Motivation, and Cosmic Horror.</li>
            <li><strong className="text-white">1-Click Full Pipeline:</strong> Script generation → Neural Voiceover (Jenny/Guy/Ryan) → TikTok dynamic #8B5CF6 subtitles → High-FPS Minecraft gameplay background → FFmpeg 9:16 export → Instant download.</li>
            <li><strong className="text-white">Batch Mode:</strong> Single-click generation of all 7 niches simultaneously with automated export tracking.</li>
          </ul>
          <Link to="/agent" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white hover:from-cyan-400 hover:to-violet-500 shadow-md shadow-violet-500/20">
            <Bot className="h-4 w-4" /> Open Soundwave Agent Hub
          </Link>
        </Section>

        {/* Video Compositor */}
        <Section icon={<Clapperboard className="h-4 w-4" />} title="Video Compositing & Dynamic Subtitles">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-gray-300">
            <li><strong className="text-white">TikTok Subtitle Styling:</strong> Auto-synced word cues rendered in bold Montserrat 800 with high-contrast violet backgrounds (#8B5CF6) and dynamic center scaling.</li>
            <li><strong className="text-white">Curated Background Caching:</strong> Pre-sliced 80-second high-resolution Minecraft parkour clips save 80%+ processing time and eliminate repetitive downloads.</li>
            <li><strong className="text-white">Server-Side FFmpeg Engine:</strong> Professional H.264 rendering in 720p or 1080p 60fps vertical format (9:16), fit-to-voice audio duration, and seamless looping.</li>
          </ul>
        </Section>

        {/* Voiceover Studio */}
        <Section icon={<Mic className="h-4 w-4" />} title="Voiceover & Neural TTS Studio">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-gray-300">
            <li><strong className="text-white">Microsoft Neural Voices:</strong> Crystal-clear, zero-lag Edge TTS with natural inflection, adjustable speed, pitch, and word-level alignment.</li>
            <li><strong className="text-white">Voice Cloning:</strong> Clone any voice with a 3–10s audio sample using the optional OmniVoice sidecar.</li>
            <li><strong className="text-white">Segment History:</strong> Full project history tracks every take and script revision.</li>
          </ul>
        </Section>

        {/* Standalone Desktop Agent */}
        <Section icon={<Cpu className="h-4 w-4" />} title="Standalone Desktop Runner (Python)">
          <div className="text-sm text-gray-300 space-y-2">
            <p>The <code className="rounded bg-gray-800 px-1.5 py-0.5 text-xs">soundwave-agent/</code> package allows Soundwave AI to run as an independent, local desktop assistant on Windows, macOS, or Linux without any browser overhead.</p>
            <ul className="list-disc space-y-1 pl-5 text-xs text-gray-400">
              <li><strong className="text-white">Soundwave Reactive HUD:</strong> Clean, futuristic audio visualizer that pulses to speech and rendering tasks — no weird 3D face avatar.</li>
              <li><strong className="text-white">CLI & GUI:</strong> Run <code className="text-cyan-300">python soundwave-agent/main.py --batch</code> for one-line viral content generation.</li>
              <li><strong className="text-white">Direct REST API:</strong> Communicates directly with the Soundwave backend to automate rendering and downloads.</li>
            </ul>
          </div>
        </Section>

        {/* Commercial Licensing */}
        <Section icon={<ShieldCheck className="h-4 w-4" />} title="Commercial Rights & Clean IP">
          <p className="text-sm text-gray-300 leading-relaxed">
            Soundwave AI is built entirely from original code, permissively licensed under the <strong className="text-white">MIT Commercial License</strong>. There is zero proprietary code, zero borrowed assets, and zero third-party dependencies from other creator repositories. You own full commercial rights to sell, package, redistribute, and monetize Soundwave AI and the videos it produces.
          </p>
        </Section>

        <p className="flex items-center gap-2 text-xs text-gray-500">
          <MessageCircleQuestion className="h-4 w-4" /> Soundwave AI Suite · All Rights Reserved · Commercial Version 2.0
        </p>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-gray-800 bg-panel p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-cyan-400">{icon}</span>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}
