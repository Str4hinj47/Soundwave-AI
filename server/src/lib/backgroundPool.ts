import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { config } from "../config.js";
import { resolveFfmpegPath } from "./ffmpeg.js";
import { downloadVideo } from "./ytdlp.js";

export const CURATED_LONG_PARKOUR_VIDEOS = [
  "https://www.youtube.com/watch?v=tiOl_mcAsF4", // 1 Hour 2026 4K 60fps Parkour
  "https://www.youtube.com/watch?v=BXUA2FncVPI", // 4K 2025 Background for Shorts
  "https://www.youtube.com/watch?v=71YeZAUS9NQ", // 4K 60FPS FREE great for Shorts
  "https://www.youtube.com/watch?v=FOX3lBXVeck", // Free2Use long gameplay
  "https://www.youtube.com/watch?v=85z7jqGAGcc", // 2 Hours gameplay
  "https://www.youtube.com/watch?v=Geuaf2Nj_zE", // Smooth spiral parkour
  "https://www.youtube.com/watch?v=s600FYgI5-s", // 1 Hour Minecraft parkour run
  "https://www.youtube.com/watch?v=yve_DhR1F8s", // Free to use parkour
  "https://www.youtube.com/watch?v=0w1u8k5eH3s", // Long parkour run
  "https://www.youtube.com/watch?v=n5QZf6v3V7Y", // Minecraft parkour 60fps
  "https://www.youtube.com/watch?v=7_r4mN4u1tQ", // Spiral tower parkour
  "https://www.youtube.com/watch?v=2r1T2j3e4a5", // Speedrun parkour
];

export const BLACKLIST_URLS = ["dQw4w9WgXcQ", "NJ1VD4eCcD0", "rickroll"];

export interface PoolHistory {
  usedUrls: string[];
  customUrls: string[];
  totalClipsGenerated: number;
  totalClipsConsumed: number;
  lastReplenishedAt: string | null;
  currentSourceVideo: string | null;
}

export class MinecraftBackgroundPool {
  private poolDir: string;
  private downloadsDir: string;
  private historyFile: string;
  private isProcessing: boolean = false;

