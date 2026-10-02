import { describe, expect, it } from "vitest";
import { speakable, speakableBriefing, splitSpeech } from "./voice";

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

describe("the morning briefing, read in full", () => {
  it("is cut into pieces at sentence ends, none longer than the voice service takes", () => {
    const sentence = "Ollama shipped a new release with faster local models and a fresh library. ";
    const long = sentence.repeat(60); // ~4500 characters
    const pieces = splitSpeech(long, 1800);
    expect(pieces.length).toBe(3);
    expect(pieces.every((p) => p.length <= 1800 && p.endsWith("."))).toBe(true);
    expect(pieces.join(" ")).toBe(long.trim());
  });

  it("keeps everything but links (no 700-character cut)", () => {
    const text = `${"Good morning! ".repeat(80)}See https://example.com for more.`;
    const spoken = speakableBriefing(text);
    expect(spoken.length).toBeGreaterThan(1000);
    expect(spoken).not.toMatch(/https?:/);
  });
});
