declare function GM_setClipboard(text: string, type?: string): void;

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