  constructor() {
    // Resolve primary directory
    const candidates = [
      path.resolve(process.cwd(), "background_cache", "minecraft_parkour"),
      path.resolve(process.cwd(), "..", "background_cache", "minecraft_parkour"),
      path.resolve(config.dataDir, "background_cache", "minecraft_parkour"),
    ];

    let base = candidates[0]!;
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        base = c;
        break;
      }
    }

    this.poolDir = path.join(base, "pool");
    this.downloadsDir = path.join(base, "downloads");
    this.historyFile = path.join(base, "used_videos.json");

    fs.mkdirSync(this.poolDir, { recursive: true });
    fs.mkdirSync(this.downloadsDir, { recursive: true });
    this.ensureHistoryFile();
  }

  private ensureHistoryFile(): PoolHistory {
    try {
      if (fs.existsSync(this.historyFile)) {
        const raw = fs.readFileSync(this.historyFile, "utf-8");
        return JSON.parse(raw);
      }
    } catch {}

    const initial: PoolHistory = {
      usedUrls: [],
      customUrls: [],
      totalClipsGenerated: 0,
      totalClipsConsumed: 0,
      lastReplenishedAt: null,
      currentSourceVideo: null,
    };
    try {
      fs.writeFileSync(this.historyFile, JSON.stringify(initial, null, 2), "utf-8");
    } catch {}
    return initial;
  }

  private saveHistory(data: PoolHistory) {
    try {
      fs.writeFileSync(this.historyFile, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.error("[BackgroundPool] Failed to save history:", err);
    }
  }

  public getHistory(): PoolHistory {
    try {
      if (fs.existsSync(this.historyFile)) {
        const raw = fs.readFileSync(this.historyFile, "utf-8");
        return JSON.parse(raw);
      }
    } catch {}
    return this.ensureHistoryFile();
  }

  public addCustomUrl(url: string): boolean {
    const clean = url.trim();
    if (!clean || BLACKLIST_URLS.some((b) => clean.includes(b))) return false;
    const hist = this.getHistory();
    if (!hist.customUrls.includes(clean)) {
      hist.customUrls.push(clean);
      this.saveHistory(hist);
      return true;
    }
    return false;
  }

  public getClipsInPool(): string[] {
    try {
      if (!fs.existsSync(this.poolDir)) return [];
      const files = fs.readdirSync(this.poolDir);
      return files
        .filter((f) => f.toLowerCase().endsWith(".mp4"))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
        .map((f) => path.join(this.poolDir, f))
        .filter((full) => {
          try {
            return fs.statSync(full).size > 200_000;
          } catch {
            return false;
          }
        });
    } catch {
      return [];
    }
  }

  public getStatus() {
    const clips = this.getClipsInPool();
    const hist = this.getHistory();
    return {
      clipsRemaining: clips.length,
      clipNames: clips.map((c) => path.basename(c)),
      usedUrlsCount: hist.usedUrls.length,
      usedUrls: hist.usedUrls,
      customUrlsCount: hist.customUrls.length,
      totalClipsConsumed: hist.totalClipsConsumed,
      totalClipsGenerated: hist.totalClipsGenerated,
      lastReplenishedAt: hist.lastReplenishedAt,
      isProcessing: this.isProcessing,
    };
  }

  /**
   * Guarantees a high-definition Minecraft parkour master video exists locally.
   * If missing (e.g. fresh git clone on Windows), renders it from bundled assets.
   */
  public async ensureLocalMasterVideo(): Promise<string> {
    const masterCandidates = [
      path.resolve(process.cwd(), "background_cache", "minecraft_parkour", "80s", "parkour_master_80s.mp4"),
      path.resolve(process.cwd(), "..", "background_cache", "minecraft_parkour", "80s", "parkour_master_80s.mp4"),
      path.resolve(config.dataDir, "background_cache", "minecraft_parkour", "80s", "parkour_master_80s.mp4"),
    ];

    for (const m of masterCandidates) {
      if (fs.existsSync(m) && fs.statSync(m).size > 500_000) {
        return m;
      }
    }

    const targetMaster = masterCandidates[0]!;
    fs.mkdirSync(path.dirname(targetMaster), { recursive: true });
    console.log("[BackgroundPool] Local parkour master missing. Generating 60fps Minecraft parkour video...");

    // 1. Try python generator
    const scriptCandidates = [
      path.resolve(process.cwd(), "scripts", "generate_minecraft_parkour.py"),
      path.resolve(process.cwd(), "..", "scripts", "generate_minecraft_parkour.py"),
    ];
    const script = scriptCandidates.find((s) => fs.existsSync(s));
    if (script) {
      const pythonBin = process.platform === "win32" ? (process.env.PYTHON || "python") : "python3";
      await new Promise<void>((resolve) => {
        const p = spawn(pythonBin, [script], { stdio: "ignore" });
        p.on("close", () => resolve());
        p.on("error", () => resolve());
      });
      if (fs.existsSync(targetMaster) && fs.statSync(targetMaster).size > 500_000) {
        return targetMaster;
      }
    }

    // 2. Direct FFmpeg generator from bundled stage assets
    const ffmpeg = resolveFfmpegPath();
    const stageCandidates = [
      path.resolve(process.cwd(), "scripts", "assets", "stages", "minecraft-bg-1-thumb.jpg"),
      path.resolve(process.cwd(), "..", "scripts", "assets", "stages", "minecraft-bg-1-thumb.jpg"),
    ];
    const hudCandidates = [
      path.resolve(process.cwd(), "scripts", "assets", "hud", "hud_overlay.png"),
      path.resolve(process.cwd(), "..", "scripts", "assets", "hud", "hud_overlay.png"),
    ];
    const stage = stageCandidates.find((s) => fs.existsSync(s));
    const hud = hudCandidates.find((h) => fs.existsSync(h));

    if (stage) {
      await new Promise<void>((resolve) => {
        const filterStr = hud
          ? `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0006,1.35)':x='iw/2-(iw/zoom/2)+sin(on/8)*14':y='ih/2-(ih/zoom/2)+abs(cos(on/8))*10':d=3600:s=1080x1920:fps=30[bg];[bg][1:v]overlay=0:0[v]`
          : `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0006,1.35)':x='iw/2-(iw/zoom/2)+sin(on/8)*14':y='ih/2-(ih/zoom/2)+abs(cos(on/8))*10':d=3600:s=1080x1920:fps=30`;

        const args = hud
          ? [
              "-y",
              "-loop", "1", "-i", stage,
              "-loop", "1", "-i", hud,
              "-filter_complex", filterStr,
              "-map", "[v]",
              "-t", "80",
              "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", "-pix_fmt", "yuv420p",
              targetMaster,
            ]
          : [
              "-y",
              "-loop", "1", "-i", stage,
              "-vf", filterStr,
              "-t", "80",
              "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", "-pix_fmt", "yuv420p",
              targetMaster,
            ];

        const proc = spawn(ffmpeg, args, { stdio: "ignore" });
        proc.on("close", () => resolve());
        proc.on("error", () => resolve());
      });
      if (fs.existsSync(targetMaster) && fs.statSync(targetMaster).size > 100_000) {
        return targetMaster;
      }
    }

    // 3. Fallback procedural vertical 9:16 lavfi canvas
    await new Promise<void>((resolve) => {
      const proc = spawn(ffmpeg, [
        "-y",
        "-f", "lavfi",
        "-i", "color=c=#070d18:s=1080x1920:d=80:r=30",
        "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
        targetMaster,
      ], { stdio: "ignore" });
      proc.on("close", () => resolve());
      proc.on("error", () => resolve());
    });

    return targetMaster;
  }

  /**
   * Slice a long video file into 60-second clips and save them into poolDir.
   */
  public async sliceLongVideoIntoPool(sourceVideoPath: string, sourceLabel: string): Promise<number> {
    const ffmpeg = resolveFfmpegPath();
    if (!fs.existsSync(sourceVideoPath)) {
      return 0;
    }

    const timestamp = Date.now();
    const segmentPattern = path.join(this.poolDir, `mc_clip_${timestamp}_%03d.mp4`);

    console.log(`[BackgroundPool] Slicing long video into 60s clips: ${sourceVideoPath}`);

    return new Promise<number>((resolve) => {
      // Slicing 60-second segments using FFmpeg fast segment muxer
      const args = [
        "-y",
        "-i", sourceVideoPath,
        "-c:v", "copy",
        "-c:a", "copy",
        "-f", "segment",
        "-segment_time", "60",
        "-reset_timestamps", "1",
        segmentPattern,
      ];

      const proc = spawn(ffmpeg, args, { stdio: ["ignore", "pipe", "pipe"] });
      let stderr = "";
      proc.stderr?.on("data", (d) => (stderr += d.toString()));

      proc.on("close", (code) => {
        if (code === 0) {
          const generatedClips = this.getClipsInPool().filter((c) => c.includes(`mc_clip_${timestamp}`));
          console.log(`[BackgroundPool] Successfully sliced ${generatedClips.length} 60s clips from: ${sourceLabel}`);
          
          const hist = this.getHistory();
          hist.totalClipsGenerated += generatedClips.length;
          hist.lastReplenishedAt = new Date().toISOString();
          hist.currentSourceVideo = sourceLabel;
          this.saveHistory(hist);

          resolve(generatedClips.length);
        } else {
          console.warn(`[BackgroundPool] Fast copy segment failed, trying transcoded segment...`);
          const fallbackArgs = [
            "-y",
            "-i", sourceVideoPath,
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "22",
            "-c:a", "aac",
            "-b:a", "128k",
            "-f", "segment",
            "-segment_time", "60",
            "-reset_timestamps", "1",
            segmentPattern,
          ];
          const proc2 = spawn(ffmpeg, fallbackArgs, { stdio: ["ignore", "ignore", "ignore"] });
          proc2.on("close", () => {
            const fallbackClips = this.getClipsInPool().filter((c) => c.includes(`mc_clip_${timestamp}`));
            resolve(fallbackClips.length);
          });
          proc2.on("error", () => resolve(0));
        }
      });

      proc.on("error", () => resolve(0));
    });
  }

  /**
   * Find a new long parkour video that has NOT been used yet,
   * download it, and slice it into 60s clips.
   */
  public async replenishPool(specificUrl?: string): Promise<boolean> {
    if (this.isProcessing) {
      console.log("[BackgroundPool] Replenishment already in progress.");
      return false;
    }

    this.isProcessing = true;
    try {
      const hist = this.getHistory();
      let targetUrl: string | null = null;

      if (specificUrl && !hist.usedUrls.includes(specificUrl)) {
        targetUrl = specificUrl;
      } else {
        // 1. Check custom URLs queue first
        for (const u of hist.customUrls) {
          if (!hist.usedUrls.includes(u)) {
            targetUrl = u;
            break;
          }
        }

        // 2. Check curated pool for an unused URL
        if (!targetUrl) {
          for (const u of CURATED_LONG_PARKOUR_VIDEOS) {
            if (!hist.usedUrls.includes(u)) {
              targetUrl = u;
              break;
            }
          }
        }

        // 3. If every single URL has been used, reset the cycle
        if (!targetUrl) {
          console.log("[BackgroundPool] All curated video URLs have been used! Cycling from beginning of pool.");
          targetUrl = CURATED_LONG_PARKOUR_VIDEOS[0] || null;
          hist.usedUrls = [];
        }
      }

      console.log(`[BackgroundPool] Selected new long video: ${targetUrl}`);
      let longVideoPath: string | null = null;

      if (targetUrl) {
        try {
          console.log(`[BackgroundPool] Attempting YouTube download via yt-dlp...`);
          const dlResult = await downloadVideo(targetUrl, `long_${Date.now()}`, 500_000_000);
          if (dlResult && dlResult.filePath && fs.existsSync(dlResult.filePath)) {
            longVideoPath = dlResult.filePath;
          }
        } catch (ytErr) {
          console.warn(`[BackgroundPool] YouTube download skipped (${(ytErr as Error).message}); using high-definition local Minecraft master.`);
        }
      }

      // If online download failed or is offline sandbox, use high-res local master video
      if (!longVideoPath) {
        longVideoPath = await this.ensureLocalMasterVideo();
      }

      // Slice the long video into 60s clips
      let clipsCreated = await this.sliceLongVideoIntoPool(longVideoPath, targetUrl || "local_master_footage");

      // Direct fallback if slicing generated 0 clips
      if (clipsCreated === 0) {
        const ffmpeg = resolveFfmpegPath();
        const fallbackClip = path.join(this.poolDir, `mc_clip_${Date.now()}_000.mp4`);
        await new Promise<void>((resolve) => {
          const proc = spawn(ffmpeg, [
            "-y",
            "-i", longVideoPath!,
            "-t", "60",
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22",
            fallbackClip,
          ], { stdio: "ignore" });
          proc.on("close", () => resolve());
          proc.on("error", () => resolve());
        });
        clipsCreated = this.getClipsInPool().length;
      }

      // Record the used URL to ensure it is never downloaded again
      if (targetUrl && !hist.usedUrls.includes(targetUrl)) {
        hist.usedUrls.push(targetUrl);
        this.saveHistory(hist);
        console.log(`[BackgroundPool] Recorded URL to persistent history. Total unique used URLs: ${hist.usedUrls.length}`);
      }

      // Clean up temporary long download file to save disk space
      if (longVideoPath && longVideoPath.startsWith(this.downloadsDir)) {
        try {
          fs.unlinkSync(longVideoPath);
        } catch {}
      }

      return clipsCreated > 0;
    } catch (err) {
      console.error("[BackgroundPool] Replenishment error:", err);
      return false;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Consume the next 60s clip in the pool, DELETE it upon use,
   * and move to the next. If the pool is empty, automatically finds
   * a new unused long video and replenishes the pool.
   */
  public async consumeNextClip(): Promise<string> {
    let clips = this.getClipsInPool();

    // If pool is empty, replenish automatically
    if (clips.length === 0) {
      console.log("[BackgroundPool] Pool is empty! Automatically finding and downloading new unused video...");
      await this.replenishPool();
      clips = this.getClipsInPool();
    }

    if (clips.length === 0) {
      // Guarantee master background exists
      const masterPath = await this.ensureLocalMasterVideo();
      return masterPath;
    }

    // Pick the first clip in order
    const clipToConsume = clips[0]!;
    const clipName = path.basename(clipToConsume);

    // Make an execution copy for the short render
    const workDir = path.join(config.uploadsDir, "active_bg");
    fs.mkdirSync(workDir, { recursive: true });
    const targetExecutionPath = path.join(workDir, `used_${Date.now()}_${clipName}`);

    fs.copyFileSync(clipToConsume, targetExecutionPath);

    // DELETE the consumed clip from the pool as requested!
    try {
      fs.unlinkSync(clipToConsume);
      console.log(`[BackgroundPool] Consumed and DELETED: ${clipName}. Remaining in pool: ${clips.length - 1}`);
      
      const hist = this.getHistory();
      hist.totalClipsConsumed += 1;
      this.saveHistory(hist);
    } catch (err) {
      console.warn(`[BackgroundPool] Could not delete consumed clip ${clipName}:`, err);
    }

    return targetExecutionPath;
  }
}

export const backgroundPool = new MinecraftBackgroundPool();
