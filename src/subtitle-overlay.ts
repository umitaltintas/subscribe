import { $ } from "./dom";
import type { SubtitleCue } from "./types";

const OVERLAY_CSS = `
  .ytc-subtitle-overlay{position:absolute;bottom:60px;left:50%;transform:translateX(-50%);z-index:60;pointer-events:none;text-align:center;width:80%;transition:opacity .15s}
  .ytc-subtitle-text{display:inline;background:rgba(0,0,0,.8);color:#ffd700;font-size:clamp(16px, 2.5vw, 32px);font-family:'YouTube Noto',Roboto,Arial,sans-serif;padding:0.2em 0.6em;border-radius:4px;line-height:1.6;white-space:pre-wrap;text-shadow:1px 1px 2px rgba(0,0,0,.8)}
`;

let active = false;
let currentListener: ((e: Event) => void) | null = null;
let styleInjected = false;

const injectOverlayStyles = (): void => {
  if (styleInjected) return;
  styleInjected = true;
  document.head.appendChild(
    Object.assign(document.createElement("style"), { textContent: OVERLAY_CSS }),
  );
};

const parseTimestamp = (ts: string): number => {
  const parts = ts.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
};

export const parseCuesFromTranslatedText = (text: string): SubtitleCue[] => {
  // First, normalize: split inline timestamps onto their own lines
  // Handles cases where AI merges lines like "text [0:05] more text"
  const normalized = text.replace(/\s*\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g, "\n[$1]");
  const lines = normalized.split("\n").filter(Boolean);
  const raw: { startTime: number; text: string }[] = [];

  for (const line of lines) {
    const match = line.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.+)/);
    if (!match) continue;
    const startTime = parseTimestamp(match[1]);
    const lineText = match[2].trim();
    // Deduplicate: skip if same timestamp and text as previous entry
    const prev = raw[raw.length - 1];
    if (prev && prev.startTime === startTime && prev.text === lineText) continue;
    // Skip if same timestamp but empty/shorter text (keep the first meaningful one)
    if (prev && prev.startTime === startTime) continue;
    raw.push({ startTime, text: lineText });
  }

  const MIN_CUE_DURATION = 1;
  return raw.map((entry, i) => {
    const nextStart = i < raw.length - 1 ? raw[i + 1].startTime : entry.startTime + 5;
    // Ensure minimum duration even if next cue has same or very close timestamp
    const endTime = Math.max(nextStart, entry.startTime + MIN_CUE_DURATION);
    return { startTime: entry.startTime, endTime, text: entry.text };
  });
};

export const showSubtitleOverlay = (cues: SubtitleCue[]): void => {
  hideSubtitleOverlay();

  const video = $("video") as HTMLVideoElement | null;
  const player =
    ($("#movie_player") as HTMLElement) ||
    ($(".html5-video-player") as HTMLElement);
  if (!video || !player) return;

  injectOverlayStyles();

  const overlay = document.createElement("div");
  overlay.className = "ytc-subtitle-overlay";

  const textEl = document.createElement("span");
  textEl.className = "ytc-subtitle-text";
  textEl.style.visibility = "hidden";
  overlay.appendChild(textEl);
  player.appendChild(overlay);

  const listener = (): void => {
    const t = video.currentTime;
    const cue = cues.find((c) => t >= c.startTime && t < c.endTime);
    if (cue) {
      textEl.textContent = cue.text;
      textEl.style.visibility = "visible";
    } else {
      textEl.style.visibility = "hidden";
    }
  };

  video.addEventListener("timeupdate", listener);
  currentListener = listener;
  active = true;
};

export const hideSubtitleOverlay = (): void => {
  if (currentListener) {
    const video = $("video") as HTMLVideoElement | null;
    video?.removeEventListener("timeupdate", currentListener);
    currentListener = null;
  }
  $(".ytc-subtitle-overlay")?.remove();
  active = false;
};

export const isOverlayActive = (): boolean => active;
