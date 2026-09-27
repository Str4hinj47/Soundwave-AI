import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

export interface YouTubeConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken?: string;
  tokenExpiry?: number;
  channelTitle?: string;
  channelId?: string;
  autoPublish: boolean;
  defaultPrivacy: "public" | "unlisted" | "private";
  defaultTags: string[];
  titleSuffix: string;
}

export class YouTubeService {
  private configFile: string;

  constructor() {
    const dir = path.join(config.dataDir, "youtube");
    fs.mkdirSync(dir, { recursive: true });
    this.configFile = path.join(dir, "youtube_config.json");
    this.ensureConfig();
  }

  private ensureConfig(): YouTubeConfig {
    if (fs.existsSync(this.configFile)) {
      try {
        const raw = fs.readFileSync(this.configFile, "utf-8");
        return JSON.parse(raw);
      } catch {}
    }

    const initial: YouTubeConfig = {
      clientId: process.env.YOUTUBE_CLIENT_ID || "",
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET || "",
      refreshToken: process.env.YOUTUBE_REFRESH_TOKEN || "",
      channelTitle: undefined,
      channelId: undefined,
      autoPublish: false,
      defaultPrivacy: "public",
      defaultTags: ["shorts", "viral", "minecraft", "story", "facts"],
      titleSuffix: " #shorts #viral",
    };

    try {
      fs.writeFileSync(this.configFile, JSON.stringify(initial, null, 2), "utf-8");
    } catch {}

    return initial;
  }

  public getConfig(): YouTubeConfig {
    return this.ensureConfig();
  }

  public saveConfig(updates: Partial<YouTubeConfig>): YouTubeConfig {
    const current = this.ensureConfig();
    const merged: YouTubeConfig = {
      ...current,
      ...updates,
      defaultTags: updates.defaultTags || current.defaultTags,
    };
    fs.writeFileSync(this.configFile, JSON.stringify(merged, null, 2), "utf-8");
    return merged;
  }

  /**
   * Refreshes OAuth2 access token via Google OAuth2 token endpoint.
   */
  public async getValidAccessToken(): Promise<string> {
    const cfg = this.ensureConfig();

    if (!cfg.clientId || !cfg.clientSecret || !cfg.refreshToken) {
      throw new Error("YouTube API credentials incomplete. Please configure Client ID, Client Secret, and Refresh Token.");
    }

    // Return cached token if still valid for > 60 seconds
    if (cfg.accessToken && cfg.tokenExpiry && cfg.tokenExpiry > Date.now() + 60_000) {
      return cfg.accessToken;
    }

    console.log("[YouTubeService] Refreshing Google OAuth2 access token...");

    const params = new URLSearchParams({
      client_id: cfg.clientId.trim(),
      client_secret: cfg.clientSecret.trim(),
      refresh_token: cfg.refreshToken.trim(),
      grant_type: "refresh_token",
    });

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Google token refresh failed (${res.status}): ${errBody}`);
    }

    const tokenData = (await res.json()) as any;
    const accessToken = tokenData.access_token as string;
    const expiresIn = (tokenData.expires_in as number) || 3600;

    this.saveConfig({
      accessToken,
      tokenExpiry: Date.now() + expiresIn * 1000,
    });

    return accessToken;
  }

  /**
   * Test connection and retrieve connected channel information.
   */
  public async testConnection(): Promise<{ ok: boolean; channelTitle?: string; channelId?: string; error?: string }> {
    try {
      const token = await this.getValidAccessToken();

      const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        const txt = await res.text();
        return { ok: false, error: `YouTube API error (${res.status}): ${txt}` };
      }

      const data = (await res.json()) as any;
      const channel = data.items?.[0];
      if (!channel) {
        return { ok: false, error: "No YouTube channel associated with these Google credentials." };
      }

      const channelTitle = channel.snippet?.title || "My Channel";
      const channelId = channel.id;

      this.saveConfig({ channelTitle, channelId });
      return { ok: true, channelTitle, channelId };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Uploads an MP4 short to YouTube via Resumable Upload API.
   */
  public async uploadShort(params: {
    videoPath: string;
    title: string;
    description?: string;
    tags?: string[];
    privacy?: "public" | "unlisted" | "private";
  }): Promise<{ videoId: string; youtubeUrl: string; title: string }> {
    if (!fs.existsSync(params.videoPath)) {
      throw new Error(`Video file not found at ${params.videoPath}`);
    }

    const cfg = this.ensureConfig();
    const token = await this.getValidAccessToken();

    const titleSuffix = cfg.titleSuffix || " #shorts #viral";
    let finalTitle = params.title.trim();
    if (!finalTitle.toLowerCase().includes("#shorts")) {
      finalTitle = `${finalTitle}${titleSuffix}`;
    }
    // YouTube title limit is 100 characters
    if (finalTitle.length > 100) {
      finalTitle = finalTitle.slice(0, 97) + "...";
    }

    const privacy = params.privacy || cfg.defaultPrivacy || "public";
    const tags = Array.from(new Set([...(params.tags || []), ...(cfg.defaultTags || []), "shorts", "viral"]));

    const metadata = {
      snippet: {
        title: finalTitle,
        description: `${params.description || params.title}\n\nGenerated with Soundwave AI\n#shorts #viral #minecraft #facts`,
        tags,
        categoryId: "24", // Entertainment
      },
      status: {
        privacyStatus: privacy,
        selfDeclaredMadeForKids: false,
      },
    };

    const fileSize = fs.statSync(params.videoPath).size;

    console.log(`[YouTubeService] Initiating upload for "${finalTitle}" (${(fileSize / 1024 / 1024).toFixed(2)} MB)...`);

    // Step 1: Initialize Resumable Upload Session
    const initRes = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(fileSize),
        "X-Upload-Content-Type": "video/mp4",
      },
      body: JSON.stringify(metadata),
    });

    if (!initRes.ok) {
      const errTxt = await initRes.text();
      throw new Error(`Failed to initiate YouTube upload (${initRes.status}): ${errTxt}`);
    }

    const uploadUrl = initRes.headers.get("location");
    if (!uploadUrl) {
      throw new Error("YouTube API did not return an upload location header.");
    }

    // Step 2: Upload Video File Content
    const fileStream = fs.createReadStream(params.videoPath);
    const fileBuffer = fs.readFileSync(params.videoPath);

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(fileSize),
        "Content-Type": "video/mp4",
      },
      body: fileBuffer,
    });

    if (!uploadRes.ok) {
      const errTxt = await uploadRes.text();
      throw new Error(`YouTube video transfer failed (${uploadRes.status}): ${errTxt}`);
    }

    const uploadData = (await uploadRes.json()) as any;
    const videoId = uploadData.id;
    const youtubeUrl = `https://youtube.com/shorts/${videoId}`;

    console.log(`[YouTubeService] Successfully published to YouTube Shorts: ${youtubeUrl}`);
    return {
      videoId,
      youtubeUrl,
      title: finalTitle,
    };
  }
}

export const youtubeService = new YouTubeService();
