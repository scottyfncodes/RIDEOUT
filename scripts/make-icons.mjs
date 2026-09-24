// Renders public/icon.svg to PNG icons with Playwright's Chromium (no network needed).
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8');
const executablePath = process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ executablePath });
const page = await browser.newPage();
for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  writeFileSync(new URL(`../public/${name}`, import.meta.url), await page.screenshot({ type: 'png' }));
}
await browser.close();
console.log('icons written');
