import { $, setHTML, injectStyles, showToast } from "../dom";
import { esc } from "../utils";
import { icons } from "../icons";
import { CONFIG } from "../config";
import type { AISettings } from "../types";

const STORAGE_KEY = "ytc-ai-settings";

const loadSettings = (): Partial<AISettings> => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
};

const saveSettings = (settings: AISettings): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

const injectSettingsStyles = (): void => {
  if (document.querySelector("#ytc-settings-styles")) return;
  const style = document.createElement("style");
  style.id = "ytc-settings-styles";
  style.textContent = `
    .ytc-settings-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:999998;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)}
    .ytc-settings-field{margin-bottom:16px}
    .ytc-settings-field label{display:block;font-size:13px;font-weight:500;color:var(--ytc-muted);margin-bottom:6px}
    .ytc-settings-input{width:100%;padding:10px 14px;border:1px solid var(--ytc-border);border-radius:10px;background:rgba(255,255,255,.05);color:#fff;font-size:14px;outline:none;box-sizing:border-box}
    .ytc-settings-input:focus{border-color:var(--ytc-primary);background:rgba(255,255,255,.08)}
    .ytc-settings-input::placeholder{color:var(--ytc-muted)}
    .ytc-settings-input-wrap{position:relative;display:flex;align-items:center}
    .ytc-settings-input-wrap input{padding-right:40px}
    .ytc-settings-toggle-vis{position:absolute;right:8px;background:none;border:0;color:var(--ytc-muted);cursor:pointer;padding:4px;border-radius:6px;display:flex;align-items:center}
    .ytc-settings-toggle-vis:hover{color:#fff;background:rgba(255,255,255,.1)}
    select.ytc-settings-input{cursor:pointer;appearance:auto}
  `;
  document.head.appendChild(style);
};

export const openSettings = (): void => {
  injectStyles();
  injectSettingsStyles();
  ($(".ytc-settings-backdrop") as HTMLElement)?.remove();

  const settings = loadSettings();
  const currentModel = settings.model || CONFIG.AI.DEFAULT_MODEL;
  const currentLang = settings.targetLanguage || CONFIG.AI.DEFAULT_TARGET_LANG;
  const currentKey = settings.apiKey || "";

  const backdrop = document.createElement("div");
  backdrop.className = "ytc-settings-backdrop";
  setHTML(
    backdrop,
    `
    <div class="ytc-modal" style="width:min(500px,95vw)">
      <div class="ytc-modal-header">
        <h2>${icons.settings} AI Çeviri Ayarları</h2>
        <button class="ytc-modal-close">${icons.x}</button>
      </div>
      <div class="ytc-modal-body" style="padding:20px">
        <div class="ytc-settings-field">
          <label>OpenRouter API Anahtarı</label>
          <div class="ytc-settings-input-wrap">
            <input type="password" class="ytc-settings-input" id="ytc-ai-key" placeholder="sk-or-..." value="${esc(currentKey)}">
            <button class="ytc-settings-toggle-vis" data-action="toggle-key" title="Göster/Gizle">${icons.eye}</button>
          </div>
        </div>
        <div class="ytc-settings-field">
          <label>Model</label>
          <input type="text" class="ytc-settings-input" id="ytc-ai-model" placeholder="${esc(CONFIG.AI.DEFAULT_MODEL)}" value="${esc(currentModel)}">
        </div>
        <div class="ytc-settings-field">
          <label>Hedef Dil</label>
          <select class="ytc-settings-input" id="ytc-ai-lang">
            ${CONFIG.AI.AVAILABLE_LANGUAGES.map(
              (lang) =>
                `<option value="${esc(lang.code)}" ${lang.code === currentLang ? "selected" : ""}>${esc(lang.name)}</option>`,
            ).join("")}
          </select>
        </div>
      </div>
      <div class="ytc-modal-footer">
        <button class="ytc-btn secondary" data-action="cancel">Vazgeç</button>
        <button class="ytc-btn" data-action="save">${icons.check} Kaydet</button>
      </div>
    </div>
  `,
  );

  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();

  backdrop.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;

    if (
      target === backdrop ||
      target.closest(".ytc-modal-close") ||
      target.closest('[data-action="cancel"]')
    )
      close();

    if (target.closest('[data-action="toggle-key"]')) {
      const input = backdrop.querySelector("#ytc-ai-key") as HTMLInputElement;
      input.type = input.type === "password" ? "text" : "password";
    }

    if (target.closest('[data-action="save"]')) {
      const apiKey = (backdrop.querySelector("#ytc-ai-key") as HTMLInputElement).value.trim();
      const model = (backdrop.querySelector("#ytc-ai-model") as HTMLInputElement).value.trim() || CONFIG.AI.DEFAULT_MODEL;
      const targetLanguage = (backdrop.querySelector("#ytc-ai-lang") as HTMLSelectElement).value;

      saveSettings({
        apiKey,
        provider: "openrouter",
        model,
        targetLanguage,
      });

      close();
      showToast("Ayarlar kaydedildi");
    }
  });

  document.addEventListener("keydown", function handler(e) {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", handler);
    }
  });
};
