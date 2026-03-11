import { db } from "./db";
import { searchManager } from "./search";
import { checkRoute, setupRouter } from "./router";
import { setDashboardOpener, setCopyModalOpener, setSettingsOpener } from "./ui/navbar";
import { showDashboard } from "./ui/dashboard";
import { showCopyModal } from "./ui/copy-modal";
import { openSettings } from "./ui/settings";

// Wire up callbacks to break circular dependencies
setDashboardOpener(() => showDashboard());
setCopyModalOpener(() => showCopyModal());
setSettingsOpener(() => openSettings());

const init = async (): Promise<void> => {
  await db.ready;
  checkRoute();

  // Pre-build index in background
  const prebuildIndex = async () => {
    const items = await db.getAll();
    if (items.length > 0) {
      await searchManager.buildIndex(items);
      console.log("[YTC] Index pre-built");
    }
  };

  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(prebuildIndex);
  } else {
    setTimeout(prebuildIndex, 1000);
  }

  setupRouter();
  console.log("[YTC] YouTube Transcript Pro v5.0 loaded");
};

if (document.readyState === "complete") {
  init();
} else {
  window.addEventListener("load", init);
}
