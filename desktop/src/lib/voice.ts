import { neuralSpeak } from "./cloudBrain";

/* ── Speech-to-text (Web Speech API) ───────────────────────────────────── */

type SR = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

export function speechSupported(): boolean {
  const w = window as any;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function startListening(handlers: {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}): (() => void) | null {
  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) {
    handlers.onError("Voice input isn't available in this browser — try Chrome or Edge.");
    handlers.onEnd();
    return null;
  }
  const rec: SR = new Ctor();
  rec.lang = navigator.language || "en-US";
  rec.interimResults = true;
  rec.continuous = false;

  let finalText = "";
  rec.onresult = (e: any) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i += 1) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (interim) handlers.onPartial((finalText + interim).trim());
  };
  rec.onerror = (e: any) => handlers.onError(e?.error === "not-allowed" ? "Microphone permission was blocked." : `Mic error: ${e?.error || "unknown"}`);
  rec.onend = () => {
    if (finalText.trim()) handlers.onFinal(finalText.trim());
    handlers.onEnd();
  };

  try {
    rec.start();
  } catch {
    handlers.onError("Couldn't start the microphone.");
    handlers.onEnd();
    return null;
  }
  return () => {
    try {
      rec.abort();
    } catch {
      /* already stopped */
    }
  };
}

/* ── Text-to-speech ────────────────────────────────────────────────────── */

let currentAudio: HTMLAudioElement | null = null;

export function stopSpeaking() {
  currentAudio?.pause();
  currentAudio = null;
  window.speechSynthesis?.cancel();
}

/** Speak text: neural voice from the Soundwave server when available,
 *  otherwise the system voice. Never throws. */
export async function speakText(
  text: string,
  opts: { neuralVoice?: string; preferNeural?: boolean }
): Promise<void> {
  const plain = text
    .replace(/\*\*/g, "")
    .replace(/[•\-\n]+/g, " ")
    .slice(0, 600);
  if (!plain.trim()) return;
  stopSpeaking();

  if (opts.preferNeural && opts.neuralVoice) {
    const url = await neuralSpeak(plain, opts.neuralVoice);
    if (url) {
      currentAudio = new Audio(url);
      try {
        await currentAudio.play();
        return;
      } catch {
        /* fall through to system voice */
      }
    }
  }

  if (window.speechSynthesis) {
    const u = new SpeechSynthesisUtterance(plain);
    u.rate = 1.03;
    u.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((v) => v.lang.startsWith(navigator.language.slice(0, 2)));
    if (preferred) u.voice = preferred;
    window.speechSynthesis.speak(u);
  }
}

/** Ask for mic permission (used by onboarding step 3). */
export async function testMicrophone(): Promise<{ ok: boolean; level: number; error?: string }> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let peak = 0;
      for (let i = 0; i < 12; i += 1) {
        await new Promise((r) => setTimeout(r, 45));
        analyser.getByteFrequencyData(data);
        peak = Math.max(peak, Math.round((Math.max(...data) / 255) * 100));
      }
      await ctx.close();
      return { ok: true, level: peak };
    } finally {
      stream.getTracks().forEach((t) => t.stop());
    }
  } catch (e: any) {
    return { ok: false, level: 0, error: e?.name === "NotAllowedError" ? "Microphone blocked" : "No microphone found" };
  }
}
