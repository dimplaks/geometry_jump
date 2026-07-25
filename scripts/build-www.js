#!/usr/bin/env node
/**
 * Copy static game assets into www/ for Capacitor.
 * Injects window.__GJ_API_BASE__ from env GJ_API_BASE (production Render URL).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const WWW = path.join(ROOT, "www");
const API_BASE = (
  process.env.GJ_API_BASE ||
  process.env.API_BASE ||
  "https://geometry-jump.onrender.com"
).replace(/\/+$/, "");

const FILES = ["index.html", "editor.html", "styles.css", "editor.css"];
const DIRS = ["js"];

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    const st = fs.statSync(from);
    if (st.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function injectApiBase(html) {
  const snippet = `<script>window.__GJ_API_BASE__=${JSON.stringify(API_BASE)};</script>\n`;
  if (html.includes("__GJ_API_BASE__")) {
    return html.replace(
      /<script>window\.__GJ_API_BASE__=.*?<\/script>\n?/,
      snippet
    );
  }
  return html.replace("<head>", `<head>\n  ${snippet}`);
}

rmrf(WWW);
fs.mkdirSync(WWW, { recursive: true });

for (const file of FILES) {
  const src = path.join(ROOT, file);
  if (!fs.existsSync(src)) continue;
  let content = fs.readFileSync(src, "utf8");
  if (file.endsWith(".html")) content = injectApiBase(content);
  fs.writeFileSync(path.join(WWW, file), content);
}

for (const dir of DIRS) {
  copyDir(path.join(ROOT, dir), path.join(WWW, dir));
}

console.log(`www/ built. API_BASE=${API_BASE || "(same-origin / empty)"}`);
