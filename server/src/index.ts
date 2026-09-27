import { spawnSync } from "node:child_process";
import { config, validateConfig, resolveFfmpegPath } from "./config.js";
import { createApp } from "./app.js";
import { getStore } from "./lib/store.js";
import { resumeAutopilotIfEnabled } from "./lib/autopilot.js";

process.on("unhandledRejection", (reason) => {
  console.error("[soundwave] Handled asynchronous rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[soundwave] Handled uncaught exception:", error);
});

async function main() {
  validateConfig();
  const store = await getStore();
  console.log(`[soundwave] data store: ${store.kind}`);

  // Video export needs FFmpeg — warn loudly at boot when it's missing so a
  // Windows user sees the fix before the first export attempt.
  const ffmpeg = resolveFfmpegPath();
  const probe = spawnSync(ffmpeg, ["-version"], { stdio: "pipe", encoding: "utf8", windowsHide: true });
  if (probe.status === 0) {
    const firstLine = (probe.stdout ?? "").split("\n")[0]?.trim() ?? "found";
    console.log(`[soundwave] ffmpeg: ${firstLine}`);
  } else {
    console.warn(
      `[soundwave] ⚠ ffmpeg NOT found (tried "${ffmpeg}") — video export will not work until it is installed. On Windows: \`winget install ffmpeg\`, then open a NEW terminal and restart this server.`,
    );
  }

  const app = createApp();
  app.listen(config.port, config.bindHost, () => {
    console.log(`[soundwave] API listening on http://${config.bindHost}:${config.port} (${config.env})`);
    resumeAutopilotIfEnabled();
  });
}

main().catch((err) => {
  console.error("[soundwave] fatal startup error:", err);
  process.exit(1);
});
