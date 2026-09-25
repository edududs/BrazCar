#!/usr/bin/env node
// Renders the app icons from the mark: `cd web && node ../scripts/app-icons.mjs`.
//
// `web/public/icon.svg` is the source, the symbol on a full-bleed brand square: iOS and Android
// round the corners themselves (and the maskable icon needs the bleed), so the square is what
// every PNG holds. `favicon.svg` is the same drawing with the corners already rounded, for the
// browser tab. The PNGs are committed; run this only when the mark changes.

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "web",
);
// Playwright is the front's dependency, so it is resolved from there, wherever this script runs.
const { chromium } = createRequire(path.join(web, "package.json"))(
  "playwright",
);
const publicDir = path.join(web, "public");
const svg = readFileSync(path.join(publicDir, "icon.svg"), "utf8");

const icons = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
];

const browser = await chromium.launch();
try {
  for (const { file, size } of icons) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
    });
    await page.setContent(
      `<!doctype html><body style="margin:0">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body>`,
    );
    writeFileSync(
      path.join(publicDir, file),
      await page.screenshot({ omitBackground: true }),
    );
    await page.close();
    process.stdout.write(`${file}: ${size}×${size}\n`);
  }
} finally {
  await browser.close();
}
