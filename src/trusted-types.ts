import DOMPurify from "dompurify";

// Config is passed per call: once DOMPurify.setConfig() has run, per-call
// options (ADD_TAGS/ADD_ATTR) are ignored, which silently dropped "target".
const CONFIG = {
  ADD_TAGS: ["svg", "path", "circle", "ellipse", "line", "polyline", "polygon", "rect"],
  ADD_ATTR: [
    "viewBox", "fill", "stroke", "stroke-width", "stroke-linecap",
    "stroke-linejoin", "d", "cx", "cy", "r", "rx", "ry", "x", "y",
    "x1", "x2", "y1", "y2", "width", "height", "points", "xmlns", "target",
  ],
  // YouTube enforces Trusted Types; innerHTML then needs a TrustedHTML value.
  RETURN_TRUSTED_TYPE: typeof trustedTypes !== "undefined" && !!trustedTypes,
};

export const sanitize = (html: string): string =>
  DOMPurify.sanitize(html, CONFIG) as unknown as string;
