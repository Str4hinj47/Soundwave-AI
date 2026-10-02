// A stand-in for Google's Gemini API on loopback, for smoke.mjs and e2e.mjs
// (and the phone app's emulator test, mobile/e2e): the app is pointed at it
// with GEMINI_API_BASE, so Settings → Brain and chat answered by "Gemini" can
// be tested without a real key. It answers like the real API (generateContent
// JSON, function calls with ids and thought signatures) and records every
// request for the checks — GET /_fake/requests lists them for other processes.
//
//   node desktop/test/fake-gemini.mjs --port 4100     (runs until stopped)
import http from "node:http";
import { pathToFileURL } from "node:url";

export const FAKE_KEY = "AIzaSyFAKE-soundwave-ci-0000000000wxyz";
export const FAKE_HELLO = "Hello from the fake Gemini — I'm the agent's brain in this test.";
/** What the phone gets when it answers by itself (PC off). */
export const FAKE_PHONE = "Hello from the fake Gemini, answering on your phone while the PC is off.";
/** Every Morning Setup briefing. */
export const FAKE_MORNING = "Good morning from the fake Gemini! Here's your Morning Setup briefing.";

const text = (t) => ({ candidates: [{ content: { role: "model", parts: [{ text: t, thoughtSignature: "ZmFrZS10ZXh0" }] }, finishReason: "STOP" }] });
const call = (name, args, id) => ({
  candidates: [{ content: { role: "model", parts: [{ functionCall: { id, name, args }, thoughtSignature: "ZmFrZS1jYWxs" }] }, finishReason: "STOP" }],
});

function answer(body) {
  const instruction = body?.systemInstruction?.parts?.[0]?.text ?? "";
  // (The agent's own instruction mentions Morning Setup too — match the briefing writer's exact words.)
  if (/^You are Soundwave[^\n]*Write the user's Morning Setup briefing/.test(instruction)) return text(FAKE_MORNING);
  if (/^You keep the long-term memory of Soundwave/.test(instruction)) return text("The user tested Soundwave AI in CI.");
  const last = body?.contents?.at(-1);
  const result = last?.parts?.find((p) => p.functionResponse)?.functionResponse;
  if (result) {
    const r = result.response ?? {};
    if (result.name === "get_pc_status") return text(`Your PC runs ${r.os} with ${r.cpu?.cores} CPU cores; ${r.memory?.usedPercent}% of memory is in use.`);
    return text(`Done (${result.name}).`);
  }
  const said = (last?.parts ?? []).map((p) => p.text ?? "").join(" ");
  if (/connection test/i.test(said)) return text("ready");
  if (/how is my pc|pc status/i.test(said)) return call("get_pc_status", {}, "pc-status-1");
  if (/answering from the Soundwave phone app on your own/.test(instruction)) return text(FAKE_PHONE);
  return text(FAKE_HELLO);
}

// A stand-in for Open-Meteo (Morning Setup's weather): OPEN_METEO_*_URL=<fake>/geocode, /forecast.
const GEOCODE = { results: [{ name: "Kruševac", latitude: 43.58, longitude: 21.33, country: "Serbia", country_code: "RS" }] };
const FORECAST = {
  current: { temperature_2m: 14.2, weather_code: 2 },
  daily: { weather_code: [2], temperature_2m_max: [19.4], temperature_2m_min: [8.1], precipitation_probability_max: [10] },
};

export async function startFakeGemini({ port = 0 } = {}) {
  const seen = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      let body = null;
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        /* not JSON */
      }
      res.setHeader("content-type", "application/json");
      // The phone app calls "Gemini" straight from its WebView (https://localhost) when the PC is off.
      res.setHeader("access-control-allow-origin", "*");
      res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
      res.setHeader("access-control-allow-headers", "content-type, x-goog-api-key");
      if (req.headers["access-control-request-private-network"]) res.setHeader("access-control-allow-private-network", "true");
      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        return res.end();
      }
      if (req.method === "GET" && req.url === "/_fake/requests") return res.end(JSON.stringify(seen));
      if (req.method === "GET" && (req.url ?? "").startsWith("/geocode")) return res.end(JSON.stringify(GEOCODE));
      if (req.method === "GET" && (req.url ?? "").startsWith("/forecast")) return res.end(JSON.stringify(FORECAST));
      seen.push({ method: req.method, url: req.url, key: req.headers["x-goog-api-key"], body });
      if (req.headers["x-goog-api-key"] !== FAKE_KEY) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: { code: 400, message: "API key not valid. Please pass a valid API key.", status: "INVALID_ARGUMENT", details: [{ reason: "API_KEY_INVALID" }] } }));
      }
      if (req.method === "GET" && /^\/v1beta\/models\?/.test(req.url ?? "")) {
        return res.end(JSON.stringify({ models: [{ name: "models/gemini-3.8-flash", displayName: "Gemini 3.8 Flash", supportedGenerationMethods: ["generateContent"] }] }));
      }
      if (req.method === "POST" && /^\/v1beta\/models\/[^/]+:generateContent$/.test(req.url ?? "")) return res.end(JSON.stringify(answer(body)));
      res.statusCode = 404;
      res.end(JSON.stringify({ error: { code: 404, message: `fake Gemini: no route ${req.method} ${req.url}`, status: "NOT_FOUND" } }));
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  return { url, seen, close: () => new Promise((resolve) => server.close(resolve)) };
}

// Run on its own: node fake-gemini.mjs [--port N]
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf("--port");
  const { url } = await startFakeGemini({ port: i > 0 ? Number(process.argv[i + 1]) : 0 });
  console.log(`fake Gemini listening on ${url} (key ${FAKE_KEY})`);
}
