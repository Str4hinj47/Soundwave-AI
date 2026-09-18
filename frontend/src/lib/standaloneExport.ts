// ── In-browser video export (single-file standalone build) ─────────────────
// Composites the background video, burned captions and the generated voice on
// a <canvas>, encodes with the hardware/driver-backed MediaRecorder, and
// returns a single combined file — the same job the server's FFmpeg job does
// in the full build, with no server and no FFmpeg.
//
// Timing model mirrors the app: the voice audio is the master clock
// (AudioContext.currentTime), frames are produced at the requested fps.

import type { SubtitleCue, SubtitleStyle } from "./types";

export interface StandaloneExportInput {
  videoBlob: Blob | null;
  audioBlob: Blob;
  cues: Array<Pick<SubtitleCue, "start" | "end" | "text">>;
  style: SubtitleStyle;
  resolution: "720p" | "1080p" | "1440p" | "4K";
  aspect: "16:9" | "9:16";
  /** Preferred container: we honour it when the browser can encode it. */
  format: "mp4" | "webm";
  quality: "low" | "medium" | "high";
  fps: number;
  /** 0..1 */
  audioVolume: number;
  fadeIn: number;
  fadeOut: number;
  /** Explicit output length (seconds); undefined = end with the voice. */
  videoEnd?: number;
  /** Solid background color when no background video is attached. */
  bgColor?: string;
  onProgress?: (frac: number, status: string) => void;
}

export interface StandaloneExportResult {
  blob: Blob;
  url: string;
  mimeType: string;
  ext: "mp4" | "webm";
  duration: number;
  width: number;
  height: number;
}

const RESOLUTIONS: Record<StandaloneExportInput["resolution"], { width: number; height: number }> = {
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
  "1440p": { width: 2560, height: 1440 },
  "4K": { width: 3840, height: 2160 },
};

const FALLBACK_BG = "#0A0F1C"; // matches the full build's solid background
const WORD_HIGHLIGHT = "#E0FD00"; // wordByWord highlight from server ASS styling

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function hexToRgba(hex: string, opacityPct: number): string {
  const clean = (hex ?? "#FFFFFF").replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) || 255;
  const g = parseInt(clean.slice(2, 4), 16) || 255;
  const b = parseInt(clean.slice(4, 6), 16) || 255;
  const a = clamp(opacityPct, 0, 100) / 100;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function pickMimeType(preferred: "mp4" | "webm"): string | null {
  const mp4 = ["video/mp4;codecs=avc1.42E02A,mp4a.40.2", "video/mp4"];
  const webm = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  const order = preferred === "mp4" ? [...mp4, ...webm] : [...webm, ...mp4];
  for (const mt of order) {
    try {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mt)) return mt;
    } catch {
      /* probe next */
    }
  }
  return null;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

interface ActiveAnim {
  alphaIn: number; // 0..1
  alphaOut: number;
  offX: number;
  offY: number;
  scaleMul: number;
}

function cueAnim(cueStart: number, cueEnd: number, style: SubtitleStyle, t: number): ActiveAnim {
  const durMs = style.animDuration ?? 250;
  const durSec = Math.max(0.01, durMs / 1000);
  const since = t - cueStart;
  const until = cueEnd - t;
  const k = clamp(since / durSec, 0, 1);
  const animIn = style.animIn ?? "fade";
  const fadeIn = animIn === "fade" ? k : 1;
  const fadeOut = style.animOut === "fade" ? clamp(until / durSec, 0, 1) : 1;
  let offX = 0;
  let offY = 0;
  let scaleMul = 1;
  if (since < durSec) {
    const inv = 1 - k;
    if (animIn === "slideUp") offY = 60 * inv;
    else if (animIn === "slideDown") offY = -60 * inv;
    else if (animIn === "slideLeft") offX = 80 * inv;
    else if (animIn === "slideRight") offX = -80 * inv;
    else if (animIn === "scale") scaleMul = 0.6 + 0.4 * k;
  }
  return { alphaIn: fadeIn, alphaOut: fadeOut, offX, offY, scaleMul };
}

