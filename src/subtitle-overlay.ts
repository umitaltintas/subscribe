import { $ } from "./dom";
import { findCueIndex } from "./segments";
import { getSettings, onSettingsChange, updateSettings } from "./settings-store";
import type { SubtitleCue, SubtitleSettings } from "./types";

export interface OverlayState {
  videoId: string;
  lang: string;
}

const OVERLAY_CSS = `
  .ytc-subtitle-overlay{position:absolute;left:50%;bottom:72px;transform:translateX(-50%);z-index:60;pointer-events:none;text-align:center;width:min(86%,1100px);transition:bottom .2s ease;display:flex;flex-direction:column;align-items:center;gap:4px}
  .html5-video-player.ytp-autohide .ytc-subtitle-overlay{bottom:28px}
  .html5-video-player.ytc-subs-active .ytp-caption-window-container{display:none!important}
  .ytc-subtitle-line{display:inline-block;max-width:100%;box-sizing:border-box;background:rgba(8,8,8,var(--ytc-sub-bg,.75));color:var(--ytc-sub-color,#ffd84d);font-size:calc(clamp(15px,2.1vw,30px) * var(--ytc-sub-scale,1));font-family:'YouTube Noto',Roboto,Arial,sans-serif;font-weight:500;padding:.15em .55em;border-radius:6px;line-height:1.4;white-space:pre-wrap;text-shadow:0 1px 2px rgba(0,0,0,.9)}
  .ytc-subtitle-line.original{color:rgba(255,255,255,.88);font-size:calc(clamp(12px,1.5vw,21px) * var(--ytc-sub-scale,1));font-weight:400}
  .ytc-subtitle-line[hidden]{display:none}
  .ytc-subtitle-osd{position:absolute;top:16px;right:16px;z-index:61;pointer-events:none;background:rgba(8,8,8,.8);color:#fff;font:500 14px Roboto,Arial,sans-serif;padding:6px 12px;border-radius:8px;opacity:0;transition:opacity .2s}
  .ytc-subtitle-osd.show{opacity:1}
`;

let state: OverlayState | null = null;
let rafId = 0;
let unsubscribeSettings: (() => void) | null = null;
let removeKeyHandler: (() => void) | null = null;

export const OFFSET_LIMIT = 5;

/** "+0,3 sn" style label for a subtitle offset. */
export const formatOffset = (sec: number): string => {
  if (Math.abs(sec) < 0.05) return "0 sn";
  const v = Math.abs(sec).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${sec > 0 ? "+" : "−"}${v} sn`;
};

const isTyping = (el: EventTarget | null): boolean => {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || node.isContentEditable;
};
const listeners = new Set<(s: OverlayState | null) => void>();

export const injectOverlayStyles = (): void => {
  if (document.getElementById("ytc-overlay-styles")) return;
  const style = document.createElement("style");
  style.id = "ytc-overlay-styles";
  style.textContent = OVERLAY_CSS;
  document.head.appendChild(style);
};

const getPlayer = (): HTMLElement | null =>
  ($("#movie_player") as HTMLElement) || ($(".html5-video-player") as HTMLElement);

export const applySubtitleSettings = (el: HTMLElement, s: SubtitleSettings): void => {
  el.style.setProperty("--ytc-sub-scale", String(s.scale / 100));
  el.style.setProperty("--ytc-sub-color", s.color === "white" ? "#ffffff" : "#ffd84d");
  el.style.setProperty("--ytc-sub-bg", String(s.background));
};

const emit = () => listeners.forEach((fn) => fn(state));

export const onOverlayChange = (fn: (s: OverlayState | null) => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const getOverlayState = (): OverlayState | null => state;

export const isOverlayActive = (): boolean => state !== null;

export const showSubtitleOverlay = (cues: SubtitleCue[], owner: OverlayState): boolean => {
  hideSubtitleOverlay(false);

  const video = $("video.html5-main-video, #movie_player video") as HTMLVideoElement | null;
  const player = getPlayer();
  if (!video || !player || !cues.length) {
    emit();
    return false;
  }

  injectOverlayStyles();

  const overlay = document.createElement("div");
  overlay.className = "ytc-subtitle-overlay";
  overlay.setAttribute("aria-live", "polite");
  const main = document.createElement("span");
  main.className = "ytc-subtitle-line";
  const original = document.createElement("span");
  original.className = "ytc-subtitle-line original";
  main.hidden = original.hidden = true;
  overlay.append(main, original);
  player.appendChild(overlay);
  player.classList.add("ytc-subs-active");

  let settings = getSettings().subtitles;
  let lastIndex = -2;
  applySubtitleSettings(overlay, settings);
  unsubscribeSettings = onSettingsChange((s) => {
    settings = s.subtitles;
    applySubtitleSettings(overlay, settings);
    lastIndex = -2; // force re-render (bilingual may have changed)
  });

  // On-screen feedback when the timing is adjusted.
  const osd = document.createElement("div");
  osd.className = "ytc-subtitle-osd";
  player.appendChild(osd);
  let osdTimer: ReturnType<typeof setTimeout> | undefined;
  const flashOsd = (text: string) => {
    osd.textContent = text;
    osd.classList.add("show");
    clearTimeout(osdTimer);
    osdTimer = setTimeout(() => osd.classList.remove("show"), 1400);
  };

  // [ / ] nudge subtitles 0.1 s earlier/later (Shift: 0.5 s); \ resets.
  // Physical key codes, so this works on Turkish Q (ğ / ü / ,) too.
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
    const step = e.shiftKey ? 0.5 : 0.1;
    let next: number;
    if (e.code === "BracketLeft") next = settings.offset - step;
    else if (e.code === "BracketRight") next = settings.offset + step;
    else if (e.code === "Backslash") next = 0;
    else return;
    e.preventDefault();
    e.stopPropagation();
    next = Math.max(-OFFSET_LIMIT, Math.min(OFFSET_LIMIT, Math.round(next * 10) / 10));
    updateSettings({ subtitles: { ...settings, offset: next } });
    flashOsd(
      next === 0
        ? "Altyazı zamanlaması sıfırlandı"
        : `Altyazı ${formatOffset(next)} ${next > 0 ? "(daha geç)" : "(daha erken)"}`,
    );
  };
  window.addEventListener("keydown", onKey, true);
  removeKeyHandler = () => {
    window.removeEventListener("keydown", onKey, true);
    clearTimeout(osdTimer);
  };

  // rAF instead of "timeupdate": timeupdate fires only ~4×/s, which makes
  // subtitles lag up to 250ms. The lookup is a binary search, so this is cheap.
  // A positive offset delays subtitles: look up an earlier moment.
  const tick = () => {
    const i = findCueIndex(cues, video.currentTime - (settings.offset || 0));
    if (i !== lastIndex) {
      lastIndex = i;
      const cue = cues[i];
      main.hidden = !cue;
      main.textContent = cue?.text ?? "";
      const showOrig = !!cue?.original && settings.bilingual;
      original.hidden = !showOrig;
      original.textContent = showOrig ? cue!.original! : "";
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  state = { ...owner };
  emit();
  return true;
};

export const hideSubtitleOverlay = (notify = true): void => {
  cancelAnimationFrame(rafId);
  rafId = 0;
  unsubscribeSettings?.();
  unsubscribeSettings = null;
  removeKeyHandler?.();
  removeKeyHandler = null;
  document.querySelectorAll(".ytc-subtitle-overlay, .ytc-subtitle-osd").forEach((el) => el.remove());
  getPlayer()?.classList.remove("ytc-subs-active");
  const wasActive = state !== null;
  state = null;
  if (notify && wasActive) emit();
};
