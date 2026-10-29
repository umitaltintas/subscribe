// Single place that runs translations/summaries, persists them, and drives
// the subtitle overlay. Every UI surface (video page, viewer, dashboard)
// goes through here, so state stays consistent and jobs are never duplicated.
import { db } from "./db";
import { translateTranscript, summarizeForUser, type TranslateProgress } from "./ai";
import { getSettings } from "./settings-store";
import { getVideoInfo, fetchTimedTranscript } from "./transcript";
import {
  hasTimestamps,
  parseCues,
  parseSegments,
  storedToSegments,
  storedToTimedText,
  type Segment,
} from "./segments";
import { fetchCaptionSegments } from "./timedtext";
import { showSubtitleOverlay, hideSubtitleOverlay, getOverlayState } from "./subtitle-overlay";
import { countStats, sleep } from "./utils";
import { isAbortError } from "./http";
import type { TranscriptRecord, SummaryOptions, Usage, VideoInfo } from "./types";

export type JobEvent =
  | { type: "progress"; progress: TranslateProgress }
  | { type: "done"; translated: string; usage: Usage }
  | { type: "error"; error: Error }
  | { type: "cancelled" };

export interface TranslationJob {
  videoId: string;
  lang: string;
  progress: TranslateProgress | null;
  promise: Promise<string>;
  cancel: () => void;
}

const jobs = new Map<string, TranslationJob>();
const listeners = new Set<(videoId: string, lang: string, e: JobEvent) => void>();

const jobKey = (videoId: string, lang: string) => `${videoId}:${lang}`;

