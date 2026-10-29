import { afterEach, describe, expect, test } from "bun:test";
import { translateTranscript, summarizeForUser } from "../src/ai";
import { parseCues, parseSegments } from "../src/segments";
import type { AISettings } from "../src/types";

const settings: AISettings = { apiKey: "k", provider: "openrouter", model: "test/model", targetLanguage: "tr" };

type Handler = (body: { messages: { role: string; content: string }[]; response_format?: unknown }) => {
  status?: number;
  content?: string;
  raw?: string;
};

const realFetch = globalThis.fetch;
let calls: { messages: { role: string; content: string }[] }[] = [];

const mockApi = (handler: Handler) => {
  calls = [];
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    const r = handler(body);
    const text =
      r.raw ??
      JSON.stringify({
        choices: [{ message: { content: r.content ?? "" } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, cost: 0.001 },
      });
    return new Response(text, { status: r.status ?? 200 });
  }) as unknown as typeof fetch;
};

afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Echo translator: one group per segment, text prefixed with "TR:". */
const echoGroups = (userContent: string): string => {
  const json = userContent.slice(userContent.lastIndexOf('{"segments"'));
  const { segments } = JSON.parse(json) as { segments: { id: number; text: string }[] };
  return JSON.stringify({ groups: segments.map((s) => ({ from: s.id, to: s.id, text: `TR:${s.text}` })) });
};

const longTranscript = (n: number) =>
  Array.from({ length: n }, (_, i) => `[${Math.floor(i / 60)}:${String(i % 60).padStart(2, "0")}] sentence number ${i} is here.`).join("\n");

describe("translateTranscript", () => {
  test("translates all chunks, keeps source timestamps and sums usage", async () => {
    mockApi((body) => {
      const sys = body.messages[0].content;
      if (sys.includes("prepare context")) return { content: JSON.stringify({ summary: "Bağlam", glossary: [] }) };
      return { content: echoGroups(body.messages[body.messages.length - 1].content) };
    });
    const transcript = longTranscript(400);
    const res = await translateTranscript(transcript, "tr", settings);
    const cues = parseCues(res.translated, parseSegments(transcript));
    expect(cues.length).toBe(400);
    expect(cues[0].text).toBe("TR:sentence number 0 is here.");
    expect(cues[399].startTime).toBe(399);
    expect(res.summary).toBe("Bağlam");
    expect(res.usage.cost).toBeCloseTo(calls.length * 0.001, 6);
    // Prompt uses the language name, not the code.
    expect(calls[1].messages[0].content).toContain("into Turkish");
  });

  test("retries a chunk whose grouping is invalid, with feedback", async () => {
    let first = true;
    mockApi((body) => {
      const last = body.messages[body.messages.length - 1].content;
      if (first) {
        first = false;
        return { content: JSON.stringify({ groups: [{ from: 0, to: 0, text: "eksik" }] }) };
      }
      if (last.startsWith("Invalid output")) {
        return { content: echoGroups(body.messages[1].content) };
      }
      return { content: echoGroups(last) };
    });
    const res = await translateTranscript(longTranscript(10), "tr", settings);
    expect(res.translated.split("\n").length).toBe(10);
    expect(calls.some((c) => c.messages.some((m) => m.content.startsWith("Invalid output")))).toBe(true);
  });

  test("asks the model to split over-long groups, using caption segments", async () => {
    const segments = Array.from({ length: 8 }, (_, i) => ({ id: i, start: i * 4 + 0.25, end: i * 4 + 4, text: `part ${i}` }));
    let first = true;
    mockApi((body) => {
      const last = body.messages[body.messages.length - 1].content;
      if (first) {
        first = false;
        return { content: JSON.stringify({ groups: [{ from: 0, to: 7, text: "Tek dev cümle." }] }) };
      }
      expect(last).toContain("too long");
      return { content: echoGroups(body.messages[1].content) };
    });
    const res = await translateTranscript("", "tr", settings, { segments });
    const lines = res.translated.split("\n");
    expect(lines.length).toBe(8);
    expect(lines[1].startsWith("[0:04.250] ")).toBe(true);
  });

  test("context failure does not block translation", async () => {
    mockApi((body) => {
      if (body.messages[0].content.includes("prepare context")) return { status: 400, raw: '{"error":{"message":"nope"}}' };
      return { content: echoGroups(body.messages[body.messages.length - 1].content) };
    });
    const res = await translateTranscript(longTranscript(300), "de", settings);
    expect(res.summary).toBe("");
    expect(res.translated.split("\n").length).toBe(300);
  });

  test("failed run resumes without re-translating finished chunks", async () => {
    const transcript = longTranscript(300) + "\n[9:59] resume marker.";
    let failing = true;
    mockApi((body) => {
      if (body.messages[0].content.includes("prepare context")) return { content: '{"summary":"","glossary":[]}' };
      const last = body.messages[body.messages.length - 1].content;
      if (failing && last.includes("resume marker")) return { status: 401, raw: '{"error":{"message":"bad key"}}' };
      return { content: echoGroups(last) };
    });
    await expect(translateTranscript(transcript, "fr", settings)).rejects.toThrow(/API anahtarı geçersiz/);

    failing = false;
    const before = calls.length;
    mockApi((body) => ({ content: echoGroups(body.messages[body.messages.length - 1].content) }));
    const res = await translateTranscript(transcript, "fr", settings);
    expect(res.translated.split("\n").length).toBe(301);
    // Only the missing chunk(s) are requested again, and no new context call.
    expect(calls.length).toBeLessThan(before);
    expect(calls.every((c) => !c.messages[0].content.includes("prepare context"))).toBe(true);
  });

  test("falls back when the model rejects structured output", async () => {
    mockApi((body) => {
      if (body.response_format) return { status: 400, raw: '{"error":{"message":"response_format not supported"}}' };
      return { content: "```json\n" + echoGroups(body.messages[body.messages.length - 1].content) + "\n```" };
    });
    const res = await translateTranscript(longTranscript(5), "tr", { ...settings, model: "no/schema" });
    expect(res.translated.split("\n").length).toBe(5);
  });

  test("rejects transcripts without timestamps", async () => {
    await expect(translateTranscript("just text", "tr", settings)).rejects.toThrow(/zaman damgası/);
  });

  test("can be cancelled", async () => {
    mockApi((body) => ({ content: echoGroups(body.messages[body.messages.length - 1].content) }));
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(translateTranscript(longTranscript(5), "es", settings, { signal: ctrl.signal })).rejects.toThrow();
  });
});

describe("summarizeForUser", () => {
  test("respects the chosen output language", async () => {
    mockApi(() => ({ content: "Özet" }));
    const r = await summarizeForUser(longTranscript(3), settings, {
      format: "bullets",
      tone: "neutral",
      length: "short",
      language: "tr",
    });
    expect(r.summary).toBe("Özet");
    expect(calls[0].messages[0].content).toContain("in Turkish");
    expect(calls[0].messages[1].content.startsWith("[0:00] ")).toBe(true);
  });
});
