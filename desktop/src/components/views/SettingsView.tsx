import { useEffect, useState } from "react";
import {
  Check,
  Cloud,
  Copy,
  ExternalLink,
  Flame,
  Laptop,
  LogOut,
  RefreshCw,
  RotateCcw,
  Smartphone,
  Sparkles,
  Volume2,
  Zap,
} from "lucide-react";
import QRCode from "qrcode";
import { useStore, useUI } from "../../store";
import type { Personality, Settings as SettingsT, Theme } from "../../lib/types";
import { pingBrain } from "../../lib/cloudBrain";
import { PERSONALITIES } from "../../lib/brain";
import { GEMINI_KEY_URL, GEMINI_MODELS } from "../../lib/gemini";
import { fetchPairInfo, rotatePairToken, type PairInfo } from "../../lib/sync";

const PERSONA_META: Array<{ id: Personality; blurb: string }> = [
  { id: "normal", blurb: "Friendly & direct" },
  { id: "butler", blurb: "Formal, polished" },
  { id: "bro", blurb: "Hype, all caps energy" },
  { id: "anime", blurb: "Bubbly, playful" },
  { id: "coach", blurb: "Straight to business" },
  { id: "chill", blurb: "Relaxed, no rush" },
];

const NEURAL_VOICES = [
  { id: "en-US-GuyNeural", label: "Guy · warm male" },
  { id: "en-US-AriaNeural", label: "Aria · clear female" },
  { id: "en-GB-RyanNeural", label: "Ryan · British male" },
  { id: "en-GB-SoniaNeural", label: "Sonia · British female" },
  { id: "en-AU-WilliamNeural", label: "William · Australian" },
];

const THEMES: Array<{ id: Theme; label: string; swatch: string[] }> = [
  { id: "cream", label: "Cream", swatch: ["#FBF6EC", "#EF6A3C"] },
  { id: "dark", label: "Espresso", swatch: ["#211D19", "#FF7F52"] },
  { id: "ocean", label: "Ocean", swatch: ["#EFF7F4", "#14987F"] },
];


