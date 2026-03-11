import { $, setHTML, injectStyles, showToast } from "../dom";
import { esc, truncate, formatDate, debounce } from "../utils";
import { icons } from "../icons";
import { CONFIG } from "../config";
import { db } from "../db";
import { searchManager } from "../search";
import { updateNavbarBadge } from "./navbar";
import { showTranscriptViewer } from "./viewer";
import { parseCuesFromTranslatedText, showSubtitleOverlay, hideSubtitleOverlay, isOverlayActive } from "../subtitle-overlay";
import type { SearchResult, TranscriptRecord } from "../types";

const showTranslationViewer = (item: TranscriptRecord, lang: string, translated: string): void => {
  ($(".ytc-translation-viewer") as HTMLElement)?.remove();

  const langName = CONFIG.AI.AVAILABLE_LANGUAGES.find((l) => l.code === lang)?.name || lang.toUpperCase();

  const modal = document.createElement("div");
  modal.className = "ytc-modal-bg ytc-translation-viewer";
  setHTML(
    modal,
    `
    <div class="ytc-modal" style="width:min(700px,95vw)">
      <div class="ytc-modal-header">
        <h2>${icons.translate} ${esc(truncate(item.title, 35))} — ${esc(langName)}</h2>
        <button class="ytc-modal-close">${icons.x}</button>
      </div>
      <div class="ytc-modal-body" style="padding:20px">
        <div class="ytc-meta" style="margin-bottom:16px">
          <span>${icons.tv} ${esc(item.channel)}</span>
          <span>${icons.translate} ${esc(langName)}</span>
        </div>
        <div class="ytc-preview">${esc(translated)}</div>
      </div>
      <div class="ytc-modal-footer">
        <button class="ytc-btn secondary" data-action="copy-translation">${icons.clipboard} Kopyala</button>
        <button class="ytc-btn secondary" data-action="play-subs">${icons.subtitles} Altyazı Göster</button>
        <button class="ytc-btn" data-action="close-viewer">Kapat</button>
      </div>
    </div>
  `,
  );

  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target === modal || target.closest(".ytc-modal-close") || target.closest('[data-action="close-viewer"]')) {
      modal.remove();
    }
    if (target.closest('[data-action="copy-translation"]')) {
      GM_setClipboard(translated);
      showToast("Çeviri kopyalandı!");
    }
    if (target.closest('[data-action="play-subs"]')) {
      if (isOverlayActive()) {
        hideSubtitleOverlay();
        showToast("Altyazı kapatıldı");
      } else {
        const cues = parseCuesFromTranslatedText(translated);
        if (cues.length > 0) {
          showSubtitleOverlay(cues);
          showToast("Altyazı açıldı — videoya gidin");
        } else {
          showToast("Altyazı ayrıştırılamadı", "error");
        }
      }
    }
  });

  document.addEventListener("keydown", function handler(e) {
    if (e.key === "Escape") {
      modal.remove();
      document.removeEventListener("keydown", handler);
    }
  });
};

