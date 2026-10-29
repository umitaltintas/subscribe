import { setHTML, showToast } from "../dom";
import { esc, truncate, formatDate, debounce, highlight, downloadText } from "../utils";
import { icons } from "../icons";
import { CONFIG, getLanguage } from "../config";
import { db } from "../db";
import { searchManager } from "../search";
import { getOverlayState } from "../subtitle-overlay";
import { showSubtitles, hideSubtitles, cancelJobsFor, cancelAllJobs } from "../translation-service";
import { updateNavbarBadge } from "./navbar";
import { showTranscriptViewer } from "./viewer";
import { openSettings } from "./settings";
import { openModal, confirmDialog } from "./modal";
import type { SearchResult, TranscriptRecord } from "../types";

type DashTab = "history" | "favorites" | "translations" | "stats" | "settings";

const loadingHtml = (msg = "Yükleniyor…") => `<div class="ytc-loading"><div class="ytc-spinner"></div>${msg}</div>`;

const emptyHtml = (title: string, hint = "") => `
  <div class="ytc-empty">
    <div class="ytc-empty-icon">${icons.inbox}</div>
    <div class="ytc-empty-text">${esc(title)}</div>
    ${hint ? `<div class="ytc-empty-hint">${esc(hint)}</div>` : ""}
  </div>`;

const langTags = (item: TranscriptRecord) =>
  Object.keys(item.translations ?? {})
    .map(
      (c) =>
        `<button class="ytc-tag lang" data-open-translation="${esc(item.id)}" data-lang="${esc(c)}" title="${esc(getLanguage(c).name)} çeviriyi görüntüle">${icons.translate} ${esc(c.toUpperCase())}</button>`,
    )
    .join("");

