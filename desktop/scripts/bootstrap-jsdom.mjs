/** Shared jsdom bootstrap for the companion smoke tests. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

export const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export function bundlePath() {
  const html = fs.readFileSync(path.join(root, "dist", "index.html"), "utf8");
  const m = html.match(/src="\.\/(assets\/[^"]+\.js)"/);
  if (!m) throw new Error("no bundle found in dist/index.html");
  return path.join(root, "dist", m[1]);
}

/**
 * Boot a window at `url` with the globals the bundle expects.
 * Relative `fetch()` calls are resolved against `url` (Node has no base)
 * so API calls hit the running Vite dev server / proxy.
 */
export function bootJsdom(url) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
    url,
    pretendToBeVisual: true,
  });
  const w = dom.window;

  const keys = [
    "window", "document", "navigator", "HTMLElement", "SVGElement", "Element", "Node",
    "CustomEvent", "MouseEvent", "KeyboardEvent", "getComputedStyle", "localStorage",
    "sessionStorage", "requestAnimationFrame", "cancelAnimationFrame", "Event", "MutationObserver",
  ];
  for (const k of keys) {
    if (w[k] === undefined) continue;
    try {
      globalThis[k] = w[k];
    } catch {
      try {
        Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
      } catch {
        /* readonly */
      }
    }
  }
  globalThis.self = w;
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLElement.prototype.hasPointerCapture = function () { return false; };
  w.HTMLElement.prototype.setPointerCapture = function () {};
  if (!w.matchMedia) {
    w.matchMedia = () => ({
      matches: false, addListener() {}, removeListener() {},
      addEventListener() {}, removeEventListener() {},
    });
  }
  class RO { observe() {} unobserve() {} disconnect() {} }
  w.ResizeObserver = RO;
  globalThis.ResizeObserver = RO;
  class IO { observe() {} unobserve() {} disconnect() {} }
  w.IntersectionObserver = IO;
  globalThis.IntersectionObserver = IO;

  // Resolve relative fetch URLs against the page origin.
  const realFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (input, init) => {
    if (typeof input === "string" && input.startsWith("/")) {
      return realFetch(new URL(input, url).href, init);
    }
    return realFetch(input, init);
  };

  const errors = [];
  const origError = console.error;
  console.error = (...a) => {
    errors.push(a.map(String).join(" "));
    origError(...a);
  };
  w.addEventListener("error", (e) => errors.push("window.error: " + e.message));
  process.on("unhandledRejection", (e) => errors.push("unhandledRejection: " + String(e)));

  return { dom, w, errors, restoreConsole: () => { console.error = origError; } };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function reportFatal(errors) {
  const fatal = errors.filter(
    (e) => /Error|error/i.test(e) && !/Not implemented|Could not parse CSS/i.test(e)
  );
  if (fatal.length) {
    console.error("RUNTIME ERRORS:\n" + fatal.slice(0, 8).join("\n---\n"));
    return false;
  }
  return true;
}
