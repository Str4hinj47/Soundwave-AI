// ── Edge TTS directly from the browser (standalone build) ──────────────────
// Same free, key-less Microsoft Edge neural TTS service the server uses —
// reached over a plain WebSocket, so no CORS restrictions apply and no API
// server is needed. Produces 24 kHz mono MP3 plus word-boundary timings.

export interface BrowserEdgeWordTiming {
  word: string;
  start: number; // seconds
  end: number; // seconds
}

export interface BrowserEdgeResult {
  audioBase64: string;
  mimeType: "audio/mpeg";
  duration: number;
  wordTimings: BrowserEdgeWordTiming[];
}

const TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WS_URL = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
const OUTPUT_FORMAT = "audio-24khz-96kbitrate-mono-mp3";

function hex32(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

function tsHeader(): string {
  return new Date().toISOString();
}

/** Studio "speed" is a multiplier (0.5..2.0) → SSML rate percentage. */
function rateString(speed: number | undefined): string {
  if (speed == null || speed === 1) return "default";
  const pct = Math.round((speed - 1) * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}
function pitchString(pitch: number | undefined): string {
  if (pitch == null || pitch === 0) return "default";
  const pct = Math.round(Math.min(50, Math.max(-50, pitch)));
  return `${pct > 0 ? "+" : ""}${pct}%`;
}
function volumeString(volume: number | undefined): string {
  if (volume == null || volume >= 100) return "default";
  const pct = Math.round(Math.min(0, Math.max(-100, volume - 100)));
  return `${pct}%`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSsml(text: string, voice: string, speed?: number, pitch?: number, volume?: number): string {
  return (
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${voice.slice(0, 5)}'>` +
    `<voice name='${voice}'>` +
    `<prosody pitch='${pitchString(pitch)}' rate='${rateString(speed)}' volume='${volumeString(volume)}'>` +
    escapeXml(text) +
    `</prosody></voice></speak>`
  );
}

interface WordBoundaryData {
  Offset?: number;
  offset?: number;
  Duration?: number;
  duration?: number;
  text?: { Text?: string };
}
interface MetadataPacket {
  Metadata?: Array<{ Type?: string; Data?: WordBoundaryData }>;
}

/** Synthesize via the Edge readaloud WebSocket. Browsers open cross-origin
 *  WebSockets freely, which is what makes the standalone (serverless) build
 *  possible at full voice quality. */
export async function synthesizeBrowserEdge(
  text: string,
  voice: string,
  settings: { speed?: number; pitch?: number; volume?: number } = {},
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BrowserEdgeResult> {
  return new Promise<BrowserEdgeResult>((resolve, reject) => {
    const url = `${WS_URL}?TrustedClientToken=${TOKEN}&ConnectionId=${hex32()}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      reject(e instanceof Error ? e : new Error("Could not open the speech connection."));
      return;
    }
    ws.binaryType = "arraybuffer";

    const audioChunks: Uint8Array[] = [];
    const wordTimings: BrowserEdgeWordTiming[] = [];
    let done = false;

    const cleanup = () =>
      opts.signal?.removeEventListener("abort", onAbort);

    const fail = (message: string) => {
      if (done) return;
      done = true;
      cleanup();
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      reject(new Error(message));
    };

    const timer = window.setTimeout(
      () => fail("Speech service timed out. Check your internet connection."),
      opts.timeoutMs ?? 30_000,
    );
    timerRefCleanup(fail, () => window.clearTimeout(timer));

    function timerRefCleanup(_f: unknown, clear: () => void) {
      // keep timer alive until finish/fail calls clear below
      finishClearFns.push(clear);
    }
    const finishClearFns: Array<() => void> = [];

    const onAbort = () => fail("cancelled");
    opts.signal?.addEventListener("abort", onAbort);

    const finish = () => {
      if (done) return;
      done = true;
      finishClearFns.forEach((f) => f());
      cleanup();
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      const total = audioChunks.reduce((n, c) => n + c.length, 0);
      if (total === 0) {
        reject(new Error("The speech service returned no audio."));
        return;
      }
      const bytes = new Uint8Array(total);
      let off = 0;
      for (const c of audioChunks) {
        bytes.set(c, off);
        off += c.length;
      }
      // Base64 in chunks — the payload can be several MB for long scripts.
      let bin = "";
      const CH = 0x8000;
      for (let i = 0; i < bytes.length; i += CH) {
        bin += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + CH)));
      }
      resolve({
        audioBase64: btoa(bin),
        mimeType: "audio/mpeg",
        duration: (bytes.length * 8) / 96000 /* 96 kbps CBR estimate */,
        wordTimings,
      });
    };

    ws.onopen = () => {
      const config =
        `X-Timestamp:${tsHeader()}\r\nContent-Type:application/json; charset=utf-8\r\n` +
        `Path:speech.config\r\n\r\n` +
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: { sentenceBoundaryEnabled: "false", wordBoundaryEnabled: "true" },
                outputFormat: OUTPUT_FORMAT,
              },
            },
          },
        });
      const ssml =
        `X-RequestId:${hex32()}\r\nContent-Type:application/ssml+xml\r\n` +
        `X-Timestamp:${tsHeader()}\r\nPath:ssml\r\n\r\n` +
        buildSsml(text, voice, settings.speed, settings.pitch, settings.volume);
      ws.send(config);
      ws.send(ssml);
    };

    ws.onmessage = (ev: MessageEvent) => {
      if (typeof ev.data === "string") {
        const msg = ev.data as string;
        if (msg.includes("Path:audio.metadata")) {
          const body = msg.slice(msg.indexOf("\r\n\r\n") + 4);
          try {
            const parsed = JSON.parse(body) as MetadataPacket;
            for (const m of parsed.Metadata ?? []) {
              if (m?.Type !== "WordBoundary" || !m.Data) continue;
              const offTicks = m.Data.Offset ?? m.Data.offset ?? 0;
              const durTicks = m.Data.Duration ?? m.Data.duration ?? 0;
              const w = m.Data.text?.Text ?? "";
              if (!w) continue;
              wordTimings.push({ word: w, start: offTicks / 1e7, end: (offTicks + durTicks) / 1e7 });
            }
          } catch {
            /* malformed metadata — timings fall back to estimation */
          }
        } else if (msg.includes("Path:turn.end")) {
          finish();
        } else if (msg.includes("Path:turn.error") || msg.includes("Path:response") && msg.includes("Failure")) {
          fail("The speech service rejected the request.");
        }
      } else if (ev.data instanceof ArrayBuffer) {
        const view = new DataView(ev.data);
        if (view.byteLength < 2) return;
        const headerLen = view.getUint16(0);
        const header = new TextDecoder().decode(new Uint8Array(ev.data, 2, headerLen));
        if (header.includes("Path:audio")) {
          audioChunks.push(new Uint8Array(ev.data, 2 + headerLen));
        }
      }
    };

    ws.onerror = () =>
      fail("Could not reach the speech service. The standalone build needs internet for AI voices (and an http(s) page — if you opened this file directly, try serving it or keep using it, voices should still work in most browsers).");
    ws.onclose = (e) => {
      if (!done && !e.wasClean) fail("The speech connection closed unexpectedly.");
      else if (!done) fail("The speech connection closed before audio finished.");
    };
  });
}
