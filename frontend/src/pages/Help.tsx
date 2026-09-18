import { Clapperboard, Mic, MessageCircleQuestion, Bot, Cpu, Puzzle } from "lucide-react";
import { Link } from "react-router-dom";

/** In-app help center — no external docs or inbox required. */
export function Help() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold text-white">Help & Support</h1>
      <p className="mt-1 text-sm text-gray-400">Tips for getting the most out of Soundwave AI.</p>

      <div className="mt-6 space-y-5">
        <Section icon={<Bot className="h-4 w-4" />} title="JARVIS MARK LIII Expert — New!">
          <p className="text-sm text-gray-300">
            Soundwave AI now includes a full <span className="text-cyan-300 font-semibold">JARVIS MARK LIII Expert</span> — an AI assistant that is an expert at using the <a href="https://github.com/FatihMakes/Mark-LIII" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">FatihMakes/Mark-LIII</a> repo (1.2k★).
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-gray-300">
            <li><strong className="text-white">Chat Expert:</strong> Ask anything about Mark-LIII — installation, 20+ actions, core modules, memory system, wake word, audio device picker, undo, confirmation gate, prompt.txt rules.</li>
            <li><strong className="text-white">Actions Explorer:</strong> Browse all 20 bundled actions (open_app, computer_settings, web_search, screen_processor, file_controller, etc.) with parameters, examples, OS support.</li>
            <li><strong className="text-white">Core Modules:</strong> Deep dive into action_loader, plugin_loader, memory_manager, wake_word, audio_devices, undo, confirm, ui.py HUD.</li>
            <li><strong className="text-white">Plugin Generator:</strong> Describe what you want — generates a self-describing PLUGIN dict + run() ready to drop into plugins/ (e.g. weather, translator, smart home).</li>
            <li><strong className="text-white">Voice Integration:</strong> Every expert answer can be spoken via Microsoft Neural TTS (Edge TTS) — same engine as Studio.</li>
          </ul>
          <Link to="/jarvis" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:from-cyan-400 hover:to-blue-500">
            <Bot className="h-4 w-4" /> Open JARVIS Expert
          </Link>
        </Section>

        <Section icon={<Mic className="h-4 w-4" />} title="Voiceover tips">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-gray-300">
            <li>Long scripts → generate section by section; the history panel keeps every take.</li>
            <li>Use Add pause, Emphasis, and Pronunciation buttons to shape delivery.</li>
            <li>Cloned voices sound best with a 3–10 s clean reference clip, same language as your text.</li>
          </ul>
        </Section>

        <Section icon={<Clapperboard className="h-4 w-4" />} title="Video export checklist">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-gray-300">
            <li>Generate the voiceover first (Studio) and confirm subtitle cues exist (Subtitle Editor).</li>
            <li>A background video is optional — without one you get a solid-color background, perfect for lyric/caption videos.</li>
            <li>The export button uploads the audio, renders on the server with FFmpeg, and streams progress live.</li>
            <li>Video shorter than your voice? It loops automatically so the voiceover is never cut off. The length controls let you cut the video earlier or exactly at voice end.</li>
          </ul>
        </Section>

        <Section icon={<Cpu className="h-4 w-4" />} title="Mark LIII — Key Concepts">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-gray-300">
            <li><strong className="text-white">Self-Describing Skills:</strong> Every action has TOOL dict + handler, every plugin PLUGIN dict + run() — auto-discovered at launch, one-file operation.</li>
            <li><strong className="text-white">Recallable Memory:</strong> 200k guard, prompt carries 900 char core + 420 index, rest fetched via recall_memory tool locally &lt;1ms.</li>
            <li><strong className="text-white">Wake Word:</strong> Local openwakeword, zero cloud while asleep, 120s auto-sleep, own thread, opt-in one-click download.</li>
            <li><strong className="text-white">Audio Picker:</strong> Filters 41 PortAudio entries → 8 real devices, measures MME vs DirectSound, stores by name not index.</li>
          </ul>
        </Section>

        <Section icon={<Puzzle className="h-4 w-4" />} title="Creating Mark-LIII Plugins">
          <div className="text-sm text-gray-300 space-y-2">
            <p>1. Copy <code className="rounded bg-gray-800 px-1.5 py-0.5 text-xs">plugins/_template.py</code> → rename (no leading underscore)</p>
            <p>2. Fill PLUGIN dict: name (regex ^[a-zA-Z_][a-zA-Z0-9_]...), description (Gemini routing), parameters (type OBJECT)</p>
            <p>3. Implement <code className="rounded bg-gray-800 px-1.5 py-0.5 text-xs">run(parameters, player, session_memory) -&gt; str</code> — never raise, return spoken string</p>
            <p>4. Optional PLUGIN_SETTINGS for UI settings form (namespace, title, fields)</p>
            <p>5. Drop in plugins/, restart — discover_plugins() auto-discovers, enable/disable via ⚙ → Plugin Manager</p>
            <p className="mt-2">Use the <Link to="/jarvis" className="text-cyan-400 hover:text-cyan-300 underline">JARVIS Expert → Plugin Generator</Link> to scaffold from description.</p>
          </div>
        </Section>

        <p className="flex items-center gap-2 text-xs text-gray-500">
          <MessageCircleQuestion className="h-4 w-4" /> This page covers the current version — it grows with every update. JARVIS Expert knowledge cutoff 2026-09-16, repo FatihMakes/Mark-LIII.
        </p>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-gray-800 bg-panel p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-blue-400">{icon}</span>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}
