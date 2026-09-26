import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Soundwave Companion renderer.
// Relative base so the Electron shell can load the built bundle from file://,
// dev server binds 0.0.0.0 so Arena's live preview (and LAN devices) can reach it.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: true,
    port: 5174,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET || "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1400,
  },
});
