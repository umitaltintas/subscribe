export interface TranscriptRecord {
  id: string;
  url: string;
  title: string;
  channel: string;
  duration: string;
  transcript: string;
  format: "text" | "time";
  /** Timestamped copy, kept when `transcript` was saved as plain text. */
  timedTranscript?: string;
  /** Caption fragments with millisecond timing from YouTube's player. */
  captionSegments?: { start: number; end: number; text: string }[];
  date: string;
  favorite: boolean;
  tags: string[];
  copyCount: number;
  words: number;
  chars: number;
  tokens: number;
  /** Language code → translated transcript as "[m:ss] text" lines. */
  translations?: Record<string, string>;
  /** Short context summary generated during translation. */
  summary?: string;
  /** Summary the user explicitly asked for. */
  userSummary?: string;
}

export interface VideoInfo {
  id: string;
  url: string;
  title: string;
  channel: string;
  duration: string;
}

export interface TextStats {
  words: number;
  chars: number;
  tokens: number;
}

export interface FuseMatch {
  indices: readonly [number, number][];
  key?: string;
  value?: string;
}

export interface SearchResult extends TranscriptRecord {
  _score?: number;
  _matches?: FuseMatch[];
}

export interface SearchableItem {
  id: string;
  title: string;
  channel: string;
  tags: string;
  searchableTranscript: string;
  _original: TranscriptRecord;
}

export interface DBStats {
  total: number;
  favorites: number;
  totalTokens: number;
  totalWords: number;
  channelCount: number;
  tagCount: number;
  thisWeek: number;
  topCopied: TranscriptRecord[];
  channels: string[];
  indexTime: number;
}

export interface SearchFilters {
  tag?: string;
  channel?: string;
  favoritesOnly?: boolean;
}

export interface AISettings {
  apiKey: string;
  provider: "openrouter";
  model: string;
  targetLanguage: string;
}

export interface SubtitleSettings {
  /** Font scale in percent (100 = default). */
  scale: number;
  color: "yellow" | "white";
  /** Background opacity, 0–1. */
  background: number;
  /** Show the original line under the translation. */
  bilingual: boolean;
  /** Seconds to delay (+) or advance (−) subtitles. */
  offset: number;
}

export interface AppSettings extends AISettings {
  /** "auto" = same language as the video, otherwise a language code. */
  summaryLanguage: string;
  subtitles: SubtitleSettings;
  lastSummaryOptions?: SummaryOptions;
}

export type SummaryFormat = "structured" | "bullets" | "paragraph" | "tldr";
export type SummaryTone = "neutral" | "simple" | "technical" | "academic" | "casual";
export type SummaryLength = "short" | "medium" | "long";

export interface SummaryOptions {
  format: SummaryFormat;
  tone: SummaryTone;
  length: SummaryLength;
  /** "auto" = same language as the video. */
  language?: string;
}

export interface SubtitleCue {
  startTime: number;
  endTime: number;
  text: string;
  /** Original-language text for the same time range (bilingual mode). */
  original?: string;
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  /** USD, 0 when the provider did not report it. */
  cost: number;
}
