import { build, context } from "esbuild";

const USERSCRIPT_HEADER = `// ==UserScript==
// @name         SubScribe - YouTube Transcript Manager
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  YouTube transcript manager with fuzzy search, AI translation, AI summarization, and subtitle overlay
// @author       umitaltintas
// @homepage     https://github.com/umitaltintas/subscribe
// @match        https://www.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
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
