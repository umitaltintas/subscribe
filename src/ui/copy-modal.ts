import { $, setHTML, injectStyles, showToast } from "../dom";
import { esc, countStats } from "../utils";
import { icons } from "../icons";
import { db } from "../db";
import { getVideoInfo, getTranscriptText } from "../transcript";
import { updateNavbarBadge } from "./navbar";

export const showCopyModal = async (): Promise<void> => {
  injectStyles();
  ($(".ytc-modal-bg") as HTMLElement)?.remove();

  const videoInfo = getVideoInfo();
  const existing = await db.get(videoInfo.id);

  const bg = document.createElement("div");
  bg.className = "ytc-modal-bg";
  setHTML(
    bg,
    `
    <div class="ytc-modal" style="width:min(600px,95vw)">
      <div class="ytc-modal-header">
        <h2>${icons.clipboard} Transkript Kopyala</h2>
        <button class="ytc-modal-close">${icons.x}</button>
      </div>
      <div class="ytc-modal-body" style="padding:20px">
        <div class="ytc-section">
          <div class="ytc-section-title">${icons.fileText} Format</div>
          <div class="ytc-options">
            <label class="ytc-option selected">
              <input type="radio" name="fmt" value="text" checked>
              <div class="ytc-option-text">
                <div class="ytc-option-title">${icons.text} Sadece metin</div>
                <div class="ytc-option-desc">Temiz metin, zaman damgası olmadan</div>
              </div>
            </label>
            <label class="ytc-option">
              <input type="radio" name="fmt" value="time">
              <div class="ytc-option-text">
                <div class="ytc-option-title">${icons.timer} Zaman damgalı</div>
                <div class="ytc-option-desc">[00:00] formatında zaman bilgisi ile</div>
              </div>
            </label>
          </div>
        </div>

        <div class="ytc-section">
          <div class="ytc-section-title">${icons.tag} Etiketler (opsiyonel)</div>
          <div class="ytc-tags-input" style="position:relative">
            <div class="ytc-selected-tags"></div>
            <input type="text" placeholder="Etiket ekle... (Enter ile)" id="ytc-tag-input">
          </div>
          <div style="font-size:12px;color:var(--ytc-muted);margin-top:6px">Örnek: eğitim, programlama, türkçe</div>
        </div>

        <div class="ytc-section">
          <label class="ytc-option" style="padding:10px 14px">
            <input type="checkbox" id="ytc-favorite" ${existing?.favorite ? "checked" : ""}>
            <div class="ytc-option-text">
              <div class="ytc-option-title">${icons.star} Favorilere ekle</div>
            </div>
          </label>
        </div>
      </div>
      <div class="ytc-modal-footer">
        <button class="ytc-btn secondary" data-action="cancel">Vazgeç</button>
        ${existing ? `<button class="ytc-btn secondary" data-action="recopy">${icons.refreshCw} Tekrar Kopyala</button>` : ""}
        <button class="ytc-btn" data-action="copy">${icons.clipboard} Kopyala ve Kaydet</button>
      </div>
    </div>
  `,
  );

  document.body.appendChild(bg);

  const options = bg.querySelectorAll(".ytc-option");
  const tagInput = bg.querySelector("#ytc-tag-input") as HTMLInputElement;
  const selectedTagsEl = bg.querySelector(
    ".ytc-selected-tags",
  ) as HTMLElement;

  let selectedTags = existing?.tags ? [...existing.tags] : [];

  options.forEach((opt) => {
    opt.addEventListener("click", () => {
      const radio = opt.querySelector(
        'input[type="radio"]',
      ) as HTMLInputElement | null;
      if (radio) {
        options.forEach((o) => o.classList.remove("selected"));
        opt.classList.add("selected");
        radio.checked = true;
      }
    });
  });

  const renderTags = () => {
    setHTML(
      selectedTagsEl,
      selectedTags
        .map(
          (t) =>
            `<span class="ytc-tag removable" data-tag="${esc(t)}">${esc(t)} ${icons.x}</span>`,
        )
        .join(""),
    );
  };

  renderTags();

  selectedTagsEl.addEventListener("click", (e) => {
    const tag = (e.target as HTMLElement).closest("[data-tag]") as HTMLElement | null;
    if (tag?.dataset.tag) {
      selectedTags = selectedTags.filter((t) => t !== tag.dataset.tag);
      renderTags();
    }
  });

  tagInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && tagInput.value.trim()) {
      e.preventDefault();
      const tag = tagInput.value.trim().toLowerCase();
      if (!selectedTags.includes(tag)) {
        selectedTags.push(tag);
        renderTags();
      }
      tagInput.value = "";
    }
  });

  const close = () => bg.remove();

  const doCopy = async () => {
    const fmt = (
      bg.querySelector('input[name="fmt"]:checked') as HTMLInputElement
    ).value;
    const favorite = (
      bg.querySelector("#ytc-favorite") as HTMLInputElement
    ).checked;
    const text = getTranscriptText(fmt === "time");
    const stats = countStats(text);

    const record = {
      ...videoInfo,
      ...stats,
      transcript: text,
      format: fmt as "text" | "time",
      favorite,
      tags: selectedTags,
      date: new Date().toISOString(),
      copyCount: (existing?.copyCount || 0) + 1,
    };

    await db.add(record);
    GM_setClipboard(text);
    close();
    showToast(
      `Kopyalandı! (${stats.words} kelime, ~${stats.tokens} token)`,
    );
    updateNavbarBadge();
  };

  bg.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (
      target === bg ||
      target.closest(".ytc-modal-close") ||
      target.closest('[data-action="cancel"]')
    )
      close();
    if (target.closest('[data-action="copy"]')) doCopy();
    if (target.closest('[data-action="recopy"]')) doCopy();
  });

  document.addEventListener("keydown", function handler(e) {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", handler);
    }
  });
};
