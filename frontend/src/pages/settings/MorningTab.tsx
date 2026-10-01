import { useEffect, useState } from "react";
import { AppWindow, CloudSun, Globe, Loader2, Plus, Sunrise, Trash2 } from "lucide-react";
import { toast } from "../../store/toast";
import { cn } from "../../lib/cn";
import { Button } from "../../components/ui/Button";
import { Toggle } from "../../components/ui/Toggle";
import { morningApi, weatherLine, type MorningItem, type MorningSettings } from "../../lib/morning";

// ── Settings → Morning Setup ────────────────────────────────────────────────
// What the "🌅 Morning Setup" chip does (Command Center and phone app): which
// websites and apps it opens on this PC, the weather city for the briefing,
// and whether it suggests short ideas. Server: routes/morning.ts.

function Card({ title, icon, children, className }: { title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-card border border-gray-800 bg-panel p-5 sm:p-6", className)}>
      <div className="mb-5 flex items-center gap-2">
        {icon && <span className="text-amber-300">{icon}</span>}
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export function MorningTab() {
  const [settings, setSettings] = useState<MorningSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [city, setCity] = useState("");
  const [weather, setWeather] = useState<{ text: string; ok: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  const [kind, setKind] = useState<MorningItem["kind"]>("website");
  const [value, setValue] = useState("");

  useEffect(() => {
    morningApi
      .get()
      .then((s) => {
        setSettings(s);
        setCity(s.city ?? "");
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const save = async (patch: Parameters<typeof morningApi.save>[0], done?: string) => {
    setBusy(true);
    try {
      const next = await morningApi.save(patch);
      setSettings(next);
      if (done) toast.success("Morning Setup", done);
      return true;
    } catch (e) {
      toast.error("Morning Setup", (e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const checkWeather = async () => {
    setChecking(true);
    try {
      const r = await morningApi.weather(city.trim() || undefined);
      setWeather(r.ok && r.weather ? { ok: true, text: weatherLine(r.weather) } : { ok: false, text: r.error ?? "No weather for that city." });
    } catch (e) {
      setWeather({ ok: false, text: (e as Error).message });
    } finally {
      setChecking(false);
    }
  };

  if (error) {
    return (
      <Card title="Morning Setup" icon={<Sunrise className="h-4 w-4" />}>
        <p className="text-sm text-gray-400">{error}</p>
      </Card>
    );
  }
  if (!settings) {
    return (
      <Card title="Morning Setup" icon={<Sunrise className="h-4 w-4" />}>
        <p className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      </Card>
    );
  }

  const addItem = async () => {
    const v = value.trim();
    if (!v) return;
    if (await save({ items: [...settings.items.map(({ kind: k, value: val }) => ({ kind: k, value: val })), { kind, value: v }] }, "Added.")) setValue("");
  };

  return (
    <>
      <Card title="Morning Setup" icon={<Sunrise className="h-4 w-4" />}>
        <p className="text-sm text-gray-400">
          Press <b className="text-gray-200">🌅 Morning Setup</b> in the Command Center or the phone app (or say “good morning, run my morning setup”) and Soundwave opens what you
          need on this PC and gives you a short spoken briefing: the weather, what happened with your shorts since last time, your YouTube numbers, what you
          were working on, and three fresh short ideas.
        </p>
      </Card>

      <Card title="Open these on my PC" icon={<Globe className="h-4 w-4" />}>
        {!settings.canOpen && <p className="mb-3 text-xs text-amber-300">Only the desktop app can open things on the PC.</p>}
        <div className="space-y-2" data-testid="morning-items">
          {settings.items.length === 0 && <p className="text-sm text-gray-500">Nothing yet — add a website or an app below.</p>}
          {settings.items.map((item, i) => (
            <div key={`${item.kind}-${item.value}`} className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-2.5">
              <span className="flex min-w-0 items-center gap-2 text-sm text-gray-200">
                {item.kind === "website" ? <Globe className="h-4 w-4 shrink-0 text-cyan-400" /> : <AppWindow className="h-4 w-4 shrink-0 text-violet-400" />}
                <span className="truncate">{item.label ?? item.value}</span>
              </span>
              <button
                type="button"
                aria-label={`Remove ${item.label ?? item.value}`}
                disabled={busy}
                onClick={() => void save({ items: settings.items.filter((_, j) => j !== i).map(({ kind: k, value: v }) => ({ kind: k, value: v })) }, "Removed.")}
                className="text-gray-500 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        {settings.items.length < settings.maxItems && (
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as MorningItem["kind"])}
              className="rounded-input border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
              aria-label="What to open"
            >
              <option value="website">Website</option>
              <option value="app" disabled={!settings.canOpenApps}>
                App{settings.canOpenApps ? "" : " (Windows only)"}
              </option>
            </select>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void addItem()}
              placeholder={kind === "website" ? "e.g. https://studio.youtube.com" : "e.g. Spotify"}
              className="min-w-0 flex-1 rounded-input border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500"
              data-testid="morning-item-input"
            />
            <Button variant="outline" onClick={() => void addItem()} disabled={busy || !value.trim()} icon={<Plus className="h-4 w-4" />}>
              Add
            </Button>
          </div>
        )}
        <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">Open them when I start it from my phone</p>
            <p className="mt-0.5 text-xs text-gray-500">Off: from the phone you only get the briefing. When the PC is off the phone always gives the briefing only.</p>
          </div>
          <Toggle checked={settings.openFromPhone} onChange={(v) => void save({ openFromPhone: v })} label="Open them when I start it from my phone" disabled={busy} />
        </div>
      </Card>

      <Card title="Weather and ideas" icon={<CloudSun className="h-4 w-4" />}>
        <label className="mb-1.5 block text-sm text-gray-300">City for the weather</label>
        <div className="flex flex-wrap gap-2">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={settings.weatherCityAuto && settings.weatherCity ? `${settings.weatherCity} (from your time zone)` : "e.g. Kruševac, Serbia"}
            className="min-w-0 flex-1 rounded-input border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500"
            data-testid="morning-city"
          />
          <Button variant="outline" onClick={() => void checkWeather()} disabled={checking}>
            {checking ? "Checking…" : "Check"}
          </Button>
          <Button onClick={() => void save({ city: city.trim() || null }, city.trim() ? `Weather for ${city.trim()}.` : "Using your time zone's city.")} disabled={busy || (city.trim() || null) === settings.city}>
            Save
          </Button>
        </div>
        {weather && <p className={cn("mt-2 text-xs", weather.ok ? "text-emerald-300" : "text-amber-300")}>{weather.text}</p>}
        <p className="mt-2 text-xs text-gray-500">Weather by Open-Meteo (free, no account). Leave empty to use your PC's time zone city.</p>

        <div className="mt-5 flex items-center justify-between gap-4 rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">Include three short ideas</p>
            <p className="mt-0.5 text-xs text-gray-500">Fresh topics for your channel that you haven't made yet (needs a Gemini key in Settings → Brain).</p>
          </div>
          <Toggle checked={settings.ideas} onChange={(v) => void save({ ideas: v })} label="Include three short ideas" disabled={busy} />
        </div>
      </Card>
    </>
  );
}
