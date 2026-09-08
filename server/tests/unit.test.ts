import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, sha256, randomToken } from "../src/lib/auth.js";
import { PLANS, resolutionAllowed } from "../src/lib/plans.js";
import { buildAss } from "../src/lib/ffmpeg.js";

describe("passwords", () => {
  it("hashes with bcrypt and verifies", async () => {
    const hash = await hashPassword("Str0ng!Pass");
    expect(hash).not.toContain("Str0ng!Pass");
    expect(await verifyPassword("Str0ng!Pass", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});

describe("tokens", () => {
  it("round-trips access + refresh tokens", () => {
    const access = signAccessToken("user-1");
    const a = verifyAccessToken(access);
    expect(a?.sub).toBe("user-1");
    expect(a?.type).toBe("access");

    const refresh = signRefreshToken("user-1", "session-1");
    const r = verifyRefreshToken(refresh);
    expect(r?.sub).toBe("user-1");
    expect(r?.sid).toBe("session-1");
    expect(verifyAccessToken("garbage")).toBeNull();
  });

  it("generates random tokens and hashes", () => {
    const t = randomToken(24);
    expect(t.length).toBe(48);
    expect(sha256(t)).toHaveLength(64);
    expect(sha256(t)).toBe(sha256(t));
  });
});

describe("plans", () => {
  it("enforces resolution limits", () => {
    expect(resolutionAllowed("FREE", "720p")).toBe(true);
    expect(resolutionAllowed("FREE", "1080p")).toBe(false);
    expect(resolutionAllowed("PRO", "1080p")).toBe(true);
    expect(resolutionAllowed("PRO", "4K")).toBe(false);
    expect(resolutionAllowed("ENTERPRISE", "4K")).toBe(true);
  });

  it("has sensible quotas", () => {
    expect(PLANS.FREE.characterLimit).toBe(10_000);
    expect(PLANS.PRO.characterLimit).toBe(200_000);
    expect(PLANS.ENTERPRISE.characterLimit).toBe(2_000_000);
  });
});

describe("ASS subtitle generation", () => {
  it("produces a valid ASS document with styles and events", () => {
    const ass = buildAss(
      [{ start: 1, end: 3, text: "Hello world" }],
      { fontFamily: "Inter", fontSize: 44, color: "#FFFFFF", hAlign: "center", vAlign: "bottom", strokeEnabled: true, strokeWidth: 2 },
      1920,
      1080,
      true,
    );
    expect(ass).toContain("[Script Info]");
    expect(ass).toContain("PlayResX: 1920");
    expect(ass).toContain("Style: Default");
    expect(ass).toContain("Style: Watermark");
    expect(ass).toContain("Dialogue: 0,0:00:01.00,0:00:03.00");
    expect(ass).toContain("Hello world");
    expect(ass).toContain("Soundwave AI"); // watermark
  });

  it("escapes ASS tag injection", () => {
    const ass = buildAss([{ start: 0, end: 1, text: "evil {\\pos(0,0)} text" }], {}, 1280, 720);
    expect(ass).not.toContain("{\\pos(0,0)}");
  });
});
