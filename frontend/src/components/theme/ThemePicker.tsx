import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, MonitorSmartphone, Moon, Palette, Sun } from "lucide-react";
import { cn } from "../../lib/cn";
import { DENSITIES, RADII, THEMES, type Theme } from "../../lib/themes";
import { useTheme } from "../../store/theme";
import { ACCENTS } from "../../lib/themes";

/** Miniature of a preset — palette swatches over a faux app frame. */
export function ThemePreviewCard({
  theme,
  active,
  onSelect,
  className,
}: {
  theme: Theme;
  active: boolean;
  onSelect: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      aria-label={`Use the ${theme.name} theme`}
      className={cn(
        "group w-full overflow-hidden rounded-card border p-2.5 text-left transition-all duration-200",
        active
          ? "border-primary shadow-glow"
          : "border-border hover:border-border-strong hover:shadow-lift",
        className,
      )}
    >
      <span
        className="block overflow-hidden rounded-btn border"
        style={{ backgroundColor: theme.preview.bg, borderColor: `${theme.preview.surface}` }}
      >
        <span className="flex items-center gap-1.5 px-2.5 py-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: `linear-gradient(135deg, ${theme.preview.primary}, ${theme.preview.accent})` }}
          />
          <span className="h-1.5 w-10 rounded-full" style={{ backgroundColor: theme.preview.primary, opacity: 0.85 }} />
          <span className="ml-auto h-1.5 w-5 rounded-full" style={{ backgroundColor: theme.preview.surface }} />
        </span>
        <span className="flex gap-1.5 px-2.5 pb-2.5">
          <span className="flex-1 rounded-[5px] p-1.5" style={{ backgroundColor: theme.preview.surface }}>
            <span className="block h-1.5 w-8 rounded-full" style={{ backgroundColor: theme.preview.accent, opacity: 0.9 }} />
            <span className="mt-1 block h-1.5 w-12 rounded-full" style={{ backgroundColor: theme.preview.primary, opacity: 0.35 }} />
          </span>
          <span className="w-6 rounded-[5px]" style={{ backgroundColor: theme.preview.accent, opacity: 0.4 }} />
        </span>
      </span>
      <span className="mt-2 flex items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-fg-strong">{theme.name}</span>
          <span className="block truncate text-xs text-fg-subtle">
            {theme.appearance === "dark" ? "Dark" : "Light"}
          </span>
        </span>
        {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
      </span>
    </button>
  );
}

/** Accent hue swatch row. */
export function AccentSwatches({ className }: { className?: string }) {
  const accentId = useTheme((s) => s.accentId);
  const setAccent = useTheme((s) => s.setAccent);
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {ACCENTS.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => setAccent(a.id)}
          aria-label={`Accent: ${a.name}`}
          aria-pressed={accentId === a.id}
          title={a.name}
          className={cn(
            "h-8 w-8 rounded-full border-2 transition-transform hover:scale-110",
            accentId === a.id ? "border-fg-strong" : "border-border",
          )}
          style={{ background: a.swatch }}
        />
      ))}
    </div>
  );
}

