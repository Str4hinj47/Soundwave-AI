import { describe, expect, it } from "vitest";
import { speakable } from "./voice";

describe("what the phone reads aloud", () => {
  it("skips links and the background credits", () => {
    const text =
      'Rendered viral short for "space". Your video is ready to preview, download, or post to YouTube!\nBackground: "Parkour" (1:05–2:05) — Orbital NCG video imported via the YouTube link importer: https://www.youtube.com/watch?v=abc';
    expect(speakable({ text })).toBe('Rendered viral short for "space". Your video is ready to preview, download, or post to YouTube!');
    expect(speakable({ text: "Picking a video (https://www.youtube.com/@OrbitalNCG) now." })).toBe("Picking a video now.");
  });

  it("says short outcomes in a few words", () => {
    expect(speakable({ text: "long…", jobState: "done", topic: "black holes", youtubeUrl: "https://youtu.be/x" })).toBe(
      "Your short about black holes is ready, and it's up on YouTube.",
    );
    expect(speakable({ text: "long…", jobState: "failed", topic: "sharks" })).toBe("I couldn't finish the short about sharks.");
  });
});
