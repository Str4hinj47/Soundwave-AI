import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clapperboard,
  Download,
  FileVideo,
  Monitor,
  Music,
  Pause,
  Play,
  Scissors,
  Smartphone,
  Trash2,
  Upload,
  Youtube,
} from "lucide-react";
import { useStudio } from "../store/studio";
import { useAuth } from "../store/auth";
import { toast } from "../store/toast";
import { http } from "../lib/api";
import { cn } from "../lib/cn";
import { formatBytes, formatDuration } from "../lib/format";
import { decodeAudioBlob } from "../lib/audio";
import { Waveform } from "../components/Waveform";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Slider } from "../components/ui/Slider";
import { ProgressBar } from "../components/ui/ProgressBar";
import { Badge } from "../components/ui/Badge";
import { Toggle } from "../components/ui/Toggle";
import { ColorPicker } from "../components/ui/ColorPicker";
import { subtitleStyleToCss, subtitlePosition } from "../lib/subtitleStyle";
import { PLANS, type Plan } from "../lib/plans";
import type { SubtitleCue } from "../lib/types";

type Resolution = "720p" | "1080p" | "1440p" | "4K";
type Aspect = "16:9" | "9:16";

const RES_ORDER: Resolution[] = ["720p", "1080p", "1440p", "4K"];

const RES_DIMS: Record<Resolution, [number, number]> = {
  "720p": [1280, 720],
  "1080p": [1920, 1080],
  "1440p": [2560, 1440],
  "4K": [3840, 2160],
};

/** Pixel dimensions label honoring the chosen aspect (9:16 swaps the axes). */
function dimsLabel(r: Resolution, aspect: Aspect): string {
  const [w, h] = RES_DIMS[r];
  return aspect === "9:16" ? `${h}×${w}` : `${w}×${h}`;
}

