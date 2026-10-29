import { $ } from "./dom";
import { debounce } from "./utils";
import { CONFIG } from "./config";
import { injectNavbarButton, injectVideoButton, cleanupVideoButton, refreshVideoActions } from "./ui/navbar";
import { getOverlayState, hideSubtitleOverlay } from "./subtitle-overlay";
import { consumePendingSubtitles, currentVideoId } from "./translation-service";

let lastUrl = "";

export const checkRoute = debounce(() => {
  const url = location.href;
  if (url === lastUrl) return;
  lastUrl = url;

  // Subtitles belong to one video; drop them when a different one plays.
  const overlay = getOverlayState();
  if (overlay && overlay.videoId !== currentVideoId()) hideSubtitleOverlay();

  injectNavbarButton();

  if (location.pathname === "/watch") {
    injectVideoButton();
    void refreshVideoActions();
    void consumePendingSubtitles();
  } else {
    cleanupVideoButton();
  }
}, CONFIG.DEBOUNCE_MS);

export const setupRouter = (): void => {
  window.addEventListener("yt-navigate-finish", checkRoute);
  // Hide right away when leaving the video; waiting for the debounced
  // checkRoute would show old subtitles over the next video for a moment.
  window.addEventListener("yt-navigate-start", (e) => {
    const overlay = getOverlayState();
    if (!overlay) return;
    let target = "";
    try {
      const url = (e as CustomEvent).detail?.url as string | undefined;
      target = url ? new URL(url, location.origin).searchParams.get("v") || "" : "";
    } catch {
      /* detail can be inaccessible from a Firefox sandbox; hide to be safe */
    }
    if (target !== overlay.videoId) hideSubtitleOverlay();
  });
  window.addEventListener("popstate", checkRoute);

  // YouTube re-renders the masthead/metadata often; re-inject when our nodes
  // vanish. Throttled (not debounced): the page mutates constantly during
  // playback, so a debounce might never fire.
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      if (!$("#ytc-navbar-btn")) injectNavbarButton();
      if (location.pathname === "/watch" && !$("#ytc-video-actions")) injectVideoButton();
    }, 200);
  });
  observer.observe($("ytd-app") || document.body, { childList: true, subtree: true });
};
