// ── What the app remembers (Capacitor Preferences = app-private storage) ────

import { Preferences } from "@capacitor/preferences";
import { decodeRecord, encodeRecord, type Conversation, type PairingRecord } from "./client";

const KEYS = {
  pairing: "soundwave.pairing",
  conversation: "soundwave.conversation",
  settings: "soundwave.settings",
};

export type SpeakMode = "voice" | "always" | "never";

export interface AppSettings {
  /** Read replies aloud: only answers to what you said by voice (default), always, or never. */
  speak: SpeakMode;
  /** Soundwave voice for replies; null = the one picked on the PC. */
  voice: string | null;
}

export const DEFAULT_SETTINGS: AppSettings = { speak: "voice", voice: null };

async function get(key: string): Promise<string | null> {
  try {
    return (await Preferences.get({ key })).value;
  } catch {
    return null;
  }
}

async function set(key: string, value: string | null): Promise<void> {
  try {
    if (value === null) await Preferences.remove({ key });
    else await Preferences.set({ key, value });
  } catch {
    /* storage unavailable */
  }
}

export const storage = {
  async loadPairing(): Promise<PairingRecord | null> {
    return decodeRecord(await get(KEYS.pairing));
  },
  savePairing(r: PairingRecord | null): Promise<void> {
    return set(KEYS.pairing, r ? encodeRecord(r) : null);
  },
  async loadConversation(): Promise<Conversation | null> {
    try {
      const c = JSON.parse((await get(KEYS.conversation)) ?? "null") as Conversation | null;
      return c && Array.isArray(c.messages) ? c : null;
    } catch {
      return null;
    }
  },
  saveConversation(c: Conversation | null): Promise<void> {
    return set(KEYS.conversation, c ? JSON.stringify({ ...c, messages: c.messages.slice(-60) }) : null);
  },
  async loadSettings(): Promise<AppSettings> {
    try {
      const s = JSON.parse((await get(KEYS.settings)) ?? "{}") as Partial<AppSettings>;
      return {
        speak: s.speak === "always" || s.speak === "never" ? s.speak : "voice",
        voice: typeof s.voice === "string" ? s.voice : null,
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  },
  saveSettings(s: AppSettings): Promise<void> {
    return set(KEYS.settings, JSON.stringify(s));
  },
  /** "Unpair": forget the PC and everything from it. */
  async clearAll(): Promise<void> {
    await Promise.all([set(KEYS.pairing, null), set(KEYS.conversation, null)]);
  },
};