export const onJobEvent = (fn: (videoId: string, lang: string, e: JobEvent) => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const emit = (videoId: string, lang: string, e: JobEvent) => listeners.forEach((fn) => fn(videoId, lang, e));

export const getJob = (videoId: string, lang: string): TranslationJob | undefined => jobs.get(jobKey(videoId, lang));

export const getJobsFor = (videoId: string): TranslationJob[] => [...jobs.values()].filter((j) => j.videoId === videoId);

export const currentVideoId = (): string =>
  location.pathname === "/watch" ? new URLSearchParams(location.search).get("v") || "" : "";

/** Timestamped transcript of a record, or "" if it was saved as plain text only. */
export const getTimedText = (record: TranscriptRecord | undefined): string => {
  if (!record) return "";
  if (hasTimestamps(record.transcript)) return record.transcript;
  return record.timedTranscript && hasTimestamps(record.timedTranscript) ? record.timedTranscript : "";
};

/**
 * Segments that drive subtitle timing: YouTube caption data (milliseconds)
 * when saved, otherwise the transcript panel's whole-second timestamps.
 */
export const getSourceSegments = (record: TranscriptRecord | undefined): Segment[] =>
  record?.captionSegments?.length ? storedToSegments(record.captionSegments) : parseSegments(getTimedText(record));

/**
 * Returns the transcript for translating a video, preferring the player's
 * millisecond caption data when the video is open, then a saved timestamped
 * transcript, then YouTube's transcript panel. Creates/updates the record.
 */
const resolveTranscript = async (
  videoId: string,
  info: VideoInfo | null,
): Promise<{ record: TranscriptRecord | undefined; timed: string }> => {
  let record = await db.get(videoId);
  if (record?.captionSegments?.length) {
    return { record, timed: getTimedText(record) || storedToTimedText(record.captionSegments) };
  }

  const onPage = currentVideoId() === videoId;
  if (onPage) {
    const captions = await fetchCaptionSegments(videoId);
    if (captions && currentVideoId() === videoId) {
      const existingText = getTimedText(record);
      const timed = existingText || storedToTimedText(captions);
      if (record) {
        record =
          (await db.update(videoId, { captionSegments: captions, ...(existingText ? {} : { timedTranscript: timed }) })) ??
          record;
      } else {
        const meta = info ?? getVideoInfo();
        record = await db.upsert({
          id: videoId,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          title: meta.title,
          channel: meta.channel,
          duration: meta.duration,
          transcript: timed,
          format: "time",
          captionSegments: captions,
          copyCount: 0,
          ...countStats(timed),
        });
      }
      return { record, timed };
    }
  }

  const saved = getTimedText(record);
  if (saved) return { record, timed: saved };

  if (!onPage) {
    throw new Error("Kayıtlı transkriptte zaman damgası yok. Videoyu açıp oradan çevirin.");
  }
  const timed = await fetchTimedTranscript(videoId);
  if (record) {
    return { record: (await db.update(videoId, { timedTranscript: timed })) ?? record, timed };
  }
  const meta = info ?? getVideoInfo();
  const created = await db.upsert({
    id: videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: meta.title,
    channel: meta.channel,
    duration: meta.duration,
    transcript: timed,
    format: "time",
    copyCount: 0,
    ...countStats(timed),
  });
  return { record: created, timed };
};

export interface StartOptions {
  force?: boolean;
  /** Video metadata captured when the user clicked (not when the job ends). */
  info?: VideoInfo | null;
}

/**
 * Starts (or joins) a translation job. Resolves with the translated text.
 * Already-saved translations resolve immediately unless `force` is set.
 */
export const startTranslation = (videoId: string, lang: string, opts: StartOptions = {}): TranslationJob => {
  const key = jobKey(videoId, lang);
  const existing = jobs.get(key);
  if (existing) return existing;

  const controller = new AbortController();
  const job: TranslationJob = {
    videoId,
    lang,
    progress: null,
    cancel: () => controller.abort(),
    promise: Promise.resolve(""),
  };
  // Register before any work runs, so even a synchronous failure cannot leave
  // a stale entry behind.
  jobs.set(key, job);
  emit(videoId, lang, { type: "progress", progress: { stage: "analyzing", done: 0, total: 0 } });

  job.promise = (async () => {
    await Promise.resolve();
    try {
      const settings = getSettings();
      if (!settings.apiKey) throw new Error("Önce ayarlardan OpenRouter API anahtarını girin");

      if (!opts.force) {
        const saved = (await db.get(videoId))?.translations?.[lang];
        if (saved) {
          emit(videoId, lang, { type: "done", translated: saved, usage: { promptTokens: 0, completionTokens: 0, cost: 0 } });
          return saved;
        }
      }

      const { record, timed } = await resolveTranscript(videoId, opts.info ?? null);
      const result = await translateTranscript(timed, lang, settings, {
        segments: getSourceSegments(record),
        signal: controller.signal,
        onProgress: (p) => {
          job.progress = p;
          emit(videoId, lang, { type: "progress", progress: p });
        },
      });

      // One merge transaction. If the record was deleted meanwhile, recreate
      // it rather than throwing away a paid translation.
      const saved = await db.update(videoId, (cur) => ({
        translations: { ...(cur.translations ?? {}), [lang]: result.translated },
        ...(result.summary ? { summary: result.summary } : {}),
      }));
      if (!saved) {
        const meta = opts.info ?? record;
        await db.upsert({
          id: videoId,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          title: meta?.title ?? videoId,
          channel: meta?.channel ?? "",
          transcript: timed,
          format: "time",
          ...countStats(timed),
          translations: { [lang]: result.translated },
          summary: result.summary || undefined,
        });
      }
      emit(videoId, lang, { type: "done", translated: result.translated, usage: result.usage });

      // Refresh subtitles if they are showing an older version of this translation.
      const overlay = getOverlayState();
      if (overlay?.videoId === videoId && overlay.lang === lang) await showSubtitles(videoId, lang);
      return result.translated;
    } catch (err) {
      if (isAbortError(err) || controller.signal.aborted) {
        emit(videoId, lang, { type: "cancelled" });
      } else {
        emit(videoId, lang, { type: "error", error: err as Error });
      }
      throw err;
    } finally {
      if (jobs.get(key) === job) jobs.delete(key);
    }
  })();
  // Callers that only listen to events should not cause unhandled rejections.
  job.promise.catch(() => {});
  return job;
};

export const cancelAllJobs = (): void => jobs.forEach((j) => j.cancel());

/** Cancels every running translation of a video (e.g. before deleting it). */
export const cancelJobsFor = (videoId: string): void => getJobsFor(videoId).forEach((j) => j.cancel());

// ---------------------------------------------------------------------------
// Subtitles
// ---------------------------------------------------------------------------

const PENDING_KEY = "ytc-pending-subs";

/**
 * Shows subtitles for a saved translation. If another video is open, opens
 * the right video and turns the subtitles on once it has loaded.
 */
export const showSubtitles = async (videoId: string, lang: string): Promise<"shown" | "navigating"> => {
  if (currentVideoId() !== videoId) {
    // localStorage (not sessionStorage) so a new tab picks it up too.
    localStorage.setItem(PENDING_KEY, JSON.stringify({ videoId, lang, at: Date.now() }));
    const url = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    // A full navigation would kill running translations; use a new tab then.
    if (jobs.size > 0) window.open(url, "_blank");
    else location.href = url;
    return "navigating";
  }
  const record = await db.get(videoId);
  const translated = record?.translations?.[lang];
  if (!translated) throw new Error("Bu dilde kayıtlı çeviri yok");
  const cues = parseCues(translated, getSourceSegments(record));
  if (!cues.length) throw new Error("Çeviride zaman damgası bulunamadı");
  if (!showSubtitleOverlay(cues, { videoId, lang })) throw new Error("Video oynatıcı bulunamadı");
  return "shown";
};

export const hideSubtitles = (): void => hideSubtitleOverlay();

/** Called on every navigation: turns on subtitles requested from another page. */
export const consumePendingSubtitles = async (): Promise<void> => {
  const raw = localStorage.getItem(PENDING_KEY);
  if (!raw) return;
  let pending: { videoId: string; lang: string; at: number };
  try {
    pending = JSON.parse(raw);
  } catch {
    localStorage.removeItem(PENDING_KEY);
    return;
  }
  if (Date.now() - pending.at > 60_000) {
    localStorage.removeItem(PENDING_KEY);
    return;
  }
  if (currentVideoId() !== pending.videoId) return;
  localStorage.removeItem(PENDING_KEY);
  // Wait for the player to exist.
  for (let i = 0; i < 20 && !document.querySelector("#movie_player video"); i++) await sleep(250);
  try {
    await showSubtitles(pending.videoId, pending.lang);
  } catch (err) {
    console.warn("[SubScribe] could not show pending subtitles", err);
  }
};

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const summaryJobs = new Map<string, Promise<string>>();

export const isSummarizing = (videoId: string): boolean => summaryJobs.has(videoId);

export const summarizeVideo = (
  videoId: string,
  options: SummaryOptions,
  opts: { info?: VideoInfo | null; signal?: AbortSignal } = {},
): Promise<string> => {
  const running = summaryJobs.get(videoId);
  if (running) return running;

  const p = (async () => {
    const settings = getSettings();
    if (!settings.apiKey) throw new Error("Önce ayarlardan OpenRouter API anahtarını girin");
    const record = await db.get(videoId);
    const text = getTimedText(record) || record?.transcript || (await resolveTranscript(videoId, opts.info ?? null)).timed;
    const { summary } = await summarizeForUser(text, settings, options, { signal: opts.signal });
    await db.update(videoId, { userSummary: summary });
    return summary;
  })().finally(() => summaryJobs.delete(videoId));

  summaryJobs.set(videoId, p);
  return p;
};
