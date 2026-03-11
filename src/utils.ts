import type { TextStats } from "./types";

export const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

export const esc = (s: string): string =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] ?? c,
  );

export const debounce = <T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number,
  leading = false,
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T>;

  return (...args: Parameters<T>) => {
    lastArgs = args;

    if (leading && !timeoutId) {
      fn(...args);
    }

    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      if (!leading) fn(...lastArgs);
      timeoutId = null;
    }, ms);
  };
};

export const countStats = (text: string): TextStats => {
  const words = (text.match(/\S+/g) || []).length;
  const chars = text.length;
  return { words, chars, tokens: Math.ceil(words * 1.3) };
};

export const formatDate = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  if (diff < 60000) return "Az önce";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} dk önce`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} saat önce`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} gün önce`;

  return d.toLocaleDateString("tr-TR");
};

export const truncate = (str: string, len: number): string =>
  str.length > len ? str.slice(0, len) + "..." : str;
