import { AlertTriangle, BookOpen, Clapperboard, Mic, Rocket, Wrench, MessageCircleQuestion } from "lucide-react";
import { Link } from "react-router-dom";

/** In-app help center — no external docs or inbox required. */
export function Help() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold text-white">Help & Support</h1>
      <p className="mt-1 text-sm text-gray-400">Everything runs locally — most issues are one missed terminal window away from fixed.</p>

      <div className="mt-6 space-y-5">
        <Section icon={<Rocket className="h-4 w-4" />} title="Quick start (5 steps)">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-300">
            <li>Start the API: <code className="rounded bg-gray-800 px-1.5 py-0.5">cd server && npm run dev</code></li>
            <li>Start the app: <code className="rounded bg-gray-800 px-1.5 py-0.5">cd frontend && npm run dev</code></li>
            <li>Open <Link to="/studio" className="text-blue-400 hover:text-blue-300">Text-to-Speech Studio</Link>, pick a voice, and generate.</li>
            <li>Jump to <Link to="/subtitles" className="text-blue-400 hover:text-blue-300">Subtitle Editor</Link> — cues are pre-filled from the generation.</li>
            <li>Compose and export in <Link to="/video" className="text-blue-400 hover:text-blue-300">Video Compositor</Link>.</li>
          </ol>
        </Section>

        <Section icon={<Wrench className="h-4 w-4" />} title="Common issues">
          <Faq
            q='"Missing required environment variables: JWT_ACCESS_SECRET…"'
            a="The server refuses to boot without server\.env — it is never included in downloads because it contains your secrets. Recreate it from the block in the README/messages (Out-File -Encoding ascii), then restart npm run dev."
          />
          <Faq
            q="Video export says FFmpeg wasn't found / export fails instantly"
            a="FFmpeg must be installed once: run winget install ffmpeg in PowerShell, close the terminal, open a NEW one, and restart the server. Look for the `ffmpeg: ffmpeg version …` line in the server log — if the warning icon is there instead, PATH hasn't refreshed yet."
          />
          <Faq
            q='"Cloned voices" tab is missing'
            a="Voice cloning runs in the separate voiceclone/ Python service. Set VOICECLONE_URL in server\.env to its address and start it (uvicorn server:app --port 8100). With no URL configured, the feature hides itself intentionally — see voiceclone\README.md."
          />
          <Faq
            q="YouTube import fails"
            a="Import needs Python 3 installed (winget install Python.Python.3.12) — the app bundles yt-dlp itself. Age/bot-gated videos may also require cookies (YTDLP_COOKIES in server\.env, see .env.example)."
          />
          <Faq
            q="Generation quota reached / 4K not available"
            a="Limits come from the account plan (Settings → Billing). For unrestricted local testing set DEFAULT_SIGNUP_PLAN=ENTERPRISE in server\.env, restart, and sign up with a fresh account — remove it before publishing."
          />
          <Faq
            q="My audio/work disappeared after a page refresh"
            a="The studio keeps work in browser memory only. Use Download to keep the audio file, and Save Project to keep the text/settings. Refreshing the tab always starts clean."
          />
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

        <Section icon={<BookOpen className="h-4 w-4" />} title="Where things live">
          <div className="space-y-1.5 font-mono text-sm text-gray-300">
            <p><span className="text-gray-500">server\.env</span> — your secrets (recreate after every fresh download)</p>
            <p><span className="text-gray-500">server\data\</span> — local database (users, projects, cloned voices)</p>
            <p><span className="text-gray-500">server\uploads\</span> — uploaded videos and finished exports</p>
            <p><span className="text-gray-500">voiceclone\</span> — optional voice-cloning service + its README</p>
          </div>
        </Section>

        <div className="flex items-start gap-3 rounded-card border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <p>
            Still stuck? The server terminal window shows the real error in plain text — reproduce the action and read
            the last lines. Fixing what&apos;s printed there solves 95% of issues; the browser toast usually only shows
            the summary.
          </p>
        </div>

        <p className="flex items-center gap-2 text-xs text-gray-500">
          <MessageCircleQuestion className="h-4 w-4" /> This help page is local — it works offline, like the rest of the app.
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

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-md border border-gray-800 bg-gray-900/40 px-4 py-3 transition-colors open:border-gray-700">
      <summary className="cursor-pointer select-none text-sm font-medium text-gray-200 hover:text-white">{q}</summary>
      <p className="mt-2 text-sm leading-relaxed text-gray-400">{a}</p>
    </details>
  );
}