export function VideoCompositor() {
  const navigate = useNavigate();
  const studio = useStudio();
  const { user } = useAuth();
  const plan: Plan = (user?.plan as Plan) ?? "FREE";
  const planDef = PLANS[plan];

  const [videoUrl, setVideoUrl] = useState<string | null>(studio.video.url);
  const [videoName, setVideoName] = useState<string | null>(studio.video.name);
  const [videoFileKey, setVideoFileKey] = useState<string | null>(studio.video.fileKey);
  const [uploading, setUploading] = useState(false);
  const [ytUrl, setYtUrl] = useState("");
  const [ytImporting, setYtImporting] = useState(false);
  const [bgColor, setBgColor] = useState("#0A0F1C");

  const [decodedAudio, setDecodedAudio] = useState<AudioBuffer | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioVolume, setAudioVolume] = useState(100);
  const [fadeIn, setFadeIn] = useState(0);
  const [fadeOut, setFadeOut] = useState(0);
  const [zoom, setZoom] = useState(1);

  const [resolution, setResolution] = useState<Resolution>(planDef.maxResolution as Resolution);
  const [aspect, setAspect] = useState<Aspect>("16:9");
  const [format, setFormat] = useState<"mp4" | "webm">("mp4");
  const [quality, setQuality] = useState<"low" | "medium" | "high">("medium");
  const [fps, setFps] = useState(30);

  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState<string>("");
  const [exportError, setExportError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewW, setPreviewW] = useState(0);

  // ── Preview transport (play/pause with the actual voiceover audible) ──────
  const audioRef = useRef<HTMLAudioElement>(null);
  const rafRef = useRef<number>(0);
  const [playing, setPlaying] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // ── Video length: auto-end at voiceover end (default) or a manual cut ─────
  const [fitToVoice, setFitToVoice] = useState(true);
  const [trimEnd, setTrimEnd] = useState(0); // 0 = natural end

  const cues: SubtitleCue[] = studio.cues;
  const style = studio.subtitleStyle;
  const audioDuration = studio.audioBuffer?.duration ?? studio.lastDuration;
  const hasAudio = studio.audioBlob != null;
  const naturalMax = Math.max(audioDuration, videoDuration, 1);
  /** How long the composed video runs on the timeline/export. */
  const timelineEnd = fitToVoice
    ? Math.max(audioDuration, 0.1)
    : trimEnd > 0
      ? Math.min(trimEnd, naturalMax)
      : naturalMax;
  // Back-compat alias used by the timeline rendering below.
  const duration = timelineEnd;

  // Object URL for voiceover playback in the preview.
  useEffect(() => {
    if (!studio.audioBlob) {
      setAudioUrl(null);
      return;
    }
    const url = URL.createObjectURL(studio.audioBlob);
    setAudioUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setAudioUrl(null);
    };
  }, [studio.audioBlob]);

  // Preview volume follows the export volume slider.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = Math.min(1, Math.max(0, audioVolume / 100));
  }, [audioVolume]);

  const stopRaf = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  };

  const pausePreview = useCallback(() => {
    audioRef.current?.pause();
    const v = videoRef.current;
    if (v) v.pause();
    stopRaf();
    setPlaying(false);
  }, []);

  const playPreview = useCallback(() => {
    const a = audioRef.current;
    const v = videoRef.current;
    if (!a?.currentSrc && !v?.src) return;

    // If we're at (or past) the end, restart from the beginning.
    if (timelineEnd > 0 && currentTime >= timelineEnd - 0.05) {
      setCurrentTime(0);
      if (a) a.currentTime = 0;
      if (v) v.currentTime = 0;
    }
    if (a?.currentSrc) void a.play().catch(() => undefined);
    if (v?.src) void v.play().catch(() => undefined);
    setPlaying(true);

    stopRaf();
    const tick = () => {
      // The voiceover is the master clock; fall back to the video element.
      const t = a?.currentSrc && !a.paused ? a.currentTime : v ? v.currentTime : 0;
      setCurrentTime(t);
      if (timelineEnd > 0 && t >= timelineEnd) {
        pausePreview();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [currentTime, pausePreview, timelineEnd]);

  // Sync elements when the user seeks (waveform click) or time jumps.
  useEffect(() => {
    const v = videoRef.current;
    if (v && Math.abs(v.currentTime - currentTime) > 0.25) v.currentTime = currentTime;
    const a = audioRef.current;
    if (a && a.currentSrc && (a.paused || !playing) && Math.abs(a.currentTime - currentTime) > 0.25) {
      a.currentTime = currentTime;
    }
  }, [currentTime, playing]);

  // Stop when the voiceover ends naturally.
  useEffect(() => {
    const a = audioRef.current;
    if (a) a.onended = () => pausePreview();
    return stopRaf;
  }, [pausePreview, audioUrl]);

  // Reset transport when the audio/video source changes.
  useEffect(() => {
    pausePreview();
    setCurrentTime(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl, videoUrl]);

  // Measure the preview box so subtitle px values scale with its real width.
  // Exports are laid out against a 1280-unit reference, so the rendered text
  // keeps the same proportions on screen (both 16:9 and 9:16).
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setPreviewW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const k = (previewW > 0 ? previewW : 768) / 1280;

  useEffect(() => {
    if (studio.audioBuffer) setDecodedAudio(studio.audioBuffer);
    else if (studio.audioBlob) void decodeAudioBlob(studio.audioBlob).then(setDecodedAudio).catch(() => undefined);
  }, [studio.audioBuffer, studio.audioBlob]);

  // Keep video in sync with the audio time.
  useEffect(() => {
    const v = videoRef.current;
    if (v && Math.abs(v.currentTime - currentTime) > 0.25) v.currentTime = currentTime;
  }, [currentTime]);

  const maxResolutionIdx = RES_ORDER.indexOf(planDef.maxResolution as Resolution);

  const onFile = useCallback(
    async (file: File) => {
      if (!/video\/(mp4|webm|quicktime)|\.(mp4|mov|webm|avi)$/i.test(file.type + " " + file.name)) {
        toast.error("Invalid file", "Upload an MP4, MOV, WEBM, or AVI video.");
        return;
      }
      if (file.size > planDef.maxVideoMb * 1024 * 1024) {
        toast.error("File too large", `Your plan allows up to ${planDef.maxVideoMb}MB videos.`);
        return;
      }
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await http.upload<{ fileKey: string }>("/upload/video", fd);
        setVideoFileKey(res.fileKey);
        const url = URL.createObjectURL(file);
        setVideoUrl(url);
        setVideoName(file.name);
        studio.setVideo({ blob: file, url, name: file.name, fileKey: res.fileKey });
        toast.success("Video uploaded", file.name);
      } catch (e) {
        toast.error("Upload failed", (e as Error).message);
      } finally {
        setUploading(false);
      }
    },
    [planDef.maxVideoMb, studio],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void onFile(file);
  };

  const clearVideo = () => {
    setVideoUrl(null);
    setVideoName(null);
    setVideoFileKey(null);
    studio.setVideo({ blob: null, url: null, name: null, fileKey: null });
  };

  // A video attached via "Import from YouTube" is streamed back from our API.
  const videoFromYouTube = videoUrl != null && videoUrl.startsWith("/api/v1/upload/file/");

  const importYouTube = async () => {
    const url = ytUrl.trim();
    if (!url) {
      toast.warning("No link", "Paste a YouTube link first.");
      return;
    }
    setYtImporting(true);
    try {
      const res = await http.post<{ fileKey: string; name: string; size: number }>(
        "/upload/youtube",
        { url },
        // Downloads of long videos can take a while — allow up to 5 minutes.
        { timeout: 300_000 },
      );
      const streamUrl = `/api/v1/upload/file/${res.fileKey}`;
      setVideoFileKey(res.fileKey);
      setVideoUrl(streamUrl);
      setVideoName(res.name);
      studio.setVideo({ blob: null, url: streamUrl, name: res.name, fileKey: res.fileKey });
      setYtUrl("");
      toast.success("YouTube video imported", "It is ready to use as your video background.");
    } catch (e) {
      toast.error("YouTube import failed", (e as Error).message);
    } finally {
      setYtImporting(false);
    }
  };

  const estimatedSize = useMemo(() => {
    const baseBps = { "720p": 5e6, "1080p": 8e6, "1440p": 16e6, "4K": 35e6 }[resolution];
    const qMul = quality === "low" ? 0.6 : quality === "high" ? 1.6 : 1;
    const fmtMul = format === "webm" ? 0.7 : 1;
    return (baseBps * qMul * fmtMul * Math.max(duration, 3)) / 8;
  }, [resolution, quality, format, duration]);

  const exportVideo = async () => {
    if (!studio.audioBlob) {
      toast.warning("No audio", "Generate audio in the Studio first.");
      return;
    }
    if (cues.length === 0) {
      toast.warning("No subtitles", "Add at least one subtitle in the Subtitle Editor.");
      return;
    }
    setExporting(true);
    setExportProgress(0);
    setExportStatus("Uploading audio…");
    setExportError(null);
    setDownloadUrl(null);
    pausePreview();
    // A visible background without a server key means the upload reference
    // was lost (very old session) — exporting now would silently produce the
    // solid-color fallback instead of the video the user sees.
    if (videoUrl && !videoFileKey) {
      setExporting(false);
      setExportStatus("");
      setExportError("The background video is missing its upload reference. Remove it and attach the video again, then export.");
      return;
    }
    try {
      // 1. Upload client-generated audio for FFmpeg compositing (the only upload).
      const afd = new FormData();
      afd.append("file", studio.audioBlob, "audio.wav");
      const audioRes = await http.upload<{ fileKey: string }>("/upload/audio", afd);

      setExportStatus("Starting export…");
      // 2. Start the export job. Not sending videoEnd = "end with the voice".
      const start = await http.post<{ jobId: string }>("/export/video", {
        videoFileKey,
        audioFileKey: audioRes.fileKey,
        subtitleData: cues.map(({ start, end, text }) => ({ start, end, text })),
        subtitleStyle: { ...style, fontFamily: style.fontFamily },
        exportSettings: {
          resolution,
          aspect,
          format,
          quality,
          fps,
          audioVolume: audioVolume / 100,
          fadeIn,
          fadeOut,
          ...(!fitToVoice && trimEnd > 0 ? { videoEnd: Math.min(trimEnd, naturalMax) } : {}),
        },
      });

      // 3. Stream progress via SSE (no polling).
      await new Promise<void>((resolve, reject) => {
        const es = new EventSource(`/api/v1/export/jobs/${start.jobId}/events`);
        es.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data) as { status: string; progress: number; outputUrl?: string; error?: string };
            setExportStatus(data.status);
            if (data.progress != null) setExportProgress(data.progress);
            if (data.status === "COMPLETED") {
              setDownloadUrl(data.outputUrl ?? null);
              es.close();
              resolve();
            } else if (data.status === "FAILED") {
              es.close();
              reject(new Error(data.error ?? "Export failed"));
            }
          } catch {
            /* ignore malformed frames */
          }
        };
        es.onerror = () => {
          es.close();
          reject(new Error("Lost connection to the export service."));
        };
      });

      toast.success("Export complete", "Your video is ready to download.");
    } catch (e) {
      setExportStatus("FAILED");
      setExportError((e as Error).message);
      toast.error("Export failed", (e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const downloadExport = () => {
    if (!downloadUrl) return;
    window.location.href = downloadUrl;
  };

  const activeCue = cues.find((c) => currentTime >= c.start && currentTime < c.end);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Video Compositor</h1>
          <p className="text-sm text-gray-400">Overlay your subtitles onto video and export. Audio is only uploaded when you export.</p>
        </div>
        <Badge tone="blue">{planDef.name} plan · up to {planDef.maxResolution}</Badge>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
        {/* Left column */}
        <div className="min-w-0 space-y-5">
          {/* Preview */}
          <div className="rounded-card border border-gray-800 bg-panel p-5">
            <div
              ref={previewRef}
              className={cn(
                "relative mx-auto w-full overflow-hidden rounded-lg bg-black transition-all duration-300",
                aspect === "9:16" ? "max-w-[280px] sm:max-w-[330px]" : "max-w-3xl",
              )}
              style={{ aspectRatio: aspect === "9:16" ? "9 / 16" : "16 / 9" }}
            >
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="h-full w-full object-contain"
                  muted
                  playsInline
                  onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}
                  onEnded={() => !hasAudio && pausePreview()}
                />
              ) : (
                <div className="h-full w-full" style={{ backgroundColor: bgColor }} />
              )}
              {/* Voiceover playback for the preview — the master clock. */}
              {audioUrl && <audio ref={audioRef} src={audioUrl} className="hidden" preload="auto" />}
              {activeCue && (
                <div className="pointer-events-none absolute z-10" style={{ ...subtitlePosition({ ...style, margin: style.margin * k }) }}>
                  <div
                    style={subtitleStyleToCss({
                      ...style,
                      fontSize: style.fontSize * k,
                      letterSpacing: style.letterSpacing * k,
                      bgPadding: style.bgPadding * k,
                      bgRadius: style.bgRadius * k,
                      strokeWidth: style.strokeWidth * k,
                      shadowX: style.shadowX * k,
                      shadowY: style.shadowY * k,
                      shadowBlur: style.shadowBlur * k,
                    })}
                  >
                    {activeCue.text}
                  </div>
                </div>
              )}
              {!videoUrl && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-700">
                  <span className="flex items-center gap-2 text-sm"><FileVideo className="h-5 w-5" /> No video — solid background</span>
                </div>
              )}
            </div>

            {/* Transport controls */}
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => (playing ? pausePreview() : playPreview())}
                disabled={!audioUrl && !videoUrl}
                aria-label={playing ? "Pause preview" : "Play preview"}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-glow transition-transform hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
              >
                {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm tabular-nums text-white">
                  {formatDuration(Math.min(currentTime, timelineEnd))}
                  <span className="text-gray-500"> / {formatDuration(timelineEnd)}</span>
                </p>
                <p className="text-xs text-gray-500">
                  {!audioUrl && !videoUrl
                    ? "Generate a voiceover to preview playback"
                    : `${playing ? "Previewing" : "Preview"} with voice + subtitles${!fitToVoice && trimEnd > 0 ? ` · ends at ${formatDuration(Math.min(trimEnd, naturalMax))}` : " · ends at voice end"}`}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => { pausePreview(); setCurrentTime(0); }} disabled={!audioUrl && !videoUrl}>
                Back to start
              </Button>
            </div>

            {/* Timeline */}
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-300">Timeline</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="rounded px-2 py-0.5 text-gray-400 hover:text-white" aria-label="Zoom out">−</button>
                  <span className="text-xs text-gray-500">{Math.round(zoom * 100)}%</span>
                  <button onClick={() => setZoom((z) => Math.min(3, z + 0.25))} className="rounded px-2 py-0.5 text-gray-400 hover:text-white" aria-label="Zoom in">+</button>
                </div>
              </div>
              <div className="mt-2 overflow-x-auto rounded-card border border-gray-800 bg-gray-900/60 p-3">
                <div style={{ width: `${Math.max(100, zoom * 100)}%` }} className="min-w-full">
                  <div className="flex h-14 items-center gap-1 overflow-hidden rounded-md border border-gray-800">
                    {Array.from({ length: Math.max(1, Math.round(duration || 5)) }).map((_, i) => (
                      <div key={i} className="h-full flex-1 bg-gray-800/80" title={`${i}s`} />
                    ))}
                  </div>
                  <div className="mt-2">
                    <Waveform audioBuffer={decodedAudio} currentTime={currentTime} duration={duration} onSeek={setCurrentTime} height={48} />
                  </div>
                  <div className="mt-2 flex h-8 items-center gap-0.5">
                    {cues.length === 0 ? (
                      <span className="text-xs text-gray-600">No subtitle cues — add them in the Subtitle Editor.</span>
                    ) : (
                      cues.map((c) => (
                        <div
                          key={c.id}
                          className={cn("flex h-7 items-center overflow-hidden rounded px-1.5 text-[10px] text-white", currentTime >= c.start && currentTime < c.end ? "bg-violet-500" : "bg-gray-700")}
                          style={{ width: `${((c.end - c.start) / Math.max(duration, 1)) * 100}%` }}
                          title={c.text}
                        >
                          <span className="truncate">{c.text}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Video background */}
          <div className="rounded-card border border-gray-800 bg-panel p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-300">Video Background</p>
              {videoUrl && (
                <Badge tone={videoFromYouTube ? "violet" : "green"} dot>
                  {videoFromYouTube ? "YouTube" : "Uploaded"}
                </Badge>
              )}
            </div>

            {videoUrl ? (
              <div className="mt-3 flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{videoName}</p>
                  <p className="text-xs text-gray-500">MP4/MOV/WEBM/AVI · max {planDef.maxVideoMb}MB</p>
                </div>
                <Button size="sm" variant="outline" onClick={clearVideo} icon={<Trash2 className="h-4 w-4" />}>Remove</Button>
              </div>
            ) : (
              <>
                <div
                  onDrop={onDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-card border-2 border-dashed border-gray-700 px-6 py-10 text-center transition-colors hover:border-blue-500/50"
                  onClick={() => inputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
                >
                  <Upload className="mb-3 h-8 w-8 text-gray-500" />
                  <p className="text-sm text-gray-300">Drag & drop a video, or click to browse</p>
                  <p className="mt-1 text-xs text-gray-500">MP4, MOV, WEBM, AVI · up to {planDef.maxVideoMb}MB on your plan</p>
                  {uploading && <ProgressBar indeterminate className="mt-4 max-w-xs" />}
                  <input ref={inputRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,.mp4,.mov,.webm,.avi" className="hidden" onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])} />
                </div>

                {/* Import straight from YouTube */}
                <div className="mt-4 rounded-card border border-gray-800 bg-gray-900/50 p-4">
                  <p className="flex items-center gap-2 text-sm font-medium text-gray-200">
                    <Youtube className="h-4 w-4 text-red-400" /> Import from YouTube
                  </p>
                  <form
                    className="mt-2.5 flex flex-col gap-2 sm:flex-row"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void importYouTube();
                    }}
                  >
                    <input
                      value={ytUrl}
                      onChange={(e) => setYtUrl(e.target.value)}
                      disabled={ytImporting}
                      placeholder="Paste a link — youtube.com/watch?v=…, youtu.be/…, /shorts/…"
                      aria-label="YouTube video URL"
                      className="h-10 w-full rounded-input border border-gray-700 bg-gray-900 px-3 text-sm text-white placeholder-gray-500 transition-colors hover:border-gray-600 focus:border-blue-500 disabled:opacity-60"
                    />
                    <Button type="submit" size="sm" loading={ytImporting} icon={<Youtube className="h-4 w-4" />} className="h-10 shrink-0 sm:w-auto w-full">
                      {ytImporting ? "Importing…" : "Import"}
                    </Button>
                  </form>
                  {ytImporting && (
                    <div className="mt-3">
                      <ProgressBar indeterminate />
                      <p className="mt-1.5 text-xs text-gray-500">Downloading from YouTube — long videos can take a minute.</p>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-gray-500">
                    The video is downloaded straight to your project. Only import content you own or have permission to use.
                  </p>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <span className="text-sm text-gray-400">Or use a solid background:</span>
                  <ColorPicker value={bgColor} onChange={setBgColor} label="Background color" />
                </div>
              </>
            )}
          </div>

          {/* Audio track */}
          <div className="rounded-card border border-gray-800 bg-panel p-5">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-medium text-gray-300"><Music className="h-4 w-4" /> Audio Track</p>
              {studio.audioBlob ? <Badge tone="green" dot>Neural TTS audio</Badge> : (
                <button onClick={() => navigate("/studio")} className="text-sm text-blue-400 hover:text-blue-300">Generate audio →</button>
              )}
            </div>
            {studio.audioBlob && (
              <div className="mt-4 space-y-4">
                <Slider label="Volume" value={audioVolume} onChange={setAudioVolume} min={0} max={100} format={(v) => `${v}%`} />
                <div className="grid grid-cols-2 gap-3">
                  <Slider label="Fade in" value={fadeIn} onChange={setFadeIn} min={0} max={5} step={0.5} format={(v) => `${v}s`} />
                  <Slider label="Fade out" value={fadeOut} onChange={setFadeOut} min={0} max={5} step={0.5} format={(v) => `${v}s`} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column: export settings */}
        <div className="min-w-0 space-y-5">
          <div className="rounded-card border border-gray-800 bg-panel p-5">
            <p className="mb-4 text-sm font-semibold text-white">Export Settings</p>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-gray-300">Video style</label>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Video style">
                  <AspectButton
                    active={aspect === "16:9"}
                    onClick={() => setAspect("16:9")}
                    icon={<Monitor className="h-4 w-4" />}
                    title="Landscape"
                    sub="16:9 · YouTube"
                  />
                  <AspectButton
                    active={aspect === "9:16"}
                    onClick={() => setAspect("9:16")}
                    icon={<Smartphone className="h-4 w-4" />}
                    title="Portrait"
                    sub="9:16 · Shorts · TikTok"
                  />
                </div>
                {aspect === "9:16" && (
                  <p className="mt-1.5 text-xs text-gray-500">
                    Vertical video for YouTube Shorts, TikTok & Reels. Landscape footage is fitted with black bars.
                  </p>
                )}
              </div>

              {/* Length — how long the finished video runs */}
              <div className="rounded-card border border-gray-800 bg-gray-900/50 p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-gray-200">
                      <Scissors className="h-4 w-4 text-blue-400" /> End video with the voice
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {hasAudio
                        ? `Both video and subtitles stop at ${formatDuration(audioDuration)} — right when the voiceover finishes.`
                        : "Generate a voiceover to enable length options."}
                    </p>
                  </div>
                  <Toggle
                    checked={fitToVoice}
                    onChange={(v) => setFitToVoice(v)}
                    disabled={!hasAudio}
                    label="End video with the voice"
                  />
                </div>
                {!fitToVoice && (
                  <div className="mt-3 border-t border-gray-800 pt-3">
                    <Slider
                      label="End video at"
                      value={trimEnd > 0 ? trimEnd : naturalMax}
                      onChange={(v) => setTrimEnd(Math.min(v, naturalMax))}
                      min={0.5}
                      max={Math.max(naturalMax, 1)}
                      step={0.5}
                      format={(v) => `${formatDuration(v)}${Math.abs(v - naturalMax) < 0.01 ? " (video end)" : ""}`}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Cuts the video early (e.g. let the voice end, then stop). Footage shorter than the voice loops automatically.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-gray-300">Resolution</label>
                <Select
                  value={resolution}
                  onChange={(v) => setResolution(v as Resolution)}
                  options={RES_ORDER.map((r, i) => ({
                    value: r,
                    label: `${r} (${dimsLabel(r, aspect)})`,
                    sublabel: i > maxResolutionIdx ? `${planDef.name} plan required` : undefined,
                  }))}
                  ariaLabel="Resolution"
                />
                {RES_ORDER.indexOf(resolution) > maxResolutionIdx && (
                  <p className="mt-1 text-xs text-amber-400">This resolution requires a higher plan.</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-gray-300">Format</label>
                <Select value={format} onChange={(v) => setFormat(v as "mp4" | "webm")} options={[{ value: "mp4", label: "MP4 (H.264)" }, { value: "webm", label: "WEBM (VP9)" }]} ariaLabel="Format" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-gray-300">Quality</label>
                <Select value={quality} onChange={(v) => setQuality(v as "low" | "medium" | "high")} options={[{ value: "low", label: "Low (fast, smaller)" }, { value: "medium", label: "Medium" }, { value: "high", label: "High (slow, larger)" }]} ariaLabel="Quality" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-gray-300">Frame rate</label>
                <Select value={String(fps)} onChange={(v) => setFps(parseInt(v, 10))} options={[{ value: "24", label: "24 fps" }, { value: "30", label: "30 fps" }, { value: "60", label: "60 fps" }]} ariaLabel="Frame rate" />
              </div>
              <div className="flex items-center justify-between rounded-card border border-gray-800 bg-gray-900/60 px-3.5 py-3">
                <span className="text-sm text-gray-400">Estimated size</span>
                <span className="font-mono text-sm text-white">~{formatBytes(estimatedSize)}</span>
              </div>
              {planDef.watermark && <p className="text-xs text-amber-400">Free plan exports include a small watermark. Upgrade to Pro to remove it.</p>}
            </div>
          </div>

          <div className="rounded-card border border-gray-800 bg-panel p-5">
            <Button
              fullWidth
              size="lg"
              icon={<Clapperboard className="h-5 w-5" />}
              onClick={exportVideo}
              loading={exporting}
              disabled={!studio.audioBlob || cues.length === 0}
            >
              Export Video
            </Button>
            {exporting && (
              <div className="mt-4">
                <ProgressBar value={exportProgress} tone="default" label="Export progress" />
                <p className="mt-2 text-center text-sm text-gray-400">{exportStatus} {exportProgress > 0 && `${Math.round(exportProgress)}%`}</p>
              </div>
            )}
            {exportError && !exporting && (
              <div className="mt-4 rounded-input border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm leading-relaxed text-red-200">
                <p className="font-semibold text-red-300">Export failed</p>
                <p className="mt-0.5 break-words">{exportError}</p>
              </div>
            )}
            {downloadUrl && !exporting && (
              <Button fullWidth variant="outline" className="mt-3" icon={<Download className="h-4 w-4" />} onClick={downloadExport}>
                Download Video
              </Button>
            )}
            <p className="mt-3 text-center text-xs text-gray-500">
              🔒 Audio is uploaded only for this FFmpeg compositing step, then deleted.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AspectButton({
  active,
  onClick,
  icon,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-card border px-3 py-3 text-center transition-all duration-200",
        active
          ? "border-blue-500/60 bg-blue-500/10 text-white shadow-glow"
          : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200",
      )}
    >
      <span className={cn("flex items-center gap-1.5 text-sm font-semibold", active ? "text-white" : "text-gray-300")}>
        {icon}
        {title}
      </span>
      <span className="text-[11px] text-gray-500">{sub}</span>
    </button>
  );
}
