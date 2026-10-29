import { $, setHTML, injectStyles, showToast } from "../dom";
import { esc } from "../utils";
import { icons } from "../icons";
import { db } from "../db";
import { LANGUAGES, getLanguage } from "../config";
import { getSettings, updateSettings, onSettingsChange } from "../settings-store";
import { openTranscript, getVideoInfo } from "../transcript";
import { formatCost } from "../openrouter";
import { isAbortError } from "../http";
import { getOverlayState, onOverlayChange, hideSubtitleOverlay } from "../subtitle-overlay";
import {
  startTranslation,
  getJob,
  onJobEvent,
  showSubtitles,
  hideSubtitles,
  currentVideoId,
  summarizeVideo,
  isSummarizing,
} from "../translation-service";
import { openMenu } from "./menu";
import { showSummaryOptionsPopover } from "./summary-options";
import { requireApiKey } from "./require-key";
import type { TranscriptRecord } from "../types";

type ModalOpener = () => void;
type ViewerOpener = (record: TranscriptRecord, tab: "original" | "translation" | "summary", lang?: string) => void;

let dashboardOpener: ModalOpener | null = null;
let copyModalOpener: ModalOpener | null = null;
let settingsOpener: ModalOpener | null = null;
let viewerOpener: ViewerOpener | null = null;

export const setDashboardOpener = (fn: ModalOpener): void => void (dashboardOpener = fn);
export const setCopyModalOpener = (fn: ModalOpener): void => void (copyModalOpener = fn);
export const setSettingsOpener = (fn: ModalOpener): void => void (settingsOpener = fn);
export const setViewerOpener = (fn: ViewerOpener): void => void (viewerOpener = fn);

export const updateNavbarBadge = async (): Promise<void> => {
  const badge = $("#ytc-navbar-btn .ytc-badge") as HTMLElement | null;
  if (!badge) return;
  const stats = await db.getStats();
  badge.textContent = stats.total > 99 ? "99+" : String(stats.total);
  badge.style.display = stats.total > 0 ? "flex" : "none";
};

const LOGO = `<svg viewBox="124 112 288 288" width="24" height="24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs><linearGradient id="ytcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#FF3B30"/><stop offset="50%" stop-color="#FF2D55"/><stop offset="100%" stop-color="#AF52DE"/>
  </linearGradient></defs>
  <rect x="160" y="128" width="56" height="256" rx="28" fill="url(#ytcGrad)"/>
  <rect x="240" y="176" width="56" height="160" rx="28" fill="url(#ytcGrad)"/>
  <rect x="320" y="224" width="56" height="64" rx="28" fill="url(#ytcGrad)"/>
</svg>`;

export const injectNavbarButton = (): void => {
  if ($("#ytc-navbar-btn")) return;

  const navbar =
    ($("ytd-masthead #end ytd-topbar-menu-button-renderer") as HTMLElement | null)?.parentElement ||
    ($("#ytd-masthead #end #buttons") as HTMLElement | null) ||
    ($("#ytd-masthead #end") as HTMLElement | null) ||
    ($("ytd-masthead #end") as HTMLElement | null);
  if (!navbar) return;

  injectStyles();

  const btn = document.createElement("button");
  btn.id = "ytc-navbar-btn";
  btn.className = "ytc-navbar-btn";
  btn.title = "SubScribe — transkript kütüphanesi";
  btn.setAttribute("aria-label", "SubScribe kütüphanesini aç");
  setHTML(btn, `${LOGO}<span class="ytc-badge" style="display:none">0</span>`);
  btn.addEventListener("click", () => dashboardOpener?.());
  navbar.insertBefore(btn, navbar.firstChild);

  if (!$("#ytc-settings-btn")) {
    const settingsBtn = document.createElement("button");
    settingsBtn.id = "ytc-settings-btn";
    settingsBtn.className = "ytc-navbar-btn";
    settingsBtn.title = "SubScribe ayarları";
    settingsBtn.setAttribute("aria-label", "SubScribe ayarları");
    setHTML(settingsBtn, icons.settings);
    settingsBtn.addEventListener("click", () => settingsOpener?.());
    navbar.insertBefore(settingsBtn, btn.nextSibling);
  }

  void updateNavbarBadge();
};

// ---------------------------------------------------------------------------
// Video page actions
// ---------------------------------------------------------------------------

let currentRecord: TranscriptRecord | undefined;
let refreshSeq = 0;
let globalListenersBound = false;

const group = () => $("#ytc-video-actions") as HTMLElement | null;

/** Record of the open video; never returns a previous video's record. */
const recordFor = async (videoId: string): Promise<TranscriptRecord | undefined> => {
  if (currentRecord?.id === videoId) return currentRecord;
  currentRecord = await db.get(videoId);
  return currentRecord;
};

