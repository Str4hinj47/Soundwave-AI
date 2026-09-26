/** Phone E2E smoke — opens the companion in phone mode (?phone=1) with the
 *  pairing code issued by the desktop run (scripts/smoke.mjs), hydrates state
 *  from the API server, exercises the bottom-nav layout, chats, and pushes a
 *  task back to the server. Requires: Vite (:5174) + API (:4000) running. */
import { bootJsdom, bundlePath, sleep, reportFatal } from "./bootstrap-jsdom.mjs";

// 1) pairing code from the desktop session (loopback-only endpoint)
let info;
try {
  const res = await fetch("http://localhost:5174/api/v1/companion/info");
  info = await res.json();
  if (!info?.token) throw new Error("no token");
} catch (e) {
  console.error("SKIP/FAIL: companion info unavailable — is the API server running?", String(e));
  process.exit(1);
}

// 2) boot the phone shell with the token pre-paired
const { w, errors } = bootJsdom("http://localhost:5174/?phone=1");
w.localStorage.setItem("soundwave-pair", info.token);
await import(bundlePath());
await sleep(900); // hydration roundtrip (pull → merge)

const $ = (sel) => w.document.querySelector(sel);
const $$ = (sel) => [...w.document.querySelectorAll(sel)];
const body = () => w.document.body.textContent;

const rootEl = $("#root");
if (!rootEl || !rootEl.innerHTML.trim()) {
  console.error("FAIL: root is empty");
  process.exit(1);
}

// pairing gate must NOT show once the token is valid
const pairingShown = body().includes("Pair with your computer");
console.log("paired straight in ✓:", !pairingShown);

// phone chrome: no fake wallpaper, single bottom nav (no left rail)
const hasWallpaper = Boolean($(".wallpaper"));
const railNav = $$("nav").find((n) => (n.className || "").includes("68px"));
const bottomNav = $$("nav").find((n) => (n.className || "").includes("border-t"));
console.log("phone chrome ✓:", !hasWallpaper && !railNav && Boolean(bottomNav));

// hydrated from the desktop session (tasks created by smoke.mjs)
const tasksBtn = $$("button").find((b) => b.title === "Tasks");
if (tasksBtn) { tasksBtn.click(); await sleep(250); }
const sawDesktopTask = body().includes("Review companion design");
console.log("desktop tasks hydrated on phone ✓:", sawDesktopTask);

// phone → server push
const input = $$("input").find((i) => i.placeholder === "Add a task…");
if (input) {
  const proto = w.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(input, "Sent from my phone");
  input.dispatchEvent(new w.Event("input", { bubbles: true }));
  await sleep(60);
  input.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
}
await sleep(1400); // debounce500 + PUT
let remoteHas = false;
try {
  const res = await fetch(
    `http://localhost:5174/api/v1/companion/state?pair=${encodeURIComponent(info.token)}`,
    { headers: { "x-companion-pair": info.token } }
  );
  const data = await res.json();
  remoteHas = JSON.stringify(data.state || {}).includes("Sent from my phone");
} catch {
  remoteHas = false;
}
console.log("phone → server push ✓:", remoteHas);

// local intent works on the phone (plan-my-day card)
const chatBtn = $$("button").find((b) => b.title === "Chat");
if (chatBtn) { chatBtn.click(); await sleep(250); }
const ta = $("textarea");
if (ta) {
  const setter = Object.getOwnPropertyDescriptor(w.HTMLTextAreaElement.prototype, "value").set;
  setter.call(ta, "Plan my day");
  ta.dispatchEvent(new w.Event("input", { bubbles: true }));
  await sleep(60);
  const send = $$("button").find((b) => b.title === "Send (Enter)");
  if (send) send.click();
  await sleep(600);
}
const planned = body().includes("Today’s plan");
console.log("phone chat (local brain) ✓:", planned);

const ok = reportFatal(errors);
const pass = !pairingShown && !hasWallpaper && !railNav && bottomNav && sawDesktopTask && remoteHas && planned && ok;
if (!pass) {
  console.error("PHONE SMOKE FAILED");
  process.exit(1);
}
console.log("PHONE SMOKE PASS");
process.exit(0);
