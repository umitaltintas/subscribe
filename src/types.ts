export interface TranscriptRecord {
  id: string;
  url: string;
  title: string;
  channel: string;
  duration: string;
  transcript: string;
  format: "text" | "time";
  date: string;
  favorite: boolean;
  tags: string[];
  copyCount: number;
  words: number;
  chars: number;
  tokens: number;
  translations?: Record<string, string>;
  summary?: string;
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

export interface SubtitleCue {
  startTime: number;
  endTime: number;
  text: string;
}
