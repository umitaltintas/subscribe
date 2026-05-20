import { $, $$ } from "./dom";
import { sleep } from "./utils";
import type { VideoInfo } from "./types";

export const getVideoInfo = (): VideoInfo => ({
  id: new URLSearchParams(location.search).get("v") || "",
  url: location.href,
  title:
    ($("h1 yt-formatted-string") as HTMLElement)?.textContent?.trim() ||
    document.title.replace(" - YouTube", ""),
  channel:
    ($("#channel-name a") as HTMLElement)?.textContent?.trim() || "",
  duration:
    ($("span.ytp-time-duration") as HTMLElement)?.textContent || "",
});

const hasTranscriptSegments = (): boolean =>
  $$(
    "transcript-segment-view-model, ytd-transcript-segment-renderer, .ytd-transcript-segment-renderer",
  ).length > 0;

export const openTranscript = async (): Promise<boolean> => {
  if (hasTranscriptSegments()) return true;

  const expandBtn = $("#expand") as HTMLElement | null;
  if (expandBtn) {
    expandBtn.click();
    await sleep(300);
  }

  const descBtn = $(
    "ytd-video-description-transcript-section-renderer button",
  ) as HTMLElement | null;
  if (descBtn) {
    descBtn.click();
    await sleep(1000);
  }
  if (hasTranscriptSegments()) return true;

  const menuBtn = [...$$("button")].find(
    (b) =>
      b.getAttribute("aria-label")?.toLowerCase().includes("more") ||
      b.getAttribute("aria-label")?.toLowerCase().includes("diğer"),
  ) as HTMLElement | undefined;

  if (menuBtn) {
    menuBtn.click();
    await sleep(400);
    const menuItem = [
      ...$$("tp-yt-paper-item, ytd-menu-service-item-renderer"),
    ].find((el) => /transcript|transkript/i.test(el.textContent || "")) as
      | HTMLElement
      | undefined;
    if (menuItem) {
      menuItem.click();
      await sleep(1000);
    }
  }

  return hasTranscriptSegments();
};

// Matches mm:ss or h:mm:ss anywhere in a string.
const TIMESTAMP_RE = /\b\d{1,2}:\d{2}(?::\d{2})?\b/;

// Selectors for the text node inside a segment, in order of preference.
// Layered so a single rename by YouTube doesn't take the whole thing out.
const TEXT_SELECTORS = [
  'span[role="text"]',
  ".ytAttributedStringHost",
  ".yt-core-attributed-string",
  "yt-core-attributed-string span",
  ".segment-text",
];

// Selectors for elements that should NOT count as transcript text
// (timestamps, accessibility labels) when we fall back to stripping.
const NON_TEXT_SELECTORS = [
  '[class*="Timestamp"]',
  '[class*="A11yLabel"]',
  ".segment-timestamp",
  '[aria-hidden="true"]',
];

let fallbackWarned = false;
const warnFallback = (reason: string): void => {
  if (fallbackWarned) return;
  fallbackWarned = true;
  console.warn(
    `[subscribe-userscript] transcript primary selectors missed (${reason}); ` +
      "fell back to structural extraction. YouTube DOM may have changed — " +
      "check src/transcript.ts.",
  );
};

const extractSegmentText = (seg: Element): string => {
  for (const sel of TEXT_SELECTORS) {
    const t = seg.querySelector(sel)?.textContent?.trim();
    if (t) return t;
  }
  // Structural fallback: clone the segment, drop the timestamp/a11y nodes,
  // return whatever text remains. Works as long as the segment is a
  // self-contained element with the visible time as a sibling.
  warnFallback("text selectors");
  const clone = seg.cloneNode(true) as Element;
  clone.querySelectorAll(NON_TEXT_SELECTORS.join(",")).forEach((el) =>
    el.remove(),
  );
  return (clone.textContent || "").replace(/\s+/g, " ").trim();
};

const extractSegmentTimestamp = (seg: Element): string => {
  const direct = seg.querySelector(
    '.ytwTranscriptSegmentViewModelTimestamp:not([class*="A11yLabel"]), ' +
      ".segment-timestamp",
  )?.textContent?.trim();
  if (direct && TIMESTAMP_RE.test(direct)) return direct.match(TIMESTAMP_RE)![0];

  // Regex fallback: first time-shaped substring in the segment's text.
  warnFallback("timestamp selectors");
  const match = (seg.textContent || "").match(TIMESTAMP_RE);
  return match ? match[0] : "";
};

export const getTranscriptText = (withTimestamps: boolean): string => {
  const seen = new Set<string>();
  const dedup = (line: string): boolean => {
    if (!line || seen.has(line)) return false;
    seen.add(line);
    return true;
  };

  // Try every known segment container, in order. YouTube currently ships
  // `transcript-segment-view-model`; older builds used the ytd-* renderer.
  const segments = $$(
    "transcript-segment-view-model, " +
      "ytd-transcript-segment-renderer, " +
      ".ytd-transcript-segment-renderer",
  );

  return [...segments]
    .map((seg) => {
      const text = extractSegmentText(seg);
      if (!text) return "";
      if (!withTimestamps) return text;
      const time = extractSegmentTimestamp(seg);
      if (!time) return "";
      return `[${time}] ${text}`;
    })
    .filter(dedup)
    .join("\n");
};
