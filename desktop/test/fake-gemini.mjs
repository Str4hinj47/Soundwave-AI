// A stand-in for Google's Gemini API on loopback, for smoke.mjs and e2e.mjs:
// the packaged app is pointed at it with GEMINI_API_BASE, so Settings → Brain
// and chat answered by "Gemini" can be tested without a real key. It answers
// like the real API (generateContent JSON, function calls with ids and thought
// signatures) and records every request for the checks.
import http from "node:http";

export const FAKE_KEY = "AIzaSyFAKE-soundwave-ci-0000000000wxyz";
export const FAKE_HELLO = "Hello from the fake Gemini — I'm the agent's brain in this test.";

const text = (t) => ({ candidates: [{ content: { role: "model", parts: [{ text: t, thoughtSignature: "ZmFrZS10ZXh0" }] }, finishReason: "STOP" }] });
const call = (name, args, id) => ({
  candidates: [{ content: { role: "model", parts: [{ functionCall: { id, name, args }, thoughtSignature: "ZmFrZS1jYWxs" }] }, finishReason: "STOP" }],
});

function answer(body) {
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
  return text(FAKE_HELLO);
}

export async function startFakeGemini() {
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
      seen.push({ method: req.method, url: req.url, key: req.headers["x-goog-api-key"], body });
      res.setHeader("content-type", "application/json");
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
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  return { url, seen, close: () => new Promise((resolve) => server.close(resolve)) };
}
