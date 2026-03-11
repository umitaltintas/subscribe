import { $, $$, setHTML, injectStyles, showToast } from "../dom";
import { sleep } from "../utils";
import { icons } from "../icons";
import { db } from "../db";
import { openTranscript, getTranscriptText, getVideoInfo } from "../transcript";
import { translateTranscript, getLastTranslationUsage } from "../ai";
import { showSubtitleOverlay, hideSubtitleOverlay, isOverlayActive, parseCuesFromTranslatedText } from "../subtitle-overlay";

type ModalOpener = () => void;

let dashboardOpener: ModalOpener | null = null;
let copyModalOpener: ModalOpener | null = null;
let settingsOpener: ModalOpener | null = null;

export const setDashboardOpener = (fn: ModalOpener): void => {
  dashboardOpener = fn;
};

export const setCopyModalOpener = (fn: ModalOpener): void => {
  copyModalOpener = fn;
};

export const setSettingsOpener = (fn: ModalOpener): void => {
  settingsOpener = fn;
};

export const updateNavbarBadge = async (): Promise<void> => {
  const badge = $(".ytc-navbar-btn .ytc-badge") as HTMLElement | null;
  if (!badge) return;
  const stats = await db.getStats();
  badge.textContent = stats.total > 99 ? "99+" : String(stats.total);
  badge.style.display = stats.total > 0 ? "flex" : "none";
};

export const injectNavbarButton = (): void => {
  if ($("#ytc-navbar-btn")) return;

  const navbar =
    ($(
      "ytd-masthead #end ytd-topbar-menu-button-renderer",
    ) as HTMLElement | null)?.parentElement ||
    ($("#ytd-masthead #end #buttons") as HTMLElement | null) ||
    ($("#ytd-masthead #end") as HTMLElement | null) ||
    ($("ytd-masthead #end") as HTMLElement | null);

  if (!navbar) return;

  injectStyles();

  const btn = document.createElement("button");
  btn.id = "ytc-navbar-btn";
  btn.className = "ytc-navbar-btn";
  btn.title = "Transkript Yöneticisi";
  setHTML(
    btn,
    `
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
      <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
      <path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>
    </svg>
    <span class="ytc-badge" style="display:none">0</span>
  `,
  );

  btn.addEventListener("click", () => dashboardOpener?.());

  navbar.insertBefore(btn, navbar.firstChild);

  // Settings gear button
  if (!$("#ytc-settings-btn")) {
    const settingsBtn = document.createElement("button");
    settingsBtn.id = "ytc-settings-btn";
    settingsBtn.className = "ytc-navbar-btn";
    settingsBtn.title = "AI Çeviri Ayarları";
    setHTML(settingsBtn, icons.settings);
    settingsBtn.addEventListener("click", () => settingsOpener?.());
    navbar.insertBefore(settingsBtn, btn.nextSibling);
  }

  updateNavbarBadge();
};

