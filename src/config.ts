export interface Language {
  code: string;
  /** Native name, shown in the UI. */
  name: string;
  /** English name, used in prompts (models follow it more reliably than a code). */
  english: string;
}

export const LANGUAGES: readonly Language[] = [
  { code: "tr", name: "Türkçe", english: "Turkish" },
  { code: "en", name: "English", english: "English" },
  { code: "de", name: "Deutsch", english: "German" },
  { code: "fr", name: "Français", english: "French" },
  { code: "es", name: "Español", english: "Spanish" },
  { code: "pt", name: "Português", english: "Portuguese (Brazilian)" },
  { code: "it", name: "Italiano", english: "Italian" },
  { code: "nl", name: "Nederlands", english: "Dutch" },
  { code: "pl", name: "Polski", english: "Polish" },
  { code: "ru", name: "Русский", english: "Russian" },
  { code: "uk", name: "Українська", english: "Ukrainian" },
  { code: "ar", name: "العربية", english: "Arabic" },
  { code: "fa", name: "فارسی", english: "Persian" },
  { code: "hi", name: "हिन्दी", english: "Hindi" },
  { code: "id", name: "Bahasa Indonesia", english: "Indonesian" },
  { code: "ja", name: "日本語", english: "Japanese" },
  { code: "ko", name: "한국어", english: "Korean" },
  { code: "zh", name: "中文 (简体)", english: "Simplified Chinese" },
];

export const getLanguage = (code: string): Language =>
  LANGUAGES.find((l) => l.code === code) ?? {
    code,
    name: code.toUpperCase(),
    english: code,
  };

export const CONFIG = {
  VERSION: typeof __VERSION__ !== "undefined" ? __VERSION__ : "dev",
  DB_NAME: "YouTubeTranscriptPro",
  DB_VERSION: 2,
  STORE_NAME: "transcripts",
  DEBOUNCE_MS: 250,
  MAX_SEARCH_RESULTS: 50,
  SEARCH_PREVIEW_LENGTH: 500,
  HOMEPAGE: "https://github.com/umitaltintas/subscribe",
  AI: {
    DEFAULT_MODEL: "google/gemini-3.1-flash",
    DEFAULT_TARGET_LANG: "tr",
    /** Max characters of source text sent per translation request. */
    CHUNK_SIZE: 2500,
    /** Parallel translation requests. */
    CONCURRENCY: 5,
    /** Attempts per chunk (first try + retries). */
    MAX_ATTEMPTS: 3,
    /** Max characters of transcript used to build the context summary. */
    CONTEXT_MAX_CHARS: 60000,
    OPENROUTER_URL: "https://openrouter.ai/api/v1/chat/completions",
    OPENROUTER_MODELS_URL: "https://openrouter.ai/api/v1/models",
    OPENROUTER_KEY_URL: "https://openrouter.ai/api/v1/key",
    SUMMARY_FORMATS: [
      { id: "structured", name: "Yapılandırılmış", description: "Ana konu, önemli noktalar ve sonuç" },
      { id: "bullets", name: "Madde İşaretli", description: "Sadece madde işaretli liste" },
      { id: "paragraph", name: "Paragraf", description: "Akıcı paragraf formatında" },
      { id: "tldr", name: "TL;DR", description: "2-3 cümlelik ultra kısa özet" },
    ] as const,
    SUMMARY_TONES: [
      { id: "neutral", name: "Nötr" },
      { id: "simple", name: "Basit / Sade" },
      { id: "technical", name: "Teknik" },
      { id: "academic", name: "Akademik" },
      { id: "casual", name: "Günlük / Samimi" },
    ] as const,
    SUMMARY_LENGTHS: [
      { id: "short", name: "Kısa" },
      { id: "medium", name: "Orta" },
      { id: "long", name: "Detaylı" },
    ] as const,
  },
  FUSE_OPTIONS: {
    keys: [
      { name: "title", weight: 0.35 },
      { name: "channel", weight: 0.25 },
      { name: "tags", weight: 0.25 },
      { name: "searchableTranscript", weight: 0.15 },
    ],
    threshold: 0.4,
    distance: 100,
    ignoreLocation: true,
    useExtendedSearch: true,
    minMatchCharLength: 2,
    includeScore: true,
    includeMatches: true,
    findAllMatches: false,
    shouldSort: true,
  },
};
