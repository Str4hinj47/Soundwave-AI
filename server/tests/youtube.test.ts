import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { youtubePublisher } from "../src/lib/youtubePublisher.js";

let app: ReturnType<typeof createApp>;

describe("YouTube Data API v3 & Auto-Publisher (/api/v1/youtube)", () => {
  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    youtubePublisher.disconnect();
  });

  it("GET /api/v1/youtube/status returns disconnected status by default", async () => {
    const res = await request(app).get("/api/v1/youtube/status");
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(false);
    expect(res.body.autoPostEnabled).toBe(false);
    expect(res.body.defaultPrivacy).toBe("public");
  });

  it("POST /api/v1/youtube/config updates YouTube settings", async () => {
    const res = await request(app)
      .post("/api/v1/youtube/config")
      .send({
        clientId: "test-client-id.apps.googleusercontent.com",
        clientSecret: "test-client-secret",
        refreshToken: "1//test-refresh-token",
        autoPostEnabled: true,
        defaultPrivacy: "unlisted",
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.config.connected).toBe(true);
    expect(res.body.config.autoPostEnabled).toBe(true);
    expect(res.body.config.defaultPrivacy).toBe("unlisted");
    expect(res.body.config.hasClientId).toBe(true);
    expect(res.body.config.hasRefreshToken).toBe(true);
  });

  it("GET /api/v1/youtube/auth-url returns Google OAuth URL when clientId configured", async () => {
    youtubePublisher.saveConfig({
      clientId: "test-client-id.apps.googleusercontent.com",
    });

    const res = await request(app).get("/api/v1/youtube/auth-url");
    expect(res.status).toBe(200);
    expect(res.body.url).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    expect(res.body.url).toContain("test-client-id");
    expect(res.body.url).toContain("youtube.upload");
  });

  it("POST /api/v1/youtube/publish fails gracefully when not configured", async () => {
    youtubePublisher.disconnect();

    const res = await request(app)
      .post("/api/v1/youtube/publish")
      .send({
        videoUrl: "/test.mp4",
        title: "Test Viral Short",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("YouTube account is not connected");
  });

  it("POST /api/v1/youtube/disconnect unlinks YouTube channel", async () => {
    youtubePublisher.saveConfig({
      refreshToken: "fake-refresh-token",
      channelTitle: "Test Channel",
    });

    const res = await request(app).post("/api/v1/youtube/disconnect");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.config.connected).toBe(false);
  });
});
