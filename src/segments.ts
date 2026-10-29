// Pure transcript/subtitle helpers. No DOM, no network — unit tested.
import type { SubtitleCue } from "./types";

export interface Segment {
  id: number;
  /** Seconds from video start (may have millisecond precision). */
  start: number;
  /** Seconds; known only for segments read from YouTube's caption data. */
  end?: number;
  text: string;
}

/** Caption segment as stored on a record (seconds, millisecond precision). */
export interface StoredSegment {
  start: number;
  end: number;
  text: string;
}

/** A translated sentence covering source segments from..to (inclusive ids). */
export interface TranslatedGroup {
  from: number;
  to: number;
  text: string;
}

// Optional ".mmm" fraction: translations made from caption data keep milliseconds.
const TS = String.raw`\d{1,2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?`;
const LINE_RE = new RegExp(String.raw`^\s*\[(${TS})\]\s*(.*)$`);
const INLINE_TS_RE = new RegExp(String.raw`\s*\[(${TS})\]`, "g");
const SENTENCE_END_RE = /[.!?…。！？]["'”’)\]]*$/;

export const parseTimestamp = (ts: string): number => {
  const parts = ts.split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return 0;
  // Round to whole milliseconds so "1:23.070" equals 83070 / 1000 exactly.
  return Math.round(parts.reduce((acc, n) => acc * 60 + n, 0) * 1000) / 1000;
};

export const formatTimestamp = (sec: number): string => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};

/** Like formatTimestamp, but keeps milliseconds when the time has a fraction. */
export const formatPreciseTimestamp = (sec: number): string => {
  const ms = Math.round(sec * 1000) % 1000;
  const base = formatTimestamp(Math.round(sec * 1000) / 1000);
  return ms ? `${base}.${String(ms).padStart(3, "0")}` : base;
};

export const hasTimestamps = (text: string): boolean =>
  text.split("\n").some((l) => LINE_RE.test(l));

/**
 * Parses "[m:ss] text" lines into segments. Lines without a timestamp are
 * appended to the previous segment; consecutive duplicates are dropped.
 */
export const parseSegments = (text: string): Segment[] => {
  const out: Segment[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(LINE_RE);
    if (!m) {
      const prev = out[out.length - 1];
      if (prev) prev.text = `${prev.text} ${line}`.trim();
      continue;
    }
    const body = m[2].trim();
    if (!body) continue;
    const start = parseTimestamp(m[1]);
    const prev = out[out.length - 1];
    if (prev && prev.text === body) continue;
    out.push({ id: out.length, start, text: body });
  }
  return out;
};

/**
 * Splits segments into chunks of roughly maxChars, preferring to cut right
 * after a segment that ends a sentence so sentences are not split across
 * requests.
 */
export const chunkSegments = (segments: Segment[], maxChars: number): Segment[][] => {
  const chunks: Segment[][] = [];
  let current: Segment[] = [];
  let size = 0;

  for (const seg of segments) {
    const len = seg.text.length + 1;
    if (size + len > maxChars && current.length > 0) {
      // Look back for a sentence end, but keep at least half the chunk.
      let cut = current.length;
      for (let i = current.length - 1; i >= Math.floor(current.length / 2); i--) {
        if (SENTENCE_END_RE.test(current[i].text)) {
          cut = i + 1;
          break;
        }
      }
      chunks.push(current.slice(0, cut));
      current = current.slice(cut);
      size = current.reduce((n, s) => n + s.text.length + 1, 0);
    }
    current.push(seg);
    size += len;
  }
  if (current.length) chunks.push(current);
  return chunks;
};

/** Parses model output that should be JSON, tolerating code fences and chatter. */
export const parseJsonLoose = (content: string): unknown => {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const text = (fenced ? fenced[1] : content).trim();
  try {
    return JSON.parse(text);
  } catch {
    const objStart = text.indexOf("{");
    const arrStart = text.indexOf("[");
    const useArr = arrStart !== -1 && (objStart === -1 || arrStart < objStart);
    const start = useArr ? arrStart : objStart;
    const end = useArr ? text.lastIndexOf("]") : text.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("Yanıtta JSON bulunamadı");
    return JSON.parse(text.slice(start, end + 1));
  }
};

export type GroupValidation =
  | { ok: true; groups: TranslatedGroup[] }
  | { ok: false; error: string };

/**
 * Checks that groups cover every id of the chunk exactly once, in order.
 * This is what keeps subtitles in sync: each group's start time comes from
 * the source, never from the model.
 */
/** Largest run of source ids a group may silently absorb (e.g. a dangling "um"). */
const MAX_ABSORBED_GAP = 2;

const toId = (v: unknown): number =>
  typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v.trim()) ? Number(v) : NaN;

/** Readability limits for one subtitle; enforced on the first attempt only. */
export const GROUP_LIMITS = { maxSeconds: 12, maxChars: 150 };

