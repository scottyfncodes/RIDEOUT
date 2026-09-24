// Renders public/icon.svg to the PNG icons the PWA and iOS need, using
// Playwright's Chromium (no network needed). Run: npm run icons
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8');
const executablePath = process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium';

// [file, size, inset]. The art is full-bleed and the trail sits inside the maskable
// 80% safe zone, so the maskable icon needs no inset (an inset would show a hard edge).
const OUT = [
  ['apple-touch-icon.png', 180, 0],
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['icon-maskable-512.png', 512, 0],
  ['favicon-32.png', 32, 0],
];

const browser = await chromium.launch({ executablePath });
const page = await browser.newPage();
for (const [name, size, inset] of OUT) {
  const art = Math.round(size * (1 - inset * 2));
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:#0e1a14;display:grid;place-items:center;width:${size}px;height:${size}px">` +
      svg.replace('<svg ', `<svg width="${art}" height="${art}" `) +
      '</body></html>',
  );
  writeFileSync(new URL(`../public/${name}`, import.meta.url), await page.screenshot({ type: 'png', omitBackground: false }));
}
await browser.close();
console.log('icons written:', OUT.map((o) => o[0]).join(', '));
