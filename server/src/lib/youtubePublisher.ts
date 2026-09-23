import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

export interface YouTubeCredentials {
  connected: boolean;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken?: string;
  tokenExpiry?: number; // epoch ms
  channelTitle?: string;
  channelId?: string;
  subscriberCount?: string;
  autoPostEnabled: boolean;
  defaultPrivacy: "public" | "unlisted" | "private";
  lastUploadedAt?: string;
  totalUploads: number;
}

export class YouTubePublisher {
  private configFile: string;

  constructor() {
    const dataDir = path.resolve(process.cwd(), "data");
    fs.mkdirSync(dataDir, { recursive: true });
    this.configFile = path.join(dataDir, "youtube_credentials.json");
    this.ensureConfig();
  }

  private ensureConfig(): YouTubeCredentials {
    try {
      if (fs.existsSync(this.configFile)) {
        const raw = fs.readFileSync(this.configFile, "utf-8");
        return JSON.parse(raw);
      }
    } catch {}

    const initial: YouTubeCredentials = {
      connected: false,
      clientId: process.env.YOUTUBE_CLIENT_ID || "",
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET || "",
      refreshToken: process.env.YOUTUBE_REFRESH_TOKEN || "",
      autoPostEnabled: false,
      defaultPrivacy: "public",
      totalUploads: 0,
    };

    try {
      fs.writeFileSync(this.configFile, JSON.stringify(initial, null, 2), "utf-8");
    } catch {}
    return initial;
  }

  public getConfig(): YouTubeCredentials {
    return this.ensureConfig();
  }

