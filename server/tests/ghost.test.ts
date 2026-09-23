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

describe("Ghost Operator API", () => {
  let createdMacroId = "";

  it("lists all built-in macro workflows", async () => {
    const res = await request(app).get("/api/v1/ghost/macros");
    expect(res.status).toBe(200);
    expect(res.body.macros).toBeDefined();
    expect(res.body.macros.length).toBeGreaterThanOrEqual(4);

    const morningMacro = res.body.macros.find((m: any) => m.id === "creator_morning_prep");
    expect(morningMacro).toBeDefined();
    expect(morningMacro.steps.length).toBe(4);
  });

  it("decomposes complex natural language into sequential action steps", async () => {
    const res = await request(app)
      .post("/api/v1/ghost/decompose")
      .send({
        instruction: "open chrome, unmute volume, and check system stats",
      });

    expect(res.status).toBe(200);
    expect(res.body.stepsCount).toBe(3);
    expect(res.body.steps[0].action).toBe("open_app");
    expect(res.body.steps[1].action).toBe("computer_settings");
    expect(res.body.steps[2].action).toBe("system_monitor");
  });

  it("creates and saves a custom automation macro", async () => {
    const res = await request(app)
      .post("/api/v1/ghost/macros")
      .send({
        name: "Morning News & Audio",
        description: "Navigates to news and unmutes audio",
        category: "productivity",
        triggerPhrases: ["morning news"],
        steps: [
          { action: "browser_control", params: { action: "open", url: "https://news.ycombinator.com" } },
          { action: "computer_settings", params: { setting: "unmute" } },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.macro).toBeDefined();
    expect(res.body.macro.id).toBeDefined();
    createdMacroId = res.body.macro.id;
  });

  it("executes a macro workflow and returns execution telemetry", async () => {
    const res = await request(app)
      .post("/api/v1/ghost/execute")
      .send({
        macroId: "deep_focus_pomodoro",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.report).toBeDefined();
    expect(res.body.report.stepResults.length).toBe(3);
    expect(res.body.report.stepResults[0].status).toBe("SUCCESS");
  });

  it("deletes a custom macro cleanly", async () => {
    const res = await request(app).delete(`/api/v1/ghost/macros/${createdMacroId}`);
    expect(res.status).toBe(204);
  });
});
