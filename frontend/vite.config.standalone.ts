import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// ── Single-file standalone build ────────────────────────────────────────────
//   npm run build:standalone   →   dist-standalone/index.html
//
// THE ENTIRE WEBSITE in ONE .html file. No server, no Node, no FFmpeg to
// install: every /api/v1 call is answered in-browser (standaloneApi.ts),
// neural TTS comes straight from Microsoft's free edge-tts websocket, video
// export renders on a canvas and encodes via the hardware MediaRecorder.
// Voice cloning is intentionally excluded (needs the separate Python service).

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: "./",
  define: {
    "import.meta.env.VITE_STANDALONE": JSON.stringify("1"),
  },
  build: {
    target: "es2022",
    outDir: "dist-standalone",
    // Inline absolutely everything — the deliverable is one file.
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 100_000,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
