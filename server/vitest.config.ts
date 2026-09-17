import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      DATA_DIR: "/tmp/soundwave-test-data",
      NODE_ENV: "test",
      APP_URL: "http://localhost:5173",
      // Pin feature-affecting config so a developer's local .env never
      // changes test outcomes (dotenv only fills variables not already set).
      DEFAULT_SIGNUP_PLAN: "FREE",
      SINGLE_USER_MODE: "false",
      VOICECLONE_URL: "",
      VOICECLONE_TOKEN: "",
      JWT_ACCESS_SECRET: "test-access-secret-for-vitest",
      JWT_REFRESH_SECRET: "test-refresh-secret-for-vitest",
    },
    // Each test file gets an isolated store file.
    fileParallelism: false,
  },
});
