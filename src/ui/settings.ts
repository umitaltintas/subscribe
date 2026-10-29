import { setHTML, showToast } from "../dom";
import { esc } from "../utils";
import { icons } from "../icons";
import { CONFIG, LANGUAGES } from "../config";
import { getSettings, updateSettings } from "../settings-store";
import { checkApiKey, listModels, type ModelInfo } from "../openrouter";
import { applySubtitleSettings, injectOverlayStyles, formatOffset, OFFSET_LIMIT } from "../subtitle-overlay";
import { openModal } from "./modal";
import type { SubtitleSettings } from "../types";

const langOptions = (selected: string, withAuto = false) =>
  (withAuto ? `<option value="auto" ${selected === "auto" ? "selected" : ""}>Videonun dili</option>` : "") +
  LANGUAGES.map((l) => `<option value="${l.code}" ${l.code === selected ? "selected" : ""}>${esc(l.name)}</option>`).join("");

const price = (m: ModelInfo) =>
  m.promptPrice === 0 && m.completionPrice === 0
    ? "ücretsiz"
    : `$${m.promptPrice.toFixed(2)} giriş / $${m.completionPrice.toFixed(2)} çıkış (1M token)`;

export const openSettings = (): void => {
  const s = getSettings();
  injectOverlayStyles();

  const m = openModal({
    id: "ytc-settings-modal",
    width: 560,
    title: `${icons.settings} SubScribe ayarları`,
    body: `<div class="ytc-pad">
      <section class="ytc-settings-group">
        <h3>${icons.sparkles} Yapay zekâ (OpenRouter)</h3>
        <div class="ytc-field">
          <div class="ytc-field-label"><label for="ytc-ai-key">API anahtarı</label><a href="https://openrouter.ai/keys" target="_blank" rel="noopener">Anahtar al ↗</a></div>
          <div style="display:flex;gap:8px">
            <div class="ytc-input-wrap" style="flex:1">
              <input type="password" class="ytc-input" id="ytc-ai-key" placeholder="sk-or-v1-…" autocomplete="off" spellcheck="false" value="${esc(s.apiKey)}">
              <button class="ytc-input-icon" data-action="toggle-key" aria-label="Anahtarı göster/gizle" title="Göster/Gizle">${icons.eye}</button>
            </div>
            <button class="ytc-btn secondary" data-action="test-key">Test et</button>
          </div>
          <div class="ytc-status" id="ytc-key-status">Anahtar yalnızca userscript deposunda saklanır, YouTube sayfası erişemez.</div>
        </div>
        <div class="ytc-field" style="margin-bottom:0">
          <div class="ytc-field-label"><label for="ytc-ai-model">Model</label><a href="https://openrouter.ai/models" target="_blank" rel="noopener">Modellere göz at ↗</a></div>
          <input type="text" class="ytc-input" id="ytc-ai-model" list="ytc-model-list" placeholder="${esc(CONFIG.AI.DEFAULT_MODEL)}" value="${esc(s.model)}" spellcheck="false">
          <datalist id="ytc-model-list"></datalist>
          <div class="ytc-status" id="ytc-model-status"></div>
        </div>
      </section>

      <section class="ytc-settings-group">
        <h3>${icons.translate} Diller</h3>
        <div class="ytc-grid-2">
          <div class="ytc-field" style="margin:0">
            <label for="ytc-ai-lang">Çeviri dili</label>
            <select class="ytc-filter" id="ytc-ai-lang" style="width:100%;max-width:none">${langOptions(s.targetLanguage)}</select>
          </div>
          <div class="ytc-field" style="margin:0">
            <label for="ytc-summary-lang">Özet dili</label>
            <select class="ytc-filter" id="ytc-summary-lang" style="width:100%;max-width:none">${langOptions(s.summaryLanguage, true)}</select>
          </div>
        </div>
      </section>

      <section class="ytc-settings-group" style="margin-bottom:0">
        <h3>${icons.subtitles} Altyazı görünümü</h3>
        <div class="ytc-grid-2">
          <div class="ytc-field">
            <label for="ytc-sub-scale">Boyut <span id="ytc-sub-scale-val" style="color:var(--ytc-muted);font-weight:400">${s.subtitles.scale}%</span></label>
            <input type="range" class="ytc-range" id="ytc-sub-scale" min="60" max="200" step="10" value="${s.subtitles.scale}">
          </div>
          <div class="ytc-field">
            <label for="ytc-sub-bg">Arka plan <span id="ytc-sub-bg-val" style="color:var(--ytc-muted);font-weight:400">${Math.round(s.subtitles.background * 100)}%</span></label>
            <input type="range" class="ytc-range" id="ytc-sub-bg" min="0" max="1" step="0.05" value="${s.subtitles.background}">
          </div>
        </div>
        <div class="ytc-field" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div class="ytc-opt-chips" role="group" aria-label="Renk" data-group="color">
            <button class="ytc-opt-chip" data-value="yellow" aria-pressed="${s.subtitles.color === "yellow"}">Sarı</button>
            <button class="ytc-opt-chip" data-value="white" aria-pressed="${s.subtitles.color === "white"}">Beyaz</button>
          </div>
          <label class="ytc-check"><input type="checkbox" id="ytc-sub-bilingual" ${s.subtitles.bilingual ? "checked" : ""}> Orijinal metni de göster</label>
        </div>
        <div class="ytc-field">
          <label for="ytc-sub-offset">Zamanlama <span style="display:inline-flex;gap:8px;align-items:center"><span id="ytc-sub-offset-val" style="color:var(--ytc-muted);font-weight:400"></span><button class="ytc-btn small ghost" data-action="reset-offset" style="padding:2px 8px">Sıfırla</button></span></label>
          <input type="range" class="ytc-range" id="ytc-sub-offset" min="${-OFFSET_LIMIT}" max="${OFFSET_LIMIT}" step="0.1" value="${s.subtitles.offset}" aria-describedby="ytc-offset-help">
          <div class="ytc-help" id="ytc-offset-help">Altyazı erken geliyorsa sağa, geç geliyorsa sola kaydırın. Video izlerken <kbd>[</kbd> / <kbd>]</kbd> tuşlarıyla 0,1 sn (Shift ile 0,5 sn) ayarlanır, <kbd>&#92;</kbd> sıfırlar. Türkçe Q klavyede bu tuşlar ğ / ü / , konumundadır.</div>
        </div>
        <div class="ytc-sub-preview" id="ytc-sub-preview" aria-hidden="true">
          <span class="ytc-subtitle-line">Bugün yapay zekâdan bahsedeceğiz.</span>
          <span class="ytc-subtitle-line original" ${s.subtitles.bilingual ? "" : "hidden"}>Today we're going to talk about AI.</span>
        </div>
      </section>
    </div>`,
    footer: `<span class="ytc-help" style="margin:0">v${esc(CONFIG.VERSION)}</span><span class="ytc-footer-spacer"></span>
      <button class="ytc-btn secondary" data-action="cancel">Vazgeç</button>
      <button class="ytc-btn primary" data-action="save">${icons.check} Kaydet</button>`,
  });

  const q = <T extends HTMLElement>(sel: string) => m.dialog.querySelector(sel) as T;
  const keyInput = q<HTMLInputElement>("#ytc-ai-key");
  const modelInput = q<HTMLInputElement>("#ytc-ai-model");
  const keyStatus = q<HTMLElement>("#ytc-key-status");
  const modelStatus = q<HTMLElement>("#ytc-model-status");
  const preview = q<HTMLElement>("#ytc-sub-preview");
  const sub: SubtitleSettings = { ...s.subtitles };

  const renderPreview = () => {
    applySubtitleSettings(preview, sub);
    (preview.querySelector(".original") as HTMLElement).hidden = !sub.bilingual;
    q<HTMLElement>("#ytc-sub-scale-val").textContent = `${sub.scale}%`;
    q<HTMLElement>("#ytc-sub-bg-val").textContent = `${Math.round(sub.background * 100)}%`;
    q<HTMLElement>("#ytc-sub-offset-val").textContent =
      sub.offset === 0 ? "ayar yok" : `${formatOffset(sub.offset)} ${sub.offset > 0 ? "(geç)" : "(erken)"}`;
  };
  renderPreview();

  const setStatus = (el: HTMLElement, kind: "ok" | "err" | "", html: string) => {
    el.className = `ytc-status ${kind}`;
    setHTML(el, html);
  };

  // Model list + price hint (public endpoint, no key needed).
  let models: ModelInfo[] = [];
  const describeModel = () => {
    const id = modelInput.value.trim() || CONFIG.AI.DEFAULT_MODEL;
    const info = models.find((x) => x.id === id);
    if (!models.length) return;
    if (info) {
      setStatus(
        modelStatus,
        "",
        `${esc(info.name)} · ${esc(price(info))}${info.contextLength ? ` · ${Math.round(info.contextLength / 1000)}K bağlam` : ""}`,
      );
    } else {
      setStatus(modelStatus, "err", `${icons.circleX} OpenRouter'da bu ID'ye sahip bir model yok`);
    }
  };
  listModels()
    .then((list) => {
      models = list;
      setHTML(
        q<HTMLElement>("#ytc-model-list"),
        list.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join(""),
      );
      describeModel();
    })
    .catch(() => setStatus(modelStatus, "", "Model listesi alınamadı; ID'yi elle girebilirsiniz."));
  modelInput.addEventListener("input", describeModel);

  const testKey = async () => {
    const key = keyInput.value.trim();
    if (!key) return setStatus(keyStatus, "err", `${icons.circleX} Önce anahtarı girin`);
    setStatus(keyStatus, "", `<span class="ytc-spinner inline"></span> Kontrol ediliyor…`);
    try {
      const info = await checkApiKey(key);
      const limit = info.limit != null ? ` / $${info.limit.toFixed(2)} limit` : "";
      setStatus(keyStatus, "ok", `${icons.circleCheck} Anahtar geçerli · kullanılan $${info.usage.toFixed(3)}${limit}`);
    } catch (err) {
      setStatus(keyStatus, "err", `${icons.circleX} ${esc((err as Error).message)}`);
    }
  };

  m.dialog.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === "ytc-sub-scale") sub.scale = Number(t.value);
    else if (t.id === "ytc-sub-bg") sub.background = Number(t.value);
    else if (t.id === "ytc-sub-offset") sub.offset = Math.round(Number(t.value) * 10) / 10;
    else if (t.id === "ytc-sub-bilingual") sub.bilingual = t.checked;
    else return;
    renderPreview();
  });

  m.dialog.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-action="cancel"]')) return m.close();
    if (target.closest('[data-action="toggle-key"]')) {
      keyInput.type = keyInput.type === "password" ? "text" : "password";
      return;
    }
    if (target.closest('[data-action="test-key"]')) return void testKey();
    if (target.closest('[data-action="reset-offset"]')) {
      sub.offset = 0;
      q<HTMLInputElement>("#ytc-sub-offset").value = "0";
      renderPreview();
      return;
    }

    const chip = target.closest<HTMLElement>('[data-group="color"] .ytc-opt-chip');
    if (chip) {
      sub.color = chip.dataset.value as SubtitleSettings["color"];
      chip.parentElement!.querySelectorAll(".ytc-opt-chip").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
      renderPreview();
      return;
    }

    if (target.closest('[data-action="save"]')) {
      updateSettings({
        apiKey: keyInput.value.trim(),
        model: modelInput.value.trim() || CONFIG.AI.DEFAULT_MODEL,
        targetLanguage: q<HTMLSelectElement>("#ytc-ai-lang").value,
        summaryLanguage: q<HTMLSelectElement>("#ytc-summary-lang").value,
        subtitles: sub,
      });
      m.close();
      showToast("Ayarlar kaydedildi");
    }
  });

  if (!s.apiKey) keyInput.focus();
};