/** Compact theme switcher for the navbar / app shell. */
export function ThemePicker({ className, align = "right" }: { className?: string; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { themeId, mode, setTheme, setMode, resolvedTheme } = useTheme();
  const active = resolvedTheme();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Change theme"
        className="flex h-10 items-center gap-2 rounded-full border border-border px-3 text-sm text-fg-muted transition-colors hover:border-border-strong hover:text-fg-strong"
      >
        <Palette className="h-4 w-4" />
        <span className="hidden min-w-0 max-w-[7rem] truncate sm:inline">{active.name}</span>
        <span
          className="h-3.5 w-3.5 shrink-0 rounded-full"
          style={{ background: `linear-gradient(135deg, ${active.preview.primary}, ${active.preview.accent})` }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            role="menu"
            aria-label="Theme"
            className={cn(
              "absolute z-40 mt-2 w-[19rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-card border border-border bg-surface p-3 shadow-pop",
              align === "right" ? "right-0" : "left-0",
            )}
          >
            <p className="sw-eyebrow">Theme</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {THEMES.map((t) => (
                <ThemePreviewCard key={t.id} theme={t} active={themeId === t.id && mode === "manual"} onSelect={() => setTheme(t.id)} />
              ))}
            </div>

            <div className="mt-3 flex items-center gap-1 rounded-btn border border-border bg-surface-inset p-1">
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-[7px] px-2 py-1.5 text-xs font-medium transition-colors",
                  mode === "manual" ? "bg-surface-3 text-fg-strong" : "text-fg-muted hover:text-fg",
                )}
              >
                <Moon className="h-3.5 w-3.5" /> My pick
              </button>
              <button
                type="button"
                onClick={() => setMode("system")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-[7px] px-2 py-1.5 text-xs font-medium transition-colors",
                  mode === "system" ? "bg-surface-3 text-fg-strong" : "text-fg-muted hover:text-fg",
                )}
              >
                <MonitorSmartphone className="h-3.5 w-3.5" /> System
              </button>
            </div>

            <p className="mt-3 sw-eyebrow">Accent</p>
            <AccentSwatches className="mt-2" />

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
              <span className="text-xs text-fg-subtle">
                {mode === "system" ? "Following your device" : `${active.name} · ${active.appearance}`}
              </span>
              <a href="/settings/appearance" className="sw-link text-xs" onClick={() => setOpen(false)}>
                More options →
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Full appearance customizer (Settings → Appearance). */
export function ThemeCustomizer() {
  const { themeId, mode, radiusId, densityId, reduceMotion, setTheme, setMode, setRadius, setDensity, setReduceMotion, reset } =
    useTheme();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="sw-eyebrow">Theme presets</p>
          <button type="button" onClick={reset} className="text-xs text-fg-subtle underline-offset-2 hover:text-fg hover:underline">
            Reset to defaults
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {THEMES.map((t) => (
            <ThemePreviewCard key={t.id} theme={t} active={themeId === t.id && mode === "manual"} onSelect={() => setTheme(t.id)} />
          ))}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="sw-eyebrow">Appearance mode</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setMode("manual")}
              className={cn("sw-chip", mode === "manual" && "sw-chip-active")}
            >
              <Sun className="h-4 w-4" /> My pick
            </button>
            <button
              type="button"
              onClick={() => setMode("system")}
              className={cn("sw-chip", mode === "system" && "sw-chip-active")}
            >
              <MonitorSmartphone className="h-4 w-4" /> Match device
            </button>
          </div>
          <p className="mt-2 text-xs text-fg-subtle">
            “Match device” swaps between a dark and light preset as your operating system does.
          </p>
        </div>

        <div>
          <p className="sw-eyebrow">Accent colour</p>
          <AccentSwatches className="mt-3" />
          <p className="mt-2 text-xs text-fg-subtle">Recolours buttons, links, highlights and the waveform.</p>
        </div>

        <div>
          <p className="sw-eyebrow">Corner radius</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {RADII.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRadius(r.id)}
                className={cn("sw-chip", radiusId === r.id && "sw-chip-active")}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="sw-eyebrow">Density</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DENSITIES.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDensity(d.id)}
                className={cn("sw-chip", densityId === d.id && "sw-chip-active")}
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-card border border-border bg-surface-inset px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg">Reduce motion</p>
          <p className="text-xs text-fg-subtle">Disables animations and transitions across the app.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={reduceMotion}
          aria-label="Reduce motion"
          onClick={() => setReduceMotion(!reduceMotion)}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
            reduceMotion ? "bg-primary" : "bg-surface-3",
          )}
        >
          <span
            className={cn(
              "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
              reduceMotion ? "translate-x-[22px]" : "translate-x-0.5",
            )}
          />
        </button>
      </div>
    </div>
  );
}
