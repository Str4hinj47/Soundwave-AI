import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { JsonStore, setStoreForTests } from "../src/lib/store.js";

let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  const store = new JsonStore();
  await store.init();
  setStoreForTests(store);
  app = createApp();
});

describe("Agent Chat API (/api/v1/agent/chat)", () => {
  it("rejects request without prompt", async () => {
    const res = await request(app)
      .post("/api/v1/agent/chat")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("handles conversational chat queries with intelligent reply", async () => {
    const res = await request(app)
      .post("/api/v1/agent/chat")
      .send({ prompt: "Hello Soundwave AI, what can you do?" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.reply).toBeDefined();
    expect(typeof res.body.reply).toBe("string");
    expect(res.body.reply.length).toBeGreaterThan(10);
    expect(res.body.executionReport).toBeNull();
  });

  it("recognizes morning workflow trigger in chat prompt", async () => {
    const res = await request(app)
      .post("/api/v1/agent/chat")
      .send({ prompt: "Prepare my workstation for the morning" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.reply).toMatch(/morning|workstation/i);
    expect(res.body.executionReport).toBeDefined();
    expect(res.body.executionReport.workflowName).toMatch(/Creator|Workstation|Setup/i);
    expect(res.body.executionReport.stepResults.length).toBeGreaterThan(0);
  });

  it("recognizes focus mode trigger in chat prompt", async () => {
    const res = await request(app)
      .post("/api/v1/agent/chat")
      .send({ prompt: "Start deep focus mode now" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.executionReport).toBeDefined();
    expect(res.body.executionReport.workflowName).toMatch(/Focus/i);
  });

  it("handles computer control actions via chat", async () => {
    const res = await request(app)
      .post("/api/v1/agent/chat")
      .send({ prompt: "Open browser" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.reply).toMatch(/browser/i);
  });
});
