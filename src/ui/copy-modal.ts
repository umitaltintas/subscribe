import { setHTML, showToast } from "../dom";
import { esc, countStats } from "../utils";
import { icons } from "../icons";
import { db } from "../db";
import { getVideoInfo, getTranscriptText } from "../transcript";
import { updateNavbarBadge, refreshVideoActions } from "./navbar";
import { openModal } from "./modal";

export const showCopyModal = async (): Promise<void> => {
  const videoInfo = getVideoInfo();
  const existing = await db.get(videoInfo.id);
  const lastFormat = existing?.format ?? "text";

  const m = openModal({
    id: "ytc-copy-modal",
    width: 560,
    title: `${icons.clipboard} Transkripti kopyala`,
    body: `<div class="ytc-pad">
      <div class="ytc-section">
        <div class="ytc-section-title">${icons.fileText} Format</div>
        <div class="ytc-options" role="radiogroup">
          <label class="ytc-option">
            <input type="radio" name="fmt" value="text" ${lastFormat === "text" ? "checked" : ""}>
            <div class="ytc-option-text">
              <div class="ytc-option-title">${icons.text} Sadece metin</div>
              <div class="ytc-option-desc">Temiz metin; LLM'lere yapıştırmak için ideal</div>
            </div>
          </label>
          <label class="ytc-option">
            <input type="radio" name="fmt" value="time" ${lastFormat === "time" ? "checked" : ""}>
            <div class="ytc-option-text">
              <div class="ytc-option-title">${icons.timer} Zaman damgalı</div>
              <div class="ytc-option-desc">[0:00] formatında, her satır zaman bilgisiyle</div>
            </div>
          </label>
        </div>
        <div class="ytc-help">${icons.info} Çeviri ve altyazı için zaman damgaları her iki durumda da saklanır.</div>
      </div>

      <div class="ytc-section">
        <label class="ytc-section-title" for="ytc-tag-input">${icons.tag} Etiketler <span style="text-transform:none;font-weight:400">(isteğe bağlı)</span></label>
        <div class="ytc-tags-input">
          <div class="ytc-selected-tags"></div>
          <input type="text" placeholder="Etiket yazıp Enter'a basın" id="ytc-tag-input" list="ytc-tag-suggestions" autocomplete="off">
          <datalist id="ytc-tag-suggestions"></datalist>
        </div>
      </div>

      <div class="ytc-section" style="margin-bottom:0">
        <label class="ytc-option" style="padding:10px 14px">
          <input type="checkbox" id="ytc-favorite" ${existing?.favorite ? "checked" : ""}>
          <div class="ytc-option-text"><div class="ytc-option-title">${icons.star} Favorilere ekle</div></div>
        </label>
      </div>
    </div>`,
    footer: `${existing ? `<span class="ytc-help" style="margin:0">${icons.check} Bu video kütüphanede kayıtlı</span>` : ""}
      <span class="ytc-footer-spacer"></span>
      <button class="ytc-btn secondary" data-action="cancel">Vazgeç</button>
      <button class="ytc-btn primary" data-action="copy">${icons.clipboard} ${existing ? "Kopyala ve güncelle" : "Kopyala ve kaydet"}</button>`,
  });

  const tagInput = m.dialog.querySelector("#ytc-tag-input") as HTMLInputElement;
  const selectedTagsEl = m.dialog.querySelector(".ytc-selected-tags") as HTMLElement;
  let selectedTags = existing?.tags ? [...existing.tags] : [];

  void db.getAllTags().then((tags) =>
    setHTML(
      m.dialog.querySelector("#ytc-tag-suggestions")!,
      tags.map((t) => `<option value="${esc(t)}"></option>`).join(""),
    ),
  );

  const renderTags = () =>
    setHTML(
      selectedTagsEl,
      selectedTags
        .map((t) => `<button class="ytc-tag removable" data-tag="${esc(t)}" aria-label="${esc(t)} etiketini kaldır">${esc(t)} ${icons.x}</button>`)
        .join(""),
    );
  renderTags();

  const addTag = () => {
    const tag = tagInput.value.trim().toLowerCase().replace(/,+$/, "");
    if (tag && !selectedTags.includes(tag)) {
      selectedTags.push(tag);
      renderTags();
    }
    tagInput.value = "";
  };

  tagInput.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === ",") && tagInput.value.trim()) {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && !tagInput.value && selectedTags.length) {
      selectedTags.pop();
      renderTags();
    }
  });

  const doCopy = async () => {
    if (tagInput.value.trim()) addTag();
    const fmt = (m.dialog.querySelector('input[name="fmt"]:checked') as HTMLInputElement).value as "text" | "time";
    const favorite = (m.dialog.querySelector("#ytc-favorite") as HTMLInputElement).checked;
    const text = getTranscriptText(fmt === "time");
    if (!text) return showToast("Transkript okunamadı, paneli açıp tekrar deneyin", "error");
    const timed = fmt === "time" ? text : getTranscriptText(true);
    const stats = countStats(text);

    // Merge in one transaction against the *current* record: a translation or
    // summary may have been saved while this dialog was open.
    const current = await db.get(videoInfo.id);
    await db.upsert({
      ...videoInfo,
      ...stats,
      transcript: text,
      // Keep a timed copy for translation; never wipe an existing one.
      timedTranscript: fmt === "text" ? timed || current?.timedTranscript : undefined,
      format: fmt,
      favorite,
      tags: selectedTags,
      date: new Date().toISOString(),
      copyCount: (current?.copyCount || 0) + 1,
    });
    GM_setClipboard(text);
    m.close();
    showToast(`Kopyalandı · ${stats.words.toLocaleString("tr-TR")} kelime, ~${stats.tokens.toLocaleString("tr-TR")} token`);
    void updateNavbarBadge();
    void refreshVideoActions();
  };

  m.dialog.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const tag = target.closest<HTMLElement>("[data-tag]");
    if (tag?.dataset.tag) {
      selectedTags = selectedTags.filter((t) => t !== tag.dataset.tag);
      renderTags();
      tagInput.focus();
      return;
    }
    if (target.closest('[data-action="cancel"]')) m.close();
    if (target.closest('[data-action="copy"]')) void doCopy();
  });
};
