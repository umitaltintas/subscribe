import { $ } from "./dom";
import { debounce } from "./utils";
import { CONFIG } from "./config";
import {
  injectNavbarButton,
  injectVideoButton,
  cleanupVideoButton,
} from "./ui/navbar";
import { hideSubtitleOverlay } from "./subtitle-overlay";

let lastUrl = "";

export const checkRoute = debounce(() => {
  const url = location.href;
  if (url === lastUrl) return;
  lastUrl = url;

  hideSubtitleOverlay();
  injectNavbarButton();

  if (url.includes("/watch")) {
    injectVideoButton();
  } else {
    cleanupVideoButton();
  }
}, CONFIG.DEBOUNCE_MS);

export const setupRouter = (): void => {
  window.addEventListener("yt-navigate-finish", checkRoute);

  const observer = new MutationObserver(() => {
    if (!$("#ytc-navbar-btn")) injectNavbarButton();
    if (location.href.includes("/watch") && !$("#ytc-copy-btn"))
      injectVideoButton();
  });

  const target = $("#content") || document.body;
  observer.observe(target, { childList: true, subtree: true });

  const masthead = $("ytd-masthead");
  if (masthead)
    observer.observe(masthead, { childList: true, subtree: true });
};
