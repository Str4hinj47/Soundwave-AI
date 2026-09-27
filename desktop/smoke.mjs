// Smoke-test the ASSEMBLED app exactly the way the desktop shell boots it:
// same env bootstrap (server-env.cjs), same in-process import, then assert the
// SPA + API actually answer. Exits 0 on PASS — run it before packaging.
//
//   node desktop/smoke.mjs [--keep]
import { createRequire } from "node:module";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const desktopDir = path.dirname(fileURLToPath(import.meta.url));
const { applyServerEnv } = require(path.join(desktopDir, "src", "server-env.cjs"));

const appRoot = path.join(desktopDir, "app");
const binDir = path.join(desktopDir, "bin");
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "soundwave-smoke-"));

function get(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on("error", reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error("timeout"));
    });
  });
}

function assert(cond, label) {
  if (!cond) {
    console.error(`[smoke] ✗ FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`[smoke] ✓ ${label}`);
}

try {
  const { appUrl } = await applyServerEnv({ appRoot, binDir, userDataDir });
  console.log(`[smoke] booting server at ${appUrl} (data: ${userDataDir})`);

  await import(pathToFileURL(path.join(appRoot, "server", "dist", "index.js")).href);

  // Wait for health (max 30s).
  let healthy = false;
  for (let i = 0; i < 100 && !healthy; i++) {
    try {
      healthy = (await get(`${appUrl}/api/health`)).status === 200;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  assert(healthy, "GET /api/health → 200");

  const spa = await get(`${appUrl}/`);
  assert(spa.status === 200 && /text\/html/.test(spa.headers["content-type"] || ""), "GET / → SPA index.html");

  const fallback = await get(`${appUrl}/some/client/route`);
  assert(
    fallback.status === 200 && /text\/html/.test(fallback.headers["content-type"] || ""),
    "GET /some/client/route → SPA history fallback",
  );

  const api404 = await get(`${appUrl}/api/v1/definitely-not-a-route`);
  assert(
    api404.status === 404 && /json/.test(api404.headers["content-type"] || ""),
    "GET /api/v1/definitely-not-a-route → 404 JSON (not swallowed by SPA)",
  );

  const voices = await get(`${appUrl}/api/v1/voices`);
  assert(voices.status === 200, "GET /api/v1/voices → 200");

  // yt-dlp runs from a writable copy in the user-data folder (the desktop
  // shell lets the server keep it updated) — and that copy must execute.
  const ytdlpName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
  const bundledYtDlp = path.join(binDir, ytdlpName);
  if (fs.existsSync(bundledYtDlp)) {
    const copy = path.join(userDataDir, "bin", ytdlpName);
    assert(
      process.env.YTDLP_PATH === copy && fs.statSync(copy).size === fs.statSync(bundledYtDlp).size,
      "yt-dlp runs from its writable user-data copy",
    );
    const version = execFileSync(copy, ["--version"], { encoding: "utf8", timeout: 60_000, windowsHide: true }).trim();
    assert(/^\d{4}\.\d{2}\.\d{2}/.test(version), `user-data yt-dlp copy executes (version ${version})`);
  } else {
    console.log(`[smoke] – no bundled yt-dlp in ${binDir}; skipping the yt-dlp copy check`);
  }

  console.log("[smoke] PASS — assembled app boots and serves the studio.");
  process.exit(0);
} catch (err) {
  console.error("[smoke] ✗ FAIL:", err);
  process.exit(1);
}
