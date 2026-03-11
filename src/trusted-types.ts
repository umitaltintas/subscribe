import DOMPurify from "dompurify";

if (typeof trustedTypes !== "undefined" && trustedTypes) {
  DOMPurify.setConfig({ RETURN_TRUSTED_TYPE: true });
}

export const sanitize = (html: string): string =>
  DOMPurify.sanitize(html, {
    ADD_TAGS: ["svg", "path", "circle", "ellipse", "line", "polyline", "polygon", "rect"],
    ADD_ATTR: [
      "viewBox", "fill", "stroke", "stroke-width", "stroke-linecap",
      "stroke-linejoin", "d", "cx", "cy", "r", "rx", "ry", "x", "y",
      "x1", "x2", "y1", "y2", "width", "height", "points", "xmlns",
    ],
  }) as unknown as string;
