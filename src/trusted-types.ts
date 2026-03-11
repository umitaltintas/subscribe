interface PassthroughPolicy {
  createHTML(s: string): unknown;
  createScriptURL(s: string): unknown;
}

const makePassthrough = (): PassthroughPolicy => ({
  createHTML: (s: string) => s,
  createScriptURL: (s: string) => s,
});

export const policy: PassthroughPolicy =
  typeof trustedTypes !== "undefined" && trustedTypes
    ? trustedTypes.createPolicy("ytc", {
        createHTML: (s: string) => s,
        createScriptURL: (s: string) => s,
      })
    : makePassthrough();
