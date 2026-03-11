import { marked } from "marked";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import type { TextStats } from "./types";

marked.setOptions({ async: false, gfm: true, breaks: true });

export const mdToHtml = (md: string): string => marked.parse(md) as string;

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
  const diff = Date.now() - d.getTime();

  if (diff > 604800000) return d.toLocaleDateString("tr-TR");

  return formatDistanceToNow(d, { addSuffix: true, locale: tr });
};

export const truncate = (str: string, len: number): string =>
  str.length > len ? str.slice(0, len) + "..." : str;
