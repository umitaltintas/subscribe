import { CONFIG, getLanguage } from "./config";
import { chat, emptyUsage, addUsage, ApiError, type ChatMessage } from "./openrouter";
import { isAbortError, AbortError } from "./http";
import {
  parseSegments,
  chunkSegments,
  parseJsonLoose,
  validateGroups,
  groupsToText,
  hashString,
  formatTimestamp,
  type Segment,
  type TranslatedGroup,
} from "./segments";
import type { AISettings, SummaryOptions, Usage } from "./types";

export type TranslateStage = "analyzing" | "translating";

export interface TranslateProgress {
  stage: TranslateStage;
  done: number;
  total: number;
}

export interface TranslateResult {
  translated: string;
  /** Short context summary in the target language ("" if skipped). */
  summary: string;
  usage: Usage;
}

interface VideoContext {
  summary: string;
  glossary: { term: string; translation: string }[];
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const translationSystemPrompt = (lang: string): string => `You are a professional subtitle translator. Translate YouTube video captions into ${lang}.

INPUT: caption fragments as JSON: {"segments":[{"id":0,"text":"..."}]}. Auto-generated captions split sentences at arbitrary points, so one sentence usually spans several fragments.

OUTPUT: JSON only: {"groups":[{"from":<first id>,"to":<last id>,"text":"<${lang} translation>"}]}

GROUPING RULES (critical — the subtitles are timed from these ids):
1. Groups cover every input id exactly once, in order, with no gaps or overlaps: the first "from" is the first input id, every next "from" is the previous "to" + 1, and the last "to" is the last input id.
2. Each group is one complete, natural sentence. Never end a group in the middle of a sentence just because a fragment ends there.
3. Keep groups subtitle-sized: ideally under 90 characters, never over 150 characters or about 12 seconds of speech. Split long sentences at natural clause boundaries.
4. A group's text must translate exactly what is said in its fragments — do not add content, invent sentences, or move content to another group.

TRANSLATION RULES:
- Translate meaning, tone and intent naturally — not word by word. Use phrasing a native ${lang} speaker would use.
- Preserve the speaker's register (formal, casual, humorous, technical).
- Keep names, brands and technical terms as-is unless a widely accepted ${lang} form exists. Follow the glossary when given.
- Drop filler words (um, uh, you know) and stuttered repetitions. Translate sound tags like [Music] into ${lang} in brackets.

EXAMPLE (target: Turkish)
Input: {"segments":[{"id":7,"text":"so today we're going to"},{"id":8,"text":"talk about something really important"},{"id":9,"text":"which is artificial intelligence"},{"id":10,"text":"and um how it's changing"},{"id":11,"text":"the way we work"}]}
Output: {"groups":[{"from":7,"to":9,"text":"Bugün çok önemli bir konudan, yapay zekâdan bahsedeceğiz."},{"from":10,"to":11,"text":"Ve çalışma şeklimizi nasıl değiştirdiğinden."}]}`;

const GROUPS_SCHEMA = {
  name: "subtitle_groups",
  schema: {
    type: "object",
    properties: {
      groups: {
        type: "array",
        items: {
          type: "object",
          properties: {
            from: { type: "integer" },
            to: { type: "integer" },
            text: { type: "string" },
          },
          required: ["from", "to", "text"],
          additionalProperties: false,
        },
      },
    },
    required: ["groups"],
    additionalProperties: false,
  },
};

const CONTEXT_SCHEMA = {
  name: "video_context",
  schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      glossary: {
        type: "array",
        items: {
          type: "object",
          properties: { term: { type: "string" }, translation: { type: "string" } },
          required: ["term", "translation"],
          additionalProperties: false,
        },
      },
    },
    required: ["summary", "glossary"],
    additionalProperties: false,
  },
};

const tail = (segs: Segment[], n: number): string =>
  segs.slice(-n).map((s) => s.text).join(" ");

