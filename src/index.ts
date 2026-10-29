import { db } from "./db";
import { searchManager } from "./search";
import { CONFIG } from "./config";
import { checkRoute, setupRouter } from "./router";
import { setDashboardOpener, setCopyModalOpener, setSettingsOpener, setViewerOpener } from "./ui/navbar";
import { showDashboard } from "./ui/dashboard";
import { showCopyModal } from "./ui/copy-modal";
import { openSettings } from "./ui/settings";
import { showTranscriptViewer } from "./ui/viewer";
import { watchCaptionRequests } from "./timedtext";

// Wire up callbacks to break circular dependencies
setDashboardOpener(() => void showDashboard());
setCopyModalOpener(() => void showCopyModal());
setSettingsOpener(() => openSettings());
setViewerOpener((record, tab, lang) => showTranscriptViewer(record, { tab, lang }));

// Record the player's caption requests from the start; they carry the token
// needed for millisecond-accurate caption data.
watchCaptionRequests();

const init = async (): Promise<void> => {
  await db.ready;
  checkRoute();
  setupRouter();

  // Pre-build the search index when the browser is idle.
  const prebuildIndex = async () => {
    const items = await db.getAll();
    if (items.length > 0) await searchManager.buildIndex(items);
  };
  if (typeof requestIdleCallback !== "undefined") requestIdleCallback(() => void prebuildIndex());
  else setTimeout(() => void prebuildIndex(), 1000);

  console.log(`[SubScribe] v${CONFIG.VERSION} loaded`);
};

if (document.readyState === "complete") void init();
else window.addEventListener("load", () => void init());
