import { build, context } from "esbuild";

const USERSCRIPT_HEADER = `// ==UserScript==
// @name         SubScribe - YouTube Transcript Manager
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  YouTube transcript manager with fuzzy search, AI translation, AI summarization, and subtitle overlay
// @author       umitaltintas
// @homepage     https://github.com/umitaltintas/subscribe
// @match        https://www.youtube.com/*
// @icon         data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23FF3B30'/%3E%3Cstop offset='50%25' stop-color='%23FF2D55'/%3E%3Cstop offset='100%25' stop-color='%23AF52DE'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='512' height='512' rx='112' fill='%2309090B'/%3E%3Crect x='160' y='128' width='56' height='256' rx='28' fill='url(%23g)'/%3E%3Crect x='240' y='176' width='56' height='160' rx='28' fill='url(%23g)'/%3E%3Crect x='320' y='224' width='56' height='64' rx='28' fill='url(%23g)'/%3E%3C/svg%3E
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==`;

const buildOptions = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "dist/userscript.js",
  format: "iife",
  target: "es2020",
  banner: { js: USERSCRIPT_HEADER },
  charset: "utf8",
  logLevel: "info",
};

const isWatch = process.argv.includes("--watch");

if (isWatch) {
  const ctx = await context(buildOptions);
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await build(buildOptions);
}