const buildChunkMessage = (
  chunk: Segment[],
  prev: Segment[] | undefined,
  next: Segment[] | undefined,
  ctx: VideoContext | null,
): string => {
  const parts: string[] = [];
  if (ctx?.summary) parts.push(`VIDEO CONTEXT:\n${ctx.summary}`);
  if (ctx?.glossary.length) {
    parts.push(`GLOSSARY:\n${ctx.glossary.map((g) => `${g.term} → ${g.translation}`).join("\n")}`);
  }
  if (prev?.length) parts.push(`PRECEDING CAPTIONS (context only, do not translate):\n${tail(prev, 4)}`);
  if (next?.length) {
    parts.push(`FOLLOWING CAPTIONS (context only, do not translate):\n${next.slice(0, 3).map((s) => s.text).join(" ")}`);
  }
  parts.push(
    `SEGMENTS (ids ${chunk[0].id}–${chunk[chunk.length - 1].id}):\n` +
      JSON.stringify({ segments: chunk.map((s) => ({ id: s.id, text: s.text })) }),
  );
  return parts.join("\n\n");
};

// ---------------------------------------------------------------------------
// Translation
// ---------------------------------------------------------------------------

const buildContext = async (
  segments: Segment[],
  lang: string,
  settings: AISettings,
  signal?: AbortSignal,
): Promise<{ ctx: VideoContext | null; usage: Usage }> => {
  const text = segments.map((s) => s.text).join(" ").slice(0, CONFIG.AI.CONTEXT_MAX_CHARS);
  try {
    const res = await chat(
      [
        {
          role: "system",
          content: `You prepare context for translating a video transcript into ${lang}.
Return JSON: {"summary": "...", "glossary": [{"term": "...", "translation": "..."}]}
- summary: 3-5 sentences in ${lang} — topic, speaker's tone/register, target audience.
- glossary: up to 15 recurring names, terms or jargon with the ${lang} rendering to use consistently (keep the original when it should not be translated).`,
        },
        { role: "user", content: text },
      ],
      settings,
      { signal, jsonSchema: CONTEXT_SCHEMA, temperature: 0.2 },
    );
    let ctx: VideoContext;
    try {
      const parsed = parseJsonLoose(res.content) as Partial<VideoContext>;
      ctx = {
        summary: String(parsed.summary ?? "").trim(),
        glossary: Array.isArray(parsed.glossary) ? parsed.glossary.slice(0, 15) : [],
      };
    } catch {
      ctx = { summary: res.content.trim(), glossary: [] };
    }
    return { ctx, usage: res.usage };
  } catch (err) {
    if (isAbortError(err)) throw err;
    // Context only improves consistency; translation still works without it.
    console.warn("[SubScribe] context step failed, continuing without it:", err);
    return { ctx: null, usage: emptyUsage() };
  }
};

const translateChunk = async (
  chunk: Segment[],
  prev: Segment[] | undefined,
  next: Segment[] | undefined,
  ctx: VideoContext | null,
  lang: string,
  settings: AISettings,
  signal: AbortSignal | undefined,
  addCost: (u: Usage) => void,
): Promise<TranslatedGroup[]> => {
  const messages: ChatMessage[] = [
    { role: "system", content: translationSystemPrompt(lang) },
    { role: "user", content: buildChunkMessage(chunk, prev, next, ctx) },
  ];
  let lastError = "";

  for (let attempt = 1; attempt <= CONFIG.AI.MAX_ATTEMPTS; attempt++) {
    let res;
    try {
      res = await chat(messages, settings, { signal, jsonSchema: GROUPS_SCHEMA, temperature: 0.3 });
    } catch (err) {
      if (err instanceof ApiError && err.retryable && attempt < CONFIG.AI.MAX_ATTEMPTS) {
        lastError = err.message;
        continue;
      }
      throw err;
    }
    addCost(res.usage);

    let parsed: unknown;
    try {
      parsed = parseJsonLoose(res.content);
    } catch (err) {
      lastError = (err as Error).message;
      messages.push(
        { role: "assistant", content: res.content.slice(0, 4000) },
        { role: "user", content: "That was not valid JSON. Reply with only the JSON object." },
      );
      continue;
    }

    // Length limits get one correction round; after that coverage is what matters.
    const check = validateGroups(parsed, chunk, { enforceLimits: attempt === 1 });
    if (check.ok) return check.groups;

    lastError = check.error;
    messages.push(
      { role: "assistant", content: res.content.slice(0, 4000) },
      {
        role: "user",
        content: `Invalid output: ${check.error}. Groups must cover ids ${chunk[0].id}–${chunk[chunk.length - 1].id} contiguously, in order, each id exactly once. Return the corrected JSON only.`,
      },
    );
  }
  throw new Error(`Model çıktısı kaynakla eşleşmedi, ${CONFIG.AI.MAX_ATTEMPTS} deneme yapıldı (${lastError})`);
};