/** Re-derives every button label from the real state (job, overlay, DB). */
export const refreshVideoActions = async (): Promise<void> => {
  const root = group();
  if (!root) return;
  const videoId = currentVideoId();
  const seq = ++refreshSeq;
  const record = videoId ? await db.get(videoId) : undefined;
  if (seq !== refreshSeq) return; // a newer refresh superseded this one
  currentRecord = record;

  const lang = getSettings().targetLanguage;
  const langLabel = lang.toUpperCase();
  const job = videoId ? getJob(videoId, lang) : undefined;
  const overlay = getOverlayState();
  const subsOn = !!overlay && overlay.videoId === videoId;
  const saved = !!record?.translations?.[lang];

  const tBtn = root.querySelector('[data-act="translate"]') as HTMLButtonElement;
  tBtn.classList.toggle("running", !!job);
  tBtn.classList.toggle("active", subsOn && !job);
  if (job) {
    const p = job.progress;
    const pct = p?.total ? Math.round((p.done / p.total) * 100) : 0;
    tBtn.style.setProperty("--p", `${pct}%`);
    const label = !p?.total || p.stage === "analyzing" ? "Analiz…" : `%${pct}`;
    setHTML(tBtn, `<span class="ytc-spinner inline"></span> ${label} <span class="ytc-pill-sub">· İptal</span>`);
    tBtn.title = "Çeviriyi iptal et";
  } else if (subsOn) {
    setHTML(tBtn, `${icons.subtitles} Altyazı açık`);
    tBtn.title = "Altyazıyı kapat";
  } else if (saved) {
    setHTML(tBtn, `${icons.subtitles} Altyazıyı aç`);
    tBtn.title = `${getLanguage(lang).name} altyazıyı göster`;
  } else {
    setHTML(tBtn, `${icons.translate} Çevir`);
    tBtn.title = `${getLanguage(lang).name} diline çevir ve altyazı olarak göster`;
  }
  tBtn.setAttribute("aria-pressed", String(subsOn));
  (root.querySelector('[data-act="translate-menu"] .ytc-lang-code') as HTMLElement).textContent = langLabel;

  const sBtn = root.querySelector('[data-act="summarize"]') as HTMLButtonElement;
  if (videoId && isSummarizing(videoId)) {
    setHTML(sBtn, `<span class="ytc-spinner inline"></span> Özetleniyor…`);
    sBtn.disabled = true;
  } else {
    sBtn.disabled = false;
    setHTML(sBtn, `${icons.sparkles} ${record?.userSummary ? "Özet" : "Özetle"}`);
    sBtn.title = record?.userSummary ? "Kayıtlı özeti görüntüle" : "Yapay zekâ ile özetle";
  }
};

const onTranslateClick = async () => {
  const videoId = currentVideoId();
  if (!videoId) return;
  const lang = getSettings().targetLanguage;

  const job = getJob(videoId, lang);
  if (job) return job.cancel();

  const overlay = getOverlayState();
  if (overlay?.videoId === videoId) return hideSubtitles();

  if ((await recordFor(videoId))?.translations?.[lang]) {
    try {
      await showSubtitles(videoId, lang);
    } catch (err) {
      showToast((err as Error).message, "error");
    }
    return;
  }

  if (!requireApiKey()) return;
  // Capture metadata now: if the user navigates away, the job still saves
  // the right title/channel.
  const info = getVideoInfo();
  const started = startTranslation(videoId, lang, { info });
  void refreshVideoActions();
  try {
    await started.promise;
    if (currentVideoId() === videoId) await showSubtitles(videoId, lang);
  } catch {
    /* reported through job events */
  }
};

const openLanguageMenu = async (anchor: HTMLElement) => {
  const videoId = currentVideoId();
  if (videoId) await recordFor(videoId);
  const s = getSettings();
  const saved = new Set(Object.keys(currentRecord?.translations ?? {}));
  const hasCurrent = saved.has(s.targetLanguage);
  const running = videoId ? getJob(videoId, s.targetLanguage) : undefined;

  openMenu(anchor, [
    { heading: "Çeviri dili" },
    ...LANGUAGES.map((l) => ({
      label: esc(l.name),
      hint: videoId && getJob(videoId, l.code) ? "çevriliyor…" : saved.has(l.code) ? "kayıtlı" : "",
      checked: l.code === s.targetLanguage,
      onSelect: async () => {
        updateSettings({ targetLanguage: l.code });
        const overlay = getOverlayState();
        if (overlay?.videoId === videoId && videoId) {
          if (saved.has(l.code)) await showSubtitles(videoId, l.code).catch(() => {});
          else hideSubtitles();
        }
        void refreshVideoActions();
      },
    })),
    "separator",
    {
      label: "Çeviriyi metin olarak görüntüle",
      icon: icons.eye,
      disabled: !hasCurrent || !currentRecord,
      onSelect: () => currentRecord && viewerOpener?.(currentRecord, "translation", s.targetLanguage),
    },
    {
      label: "Yeniden çevir",
      icon: icons.refreshCw,
      disabled: !hasCurrent || !!running,
      onSelect: () => {
        if (!videoId || !requireApiKey()) return;
        startTranslation(videoId, s.targetLanguage, { force: true, info: getVideoInfo() });
        void refreshVideoActions();
      },
    },
    { label: "Altyazı görünümü ve ayarlar", icon: icons.settings, onSelect: () => settingsOpener?.() },
  ]);
};