export const showDashboard = async (
  initialTab = "history",
): Promise<void> => {
  injectStyles();
  ($(".ytc-modal-bg") as HTMLElement)?.remove();

  const stats = await db.getStats();
  const allTags = await db.getAllTags();
  const allChannels = await db.getAllChannels();

  const bg = document.createElement("div");
  bg.className = "ytc-modal-bg";
  setHTML(
    bg,
    `
    <div class="ytc-modal">
      <div class="ytc-modal-header">
        <h2>${icons.library} Transkript Yöneticisi</h2>
        <button class="ytc-modal-close">${icons.x}</button>
      </div>

      <div class="ytc-tabs">
        <button class="ytc-tab ${initialTab === "history" ? "active" : ""}" data-tab="history">${icons.clock} Geçmiş</button>
        <button class="ytc-tab ${initialTab === "favorites" ? "active" : ""}" data-tab="favorites">${icons.star} Favoriler</button>
        <button class="ytc-tab ${initialTab === "translations" ? "active" : ""}" data-tab="translations">${icons.translate} Çeviriler</button>
        <button class="ytc-tab ${initialTab === "stats" ? "active" : ""}" data-tab="stats">${icons.barChart} İstatistik</button>
        <button class="ytc-tab ${initialTab === "settings" ? "active" : ""}" data-tab="settings">${icons.settings} Ayarlar</button>
      </div>

      <div class="ytc-tab-content ${initialTab === "history" ? "active" : ""}" id="tab-history">
        <div class="ytc-toolbar">
          <input type="text" class="ytc-search" placeholder="Fuzzy arama... (örn: python tutorial)" id="ytc-search">
          <select class="ytc-filter" id="ytc-tag-filter">
            <option value="">Tüm etiketler</option>
            ${allTags.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}
          </select>
          <select class="ytc-filter" id="ytc-channel-filter">
            <option value="">Tüm kanallar</option>
            ${allChannels.map((c) => `<option value="${esc(c)}">${truncate(c, 20)}</option>`).join("")}
          </select>
          <button class="ytc-btn small secondary" id="ytc-refresh" title="Yenile">${icons.refreshCw}</button>
        </div>
        <div style="padding:0 20px;">
          <div class="ytc-search-hint">${icons.lightbulb} Fuzzy arama: yazım hataları tolere edilir, benzer sonuçlar bulunur</div>
        </div>
        <div class="ytc-list" id="ytc-history-list">
          <div class="ytc-loading"><div class="ytc-spinner"></div>Yükleniyor...</div>
        </div>
      </div>

      <div class="ytc-tab-content ${initialTab === "favorites" ? "active" : ""}" id="tab-favorites">
        <div class="ytc-toolbar">
          <input type="text" class="ytc-search" placeholder="Favorilerde ara..." id="ytc-fav-search">
        </div>
        <div class="ytc-list" id="ytc-favorites-list">
          <div class="ytc-loading"><div class="ytc-spinner"></div>Yükleniyor...</div>
        </div>
      </div>

      <div class="ytc-tab-content ${initialTab === "translations" ? "active" : ""}" id="tab-translations">
        <div class="ytc-list" id="ytc-translations-list">
          <div class="ytc-loading"><div class="ytc-spinner"></div>Yükleniyor...</div>
        </div>
      </div>

      <div class="ytc-tab-content ${initialTab === "stats" ? "active" : ""}" id="tab-stats">
        <div class="ytc-stats-grid">
          <div class="ytc-stat-card"><div class="ytc-stat-value">${stats.total}</div><div class="ytc-stat-label">Toplam Video</div></div>
          <div class="ytc-stat-card"><div class="ytc-stat-value">${stats.favorites}</div><div class="ytc-stat-label">Favori</div></div>
          <div class="ytc-stat-card"><div class="ytc-stat-value">${stats.thisWeek}</div><div class="ytc-stat-label">Bu Hafta</div></div>
          <div class="ytc-stat-card"><div class="ytc-stat-value">${stats.channelCount}</div><div class="ytc-stat-label">Farklı Kanal</div></div>
          <div class="ytc-stat-card"><div class="ytc-stat-value">~${(stats.totalTokens / 1000).toFixed(1)}K</div><div class="ytc-stat-label">Toplam Token</div></div>
          <div class="ytc-stat-card"><div class="ytc-stat-value">${stats.indexTime ? stats.indexTime.toFixed(0) + "ms" : "-"}</div><div class="ytc-stat-label">Index Süresi</div></div>
        </div>

        ${
          stats.topCopied.length > 0
            ? `
          <div class="ytc-section">
            <div class="ytc-section-title">${icons.flame} En Çok Kopyalanan</div>
            ${stats.topCopied
              .map(
                (v) => `
              <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--ytc-border)">
                <img src="https://i.ytimg.com/vi/${esc(v.id)}/default.jpg" style="width:60px;border-radius:6px">
                <div style="flex:1;min-width:0">
                  <div style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(v.title)}</div>
                  <div style="font-size:11px;color:var(--ytc-muted)">${v.copyCount}x kopyalandı</div>
                </div>
              </div>
            `,
              )
              .join("")}
          </div>
        `
            : ""
        }

        ${
          stats.channels.length > 0
            ? `
          <div class="ytc-section">
            <div class="ytc-section-title">${icons.tv} Kanallar</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
              ${stats.channels.map((c) => `<span class="ytc-tag">${esc(c)}</span>`).join("")}
            </div>
          </div>
        `
            : ""
        }
      </div>

      <div class="ytc-tab-content ${initialTab === "settings" ? "active" : ""}" id="tab-settings">
        <div class="ytc-section">
          <div class="ytc-section-title">${icons.database} Veri Yönetimi</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="ytc-btn secondary" id="ytc-export">${icons.upload} JSON Dışa Aktar</button>
            <label class="ytc-btn secondary" style="cursor:pointer">
              ${icons.download} JSON İçe Aktar
              <input type="file" accept=".json" id="ytc-import" style="display:none">
            </label>
            <button class="ytc-btn secondary" id="ytc-rebuild-index">${icons.refreshCw} Index Yenile</button>
            <button class="ytc-btn danger" id="ytc-clear-all">${icons.trash} Tümünü Sil</button>
          </div>
        </div>

        <div class="ytc-section" style="margin-top:24px">
          <div class="ytc-section-title">${icons.search} Arama Hakkında</div>
          <div style="font-size:13px;color:var(--ytc-muted);line-height:1.8">
            <p><strong>Fuse.js Fuzzy Search</strong> kullanılıyor.</p>
            <p>• Yazım hatalarını tolere eder</p>
            <p>• Benzer kelimeleri bulur</p>
            <p>• Başlık, kanal, etiket ve transcript içinde arar</p>
            <p>• Performans için transcript'in ilk ${CONFIG.SEARCH_PREVIEW_LENGTH} karakteri indexlenir</p>
          </div>
        </div>

        <div class="ytc-section" style="margin-top:24px">
          <div class="ytc-section-title">${icons.info} Hakkında</div>
          <div style="font-size:13px;color:var(--ytc-muted);line-height:1.6">
            <p><strong>SubScribe v1.0.0</strong></p>
            <p>Fuse.js ile güçlendirilmiş fuzzy search.</p>
          </div>
        </div>
      </div>

      <div class="ytc-modal-footer">
        <button class="ytc-btn" data-action="close">Kapat</button>
      </div>
    </div>
  `,
  );

  document.body.appendChild(bg);

  const tabs = bg.querySelectorAll(".ytc-tab");
  const tabContents = bg.querySelectorAll(".ytc-tab-content");
  const historyList = bg.querySelector("#ytc-history-list") as HTMLElement;
  const favoritesList = bg.querySelector("#ytc-favorites-list") as HTMLElement;
  const searchInput = bg.querySelector("#ytc-search") as HTMLInputElement;
  const favSearchInput = bg.querySelector("#ytc-fav-search") as HTMLInputElement;
  const tagFilter = bg.querySelector("#ytc-tag-filter") as HTMLSelectElement;
  const channelFilter = bg.querySelector("#ytc-channel-filter") as HTMLSelectElement;

  let currentQuery = "";
  let searchStartTime = 0;

  const renderItem = (item: SearchResult): string => {
    const hasScore = typeof item._score === "number";
    const scorePercent = hasScore ? Math.round((1 - item._score!) * 100) : null;

    let matchPreview = "";
    if (item._matches) {
      const transcriptMatch = item._matches.find((m) => m.key === "searchableTranscript");
      if (transcriptMatch && transcriptMatch.indices.length > 0) {
        const text = item.transcript || "";
        const [start] = transcriptMatch.indices[0];
        const previewStart = Math.max(0, start - 30);
        const previewEnd = Math.min(text.length, start + 100);
        let preview = text.slice(previewStart, previewEnd);
        if (previewStart > 0) preview = "..." + preview;
        if (previewEnd < text.length) preview = preview + "...";

        if (currentQuery) {
          const regex = new RegExp(`(${currentQuery.split(/\s+/).join("|")})`, "gi");
          preview = preview.replace(regex, "<mark>$1</mark>");
        }
        matchPreview = `<div class="ytc-match-preview">${preview}</div>`;
      }
    }

    return `
    <div class="ytc-item ${item.favorite ? "favorite" : ""}" data-id="${esc(item.id)}">
      <img class="ytc-thumb" src="https://i.ytimg.com/vi/${esc(item.id)}/mqdefault.jpg" loading="lazy" alt="">
      <div class="ytc-info">
        <div class="ytc-title">
          <a href="${esc(item.url)}" target="_blank">${esc(item.title)}</a>
          ${hasScore ? `<span class="ytc-score">${scorePercent}% eşleşme</span>` : ""}
        </div>
        <div class="ytc-meta">
          <span>${icons.tv} ${esc(item.channel || "Bilinmiyor")}</span>
          <span>${icons.calendar} ${formatDate(item.date)}</span>
          <span>${icons.hash} ~${item.tokens || 0} token</span>
          ${item.copyCount > 1 ? `<span>${icons.copy} ${item.copyCount}x</span>` : ""}
        </div>
        <div class="ytc-tags">
          ${(item.tags || []).map((t) => `<span class="ytc-tag">${esc(t)}</span>`).join("")}
          ${item.translations && Object.keys(item.translations).length > 0 ? Object.keys(item.translations).map((c) => `<span class="ytc-tag" style="background:rgba(76,175,80,.15);color:#66bb6a">${icons.translate} ${c.toUpperCase()}</span>`).join("") : ""}
        </div>
        ${matchPreview}
      </div>
      <div class="ytc-actions">
        <button class="ytc-action-btn fav ${item.favorite ? "active" : ""}" data-fav="${esc(item.id)}" title="Favori">${icons.star}</button>
        <button class="ytc-action-btn" data-copy="${esc(item.id)}" title="Tekrar Kopyala">${icons.clipboard}</button>
        <button class="ytc-action-btn" data-view="${esc(item.id)}" title="Görüntüle">${icons.eye}</button>
        <button class="ytc-action-btn delete" data-delete="${esc(item.id)}" title="Sil">${icons.trash}</button>
      </div>
    </div>
  `;
  };

  const renderEmpty = (msg: string): string => `
    <div class="ytc-empty">
      <div class="ytc-empty-icon">${icons.inbox}</div>
      <div class="ytc-empty-text">${msg}</div>
    </div>
  `;

  const renderSearchStats = (count: number, time: number) => {
    const hint = bg.querySelector(".ytc-search-hint") as HTMLElement | null;
    if (hint) {
      setHTML(
        hint,
        currentQuery
          ? `${icons.sparkles} ${count} sonuç bulundu (${time}ms)`
          : `${icons.lightbulb} Fuzzy arama: yazım hataları tolere edilir, benzer sonuçlar bulunur`,
      );
    }
  };

  const loadHistory = async () => {
    setHTML(historyList, '<div class="ytc-loading"><div class="ytc-spinner"></div>Aranıyor...</div>');
    searchStartTime = performance.now();

    const items = await db.searchWithFilters(currentQuery, {
      tag: tagFilter.value,
      channel: channelFilter.value,
    });

    const searchTime = Math.round(performance.now() - searchStartTime);

    setHTML(
      historyList,
      items.length
        ? items.map(renderItem).join("")
        : renderEmpty(currentQuery ? `"${currentQuery}" için sonuç bulunamadı` : "Henüz kayıt yok"),
    );

    renderSearchStats(items.length, searchTime);
  };

  const loadFavorites = async (query = "") => {
    setHTML(favoritesList, '<div class="ytc-loading"><div class="ytc-spinner"></div>Yükleniyor...</div>');

    let items: SearchResult[] = await db.getFavorites();
    if (query) {
      items = await searchManager.search(query, items);
    }

    setHTML(
      favoritesList,
      items.length
        ? items.map(renderItem).join("")
        : renderEmpty(query ? `"${query}" için favori bulunamadı` : "Henüz favori yok"),
    );
  };

  const translationsList = bg.querySelector("#ytc-translations-list") as HTMLElement;

  const renderTranslationItem = (item: TranscriptRecord): string => {
    const langs = Object.keys(item.translations || {});
    return `
    <div class="ytc-item" data-id="${esc(item.id)}">
      <img class="ytc-thumb" src="https://i.ytimg.com/vi/${esc(item.id)}/mqdefault.jpg" loading="lazy" alt="">
      <div class="ytc-info">
        <div class="ytc-title">
          <a href="${esc(item.url)}" target="_blank">${esc(item.title)}</a>
        </div>
        <div class="ytc-meta">
          <span>${icons.tv} ${esc(item.channel || "Bilinmiyor")}</span>
          <span>${icons.calendar} ${formatDate(item.date)}</span>
        </div>
        <div class="ytc-tags">
          ${langs.map((lang) => `<button class="ytc-tag" style="background:rgba(76,175,80,.15);color:#66bb6a;cursor:pointer;border:0" data-show-translation="${esc(item.id)}:${esc(lang)}">${icons.translate} ${lang.toUpperCase()}</button>`).join("")}
          ${langs.map((lang) => `<button class="ytc-tag" style="background:rgba(255,215,0,.15);color:#ffd700;cursor:pointer;border:0" data-play-subs="${esc(item.id)}:${esc(lang)}">${icons.subtitles} ${lang.toUpperCase()} Altyazı</button>`).join("")}
        </div>
      </div>
      <div class="ytc-actions">
        <button class="ytc-action-btn" data-view="${esc(item.id)}" title="Görüntüle">${icons.eye}</button>
        ${langs.map((lang) => `<button class="ytc-action-btn delete" data-del-translation="${esc(item.id)}:${esc(lang)}" title="${lang.toUpperCase()} çevirisini sil">${icons.trash}</button>`).join("")}
      </div>
    </div>
  `;
  };

  const loadTranslations = async () => {
    const all = await db.getAll();
    const withTranslations = all.filter((item) => item.translations && Object.keys(item.translations).length > 0);

    setHTML(
      translationsList,
      withTranslations.length
        ? withTranslations.map(renderTranslationItem).join("")
        : renderEmpty("Henüz çeviri yok. Video sayfasında 'Çevir' butonunu kullanarak çeviri yapabilirsiniz."),
    );
  };

  loadHistory();
  loadFavorites();
  loadTranslations();

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));
      tab.classList.add("active");
      bg.querySelector(`#tab-${(tab as HTMLElement).dataset.tab}`)?.classList.add("active");
    });
  });

  const doSearch = debounce(() => {
    currentQuery = searchInput.value.trim();
    loadHistory();
  }, CONFIG.DEBOUNCE_MS);

  const doFavSearch = debounce(() => {
    loadFavorites(favSearchInput.value.trim());
  }, CONFIG.DEBOUNCE_MS);

  searchInput.addEventListener("input", doSearch);
  favSearchInput.addEventListener("input", doFavSearch);
  tagFilter.addEventListener("change", loadHistory);
  channelFilter.addEventListener("change", loadHistory);
  bg.querySelector("#ytc-refresh")?.addEventListener("click", () => {
    searchManager.invalidate();
    loadHistory();
  });

  bg.querySelector("#ytc-rebuild-index")?.addEventListener("click", async () => {
    searchManager.invalidate();
    const items = await db.getAll();
    await searchManager.buildIndex(items);
    showToast(`Index yenilendi (${searchManager.lastIndexTime.toFixed(0)}ms)`);
  });

  const close = () => {
    bg.remove();
    updateNavbarBadge();
  };

  bg.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;

    if (target === bg || target.closest(".ytc-modal-close") || target.closest('[data-action="close"]'))
      close();

    const favBtn = target.closest("[data-fav]") as HTMLElement | null;
    if (favBtn) {
      const id = favBtn.dataset.fav!;
      const item = await db.get(id);
      if (item) {
        await db.update(id, { favorite: !item.favorite });
        favBtn.classList.toggle("active");
        favBtn.closest(".ytc-item")?.classList.toggle("favorite");
        loadFavorites(favSearchInput.value.trim());
      }
    }

    const copyBtn = target.closest("[data-copy]") as HTMLElement | null;
    if (copyBtn) {
      const id = copyBtn.dataset.copy!;
      const item = await db.get(id);
      if (item?.transcript) {
        GM_setClipboard(item.transcript);
        await db.update(id, { copyCount: (item.copyCount || 1) + 1 });
        showToast("Tekrar kopyalandı!");
      } else {
        showToast("Transkript bulunamadı", "error");
      }
    }

    const viewBtn = target.closest("[data-view]") as HTMLElement | null;
    if (viewBtn) {
      const id = viewBtn.dataset.view!;
      const item = await db.get(id);
      if (item) showTranscriptViewer(item, currentQuery);
    }

    const deleteBtn = target.closest("[data-delete]") as HTMLElement | null;
    if (deleteBtn) {
      const id = deleteBtn.dataset.delete!;
      if (confirm("Bu kaydı silmek istediğine emin misin?")) {
        await db.delete(id);
        deleteBtn.closest(".ytc-item")?.remove();
        loadFavorites(favSearchInput.value.trim());
        loadTranslations();
        showToast("Silindi");
      }
    }

    // Translation tab actions
    const showTransBtn = target.closest("[data-show-translation]") as HTMLElement | null;
    if (showTransBtn) {
      const [id, lang] = showTransBtn.dataset.showTranslation!.split(":");
      const item = await db.get(id);
      const translated = item?.translations?.[lang];
      if (translated) {
        showTranslationViewer(item!, lang, translated);
      } else {
        showToast("Çeviri bulunamadı", "error");
      }
    }

    const playSubsBtn = target.closest("[data-play-subs]") as HTMLElement | null;
    if (playSubsBtn) {
      const [id, lang] = playSubsBtn.dataset.playSubs!.split(":");
      const item = await db.get(id);
      const translated = item?.translations?.[lang];
      if (translated) {
        if (isOverlayActive()) {
          hideSubtitleOverlay();
          showToast("Altyazı kapatıldı");
        } else {
          const cues = parseCuesFromTranslatedText(translated);
          if (cues.length > 0) {
            showSubtitleOverlay(cues);
            showToast("Altyazı açıldı — videoya gidin");
          } else {
            showToast("Altyazı ayrıştırılamadı", "error");
          }
        }
      }
    }

    const delTransBtn = target.closest("[data-del-translation]") as HTMLElement | null;
    if (delTransBtn) {
      const [id, lang] = delTransBtn.dataset.delTranslation!.split(":");
      if (confirm(`${lang.toUpperCase()} çevirisini silmek istediğine emin misin?`)) {
        const item = await db.get(id);
        if (item?.translations?.[lang]) {
          delete item.translations[lang];
          await db.update(id, { translations: item.translations });
          loadTranslations();
          loadHistory();
          showToast("Çeviri silindi");
        }
      }
    }

    if (target.closest("#ytc-export")) {
      const json = await db.export();
      const blob = new Blob([json], { type: "application/json" });
      Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(blob),
        download: `transcript-backup-${new Date().toISOString().slice(0, 10)}.json`,
      }).click();
      showToast("Dışa aktarıldı!");
    }

    if (target.closest("#ytc-clear-all")) {
      if (confirm("TÜM VERİLER SİLİNECEK! Emin misin?")) {
        await db.clear();
        close();
        showToast("Tüm veriler silindi");
      }
    }
  });

  (bg.querySelector("#ytc-import") as HTMLInputElement).addEventListener("change", async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const count = await db.import(text);
      showToast(`${count} kayıt içe aktarıldı!`);
      loadHistory();
      loadFavorites();
    } catch (err) {
      showToast("İçe aktarma başarısız: " + (err as Error).message, "error");
    }
  });

  document.addEventListener("keydown", function handler(e) {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", handler);
    }
  });
};
