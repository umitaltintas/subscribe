// Millisecond-accurate captions from YouTube's own player.
//
// The transcript panel only exposes whole seconds. The player loads captions
// from /api/timedtext with a short-lived proof-of-origin token ("pot") that a
// script cannot mint, so we reuse the URL of the player's own request: it is
// observed via the Resource Timing API, and if the player has not loaded
// captions yet we briefly toggle the CC button to make it do so.
import { $ } from "./dom";
import { sleep } from "./utils";
import { parseJson3, type StoredSegment } from "./segments";

const captured = new Map<string, string>(); // videoId → timedtext URL
let observing = false;

const remember = (url: string): void => {
  if (!url.includes("/api/timedtext")) return;
  try {
    const u = new URL(url, location.origin);
    const v = u.searchParams.get("v");
    if (v && u.searchParams.has("pot")) captured.set(v, u.toString());
  } catch {
    /* ignore malformed URLs */
  }
};

/** Starts recording the player's caption requests. Safe to call repeatedly. */
export const watchCaptionRequests = (): void => {
  if (observing || typeof PerformanceObserver === "undefined") return;
  observing = true;
  try {
    // YouTube makes hundreds of requests; make room so entries are not dropped.
    performance.setResourceTimingBufferSize?.(2000);
    performance.getEntriesByType("resource").forEach((e) => remember(e.name));
    new PerformanceObserver((list) => list.getEntries().forEach((e) => remember(e.name))).observe({
      type: "resource",
      buffered: true,
    });
  } catch (err) {
    console.warn("[SubScribe] caption request observer unavailable", err);
  }
};

const ccButton = (): HTMLButtonElement | null => {
  const btn = $("#movie_player .ytp-subtitles-button") as HTMLButtonElement | null;
  if (!btn || btn.offsetParent === null || btn.getAttribute("aria-disabled") === "true") return null;
  return btn;
};

const waitForCapture = async (videoId: string, ms: number): Promise<string | undefined> => {
  for (let waited = 0; waited < ms; waited += 150) {
    const url = captured.get(videoId);
    if (url) return url;
    await sleep(150);
  }
  return captured.get(videoId);
};

/** Makes the player request captions by toggling CC, then restores CC state. */
const triggerCaptionRequest = async (videoId: string): Promise<string | undefined> => {
  const btn = ccButton();
  if (!btn) return undefined; // video has no captions
  const wasOn = btn.getAttribute("aria-pressed") === "true";
  try {
    if (wasOn) {
      // Already on but the request predates our observer: off → on refetches.
      btn.click();
      await sleep(250);
    }
    btn.click();
    return await waitForCapture(videoId, 4000);
  } finally {
    const nowOn = btn.getAttribute("aria-pressed") === "true";
    if (nowOn !== wasOn) btn.click();
  }
};

const pageFetch = (url: string): Promise<Response> => {
  // Request from the page's context (page origin). In Firefox userscript
  // sandboxes the page's own fetch is on unsafeWindow.
  // Same-origin, so cookies are sent by default; no init object needed (which
  // also avoids passing sandbox objects into the page in Firefox).
  const w = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  return w.fetch(url);
};

/**
 * Caption segments with millisecond timing for the open video, or null when
 * unavailable (no captions, request blocked, layout changed…). Callers fall
 * back to the transcript panel.
 */
export const fetchCaptionSegments = async (videoId: string): Promise<StoredSegment[] | null> => {
  watchCaptionRequests();
  try {
    let url = captured.get(videoId) ?? (await triggerCaptionRequest(videoId));
    if (!url) return null;

    const u = new URL(url);
    u.searchParams.set("fmt", "json3");
    // "tlang" is YouTube's machine translation of the track; we want the source.
    u.searchParams.delete("tlang");
    url = u.toString();

    const res = await pageFetch(url);
    if (!res.ok) return null;
    const segments = parseJson3(await res.text());
    return segments.length ? segments : null;
  } catch (err) {
    console.warn("[SubScribe] caption data unavailable, using transcript panel", err);
    return null;
  }
};
