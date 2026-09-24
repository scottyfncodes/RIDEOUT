import { expect, test } from '@playwright/test';
import { mockNetwork } from './mocks';

const BASE = 'http://localhost:4174/RIDEOUT/';

test.describe('PWA under the GitHub Pages /RIDEOUT/ base path', () => {
  test('app boots and every icon and manifest path resolves', async ({ page, request }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const missing: string[] = [];
    page.on('response', (r) => {
      if (r.url().startsWith('http://localhost:4174/') && r.status() >= 400) missing.push(`${r.status()} ${r.url()}`);
    });
    await mockNetwork(page);
    await page.goto(BASE);
    await expect(page.getByRole('heading', { name: /where should i ride/i })).toBeVisible();

    // Apple / standalone metadata
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'RIDEOUT');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#111512');
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);

    // Resolve every icon link relative to the page URL, exactly as Safari does.
    const hrefs = await page.locator('link[rel="apple-touch-icon"], link[rel="icon"], link[rel="manifest"]').evaluateAll((els) => els.map((e) => (e as HTMLLinkElement).href));
    expect(hrefs.some((h) => h === `${BASE}apple-touch-icon.png`)).toBe(true);
    for (const h of hrefs) expect((await request.get(h)).status(), h).toBe(200);

    const touch = await request.get(`${BASE}apple-touch-icon.png`);
    expect(touch.headers()['content-type']).toBe('image/png');
    const buf = await touch.body();
    // PNG IHDR width/height live at bytes 16–23: iOS wants 180×180.
    expect([buf.readUInt32BE(16), buf.readUInt32BE(20)]).toEqual([180, 180]);

    const manifest = await (await request.get(`${BASE}manifest.webmanifest`)).json();
    expect(manifest).toMatchObject({ display: 'standalone', start_url: './', scope: './', name: 'RIDEOUT' });
    const purposes = manifest.icons.map((i: { purpose: string }) => i.purpose);
    expect(purposes).toEqual(expect.arrayContaining(['any', 'maskable']));
    for (const icon of manifest.icons) {
      const url = new URL(icon.src, `${BASE}manifest.webmanifest`).href;
      expect(url.startsWith(BASE), url).toBe(true);
      const res = await request.get(url);
      expect(res.status(), url).toBe(200);
      if (icon.type === 'image/png') {
        const b = await res.body();
        const [w, h] = icon.sizes.split('x').map(Number);
        expect([b.readUInt32BE(16), b.readUInt32BE(20)], url).toEqual([w, h]);
      }
    }
    expect((await request.get(`${BASE}sw.js`)).status()).toBe(200);

    // Navigate inside the app under the base path.
    await page.goto(`${BASE}#/garage`);
    await expect(page.getByRole('heading', { level: 1, name: 'Garage' })).toBeVisible();
    await page.goto(`${BASE}#/area/apex`);
    await expect(page.getByRole('heading', { level: 1, name: 'Apex Park' })).toBeVisible();

    expect(missing).toEqual([]);
    expect(errors).toEqual([]);
  });
});
