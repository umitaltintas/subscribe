import { CONFIG } from "./config";
import { request, sleepAbortable, isAbortError } from "./http";
import type { AISettings, Usage } from "./types";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  signal?: AbortSignal;
  /** JSON schema for structured output. Dropped automatically if the model rejects it. */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  temperature?: number;
}

export interface ChatResult {
  content: string;
  usage: Usage;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    /** True when trying again with the same request may succeed. */
    public retryable = false,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const emptyUsage = (): Usage => ({ promptTokens: 0, completionTokens: 0, cost: 0 });

export const addUsage = (a: Usage, b: Usage): Usage => ({
  promptTokens: a.promptTokens + b.promptTokens,
  completionTokens: a.completionTokens + b.completionTokens,
  cost: a.cost + b.cost,
});

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504, 529]);

// Models that rejected response_format once; skip it for them afterwards.
const noStructuredOutput = new Set<string>();

const describeError = (status: number, body: string): string => {
  let msg = body;
  try {
    const parsed = JSON.parse(body);
    msg = parsed?.error?.message || parsed?.message || body;
  } catch {
    /* body is plain text */
  }
  msg = String(msg).slice(0, 300);
  if (status === 401) return "API anahtarı geçersiz (401). Ayarlardan kontrol edin.";
  if (status === 402) return "OpenRouter bakiyesi yetersiz (402).";
  if (status === 429) return "Hız sınırına takıldı (429), biraz sonra tekrar deneyin.";
  if (status === 404 && /model/i.test(msg)) return `Model bulunamadı: ${msg}`;
  return `API hatası (${status}): ${msg}`;
};

const headers = (apiKey: string): Record<string, string> => ({
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
  // Identify the app, not the page the user is watching.
  "HTTP-Referer": CONFIG.HOMEPAGE,
  "X-Title": "SubScribe",
});

export const chat = async (
  messages: ChatMessage[],
  settings: AISettings,
  opts: ChatOptions = {},
): Promise<ChatResult> => {
  const { signal, jsonSchema, temperature } = opts;
  let useSchema = !!jsonSchema && !noStructuredOutput.has(settings.model);

  for (let attempt = 0; ; attempt++) {
    const body: Record<string, unknown> = {
      model: settings.model,
      messages,
      usage: { include: true },
    };
    if (temperature !== undefined) body.temperature = temperature;
    if (useSchema && jsonSchema) {
      body.response_format = {
        type: "json_schema",
        json_schema: { name: jsonSchema.name, strict: true, schema: jsonSchema.schema },
      };
    }

    let res;
    try {
      res = await request(CONFIG.AI.OPENROUTER_URL, {
        method: "POST",
        headers: headers(settings.apiKey),
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if (isAbortError(err) || attempt >= 2) throw err;
      await sleepAbortable(1000 * 2 ** attempt, signal);
      continue;
    }

    if (!res.ok) {
      // Some models/providers do not support structured output; retry without it.
      if (useSchema && res.status === 400 && /response_format|json_schema|structured/i.test(res.text)) {
        noStructuredOutput.add(settings.model);
        useSchema = false;
        continue;
      }
      if (RETRYABLE.has(res.status) && attempt < 3) {
        await sleepAbortable(1500 * 2 ** attempt + Math.random() * 500, signal);
        continue;
      }
      throw new ApiError(describeError(res.status, res.text), res.status);
    }

    let data;
    try {
      data = JSON.parse(res.text);
    } catch {
      throw new ApiError("API geçersiz bir yanıt döndürdü", res.status);
    }
    if (data.error) throw new ApiError(describeError(data.error.code ?? 500, JSON.stringify(data)), 500);

    const content: string = data.choices?.[0]?.message?.content ?? "";
    // Empty content usually means a provider hiccup or a filtered response.
    if (!content.trim()) throw new ApiError("API boş yanıt döndürdü", res.status, true);

    return {
      content,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        cost: typeof data.usage?.cost === "number" ? data.usage.cost : 0,
      },
    };
  }
};

export interface ModelInfo {
  id: string;
  name: string;
  /** USD per 1M tokens. */
  promptPrice: number;
  completionPrice: number;
  contextLength: number;
}

let modelsCache: ModelInfo[] | null = null;

export const listModels = async (): Promise<ModelInfo[]> => {
  if (modelsCache) return modelsCache;
  const res = await request(CONFIG.AI.OPENROUTER_MODELS_URL);
  if (!res.ok) throw new Error(`Model listesi alınamadı (${res.status})`);
  const data = JSON.parse(res.text);
  modelsCache = (data.data ?? [])
    .map(
      (m: {
        id: string;
        name?: string;
        context_length?: number;
        pricing?: { prompt?: string; completion?: string };
      }): ModelInfo => ({
        id: m.id,
        name: m.name ?? m.id,
        promptPrice: Number(m.pricing?.prompt ?? 0) * 1e6,
        completionPrice: Number(m.pricing?.completion ?? 0) * 1e6,
        contextLength: m.context_length ?? 0,
      }),
    )
    .sort((a: ModelInfo, b: ModelInfo) => a.id.localeCompare(b.id));
  return modelsCache!;
};

export interface KeyInfo {
  label: string;
  usage: number;
  limit: number | null;
}

export const checkApiKey = async (apiKey: string): Promise<KeyInfo> => {
  const res = await request(CONFIG.AI.OPENROUTER_KEY_URL, { headers: headers(apiKey), timeoutMs: 15_000 });
  if (!res.ok) throw new ApiError(describeError(res.status, res.text), res.status);
  const data = JSON.parse(res.text).data ?? {};
  return { label: data.label ?? "", usage: data.usage ?? 0, limit: data.limit ?? null };
};

export const formatCost = (usage: Usage): string =>
  usage.cost > 0
    ? `$${usage.cost < 0.01 ? usage.cost.toFixed(4) : usage.cost.toFixed(3)}`
    : `${(usage.promptTokens + usage.completionTokens).toLocaleString("tr-TR")} token`;
