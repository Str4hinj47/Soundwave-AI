import { useState } from "react";
import { Database, Download, Info } from "lucide-react";
import { STANDALONE } from "../lib/env";
import { idbKeys, idbGet, idbUsage } from "../lib/idb";

/** Settings for the single-file standalone build: no accounts, no billing —
 *  just where the data lives and a one-click export of everything. */
export function StandaloneSettings() {
  const [exporting, setExporting] = useState(false);
  const [usage, setUsage] = useState<number | null>(null);

  if (!STANDALONE) return null;

  const loadUsage = async () => setUsage(await idbUsage().catch(() => null));

  const exportData = async () => {
    setExporting(true);
    try {
      const keys = await idbKeys();
      const dump: Record<string, unknown> = { exportedAt: new Date().toISOString(), app: "Soundwave AI (standalone)" };
      for (const k of keys) dump[k] = await idbGet(k);
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "soundwave-standalone-data.json";
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold text-white">Settings</h1>
      <p className="mt-1 text-sm text-gray-400">Single-file standalone build — everything runs and stays in this browser.</p>

      <div className="mt-6 space-y-5">
        <section className="rounded-card border border-gray-800 bg-panel p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-2 text-white">
            <Info className="h-4 w-4 text-blue-400" />
            <h2 className="text-lg font-semibold">About this build</h2>
          </div>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-gray-300">
            <li>No account, no server, no sign-in — the whole app is this one HTML file.</li>
            <li>Neural voices are generated straight in your browser via the free Microsoft Edge TTS service, so generating speech needs an internet connection.</li>
            <li>Video export renders on your GPU/CPU with the browser's built-in encoder — MP4 when your browser supports it, otherwise WebM.</li>
            <li>All the full-server perks are unlocked: 4K, no watermark, unlimited characters.</li>
            <li>Voice cloning is the only feature left out — it needs the separate Python service.</li>
          </ul>
        </section>

        <section className="rounded-card border border-gray-800 bg-panel p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-2 text-white">
            <Database className="h-4 w-4 text-blue-400" />
            <h2 className="text-lg font-semibold">Your data</h2>
          </div>
          <p className="text-sm text-gray-300">
            Projects and preferences live in this browser's IndexedDB — they survive restarts but
            follow the browser, not a machine. Use the export below to back them up.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={exportData}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-input bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
            >
              <Download className="h-4 w-4" /> {exporting ? "Preparing…" : "Export my data"}
            </button>
            <button
              onClick={() => void loadUsage()}
              className="text-sm text-gray-400 underline decoration-gray-600 underline-offset-4 hover:text-gray-200"
            >
              Show storage used
            </button>
          </div>
          {usage != null && (
            <p className="mt-3 text-xs text-gray-500">
              IndexedDB usage ≈ {(usage / 1024 / 1024).toFixed(2)} MB
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