interface PartialJob {
  ctx: VideoContext | null;
  results: (TranslatedGroup[] | undefined)[];
}

// Finished chunks survive a failure or cancel, so "try again" only pays for
// the chunks that are still missing.
const partialJobs = new Map<string, PartialJob>();

export const translateTranscript = async (
  transcript: string,
  targetLang: string,
  settings: AISettings,
  opts: {
    signal?: AbortSignal;
    onProgress?: (p: TranslateProgress) => void;
    /** Pre-parsed segments (e.g. millisecond caption data); defaults to parsing `transcript`. */
    segments?: Segment[];
  } = {},
): Promise<TranslateResult> => {
  const { signal, onProgress } = opts;
  const lang = getLanguage(targetLang).english;
  const segments = opts.segments?.length ? opts.segments : parseSegments(transcript);
  if (!segments.length) {
    throw new Error("Transkriptte zaman damgası yok. Zaman damgalı formatta kaydedip tekrar deneyin.");
  }

  const chunks = chunkSegments(segments, CONFIG.AI.CHUNK_SIZE);
  const jobKey = `${hashString(segments.map((x) => `${x.start} ${x.text}`).join("\n"))}:${targetLang}:${settings.model}`;
  const job: PartialJob = partialJobs.get(jobKey) ?? { ctx: null, results: new Array(chunks.length) };
  partialJobs.set(jobKey, job);

  let usage = emptyUsage();
  const addCost = (u: Usage) => {
    usage = addUsage(usage, u);
  };

  if (chunks.length > 1 && !job.ctx) {
    onProgress?.({ stage: "analyzing", done: 0, total: chunks.length });
    const { ctx, usage: u } = await buildContext(segments, lang, settings, signal);
    job.ctx = ctx;
    addCost(u);
  }

  let done = job.results.filter(Boolean).length;
  onProgress?.({ stage: "translating", done, total: chunks.length });

  // Worker pool: keeps CONCURRENCY requests in flight instead of waiting for
  // the slowest request of each batch.
  const pending = chunks.map((_, i) => i).filter((i) => !job.results[i]);
  const errors: unknown[] = [];
  const failFast = new AbortController();
  const onAbort = () => failFast.abort();
  signal?.addEventListener("abort", onAbort, { once: true });

  const worker = async () => {
    while (pending.length && !failFast.signal.aborted) {
      const i = pending.shift()!;
      try {
        job.results[i] = await translateChunk(
          chunks[i],
          chunks[i - 1],
          chunks[i + 1],
          job.ctx,
          lang,
          settings,
          failFast.signal,
          addCost,
        );
        done++;
        onProgress?.({ stage: "translating", done, total: chunks.length });
      } catch (err) {
        errors.push(err);
        failFast.abort();
      }
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(CONFIG.AI.CONCURRENCY, pending.length) }, worker));
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }

  if (signal?.aborted) throw new AbortError();
  const realError = errors.find((e) => !isAbortError(e));
  if (realError) {
    const saved = job.results.filter(Boolean).length;
    const msg = realError instanceof Error ? realError.message : String(realError);
    throw new Error(saved ? `${msg} — ${saved}/${chunks.length} parça kaydedildi, tekrar denerseniz kaldığı yerden devam eder.` : msg);
  }

  partialJobs.delete(jobKey);
  const groups = job.results.flatMap((r) => r ?? []);
  return { translated: groupsToText(groups, segments), summary: job.ctx?.summary ?? "", usage };
};


// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const buildSummaryPrompt = (options: SummaryOptions): string => {
  const langLine =
    !options.language || options.language === "auto"
      ? "Write the summary in the same language as the transcript."
      : `Write the summary in ${getLanguage(options.language).english}, regardless of the transcript's language.`;

  const timestampHint =
    "When a point refers to a specific moment, append the transcript timestamp in the form [m:ss] (e.g. [12:34]).";

  const formatInstructions: Record<SummaryOptions["format"], string> = {
    structured: `Structure:
1. A heading for the main topic, followed by one sentence describing what the video is about.
2. A heading for key points, followed by bullet points with the takeaways. ${timestampHint}
3. A heading for the conclusion, followed by a short wrap-up.
Write the headings in the output language. Use markdown (### headings, - bullets, **bold** for key terms).`,
    bullets: `Present the summary as a clean markdown bullet list.
- Start with a one-line topic sentence.
- Then list the key points as bullet items. ${timestampHint}
- No headings, no paragraphs.`,
    paragraph: `Write flowing, well-structured paragraphs.
- No bullet points or numbered lists.
- Natural paragraph breaks between ideas, narrative style.`,
    tldr: `Write an ultra-short TL;DR of 2-3 sentences that captures only the most important takeaway.`,
  };

  const toneInstructions: Record<SummaryOptions["tone"], string> = {
    neutral: "",
    simple: "Use simple, easy-to-understand language. Avoid jargon; explain as if to someone new to the topic.",
    technical: "Use precise technical language and domain terminology. Be exact and detailed.",
    academic: "Use formal academic language with rigorous structure and clear logical flow.",
    casual: "Use a friendly, conversational tone, like explaining to a friend.",
  };

  const lengthInstructions: Record<SummaryOptions["length"], string> = {
    short: "Keep it brief — roughly 3-5 bullet points or 1-2 short paragraphs.",
    medium: "Balanced — roughly 5-8 bullet points or 2-3 paragraphs.",
    long: "Comprehensive — cover all significant points, examples and nuances.",
  };

  return [
    "You are a skilled content analyst. Summarize the following YouTube video transcript.",
    langLine,
    formatInstructions[options.format],
    options.format === "tldr" ? "" : lengthInstructions[options.length],
    toneInstructions[options.tone] ? `Tone: ${toneInstructions[options.tone]}` : "",
    "Base the summary only on the transcript. Output ONLY the summary — no preamble or meta-commentary.",
  ]
    .filter(Boolean)
    .join("\n\n");
};

export const summarizeForUser = async (
  transcript: string,
  settings: AISettings,
  options: SummaryOptions,
  opts: { signal?: AbortSignal } = {},
): Promise<{ summary: string; usage: Usage }> => {
  // Collapse duplicate caption lines; keep timestamps so the model can cite moments.
  const segments = parseSegments(transcript);
  const body = segments.length
    ? segments.map((s) => `[${formatTimestamp(s.start)}] ${s.text}`).join("\n")
    : transcript;

  const res = await chat(
    [
      { role: "system", content: buildSummaryPrompt(options) },
      { role: "user", content: body },
    ],
    settings,
    { signal: opts.signal, temperature: 0.4 },
  );
  return { summary: res.content.trim(), usage: res.usage };
};
