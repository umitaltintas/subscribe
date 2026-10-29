import { describe, expect, test } from "bun:test";
import {
  parseSegments,
  chunkSegments,
  validateGroups,
  groupsToText,
  parseCues,
  findCueIndex,
  parseJsonLoose,
  formatTimestamp,
  parseTimestamp,
  cuesToSrt,
  cuesToVtt,
  hasTimestamps,
  parseJson3,
  storedToSegments,
  storedToTimedText,
  formatPreciseTimestamp,
} from "../src/segments";
import { highlight } from "../src/utils";

const SAMPLE = `[0:00] so today we're going to
[0:03] talk about something really important
[0:06] which is artificial intelligence.
[0:09] and um how it's changing
[0:12] the way we work.`;

describe("timestamps", () => {
  test("parse and format round-trip", () => {
    expect(parseTimestamp("1:05")).toBe(65);
    expect(parseTimestamp("1:02:03")).toBe(3723);
    expect(formatTimestamp(65)).toBe("1:05");
    expect(formatTimestamp(3723)).toBe("1:02:03");
    expect(formatTimestamp(0)).toBe("0:00");
  });

  test("hasTimestamps", () => {
    expect(hasTimestamps(SAMPLE)).toBe(true);
    expect(hasTimestamps("plain text\nonly")).toBe(false);
  });
});

describe("parseSegments", () => {
  test("parses lines with sequential ids", () => {
    const segs = parseSegments(SAMPLE);
    expect(segs.length).toBe(5);
    expect(segs[0]).toEqual({ id: 0, start: 0, text: "so today we're going to" });
    expect(segs[4].start).toBe(12);
  });

  test("drops consecutive duplicates and empty lines, joins continuation lines", () => {
    const segs = parseSegments("[0:01] hello\n[0:02] hello\n[0:03]\n\nworld again\n[0:04] bye");
    expect(segs.map((s) => s.text)).toEqual(["hello world again", "bye"]);
    expect(segs.map((s) => s.id)).toEqual([0, 1]);
  });
});

describe("chunkSegments", () => {
  test("keeps all segments in order", () => {
    const segs = parseSegments(SAMPLE);
    const chunks = chunkSegments(segs, 60);
    expect(chunks.flat().map((s) => s.id)).toEqual([0, 1, 2, 3, 4]);
    expect(chunks.length).toBeGreaterThan(1);
  });

  test("prefers cutting after a sentence end", () => {
    const segs = parseSegments(SAMPLE);
    // Budget fits the first three segments plus part of the fourth.
    const chunks = chunkSegments(segs, 100);
    expect(chunks[0][chunks[0].length - 1].text.endsWith(".")).toBe(true);
  });

  test("single chunk when it fits", () => {
    expect(chunkSegments(parseSegments(SAMPLE), 10_000).length).toBe(1);
  });
});

describe("validateGroups", () => {
  const chunk = parseSegments(SAMPLE);

  test("accepts contiguous coverage", () => {
    const r = validateGroups(
      { groups: [{ from: 0, to: 2, text: "A." }, { from: 3, to: 4, text: "B." }] },
      chunk,
    );
    expect(r.ok).toBe(true);
  });

  test("accepts a bare array", () => {
    expect(validateGroups([{ from: 0, to: 4, text: "All." }], chunk).ok).toBe(true);
  });

  test("fills small gaps by stretching the previous group", () => {
    const r = validateGroups({ groups: [{ from: 0, to: 1, text: "A" }, { from: 3, to: 4, text: "B" }] }, chunk);
    expect(r.ok && r.groups[0].to).toBe(2);
  });

  test("absorbs up to two trailing segments", () => {
    const r = validateGroups({ groups: [{ from: 0, to: 3, text: "A" }] }, chunk);
    expect(r.ok && r.groups[0].to).toBe(4);
  });

  test("rejects overlap", () => {
    const r = validateGroups({ groups: [{ from: 0, to: 2, text: "A" }, { from: 2, to: 4, text: "B" }] }, chunk);
    expect(r.ok).toBe(false);
  });

  test("rejects ids beyond the chunk", () => {
    expect(validateGroups({ groups: [{ from: 0, to: 9, text: "A" }] }, chunk).ok).toBe(false);
  });

  test("rejects large untranslated tail", () => {
    const long = parseSegments(Array.from({ length: 10 }, (_, i) => `[0:${String(i).padStart(2, "0")}] s${i}`).join("\n"));
    expect(validateGroups({ groups: [{ from: 0, to: 4, text: "A" }] }, long).ok).toBe(false);
  });

  test("rejects large gaps in the middle or at the start (model dropped content)", () => {
    const long = parseSegments(Array.from({ length: 20 }, (_, i) => `[0:${String(i).padStart(2, "0")}] s${i}`).join("\n"));
    expect(validateGroups({ groups: [{ from: 0, to: 1, text: "A" }, { from: 18, to: 19, text: "B" }] }, long).ok).toBe(false);
    expect(validateGroups({ groups: [{ from: 15, to: 19, text: "A" }] }, long).ok).toBe(false);
  });

  test("absorbs any gap the model explicitly marked as empty", () => {
    const long = parseSegments(Array.from({ length: 20 }, (_, i) => `[0:${String(i).padStart(2, "0")}] s${i}`).join("\n"));
    const r = validateGroups(
      { groups: [{ from: 0, to: 9, text: "A" }, { from: 10, to: 15, text: "" }, { from: 16, to: 19, text: "B" }] },
      long,
    );
    expect(r.ok && r.groups.map((g) => [g.from, g.to])).toEqual([[0, 15], [16, 19]]);
  });

  test("accepts numeric strings but not null ids", () => {
    expect(validateGroups({ groups: [{ from: "0", to: "4", text: "A" }] }, chunk).ok).toBe(true);
    expect(validateGroups({ groups: [{ from: null, to: 4, text: "A" }] }, chunk).ok).toBe(false);
  });

  test("rejects malformed input", () => {
    expect(validateGroups({}, chunk).ok).toBe(false);
    expect(validateGroups({ groups: [{ from: "x", to: 1, text: "a" }] }, chunk).ok).toBe(false);
    expect(validateGroups({ groups: [{ from: 0, to: 4, text: "  " }] }, chunk).ok).toBe(false);
  });
});