export const injectVideoButton = (): void => {
  if ($("#ytc-copy-btn")) return;
  const owner = $("#owner");
  if (!owner) return;

  injectStyles();

  const btn = document.createElement("button");
  btn.id = "ytc-copy-btn";
  btn.className = "ytc-btn";
  setHTML(btn, `${icons.fileText} Transkript`);
  btn.onclick = async () => {
    const opened = await openTranscript();
    if (!opened) return showToast("Transkript bulunamadı", "error");
    await sleep(300);
    if (
      !$$(
        "transcript-segment-view-model, ytd-transcript-segment-renderer, .ytd-transcript-segment-renderer",
      ).length
    )
      return showToast("Transkript yüklenemedi", "error");
    copyModalOpener?.();
  };

  owner.appendChild(btn);

  // Translate & show subtitles button
  if (!$("#ytc-translate-video-btn")) {
    const translateBtn = document.createElement("button");
    translateBtn.id = "ytc-translate-video-btn";
    translateBtn.className = "ytc-btn";
    setHTML(translateBtn, `${icons.translate} Çevir`);

    let translating = false;
    // In-memory cache: videoId+lang → translated text
    const translationCache = new Map<string, string>();

    translateBtn.onclick = async () => {
      // If subtitles are active, toggle them off
      if (isOverlayActive()) {
        hideSubtitleOverlay();
        setHTML(translateBtn, `${icons.translate} Çevir`);
        return;
      }

      const settings = db.getAISettings();
      if (!settings?.apiKey) {
        showToast("Lütfen önce AI ayarlarını yapılandırın", "error");
        settingsOpener?.();
        return;
      }

      const videoId = getVideoInfo().id;
      const cacheKey = `${videoId}:${settings.targetLanguage}`;

      // 1. Check in-memory cache first
      const cached = translationCache.get(cacheKey);
      if (cached) {
        const cues = parseCuesFromTranslatedText(cached);
        if (cues.length > 0) {
          showSubtitleOverlay(cues);
          setHTML(translateBtn, `${icons.subtitles} Altyazı Kapat`);
          return;
        }
      }

      // 2. Check DB
      if (videoId) {
        const record = await db.get(videoId);
        const existing = record?.translations?.[settings.targetLanguage];
        if (existing) {
          translationCache.set(cacheKey, existing);
          const cues = parseCuesFromTranslatedText(existing);
          if (cues.length > 0) {
            showSubtitleOverlay(cues);
            setHTML(translateBtn, `${icons.subtitles} Altyazı Kapat`);
            return;
          }
        }
      }

      // 3. No cache — translate from scratch
      if (translating) return;
      translating = true;
      setHTML(translateBtn, `${icons.translate} Transkript alınıyor...`);

      const opened = await openTranscript();
      if (!opened) {
        translating = false;
        setHTML(translateBtn, `${icons.translate} Çevir`);
        return showToast("Transkript bulunamadı", "error");
      }

      let transcript = "";
      for (let attempt = 0; attempt < 10; attempt++) {
        await sleep(500);
        transcript = getTranscriptText(true);
        if (transcript) break;
      }

      if (!transcript) {
        translating = false;
        setHTML(translateBtn, `${icons.translate} Çevir`);
        return showToast("Transkript yüklenemedi", "error");
      }

      try {
        const result = await translateTranscript(
          transcript,
          settings.targetLanguage,
          settings,
          (percent, stage) => {
            if (stage === "analyzing") {
              setHTML(translateBtn, `${icons.translate} Analiz ediliyor...`);
            } else {
              setHTML(translateBtn, `${icons.translate} %${percent}`);
            }
          },
        );

        // Cache in memory
        translationCache.set(cacheKey, result.translated);

        // Save to DB — create record if it doesn't exist yet
        if (videoId) {
          try {
            const existing = await db.get(videoId);
            if (!existing) {
              const info = getVideoInfo();
              await db.add({
                id: videoId,
                url: info.url,
                title: info.title,
                channel: info.channel,
                transcript,
                tokens: Math.ceil(transcript.length / 4),
                words: transcript.split(/\s+/).length,
                translations: { [settings.targetLanguage]: result.translated },
                summary: result.summary,
              });
            } else {
              await db.saveTranslation(videoId, settings.targetLanguage, result.translated);
              if (result.summary) {
                await db.update(videoId, { summary: result.summary });
              }
            }
          } catch {}
        }

        const cues = parseCuesFromTranslatedText(result.translated);
        if (cues.length > 0) {
          showSubtitleOverlay(cues);
          const usage = getLastTranslationUsage();
          const tokens = usage.promptTokens + usage.completionTokens;
          const costStr = usage.totalCost > 0 ? `$${usage.totalCost.toFixed(4)}` : `~${tokens} token`;
          setHTML(translateBtn, `${icons.subtitles} Altyazı Kapat <span style="opacity:.6;font-size:11px;margin-left:4px">(${costStr})</span>`);
          showToast("Çeviri tamamlandı!");
        } else {
          showToast("Altyazı ayrıştırılamadı", "error");
          setHTML(translateBtn, `${icons.translate} Çevir`);
        }
      } catch (err) {
        showToast("Çeviri hatası: " + (err as Error).message, "error");
        setHTML(translateBtn, `${icons.translate} Çevir`);
      } finally {
        translating = false;
      }
    };

    owner.appendChild(translateBtn);
  }
};

export const cleanupVideoButton = (): void => {
  ($("#ytc-copy-btn") as HTMLElement)?.remove();
  ($("#ytc-translate-video-btn") as HTMLElement)?.remove();
  if (isOverlayActive()) hideSubtitleOverlay();
};
