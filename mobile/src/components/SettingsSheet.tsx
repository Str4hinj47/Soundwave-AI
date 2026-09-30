import { useState } from "react";
import { Check, Laptop, Lock, Play, Unlink } from "lucide-react";
import { VOICE_META } from "../../../frontend/src/lib/voices";
import type { Companion } from "../state/useCompanion";
import type { SpeakMode } from "../lib/storage";
import { useBackHandler } from "../lib/back";
import { APP_VERSION } from "../lib/native";
import { cn, GhostButton, Sheet } from "./ui";

const SPEAK_MODES: Array<{ id: SpeakMode; label: string }> = [
  { id: "voice", label: "When I talk" },
  { id: "always", label: "Always" },
  { id: "never", label: "Never" },
];

export function SettingsSheet({ open, onClose, companion }: { open: boolean; onClose: () => void; companion: Companion }) {
  const { record, pc, state, settings, updateSettings } = companion;
  const [confirming, setConfirming] = useState(false);
  useBackHandler(open, onClose);
  if (!record) return null;
  const pcVoice = pc?.voice ?? null;
  const pcVoiceName = VOICE_META.find((v) => v.id === pcVoice)?.displayName;

  // Plays with the voice just picked (settings apply immediately).
  const preview = () => void companion.speak({ id: "preview", sender: "assistant", text: "Hi! This is how I'll sound on your phone.", time: "" });

  return (
    <Sheet open={open} onClose={onClose} title="Settings">
      <section className="rounded-3xl border border-line bg-navy/60 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06]">
            <Laptop className="h-5 w-5 text-gray-200" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold">{record.pcName}</p>
            <p className="text-[13px] text-gray-400">
              {state.kind === "online" ? <span className="text-emerald-400">Connected</span> : state.kind === "offline" ? "Offline" : "Connecting…"} · {record.hosts[0]}
              {record.port !== 47800 ? `:${record.port}` : ""}
            </p>
          </div>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[12px] text-gray-500">
          <Lock className="h-3.5 w-3.5 text-emerald-400" /> End-to-end encrypted · paired {new Date(record.pairedAt).toLocaleDateString()}
        </p>
      </section>

      <section className="mt-6">
        <h3 className="px-1 text-[13px] font-semibold uppercase tracking-[0.12em] text-gray-500">Read replies aloud</h3>
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-2xl border border-line bg-navy/60 p-1">
          {SPEAK_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => updateSettings({ speak: mode.id })}
              className={cn(
                "h-11 rounded-xl text-[14px] font-medium transition",
                settings.speak === mode.id ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white" : "text-gray-400 active:bg-white/5",
              )}
              aria-pressed={settings.speak === mode.id}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h3 className="px-1 text-[13px] font-semibold uppercase tracking-[0.12em] text-gray-500">Voice</h3>
        <div className="mt-2 overflow-hidden rounded-3xl border border-line bg-navy/60">
          {[{ id: null as string | null, label: `Same as the PC${pcVoiceName ? ` (${pcVoiceName})` : ""}`, sub: "Follows the voice picked in the Command Center" }, ...VOICE_META.map((v) => ({ id: v.id as string | null, label: v.displayName, sub: `${v.accent} · ${v.gender}` }))].map(
            (v) => {
              const selected = settings.voice === v.id;
              return (
                <div key={v.id ?? "pc"} className="flex items-center border-b border-line last:border-b-0">
                  <button type="button" onClick={() => updateSettings({ voice: v.id })} className="flex min-h-[56px] flex-1 items-center gap-3 px-4 text-left active:bg-white/5">
                    <span className={cn("flex h-5 w-5 items-center justify-center rounded-full border", selected ? "border-violet-400 bg-violet-500" : "border-gray-600")}>
                      {selected && <Check className="h-3 w-3 text-white" />}
                    </span>
                    <span>
                      <span className="block text-[15px] text-gray-100">{v.label}</span>
                      <span className="block text-[12px] text-gray-500">{v.sub}</span>
                    </span>
                  </button>
                  {selected && (
                    <button type="button" onClick={preview} aria-label="Hear it" className="mr-2 flex h-10 w-10 items-center justify-center rounded-full text-cyan-300 active:bg-white/10">
                      <Play className="h-4 w-4 fill-current" />
                    </button>
                  )}
                </div>
              );
            },
          )}
        </div>
      </section>

      <section className="mt-8">
        {confirming ? (
          <div className="rounded-3xl border border-red-400/25 bg-red-500/10 p-4">
            <p className="text-[15px] text-red-100">Unpair from {record.pcName}? You'll need to scan a new code on the PC to use it again.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <GhostButton onClick={() => setConfirming(false)}>Keep</GhostButton>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  void companion.unpair();
                }}
                className="h-12 rounded-2xl bg-red-500/90 text-[15px] font-semibold text-white active:bg-red-500"
                data-testid="confirm-unpair"
              >
                Unpair
              </button>
            </div>
          </div>
        ) : (
          <GhostButton onClick={() => setConfirming(true)} icon={<Unlink className="h-4 w-4 text-red-300" />} className="text-red-200" data-testid="unpair-button">
            Unpair this phone
          </GhostButton>
        )}
      </section>

      <p className="mt-6 text-center text-[12px] text-gray-600">Soundwave companion {APP_VERSION} · works while Soundwave AI runs on your PC</p>
    </Sheet>
  );
}
