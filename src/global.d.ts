declare const __VERSION__: string;

declare const unsafeWindow: Window & typeof globalThis;

declare function GM_setClipboard(text: string, type?: string): void;
declare function GM_getValue<T = unknown>(key: string, defaultValue?: T): T;
declare function GM_setValue(key: string, value: unknown): void;

interface GMXhrResponse {
  status: number;
  statusText: string;
  responseText: string;
}

interface GMXhrDetails {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  data?: string;
  timeout?: number;
  onload?: (res: GMXhrResponse) => void;
  onerror?: (res: unknown) => void;
  ontimeout?: () => void;
  onabort?: () => void;
}

declare function GM_xmlhttpRequest(details: GMXhrDetails): { abort(): void };

interface Window {
  Fuse: typeof import("fuse.js").default;
}

interface TrustedTypePolicy {
  createHTML(input: string): unknown;
  createScript(input: string): unknown;
  createScriptURL(input: string): unknown;
}

interface TrustedTypePolicyFactory {
  createPolicy(
    name: string,
    rules: {
      createHTML?: (input: string) => string;
      createScript?: (input: string) => string;
      createScriptURL?: (input: string) => string;
    },
  ): TrustedTypePolicy;
}

declare const trustedTypes: TrustedTypePolicyFactory | undefined;
