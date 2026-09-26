/** Headless mount smoke test — renders the companion in jsdom and walks
 *  through onboarding + a chat roundtrip to catch runtime crashes. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = fs.readFileSync(path.join(root, "dist", "index.html"), "utf8");
const jsMatch = html.match(/src="\.\/(assets\/[^"]+\.js)"/);
if (!jsMatch) { console.error("no bundle found"); process.exit(1); }

const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
  url: "http://localhost:5174/",
  pretendToBeVisual: true,
});

const w = dom.window;
for (const k of ["window", "document", "navigator", "HTMLElement", "SVGElement", "Element", "Node", "CustomEvent", "MouseEvent", "KeyboardEvent", "getComputedStyle", "localStorage", "sessionStorage", "requestAnimationFrame", "cancelAnimationFrame", "Event", "MutationObserver"]) {
  if (w[k] === undefined) continue;
  try { globalThis[k] = w[k]; }
  catch { try { Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true }); } catch { /* readonly */ } }
}
globalThis.self = w;
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLElement.prototype.hasPointerCapture = function () { return false; };
w.HTMLElement.prototype.setPointerCapture = function () {};
if (!w.matchMedia) w.matchMedia = () => ({ matches: false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} });
class RO { observe(){} unobserve(){} disconnect(){} }
w.ResizeObserver = RO; globalThis.ResizeObserver = RO;
class IO { observe(){} unobserve(){} disconnect(){} }
w.IntersectionObserver = IO; globalThis.IntersectionObserver = IO;

const errors = [];
const origError = console.error;
console.error = (...a) => { errors.push(a.map(String).join(" ")); origError(...a); };
w.addEventListener("error", (e) => errors.push("window.error: " + e.message));
process.on("unhandledRejection", (e) => errors.push("unhandledRejection: " + e));

const bundle = path.join(root, "dist", jsMatch[1]);
await import(bundle);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(400);

const $ = (sel) => w.document.querySelector(sel);
const $$ = (sel) => [...w.document.querySelectorAll(sel)];
const byText = (text, sel = "button") => $$(sel).find((el) => (el.textContent || "").includes(text));

const rootEl = $("#root");
if (!rootEl || !rootEl.innerHTML.trim()) { console.error("FAIL: root is empty"); process.exit(1); }
console.log("mounted ✓ — onboarding welcome:", Boolean(byText("Let’s set me up")));

// walk the 5 onboarding steps deterministically
const clickButton = (needle) => {
  const b = $$("button").find((x) => (x.textContent || "").includes(needle));
  if (b) { b.click(); return true; }
  return false;
};
const clickPrimary = () => {
  // primary CTA = accent-filled pill (welcome / continue / finish)
  const cta = $$("button").find((x) => x.className.includes("bg-accent text-accent-ink") && !x.disabled);
  if (cta) { cta.click(); return true; }
  return false;
};
const snap = (label) => {
  const cta = $$("button").find((x) => x.className.includes("bg-accent text-accent-ink") && !x.disabled);
  console.log(`  step ${label}: cta="${(cta?.textContent || "(none)").trim().slice(0, 30)}"`);
};

snap(0);
clickPrimary(); await sleep(160);          // welcome -> language
snap(1);
clickButton("English"); await sleep(80);
clickPrimary(); await sleep(160);          // language -> look
snap(2);
clickButton("Cream"); await sleep(80);
clickPrimary(); await sleep(160);          // look -> mic
snap(3);
clickButton("Test my microphone"); await sleep(350);
clickPrimary(); await sleep(160);          // mic -> brain
snap(4);
// step 5: pick local brain + finish
const local = $$("button").find((b) => b.textContent.includes("Local · Free"));
if (local) { local.click(); await sleep(80); }
const meet = $$("button").find((b) => b.textContent.includes("Meet Echo"));
if (meet) { meet.click(); await sleep(300); }
console.log("panel after onboarding ✓ — today view:", Boolean($$(".text-\\[17px\\]").length || byText("Next up") || w.document.body.textContent.includes("Quick task")));

// switch to chat and send a local-intent message
const chatTab = $$("button").find((b) => (b.textContent || "").includes("Chat"));
if (chatTab) { chatTab.click(); await sleep(150); }
const ta = $("textarea");
if (ta) {
  const setter = Object.getOwnPropertyDescriptor(w.HTMLTextAreaElement.prototype, "value").set;
  setter.call(ta, "Create a task to ship the companion, due today");
  ta.dispatchEvent(new w.Event("input", { bubbles: true }));
  await sleep(80);
  const send = $$("button").find((b) => b.title === "Send (Enter)");
  if (send) send.click();
  await sleep(600);
}
let body = w.document.body.textContent;
console.log("echo replied with task card ✓:", body.includes("ship the companion"));