function phoneUrlFor(info: PairInfo): string {
  const host = info.lanOrigin.replace(/^https?:\/\//, "");
  if (import.meta.env.DEV) return `http://${host}:5174/?phone=1&pair=${info.token}`;
  return `http://${host}:${info.apiPort}/phone?pair=${info.token}`;
}

function PhoneSection({ settings, patch }: { settings: SettingsT; patch: (p: Partial<SettingsT>) => void }) {
  const [info, setInfo] = useState<PairInfo | null>(null);
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncState, setSyncState] = useState<"idle" | "ok" | "error">("idle");

  const load = async (rotate = false) => {
    setBusy(true);
    setErr(null);
    let fresh = await fetchPairInfo();
    if (!fresh) {
      setInfo(null);
      setUrl("");
      setQr("");
      setErr("API server is offline — start it with: cd server && npm run dev");
      setBusy(false);
      return;
    }
    if (rotate) {
      const token = await rotatePairToken();
      if (token) fresh = { ...fresh, token };
    }
    const u = phoneUrlFor(fresh);
    setInfo(fresh);
    setUrl(u);
    try {
      setQr(await QRCode.toString(u, { type: "svg", margin: 1, width: 220 }));
    } catch {
      setQr("");
    }
    setBusy(false);
  };

  useEffect(() => {
    if (settings.phoneLink) void load();
    else {
      setInfo(null);
      setUrl("");
      setQr("");
      setErr(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.phoneLink]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ state?: string }>).detail;
      if (detail?.state === "ok" || detail?.state === "error") setSyncState(detail.state);
    };
    window.addEventListener("sw-sync", handler);
    return () => window.removeEventListener("sw-sync", handler);
  }, []);

  return (
    <Section title="Phone — Companion Link">
      <Row>
        <span className="rounded-xl bg-accent-soft text-accent p-2">
          <Smartphone className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-bold">Pair my phone</div>
          <div className="text-[11.5px] text-muted leading-snug">
            Scan the code to open Echo on your phone — same buddy, same data, pocket size.
          </div>
        </div>
        <button
          onClick={() => patch({ phoneLink: !settings.phoneLink })}
          className={`relative h-6 w-11 rounded-full transition shrink-0 ${
            settings.phoneLink ? "bg-accent" : "bg-line"
          }`}
          role="switch"
          aria-checked={settings.phoneLink}
          title="Toggle Companion Link"
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
              settings.phoneLink ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </Row>

      {settings.phoneLink && (
        <div className="px-3.5 py-3 border-t border-line">
          {err && (
            <div className="rounded-xl bg-red-400/10 text-red-500 text-[12px] font-semibold px-3 py-2.5 mb-2.5">{err}</div>
          )}
          {info && (
            <div className="flex gap-3.5">
              <div
                className="shrink-0 rounded-2xl bg-white p-2.5 ring-1 ring-line w-[132px] h-[132px] flex items-center justify-center overflow-hidden"
                aria-label="QR code to open the companion on your phone"
                dangerouslySetInnerHTML={{ __html: qr }}
              />
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Open on phone</div>
                <code className="break-all text-[10.5px] leading-snug bg-sunken rounded-lg px-2 py-1.5 font-mono text-ink/90 select-all">
                  {url}
                </code>
                <div className="flex gap-1.5 mt-auto">
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(url);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-ink text-panel px-2 py-2 text-[11.5px] font-bold hover:opacity-90 transition"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy link"}
                  </button>
                  <button
                    onClick={() => void load(true)}
                    disabled={busy}
                    className="rounded-xl bg-card ring-1 ring-line px-2.5 py-2 text-[11.5px] font-bold text-muted hover:text-ink transition disabled:opacity-50"
                    title="Generate a new pairing code"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                syncState === "error" ? "bg-red-500" : syncState === "ok" ? "bg-good" : "bg-line"
              }`}
            />
            <span className={syncState === "error" ? "text-red-500" : "text-muted"}>
              {syncState === "error"
                ? "sync paused — is the API server up?"
                : syncState === "ok"
                ? "live sync · both devices stay in step"
                : "waiting for first sync…"}
            </span>
          </div>
          <div className="mt-1.5 text-[10.5px] text-faint leading-snug">
            Same Wi‑Fi network · tasks, notes, chat and habits merge both ways · pairing code stays on your LAN.
          </div>
        </div>
      )}
    </Section>
  );
}

export function SettingsView({ openUrl }: { openUrl: (url: string) => void }) {
  const settings = useStore((s) => s.settings);
  const patch = useStore((s) => s.patchSettings);
  const resetAll = useStore((s) => s.resetAll);
  const setTab = useUI((s) => s.setTab);
  const [cloudUp, setCloudUp] = useState<boolean | null>(null);
  const [nameDraft, setNameDraft] = useState(settings.userName);

  useEffect(() => {
    let alive = true;
    pingBrain().then((ok) => alive && setCloudUp(ok));
    return () => {
      alive = false;
    };
  }, []);

  const base = settings.studioUrl.replace(/\/$/, "");

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3.5 pb-6">
      <h2 className="text-[16px] font-extrabold tracking-tight mb-2.5">Settings</h2>

      {/* brain */}
      <Section title="Brain">
        <button
          onClick={() => patch({ brain: "local" })}
          className={`w-full text-left px-3.5 py-3 flex items-center gap-3 transition hover:bg-sunken/60 ${
            settings.brain === "local" ? "bg-accent-soft/60" : ""
          }`}
        >
          <span className="rounded-xl bg-good/15 text-good p-2">
            <Laptop className="h-4 w-4" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-bold flex items-center gap-2">
              Local · Free
              <span className={`h-1.5 w-1.5 rounded-full ${cloudUp ? "bg-good" : "bg-good"}`} />
            </div>
            <div className="text-[11.5px] text-muted leading-snug">On-device buddy — works offline, nothing leaves your computer.</div>
          </div>
          {settings.brain === "local" && <Check className="h-4.5 w-4.5 text-accent" style={{ height: 18, width: 18 }} />}
        </button>
        <button
          onClick={() => patch({ brain: "gemini" })}
          className={`w-full text-left px-3.5 py-3 flex items-center gap-3 transition hover:bg-sunken/60 ${
            settings.brain === "gemini" ? "bg-accent-soft/60" : ""
          }`}
        >
          <span className="rounded-xl bg-accent/15 text-accent p-2">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-bold flex items-center gap-2">
              Gemini · Free
              <span
                className={`text-[9.5px] font-bold uppercase px-1.5 py-px rounded ${
                  settings.geminiKey.trim() ? "bg-good/15 text-good" : "bg-sunken text-muted"
                }`}
              >
                {settings.geminiKey.trim() ? "key saved" : "needs key"}
              </span>
            </div>
            <div className="text-[11.5px] text-muted leading-snug">
              Google’s free-tier Flash models — real AI answers, no credit card.
            </div>
          </div>
          {settings.brain === "gemini" && <Check className="text-accent" style={{ height: 18, width: 18 }} />}
        </button>
        {settings.brain === "gemini" && (
          <div className="px-3.5 py-3 bg-sunken/50 space-y-2.5 border-y border-line">
            <div>
              <div className="text-[12px] font-bold mb-1 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-accent" /> Free API key
              </div>
              <div className="flex gap-1.5">
                <input
                  defaultValue={settings.geminiKey}
                  type="password"
                  placeholder="AIza…"
                  spellCheck={false}
                  autoComplete="off"
                  onBlur={(e) => patch({ geminiKey: e.target.value.trim() })}
                  onKeyDown={(e) => e.key === "Enter" && patch({ geminiKey: (e.target as HTMLInputElement).value.trim() })}
                  className="flex-1 min-w-0 rounded-xl bg-card ring-1 ring-line px-2.5 py-2 text-[12.5px] font-mono outline-none focus:ring-accent/50 transition"
                />
                <a
                  href={GEMINI_KEY_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-xl bg-ink text-panel px-3 text-[11.5px] font-bold inline-flex items-center gap-1 hover:opacity-90 transition"
                >
                  Get key <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="text-[10.5px] text-faint mt-1">
                Stored only on this device · saved when you leave the field
              </div>
            </div>
            <div>
              <div className="text-[12px] font-bold mb-1">Model · free tier</div>
              <select
                value={settings.geminiModel}
                onChange={(e) => patch({ geminiModel: e.target.value })}
                className="w-full rounded-xl bg-card ring-1 ring-line px-2.5 py-2 text-[12.5px] font-semibold outline-none focus:ring-accent/50"
              >
                {GEMINI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        <button
          onClick={() => patch({ brain: "cloud" })}
          className={`w-full text-left px-3.5 py-3 flex items-center gap-3 transition hover:bg-sunken/60 ${
            settings.brain === "cloud" ? "bg-accent-soft/60" : ""
          }`}
        >
          <span className="rounded-xl bg-accent/15 text-accent p-2">
            <Cloud className="h-4 w-4" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-bold flex items-center gap-2">
              Soundwave Cloud · Bigger brain
              <span
                className={`text-[9.5px] font-bold uppercase px-1.5 py-px rounded ${
                  cloudUp === null ? "bg-sunken text-muted" : cloudUp ? "bg-good/15 text-good" : "bg-red-400/15 text-red-500"
                }`}
              >
                {cloudUp === null ? "checking" : cloudUp ? "api online" : "api offline"}
              </span>
            </div>
            <div className="text-[11.5px] text-muted leading-snug">Viral scripts, 1-click shorts, neural voices, workstation commands.</div>
          </div>
          {settings.brain === "cloud" && <Check className="text-accent" style={{ height: 18, width: 18 }} />}
        </button>
      </Section>

      {/* personality */}
      <Section title="Personality">
        <div className="p-3">
          <div className="grid grid-cols-3 gap-1.5">
            {PERSONA_META.map((p) => {
              const active = settings.personality === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => patch({ personality: p.id })}
                  className={`rounded-xl px-2 py-2.5 text-center transition ${
                    active ? "bg-accent-soft ring-1 ring-accent/50" : "bg-sunken hover:ring-1 hover:ring-line"
                  }`}
                >
                  <div className={`text-[12.5px] font-bold ${active ? "text-accent" : ""}`}>{PERSONALITIES[p.id].label}</div>
                  <div className="text-[9.5px] text-muted mt-0.5 leading-tight">{p.blurb}</div>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Try: “change personality to butler” in chat.
          </p>
        </div>
      </Section>

      {/* voice */}
      <Section title="Voice">
        <Row>
          <span className="rounded-xl bg-accent-soft text-accent p-2">
            <Volume2 className="h-4 w-4" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-bold">Spoken replies</div>
            <div className="text-[11.5px] text-muted">Echo reads answers out loud.</div>
          </div>
          <button
            onClick={() => patch({ voiceReplies: !settings.voiceReplies })}
            className={`relative h-6 w-11 rounded-full transition ${settings.voiceReplies ? "bg-accent" : "bg-line"}`}
            role="switch"
            aria-checked={settings.voiceReplies}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                settings.voiceReplies ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </Row>
        <Row>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-bold mb-1">Neural voice</div>
            <select
              value={settings.neuralVoice}
              onChange={(e) => patch({ neuralVoice: e.target.value })}
              className="w-full rounded-xl bg-sunken ring-1 ring-line px-2.5 py-2 text-[12.5px] font-semibold outline-none focus:ring-accent/50"
            >
              {NEURAL_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
            <div className="text-[10.5px] text-faint mt-1">Used with the Soundwave API; falls back to system voice.</div>
          </div>
        </Row>
      </Section>

      {/* look */}
      <Section title="Look">
        <div className="p-3 flex gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => patch({ theme: t.id })}
              className={`flex-1 rounded-xl p-2 ring-1 transition ${
                settings.theme === t.id ? "ring-accent bg-accent-soft" : "ring-line hover:ring-accent/40"
              }`}
            >
              <div className="rounded-lg h-10 flex items-end gap-1 p-1.5" style={{ background: t.swatch[0] }}>
                <span className="h-3.5 w-3.5 rounded-full" style={{ background: t.swatch[1] }} />
                <span className="h-1.5 flex-1 rounded bg-black/30" />
              </div>
              <div className="mt-1.5 text-[11.5px] font-bold">{t.label}</div>
            </button>
          ))}
        </div>
      </Section>

      {/* your name + workspaces */}
      <Section title="You & your apps">
        <Row>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-bold mb-1">What should I call you?</div>
            <div className="flex gap-1.5">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={() => patch({ userName: nameDraft.trim() })}
                onKeyDown={(e) => e.key === "Enter" && patch({ userName: nameDraft.trim() })}
                placeholder="Your name"
                className="flex-1 min-w-0 rounded-xl bg-sunken ring-1 ring-line px-2.5 py-2 text-[13px] outline-none focus:ring-accent/50"
              />
              <button
                onClick={() => patch({ userName: nameDraft.trim() })}
                className="rounded-xl bg-ink text-panel px-3 text-[12px] font-bold hover:opacity-90 transition"
              >
                Save
              </button>
            </div>
          </div>
        </Row>
        <Row>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-bold mb-1">Web platform URL</div>
            <input
              value={settings.studioUrl}
              onChange={(e) => patch({ studioUrl: e.target.value })}
              placeholder="http://localhost:5173"
              className="w-full rounded-xl bg-sunken ring-1 ring-line px-2.5 py-2 text-[12.5px] font-mono outline-none focus:ring-accent/50"
            />
            <div className="text-[10.5px] text-faint mt-1">Where the content generation platform lives.</div>
          </div>
        </Row>
        <div className="p-3 grid grid-cols-2 gap-1.5">
          {[
            { label: "Video Studio", path: "/studio/video" },
            { label: "Projects", path: "/projects" },
            { label: "Creator Hub", path: "/creator" },
            { label: "Voice Library", path: "/voices" },
          ].map((l) => (
            <button
              key={l.path}
              onClick={() => openUrl(`${base}${l.path}`)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-sunken hover:bg-line px-3 py-2.5 text-[12.5px] font-bold transition"
            >
              {l.label} <ExternalLink className="h-3.5 w-3.5 text-muted" />
            </button>
          ))}
        </div>
      </Section>

      <PhoneSection settings={settings} patch={patch} />

      {/* privacy */}
      <Section title="Privacy">
        <Row>
          <div className="flex-1">
            <div className="text-[12.5px] font-semibold leading-relaxed text-muted">
              Tasks, notes, habits, focus and calendar stay <strong className="text-ink">on this computer</strong>. The cloud
              brain only hears what you send it — and only when you pick it.
            </div>
          </div>
        </Row>
        <button
          onClick={() => {
            if (confirm("Erase all local data (tasks, notes, habits, messages)?")) {
              stopEverything();
              resetAll();
              localStorage.removeItem("soundwave-companion");
              setTab("today");
              window.location.reload();
            }
          }}
          className="w-full px-3.5 py-3 flex items-center gap-3 text-left text-red-500 hover:bg-red-400/5 transition"
        >
          <RotateCcw className="h-4 w-4" />
          <span className="text-[13px] font-bold">Erase everything & start fresh</span>
        </button>
      </Section>

      {/* about */}
      <Section title="About">
        <Row>
          <div className="flex-1">
            <div className="text-[13.5px] font-extrabold tracking-tight">Soundwave Companion 1.0</div>
            <div className="text-[11.5px] text-muted">
              your computer’s little buddy · inspired by{" "}
              <button
                onClick={() => openUrl("https://www.heytaby.com/")}
                className="font-semibold text-accent hover:underline inline-flex items-center gap-0.5"
              >
                Taby <ExternalLink className="h-3 w-3" />
              </button>
            </div>
            <div className="mt-1.5 text-[11px] text-muted flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-accent" /> hotkey:{" "}
              <kbd className="rounded bg-sunken px-1.5 py-0.5 font-sans font-bold">Ctrl + Alt + Space</kbd>
            </div>
            <div className="mt-1 text-[11px] text-muted flex items-center gap-1.5">
              <Flame className="h-3 w-3 text-accent" /> {PERSONALITIES[settings.personality].label} mode active
            </div>
          </div>
        </Row>
        <button
          onClick={() => {
            if (window.companion?.quit) window.companion.quit();
            else openUrl(base);
          }}
          className="w-full px-3.5 py-3 flex items-center gap-3 text-left hover:bg-sunken/60 transition"
        >
          <LogOut className="h-4 w-4 text-muted" />
          <span className="text-[13px] font-bold">{window.companion ? "Quit Companion" : "Open web platform"}</span>
        </button>
      </Section>
      <div className="h-2" />
    </div>
  );
}

function stopEverything() {
  // best-effort cleanup before wiping data
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* noop */
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 first:mt-0">
      <h3 className="text-[10.5px] font-bold uppercase tracking-wider text-muted mb-1.5 px-0.5">{title}</h3>
      <div className="rounded-2xl bg-card ring-1 ring-line divide-y divide-line overflow-hidden shadow-card">{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="px-3.5 py-3 flex items-center gap-3">{children}</div>;
}
