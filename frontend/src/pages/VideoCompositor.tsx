import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clapperboard,
  Download,
  FileVideo,
  Music,
  Trash2,
  Upload,
} from "lucide-react";
import { useStudio } from "../store/studio";
import { useAuth } from "../store/auth";
import { toast } from "../store/toast";
import { http } from "../lib/api";
import { cn } from "../lib/cn";
import { formatBytes } from "../lib/format";
import { decodeAudioBlob } from "../lib/audio";
import { Waveform } from "../components/Waveform";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Slider } from "../components/ui/Slider";
import { ProgressBar } from "../components/ui/ProgressBar";
import { Badge } from "../components/ui/Badge";
import { ColorPicker } from "../components/ui/ColorPicker";
import { subtitleStyleToCss, subtitlePosition } from "../lib/subtitleStyle";
import { PLANS, type Plan } from "../lib/plans";
import type { SubtitleCue } from "../lib/types";

type Resolution = "720p" | "1080p" | "1440p" | "4K";

const RES_ORDER: Resolution[] = ["720p", "1080p", "1440p", "4K"];

export function VideoCompositor() {
  const navigate = useNavigate();
  const studio = useStudio();
  const { user } = useAuth();
  const plan: Plan = (user?.plan as Plan) ?? "FREE";
  const planDef = PLANS[plan];

  const [videoUrl, setVideoUrl] = useState<string | null>(studio.video.url);
  const [videoName, setVideoName] = useState<string | null>(studio.video.name);
  const [videoFileKey, setVideoFileKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [bgColor, setBgColor] = useState("#0A0F1C");

  const [decodedAudio, setDecodedAudio] = useState<AudioBuffer | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioVolume, setAudioVolume] = useState(100);
  const [fadeIn, setFadeIn] = useState(0);
  const [fadeOut, setFadeOut] = useState(0);
  const [zoom, setZoom] = useState(1);

  const [resolution, setResolution] = useState<Resolution>(planDef.maxResolution as Resolution);
  const [format, setFormat] = useState<"mp4" | "webm">("mp4");
  const [quality, setQuality] = useState<"low" | "medium" | "high">("medium");
  const [fps, setFps] = useState(30);

  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState<string>("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cues: SubtitleCue[] = studio.cues;
  const style = studio.subtitleStyle;
  const duration = studio.audioBuffer?.duration ?? studio.lastDuration;

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
        studio.setVideo({ blob: file, url, name: file.name });
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
    studio.setVideo({ blob: null, url: null, name: null });
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
    setDownloadUrl(null);
    try {
      // 1. Upload client-generated audio for FFmpeg compositing (the only upload).
      const afd = new FormData();
      afd.append("file", studio.audioBlob, "audio.wav");
      const audioRes = await http.upload<{ fileKey: string }>("/upload/audio", afd);

      setExportStatus("Starting export…");
      // 2. Start the export job.
      const start = await http.post<{ jobId: string }>("/export/video", {
        videoFileKey,
        audioFileKey: audioRes.fileKey,
        subtitleData: cues.map(({ start, end, text }) => ({ start, end, text })),
        subtitleStyle: { ...style, fontFamily: style.fontFamily },
        exportSettings: {
          resolution,
          format,
          quality,
          fps,
          audioVolume: audioVolume / 100,
          fadeIn,
          fadeOut,
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
            <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-lg bg-black" style={{ aspectRatio: "16 / 9" }}>
              {videoUrl ? (
                <video ref={videoRef} src={videoUrl} className="h-full w-full object-contain" muted playsInline />
              ) : (
                <div className="h-full w-full" style={{ backgroundColor: bgColor }} />
              )}
              {activeCue && (
                <div className="pointer-events-none absolute z-10" style={{ ...subtitlePosition(style) }}>
                  <div style={subtitleStyleToCss(style)}>{activeCue.text}</div>
                </div>
              )}
              {!videoUrl && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-700">
                  <span className="flex items-center gap-2 text-sm"><FileVideo className="h-5 w-5" /> No video — solid background</span>
                </div>
              )}
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
              {videoUrl && <Badge tone="green" dot>Uploaded</Badge>}
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
                <label className="mb-1.5 block text-sm text-gray-300">Resolution</label>
                <Select
                  value={resolution}
                  onChange={(v) => setResolution(v as Resolution)}
                  options={RES_ORDER.map((r, i) => ({
                    value: r,
                    label: `${r} ${r === "4K" ? "(3840×2160)" : r === "1440p" ? "(2560×1440)" : r === "1080p" ? "(1920×1080)" : "(1280×720)"}`,
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
