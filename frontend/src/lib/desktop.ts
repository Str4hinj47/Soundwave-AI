// ── The Windows desktop app's bridge ────────────────────────────────────────
// desktop/src/preload.cjs exposes `window.soundwaveDesktop` (contextBridge) to
// the app's own pages. In a normal browser it's absent and every caller falls
// back to web behaviour.

export interface DesktopSettings {
  /** Electron accelerator for the global voice shortcut, e.g. "Control+Shift+Space". */
  hotkey: string;
  hotkeyEnabled: boolean;
  /** Closing the window keeps the app (hotkey, notifications, renders) running in the tray. */
  closeToTray: boolean;
  /** Start with Windows (in the tray). */
  openAtLogin: boolean;
  /** Windows notifications when a short is ready / fails. */
  notifications: boolean;
}

export interface DesktopState extends DesktopSettings {
  version: string;
  hotkeyLabel: string;
  hotkeyRegistered: boolean;
  hotkeyError: string | null;
  hotkeyChoices: Array<{ accelerator: string; label: string }>;
}

/** Sent by the desktop shell when the voice shortcut / tray "Talk" is used. */
export type VoiceCommand = "toggle" | "start" | "stop" | "cancel";

export interface DesktopNotification {
  title: string;
  body?: string;
  /** In-app route opened when the notification is clicked. */
  route?: string;
}

export interface SoundwaveDesktop {
  readonly isDesktop: true;
  getState(): Promise<DesktopState>;
  updateSettings(patch: Partial<DesktopSettings>): Promise<DesktopState>;
  /** The main window is visible and focused. */
  isAppFocused(): Promise<boolean>;
  onVoiceCommand(callback: (command: VoiceCommand) => void): () => void;
  onNavigate(callback: (route: string) => void): () => void;
  notify(notification: DesktopNotification): void;
  showApp(route?: string): void;
  hideOverlay(): void;
  setVoiceState(state: "idle" | "listening" | "working"): void;
  openMicrophoneSettings(): void;
}

declare global {
  interface Window {
    soundwaveDesktop?: SoundwaveDesktop;
  }
}

export function getDesktop(): SoundwaveDesktop | null {
  if (typeof window === "undefined") return null;
  const bridge = window.soundwaveDesktop;
  return bridge && bridge.isDesktop ? bridge : null;
}

export const DEFAULT_HOTKEY = "Control+Shift+Space";

/** "Control+Shift+Space" → "Ctrl+Shift+Space" */
export function hotkeyLabel(accelerator: string): string {
  return accelerator.replace(/\b(CommandOrControl|CmdOrCtrl|Control)\b/g, "Ctrl");
}
