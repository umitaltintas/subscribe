import { esc } from "../utils";
import { icons } from "../icons";
import { CONFIG, LANGUAGES } from "../config";
import { getSettings, updateSettings } from "../settings-store";
import { openModal } from "./modal";
import type { SummaryOptions } from "../types";

const DEFAULT_OPTIONS: SummaryOptions = { format: "structured", tone: "neutral", length: "medium" };

/** Last used options, so "Özetle" can skip the dialog when the user wants. */
export const getLastSummaryOptions = (): SummaryOptions => {
  const s = getSettings();
  // The language always follows the setting (which the dialog also updates).
  return { ...DEFAULT_OPTIONS, ...(s.lastSummaryOptions ?? {}), language: s.summaryLanguage };
};

const chips = (group: string, items: readonly { id: string; name: string; description?: string }[], active: string) =>
  `<div class="ytc-opt-chips" role="group" data-group="${group}">${items
    .map(
      (i) =>
        `<button class="ytc-opt-chip" aria-pressed="${i.id === active}" data-value="${esc(i.id)}" ${
          i.description ? `data-desc="${esc(i.description)}"` : ""
        }>${esc(i.name)}</button>`,
    )
    .join("")}</div>`;

/** Asks for summary options. Resolves null if cancelled. Remembers the choice. */
export const showSummaryOptionsPopover = (): Promise<SummaryOptions | null> =>
  new Promise((resolve) => {
    const state = getLastSummaryOptions();
    const lang = state.language ?? "auto";
    let result: SummaryOptions | null = null;
    const formatDesc = (id: string) => CONFIG.AI.SUMMARY_FORMATS.find((f) => f.id === id)?.description ?? "";

    const m = openModal({
      id: "ytc-summary-opts-modal",
      width: 500,
      title: `${icons.sparkles} Özet seçenekleri`,
      body: `<div class="ytc-pad">
        <div class="ytc-opt-group">
          <span class="ytc-opt-label">Format</span>
          ${chips("format", CONFIG.AI.SUMMARY_FORMATS, state.format)}
          <span class="ytc-opt-desc" id="ytc-format-desc">${esc(formatDesc(state.format))}</span>
        </div>
        <div class="ytc-opt-group">
          <span class="ytc-opt-label">Ton</span>
          ${chips("tone", CONFIG.AI.SUMMARY_TONES, state.tone)}
        </div>
        <div class="ytc-opt-group" data-length-group ${state.format === "tldr" ? "hidden" : ""}>
          <span class="ytc-opt-label">Uzunluk</span>
          ${chips("length", CONFIG.AI.SUMMARY_LENGTHS, state.length)}
        </div>
        <div class="ytc-opt-group">
          <label class="ytc-opt-label" for="ytc-summary-lang">Dil</label>
          <select class="ytc-filter" id="ytc-summary-lang" style="max-width:none">
            <option value="auto" ${lang === "auto" ? "selected" : ""}>Videonun dili</option>
            ${LANGUAGES.map((l) => `<option value="${l.code}" ${l.code === lang ? "selected" : ""}>${esc(l.name)}</option>`).join("")}
          </select>
        </div>
      </div>`,
      footer: `<button class="ytc-btn secondary" data-action="cancel">Vazgeç</button>
        <button class="ytc-btn primary" data-action="start">${icons.sparkles} Özetle</button>`,
      onClose: () => resolve(result),
    });

    m.dialog.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-action="cancel"]')) return m.close();

      const chip = target.closest<HTMLElement>(".ytc-opt-chip");
      if (chip) {
        const group = chip.closest<HTMLElement>("[data-group]")!;
        const name = group.dataset.group as "format" | "tone" | "length";
        (state as unknown as Record<string, string>)[name] = chip.dataset.value!;
        group.querySelectorAll(".ytc-opt-chip").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
        if (name === "format") {
          (m.dialog.querySelector("#ytc-format-desc") as HTMLElement).textContent = chip.dataset.desc ?? "";
          (m.dialog.querySelector("[data-length-group]") as HTMLElement).hidden = state.format === "tldr";
        }
        return;
      }

      if (target.closest('[data-action="start"]')) {
        state.language = (m.dialog.querySelector("#ytc-summary-lang") as HTMLSelectElement).value;
        result = { ...state };
        updateSettings({ lastSummaryOptions: result, summaryLanguage: result.language ?? "auto" });
        m.close();
      }
    });
    (m.dialog.querySelector('[data-action="start"]') as HTMLElement).focus();
  });