export const showDashboard = async (initialTab: DashTab = "history"): Promise<void> => {
  const [stats, allTags, allChannels] = await Promise.all([db.getStats(), db.getAllTags(), db.getAllChannels()]);
  let tab: DashTab = initialTab;
  let currentQuery = "";

  const tabBtn = (id: DashTab, icon: string, label: string, count?: number) =>
    `<button class="ytc-tab" role="tab" data-tab="${id}">${icon} ${label}${count ? ` <span class="ytc-count">${count}</span>` : ""}</button>`;

  const m = openModal({
    id: "ytc-dashboard-modal",
    width: 920,
    title: `${icons.library} SubScribe kütüphanesi`,
    body: `
      <div class="ytc-tabs sticky" role="tablist">
        ${tabBtn("history", icons.clock, "Geçmiş", stats.total)}
        ${tabBtn("favorites", icons.star, "Favoriler", stats.favorites)}
        ${tabBtn("translations", icons.translate, "Çeviriler")}
        ${tabBtn("stats", icons.barChart, "İstatistik")}
        ${tabBtn("settings", icons.database, "Veri")}
      </div>

      <div class="ytc-tab-content" id="tab-history" role="tabpanel">
        <div class="ytc-toolbar">
          <input type="search" class="ytc-search" placeholder="Başlık, kanal, etiket veya içerikte ara…" id="ytc-search" aria-label="Kütüphanede ara">
          <select class="ytc-filter" id="ytc-tag-filter" aria-label="Etikete göre filtrele">
            <option value="">Tüm etiketler</option>
            ${allTags.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}
          </select>
          <select class="ytc-filter" id="ytc-channel-filter" aria-label="Kanala göre filtrele">
            <option value="">Tüm kanallar</option>
            ${allChannels.map((c) => `<option value="${esc(c)}">${esc(truncate(c, 24))}</option>`).join("")}
          </select>
        </div>
        <div class="ytc-search-hint" id="ytc-search-hint">${icons.lightbulb} Bulanık arama: yazım hataları tolere edilir</div>
        <div class="ytc-list" id="ytc-history-list">${loadingHtml()}</div>
      </div>

      <div class="ytc-tab-content" id="tab-favorites" role="tabpanel">
        <div class="ytc-toolbar">
          <input type="search" class="ytc-search" placeholder="Favorilerde ara…" id="ytc-fav-search" aria-label="Favorilerde ara">
        </div>
        <div class="ytc-list" id="ytc-favorites-list">${loadingHtml()}</div>
      </div>

      <div class="ytc-tab-content" id="tab-translations" role="tabpanel">
        <div class="ytc-list" id="ytc-translations-list">${loadingHtml()}</div>
      </div>

      <div class="ytc-tab-content ytc-pad" id="tab-stats" role="tabpanel">
        <div class="ytc-stats-grid">
          <div class="ytc-stat-card"><div class="ytc-stat-value">${stats.total}</div><div class="ytc-stat-label">Video</div></div>
          <div class="ytc-stat-card"><div class="ytc-stat-value">${stats.favorites}</div><div class="ytc-stat-label">Favori</div></div>
          <div class="ytc-stat-card"><div class="ytc-stat-value">${stats.thisWeek}</div><div class="ytc-stat-label">Bu hafta</div></div>
          <div class="ytc-stat-card"><div class="ytc-stat-value">${stats.channelCount}</div><div class="ytc-stat-label">Kanal</div></div>
          <div class="ytc-stat-card"><div class="ytc-stat-value">${(stats.totalWords / 1000).toFixed(1)}K</div><div class="ytc-stat-label">Kelime</div></div>
          <div class="ytc-stat-card"><div class="ytc-stat-value">~${(stats.totalTokens / 1000).toFixed(1)}K</div><div class="ytc-stat-label">Token</div></div>
        </div>
        ${
          stats.topCopied.length
            ? `<div class="ytc-section">
                <div class="ytc-section-title">${icons.flame} En çok kopyalanan</div>
                ${stats.topCopied
                  .map(
                    (v) => `<div class="ytc-row">
                      <img src="https://i.ytimg.com/vi/${esc(v.id)}/default.jpg" alt="" loading="lazy">
                      <div class="ytc-row-main">
                        <div class="ytc-row-title">${esc(v.title)}</div>
                        <div class="ytc-row-sub">${v.copyCount || 0} kez kopyalandı</div>
                      </div>
                    </div>`,
                  )
                  .join("")}
              </div>`
            : ""
        }
        ${
          stats.channels.length
            ? `<div class="ytc-section">
                <div class="ytc-section-title">${icons.tv} Kanallar</div>
                <div class="ytc-tags">${stats.channels.map((c) => `<span class="ytc-tag neutral">${esc(c)}</span>`).join("")}</div>
              </div>`
            : ""
        }
      </div>

      <div class="ytc-tab-content ytc-pad" id="tab-settings" role="tabpanel">
        <div class="ytc-section">
          <div class="ytc-section-title">${icons.settings} Yapay zekâ ve altyazı</div>
          <button class="ytc-btn secondary" data-action="open-settings">${icons.settings} Ayarları aç</button>
        </div>
        <div class="ytc-section">
          <div class="ytc-section-title">${icons.database} Yedekleme</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="ytc-btn secondary" data-action="export">${icons.upload} JSON olarak dışa aktar</button>
            <label class="ytc-btn secondary" style="cursor:pointer">
              ${icons.download} JSON içe aktar
              <input type="file" accept=".json,application/json" id="ytc-import" class="ytc-sr-only">
            </label>
            <button class="ytc-btn secondary" data-action="rebuild-index">${icons.refreshCw} Arama dizinini yenile</button>
          </div>
          <div class="ytc-help">Çeviriler ve özetler de yedeğe dahildir.</div>
        </div>
        <div class="ytc-section">
          <div class="ytc-section-title">${icons.trash} Tehlikeli bölge</div>
          <button class="ytc-btn danger" data-action="clear-all">${icons.trash} Tüm kayıtları sil</button>
        </div>
        <div class="ytc-section" style="margin-bottom:0">
          <div class="ytc-section-title">${icons.info} Hakkında</div>
          <div class="ytc-prose">
            <p><strong>SubScribe v${esc(CONFIG.VERSION)}</strong> · <a href="${CONFIG.HOMEPAGE}" target="_blank" rel="noopener" style="color:var(--ytc-primary-text)">GitHub</a></p>
            <p>Arama başlık, kanal, etiket ve transkriptin ilk ${CONFIG.SEARCH_PREVIEW_LENGTH} karakterinde yapılır.</p>
          </div>
        </div>
      </div>`,
    onClose: () => void updateNavbarBadge(),
  });

  const q = <T extends HTMLElement>(sel: string) => m.dialog.querySelector(sel) as T;
  const historyList = q<HTMLElement>("#ytc-history-list");
  const favoritesList = q<HTMLElement>("#ytc-favorites-list");
  const translationsList = q<HTMLElement>("#ytc-translations-list");
  const searchInput = q<HTMLInputElement>("#ytc-search");
  const favSearchInput = q<HTMLInputElement>("#ytc-fav-search");
  const tagFilter = q<HTMLSelectElement>("#ytc-tag-filter");
  const channelFilter = q<HTMLSelectElement>("#ytc-channel-filter");

  const renderItem = (item: SearchResult): string => {
    const scorePercent = typeof item._score === "number" ? Math.round((1 - item._score) * 100) : null;

    let matchPreview = "";
    const transcriptMatch = item._matches?.find((x) => x.key === "searchableTranscript");
    if (transcriptMatch?.indices.length) {
      const text = item.transcript || "";
      const [start] = transcriptMatch.indices[0];
      const from = Math.max(0, start - 30);
      const to = Math.min(text.length, start + 110);
      const snippet = `${from > 0 ? "…" : ""}${text.slice(from, to)}${to < text.length ? "…" : ""}`;
      matchPreview = `<div class="ytc-match-preview">${highlight(snippet, currentQuery)}</div>`;
    }

    return `
    <div class="ytc-item ${item.favorite ? "favorite" : ""}" data-id="${esc(item.id)}">
      <img class="ytc-thumb" src="https://i.ytimg.com/vi/${esc(item.id)}/mqdefault.jpg" loading="lazy" alt="">
      <div class="ytc-info">
        <div class="ytc-title">
          <a href="#" data-view="${esc(item.id)}" title="${esc(item.title)}">${esc(item.title)}</a>
          ${scorePercent !== null ? `<span class="ytc-score">%${scorePercent} eşleşme</span>` : ""}
        </div>
        <div class="ytc-meta">
          <span>${icons.tv} ${esc(item.channel || "Bilinmiyor")}</span>
          <span>${icons.calendar} ${formatDate(item.date)}</span>
          <span>${icons.hash} ~${(item.tokens || 0).toLocaleString("tr-TR")} token</span>
          ${item.copyCount > 1 ? `<span>${icons.copy} ${item.copyCount}×</span>` : ""}
          ${item.userSummary ? `<span>${icons.sparkles} Özet</span>` : ""}
        </div>
        <div class="ytc-tags">
          ${(item.tags || []).map((t) => `<span class="ytc-tag">${esc(t)}</span>`).join("")}
          ${langTags(item)}
        </div>
        ${matchPreview}
      </div>
      <div class="ytc-actions">
        <button class="ytc-action-btn fav ${item.favorite ? "active" : ""}" data-fav="${esc(item.id)}" aria-pressed="${item.favorite}" title="Favori" aria-label="Favori">${item.favorite ? icons.starFilled : icons.star}</button>
        <button class="ytc-action-btn" data-copy="${esc(item.id)}" title="Transkripti kopyala" aria-label="Transkripti kopyala">${icons.clipboard}</button>
        <button class="ytc-action-btn" data-view="${esc(item.id)}" title="Görüntüle" aria-label="Görüntüle">${icons.eye}</button>
        <button class="ytc-action-btn delete" data-delete="${esc(item.id)}" title="Sil" aria-label="Sil">${icons.trash}</button>
      </div>
    </div>`;
  };

  const loadHistory = async () => {
    const t0 = performance.now();
    const items = await db.searchWithFilters(currentQuery, { tag: tagFilter.value, channel: channelFilter.value });
    const ms = Math.round(performance.now() - t0);
    setHTML(
      historyList,
      items.length
        ? items.map(renderItem).join("")
        : currentQuery || tagFilter.value || channelFilter.value
          ? emptyHtml("Sonuç bulunamadı", "Farklı bir arama deneyin veya filtreleri temizleyin.")
          : emptyHtml("Kütüphane boş", "Bir videoda “Transkript” düğmesine basarak ilk kaydınızı oluşturun."),
    );
    setHTML(
      q<HTMLElement>("#ytc-search-hint"),
      currentQuery
        ? `${icons.search} ${items.length} sonuç · ${ms} ms`
        : `${icons.lightbulb} Bulanık arama: yazım hataları tolere edilir`,
    );
  };

  const loadFavorites = async (query = "") => {
    let items: SearchResult[] = await db.getFavorites();
    if (query) items = await searchManager.search(query, items);
    setHTML(
      favoritesList,
      items.length
        ? items.map(renderItem).join("")
        : emptyHtml(query ? "Favorilerde sonuç yok" : "Henüz favori yok", query ? "" : "Yıldız simgesiyle kayıtları favorilere ekleyin."),
    );
  };

  const loadTranslations = async () => {
    const all = await db.getAll();
    const items = all.filter((x) => x.translations && Object.keys(x.translations).length);
    const overlay = getOverlayState();
    setHTML(
      translationsList,
      items.length
        ? items
            .map((item) => {
              const langs = Object.keys(item.translations!);
              return `<div class="ytc-item" data-id="${esc(item.id)}">
                <img class="ytc-thumb" src="https://i.ytimg.com/vi/${esc(item.id)}/mqdefault.jpg" loading="lazy" alt="">
                <div class="ytc-info">
                  <div class="ytc-title"><a href="#" data-view="${esc(item.id)}" title="${esc(item.title)}">${esc(item.title)}</a></div>
                  <div class="ytc-meta"><span>${icons.tv} ${esc(item.channel || "Bilinmiyor")}</span><span>${icons.calendar} ${formatDate(item.date)}</span></div>
                  <div class="ytc-tags">
                    ${langs
                      .map((c) => {
                        const on = overlay?.videoId === item.id && overlay.lang === c;
                        return `<span style="display:inline-flex;gap:4px">
                          <button class="ytc-tag lang" data-open-translation="${esc(item.id)}" data-lang="${esc(c)}">${icons.translate} ${esc(getLanguage(c).name)}</button>
                          <button class="ytc-tag ${on ? "" : "neutral"}" data-play-subs="${esc(item.id)}" data-lang="${esc(c)}" title="${on ? "Altyazıyı kapat" : "Videoyu altyazıyla oynat"}">${icons.subtitles} ${on ? "Açık" : "Oynat"}</button>
                          <button class="ytc-tag neutral" data-del-translation="${esc(item.id)}" data-lang="${esc(c)}" title="${esc(getLanguage(c).name)} çeviriyi sil" aria-label="${esc(getLanguage(c).name)} çeviriyi sil">${icons.trash}</button>
                        </span>`;
                      })
                      .join("")}
                  </div>
                </div>
              </div>`;
            })
            .join("")
        : emptyHtml("Henüz çeviri yok", "Bir videoda “Çevir” düğmesine basın; çeviri kaydedilir ve altyazı olarak gösterilir."),
    );
  };

  const reloadAll = () => {
    void loadHistory();
    void loadFavorites(favSearchInput.value.trim());
    void loadTranslations();
  };

  const setTab = (next: DashTab) => {
    tab = next;
    m.dialog.querySelectorAll<HTMLElement>(".ytc-tab").forEach((t) => {
      const active = t.dataset.tab === tab;
      t.classList.toggle("active", active);
      t.setAttribute("aria-selected", String(active));
    });
    m.dialog.querySelectorAll(".ytc-tab-content").forEach((c) => c.classList.toggle("active", c.id === `tab-${tab}`));
  };

  setTab(tab);
  reloadAll();
  if (tab === "history") searchInput.focus();

  searchInput.addEventListener(
    "input",
    debounce(() => {
      currentQuery = searchInput.value.trim();
      void loadHistory();
    }, CONFIG.DEBOUNCE_MS),
  );
  favSearchInput.addEventListener("input", debounce(() => void loadFavorites(favSearchInput.value.trim()), CONFIG.DEBOUNCE_MS));
  tagFilter.addEventListener("change", () => void loadHistory());
  channelFilter.addEventListener("change", () => void loadHistory());

  const openViewer = async (id: string, tabName: "original" | "translation" = "original", lang?: string) => {
    const item = await db.get(id);
    if (!item) return showToast("Kayıt bulunamadı", "error");
    showTranscriptViewer(item, { query: currentQuery, tab: tabName, lang });
  };

  m.dialog.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;
    const el = <T extends string>(attr: T) => target.closest<HTMLElement>(`[${attr}]`);

    const tabEl = target.closest<HTMLElement>(".ytc-tab");
    if (tabEl) return setTab(tabEl.dataset.tab as DashTab);

    const viewBtn = el("data-view");
    if (viewBtn) {
      e.preventDefault();
      return void openViewer(viewBtn.dataset.view!);
    }

    const openTr = el("data-open-translation");
    if (openTr) return void openViewer(openTr.dataset.openTranslation!, "translation", openTr.dataset.lang);

    const favBtn = el("data-fav");
    if (favBtn) {
      const item = await db.get(favBtn.dataset.fav!);
      if (!item) return;
      await db.update(item.id, { favorite: !item.favorite });
      reloadAll();
      return;
    }

    const copyBtn = el("data-copy");
    if (copyBtn) {
      const item = await db.get(copyBtn.dataset.copy!);
      if (!item?.transcript) return showToast("Transkript bulunamadı", "error");
      GM_setClipboard(item.transcript);
      await db.update(item.id, { copyCount: (item.copyCount || 0) + 1 });
      return showToast("Panoya kopyalandı");
    }

    const deleteBtn = el("data-delete");
    if (deleteBtn) {
      const item = await db.get(deleteBtn.dataset.delete!);
      if (!(await confirmDialog(`“${truncate(item?.title ?? "", 60)}” kaydı, çevirileri ve özetiyle birlikte silinecek.`, "Sil", true))) return;
      const id = deleteBtn.dataset.delete!;
      cancelJobsFor(id);
      if (getOverlayState()?.videoId === id) hideSubtitles();
      await db.delete(id);
      reloadAll();
      void updateNavbarBadge();
      return showToast("Kayıt silindi");
    }

    const playBtn = el("data-play-subs");
    if (playBtn) {
      const id = playBtn.dataset.playSubs!;
      const lang = playBtn.dataset.lang!;
      const overlay = getOverlayState();
      if (overlay?.videoId === id && overlay.lang === lang) {
        hideSubtitles();
        return void loadTranslations();
      }
      try {
        const r = await showSubtitles(id, lang);
        if (r === "shown") {
          m.close();
          showToast(`${getLanguage(lang).name} altyazı açık`);
        }
      } catch (err) {
        showToast((err as Error).message, "error");
      }
      return;
    }

    const delTr = el("data-del-translation");
    if (delTr) {
      const lang = delTr.dataset.lang!;
      if (!(await confirmDialog(`${getLanguage(lang).name} çeviri silinecek.`, "Sil", true))) return;
      await db.deleteTranslation(delTr.dataset.delTranslation!, lang);
      const overlay = getOverlayState();
      if (overlay && overlay.videoId === delTr.dataset.delTranslation && overlay.lang === lang) hideSubtitles();
      reloadAll();
      return showToast("Çeviri silindi");
    }

    switch (target.closest<HTMLElement>("[data-action]")?.dataset.action) {
      case "open-settings":
        return openSettings();
      case "export": {
        downloadText(`subscribe-yedek-${new Date().toISOString().slice(0, 10)}.json`, await db.export(), "application/json");
        return showToast("Yedek indirildi");
      }
      case "rebuild-index": {
        searchManager.invalidate();
        await searchManager.buildIndex(await db.getAll());
        return showToast(`Arama dizini yenilendi (${searchManager.lastIndexTime.toFixed(0)} ms)`);
      }
      case "clear-all": {
        if (!(await confirmDialog("Kütüphanedeki TÜM kayıtlar, çeviriler ve özetler kalıcı olarak silinecek. Önce yedek almanız önerilir.", "Hepsini sil", true))) return;
        cancelAllJobs();
        hideSubtitles();
        await db.clear();
        m.close();
        return showToast("Tüm kayıtlar silindi");
      }
    }
  });

  q<HTMLInputElement>("#ytc-import").addEventListener("change", async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const count = await db.import(await file.text());
      showToast(`${count} kayıt içe aktarıldı`);
      reloadAll();
      void updateNavbarBadge();
    } catch (err) {
      showToast(`İçe aktarma başarısız: ${(err as Error).message}`, "error");
    } finally {
      input.value = "";
    }
  });
};
