import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { config } from "../config.js";
import { resolveFfmpegPath } from "./ffmpeg.js";
import { downloadVideo } from "./ytdlp.js";

// Orbital - No Copyright Gameplay (https://www.youtube.com/@OrbitalNCG/videos)
// All background sources come from this channel only.
export const ORBITAL_NCG_CHANNEL_URL = "https://www.youtube.com/@OrbitalNCG/videos";

export const CURATED_LONG_PARKOUR_VIDEOS = [
  "https://www.youtube.com/watch?v=fw_eWpb7uCE", // Orbital NCG — Vertical 4 HOURS
  "https://www.youtube.com/watch?v=zeyy5Yj-A4I", // Orbital NCG — 4 HOURS
  "https://www.youtube.com/watch?v=-qK8scH4UC8", // Orbital NCG — Vertical 2 Hours
  "https://www.youtube.com/watch?v=85z7jqGAGcc", // Orbital NCG — 2 Hours
  "https://www.youtube.com/watch?v=z84bmLDzIIk", // Orbital NCG — 4K (2 Hours)
  "https://www.youtube.com/watch?v=tiOl_mcAsF4", // Orbital NCG — 1 HOUR
  "https://www.youtube.com/watch?v=xU29hjgAg2w", // Orbital NCG — Vertical 1 HOUR
  "https://www.youtube.com/watch?v=_GxTLyLyIbs", // Orbital NCG — 4K (1 HOUR)
  "https://www.youtube.com/watch?v=s600FYgI5-s", // Orbital NCG — Vertical
  "https://www.youtube.com/watch?v=yve_DhR1F8s", // Orbital NCG — Vertical
  "https://www.youtube.com/watch?v=VwZO7Im_tAc", // Orbital NCG — 4K Horror Map
  "https://www.youtube.com/watch?v=FOX3lBXVeck", // Orbital NCG — Free2Use
  "https://www.youtube.com/watch?v=BXUA2FncVPI", // Orbital NCG — 4K
  "https://www.youtube.com/watch?v=zdVQSm8bYu8", // Orbital NCG — Minecraft Parkour
];

export const BLACKLIST_URLS = ["dQw4w9WgXcQ", "NJ1VD4eCcD0", "rickroll"];

export interface PoolHistory {
  usedUrls: string[];
  customUrls: string[];
  totalClipsGenerated: number;
  totalClipsConsumed: number;
  lastReplenishedAt: string | null;
  currentSourceVideo: string | null;
  cleanedLegacySway?: boolean;
}

export class MinecraftBackgroundPool {
  private poolDir: string;
  private downloadsDir: string;
  private historyFile: string;
  private isProcessing: boolean = false;
  private repoRoot: string;

  constructor() {
    this.repoRoot = process.cwd().endsWith("server") ? path.resolve(process.cwd(), "..") : process.cwd();
    const base = path.resolve(this.repoRoot, "background_cache", "minecraft_parkour");

    this.poolDir = path.join(base, "pool");
    this.downloadsDir = path.join(base, "downloads");
    this.historyFile = path.join(base, "used_videos.json");
    const customDir = path.join(base, "custom_videos");

    fs.mkdirSync(this.poolDir, { recursive: true });
    fs.mkdirSync(this.downloadsDir, { recursive: true });
    fs.mkdirSync(customDir, { recursive: true });
    const hist = this.ensureHistoryFile();

    // Auto-purge any legacy static-photo sway clips on first startup
    if (!hist.cleanedLegacySway) {
      console.log("[BackgroundPool] Cleaning up legacy static sway clips from disk...");
      this.purgeOldClips();
      hist.cleanedLegacySway = true;
      this.saveHistory(hist);
    }

    // Auto-scan custom_videos folder for any user-dropped videos to slice into pool
    this.autoImportCustomVideos(customDir).catch(() => {});
  }

  /**
   * Purges all old or legacy clips from pool and master cache directory.
   */
  public purgeOldClips(): number {
    let removed = 0;
    try {
      if (fs.existsSync(this.poolDir)) {
        const files = fs.readdirSync(this.poolDir);
        for (const f of files) {
          if (f.endsWith(".mp4")) {
            try {
              fs.unlinkSync(path.join(this.poolDir, f));
              removed++;
            } catch {}
          }
        }
      }
      const legacyMasters = [
        path.join(path.dirname(this.poolDir), "80s", "parkour_master_80s.mp4"),
        path.resolve(process.cwd(), "background_cache", "minecraft_parkour", "80s", "parkour_master_80s.mp4"),
        path.resolve(process.cwd(), "..", "background_cache", "minecraft_parkour", "80s", "parkour_master_80s.mp4"),
        path.resolve(config.dataDir, "background_cache", "minecraft_parkour", "80s", "parkour_master_80s.mp4"),
      ];
      for (const m of legacyMasters) {
        if (fs.existsSync(m)) {
          try {
            fs.unlinkSync(m);
            removed++;
          } catch {}
        }
      }
      console.log(`[BackgroundPool] Purged ${removed} legacy/cached clips from pool.`);
    } catch {}
    return removed;
  }

