// End-to-end test of the PACKAGED Windows app, driven like a person would use
// it (Playwright's Electron support, CI runs it after electron-builder):
//
//   node e2e.mjs ["release/win-unpacked/Soundwave AI.exe"]
//
// A fake microphone plays a real recording (JFK's "ask not what your country
// can do for you…"). Checks: the window opens the Command Center, the tray
// icon and the Ctrl+Shift+Space shortcut are set up, the mic button records →
// the bundled whisper.cpp transcribes → the agent answers, the voice bar
// window does the same when the shortcut is pressed while the app is in the
// background, its turn shows up in the Command Center, and closing the window
// keeps the app in the tray. Needs playwright-core (CI: npm i --no-save).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopDir = path.dirname(fileURLToPath(import.meta.url));
const shotsDir = path.join(desktopDir, "e2e-shots");
const EXPECT = /ask not what your country/i;
const started = Date.now();
const since = () => `${((Date.now() - started) / 1000).toFixed(1)}s`;

function annotate(level, title, message) {
  if (process.env.GITHUB_ACTIONS !== "true") return;
  const data = (v) => String(v).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  const prop = (v) => data(v).replace(/:/g, "%3A").replace(/,/g, "%2C");
  console.log(`::${level} title=${prop(title)}::${data(message)}`);
}

let app = null;
async function fail(message) {
  console.error(`[e2e] ✗ FAIL (${since()}): ${message}`);
  annotate("error", "Desktop app end-to-end", message);
  try {
    for (const [i, page] of (app?.windows() ?? []).entries()) await page.screenshot({ path: path.join(shotsDir, `failure-${i}.png`) }).catch(() => {});
  } catch {
    /* best effort */
  }
  try {
    await app?.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
}

function ok(label) {
  console.log(`[e2e] ✓ ${label} (${since()})`);
}

function defaultExe() {
  const yml = fs.readFileSync(path.join(desktopDir, "electron-builder.yml"), "utf8");
  const productName = /^productName:\s*(.+?)\s*$/m.exec(yml)?.[1] ?? "Soundwave AI";
  return path.join(desktopDir, "release", "win-unpacked", `${productName}.exe`);
}

const exe = path.resolve(process.argv[2] ?? defaultExe());
if (!fs.existsSync(exe)) await fail(`packaged app not found at ${exe} — run electron-builder first`);

// The recording, with 4 s of silence after it so "stop when I pause" can kick in
// (Chromium loops the fake microphone's file).
const sample = path.join(desktopDir, "jfk.wav");
if (!fs.existsSync(sample)) await fail(`no ${sample} (CI downloads whisper.cpp's samples/jfk.wav)`);
const ffmpeg = path.join(desktopDir, "bin", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
const micFile = path.join(desktopDir, "e2e-mic.wav");
try {
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", sample, "-af", "apad=pad_dur=4", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", micFile], {
    windowsHide: true,
  });
} catch (err) {
  await fail(`couldn't prepare the fake microphone recording with ${ffmpeg}: ${err.message}`);
}
fs.mkdirSync(shotsDir, { recursive: true });

const { _electron: electron } = await import("playwright-core");

console.log(`[e2e] launching ${exe}`);
try {
  app = await electron.launch({
    executablePath: exe,
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${micFile}`],
    timeout: 180_000,
  });
} catch (err) {
  await fail(`the app didn't start under Playwright: ${err.message}`);
}
app.process().stdout?.on("data", (d) => process.stdout.write(`    [app] ${d}`));
app.process().stderr?.on("data", (d) => {
  const line = String(d);
  if (!/Debugger listening|DevTools listening|For help, see/.test(line)) process.stdout.write(`    [app:err] ${line}`);
});

const shell = () => app.evaluate(() => globalThis.__soundwaveShell.state());
const voiceTurns = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("soundwave_agent_chat_history") || "[]").filter((m) => m.viaVoice).map((m) => m.text));

