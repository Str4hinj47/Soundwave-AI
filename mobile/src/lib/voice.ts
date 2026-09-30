// ── Voice on the phone ──────────────────────────────────────────────────────
// Recording uses the same recorder as the desktop app (16 kHz WAV, notices
// when you stop talking); the PC transcribes it with its local speech engine.
// Replies are read aloud in a Soundwave voice synthesized on the PC.

import { VoiceInputError, playEarcon, startRecording, type Recorder, type StopReason } from "../../../frontend/src/lib/voiceInput";
import workletUrl from "../../../frontend/public/audio/soundwave-recorder.worklet.js?url";

export { playEarcon, type Recorder, type StopReason };

export function startPhoneRecording(opts: { autoStop: boolean; onLevel: (level: number) => void; onAutoStop: (reason: StopReason) => void }): Promise<Recorder> {
  return startRecording({ ...opts, workletUrl });
}

/** What to tell the person when the microphone won't work. */
export function micProblem(err: unknown): string {
  if (err instanceof VoiceInputError) {
    switch (err.code) {
      case "denied":
        return "Soundwave needs your microphone. Allow it in Android Settings → Apps → Soundwave → Permissions → Microphone.";
      case "no-device":
        return "No microphone found on this phone.";
      case "busy":
        return "The microphone is busy — another app (a call, a recorder) may be using it.";
      case "unsupported":
        return "This phone's Android System WebView is too old to record audio. Update it from the Play Store.";
      default:
        return err.message.replace(/Windows[^.]*\.?/g, "").trim() || "The microphone couldn't start.";
    }
  }
  return (err as Error)?.message || "The microphone couldn't start.";
}

// ── Playback: one reply at a time ───────────────────────────────────────────

let player: HTMLAudioElement | null = null;
let playingUrl: string | null = null;
let onStopped: (() => void) | null = null;

export function stopSpeaking(): void {
  if (player) {
    player.pause();
    player.removeAttribute("src");
    player.load();
  }
  if (playingUrl) URL.revokeObjectURL(playingUrl);
  playingUrl = null;
  const cb = onStopped;
  onStopped = null;
  cb?.();
}

/** Plays an MP3 the PC made; resolves when it ends (or is stopped / fails). */
export function playReply(bytes: Uint8Array, mime: string): Promise<void> {
  stopSpeaking();
  player ??= new Audio();
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime || "audio/mpeg" }));
  playingUrl = url;
  const audio = player;
  return new Promise<void>((resolve) => {
    const done = () => {
      audio.onended = null;
      audio.onerror = null;
      if (playingUrl === url) {
        URL.revokeObjectURL(url);
        playingUrl = null;
      }
      onStopped = null;
      resolve();
    };
    onStopped = done;
    audio.onended = done;
    audio.onerror = done;
    audio.src = url;
    audio.play().catch(done);
  });
}

/** What of a message is worth saying out loud (no links, no background credits). */
export function speakable(m: { text: string; jobState?: string; topic?: string; youtubeUrl?: string }): string {
  if (m.jobState === "done") return `Your short about ${m.topic || "that"} is ready${m.youtubeUrl ? ", and it's up on YouTube" : ""}.`;
  if (m.jobState === "failed") return `I couldn't finish the short about ${m.topic || "that"}.`;
  return m.text
    .split("\n")
    .filter((line) => !/^\s*Background:/i.test(line))
    .join(" ")
    .replace(/https?:\/\/[^\s)]+/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 700);
}
