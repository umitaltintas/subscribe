import { $, setHTML, showToast } from "../dom";
import { esc, truncate, formatDate } from "../utils";
import { icons } from "../icons";
import { CONFIG } from "../config";
import { db } from "../db";
import { translateTranscript } from "../ai";
import {
  showSubtitleOverlay,
  hideSubtitleOverlay,
  isOverlayActive,
  parseCuesFromTranslatedText,
} from "../subtitle-overlay";
import type { TranscriptRecord } from "../types";

export const showTranscriptViewer = (
  item: TranscriptRecord,
  highlightQuery = "",
): void => {
  ($(".ytc-viewer-modal") as HTMLElement)?.remove();

  let transcriptHtml = esc(item.transcript || "Transkript bulunamadı");

  if (highlightQuery) {
    const terms = highlightQuery.split(/\s+/).filter(Boolean);
    terms.forEach((term) => {
      const regex = new RegExp(`(${term})`, "gi");
      transcriptHtml = transcriptHtml.replace(regex, "<mark>$1</mark>");
    });
  }

  const existingTranslations = item.translations || {};
  const translationLangs = Object.keys(existingTranslations);
  const hasTranslationBadge = translationLangs.length > 0;

  const modal = document.createElement("div");
  modal.className = "ytc-modal-bg ytc-viewer-modal";
  setHTML(
    modal,
    `
    <div class="ytc-modal" style="width:min(700px,95vw)">
      <div class="ytc-modal-header">
        <h2>${icons.eye} ${truncate(item.title, 40)}</h2>
        <button class="ytc-modal-close">${icons.x}</button>
      </div>
      <div class="ytc-modal-body" style="padding:20px">
        <div class="ytc-meta" style="margin-bottom:16px">
          <span>${icons.tv} ${esc(item.channel)}</span>
          <span>${icons.calendar} ${formatDate(item.date)}</span>
          <span>${icons.hash} ~${item.tokens} token</span>
          <span>${icons.text} ${item.words} kelime</span>
        </div>
        ${
          item.tags?.length
            ? `
          <div class="ytc-tags" style="margin-bottom:16px">
            ${item.tags.map((t) => `<span class="ytc-tag">${esc(t)}</span>`).join("")}
          </div>
        `
            : ""
        }

        <div class="ytc-viewer-toolbar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:16px;padding:10px 14px;background:rgba(255,255,255,.03);border:1px solid var(--ytc-border);border-radius:12px">
          <select class="ytc-filter" id="ytc-viewer-lang" style="min-width:100px">
            ${CONFIG.AI.AVAILABLE_LANGUAGES.map(
              (lang) =>
                `<option value="${esc(lang.code)}" ${lang.code === CONFIG.AI.DEFAULT_TARGET_LANG ? "selected" : ""}>${esc(lang.name)}</option>`,
            ).join("")}
          </select>
          <button class="ytc-btn small" data-action="translate" id="ytc-translate-btn">${icons.translate} Çevir</button>
          <button class="ytc-btn small secondary" data-action="toggle-subs" id="ytc-subs-btn">${icons.subtitles} Altyazı Göster</button>
          ${hasTranslationBadge ? `<span class="ytc-tag" style="margin-left:auto">${icons.check} Çeviri mevcut: ${translationLangs.map((c) => c.toUpperCase()).join(", ")}</span>` : ""}
        </div>

        <div class="ytc-preview" id="ytc-viewer-transcript">${transcriptHtml}</div>
      </div>
      <div class="ytc-modal-footer">
        <button class="ytc-btn secondary" data-action="goto">${icons.play} Videoya Git</button>
        <button class="ytc-btn" data-action="copy">${icons.clipboard} Kopyala</button>
      </div>
    </div>
  `,
  );

  document.body.appendChild(modal);

  let currentRecord = item;
  let subtitlesShown = false;

  const updateTranslationBadge = () => {
    const toolbar = modal.querySelector(".ytc-viewer-toolbar") as HTMLElement;
    if (!toolbar) return;
    const existingBadge = toolbar.querySelector(".ytc-tag");
    if (existingBadge) existingBadge.remove();

    const langs = Object.keys(currentRecord.translations || {});
    if (langs.length > 0) {
      const badge = document.createElement("span");
      badge.className = "ytc-tag";
      badge.style.marginLeft = "auto";
      setHTML(badge, `${icons.check} Çeviri mevcut: ${langs.map((c) => c.toUpperCase()).join(", ")}`);
      toolbar.appendChild(badge);
    }
  };

  modal.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;
    if (target === modal || target.closest(".ytc-modal-close")) modal.remove();

    if (target.closest('[data-action="copy"]')) {
      GM_setClipboard(currentRecord.transcript);
      showToast("Kopyalandı!");
    }

    if (target.closest('[data-action="goto"]')) {
      window.open(currentRecord.url, "_blank");
    }

    if (target.closest('[data-action="translate"]')) {
      const langSelect = modal.querySelector("#ytc-viewer-lang") as HTMLSelectElement;
      const langCode = langSelect.value;
      const translateBtn = modal.querySelector("#ytc-translate-btn") as HTMLButtonElement;

      // Check if translation already exists
      if (currentRecord.translations?.[langCode]) {
        const transcriptEl = modal.querySelector("#ytc-viewer-transcript") as HTMLElement;
        setHTML(transcriptEl, esc(currentRecord.translations[langCode]));
        showToast("Mevcut çeviri gösteriliyor");
        return;
      }

      const settings = db.getAISettings();
      if (!settings?.apiKey) {
        showToast("Lütfen önce AI ayarlarını yapılandırın", "error");
        return;
      }

      translateBtn.disabled = true;
      const origText = translateBtn.innerHTML;

      try {
        const result = await translateTranscript(
          currentRecord.transcript,
          langCode,
          settings,
          (percent, stage) => {
            if (stage === "analyzing") {
              setHTML(translateBtn, `${icons.translate} Analiz ediliyor...`);
            } else {
              setHTML(translateBtn, `${icons.translate} Çevriliyor... %${percent}`);
            }
          },
        );

        await db.saveTranslation(currentRecord.id, langCode, result.translated);
        if (result.summary) {
          await db.update(currentRecord.id, { summary: result.summary });
        }

        // Update local record
        currentRecord = { ...currentRecord, translations: { ...currentRecord.translations, [langCode]: result.translated }, summary: result.summary };

        // Show translated text
        const transcriptEl = modal.querySelector("#ytc-viewer-transcript") as HTMLElement;
        setHTML(transcriptEl, esc(result.translated));

        updateTranslationBadge();
        showToast("Çeviri tamamlandı!");
      } catch (err) {
        showToast("Çeviri hatası: " + (err as Error).message, "error");
      } finally {
        translateBtn.disabled = false;
        setHTML(translateBtn, origText);
      }
    }

    if (target.closest('[data-action="toggle-subs"]')) {
      const subsBtn = modal.querySelector("#ytc-subs-btn") as HTMLButtonElement;
      const langSelect = modal.querySelector("#ytc-viewer-lang") as HTMLSelectElement;
      const langCode = langSelect.value;

      if (subtitlesShown || isOverlayActive()) {
        hideSubtitleOverlay();
        subtitlesShown = false;
        setHTML(subsBtn, `${icons.subtitles} Altyazı Göster`);
        return;
      }

      const translatedText = currentRecord.translations?.[langCode];
      if (!translatedText) {
        showToast("Önce çeviri yapın", "error");
        return;
      }

      const cues = parseCuesFromTranslatedText(translatedText);
      if (cues.length === 0) {
        showToast("Altyazı ayrıştırılamadı", "error");
        return;
      }

      showSubtitleOverlay(cues);
      subtitlesShown = true;
      setHTML(subsBtn, `${icons.subtitles} Altyazı Gizle`);
    }
  });

  document.addEventListener("keydown", function handler(e) {
    if (e.key === "Escape") {
      modal.remove();
      document.removeEventListener("keydown", handler);
    }
  });
};
