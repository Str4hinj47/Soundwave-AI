import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AudioLines,
  Captions,
  Clapperboard,
  Keyboard,
  Mic,
  Palette,
  PlugZap,
  Sparkles,
} from "lucide-react";
import { cn } from "../lib/cn";

/** In-app help centre — no external docs or inbox required. */
export function Help() {
  return (
    <div className="mx-auto max-w-4xl">
      <p className="sw-eyebrow">Support</p>
      <h1 className="mt-1 text-3xl font-bold text-fg-strong">Help &amp; tips</h1>
      <p className="mt-1 text-sm text-fg-muted">
        Everything you need to get a good take — from voice selection to the final render.
      </p>

      <div className="mt-6 space-y-5">
        <Section icon={<Mic className="h-4 w-4" />} title="Voiceover tips">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-fg-muted">
            <li>Long scripts work best in sections — the session history keeps every take so you can stitch them together.</li>
            <li>
              Use <strong className="text-fg">Add pause</strong> for a comma-length break, <strong className="text-fg">Say as…</strong>{" "}
              to fix a pronunciation, and <strong className="text-fg">Spell out</strong> for acronyms.
            </li>
            <li>Speed 0.9×–0.95× usually sounds more natural for narration than the default 1.0×.</li>
            <li>Cloned voices (optional self-hosted sidecar) sound best with a clean 3–10 s reference clip in the same language.</li>
          </ul>
        </Section>

        <Section icon={<Captions className="h-4 w-4" />} title="Subtitles">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-fg-muted">
            <li>Generate the voiceover first — word timings auto-cue the subtitle segments for you.</li>
            <li>Drag the subtitle inside the preview to set a custom position; pick a preset, then tweak the details.</li>
            <li>Export <strong className="text-fg">SRT</strong> to take the cues into YouTube Studio or Premiere.</li>
            <li>The preview scales the styles you set so 1080p exports match what you see.</li>
          </ul>
        </Section>

        <Section icon={<Clapperboard className="h-4 w-4" />} title="Video export checklist">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-fg-muted">
            <li>Voiceover generated and at least one subtitle cue defined.</li>
            <li>A background video is optional — without one you get the solid colour you pick, perfect for lyric/caption videos.</li>
            <li>Portrait 9:16 is a first-class export for Shorts, TikTok and Reels.</li>
            <li>Footage shorter than the voice loops automatically, so the voiceover is never cut off.</li>
            <li>FFmpeg must be available to the API; without it the export returns a clear error and everything else keeps working.</li>
          </ul>
        </Section>

        <Section icon={<Palette className="h-4 w-4" />} title="Themes &amp; appearance">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-fg-muted">
            <li>Seven presets ship with the app — four dark, two light and one monochrome.</li>
            <li>Override the accent colour, corner radius and density, or let the theme follow your device’s light/dark mode.</li>
            <li>
              Everything lives under{" "}
              <Link to="/settings/appearance" className="sw-link">
                Settings → Appearance
              </Link>{" "}
              and is stored in this browser.
            </li>
            <li>Disable animations with “Reduce motion” if you prefer a static interface.</li>
          </ul>
        </Section>

        <Section icon={<AudioLines className="h-4 w-4" />} title="Audio, quotas &amp; privacy">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-fg-muted">
            <li>Character usage is counted when audio is synthesised and resets at the start of each cycle.</li>
            <li>Your script is used only to synthesise the audio and is never stored by the API.</li>
            <li>Audio stays in your browser; it is uploaded only for a video export and deleted right after the render.</li>
            <li>Free accounts keep projects in this browser (Local Only) — Pro and Enterprise save them to the cloud.</li>
          </ul>
        </Section>

        <Section icon={<Keyboard className="h-4 w-4" />} title="Shortcuts">
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { keys: ["/"], label: "Focus the project search" },
              { keys: ["Esc"], label: "Close dialogs and menus" },
              { keys: ["←", "→"], label: "Seek the waveform when focused" },
              { keys: ["Tab"], label: "Cycle the modal focus ring" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3 rounded-card border border-border bg-surface-inset px-3 py-2">
                <span className="flex gap-1">
                  {s.keys.map((k) => (
                    <kbd key={k} className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-xs text-fg-muted">
                      {k}
                    </kbd>
                  ))}
                </span>
                <span className="text-sm text-fg-muted">{s.label}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section icon={<PlugZap className="h-4 w-4" />} title="Troubleshooting">
          <Accordion
            items={[
              {
                q: "“The Microsoft Neural voice service wasn’t reachable”",
                a: "The frontend fell back to the built-in demo voice. Check that the API is running and reachable (GET /api/health), then regenerate. The demo voice is a formant synthesiser — it is meant as a safety net, not a finished voice.",
              },
              {
                q: "Exports fail immediately",
                a: "FFmpeg isn’t available to the API process. Install it (apt/winget) or set FFMPEG_PATH, then restart the server. The error message includes the exact path that was probed.",
              },
              {
                q: "“Upgrade required” on a resolution",
                a: "Resolution is enforced per plan: Free 720p, Pro 1080p, Enterprise 4K (portrait swaps the axes).",
              },
              {
                q: "My project says Local Only",
                a: "Free accounts store projects in this browser using IndexedDB. Clearing site data removes them — upgrade to Pro for cloud saves.",
              },
            ]}
          />
        </Section>

        <p className="flex items-center gap-2 text-xs text-fg-subtle">
          <Sparkles className="h-4 w-4" /> This page covers the current version — it grows with every update.
        </p>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="sw-card sw-card-pad">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <h2 className="text-lg font-semibold text-fg-strong">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Accordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-border overflow-hidden rounded-card border border-border">
      {items.map((item, i) => (
        <div key={item.q}>
          <button
            type="button"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
            className="flex w-full items-center justify-between gap-3 bg-surface-inset px-4 py-3 text-left transition-colors hover:bg-surface-2"
          >
            <span className="min-w-0 text-sm font-medium text-fg">{item.q}</span>
            <span className={cn("shrink-0 text-fg-subtle transition-transform", open === i && "rotate-45")}>+</span>
          </button>
          {open === i && (
            <p className="bg-surface-inset px-4 pb-4 text-sm leading-relaxed text-fg-muted">{item.a}</p>
          )}
        </div>
      ))}
    </div>
  );
}
