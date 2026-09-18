import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "node:path";
import fs from "node:fs";
import { config } from "./config.js";
import { generalLimiter, securityHeaders } from "./lib/security.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import authRoutes from "./routes/auth.js";
import voiceRoutes from "./routes/voices.js";
import ttsRoutes from "./routes/tts.js";
import projectRoutes from "./routes/projects.js";
import uploadRoutes from "./routes/upload.js";
import exportRoutes from "./routes/export.js";
import userRoutes from "./routes/user.js";
import billingRoutes from "./routes/billing.js";
import apiKeyRoutes from "./routes/apiKeys.js";
import agentRoutes from "./routes/agent.js";
import jarvisRoutes from "./routes/jarvis.js";
import jarvisShortRoutes from "./routes/jarvisShort.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  // CORS — restrict to configured origins in production; permissive in dev.
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (!config.isProd) return cb(null, true);
        if (config.corsOrigins.length === 0 || config.corsOrigins.includes(origin)) return cb(null, true);
        return cb(new Error("Not allowed by CORS"));
      },
      credentials: true,
    }),
  );

  app.use(securityHeaders);
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use("/api/v1", generalLimiter);

  // Health.
  app.get("/api/health", (_req, res) => res.json({ ok: true, service: "soundwave-ai", time: new Date().toISOString() }));

  // API routes.
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/voices", voiceRoutes);
  app.use("/api/v1/tts", ttsRoutes);
  app.use("/api/v1/projects", projectRoutes);
  app.use("/api/v1/upload", uploadRoutes);
  app.use("/api/v1/export", exportRoutes);
  app.use("/api/v1/user", userRoutes);
  app.use("/api/v1/billing", billingRoutes);
  app.use("/api/v1/api-keys", apiKeyRoutes);

  // Soundwave Agent & Automation routes (with backward compatibility for jarvis)
  app.use("/api/v1/agent", agentRoutes);
  app.use("/api/v1/automation", agentRoutes);
  app.use("/api/v1/jarvis", jarvisShortRoutes);
  app.use("/api/v1/jarvis", jarvisRoutes);

  // Static voice sample clips (pre-generated, committed to the repo).
  const samplesDir = path.join(process.cwd(), "..", "frontend", "public", "voice-samples");
  if (fs.existsSync(samplesDir)) {
    app.use("/voice-samples", express.static(samplesDir, { maxAge: "7d", immutable: true }));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