// plan-my-day with a real task on the list
const ta2 = $("textarea");
if (ta2) {
  const setter = Object.getOwnPropertyDescriptor(w.HTMLTextAreaElement.prototype, "value").set;
  setter.call(ta2, "Plan my day");
  ta2.dispatchEvent(new w.Event("input", { bubbles: true }));
  await sleep(80);
  const send = $$("button").find((b) => b.title === "Send (Enter)");
  if (send) send.click();
  await sleep(500);
}
body = w.document.body.textContent;
console.log("plan card rendered ✓:", body.includes("Today’s plan"));

// visit every tab — mounting each view catches runtime crashes
for (const tab of ["Today", "Tasks", "Notes", "Focus", "Habits", "Calendar", "Settings", "Chat"]) {
  const btn = $$("button").find((b) => b.title === tab);
  if (btn) { btn.click(); await sleep(140); console.log(`  view ${tab} ✓`); }
  else console.log(`  view ${tab} ✗ (rail button not found)`);
}

// add a task from the Tasks tab, a note from Notes, a habit from Habits
const setVal = (el, v) => {
  const setter = Object.getOwnPropertyDescriptor(w.HTMLTextAreaElement.prototype, "value").set;
  const proto = el.tagName === "TEXTAREA" ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
  el.dispatchEvent(new w.Event("input", { bubbles: true }));
};
const railClick = (tab) => { const b = $$("button").find((x) => x.title === tab); if (b) b.click(); };
const enter = (el) => el.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

railClick("Tasks"); await sleep(150);
const taskInput = $$("input").find((i) => i.placeholder === "Add a task…");
if (taskInput) { setVal(taskInput, "Review companion design"); enter(taskInput); await sleep(150); }
console.log("task added ✓:", w.document.body.textContent.includes("Review companion design"));

railClick("Notes"); await sleep(150);
const newNote = $$("button").find((b) => (b.textContent || "").includes("New"));
if (newNote) { newNote.click(); await sleep(150); }
const noteTa = $("textarea");
if (noteTa) { setVal(noteTa, "Echo is my new buddy"); await sleep(150); }
const back = $$("button").find((b) => b.querySelector("svg") && b.className.includes("rounded-full") && b.closest("div")?.className.includes("border-b"));
if (back) { back.click(); await sleep(150); }
console.log("note editor ✓:", w.document.body.textContent.includes("Echo is my new buddy"));

railClick("Habits"); await sleep(150);
const habitInput = $$("input").find((i) => i.placeholder === "New habit…");
if (habitInput) { setVal(habitInput, "Drink water"); enter(habitInput); await sleep(150); }
console.log("habit added ✓:", w.document.body.textContent.includes("Drink water"));

railClick("Settings"); await sleep(400); // pingBrain roundtrip
console.log("settings + brain ping ✓:", w.document.body.textContent.includes("Local · Free"));

railClick("Calendar"); await sleep(150);
console.log("calendar ✓:", w.document.body.textContent.includes("Nothing booked") || /events?/.test(w.document.body.textContent));

// flip to the cloud brain and converse with the API-backed agent
railClick("Settings"); await sleep(250);
const cloudBtn = $$("button").find((b) => b.textContent.includes("Soundwave Cloud · Bigger brain"));
if (cloudBtn) { cloudBtn.click(); await sleep(250); }
railClick("Chat"); await sleep(200);
const ta3 = $("textarea");
if (ta3) {
  const setter = Object.getOwnPropertyDescriptor(w.HTMLTextAreaElement.prototype, "value").set;
  setter.call(ta3, "hello");
  ta3.dispatchEvent(new w.Event("input", { bubbles: true }));
  await sleep(60);
  const send = $$("button").find((b) => b.title === "Send (Enter)");
  if (send) send.click();
  await sleep(1500);
}
const cloudOk = w.document.body.textContent.includes("Soundwave");
console.log("cloud brain replied through /api ✓:", cloudOk);

const fatal = errors.filter((e) => /Error|error/i.test(e) && !/Not implemented|Could not parse CSS/i.test(e));
if (fatal.length) {
  console.error("RUNTIME ERRORS:\n" + fatal.slice(0, 8).join("\n---\n"));
  process.exit(1);
}
console.log("SMOKE PASS");
process.exit(0);