try {
  // ── 1. Startup: Command Center, tray, shortcut, bridge ────────────────────
  const main = await app.firstWindow({ timeout: 180_000 });
  main.on("console", (m) => {
    if (m.type() === "error" || /\[voice\]/.test(m.text())) console.log(`    [main:${m.type()}] ${m.text()}`);
  });
  await main.waitForURL(/\/agent/, { timeout: 120_000 });
  await main.locator('button[aria-label="Talk to Soundwave"]').waitFor({ timeout: 60_000 });
  ok(`main window shows the Command Center (${main.url()})`);

  const state = await shell();
  if (!state.tray) await fail("no tray icon");
  ok("tray icon is up");
  if (!state.hotkey.hotkeyEnabled || !state.hotkey.hotkeyRegistered) await fail(`voice shortcut not registered: ${state.hotkey.hotkeyError ?? "disabled"}`);
  ok(`voice shortcut ${state.hotkey.hotkeyLabel} is registered system-wide`);

  const bridge = await main.evaluate(async () => {
    const d = window.soundwaveDesktop;
    if (!d?.isDesktop) return null;
    const s = await d.getState();
    return { version: s.version, closeToTray: s.closeToTray, choices: s.hotkeyChoices.length };
  });
  if (!bridge) await fail("window.soundwaveDesktop (preload bridge) is missing in the page");
  ok(`desktop bridge works (app ${bridge.version}, close-to-tray ${bridge.closeToTray}, ${bridge.choices} shortcut choices)`);

  const engine = await main.evaluate(() => fetch("/api/v1/agent/transcribe/status").then((r) => r.json()));
  if (!engine.available) await fail(`speech engine unavailable in the packaged app: ${engine.reason}`);
  ok(`speech engine ready in the packaged app (whisper.cpp ${engine.model})`);
  await main.screenshot({ path: path.join(shotsDir, "1-command-center.png") });

  // ── 2. The Command Center's mic: tap, talk, it sends when you pause ───────
  await main.evaluate(() => localStorage.setItem("soundwave_voice_debug", "1"));
  await main.locator('button[aria-label="Talk to Soundwave"]').click();
  await main.waitForFunction(() => /listening/i.test(document.body.innerText), null, { timeout: 30_000 });
  ok("tapping the mic starts listening");
  await main.screenshot({ path: path.join(shotsDir, "2-listening.png") });
  await main.waitForFunction(
    () => JSON.parse(localStorage.getItem("soundwave_agent_chat_history") || "[]").some((m) => m.viaVoice && /ask not what your country/i.test(m.text)),
    null,
    { timeout: 120_000, polling: 500 },
  );
  const heard = (await voiceTurns(main)).at(-1);
  if (!EXPECT.test(heard ?? "")) await fail(`the mic heard "${heard}"`);
  await main.waitForFunction(() => /YOU \(VOICE\)/.test(document.body.innerText), null, { timeout: 30_000 });
  ok(`mic → whisper.cpp → agent: "${heard}"`);
  annotate("notice", "Desktop E2E: Command Center mic", `Heard "${heard}" and sent it to the agent.`);
  await main.screenshot({ path: path.join(shotsDir, "3-after-mic.png") });

  // ── 3. The voice bar: shortcut while the app is in the background ─────────
  await app.evaluate(() => globalThis.__soundwaveShell.mainWindow().hide());
  const before = (await voiceTurns(main)).length;
  await app.evaluate(() => globalThis.__soundwaveShell.voiceShortcut()); // exactly what Ctrl+Shift+Space does
  let overlay = null;
  for (let i = 0; i < 120 && !overlay; i++) {
    overlay = app.windows().find((p) => p.url().includes("/overlay")) ?? null;
    if (!overlay) await new Promise((r) => setTimeout(r, 250));
  }
  if (!overlay) await fail("the shortcut didn't open the voice bar window");
  overlay.on("console", (m) => {
    if (m.type() === "error" || /\[voice\]/.test(m.text())) console.log(`    [voicebar:${m.type()}] ${m.text()}`);
  });
  await overlay.waitForFunction(() => /listening/i.test(document.body.innerText), null, { timeout: 30_000 });
  const visible = await shell();
  if (!visible.overlayVisible) await fail("the voice bar is listening but its window isn't visible");
  ok("the shortcut shows the voice bar and it listens (app in the background)");
  await overlay.screenshot({ path: path.join(shotsDir, "4-voice-bar-listening.png") });

  await main.waitForFunction((n) => JSON.parse(localStorage.getItem("soundwave_agent_chat_history") || "[]").filter((m) => m.viaVoice).length > n, before, {
    timeout: 120_000,
    polling: 500,
  });
  const barHeard = (await voiceTurns(main)).at(-1);
  if (!EXPECT.test(barHeard ?? "")) await fail(`the voice bar heard "${barHeard}"`);
  ok(`voice bar → whisper.cpp → agent, and the turn is in the Command Center's conversation: "${barHeard}"`);
  await overlay.waitForFunction(() => !/listening|transcribing|thinking/i.test(document.body.innerText), null, { timeout: 60_000 }).catch(() => {});
  await overlay.screenshot({ path: path.join(shotsDir, "5-voice-bar-reply.png") });
  const barText = (await overlay.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").trim();
  annotate("notice", "Desktop E2E: voice bar", `Heard "${barHeard}". Voice bar now shows: ${barText.slice(0, 200)}`);

  // ── 4. Tray behaviour + notifications bridge ──────────────────────────────
  await app.evaluate(() => {
    const w = globalThis.__soundwaveShell.mainWindow();
    w.show();
    w.close(); // the window's X button
  });
  await new Promise((r) => setTimeout(r, 1500));
  const afterClose = await shell();
  if (afterClose.mainVisible || !afterClose.tray) await fail("closing the window should keep Soundwave running in the tray");
  ok("closing the window keeps Soundwave running in the tray");
  await main.evaluate(() => window.soundwaveDesktop.notify({ title: "Soundwave AI (CI)", body: "Notification check", route: "/agent" }));
  const supported = await app.evaluate(({ Notification }) => Notification.isSupported());
  ok(`notification bridge called (Windows notifications supported: ${supported})`);

  await app.close();
  ok("app quits cleanly");
  console.log(`[e2e] PASS (${since()})`);
  process.exit(0);
} catch (err) {
  await fail(err && err.message ? err.message.split("\n").slice(0, 6).join(" | ") : String(err));
}