/** Seconds a group stays on screen: first fragment start → last fragment end. */
const groupSpan = (chunk: Segment[], from: number, to: number): number => {
  const first = chunk.find((x) => x.id === from);
  const lastIdx = chunk.findIndex((x) => x.id === to);
  const last = chunk[lastIdx];
  if (!first || !last) return 0;
  const end = last.end ?? chunk[lastIdx + 1]?.start ?? last.start + 3;
  return end - first.start;
};

export interface ValidateOptions {
  /** Reject groups longer than GROUP_LIMITS (so the model splits them). */
  enforceLimits?: boolean;
}

export const validateGroups = (raw: unknown, chunk: Segment[], opts: ValidateOptions = {}): GroupValidation => {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { groups?: unknown }).groups)
      ? (raw as { groups: unknown[] }).groups
      : null;
  if (!list) return { ok: false, error: "missing 'groups' array" };
  if (!chunk.length) return { ok: true, groups: [] };

  const first = chunk[0].id;
  const last = chunk[chunk.length - 1].id;
  const groups: TranslatedGroup[] = [];
  // Ranges of groups the model returned with empty text; those may be absorbed
  // by a neighbour regardless of size (the model chose to merge them).
  const emptyIds = new Set<number>();

  for (const g of list) {
    if (!g || typeof g !== "object") return { ok: false, error: "invalid group entry" };
    const { from, to, text } = g as Record<string, unknown>;
    const f = toId(from);
    const t = toId(to);
    if (!Number.isInteger(f) || !Number.isInteger(t) || typeof text !== "string") {
      return { ok: false, error: "group is missing integer 'from'/'to' or string 'text'" };
    }
    if (t < f) return { ok: false, error: `group ${f}-${t} is reversed` };
    if (f < first || t > last) return { ok: false, error: `group ${f}-${t} is outside ids ${first}-${last}` };
    if (!text.trim()) {
      for (let i = f; i <= t; i++) emptyIds.add(i);
      continue;
    }
    groups.push({ from: f, to: t, text: text.trim() });
  }
  if (!groups.length) return { ok: false, error: "no translated text" };

  const gapOk = (a: number, b: number): boolean => {
    // Ids a..b (inclusive) are not covered by any non-empty group.
    if (b < a) return true;
    if (b - a + 1 <= MAX_ABSORBED_GAP) return true;
    for (let i = a; i <= b; i++) if (!emptyIds.has(i)) return false;
    return true;
  };

  if (!gapOk(first, groups[0].from - 1)) {
    return { ok: false, error: `ids ${first}-${groups[0].from - 1} are not translated` };
  }
  groups[0].from = first;

  for (let i = 0; i < groups.length - 1; i++) {
    const g = groups[i];
    const next = groups[i + 1];
    if (next.from <= g.to) return { ok: false, error: `groups overlap at ${next.from}` };
    if (!gapOk(g.to + 1, next.from - 1)) {
      return { ok: false, error: `ids ${g.to + 1}-${next.from - 1} are not translated` };
    }
    g.to = next.from - 1;
  }

  const tail = groups[groups.length - 1];
  if (!gapOk(tail.to + 1, last)) return { ok: false, error: `ids ${tail.to + 1}-${last} are not translated` };
  tail.to = last;

  if (opts.enforceLimits) {
    const tooLong = groups
      .filter((g) => g.to > g.from) // a single fragment cannot be split further
      .map((g) => ({ g, secs: groupSpan(chunk, g.from, g.to) }))
      .filter(({ g, secs }) => secs > GROUP_LIMITS.maxSeconds || g.text.length > GROUP_LIMITS.maxChars);
    if (tooLong.length) {
      const list = tooLong
        .slice(0, 5)
        .map(({ g, secs }) => `${g.from}-${g.to} (${secs.toFixed(1)}s, ${g.text.length} chars)`)
        .join(", ");
      return {
        ok: false,
        error: `groups too long for one subtitle: ${list}. Keep each group under ${GROUP_LIMITS.maxSeconds}s and ${GROUP_LIMITS.maxChars} characters by splitting long sentences at clause boundaries`,
      };
    }
  }
  return { ok: true, groups };
};

/** Serialises groups using the start time of each group's first source segment. */
export const groupsToText = (groups: TranslatedGroup[], segments: Segment[]): string => {
  const byId = new Map(segments.map((s) => [s.id, s]));
  return groups
    .map((g) => `[${formatPreciseTimestamp(byId.get(g.from)?.start ?? 0)}] ${g.text.replace(/\s*\n\s*/g, " ")}`)
    .join("\n");
};

const MIN_CUE = 1;
/** Tolerance for comparing times that went through text formatting. */
const EPS = 0.0005;
/** Rough upper bound for how long one caption fragment is spoken. */
const SEGMENT_SPAN = 4;
/** Reading-speed based minimum so short lines do not flash by. */
const readingTime = (text: string): number => Math.max(3, text.length / 15 + 1.5);

/**
 * Turns "[m:ss] text" lines into cues. When the original segments are given,
 * each cue also carries the source text spoken during it (bilingual mode),
 * and its end time follows the speech instead of lingering through silences.
 */
