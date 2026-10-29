export interface HttpResponse {
  status: number;
  ok: boolean;
  text: string;
}

export interface HttpRequest {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export class AbortError extends Error {
  constructor() {
    super("İşlem iptal edildi");
    this.name = "AbortError";
  }
}

export const isAbortError = (err: unknown): boolean =>
  err instanceof Error && err.name === "AbortError";

const hasGMXhr = typeof GM_xmlhttpRequest === "function";

/**
 * Cross-origin request. Uses GM_xmlhttpRequest when available so requests are
 * not subject to YouTube's CSP and do not carry youtube.com as Origin;
 * falls back to fetch otherwise.
 */
export const request = (url: string, req: HttpRequest = {}): Promise<HttpResponse> => {
  const { method = "GET", headers = {}, body, signal, timeoutMs = 120_000 } = req;
  if (signal?.aborted) return Promise.reject(new AbortError());

  if (!hasGMXhr) {
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    return fetch(url, { method, headers, body, signal: ctrl.signal })
      .then(async (res) => ({ status: res.status, ok: res.ok, text: await res.text() }))
      .catch((err) => {
        if (signal?.aborted) throw new AbortError();
        if (ctrl.signal.aborted) throw new Error("İstek zaman aşımına uğradı");
        throw err;
      })
      .finally(() => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      });
  }

  return new Promise((resolve, reject) => {
    const handle = GM_xmlhttpRequest({
      method,
      url,
      headers,
      data: body,
      timeout: timeoutMs,
      onload: (res) => {
        cleanup();
        resolve({ status: res.status, ok: res.status >= 200 && res.status < 300, text: res.responseText });
      },
      onerror: () => {
        cleanup();
        reject(new Error("Ağ hatası: sunucuya ulaşılamadı"));
      },
      ontimeout: () => {
        cleanup();
        reject(new Error("İstek zaman aşımına uğradı"));
      },
      onabort: () => {
        cleanup();
        reject(new AbortError());
      },
    });
    const onAbort = () => {
      handle.abort();
      cleanup();
      reject(new AbortError());
    };
    const cleanup = () => signal?.removeEventListener("abort", onAbort);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
};

export const sleepAbortable = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new AbortError());
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new AbortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
