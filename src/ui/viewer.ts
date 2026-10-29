import { setHTML, showToast } from "../dom";
import { esc, formatDate, mdToHtml, highlight, downloadText, safeFilename } from "../utils";
import { icons } from "../icons";
import { LANGUAGES, getLanguage } from "../config";
import { db } from "../db";
import { getSettings } from "../settings-store";
import { formatCost } from "../openrouter";
import { isAbortError } from "../http";
import { parseCues, parseTimestamp, cuesToSrt, cuesToVtt, formatTimestamp } from "../segments";
import { getOverlayState, onOverlayChange } from "../subtitle-overlay";
import {
  startTranslation,
  getJob,
  onJobEvent,
  showSubtitles,
  hideSubtitles,
  getTimedText,
  getSourceSegments,
  currentVideoId,
  summarizeVideo,
  isSummarizing,
} from "../translation-service";
import { openModal } from "./modal";
import { openMenu } from "./menu";
import { showSummaryOptionsPopover } from "./summary-options";
import { requireApiKey } from "./require-key";
import type { TranscriptRecord, SubtitleCue } from "../types";
import type { TranslateProgress } from "../ai";

export type ViewerTab = "original" | "translation" | "summary";

export interface ViewerOptions {
  query?: string;
  tab?: ViewerTab;
  lang?: string;
}

const TS_IN_TEXT = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;

/** Turns [m:ss] references in rendered summary HTML into seek buttons. */
const linkTimestamps = (html: string): string =>
  html.replace(TS_IN_TEXT, (_, ts) => `<button class="ytc-ts" data-seek="${parseTimestamp(ts)}">${ts}</button>`);

const progressHtml = (p: TranslateProgress | null): string => {
  const total = p?.total ?? 0;
  const pct = total ? Math.round((p!.done / total) * 100) : 0;
  const label =
    !p || p.stage === "analyzing" || !total
      ? "Video analiz ediliyor…"
      : `Çevriliyor · ${p.done}/${total} parça`;
  const indeterminate = !p || p.stage === "analyzing" || !total;
  return `<div class="ytc-progress" role="status">
    <div class="ytc-progress-main">
      <div class="ytc-progress-label"><strong>${label}</strong><span>${indeterminate ? "" : `%${pct}`}</span></div>
      <div class="ytc-progress-track"><div class="ytc-progress-bar ${indeterminate ? "indeterminate" : ""}" style="width:${pct}%"></div></div>
    </div>
    <button class="ytc-btn small secondary" data-action="cancel-job">İptal</button>
  </div>`;
};

