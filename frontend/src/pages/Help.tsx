import { Clapperboard, Mic, MessageCircleQuestion } from "lucide-react";

/** In-app help center — no external docs or inbox required. */
export function Help() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold text-white">Help & Support</h1>
      <p className="mt-1 text-sm text-gray-400">Tips for getting the most out of Soundwave AI.</p>

      <div className="mt-6 space-y-5">
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

        <p className="flex items-center gap-2 text-xs text-gray-500">
          <MessageCircleQuestion className="h-4 w-4" /> This page covers the current version — it grows with every update.
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
