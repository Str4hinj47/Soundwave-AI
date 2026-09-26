/**
 * Dev launcher: starts Vite on :5174, waits for it, then launches Electron
 * pointed at the dev server. Ctrl+C tears down both.
 *
 *   npm run electron:dev
 */
import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEV_URL = process.env.VITE_DEV_SERVER_URL || "http://localhost:5174";

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [];

function run(cmd, args, env = {}) {
  const child = spawn(cmd, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  children.push(child);
  return child;
}

function waitFor(url, timeoutMs = 45000) {
  const started = Date.now();
  return new Promise((resolve) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(true);
      });
      req.on("error", () => {
        if (Date.now() - started > timeoutMs) resolve(false);
        else setTimeout(attempt, 400);
      });
      req.setTimeout(600, () => {
        req.destroy();
        setTimeout(attempt, 400);
      });
    };
    attempt();
  });
}

function shutdown(code = 0) {
  for (const c of children) {
    if (!c.killed) c.kill("SIGTERM");
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

run(npmCmd, ["run", "dev"]);

const ok = await waitFor(DEV_URL);
if (!ok) {
  console.error(`[electron-dev] Vite did not come up at ${DEV_URL}`);
  shutdown(1);
}

const electronBin = process.platform === "win32" ? "electron.cmd" : "npx";
const electronArgs = process.platform === "win32" ? ["."] : ["electron", "."];
run(electronBin, electronArgs, { VITE_DEV_SERVER_URL: DEV_URL });
