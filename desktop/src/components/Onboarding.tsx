import { useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronLeft, Cloud, Laptop, Mic, Sparkles } from "lucide-react";
import { useStore } from "../store";
import type { Theme } from "../lib/types";
import { BuddyFace } from "./BuddyFace";
import { testMicrophone } from "../lib/voice";

const LANGUAGES = [
  { code: "en", label: "English", ready: true },
  { code: "de", label: "Deutsch", ready: false },
  { code: "es", label: "Español", ready: false },
  { code: "fr", label: "Français", ready: false },
  { code: "ja", label: "日本語", ready: false },
  { code: "pt", label: "Português", ready: false },
];

const THEMES: Array<{ id: Theme; label: string; swatch: string[] }> = [
  { id: "cream", label: "Cream", swatch: ["#FBF6EC", "#EF6A3C", "#262019"] },
  { id: "dark", label: "Espresso", swatch: ["#211D19", "#FF7F52", "#F4EEE4"] },
  { id: "ocean", label: "Ocean", swatch: ["#EFF7F4", "#14987F", "#172724"] },
];

/**
 * First-run flow — the same four steps Taby walks you through:
 * language → look → microphone → brain.
 */
export function Onboarding({ openUrl }: { openUrl: (url: string) => void }) {
  const settings = useStore((s) => s.settings);
  const patch = useStore((s) => s.patchSettings);
  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState(settings.language);
  const [theme, setTheme] = useState<Theme>(settings.theme);
  const [brain, setBrain] = useState(settings.brain);
  const [micState, setMicState] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [micMsg, setMicMsg] = useState("");

  const total = 5;

  const next = () => {
    if (step < total - 1) setStep(step + 1);
    else patch({ onboarded: true, language, theme, brain });
  };

  const runMic = async () => {
    setMicState("testing");
    const r = await testMicrophone();
    if (r.ok) {
      setMicState("ok");
      setMicMsg(`I can hear you — input level ${Math.max(r.level, 4)}%.`);
    } else {
      setMicState("fail");
      setMicMsg(r.error || "Couldn't reach a microphone.");
    }
  };

  return (
    <div className="h-full w-full overflow-hidden rounded-b-[28px] bg-panel text-ink shadow-panel flex flex-col ring-1 ring-black/5">
      {/* progress */}
      <div className="h-11 shrink-0 flex items-center px-4 gap-2 border-b border-line">
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} className="rounded-full p-1 -ml-1 text-muted hover:text-ink transition">
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        <div className="flex gap-1.5 flex-1">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-accent" : i < step ? "w-3 bg-accent/50" : "w-3 bg-line"}`}
            />
          ))}
        </div>
        <span className="text-[10.5px] text-muted font-semibold tabular-nums">
          {step + 1} / {total}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <motion.div key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6">
          {step === 0 && (
            <div className="text-center pt-6">
              <BuddyFace size={132} mood="happy" className="mx-auto bob" />
              <h1 className="mt-5 text-[26px] font-extrabold tracking-tight leading-none">Soundwave Companion</h1>
              <p className="mt-2 text-[14.5px] text-muted">your computer’s little buddy</p>
              <p className="mt-5 text-[13px] leading-relaxed text-muted max-w-[320px] mx-auto">
                Tasks, notes, habits, focus, calendar and an AI buddy — private, on your computer.
                The content studio stays on the web; I live on your desktop.
              </p>
              <button
                onClick={next}
                className="mt-7 w-full max-w-[300px] mx-auto block rounded-full bg-accent text-accent-ink font-bold text-[14.5px] py-3.5 hover:brightness-105 active:scale-[0.98] transition shadow-pill"
              >
                Let’s set me up
              </button>
              <button
                onClick={() => openUrl("https://www.heytaby.com/")}
                className="mt-3 text-[11.5px] text-muted hover:text-ink transition underline decoration-dotted"
              >
                Inspired by Taby — heytaby.com
              </button>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="text-[19px] font-extrabold tracking-tight">Pick your language</h2>
              <p className="text-[12.5px] text-muted mt-1">More languages arrive in updates.</p>
              <div className="mt-4 space-y-2">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    disabled={!l.ready}
                    onClick={() => setLanguage(l.code)}
                    className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-[14px] font-semibold transition ${
                      language === l.code ? "bg-accent-soft text-accent ring-1 ring-accent/40" : "bg-card text-ink ring-1 ring-line hover:bg-card/70"
                    } ${!l.ready ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <span className="flex-1 text-left">{l.label}</span>
                    {!l.ready && <span className="text-[10px] font-bold uppercase tracking-wide text-muted">soon</span>}
                    {language === l.code && <Check className="h-4 w-4" />}
                  </button>
                ))}
              </div>
              <button
                onClick={next}
                className="mt-5 w-full rounded-full bg-accent text-accent-ink font-bold text-[15px] py-3.5 hover:brightness-105 active:scale-[0.98] transition shadow-pill"
              >
                Continue
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-[19px] font-extrabold tracking-tight">Pick your look</h2>
              <p className="text-[12.5px] text-muted mt-1">You can change it anytime in Settings.</p>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTheme(t.id);
                      patch({ theme: t.id });
                    }}
                    className={`rounded-2xl p-3 ring-1 transition ${theme === t.id ? "ring-accent bg-accent-soft" : "ring-line bg-card hover:bg-card/70"}`}
                  >
                    <div className="rounded-xl h-16 flex items-end gap-1 p-2" style={{ background: t.swatch[0] }}>
                      <span className="h-4 w-4 rounded-full" style={{ background: t.swatch[1] }} />
                      <span className="h-2 flex-1 rounded" style={{ background: t.swatch[2], opacity: 0.75 }} />
                    </div>
                    <div className="mt-2 text-[12.5px] font-bold">{t.label}</div>
                  </button>
                ))}
              </div>
              <button
                onClick={next}
                className="mt-5 w-full rounded-full bg-accent text-accent-ink font-bold text-[15px] py-3.5 hover:brightness-105 active:scale-[0.98] transition shadow-pill"
              >
                Continue
              </button>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-[19px] font-extrabold tracking-tight">Check your microphone</h2>
              <p className="text-[12.5px] text-muted mt-1">Talk to me by voice — optional, but fun.</p>
              <div className="mt-5 rounded-3xl bg-card ring-1 ring-line p-5 text-center">
                <div
                  className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center transition ${
                    micState === "ok" ? "bg-good/15 text-good" : micState === "fail" ? "bg-red-400/15 text-red-400" : "bg-accent-soft text-accent"
                  }`}
                >
                  <Mic className="h-7 w-7" />
                </div>
                <p className="mt-3 text-[13px] text-muted min-h-[36px]">
                  {micState === "idle" && "I'll listen for a moment when you press the button."}
                  {micState === "testing" && "Listening… make a little noise"}
                  {micState === "ok" && micMsg}
                  {micState === "fail" && micMsg}
                </p>
                <button
                  onClick={runMic}
                  disabled={micState === "testing"}
                  className="mt-2 rounded-full bg-ink text-panel font-bold text-[13.5px] px-6 py-2.5 disabled:opacity-50 hover:opacity-90 active:scale-95 transition"
                >
                  {micState === "testing" ? "Listening…" : micState === "ok" ? "Test again" : "Test my microphone"}
                </button>
              </div>
              <button
                onClick={next}
                className="mt-5 w-full rounded-full bg-accent text-accent-ink font-bold text-[15px] py-3.5 hover:brightness-105 active:scale-[0.98] transition shadow-pill"
              >
                {micState === "ok" ? "Sounds good — continue" : "Continue"}
              </button>
              <p className="mt-2.5 text-center text-[11.5px] text-muted">
                Voice is optional — you can always type instead.
              </p>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="text-[19px] font-extrabold tracking-tight">Pick a brain</h2>
              <p className="text-[12.5px] text-muted mt-1">Free runs right here. Cloud thinks bigger.</p>
              <div className="mt-4 space-y-3">
                <button
                  onClick={() => setBrain("local")}
                  className={`w-full text-left rounded-3xl p-4 ring-1 transition ${brain === "local" ? "ring-accent bg-accent-soft" : "ring-line bg-card hover:bg-card/70"}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-2xl bg-good/15 text-good p-2.5">
                      <Laptop className="h-5 w-5" />
                    </span>
                    <div className="flex-1">
                      <div className="font-extrabold text-[15px]">Local · Free</div>
                      <div className="text-[12px] text-muted leading-snug">
                        On-device buddy: tasks, notes, habits, focus, calendar & day plans. Works offline.
                      </div>
                    </div>
                    {brain === "local" && <Check className="h-5 w-5 text-accent" />}
                  </div>
                </button>
                <button
                  onClick={() => setBrain("gemini")}
                  className={`w-full text-left rounded-3xl p-4 ring-1 transition ${brain === "gemini" ? "ring-accent bg-accent-soft" : "ring-line bg-card hover:bg-card/70"}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-2xl bg-accent/15 text-accent p-2.5">
                      <Sparkles className="h-5 w-5" />
                    </span>
                    <div className="flex-1">
                      <div className="font-extrabold text-[15px] flex items-center gap-2">
                        Gemini · Free
                        <span className="text-[9.5px] font-bold uppercase tracking-wide rounded bg-good/15 text-good px-1.5 py-px">
                          no cost
                        </span>
                      </div>
                      <div className="text-[12px] text-muted leading-snug">
                        Real AI answers from Google’s free-tier Flash models. Bring your own free key.
                      </div>
                    </div>
                    {brain === "gemini" && <Check className="h-5 w-5 text-accent" />}
                  </div>
                </button>
                <button
                  onClick={() => setBrain("cloud")}
                  className={`w-full text-left rounded-3xl p-4 ring-1 transition ${brain === "cloud" ? "ring-accent bg-accent-soft" : "ring-line bg-card hover:bg-card/70"}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-2xl bg-accent/15 text-accent p-2.5">
                      <Cloud className="h-5 w-5" />
                    </span>
                    <div className="flex-1">
                      <div className="font-extrabold text-[15px]">Soundwave Cloud · Bigger brain</div>
                      <div className="text-[12px] text-muted leading-snug">
                        Viral scripts, 1-click shorts, neural voices, workstation commands.
                      </div>
                    </div>
                    {brain === "cloud" && <Check className="h-5 w-5 text-accent" />}
                  </div>
                </button>
              </div>
              <button
                onClick={next}
                className="mt-5 w-full rounded-full bg-accent text-accent-ink font-bold text-[15px] py-3.5 hover:brightness-105 active:scale-[0.98] transition shadow-pill flex items-center justify-center gap-2"
              >
                <Sparkles className="h-4 w-4" /> Meet Echo
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