/** Wrap cue text to fit maxWidth, canvas-measured (greedy word wrap). */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const words = raw.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = words[0]!;
    for (let i = 1; i < words.length; i++) {
      const test = `${line} ${words[i]}`;
      if (ctx.measureText(test).width <= maxWidth) line = test;
      else {
        out.push(line);
        line = words[i]!;
      }
    }
    out.push(line);
  }
  return out.slice(0, 6);
}

function drawCueFrame(
  ctx: CanvasRenderingContext2D,
  cue: Pick<SubtitleCue, "start" | "end" | "text">,
  style: SubtitleStyle,
  W: number,
  H: number,
  t: number,
) {
  const scale = Math.min(W / 1280, H / 720);
  // Portrait: +35% size and centered-by-default captions (same as server). 
  const portrait = H > W;
  const px = Math.round((style.fontSize ?? 48) * scale * (portrait ? 1.35 : 1));
  const lineGap = px * (style.lineHeight ?? 1.2);
  const margin = Math.round((style.margin ?? 40) * scale);
  ctx.save();
  ctx.font = `${style.fontWeight ?? 700} ${px}px '${style.fontFamily ?? "Inter"}', sans-serif`;
  try {
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${(style.letterSpacing ?? 0) * scale}px`;
  } catch {
    /* older engines */
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  // Word-by-word / typewriter reveal (mirrors the ASS cumulative events).
  let textToDraw = cue.text;
  let highlightWordsFrom = -1;
  const isWordAnim = style.animIn === "wordByWord" || style.animIn === "typewriter";
  if (isWordAnim) {
    const words = cue.text.split(/\s+/).filter(Boolean);
    if (words.length > 1) {
      const p = clamp((t - cue.start) / Math.max(0.05, cue.end - cue.start), 0, 1);
      const shown = Math.max(1, Math.min(words.length, Math.ceil(p * words.length)));
      textToDraw = words.slice(0, shown).join(" ");
      if (style.animIn === "wordByWord" && shown < words.length) highlightWordsFrom = shown - 1;
    }
  }

  const anim = cueAnim(cue.start, cue.end, style, t);
  const alpha = clamp(anim.alphaIn * anim.alphaOut, 0, 1);
  if (alpha <= 0) {
    ctx.restore();
    return;
  }

  const lines = wrapLines(ctx, textToDraw, W - 2 * margin - 40 * scale);
  const widths = lines.map((l) => ctx.measureText(l).width);
  const blockW = widths.length ? Math.max(...widths) : 0;
  const blockH = lines.length > 0 ? lineGap * (lines.length - 1) + px : px;

  const animScale = anim.scaleMul;
  const noCustomPos = style.customX == null && style.customY == null;
  const effH = portrait && noCustomPos ? "center" : style.hAlign;
  const effV = portrait && noCustomPos ? "middle" : style.vAlign;
  const cx =
    style.customX != null ? (style.customX / 100) * W
    : effH === "left" ? margin + blockW / 2
    : effH === "right" ? W - margin - blockW / 2
    : W / 2;
  const cy =
    style.customY != null ? (style.customY / 100) * H
    : effV === "top" ? margin + blockH / 2
    : effV === "middle" ? H / 2
    : H - margin - blockH / 2;

  ctx.globalAlpha = alpha;
  ctx.translate(cx + anim.offX * (1 - alpha) * 0 + anim.offX, cy + anim.offY);
  if (animScale !== 1) ctx.scale(animScale, animScale);
  ctx.translate(-cx, -cy);

  const topY = cy - blockH / 2;
  const leftX = cx - blockW / 2;

  // Background box
  if ((style.bgOpacity ?? 0) > 0) {
    const padY = (style.bgPadding ?? 8) * scale;
    const padX = padY * 1.6;
    ctx.fillStyle = hexToRgba(style.bgColor ?? "#000000", style.bgOpacity ?? 0);
    roundRectPath(ctx, leftX - padX, topY - padY, blockW + 2 * padX, blockH + 2 * padY, (style.bgRadius ?? 4) * scale);
    ctx.fill();
  }

  if (style.shadowEnabled) {
    ctx.shadowColor = hexToRgba(style.shadowColor ?? "#000000", 80);
    ctx.shadowBlur = (style.shadowBlur ?? 6) * scale;
    ctx.shadowOffsetX = (style.shadowX ?? 0) * scale;
    ctx.shadowOffsetY = (style.shadowY ?? 2) * scale;
  }

  const fill = hexToRgba(style.color ?? "#FFFFFF", style.textOpacity ?? 100);
  const strokeOn = style.strokeEnabled && (style.strokeWidth ?? 0) > 0;
  if (strokeOn) {
    ctx.lineWidth = (style.strokeWidth ?? 0) * 2 * scale;
    ctx.strokeStyle = hexToRgba(style.strokeColor ?? "#000000", 100);
    ctx.lineJoin = "round";
  }

  lines.forEach((line, i) => {
    let x = cx - widths[i]! / 2;
    if (style.hAlign === "left") x = leftX;
    if (style.hAlign === "right") x = leftX + (blockW - widths[i]!);
    const y = topY + i * lineGap;
    if (highlightWordsFrom >= 0 && isWordAnim) {
      // Fill everything before the last word normally, last word highlighted.
      const words = line.split(" ");
      const lineTextBefore = words.slice(0, -1).join(" ");
      if (lineTextBefore) {
        if (strokeOn) ctx.strokeText(lineTextBefore, x, y);
        ctx.fillStyle = fill;
        ctx.fillText(lineTextBefore, x, y);
      }
      const lastWord = words[words.length - 1]!;
      const lx = x + (lineTextBefore ? ctx.measureText(`${lineTextBefore} `).width : 0);
      if (strokeOn) ctx.strokeText(lastWord, lx, y);
      ctx.fillStyle = WORD_HIGHLIGHT;
      ctx.fillText(lastWord, lx, y);
    } else {
      if (strokeOn) ctx.strokeText(line, x, y);
      ctx.fillStyle = fill;
      ctx.fillText(line, x, y);
    }
  });
  ctx.restore();
}

export async function exportVideoStandalone(input: StandaloneExportInput): Promise<StandaloneExportResult> {
  const { onProgress } = input;
  onProgress?.(0.01, "Preparing audio…");

  if (!input.audioBlob || input.audioBlob.size === 0) throw new Error("No voiceover audio to export.");

  const dims0 = RESOLUTIONS[input.resolution] ?? RESOLUTIONS["720p"];
  const width = input.aspect === "9:16" ? dims0.height : dims0.width;
  const height = input.aspect === "9:16" ? dims0.width : dims0.height;

  const audioCtx = new AudioContext();
  try {
    const audioBuffer = await audioCtx.decodeAudioData(await input.audioBlob.arrayBuffer());
    const duration = Math.max(
      0.3,
      input.videoEnd && input.videoEnd > 0 ? Math.min(input.videoEnd, 7200) : audioBuffer.duration,
    );

    // Background video element (kept looping; the voice decides the end).
    let videoEl: HTMLVideoElement | null = null;
    let videoUrl: string | null = null;
    if (input.videoBlob) {
      onProgress?.(0.03, "Preparing video…");
      videoEl = document.createElement("video");
      videoEl.muted = true;
      videoEl.loop = true;
      videoEl.playsInline = true;
      videoEl.preload = "auto";
      videoUrl = URL.createObjectURL(input.videoBlob);
      videoEl.src = videoUrl;
      await new Promise<void>((resolve, reject) => {
        const el = videoEl!;
        el.onloadeddata = () => resolve();
        el.onerror = () => reject(new Error("This browser could not decode the background video. Try re-encoding it as MP4 (H.264)."));
      });
    }

    onProgress?.(0.05, "Starting encoder…");
    const mimeType = pickMimeType(input.format);
    if (!mimeType) throw new Error("This browser has no usable MediaRecorder encoder (try Chrome or Edge).");

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is unavailable.");

    const canvasStream = canvas.captureStream(0);
    const videoTrack = canvasStream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
    const dest = audioCtx.createMediaStreamDestination();
    const gain = audioCtx.createGain();
    const src = audioCtx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(gain);
    gain.connect(dest);

    const baseVol = clamp(input.audioVolume ?? 1, 0, 2);
    const startAt = audioCtx.currentTime + 0.15;
    const endAt = startAt + duration;
    if (input.fadeIn > 0) {
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.linearRampToValueAtTime(baseVol, startAt + clamp(input.fadeIn, 0, 30));
    } else {
      gain.gain.setValueAtTime(baseVol, startAt);
    }
    if (input.fadeOut > 0) {
      gain.gain.setValueAtTime(baseVol, Math.max(startAt, endAt - clamp(input.fadeOut, 0, 30)));
      gain.gain.linearRampToValueAtTime(0.0001, endAt);
    }

    const audioTrack = dest.stream.getAudioTracks()[0];
    const mixed = new MediaStream([videoTrack, ...(audioTrack ? [audioTrack] : [])]);
    const mult = Math.max(1, (width * height) / (1280 * 720));
    const videoBps = (input.quality === "low" ? 4_000_000 : input.quality === "high" ? 16_000_000 : 8_000_000) * mult;
    const recorder = new MediaRecorder(mixed, {
      mimeType,
      videoBitsPerSecond: videoBps,
      audioBitsPerSecond: 192_000,
    });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const fps = clamp(Math.round(input.fps || 30), 1, 60);
    const frameEvery = 1 / fps;
    const cues = [...input.cues].sort((a, b) => a.start - b.start);

    const drawFrame = (t: number) => {
      if (videoEl && videoEl.videoWidth > 0) {
        // "contain" letterbox — same math as FFmpeg scale=decrease + pad.
        const s = Math.min(width / videoEl.videoWidth, height / videoEl.videoHeight);
        const dw = videoEl.videoWidth * s;
        const dh = videoEl.videoHeight * s;
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(videoEl, (width - dw) / 2, (height - dh) / 2, dw, dh);
      } else {
        ctx.fillStyle = input.bgColor ?? FALLBACK_BG;
        ctx.fillRect(0, 0, width, height);
      }
      // Last active cue wins, mirroring cue stacking in the ASS dialogue model.
      let active: (typeof cues)[number] | null = null;
      for (const c of cues) {
        if (c.start <= t && t < c.end) active = c;
        if (c.start > t) break;
      }
      if (active && active.text.trim()) drawCueFrame(ctx, active, input.style, width, height, t);
    };

    onProgress?.(0.07, "Rendering… (keep this tab visible)");
    const done = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.start(250);

    if (videoEl) {
      try {
        await videoEl.play();
      } catch {
        /* autoplay policies — frames still draw from current position */
      }
    }
    src.start(startAt, 0, duration + 0.05);

    await new Promise<void>((resolveRender) => {
      let lastFrame = -1;
      const tick = () => {
        const t = audioCtx.currentTime - startAt;
        if (t >= duration || audioCtx.state === "closed") {
          resolveRender();
          return;
        }
        if (t >= 0) {
          if (t - lastFrame >= frameEvery * 0.98) {
            drawFrame(t);
            try {
              videoTrack.requestFrame?.();
            } catch {
              /* track stopped */
            }
            lastFrame = t;
          }
          onProgress?.(0.08 + 0.9 * (t / duration), `Rendering… ${Math.floor(t)}s / ${Math.ceil(duration)}s`);
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    drawFrame(duration - 1e-3);
    try {
      videoTrack.requestFrame?.();
    } catch {
      /* ignore */
    }

    try {
      src.stop();
    } catch {
      /* already ended */
    }
    videoEl?.pause();
    onProgress?.(0.99, "Finalizing file…");
    recorder.stop();
    await done;

    audioTrack?.stop();
    videoTrack.stop();
    if (videoUrl) URL.revokeObjectURL(videoUrl);

    const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
    if (blob.size === 0) throw new Error("The encoder produced an empty file. Try a different format or a shorter clip.");
    const ext = mimeType.startsWith("video/mp4") ? "mp4" : "webm";
    onProgress?.(1, "Done");
    return { blob, url: URL.createObjectURL(blob), mimeType, ext, duration, width, height };
  } finally {
    // Close quietly; rendering may finish while the tab throttles.
    void audioCtx.close().catch(() => undefined);
  }
}
