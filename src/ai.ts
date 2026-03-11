import { CONFIG } from "./config";
import type { AISettings, SubtitleCue } from "./types";

export const parseTimestampedTranscript = (text: string): SubtitleCue[] => {
  const lines = text.split("\n").filter((l) => l.trim());
  const cues: SubtitleCue[] = [];

  for (const line of lines) {
    const match = line.match(/^\[(?:(\d+):)?(\d+):(\d+)\]\s*(.+)$/);
    if (!match) continue;

    const hours = match[1] ? parseInt(match[1], 10) : 0;
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);
    const startTime = hours * 3600 + minutes * 60 + seconds;
    const text = match[4].trim();

    cues.push({ startTime, endTime: 0, text });
  }

  for (let i = 0; i < cues.length; i++) {
    cues[i].endTime =
      i < cues.length - 1 ? cues[i + 1].startTime : cues[i].startTime + 5;
  }

  return cues;
};

export const chunkTranscript = (
  text: string,
  chunkSize: number = CONFIG.AI.CHUNK_SIZE,
): string[] => {
  const lines = text.split("\n");
  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    if (current.length + line.length + 1 > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      current = "";
    }
    current += (current ? "\n" : "") + line;
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
};

export interface TranslationUsage {
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
}

let lastTranslationUsage: TranslationUsage = { promptTokens: 0, completionTokens: 0, totalCost: 0 };

export const getLastTranslationUsage = (): TranslationUsage => lastTranslationUsage;

const fetchGenerationCost = async (generationId: string, apiKey: string): Promise<number> => {
  try {
    const res = await fetch(`https://openrouter.ai/api/v1/generation?id=${generationId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.data?.total_cost ?? 0;
  } catch {
    return 0;
  }
};

const summarizeTranscript = async (
  transcript: string,
  settings: AISettings,
): Promise<string> => {
  const response = await fetch(CONFIG.AI.OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.href,
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        {
          role: "system",
          content: `Analyze this video transcript and provide a brief context summary (3-5 sentences). Include:
- The main topic/theme
- The speaker's tone and style (formal, casual, technical, humorous, etc.)
- Key terminology or jargon used
- The target audience

Output ONLY the summary. No headers, labels, or extra formatting.`,
        },
        {
          role: "user",
          content: transcript,
        },
      ],
    }),
  });

  if (!response.ok) return "";
  const data = await response.json();

  const usage = data.usage;
  if (usage) {
    lastTranslationUsage.promptTokens += usage.prompt_tokens ?? 0;
    lastTranslationUsage.completionTokens += usage.completion_tokens ?? 0;
  }
  if (data.id) {
    const cost = await fetchGenerationCost(data.id, settings.apiKey);
    lastTranslationUsage.totalCost += cost;
  }

  return data.choices?.[0]?.message?.content ?? "";
};

export const translateChunk = async (
  chunk: string,
  targetLang: string,
  settings: AISettings,
  context: string = "",
): Promise<string> => {
  const contextBlock = context
    ? `\nVIDEO CONTEXT (use this to maintain consistency and accuracy):\n${context}\n`
    : "";

  const response = await fetch(CONFIG.AI.OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.href,
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        {
          role: "system",
          content: `You are an expert localization specialist. Localize the following video transcript into ${targetLang}.
${contextBlock}
FORMAT RULES:
- Each input line is: [MM:SS] text
- Keep every timestamp in the same order. Do NOT add or remove timestamps.
- Each output line MUST start with the original timestamp.

NATURAL SENTENCE RULE:
- The source transcript often splits a single sentence across multiple timestamps. Do NOT reproduce these awkward splits.
- Write complete, natural sentences in ${targetLang}. Redistribute the meaning freely across the timestamp lines.
- It is OK for a translated line to cover more or less meaning than the corresponding source line, as long as every timestamp has meaningful text and the overall meaning is fully preserved.

Example input:
[0:00] So today we're going to
[0:03] talk about something really important
[0:06] which is artificial intelligence

Example output for Turkish:
[0:00] Bugün çok önemli bir konudan bahsedeceğiz.
[0:03] Yapay zeka!
[0:06] Hadi başlayalım.

Localization rules:
- Adapt meaning, tone and intent naturally — do NOT translate word-by-word.
- Use culturally appropriate expressions and phrasing native to ${targetLang}.
- Preserve the speaker's style and register (formal, casual, humorous, technical).
- Keep technical terms, brand names, and proper nouns unchanged unless they have a widely accepted localized form.
- Output ONLY the localized lines. No commentary, notes, or extra text.`,
        },
        {
          role: "user",
          content: chunk,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Unknown error");
    throw new Error(
      `OpenRouter API error (${response.status}): ${errorBody}`,
    );
  }

  const data = await response.json();

  if (!data.choices?.[0]?.message?.content) {
    throw new Error("OpenRouter API returned an empty or invalid response");
  }

  // Track token usage
  const usage = data.usage;
  if (usage) {
    lastTranslationUsage.promptTokens += usage.prompt_tokens ?? 0;
    lastTranslationUsage.completionTokens += usage.completion_tokens ?? 0;
  }

  // Fetch actual cost from generation endpoint
  if (data.id) {
    const cost = await fetchGenerationCost(data.id, settings.apiKey);
    lastTranslationUsage.totalCost += cost;
  }

  return data.choices[0].message.content;
};

const cleanTranscript = (text: string): string => {
  const seen = new Set<string>();
  return text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      // Remove empty lines, bare brackets, timestamp-only lines
      if (!trimmed || trimmed === "[]" || /^\[\d{1,2}:\d{2}(:\d{2})?\]\s*$/.test(trimmed)) return false;
      // Deduplicate identical lines
      if (seen.has(trimmed)) return false;
      seen.add(trimmed);
      return true;
    })
    .join("\n");
};

export const translateTranscript = async (
  transcript: string,
  targetLang: string,
  settings: AISettings,
  onProgress?: (percent: number, stage?: string) => void,
): Promise<{ translated: string; summary: string }> => {
  lastTranslationUsage = { promptTokens: 0, completionTokens: 0, totalCost: 0 };
  const cleaned = cleanTranscript(transcript);

  // First pass: summarize the full transcript for context
  onProgress?.(0, "analyzing");
  const summary = await summarizeTranscript(cleaned, settings);

  const chunks = chunkTranscript(cleaned);
  const total = chunks.length;
  let completed = 0;

  onProgress?.(0, "translating");

  // Process chunks in parallel batches of up to 5
  const CONCURRENCY = 5;
  const results: string[] = new Array(total);

  for (let start = 0; start < total; start += CONCURRENCY) {
    const batch = chunks.slice(start, start + CONCURRENCY);
    const promises = batch.map((chunk, i) =>
      translateChunk(chunk, targetLang, settings, summary).then((translated) => {
        results[start + i] = translated;
        completed++;
        onProgress?.(Math.round((completed / total) * 100), "translating");
      }),
    );

    const settled = await Promise.allSettled(promises);
    const failed = settled.find((r) => r.status === "rejected");
    if (failed && failed.status === "rejected") {
      throw new Error(`Translation failed: ${failed.reason instanceof Error ? failed.reason.message : String(failed.reason)}`);
    }
  }

  return { translated: results.join("\n"), summary };
};
