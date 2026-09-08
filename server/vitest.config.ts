import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      DATA_DIR: "/tmp/soundwave-test-data",
      NODE_ENV: "test",
      APP_URL: "http://localhost:5173",
    },
    // Each test file gets an isolated store file.
    fileParallelism: false,
  },
});
