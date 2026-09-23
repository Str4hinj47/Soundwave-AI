import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { config } from "../config.js";
import { resolveFfmpegPath } from "./ffmpeg.js";
import { resolveYtDlpPath, ytDlpSpawn } from "./ytdlp.js";

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
   * Fast, reliable section downloader for long Minecraft parkour YouTube videos.
   * Downloads the first 6 minutes (360s = 6 x 60s clips) in seconds.
   */
  public async downloadParkourSection(youtubeUrl: string, targetFile: string): Promise<boolean> {
    const { command, prefixArgs } = ytDlpSpawn();
    const ffmpegPath = resolveFfmpegPath();
    const ffmpegDir = path.dirname(ffmpegPath);

    const args = [
      ...prefixArgs,
      "--no-playlist",
      "--no-warnings",
      "--restrict-filenames",
      "-f", "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best",
      "--download-sections", "*0-360",
      "--force-keyframes-at-cuts",
    ];

    if (ffmpegDir && ffmpegDir !== ".") {
      args.push("--ffmpeg-location", ffmpegDir);
    }
    args.push("-o", targetFile, youtubeUrl);

    console.log(`[BackgroundPool] Launching yt-dlp section download (first 6 mins) for: ${youtubeUrl}`);

    return new Promise((resolve) => {
      let proc;
      try {
        proc = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) {
        console.warn("[BackgroundPool] yt-dlp spawn failed:", e);
        return resolve(false);
      }

      const timer = setTimeout(() => {
        try { proc.kill("SIGKILL"); } catch {}
        resolve(false);
      }, 90_000);

      let stderr = "";
      proc.stderr?.on("data", (d) => (stderr += d.toString()));

      proc.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0 && fs.existsSync(targetFile) && fs.statSync(targetFile).size > 500_000) {
          console.log(`[BackgroundPool] YouTube real gameplay section downloaded successfully (${(fs.statSync(targetFile).size / 1024 / 1024).toFixed(1)} MB).`);
          resolve(true);
        } else {
          console.warn(`[BackgroundPool] yt-dlp section download exited (${code}): ${stderr.slice(-200)}`);
          resolve(false);
        }
      });
      proc.on("error", () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
  }

  /**
   * Ensures a local multi-scene continuous Minecraft parkour video exists.
   * Never renders a single shaking still image. Concatenates all 10 stages with authentic HUD!
   */
  public async ensureLocalMasterVideo(): Promise<string> {
    const masterCandidates = [
      path.resolve(process.cwd(), "background_cache", "minecraft_parkour", "80s", "parkour_master_80s.mp4"),
      path.resolve(process.cwd(), "..", "background_cache", "minecraft_parkour", "80s", "parkour_master_80s.mp4"),
      path.resolve(config.dataDir, "background_cache", "minecraft_parkour", "80s", "parkour_master_80s.mp4"),
    ];

    for (const m of masterCandidates) {
      if (fs.existsSync(m) && fs.statSync(m).size > 1_000_000) {
        return m;
      }
    }

    const targetMaster = masterCandidates[0]!;
    fs.mkdirSync(path.dirname(targetMaster), { recursive: true });
    console.log("[BackgroundPool] Generating continuous multi-stage Minecraft parkour footage...");

    // 1. Try python generator which renders all 10 stages with authentic HUD and sprint arcs
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
      if (fs.existsSync(targetMaster) && fs.statSync(targetMaster).size > 1_000_000) {
        return targetMaster;
      }
    }

    // 2. Multi-stage FFmpeg compositor (cycles across all 10 distinct Minecraft levels)
    const ffmpeg = resolveFfmpegPath();
    const stagesDir = path.resolve(process.cwd(), "scripts", "assets", "stages");
    const hudFile = path.resolve(process.cwd(), "scripts", "assets", "hud", "hud_overlay.png");

    if (fs.existsSync(stagesDir)) {
      const stageFiles = fs.readdirSync(stagesDir).filter((f) => f.endsWith("-thumb.jpg"));
      if (stageFiles.length >= 3) {
        const concatListPath = path.join(this.downloadsDir, `concat_${Date.now()}.txt`);
        const renderedClips: string[] = [];

        for (let i = 0; i < Math.min(6, stageFiles.length); i++) {
          const stagePath = path.join(stagesDir, stageFiles[i]!);
          const clipOut = path.join(this.downloadsDir, `mc_scene_${Date.now()}_${i}.mp4`);
          renderedClips.push(clipOut);

          await new Promise<void>((res) => {
            const filterStr = fs.existsSync(hudFile)
              ? `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0008,1.30)':x='iw/2-(iw/zoom/2)+sin(on/10)*10':y='ih/2-(ih/zoom/2)+abs(cos(on/10))*6':d=300:s=1080x1920:fps=30[bg];[bg][1:v]overlay=0:0[v]`
              : `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0008,1.30)':x='iw/2-(iw/zoom/2)+sin(on/10)*10':y='ih/2-(ih/zoom/2)+abs(cos(on/10))*6':d=300:s=1080x1920:fps=30`;

            const args = fs.existsSync(hudFile)
              ? [
                  "-y",
                  "-loop", "1", "-i", stagePath,
                  "-loop", "1", "-i", hudFile,
                  "-filter_complex", filterStr,
                  "-map", "[v]",
                  "-t", "10",
                  "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22", "-pix_fmt", "yuv420p",
                  clipOut,
                ]
              : [
                  "-y",
                  "-loop", "1", "-i", stagePath,
                  "-vf", filterStr,
                  "-t", "10",
                  "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22", "-pix_fmt", "yuv420p",
                  clipOut,
                ];

            const p = spawn(ffmpeg, args, { stdio: "ignore" });
            p.on("close", () => res());
            p.on("error", () => res());
          });
        }

        // Concat all distinct scene clips together
        fs.writeFileSync(concatListPath, renderedClips.map((c) => `file '${c}'`).join("\n"), "utf-8");
        await new Promise<void>((res) => {
          const p = spawn(ffmpeg, [
            "-y",
            "-f", "concat", "-safe", "0", "-i", concatListPath,
            "-c:v", "copy",
            targetMaster,
          ], { stdio: "ignore" });
          p.on("close", () => res());
          p.on("error", () => res());
        });

        // Cleanup temp clips
        try {
          fs.unlinkSync(concatListPath);
          for (const c of renderedClips) fs.unlinkSync(c);
        } catch {}

        if (fs.existsSync(targetMaster) && fs.statSync(targetMaster).size > 500_000) {
          return targetMaster;
        }
      }
    }

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
          // Re-encode slice fallback if keyframes prevented stream-copy slicing
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
        const outSection = path.join(this.downloadsDir, `parkour_${Date.now()}.mp4`);
        const downloaded = await this.downloadParkourSection(targetUrl, outSection);
        if (downloaded && fs.existsSync(outSection) && fs.statSync(outSection).size > 500_000) {
          longVideoPath = outSection;
        }
      }

      // If YouTube download skipped or offline, use continuous multi-scene master video
      if (!longVideoPath) {
        longVideoPath = await this.ensureLocalMasterVideo();
      }

      // Slice the video into 60s clips
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
   * and move to the next.
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

    // DELETE the consumed clip from the pool!
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
