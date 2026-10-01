// The phone companion with the agent's brain on: the phone app's own client
// code (mobile/src/lib) → the PC's listener (lib/companion) → the agent →
// Gemini (a fake one on loopback). The path a message typed or spoken on the
// phone takes on a real PC once a key is saved in Settings → Brain.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const mocks = vi.hoisted(() => {
  // As in the desktop app: the phone companion, Settings → Brain and the PC tools.
  process.env.COMPANION = "1";
  process.env.DESKTOP_APP = "1";
  return {
    startShortJob: vi.fn(async (_p: Record<string, unknown>) => ({ jobId: "job-from-phone" })),
    getActiveShortJobs: vi.fn((): Array<{ jobId: string; topic: string; startedAt: number }> => []),
  };
});

vi.mock("../src/routes/agentShort.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/routes/agentShort.js")>();
  return { ...actual, startShortJob: mocks.startShortJob, getActiveShortJobs: mocks.getActiveShortJobs };
});

const { config } = await import("../src/config.js");
const { createApp } = await import("../src/app.js");
const { JsonStore, setStoreForTests, getStore } = await import("../src/lib/store.js");
const settings = await import("../src/lib/brain/settings.js");
const service = await import("../src/lib/companion/service.js");
const listener = await import("../src/lib/companion/listener.js");
const conversation = await import("../src/lib/conversation.js");
const phone = await import("../../mobile/src/lib/protocol.js");
const { CompanionClient, pairWithPc } = await import("../../mobile/src/lib/client.js");

// ── A fake Gemini API ───────────────────────────────────────────────────────

interface Seen {
  url: string;
  key: string | undefined;
  body: any;
}
type Reply = { status?: number; body: unknown };

const fake = { seen: [] as Seen[], queue: [] as Array<(req: Seen) => Reply>, url: "" };

const gemini = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const seen: Seen = { url: req.url ?? "", key: req.headers["x-goog-api-key"] as string | undefined, body: raw ? JSON.parse(raw) : null };
    fake.seen.push(seen);
    const next = fake.queue.shift();
    const out = next ? next(seen) : { status: 500, body: { error: { code: 500, message: "test: nothing queued", status: "INTERNAL" } } };
    res.writeHead(out.status ?? 200, { "content-type": "application/json" });
    res.end(JSON.stringify(out.body));
  });
});

const text = (t: string) => (): Reply => ({
  body: { candidates: [{ content: { role: "model", parts: [{ text: t, thoughtSignature: "dGV4dA==" }] }, finishReason: "STOP" }] },
});
const call = (name: string, args: Record<string, unknown>, id: string) => (): Reply => ({
  body: { candidates: [{ content: { role: "model", parts: [{ functionCall: { id, name, args }, thoughtSignature: "Y2FsbA==" }] }, finishReason: "STOP" }] },
});
const generateCalls = () => fake.seen.filter((s) => s.url.includes(":generateContent"));
const lastTurn = (s: Seen): string => (s.body.contents.at(-1).parts as Array<{ text?: string }>).map((p) => p.text ?? "").join("");
const instructionOf = (s: Seen): string => s.body.systemInstruction.parts[0].text;
const toolNames = (s: Seen): string[] =>
  (s.body.tools as Array<{ functionDeclarations?: Array<{ name: string }> }>).flatMap((t) => (t.functionDeclarations ?? []).map((d) => d.name));

// ── The PC and a paired phone ───────────────────────────────────────────────

const KEY = "AIzaSyPhoneTest-0123456789-abcdwxyz";
const DATA = config.dataDir;
let app: ReturnType<typeof createApp>;

/** What Settings → Brain → Save does in the PC app. */
async function saveKeyOnPc() {
  const res = await request(app).put("/api/v1/brain").set("Host", "127.0.0.1").send({ apiKey: KEY });
  expect(res.status).toBe(200);
  expect(res.body.configured).toBe(true);
}

async function pairedClient() {
  service.setEnabledFlag(true);
  await listener.startListener({ host: "127.0.0.1", port: 0 });
  const port = listener.listenerState().port!;
  const session = service.activePairing() ?? service.startPairing();
  const link = phone.parsePairingLink(service.pairingLink(session, port, [{ address: "127.0.0.1", name: "lo", kind: "lan" }]))!;
  const record = await pairWithPc(link, { name: "Test Phone", platform: "android", model: "Pixel Test", appVersion: "1.0.0" });
  const client = new CompanionClient(record);
  expect(await client.connect()).toBe(true);
  return client;
}