describe("groupsToText + parseCues", () => {
  const segs = parseSegments(SAMPLE);
  const text = groupsToText(
    [
      { from: 0, to: 2, text: "Bugün çok önemli bir konudan, yapay zekâdan bahsedeceğiz." },
      { from: 3, to: 4, text: "Ve çalışma şeklimizi nasıl değiştirdiğinden." },
    ],
    segs,
  );

  test("timestamps come from the source segments", () => {
    expect(text.split("\n")[0].startsWith("[0:00] ")).toBe(true);
    expect(text.split("\n")[1].startsWith("[0:09] ")).toBe(true);
  });

  test("cues span the whole group and carry original text", () => {
    const cues = parseCues(text, segs);
    expect(cues.length).toBe(2);
    expect(cues[0].startTime).toBe(0);
    expect(cues[0].endTime).toBe(9);
    expect(cues[0].original).toBe(
      "so today we're going to talk about something really important which is artificial intelligence.",
    );
  });

  test("cues do not linger through long silences", () => {
    const cues = parseCues("[0:00] Kısa.\n[2:00] Sonra.");
    expect(cues[0].endTime).toBeLessThan(10);
    expect(cues[1].endTime).toBeGreaterThan(120);
    const withSrc = parseCues("[0:00] Kısa.\n[2:00] Sonra.", parseSegments("[0:00] short\n[2:00] later"));
    expect(withSrc[0].endTime).toBeLessThanOrEqual(4);
  });

  test("legacy inline timestamps are split", () => {
    const cues = parseCues("[0:00] bir [0:05] iki");
    expect(cues.map((c) => c.text)).toEqual(["bir", "iki"]);
  });

  test("findCueIndex", () => {
    const cues = parseCues(text, segs);
    expect(findCueIndex(cues, 0)).toBe(0);
    expect(findCueIndex(cues, 8.9)).toBe(0);
    expect(findCueIndex(cues, 9)).toBe(1);
    expect(findCueIndex(cues, -1)).toBe(-1);
    expect(findCueIndex(cues, 1000)).toBe(-1);
  });
});

describe("parseJsonLoose", () => {
  test("plain, fenced and with chatter", () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonLoose('Sure! {"a":[1,2]} hope it helps')).toEqual({ a: [1, 2] });
    expect(parseJsonLoose('[{"from":0}]')).toEqual([{ from: 0 }]);
  });

  test("throws without JSON", () => {
    expect(() => parseJsonLoose("no json here")).toThrow();
  });
});

describe("subtitle export", () => {
  const cues = [
    { startTime: 0, endTime: 2.5, text: "Merhaba" },
    { startTime: 3661, endTime: 3663, text: "Son" },
  ];
  test("srt", () => {
    expect(cuesToSrt(cues)).toBe("1\n00:00:00,000 --> 00:00:02,500\nMerhaba\n\n2\n01:01:01,000 --> 01:01:03,000\nSon\n");
  });
  test("vtt", () => {
    expect(cuesToVtt(cues).startsWith("WEBVTT\n\n00:00:00.000 --> 00:00:02.500\nMerhaba\n")).toBe(true);
  });
});