  public saveConfig(updates: Partial<YouTubeCredentials>): YouTubeCredentials {
    const current = this.getConfig();
    const updated = { ...current, ...updates };
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(updated, null, 2), "utf-8");
    } catch (e) {
      console.error("[YouTubePublisher] Failed to save config:", e);
    }
    return updated;
  }

  public disconnect(): YouTubeCredentials {
    return this.saveConfig({
      connected: false,
      autoPostEnabled: false,
      defaultPrivacy: "public",
      refreshToken: "",
      accessToken: undefined,
      tokenExpiry: undefined,
      channelTitle: undefined,
      channelId: undefined,
      subscriberCount: undefined,
    });
  }

  /**
   * Generates Google OAuth 2.0 Auth URL with YouTube upload scopes.
   */
  public getAuthUrl(redirectUri: string): string {
    const creds = this.getConfig();
    if (!creds.clientId) {
      throw new Error("YouTube Client ID is not configured. Please enter your Google Client ID first.");
    }

    const scope = encodeURIComponent(
      "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly"
    );

    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
      creds.clientId
    )}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
  }

  /**
   * Exchange OAuth authorization code for Access & Refresh tokens.
   */
  public async handleOAuthCallback(code: string, redirectUri: string): Promise<YouTubeCredentials> {
    const creds = this.getConfig();
    if (!creds.clientId || !creds.clientSecret) {
      throw new Error("Client ID and Client Secret are required for OAuth token exchange.");
    }

    console.log("[YouTubePublisher] Exchanging code for tokens...");
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(`Google token exchange failed: ${errText}`);
    }

    const tokenData = (await tokenRes.json()) as any;
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || creds.refreshToken;
    const tokenExpiry = Date.now() + (tokenData.expires_in || 3600) * 1000;

    // Fetch Channel Profile Details
    let channelTitle = "YouTube Channel";
    let channelId = "";
    let subscriberCount = "0";

    try {
      const channelRes = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (channelRes.ok) {
        const cData = (await channelRes.json()) as any;
        if (cData.items && cData.items.length > 0) {
          const item = cData.items[0];
          channelTitle = item.snippet.title;
          channelId = item.id;
          subscriberCount = item.statistics.subscriberCount;
        }
      }
    } catch (e) {
      console.warn("[YouTubePublisher] Could not fetch channel profile:", e);
    }

    return this.saveConfig({
      connected: true,
      accessToken,
      refreshToken,
      tokenExpiry,
      channelTitle,
      channelId,
      subscriberCount,
    });
  }

  /**
   * Refreshes access token if expired or about to expire.
   */
  public async getFreshAccessToken(): Promise<string> {
    const creds = this.getConfig();
    if (!creds.refreshToken) {
      throw new Error("YouTube account not connected. Please connect your YouTube account in Settings.");
    }

    // Reuse valid access token if valid for >60s
    if (creds.accessToken && creds.tokenExpiry && creds.tokenExpiry > Date.now() + 60_000) {
      return creds.accessToken;
    }

    console.log("[YouTubePublisher] Refreshing access token...");
    const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        refresh_token: creds.refreshToken,
        grant_type: "refresh_token",
      }).toString(),
    });

    if (!refreshRes.ok) {
      const errText = await refreshRes.text();
      throw new Error(`Failed to refresh YouTube token: ${errText}`);
    }

    const data = (await refreshRes.json()) as any;
    const newAccessToken = data.access_token;
    const newExpiry = Date.now() + (data.expires_in || 3600) * 1000;

    this.saveConfig({
      accessToken: newAccessToken,
      tokenExpiry: newExpiry,
    });

    return newAccessToken;
  }

  /**
   * Upload video file directly to YouTube Shorts via Resumable Upload protocol.
   */
  public async uploadShort(params: {
    videoPath: string;
    title: string;
    description?: string;
    tags?: string[];
    privacy?: "public" | "unlisted" | "private";
  }): Promise<{ videoId: string; videoUrl: string; title: string }> {
    const creds = this.getConfig();
    if (!creds.connected && !creds.refreshToken) {
      throw new Error("YouTube is not connected. Configure YouTube API in Settings to publish videos.");
    }

    if (!fs.existsSync(params.videoPath)) {
      throw new Error(`Video file not found at: ${params.videoPath}`);
    }

    const accessToken = await this.getFreshAccessToken();
    const fileSize = fs.statSync(params.videoPath).size;

    const shortTitle = (params.title || "Viral Short")
      .trim()
      .slice(0, 90);
    const finalTitle = shortTitle.includes("#Shorts") ? shortTitle : `${shortTitle} #Shorts`;

    const metadata = {
      snippet: {
        title: finalTitle,
        description: `${params.description || shortTitle}\n\nGenerated automatically with Soundwave AI.\n\n#Shorts #Viral #MinecraftParkour #AI`,
        tags: [...(params.tags || []), "shorts", "viral", "minecraft", "soundwave"],
        categoryId: "22", // People & Blogs
      },
      status: {
        privacyStatus: params.privacy || creds.defaultPrivacy || "public",
        selfDeclaredMadeForKids: false,
      },
    };

    console.log(`[YouTubePublisher] Starting resumable upload for: "${finalTitle}" (${(fileSize / 1024 / 1024).toFixed(1)} MB)...`);

    // 1. Initiate Resumable Upload Session
    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Length": String(fileSize),
          "X-Upload-Content-Type": "video/mp4",
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initRes.ok) {
      const errText = await initRes.text();
      throw new Error(`Failed to initiate YouTube upload session: ${errText}`);
    }

    const uploadUrl = initRes.headers.get("Location");
    if (!uploadUrl) {
      throw new Error("YouTube did not return a resumable upload location URL.");
    }

    // 2. Stream video file bytes to upload URL
    const fileStream = fs.readFileSync(params.videoPath);
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(fileSize),
        "Content-Type": "video/mp4",
      },
      body: fileStream,
    });

    if (!uploadRes.ok) {
      const uploadErr = await uploadRes.text();
      throw new Error(`YouTube video upload stream failed: ${uploadErr}`);
    }

    const videoData = (await uploadRes.json()) as any;
    const videoId = videoData.id;
    const videoUrl = `https://youtube.com/shorts/${videoId}`;

    console.log(`[YouTubePublisher] Upload complete! Live at: ${videoUrl}`);

    this.saveConfig({
      lastUploadedAt: new Date().toISOString(),
      totalUploads: (creds.totalUploads || 0) + 1,
    });

    return {
      videoId,
      videoUrl,
      title: finalTitle,
    };
  }
}

export const youtubePublisher = new YouTubePublisher();