beforeAll(async () => {
  await new Promise<void>((r) => gemini.listen(0, "127.0.0.1", r));
  fake.url = `http://127.0.0.1:${(gemini.address() as AddressInfo).port}`;
  (config as { geminiApiBase: string }).geminiApiBase = fake.url;
  fs.rmSync(DATA, { recursive: true, force: true });
  const store = new JsonStore();
  await store.init();
  setStoreForTests(store);
  app = createApp();
});

beforeEach(() => {
  for (const f of ["companion.json", "agent-conversation.json"]) fs.rmSync(path.join(DATA, f), { force: true });
  service.resetCompanionStateForTests();
  conversation.resetConversationForTests();
  settings.resetBrainSettingsForTests();
  fake.seen.length = 0;
  fake.queue.length = 0;
  mocks.startShortJob.mockClear();
  mocks.getActiveShortJobs.mockReset();
  mocks.getActiveShortJobs.mockReturnValue([]);
});

afterEach(async () => {
  await listener.stopListener();
});

afterAll(async () => {
  await listener.stopListener();
  gemini.close();
});

// ── The tests ───────────────────────────────────────────────────────────────

describe("the phone app, with Gemini as the agent's brain", () => {
  it("is answered by Gemini as soon as the PC has a key — no phone update, no restart", async () => {
    const client = await pairedClient();

    // No key on the PC yet: the agent says where to add one.
    const before = await client.send("are you there?");
    expect(before.text).toMatch(/Gemini API key/);
    expect(generateCalls()).toHaveLength(0);

    await saveKeyOnPc();
    fake.queue.push(text("I'm here! Want me to make a short?"));
    const reply = await client.send("hello from my phone", { viaVoice: true });
    expect(reply).toMatchObject({ sender: "assistant", text: "I'm here! Want me to make a short?" });

    const [asked] = generateCalls();
    expect(asked!.key).toBe(KEY);
    expect(asked!.url).toBe("/v1beta/models/gemini-3.8-flash:generateContent");
    expect(lastTurn(asked!)).toBe("hello from my phone");
    // The conversation so far goes along (the earlier no-key exchange included).
    expect(asked!.body.contents.map((c: { role: string }) => c.role)).toEqual(["user", "model", "user"]);
    expect(asked!.body.contents[0].parts[0].text).toBe("are you there?");
    // Gemini knows this came from the phone — and that its tools act on the PC.
    expect(instructionOf(asked!)).toMatch(/sent from the Soundwave phone app/);
    expect(instructionOf(asked!)).toMatch(/appear on the PC, not on the phone/);
    expect(toolNames(asked!)).toEqual(expect.arrayContaining(["make_youtube_short", "get_short_progress", "list_my_videos", "show_video", "get_pc_status", "open_website"]));

    // One conversation: the PC has it, the phone's copy matches.
    const shared = conversation.getConversation().messages;
    expect(shared.at(-1)!.id).toBe(reply.id);
    expect(shared.at(-2)).toMatchObject({ sender: "user", text: "hello from my phone", via: "phone", viaVoice: true });
    expect(client.conversation!.messages.map((m) => m.id)).toEqual(shared.map((m) => m.id));
  });

  it("checks the PC when asked from the phone (a tool round trip)", async () => {
    await saveKeyOnPc();
    const client = await pairedClient();
    fake.queue.push(call("get_pc_status", {}, "pc-1"), (req) => {
      const r = req.body.contents.at(-1).parts[0].functionResponse.response;
      return text(`Your PC (${r.os}) is doing fine: ${r.memory.usedPercent}% of memory in use.`)();
    });

    const reply = await client.send("how's my PC doing?");
    expect(reply.text).toMatch(/^Your PC \(.+\) is doing fine: \d+% of memory in use\.$/);

    const second = generateCalls()[1]!;
    // The model's turn went back exactly as received (thought signature), then the result under the call's id.
    expect(second.body.contents.at(-2)).toEqual({ role: "model", parts: [{ functionCall: { id: "pc-1", name: "get_pc_status", args: {} }, thoughtSignature: "Y2FsbA==" }] });
    expect(second.body.contents.at(-1).parts[0].functionResponse).toMatchObject({ id: "pc-1", name: "get_pc_status" });
  });

  it("makes a short from the phone in the phone's chosen voice, and the phone follows its progress", async () => {
    await saveKeyOnPc();
    const client = await pairedClient();
    const store = await getStore();
    mocks.startShortJob.mockImplementationOnce(async (p: Record<string, unknown>) => {
      const job = await store.createJob({
        projectId: null,
        userId: "local-user",
        status: "PROCESSING",
        progress: 35,
        settings: { topic: p.topic, step: "Recording the voiceover" } as never,
        outputUrl: null,
        errorMessage: null,
        startedAt: new Date().toISOString(),
        completedAt: null,
      });
      return { jobId: job.id };
    });
    fake.queue.push(
      call("make_youtube_short", { topic: "octopuses", details: "they have three hearts" }, "s-1"),
      text("On it! Your octopus short is rendering — it'll show up here in a few minutes."),
    );

    const reply = await client.send("make a short about octopuses and mention their three hearts", { viaVoice: true, voice: "en-GB-RyanNeural" });
    expect(reply).toMatchObject({ text: "On it! Your octopus short is rendering — it'll show up here in a few minutes.", jobState: "started", topic: "octopuses" });
    expect(mocks.startShortJob).toHaveBeenCalledTimes(1);
    expect(mocks.startShortJob.mock.calls[0]![0]).toMatchObject({ topic: "octopuses", scriptBrief: "they have three hearts", voice: "en-GB-RyanNeural", userId: "local-user" });

    // The phone's live view: the rendering short and how far along it is.
    await client.sync();
    expect(client.jobs).toEqual([expect.objectContaining({ id: reply.jobId, status: "PROCESSING", progress: 35, topic: "octopuses", step: "Recording the voiceover" })]);
    await store.updateJob(reply.jobId!, { status: "FAILED", errorMessage: "test over" });
  });

  it("shows a finished short that the phone can play", async () => {
    await saveKeyOnPc();
    const client = await pairedClient();
    const store = await getStore();
    const job = await store.createJob({
      projectId: null,
      userId: "local-user",
      status: "COMPLETED",
      progress: 100,
      settings: { topic: "honey never spoils" } as never,
      outputUrl: null,
      errorMessage: null,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
    await store.updateJob(job.id, { outputUrl: `/api/v1/export/jobs/${job.id}/download` });
    const bytes = Buffer.from("not really an mp4 ".repeat(5000));
    fs.mkdirSync(path.join(config.uploadsDir, "jobs"), { recursive: true });
    const file = path.join(config.uploadsDir, "jobs", `${job.id}.mp4`);
    fs.writeFileSync(file, bytes);
    try {
      fake.queue.push(call("show_video", {}, "v-1"), text("Here's your honey short."));
      const reply = await client.send("show me my latest short");
      // The player's title on the phone is the short's topic.
      expect(reply).toMatchObject({ text: "Here's your honey short.", topic: "honey never spoils", videoUrl: `/api/v1/export/jobs/${job.id}/download` });

      // The phone's Watch button reads the short from the link (watchableJob in
      // mobile/src/components/Message.tsx) and plays the file it fetches from the PC.
      const watch = /\/export\/jobs\/([\w-]+)\/download/.exec(reply.videoUrl ?? "")?.[1];
      expect(watch).toBe(job.id);
      const blob = await client.video(watch!);
      expect(Buffer.from(await blob.arrayBuffer()).equals(bytes)).toBe(true);
    } finally {
      fs.rmSync(file, { force: true });
      await store.updateJob(job.id, { status: "FAILED" });
    }
  });

  it("tells the phone what's wrong when Google refuses the key", async () => {
    await saveKeyOnPc();
    const client = await pairedClient();
    fake.queue.push(() => ({
      status: 400,
      body: { error: { code: 400, message: "API key not valid. Please pass a valid API key.", status: "INVALID_ARGUMENT", details: [{ reason: "API_KEY_INVALID" }] } },
    }));
    const reply = await client.send("hi");
    expect(reply.text).toMatch(/Gemini API key isn't valid.*Settings → Brain/);
  });

  it("only marks the phone's messages as from the phone", async () => {
    await saveKeyOnPc();
    fake.queue.push(text("Hi from the PC chat."));
    const res = await request(app).post("/api/v1/agent/chat").send({ message: "typed in the Command Center" });
    expect(res.body.reply).toBe("Hi from the PC chat.");
    expect(instructionOf(generateCalls()[0]!)).not.toMatch(/phone app, so the user/);
  });
});