export const showTranscriptViewer = (initial: TranscriptRecord, options: ViewerOptions | string = {}): void => {
  const opts: ViewerOptions = typeof options === "string" ? { query: options } : options;
  let record = initial;
  const settings = getSettings();
  const existingLangs = () => Object.keys(record.translations ?? {});

  let tab: ViewerTab = opts.tab ?? "original";
  let lang =
    opts.lang ??
    (record.translations?.[settings.targetLanguage] ? settings.targetLanguage : existingLangs()[0] ?? settings.targetLanguage);
  let query = opts.query ?? "";
  let showOriginal = settings.subtitles.bilingual;
  let summarizing = isSummarizing(record.id);
  const isCurrent = () => currentVideoId() === record.id;

  const m = openModal({
    id: "ytc-viewer-modal",
    width: 820,
    bodyClass: "ytc-split-body",
    title: `${icons.fileText}<span class="ytc-modal-title-text"></span>`,
    body: `
      <div class="ytc-viewer-head"><div class="ytc-meta" id="ytc-v-meta"></div></div>
      <div class="ytc-tabs" role="tablist">
        <button class="ytc-tab" role="tab" data-tab="original">${icons.text} Orijinal</button>
        <button class="ytc-tab" role="tab" data-tab="translation">${icons.translate} Çeviri <span class="ytc-count" id="ytc-v-count"></span></button>
        <button class="ytc-tab" role="tab" data-tab="summary">${icons.sparkles} Özet</button>
      </div>
      <div class="ytc-viewer-bar" id="ytc-v-bar"></div>
      <div class="ytc-viewer-content ytc-scroll" id="ytc-v-content" role="tabpanel"></div>`,
    footer: `
      <button class="ytc-btn secondary" data-action="goto">${icons.play} ${isCurrent() ? "Videoya dön" : "Videoyu aç"}</button>
      <span class="ytc-footer-spacer"></span>
      <button class="ytc-btn secondary" data-action="export" hidden>${icons.download} Altyazı indir</button>
      <button class="ytc-btn" data-action="copy">${icons.clipboard} Kopyala</button>`,
    onClose: () => {
      unsubJob();
      unsubOverlay();
      clearInterval(followTimer);
    },
  });

  const q = <T extends HTMLElement>(sel: string) => m.dialog.querySelector(sel) as T;
  q<HTMLElement>(".ytc-modal-title-text").textContent = record.title || "Transkript";
  q<HTMLElement>(".ytc-modal-title-text").title = record.title || "";
  const bar = q<HTMLElement>("#ytc-v-bar");
  const content = q<HTMLElement>("#ytc-v-content");

  const renderMeta = () => {
    setHTML(
      q<HTMLElement>("#ytc-v-meta"),
      `<span>${icons.tv} ${esc(record.channel || "Bilinmiyor")}</span>
       <span>${icons.calendar} ${formatDate(record.date)}</span>
       <span>${icons.text} ${(record.words ?? 0).toLocaleString("tr-TR")} kelime</span>
       <span>${icons.hash} ~${(record.tokens ?? 0).toLocaleString("tr-TR")} token</span>`,
    );
    const n = existingLangs().length;
    q<HTMLElement>("#ytc-v-count").textContent = n ? String(n) : "";
  };

  // ---- Line rendering -----------------------------------------------------

  const lineHtml = (start: number | null, text: string, orig?: string) => {
    const ts =
      start === null
        ? ""
        : `<button class="ytc-ts" data-seek="${start}" title="${formatTimestamp(start)} anına git">${formatTimestamp(start)}</button>`;
    const origHtml = orig && showOriginal ? `<span class="ytc-line-orig">${highlight(orig, query)}</span>` : "";
    return `<div class="ytc-line" ${start !== null ? `data-start="${start}"` : ""}>${ts}<div class="ytc-line-text">${highlight(text, query)}${origHtml}</div></div>`;
  };

  const renderOriginal = () => {
    const segs = getSourceSegments(record);
    if (segs.length) {
      setHTML(content, `<div class="ytc-lines">${segs.map((s) => lineHtml(s.start, s.text)).join("")}</div>`);
    } else {
      setHTML(content, `<div class="ytc-plain">${highlight(record.transcript || "Transkript bulunamadı", query)}</div>`);
    }
  };

  let currentCues: SubtitleCue[] = [];

  const renderTranslation = () => {
    const job = getJob(record.id, lang);
    const translated = record.translations?.[lang];
    const langName = getLanguage(lang).name;
    let html = "";

    if (job) html += progressHtml(job.progress);

    if (translated) {
      currentCues = parseCues(translated, getSourceSegments(record));
      if (record.summary && lang === settings.targetLanguage) {
        html += `<details class="ytc-callout"><summary><strong>Video bağlamı</strong> (çeviri için oluşturuldu)</summary><div style="margin-top:6px">${esc(record.summary)}</div></details>`;
      }
      html += currentCues.length
        ? `<div class="ytc-lines">${currentCues.map((c) => lineHtml(c.startTime, c.text, c.original)).join("")}</div>`
        : `<div class="ytc-plain">${highlight(translated, query)}</div>`;
    } else if (!job) {
      currentCues = [];
      const canTranslate = !!getTimedText(record) || isCurrent();
      html += `<div class="ytc-empty">
        <div class="ytc-empty-icon">${icons.translate}</div>
        <div class="ytc-empty-text">${esc(langName)} çevirisi henüz yok</div>
        <div class="ytc-empty-hint">${
          canTranslate
            ? "Cümleler bütün kalacak şekilde çevrilir ve altyazılar konuşmayla senkron gösterilir."
            : "Bu kayıt zaman damgasız kaydedilmiş. Çevirmek için videoyu açıp oradaki “Çevir” düğmesini kullanın."
        }</div>
        ${
          canTranslate
            ? `<button class="ytc-btn primary" data-action="translate">${icons.translate} ${esc(langName)} diline çevir</button>`
            : `<button class="ytc-btn secondary" data-action="goto">${icons.play} Videoyu aç</button>`
        }
      </div>`;
    }
    setHTML(content, html);
  };

  const renderSummary = () => {
    if (summarizing) {
      setHTML(content, `<div class="ytc-loading"><div class="ytc-spinner"></div>Özet hazırlanıyor…</div>`);
    } else if (record.userSummary) {
      setHTML(content, `<div class="ytc-md">${linkTimestamps(mdToHtml(record.userSummary))}</div>`);
    } else {
      setHTML(
        content,
        `<div class="ytc-empty">
          <div class="ytc-empty-icon">${icons.sparkles}</div>
          <div class="ytc-empty-text">Henüz özet yok</div>
          <div class="ytc-empty-hint">Format, ton, uzunluk ve dil seçerek özet oluşturun. Önemli anlar tıklanabilir zaman damgalarıyla işaretlenir.</div>
          <button class="ytc-btn primary" data-action="summarize">${icons.sparkles} Özet oluştur</button>
        </div>`,
      );
    }
  };

  // ---- Toolbar --------------------------------------------------------------

  const searchHtml = () =>
    `<input type="search" class="ytc-search" id="ytc-v-search" placeholder="Metinde ara…" aria-label="Metinde ara" value="${esc(query)}">`;

  const renderBar = () => {
    let html = "";
    if (tab === "translation") {
      const has = !!record.translations?.[lang];
      const running = !!getJob(record.id, lang);
      const overlay = getOverlayState();
      const subsOn = overlay?.videoId === record.id && overlay.lang === lang;
      html += `<button class="ytc-btn small secondary" data-action="pick-lang" aria-haspopup="menu" title="Dil seç">${icons.translate} ${esc(getLanguage(lang).name)} ▾</button>`;
      if (has) {
        html += `<button class="ytc-btn small ${subsOn ? "" : "primary"}" data-action="toggle-subs">${icons.subtitles} ${
          subsOn ? "Altyazıyı kapat" : isCurrent() ? "Videoda göster" : "Videoda aç"
        }</button>`;
        html += `<label class="ytc-check" style="font-size:12.5px;margin-left:4px"><input type="checkbox" id="ytc-v-orig" ${showOriginal ? "checked" : ""}> Orijinali göster</label>`;
        if (!running) {
          html += `<button class="ytc-btn small ghost" data-action="retranslate" title="Mevcut çeviriyi yeniden oluştur">${icons.refreshCw} Yeniden çevir</button>`;
        }
      }
      html += `<span class="ytc-footer-spacer"></span>${has ? searchHtml() : ""}`;
    } else if (tab === "summary") {
      if (record.userSummary && !summarizing) {
        html += `<button class="ytc-btn small secondary" data-action="summarize">${icons.refreshCw} Yeniden özetle</button>`;
      }
    } else {
      if (!getTimedText(record)) {
        html += `<span class="ytc-help" style="margin:0">Zaman damgasız kayıt</span>`;
      }
      html += `<span class="ytc-footer-spacer"></span>${searchHtml()}`;
    }
    bar.hidden = !html;
    setHTML(bar, html);
  };

  const render = () => {
    m.dialog.querySelectorAll<HTMLElement>(".ytc-tab").forEach((t) => {
      const active = t.dataset.tab === tab;
      t.classList.toggle("active", active);
      t.setAttribute("aria-selected", String(active));
      t.tabIndex = active ? 0 : -1;
    });
    renderMeta();
    renderBar();
    if (tab === "original") renderOriginal();
    else if (tab === "translation") renderTranslation();
    else renderSummary();
    const exportBtn = q<HTMLElement>('[data-action="export"]');
    exportBtn.hidden = !(tab === "translation" && currentCues.length);
    lastFollowed = -1;
  };

  const reload = async () => {
    record = (await db.get(record.id)) ?? record;
    if (m.isOpen()) render();
  };

  // ---- Actions --------------------------------------------------------------

  const translate = (force: boolean) => {
    if (!requireApiKey()) return;
    const job = startTranslation(record.id, lang, { force });
    render();
    job.promise.catch(() => {});
  };

  const summarize = async () => {
    if (!requireApiKey()) return;
    const options = await showSummaryOptionsPopover();
    if (!options || !m.isOpen()) return;
    summarizing = true;
    render();
    try {
      await summarizeVideo(record.id, options);
      showToast("Özet hazır");
    } catch (err) {
      if (!isAbortError(err)) showToast(`Özet oluşturulamadı: ${(err as Error).message}`, "error");
    } finally {
      summarizing = false;
      await reload();
    }
  };

  const seek = (sec: number) => {
    if (isCurrent()) {
      const video = document.querySelector("#movie_player video") as HTMLVideoElement | null;
      if (video) {
        video.currentTime = sec;
        void video.play().catch(() => {});
        m.close();
        return;
      }
    }
    window.open(`https://www.youtube.com/watch?v=${encodeURIComponent(record.id)}&t=${Math.floor(sec)}s`, "_blank", "noopener");
  };

  const copyCurrent = () => {
    const text =
      tab === "translation"
        ? currentCues.length
          ? // Stored lines may carry milliseconds; copy the readable form.
            currentCues.map((c) => `[${formatTimestamp(c.startTime)}] ${c.text}`).join("\n")
          : record.translations?.[lang]
        : tab === "summary"
          ? record.userSummary
          : record.transcript;
    if (!text) return showToast("Kopyalanacak içerik yok", "error");
    GM_setClipboard(text);
    showToast("Panoya kopyalandı");
  };

  const exportSubs = (anchor: HTMLElement) => {
    const base = `${safeFilename(record.title)}.${lang}`;
    openMenu(anchor, [
      { label: "SRT (.srt)", hint: "VLC, mpv, editörler", onSelect: () => downloadText(`${base}.srt`, cuesToSrt(currentCues), "application/x-subrip") },
      { label: "WebVTT (.vtt)", hint: "Tarayıcılar", onSelect: () => downloadText(`${base}.vtt`, cuesToVtt(currentCues), "text/vtt") },
    ]);
  };

  const pickLang = (anchor: HTMLElement) => {
    const saved = new Set(existingLangs());
    const toItem = (code: string) => ({
      label: esc(getLanguage(code).name),
      hint: getJob(record.id, code) ? "çevriliyor…" : saved.has(code) ? "kayıtlı" : "",
      checked: code === lang,
      onSelect: () => {
        lang = code;
        render();
      },
    });
    const savedList = LANGUAGES.filter((l) => saved.has(l.code)).map((l) => l.code);
    const others = LANGUAGES.filter((l) => !saved.has(l.code)).map((l) => l.code);
    // Translations in languages no longer in the list still show up.
    const unknown = [...saved].filter((c) => !LANGUAGES.some((l) => l.code === c));
    openMenu(anchor, [
      ...(saved.size ? [{ heading: "Kayıtlı çeviriler" }, ...[...savedList, ...unknown].map(toItem), "separator" as const] : []),
      { heading: "Yeni çeviri" },
      ...others.map(toItem),
    ]);
  };

  m.dialog.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;
    const tabBtn = target.closest<HTMLElement>(".ytc-tab");
    if (tabBtn) {
      tab = tabBtn.dataset.tab as ViewerTab;
      render();
      return;
    }
    const seekBtn = target.closest<HTMLElement>("[data-seek]");
    if (seekBtn) return seek(Number(seekBtn.dataset.seek));

    const action = target.closest<HTMLElement>("[data-action]");
    switch (action?.dataset.action) {
      case "goto":
        if (isCurrent()) m.close();
        else window.open(`https://www.youtube.com/watch?v=${encodeURIComponent(record.id)}`, "_blank", "noopener");
        break;
      case "copy":
        copyCurrent();
        break;
      case "export":
        exportSubs(action);
        break;
      case "pick-lang":
        pickLang(action);
        break;
      case "translate":
        translate(false);
        break;
      case "retranslate":
        translate(true);
        break;
      case "cancel-job":
        getJob(record.id, lang)?.cancel();
        break;
      case "summarize":
        void summarize();
        break;
      case "toggle-subs": {
        const overlay = getOverlayState();
        if (overlay?.videoId === record.id && overlay.lang === lang) {
          hideSubtitles();
        } else {
          try {
            const r = await showSubtitles(record.id, lang);
            if (r === "shown") {
              m.close();
              showToast(`${getLanguage(lang).name} altyazı açık`);
            }
          } catch (err) {
            showToast((err as Error).message, "error");
          }
        }
        break;
      }
    }
  });

  m.dialog.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === "ytc-v-search") {
      query = t.value;
      const pos = t.selectionStart;
      if (tab === "original") renderOriginal();
      else if (tab === "translation") renderTranslation();
      const input = q<HTMLInputElement>("#ytc-v-search");
      input?.focus();
      if (pos !== null) input?.setSelectionRange(pos, pos);
      content.querySelector("mark")?.scrollIntoView({ block: "center" });
    } else if (t.id === "ytc-v-orig") {
      showOriginal = t.checked;
      renderTranslation();
    }
  });

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  q<HTMLElement>(".ytc-tabs").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const order: ViewerTab[] = ["original", "translation", "summary"];
    tab = order[(order.indexOf(tab) + (e.key === "ArrowRight" ? 1 : 2)) % 3];
    render();
    q<HTMLElement>(`.ytc-tab[data-tab="${tab}"]`).focus();
  });

  // ---- Live updates ---------------------------------------------------------

  const unsubJob = onJobEvent((videoId, jobLang, ev) => {
    if (videoId !== record.id || !m.isOpen()) return;
    if (ev.type === "progress") {
      if (tab === "translation" && jobLang === lang) {
        const el = content.querySelector(".ytc-progress");
        if (!el) return render();
        // YouTube enforces Trusted Types, so HTML always goes through setHTML.
        const tmp = document.createElement("div");
        setHTML(tmp, progressHtml(ev.progress));
        el.replaceWith(tmp.firstElementChild!);
      }
      return;
    }
    if (ev.type === "done" && ev.usage.promptTokens) {
      showToast(`${getLanguage(jobLang).name} çeviri tamamlandı · ${formatCost(ev.usage)}`);
    } else if (ev.type === "error") {
      showToast(`Çeviri başarısız: ${ev.error.message}`, "error", undefined, {
        label: "Tekrar dene",
        onClick: () => translate(false),
      });
    }
    void reload();
  });
  const unsubOverlay = onOverlayChange(() => m.isOpen() && tab === "translation" && renderBar());

  // Highlight the line being spoken when this video is playing underneath.
  let lastFollowed = -1;
  const followTimer = setInterval(() => {
    if (!isCurrent() || tab === "summary") return;
    const video = document.querySelector("#movie_player video") as HTMLVideoElement | null;
    if (!video) return;
    const lines = [...content.querySelectorAll<HTMLElement>(".ytc-line[data-start]")];
    const offset = tab === "translation" ? getSettings().subtitles.offset || 0 : 0;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (Number(lines[i].dataset.start) <= video.currentTime - offset) idx = i;
      else break;
    }
    if (idx === lastFollowed) return;
    lines[lastFollowed]?.classList.remove("current");
    lines[idx]?.classList.add("current");
    lastFollowed = idx;
  }, 500);

  render();
  if (query) content.querySelector("mark")?.scrollIntoView({ block: "center" });
};
