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
const { FAKE_HELLO, FAKE_KEY, FAKE_MORNING, startFakeGemini } = await import(pathToFileURL(path.join(desktopDir, "test", "fake-gemini.mjs")).href);
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

function post(url, body, contentType, timeoutMs = 180_000, method = "POST") {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers: { "Content-Type": contentType, "Content-Length": body.length } }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {
          /* not JSON */
        }
        resolve({ status: res.statusCode, body: json ?? text });
      });
    });
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error("timeout")));
    req.end(body);
  });
}

// On GitHub Actions, key results also become annotations on the run page.
function annotate(level, title, message) {
  if (process.env.GITHUB_ACTIONS !== "true") return;
  const data = (v) => String(v).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  const prop = (v) => data(v).replace(/:/g, "%3A").replace(/,/g, "%2C");
  console.log(`::${level} title=${prop(title)}::${data(message)}`);
}

function assert(cond, label) {
  if (!cond) {
    console.error(`[smoke] ✗ FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`[smoke] ✓ ${label}`);
}

// The agent's brain talks to a fake Gemini on loopback (no real key in CI).
const fakeGemini = await startFakeGemini();
process.env.GEMINI_API_BASE = fakeGemini.url;
process.env.OPEN_METEO_GEOCODING_URL = `${fakeGemini.url}/geocode`;
process.env.OPEN_METEO_FORECAST_URL = `${fakeGemini.url}/forecast`;

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

  // The agent's Soundwave voice streams from this same origin. The page's CSP
  // must allow that (a data: URL used to be blocked here, and the browser's
  // robotic built-in voice read the replies instead).
  const csp = String(spa.headers["content-security-policy"] || "");
  assert(/media-src 'self'/.test(csp) && !/media-src[^;]*data:/.test(csp), "CSP plays same-origin speech (media-src 'self')");
  const speak = await get(`${appUrl}/api/v1/agent/speak/stream`);
  assert(
    speak.status === 400 && /json/.test(speak.headers["content-type"] || ""),
    "GET /api/v1/agent/speak/stream → 400 without text (the voice route is live)",
  );

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

  // Voice input: the bundled whisper.cpp (bin/whisper) must turn real speech
  // into text through the app's own endpoint — exactly what the mic does.
  const whisperCli = path.join(binDir, "whisper", process.platform === "win32" ? "whisper-cli.exe" : "whisper-cli");
  if (fs.existsSync(whisperCli)) {
    assert(process.env.WHISPER_CLI_PATH === whisperCli, "voice input uses the bundled speech engine");
    const status = JSON.parse((await get(`${appUrl}/api/v1/agent/transcribe/status`)).body);
    assert(status.available === true && typeof status.model === "string", `speech engine ready (whisper.cpp, ${status.model} model)`);

    const sample = path.join(desktopDir, "jfk.wav"); // CI downloads it; never shipped
    if (fs.existsSync(sample)) {
      const r = await post(`${appUrl}/api/v1/agent/transcribe`, fs.readFileSync(sample), "audio/wav");
      const text = typeof r.body === "object" ? r.body.text : "";
      assert(r.status === 200 && /ask not what your country/i.test(text || ""), `transcribes a real recording: "${text}" (${r.body?.elapsedMs} ms)`);
      annotate("notice", "Voice input (whisper.cpp)", `JFK sample → "${text}" in ${r.body?.elapsedMs} ms with the ${status.model} model.`);
    } else {
      console.log(`[smoke] – no ${sample}; skipping the recorded-speech check`);
    }

    // A spoken command in a Soundwave voice (needs Microsoft's online voices —
    // informational when they can't be reached), sent as MP3 so the server's
    // ffmpeg conversion runs too.
    const phrase = "Make a YouTube short about black holes.";
    const spoken = await post(`${appUrl}/api/v1/agent/speak`, Buffer.from(JSON.stringify({ text: phrase, voice: "en-US-GuyNeural" })), "application/json", 60_000).catch(
      (e) => ({ status: 0, body: { error: e.message } }),
    );
    if (spoken.status === 200 && spoken.body?.audioBase64) {
      const r = await post(`${appUrl}/api/v1/agent/transcribe`, Buffer.from(spoken.body.audioBase64, "base64"), "audio/mpeg");
      const text = typeof r.body === "object" ? r.body.text || "" : "";
      assert(r.status === 200 && /short/i.test(text) && /black ?holes?/i.test(text), `understands a spoken command: "${text}" (${r.body?.elapsedMs} ms)`);
      annotate("notice", "Voice command round trip", `Guy said "${phrase}" → heard "${text}" (${r.body?.elapsedMs} ms).`);
    } else {
      console.log(`[smoke] – Soundwave voice unavailable here (${spoken.body?.error ?? spoken.status}); skipping the spoken-command check`);
    }
  } else {
    console.log(`[smoke] – no bundled speech engine in ${path.dirname(whisperCli)}; skipping the voice input checks`);
  }

  // Phone companion (Settings → Phone): off until turned on; then a separate
  // listener answers the paired phone — and nothing else of the app's API.
  const json = (value) => Buffer.from(JSON.stringify(value));
  const comp = JSON.parse((await get(`${appUrl}/api/v1/companion`)).body);
  assert(comp.available === true && comp.enabled === false && comp.listening === false, "phone companion is available and off by default");
  const on = await post(`${appUrl}/api/v1/companion/enabled`, json({ enabled: true }), "application/json", 20_000);
  assert(on.status === 200 && on.body.listening === true && on.body.port > 0, `phone access on: listening on port ${on.body.port}`);
  const hello = await get(`http://127.0.0.1:${on.body.port}/companion/v1/hello`);
  const helloBody = JSON.parse(hello.body);
  assert(hello.status === 200 && helloBody.app === "soundwave" && helloBody.pcId === comp.pcId, `the phone listener answers (PC "${helloBody.pcName}")`);
  const code = await post(`${appUrl}/api/v1/companion/pairing`, json({}), "application/json", 20_000);
  assert(code.status === 200 && /^soundwave:\/\/pair\?/.test(code.body.pairing?.link ?? ""), `a pairing code is shown (${code.body.pairing?.code})`);
  assert((await get(`http://127.0.0.1:${on.body.port}/api/v1/companion`)).status === 404, "the app's own API isn't reachable on the phone listener");
  const off = await post(`${appUrl}/api/v1/companion/enabled`, json({ enabled: false }), "application/json", 20_000);
  assert(off.status === 200 && off.body.listening === false, "phone access off: the listener closed");
  annotate(
    "notice",
    "Phone companion",
    `Listener opened on port ${on.body.port} and closed again. Addresses in the pairing code: ${(code.body.addresses ?? []).map((a) => `${a.address} (${a.name})`).join(", ") || "none"}.`,
  );

  // The agent's brain (Settings → Brain): no key → it says so; a key → the
  // agent answers through Gemini (the fake one) and its tools run on this PC.
  const send = (method, url, value) => post(url, json(value ?? {}), "application/json", 30_000, method);
  const brain0 = JSON.parse((await get(`${appUrl}/api/v1/brain`)).body);
  assert(brain0.configured === false && brain0.settingsAvailable === true && brain0.desktopActions === true, "brain: Settings → Brain available, no key yet");
  const noKey = await send("POST", `${appUrl}/api/v1/agent/chat`, { message: "hello" });
  assert(noKey.status === 200 && noKey.body.needsBrain === true, "without a Gemini key the agent asks for one instead of making things up");
  const saved = await send("PUT", `${appUrl}/api/v1/brain`, { apiKey: FAKE_KEY });
  assert(saved.status === 200 && saved.body.configured === true && !JSON.stringify(saved.body).includes(FAKE_KEY), `brain: key saved, only a hint comes back (${saved.body.keyHint})`);
  assert(fs.existsSync(path.join(userDataDir, "data", "brain.json")), "brain: the key is stored in the user-data folder");
  const tested = await send("POST", `${appUrl}/api/v1/brain/test`, {});
  assert(tested.status === 200 && tested.body.ok === true && tested.body.reply === "ready", `brain: Test → ${tested.body.modelLabel} answered in ${tested.body.latencyMs} ms`);
  const hi = await send("POST", `${appUrl}/api/v1/agent/chat`, { message: "hello", history: [{ sender: "assistant", text: "Hi!" }] });
  assert(hi.status === 200 && hi.body.reply === FAKE_HELLO && hi.body.brain?.model === "gemini-3.8-flash", "chat is answered by Gemini");
  const asked = fakeGemini.seen.filter((r) => r.url.endsWith(":generateContent")).at(-1);
  const toolNames = asked?.body?.tools?.find((t) => t.functionDeclarations)?.functionDeclarations.map((d) => d.name) ?? [];
  assert(asked?.key === FAKE_KEY && toolNames.includes("make_youtube_short") && toolNames.includes("open_website"), `Gemini gets the key in its header and the agent's tools (${toolNames.join(", ")})`);
  if (process.platform === "win32") assert(toolNames.includes("open_app"), "on Windows the agent can open Start menu apps");
  const pcAsk = await send("POST", `${appUrl}/api/v1/agent/chat`, { message: "how is my PC doing?" });
  const pcResult = fakeGemini.seen.filter((r) => r.url.endsWith(":generateContent")).at(-1)?.body?.contents?.at(-1)?.parts?.[0]?.functionResponse;
  assert(
    pcAsk.status === 200 && pcResult?.name === "get_pc_status" && pcResult.response?.cpu?.cores > 0 && pcResult.id === "pc-status-1",
    `a tool runs on this PC and its result goes back to Gemini: ${pcResult?.response?.os}, ${pcResult?.response?.cpu?.cores} cores, ${pcResult?.response?.memory?.usedPercent}% memory used`,
  );
  let appsNote = "not on this OS";
  if (process.platform === "win32") {
    const abilities = JSON.parse((await get(`${appUrl}/api/v1/brain/abilities?app=notepad`)).body);
    assert(abilities.openApps?.available === true && abilities.openApps.count > 0, `the agent sees ${abilities.openApps?.count} Start menu apps (${abilities.openApps?.source})`);
    appsNote = `${abilities.openApps.count} Start menu apps via ${abilities.openApps.source}; "notepad" → ${abilities.openApps.match ?? "no match"}`;
  }
  annotate("notice", "Agent brain (fake Gemini)", `Key saved and tested; chat answered by Gemini; get_pc_status ran here: ${pcResult?.response?.os}, ${pcResult?.response?.cpu?.model}. Apps: ${appsNote}.`);

  // 1.4.0: the guide, the memory and Morning Setup.
  assert(toolNames.includes("soundwave_guide") && toolNames.includes("remember") && toolNames.includes("run_morning_setup"), "the agent can explain Soundwave (guide), remember things and run Morning Setup");
  const note = await send("POST", `${appUrl}/api/v1/memory/notes`, { text: "The smoke test's channel is about space facts" });
  assert(note.status === 201 && fs.existsSync(path.join(userDataDir, "data", "agent-memory.json")), "memory: a note is saved in the user-data folder");
  const recalled = await send("POST", `${appUrl}/api/v1/agent/chat`, { message: "what do you remember about me?" });
  const memoryAsk = fakeGemini.seen.filter((r) => r.url.endsWith(":generateContent")).at(-1);
  assert(recalled.status === 200 && /The smoke test's channel is about space facts/.test(memoryAsk?.body?.systemInstruction?.parts?.[0]?.text ?? ""), "memory: Gemini sees the agent's notes");
  const morningSet = await send("PUT", `${appUrl}/api/v1/morning`, { items: [], city: "Kruševac" });
  assert(morningSet.status === 200 && morningSet.body.weatherCity === "Kruševac", "Morning Setup: settings saved");
  const briefing = await send("POST", `${appUrl}/api/v1/morning/run`, {});
  const facts = fakeGemini.seen.filter((r) => r.url.endsWith(":generateContent")).at(-1)?.body?.contents?.[0]?.parts?.[0]?.text ?? "";
  assert(briefing.status === 200 && briefing.body.reply === FAKE_MORNING && /Weather: In Kruševac it's 14°C/.test(facts), "Morning Setup: a briefing written by Gemini from real facts (weather included)");
  annotate("notice", "Memory and Morning Setup", `Note saved and seen by Gemini; Morning Setup briefing from facts: ${facts.split("\n").slice(0, 2).join(" ")}`);
  const removed = await send("DELETE", `${appUrl}/api/v1/brain/key`);
  assert(removed.status === 200 && removed.body.configured === false, "brain: the key can be removed again");
  await fakeGemini.close();

  console.log("[smoke] PASS — assembled app boots and serves the Command Center.");
  process.exit(0);
} catch (err) {
  console.error("[smoke] ✗ FAIL:", err);
  process.exit(1);
}
