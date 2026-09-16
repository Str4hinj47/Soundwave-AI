import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "../../lib/cn";

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  group?: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

/** Accessible dropdown select with optional search. Closes on outside click. */
export function Select({ options, value, onChange, placeholder = "Select…", searchable = false, disabled, className, ariaLabel }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q) || (o.sublabel ?? "").toLowerCase().includes(q),
    );
  }, [options, query]);

  const selected = options.find((o) => o.value === value);
  const grouped = useMemo(() => {
    const g: { group: string; items: SelectOption[] }[] = [];
    for (const o of filtered) {
      const key = o.group ?? "";
      let entry = g.find((x) => x.group === key);
      if (!entry) {
        entry = { group: key, items: [] };
        g.push(entry);
      }
      entry.items.push(o);
    }
    return g;
  }, [filtered]);

  return (
    <div ref={rootRef} className={cn("relative w-full min-w-0", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-11 w-full min-w-0 items-center gap-2 rounded-input border border-border-strong bg-surface-inset px-3.5 text-left text-base text-fg-strong transition-all duration-200",
          "hover:border-border-strong focus:border-primary",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        {selected?.icon && <span className="shrink-0">{selected.icon}</span>}
        <span className="min-w-0 flex-1 truncate">{selected ? selected.label : <span className="text-fg-subtle">{placeholder}</span>}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-fg-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-20 mt-1.5 max-h-80 overflow-hidden rounded-card border border-border-strong bg-surface shadow-2xl">
          {searchable && (
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-fg-subtle" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full min-w-0 bg-transparent text-sm text-fg-strong placeholder:text-fg-subtle focus:outline-none"
              />
            </div>
          )}
          <ul className="max-h-64 overflow-y-auto py-1" role="listbox">
            {grouped.length === 0 && <li className="px-3 py-3 text-sm text-fg-subtle">No results</li>}
            {grouped.map((g) => (
              <li key={g.group || "_"}>
                {g.group && (
                  <div className="px-3 pb-0.5 pt-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">{g.group}</div>
                )}
                {g.items.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={o.value === value}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2",
                      o.value === value && "bg-primary/10 text-primary",
                    )}
                  >
                    {o.icon && <span className="shrink-0">{o.icon}</span>}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-fg-strong">{o.label}</span>
                      {o.sublabel && <span className="block truncate text-xs text-fg-subtle">{o.sublabel}</span>}
                    </span>
                    {o.value === value && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