  /**
   * Scans custom_videos directory and slices any user-dropped MP4/MOV/MKV into 60s clips.
   */
  public async autoImportCustomVideos(dir?: string): Promise<number> {
    const targetDir = dir || path.join(path.dirname(this.poolDir), "custom_videos");
    if (!fs.existsSync(targetDir)) return 0;
    let totalImported = 0;
    try {
      const files = fs.readdirSync(targetDir);
      for (const f of files) {
        const ext = path.extname(f).toLowerCase();
        if ([".mp4", ".mov", ".mkv", ".webm"].includes(ext)) {
          const fullPath = path.join(targetDir, f);
          const stat = fs.statSync(fullPath);
          if (stat.size > 1_000_000) {
            console.log(`[BackgroundPool] Discovered user gameplay footage: ${f}. Slicing into 60s clips...`);
            const count = await this.sliceLongVideoIntoPool(fullPath, `Custom File: ${f}`);
            totalImported += count;
          }
        }
      }
    } catch (e: any) {
      console.warn("[BackgroundPool] Error scanning custom_videos:", e.message);
    }
    return totalImported;
  }

  /**
   * Directly add a custom video file from upload or local storage into pool.
   */
  public async addCustomVideoFile(filePath: string, originalName?: string): Promise<number> {
    const label = originalName || path.basename(filePath);
    console.log(`[BackgroundPool] Adding custom uploaded video to pool: ${label}`);
    return await this.sliceLongVideoIntoPool(filePath, `Upload: ${label}`);
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

    const ffmpeg = resolveFfmpegPath();
    const hudCandidates = [
      path.resolve(process.cwd(), "scripts", "assets", "hud", "hud_overlay.png"),
      path.resolve(process.cwd(), "..", "scripts", "assets", "hud", "hud_overlay.png"),
      path.resolve(this.repoRoot, "scripts", "assets", "hud", "hud_overlay.png"),
    ];
    const hud = hudCandidates.find((h) => fs.existsSync(h));
    // Bundled vertical parkour still — offline stand-in when YouTube is unreachable.
    // Never fall back to testsrc2/color bars (SMPTE pattern looks broken in previews).
    const stillCandidates = [
      path.resolve(process.cwd(), "scripts", "assets", "parkour_master_still.png"),
      path.resolve(process.cwd(), "..", "scripts", "assets", "parkour_master_still.png"),
      path.resolve(this.repoRoot, "scripts", "assets", "parkour_master_still.png"),
    ];
    const still = stillCandidates.find((s) => fs.existsSync(s) && fs.statSync(s).size > 10_000);

    console.log("[BackgroundPool] Generating dynamic vertical 60fps parkour canvas fallback...");
    await new Promise<void>((resolve) => {
      let filterStr: string;
      let args: string[];

      if (still && hud) {
        // Slow Ken Burns push-in on the parkour still + authentic HUD
        filterStr =
          `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,` +
          `zoompan=z='min(zoom+0.00035,1.18)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=4800:s=1080x1920:fps=60[bg];` +
          `[bg][1:v]overlay=0:0[v]`;
        args = [
          "-y",
          "-loop", "1", "-i", still,
          "-loop", "1", "-i", hud,
          "-filter_complex", filterStr,
          "-map", "[v]",
          "-t", "80",
          "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22", "-pix_fmt", "yuv420p",
          targetMaster,
        ];
      } else if (still) {
        filterStr =
          `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,` +
          `zoompan=z='min(zoom+0.00035,1.18)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=4800:s=1080x1920:fps=60`;
        args = [
          "-y",
          "-loop", "1", "-i", still,
          "-filter_complex", filterStr,
          "-t", "80",
          "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22", "-pix_fmt", "yuv420p",
          targetMaster,
        ];
      } else if (hud) {
        // Procedural motion + HUD (still better than bare color bars)
        filterStr = `[0:v]fps=60,scale=1080:1920[bg];[bg][1:v]overlay=0:0[v]`;
        args = [
          "-y",
          "-f", "lavfi",
          "-i", "cellauto=size=1080x1920:rate=60:rule=110:random_fill_ratio=0.02:scroll=1",
          "-loop", "1", "-i", hud,
          "-filter_complex", filterStr,
          "-map", "[v]",
          "-t", "80",
          "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22", "-pix_fmt", "yuv420p",
          targetMaster,
        ];
      } else {
        // Last resort procedural motion — never testsrc2/color bars
        args = [
          "-y",
          "-f", "lavfi",
          "-i", "cellauto=size=1080x1920:rate=60:rule=110:random_fill_ratio=0.02:scroll=1",
          "-t", "80",
          "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22", "-pix_fmt", "yuv420p",
          targetMaster,
        ];
      }

      const proc = spawn(ffmpeg, args, { stdio: "ignore" });
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

    // 1. High-precision segmentation via yt_clipper engine if Python is available
    try {
      const pythonBin = process.platform === "win32" ? (process.env.PYTHON || "python") : "python3";
      const tempOut = path.join(path.dirname(this.poolDir), "temp_clipper");
      fs.mkdirSync(tempOut, { recursive: true });
      const p = spawnSync(pythonBin, ["-m", "yt_clipper", "clip", sourceVideoPath, "-o", tempOut, "--ffmpeg-path", ffmpeg], {
        cwd: this.repoRoot,
        timeout: 35000,
      });
      if (p.status === 0) {
        const clipsDir = path.join(tempOut, "clips");
        if (fs.existsSync(clipsDir)) {
          const files = fs.readdirSync(clipsDir).filter((f) => f.endsWith(".mp4"));
          if (files.length > 0) {
            let copied = 0;
            for (const f of files) {
              const src = path.join(clipsDir, f);
              const dest = path.join(this.poolDir, `mc_clip_${timestamp}_${f}`);
              fs.renameSync(src, dest);
              copied++;
            }
            try { fs.rmSync(tempOut, { recursive: true, force: true }); } catch {}
            const hist = this.getHistory();
            hist.totalClipsGenerated += copied;
            hist.lastReplenishedAt = new Date().toISOString();
            hist.currentSourceVideo = sourceLabel;
            this.saveHistory(hist);
            console.log(`[BackgroundPool] yt_clipper engine sliced ${copied} frame-accurate 60s clips from: ${sourceLabel}`);
            return copied;
          }
        }
      }
    } catch {}

    const segmentPattern = path.join(this.poolDir, `mc_clip_${timestamp}_%03d.mp4`);

    console.log(`[BackgroundPool] Slicing long video into 60s clips via ffmpeg: ${sourceVideoPath}`);

    return new Promise<number>((resolve) => {
      // Slicing 60-second segments using FFmpeg fast segment muxer
      const args = [
        "-y",
        "-i", sourceVideoPath,
        "-c", "copy",
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
      let downloadOk = false;

      if (targetUrl) {
        try {
          console.log(`[BackgroundPool] Attempting YouTube download via yt-dlp...`);
          // Download a fast 3-minute section (e.g. 00:30 to 03:30) with 45s max timeout
          const dlResult = await downloadVideo(targetUrl, `long_${Date.now()}`, 500_000_000, undefined, "*00:30-03:30", 45_000);
          if (dlResult && dlResult.filePath && fs.existsSync(dlResult.filePath) && dlResult.size > 200_000) {
            longVideoPath = dlResult.filePath;
            downloadOk = true;
          }
        } catch (ytErr) {
          console.warn(`[BackgroundPool] YouTube download skipped (${(ytErr as Error).message}); using high-definition local Minecraft master.`);
        }
      }

      // If online download failed or is offline sandbox, use high-res local master video.
      // Do NOT treat this as consuming the source URL — it stays eligible for retry.
      if (!longVideoPath) {
        longVideoPath = await this.ensureLocalMasterVideo();
        console.warn(
          `[BackgroundPool] Download did not produce footage for ${targetUrl ?? "pool"}. ` +
            `Slicing local master instead; source URL was NOT marked used.`,
        );
      }

      const activeLabel = downloadOk && targetUrl ? targetUrl : `Local Master: ${path.basename(longVideoPath)}`;

      // Slice the long video into 60s clips
      let clipsCreated = await this.sliceLongVideoIntoPool(longVideoPath, activeLabel);

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

      // Only burn the source URL into history when we actually downloaded it.
      // Failed downloads must stay retryable (offline sandbox, TLS blocks, etc.).
      if (downloadOk && targetUrl && !hist.usedUrls.includes(targetUrl)) {
        hist.usedUrls.push(targetUrl);
        this.saveHistory(hist);
        console.log(`[BackgroundPool] Recorded URL to persistent history. Total unique used URLs: ${hist.usedUrls.length}`);
      } else if (targetUrl && !downloadOk) {
        console.warn(`[BackgroundPool] Leaving ${targetUrl} unused so the next replenish can retry it.`);
      }

      // Clean up temporary long download file to save disk space
      if (downloadOk && longVideoPath && longVideoPath.startsWith(this.downloadsDir)) {
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
   * and move to the next. If the pool is empty, immediately serves
   * the local 60fps master video and schedules background replenishment
   * without blocking or timing out the user request.
   */
  public async consumeNextClip(): Promise<string> {
    const clips = this.getClipsInPool();

    if (clips.length > 0) {
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

      // If pool is running low (<= 2 clips left), trigger background replenishment asynchronously
      if (clips.length <= 2 && !this.isProcessing) {
        console.log("[BackgroundPool] Pool running low. Replenishing in background...");
        this.replenishPool().catch((e) => console.warn("[BackgroundPool] Background replenishment error:", e.message));
      }

      return targetExecutionPath;
    }

    // Pool is currently empty: Immediately start background replenishment,
    // and serve the guaranteed 60fps master video so this short finishes immediately!
    console.log("[BackgroundPool] Pool is empty! Starting background replenishment and serving guaranteed 60fps master video...");
    this.replenishPool().catch((e) => console.warn("[BackgroundPool] Background replenishment error:", e.message));

    return await this.ensureLocalMasterVideo();
  }

  /**
   * Returns inspection details for all ready clips currently in the rotation pool.
   */
  public getPoolClipsDetails() {
    const clips = this.getClipsInPool();
    return clips.map((p, idx) => {
      const stat = fs.statSync(p);
      const filename = path.basename(p);
      return {
        id: filename,
        filename,
        index: idx + 1,
        size: stat.size,
        sizeFormatted: (stat.size / 1024 / 1024).toFixed(2) + " MB",
        mtime: stat.mtime.toISOString(),
        previewUrl: `/api/v1/agent/background-pool/preview/pool/${filename}`,
        type: "pool_clip",
      };
    });
  }

  /**
   * Returns inspection details for master videos.
   */
  public getMasterVideosDetails() {
    const masterCandidates = [
      path.resolve(this.repoRoot, "background_cache", "minecraft_parkour", "80s", "parkour_master_80s.mp4"),
      path.resolve(config.dataDir, "background_cache", "minecraft_parkour", "80s", "parkour_master_80s.mp4"),
    ];
    const results = [];
    for (const m of masterCandidates) {
      if (fs.existsSync(m)) {
        const stat = fs.statSync(m);
        const filename = path.basename(m);
        results.push({
          id: filename,
          filename,
          size: stat.size,
          sizeFormatted: (stat.size / 1024 / 1024).toFixed(2) + " MB",
          mtime: stat.mtime.toISOString(),
          previewUrl: `/api/v1/agent/background-pool/preview/master/${filename}`,
          type: "master_video",
        });
        break;
      }
    }
    return results;
  }

  /**
   * Returns inspection details for user-uploaded custom videos.
   */
  public getCustomVideosDetails() {
    const customDir = path.join(path.dirname(this.poolDir), "custom_videos");
    if (!fs.existsSync(customDir)) return [];
    try {
      const files = fs.readdirSync(customDir).filter((f) => [".mp4", ".mov", ".mkv", ".webm"].includes(path.extname(f).toLowerCase()));
      return files.map((f) => {
        const full = path.join(customDir, f);
        const stat = fs.statSync(full);
        return {
          id: f,
          filename: f,
          size: stat.size,
          sizeFormatted: (stat.size / 1024 / 1024).toFixed(2) + " MB",
          mtime: stat.mtime.toISOString(),
          previewUrl: `/api/v1/agent/background-pool/preview/custom/${f}`,
          type: "custom_video",
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Resolves absolute path to a clip for streaming/previewing.
   */
  public resolveClipPath(type: string, filename: string): string | null {
    const safeName = path.basename(filename);
    let targetDir = this.poolDir;
    if (type === "master") targetDir = path.join(path.dirname(this.poolDir), "80s");
    else if (type === "custom") targetDir = path.join(path.dirname(this.poolDir), "custom_videos");
    else if (type === "downloads") targetDir = this.downloadsDir;

    const full = path.join(targetDir, safeName);
    return fs.existsSync(full) ? full : null;
  }

  /**
   * Deletes a specific clip or video file from disk.
   */
  public deleteClip(type: string, filename: string): boolean {
    const full = this.resolveClipPath(type, filename);
    if (full && fs.existsSync(full)) {
      try {
        fs.unlinkSync(full);
        return true;
      } catch {}
    }
    return false;
  }

  /**
   * Re-slices the master video into fresh 60s clips.
   */
  public async sliceMasterVideo(): Promise<number> {
    const master = await this.ensureLocalMasterVideo();
    return await this.sliceLongVideoIntoPool(master, "Master Parkour Slicing");
  }
}

export const backgroundPool = new MinecraftBackgroundPool();