export const parseCues = (text: string, original: Segment[] = []): SubtitleCue[] => {
  const normalized = text.replace(INLINE_TS_RE, "\n[$1]");
  const raw: { startTime: number; text: string }[] = [];

  for (const line of normalized.split("\n")) {
    const m = line.trim().match(LINE_RE);
    if (!m || !m[2].trim()) continue;
    const startTime = parseTimestamp(m[1]);
    const prev = raw[raw.length - 1];
    if (prev && prev.startTime === startTime) {
      prev.text = `${prev.text} ${m[2].trim()}`;
      continue;
    }
    raw.push({ startTime, text: m[2].trim() });
  }
  raw.sort((a, b) => a.startTime - b.startTime);

  return raw.map((entry, i) => {
    const nextStart = i < raw.length - 1 ? raw[i + 1].startTime : Infinity;
    const src = original.filter((s) => s.start >= entry.startTime - EPS && s.start < nextStart - EPS);
    // Speech covered by this cue ends when its last fragment ends; without
    // caption data, roughly one fragment after that fragment starts.
    const lastSrc = src[src.length - 1];
    const speechEnd = lastSrc ? (lastSrc.end ?? lastSrc.start + SEGMENT_SPAN) : entry.startTime + 8;
    const wanted = Math.max(entry.startTime + readingTime(entry.text), speechEnd);
    const endTime = Math.max(entry.startTime + MIN_CUE, Math.min(nextStart, wanted));
    const cue: SubtitleCue = { startTime: entry.startTime, endTime, text: entry.text };
    if (src.length) cue.original = src.map((s) => s.text).join(" ");
    return cue;
  });
};

/** Index of the cue active at time t, or -1. Cues must be sorted. */
export const findCueIndex = (cues: SubtitleCue[], t: number): number => {
  let lo = 0;
  let hi = cues.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].startTime <= t) lo = mid + 1;
    else hi = mid - 1;
  }
  const i = lo - 1;
  return i >= 0 && t < cues[i].endTime ? i : -1;
};

/** Cheap stable hash for cache keys. */
export const hashString = (s: string): string => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
};

const srtTime = (sec: number, sep: "," | "."): string => {
  const ms = Math.round(sec * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(ms % 1000, 3)}`;
};

/** SubRip export (works with VLC, mpv, video editors). */
export const cuesToSrt = (cues: SubtitleCue[]): string =>
  cues
    .map((c, i) => `${i + 1}\n${srtTime(c.startTime, ",")} --> ${srtTime(c.endTime, ",")}\n${c.text}\n`)
    .join("\n");

/** WebVTT export (browsers, most web players). */
export const cuesToVtt = (cues: SubtitleCue[]): string =>
  "WEBVTT\n\n" +
  cues.map((c) => `${srtTime(c.startTime, ".")} --> ${srtTime(c.endTime, ".")}\n${c.text}\n`).join("\n");

// ---------------------------------------------------------------------------
// YouTube caption data (timedtext, fmt=json3)
// ---------------------------------------------------------------------------

interface Json3Event {
  tStartMs?: number;
  dDurationMs?: number;
  aAppend?: number;
  segs?: { utf8?: string }[];
}

/**
 * Parses YouTube's json3 caption format into segments with millisecond
 * start/end times. Handles both uploaded captions and auto-generated (ASR)
 * captions, whose events overlap and include newline-only "append" events.
 */
export const parseJson3 = (json: string): StoredSegment[] => {
  let data: { events?: Json3Event[] };
  try {
    data = JSON.parse(json);
  } catch {
    return [];
  }
  const out: StoredSegment[] = [];
  for (const ev of data.events ?? []) {
    if (!ev.segs || ev.aAppend || typeof ev.tStartMs !== "number") continue;
    const text = ev.segs
      .map((x) => x.utf8 ?? "")
      .join("")
      .replace(/\s*\n\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    const start = ev.tStartMs / 1000;
    const end = (ev.tStartMs + (ev.dDurationMs ?? 3000)) / 1000;
    const prev = out[out.length - 1];
    if (prev && prev.text === text && Math.abs(prev.start - start) < 0.01) continue;
    out.push({ start, end, text });
  }
  out.sort((a, b) => a.start - b.start);
  // ASR events overlap (two-line rolling display); a fragment is spoken until
  // the next one starts, so clamp ends to keep cue timing tight.
  for (let i = 0; i < out.length - 1; i++) {
    if (out[i].end > out[i + 1].start) out[i].end = Math.max(out[i].start + 0.2, out[i + 1].start);
  }
  return out;
};

export const storedToSegments = (stored: StoredSegment[]): Segment[] =>
  stored.map((s, id) => ({ id, start: s.start, end: s.end, text: s.text }));

/** "[m:ss] text" lines for display/copy (second precision, like the panel). */
export const storedToTimedText = (stored: StoredSegment[]): string =>
  stored.map((s) => `[${formatTimestamp(s.start)}] ${s.text}`).join("\n");