const onSummarizeClick = async () => {
  const videoId = currentVideoId();
  if (!videoId) return;
  const record = await recordFor(videoId);
  if (record?.userSummary) return viewerOpener?.(record, "summary");
  if (!requireApiKey()) return;

  const options = await showSummaryOptionsPopover();
  if (!options) return;
  const info = getVideoInfo();
  const p = summarizeVideo(videoId, options, { info });
  void refreshVideoActions();
  try {
    await p;
    const saved = await db.get(videoId);
    if (saved && currentVideoId() === videoId) viewerOpener?.(saved, "summary");
    else showToast("Özet hazır — kütüphanede görüntüleyebilirsiniz");
  } catch (err) {
    if (!isAbortError(err)) showToast(`Özet oluşturulamadı: ${(err as Error).message}`, "error");
  } finally {
    void refreshVideoActions();
    void updateNavbarBadge();
  }
};

const onTranscriptClick = async (btn: HTMLButtonElement) => {
  btn.disabled = true;
  try {
    const opened = await openTranscript();
    if (!opened) return showToast("Bu videoda transkript bulunamadı", "error");
    copyModalOpener?.();
  } finally {
    btn.disabled = false;
  }
};

const bindGlobalListeners = () => {
  if (globalListenersBound) return;
  globalListenersBound = true;

  onJobEvent((videoId, lang, ev) => {
    if (videoId === currentVideoId()) void refreshVideoActions();
    if (ev.type === "done" && ev.usage.promptTokens && !document.querySelector(".ytc-viewer-modal")) {
      showToast(`${getLanguage(lang).name} çeviri hazır · ${formatCost(ev.usage)}`);
      void updateNavbarBadge();
    } else if (ev.type === "error" && !document.querySelector(".ytc-viewer-modal")) {
      showToast(`Çeviri başarısız: ${ev.error.message}`, "error", undefined, {
        label: "Tekrar dene",
        onClick: () => {
          if (currentVideoId() === videoId && requireApiKey()) startTranslation(videoId, lang, { info: getVideoInfo() });
        },
      });
    } else if (ev.type === "cancelled") {
      showToast("Çeviri iptal edildi", "info");
    }
  });
  onOverlayChange(() => void refreshVideoActions());
  onSettingsChange(() => void refreshVideoActions());
};

export const injectVideoButton = (): void => {
  if (group()) return;
  const owner = $("ytd-watch-metadata #owner") || $("#owner");
  if (!owner) return;

  injectStyles();
  bindGlobalListeners();

  const root = document.createElement("div");
  root.id = "ytc-video-actions";
  root.className = "ytc-video-actions";
  setHTML(
    root,
    `<button class="ytc-pill" data-act="transcript" title="Transkripti kopyala ve kaydet">${icons.fileText} Transkript</button>
     <div class="ytc-split" role="group" aria-label="Çeviri">
       <button class="ytc-pill" data-act="translate">${icons.translate} Çevir</button>
       <button class="ytc-pill caret" data-act="translate-menu" aria-haspopup="menu" aria-expanded="false" aria-label="Çeviri dili ve seçenekler" title="Çeviri dili ve seçenekler"><span class="ytc-lang-code">TR</span> ▾</button>
     </div>
     <button class="ytc-pill" data-act="summarize">${icons.sparkles} Özetle</button>`,
  );

  root.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-act]");
    if (!btn || btn.disabled) return;
    switch (btn.dataset.act) {
      case "transcript":
        return void onTranscriptClick(btn);
      case "translate":
        return void onTranslateClick();
      case "translate-menu":
        return void openLanguageMenu(btn);
      case "summarize":
        return void onSummarizeClick();
    }
  });
  // Keep YouTube's keyboard shortcuts from firing while using our buttons.
  root.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") e.stopPropagation();
  });

  owner.appendChild(root);
  void refreshVideoActions();
};

export const cleanupVideoButton = (): void => {
  group()?.remove();
  currentRecord = undefined;
  if (getOverlayState()) hideSubtitleOverlay();
};
