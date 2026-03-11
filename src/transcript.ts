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

export const getTranscriptText = (withTimestamps: boolean): string => {
  const seen = new Set<string>();

  const dedup = (line: string): boolean => {
    if (!line || seen.has(line)) return false;
    seen.add(line);
    return true;
  };

  // Try new YouTube DOM structure first (transcript-segment-view-model)
  const newSegments = $$("transcript-segment-view-model");
  if (newSegments.length) {
    return [...newSegments]
      .map((seg) => {
        const text =
          seg.querySelector(
            ".yt-core-attributed-string, yt-core-attributed-string span",
          )?.textContent?.trim() || "";
        if (!text) return "";
        if (!withTimestamps) return text;
        const time =
          seg.querySelector(
            ".ytwTranscriptSegmentViewModelTimestamp",
          )?.textContent?.trim() || "";
        if (!time) return "";
        return `[${time}] ${text}`;
      })
      .filter(dedup)
      .join("\n");
  }

  // Fallback to old YouTube DOM structure
  const segments = $$(
    "ytd-transcript-segment-renderer, .ytd-transcript-segment-renderer",
  );
  return [...segments]
    .map((seg) => {
      const text =
        seg.querySelector(".segment-text")?.textContent?.trim() || "";
      if (!text) return "";
      if (!withTimestamps) return text;
      const time =
        seg.querySelector(".segment-timestamp")?.textContent?.trim() || "";
      if (!time) return "";
      return `[${time}] ${text}`;
    })
    .filter(dedup)
    .join("\n");
};