describe("highlight", () => {
  test("escapes HTML and marks literal terms", () => {
    expect(highlight("a <b> c++ d", "c++")).toBe("a &lt;b&gt; <mark class=\"ytc-mark\">c++</mark> d");
  });
  test("does not break entities", () => {
    expect(highlight("Tom & Jerry", "amp")).toBe("Tom &amp; Jerry");
  });
  test("regex characters do not throw", () => {
    expect(() => highlight("x", "(a")).not.toThrow();
  });
});

describe("millisecond caption data", () => {
  const JSON3 = JSON.stringify({
    events: [
      { tStartMs: 0, dDurationMs: 99999, id: 1, wpWinPosId: 1 }, // window event, no segs
      { tStartMs: 1360, dDurationMs: 1680, segs: [{ utf8: "[Music]" }] },
      { tStartMs: 18640, dDurationMs: 3240, segs: [{ utf8: "so today we're" }, { utf8: " going to" }] },
      { tStartMs: 20000, dDurationMs: 10, aAppend: 1, segs: [{ utf8: "\n" }] },
      { tStartMs: 21000, dDurationMs: 4320, segs: [{ utf8: "talk about\nsomething important." }] },
      { tStartMs: 83070, dDurationMs: 2000, segs: [{ utf8: "later" }] },
    ],
  });

  test("parseJson3 keeps milliseconds and clamps overlapping ASR events", () => {
    const segs = parseJson3(JSON3);
    expect(segs.map((s) => s.text)).toEqual(["[Music]", "so today we're going to", "talk about something important.", "later"]);
    expect(segs[1].start).toBe(18.64);
    expect(segs[1].end).toBe(21); // clamped to next start (would be 21.88)
    expect(segs[2].end).toBe(25.32);
    expect(parseJson3("not json")).toEqual([]);
  });

  test("precise timestamps survive translation storage and float rounding", () => {
    const segs = storedToSegments(parseJson3(JSON3));
    const text = groupsToText(
      [
        { from: 0, to: 0, text: "[Müzik]" },
        { from: 1, to: 2, text: "Bugün önemli bir şeyden bahsedeceğiz." },
        { from: 3, to: 3, text: "Sonra." },
      ],
      segs,
    );
    expect(text.split("\n")[1].startsWith("[0:18.640] ")).toBe(true);
    expect(text.split("\n")[2].startsWith("[1:23.070] ")).toBe(true);
    const cues = parseCues(text, segs);
    expect(cues[1].startTime).toBe(18.64);
    // Ends exactly when the last fragment of the group ends.
    expect(cues[1].endTime).toBe(25.32);
    expect(cues[2].startTime).toBe(83.07);
    expect(cues[2].original).toBe("later");
  });

  test("formatPreciseTimestamp / parseTimestamp", () => {
    expect(formatPreciseTimestamp(18.64)).toBe("0:18.640");
    expect(formatPreciseTimestamp(5)).toBe("0:05");
    expect(formatPreciseTimestamp(3723.5)).toBe("1:02:03.500");
    expect(parseTimestamp("1:23.070")).toBe(83.07);
  });

  test("storedToTimedText uses whole seconds for display", () => {
    expect(storedToTimedText([{ start: 18.64, end: 21, text: "a" }])).toBe("[0:18] a");
  });
});

describe("group length limits", () => {
  const segs = storedToSegments(
    Array.from({ length: 10 }, (_, i) => ({ start: i * 3, end: i * 3 + 3, text: `fragment ${i}` })),
  );
  const oneGroup = { groups: [{ from: 0, to: 9, text: "Çok uzun tek bir cümle." }] };

  test("rejects a 30 s group when limits are enforced", () => {
    const r = validateGroups(oneGroup, segs, { enforceLimits: true });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("too long");
  });

  test("accepts it when limits are relaxed (later attempts)", () => {
    expect(validateGroups(oneGroup, segs).ok).toBe(true);
  });

  test("rejects over-long text, ignores single fragments", () => {
    const long = "x".repeat(200);
    expect(validateGroups({ groups: [{ from: 0, to: 1, text: long }, { from: 2, to: 9, text: "a" }] }, segs, { enforceLimits: true }).ok).toBe(false);
    const single = storedToSegments([{ start: 0, end: 20, text: "one long fragment" }]);
    expect(validateGroups({ groups: [{ from: 0, to: 0, text: long }] }, single, { enforceLimits: true }).ok).toBe(true);
  });
});
