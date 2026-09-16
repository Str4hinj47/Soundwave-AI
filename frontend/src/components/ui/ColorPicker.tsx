import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { COLOR_SWATCHES } from "../../lib/subtitlePresets";

interface ColorPickerProps {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  disabled?: boolean;
}

const HEX_RE = /^#?([0-9a-fA-F]{6})$/;

/** Color picker: native picker + hex/RGB/HSL inputs + preset swatches. */
export function ColorPicker({ value, onChange, label, disabled }: ColorPickerProps) {
  const [hexDraft, setHexDraft] = useState(value.replace("#", ""));
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => setHexDraft(value.replace("#", "")), [value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const commitHex = () => {
    const m = hexDraft.match(HEX_RE);
    if (m) onChange(`#${m[1]!.toUpperCase()}`);
    else setHexDraft(value.replace("#", ""));
  };

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      {label && <div className="mb-1.5 text-sm text-fg-muted">{label}</div>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          aria-label={`Open color picker for ${label ?? "color"}`}
          onClick={() => setOpen((o) => !o)}
          className="h-9 w-9 shrink-0 rounded-input border border-border-strong transition-transform hover:scale-105"
          style={{ backgroundColor: value }}
        />
        <input
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) onChange(v);
          }}
          className="h-9 w-full min-w-0 rounded-input border border-border-strong bg-surface-inset px-3 font-mono text-sm text-fg-strong transition-colors hover:border-border-strong"
          aria-label={`${label ?? "Color"} hex value`}
        />
      </div>

      {open && (
        <div className="absolute left-0 z-20 mt-2 w-64 rounded-card border border-border-strong bg-surface p-3 shadow-2xl">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 w-full cursor-pointer rounded bg-transparent"
            aria-label="Pick color"
          />
          <div className="mt-3 flex gap-2">
            <input
              value={hexDraft}
              onChange={(e) => setHexDraft(e.target.value)}
              onBlur={commitHex}
              onKeyDown={(e) => e.key === "Enter" && commitHex()}
              className="w-full min-w-0 rounded-input border border-border-strong bg-surface-inset px-2 py-1 font-mono text-sm text-fg-strong"
              aria-label="Hex"
            />
            <span className="flex items-center text-xs text-fg-subtle">Hex</span>
          </div>
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {COLOR_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange(c)}
                aria-label={`Set color ${c}`}
                className={cn(
                  "h-7 w-full rounded border transition-transform hover:scale-110",
                  c.toLowerCase() === value.toLowerCase() ? "border-primary" : "border-border-strong",
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
