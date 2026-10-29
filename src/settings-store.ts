import { CONFIG } from "./config";
import type { AppSettings } from "./types";

const KEY = "ytc-settings";
const LEGACY_LOCALSTORAGE_KEY = "ytc-ai-settings";

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: "",
  provider: "openrouter",
  model: CONFIG.AI.DEFAULT_MODEL,
  targetLanguage: CONFIG.AI.DEFAULT_TARGET_LANG,
  summaryLanguage: "auto",
  subtitles: { scale: 100, color: "yellow", background: 0.75, bilingual: false, offset: 0 },
};

const hasGM = typeof GM_getValue === "function" && typeof GM_setValue === "function";

// Userscript storage is private to the script. localStorage on youtube.com is
// readable by every script on the page, so it is only a fallback.
const read = (): unknown => {
  if (hasGM) return GM_getValue(KEY, null);
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
};

const write = (value: AppSettings): void => {
  if (hasGM) GM_setValue(KEY, value);
  else localStorage.setItem(KEY, JSON.stringify(value));
};

const merge = (raw: unknown): AppSettings => {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<AppSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    model: s.model?.trim() || DEFAULT_SETTINGS.model,
    subtitles: { ...DEFAULT_SETTINGS.subtitles, ...(s.subtitles ?? {}) },
  };
};

/** Moves settings saved by older versions out of the page's localStorage. */
const migrateLegacy = (): void => {
  let legacy: string | null = null;
  try {
    legacy = localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
  } catch {
    return;
  }
  if (!legacy) return;
  try {
    if (!read()) write(merge(JSON.parse(legacy)));
    localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
  } catch (err) {
    console.warn("[SubScribe] could not migrate old settings", err);
  }
};

let cached: AppSettings | null = null;
const listeners = new Set<(s: AppSettings) => void>();

export const getSettings = (): AppSettings => {
  if (!cached) {
    migrateLegacy();
    cached = merge(read());
  }
  return cached;
};

export const updateSettings = (patch: Partial<AppSettings>): AppSettings => {
  const next = merge({ ...getSettings(), ...patch });
  write(next);
  cached = next;
  listeners.forEach((fn) => fn(next));
  return next;
};

export const onSettingsChange = (fn: (s: AppSettings) => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const hasApiKey = (): boolean => !!getSettings().apiKey;
