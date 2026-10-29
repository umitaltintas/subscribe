import { showToast } from "../dom";
import { hasApiKey } from "../settings-store";
import { openSettings } from "./settings";

/** Returns true if an API key is set; otherwise explains why and offers to open settings. */
export const requireApiKey = (): boolean => {
  if (hasApiKey()) return true;
  showToast("Bu özellik için OpenRouter API anahtarı gerekli", "info", undefined, {
    label: "Ayarları aç",
    onClick: openSettings,
  });
  return false;
};
