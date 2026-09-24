import type { Page } from '@playwright/test';
import { buildPayload, stormyAfternoon } from '../fixtures/openMeteo';
import { osrmTable, overpassArea, overpassBreweries } from '../fixtures/places';
import { ALL_AREAS } from '../../src/content/areas';
import { nowInZone } from '../../src/utils/time';

const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

export interface MockOpts {
  weather?: 'ok' | 'fail';
  routing?: 'ok' | 'fail';
  places?: 'ok' | 'fail';
}

export async function mockNetwork(page: Page, opts: MockOpts = {}) {
  const today = nowInZone('America/Denver').date;
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('https://fonts.gstatic.com/**', (r) => r.fulfill({ status: 200, body: '' }));
  await page.route('https://tile.openstreetmap.org/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG_1PX }));
  await page.route('https://api.open-meteo.com/**', (r) => {
    if (opts.weather === 'fail') return r.fulfill({ status: 503, body: 'down' });
    const body = ALL_AREAS.map((a) => buildPayload({ today, lat: a.trailhead.lat, lon: a.trailhead.lon, days: { 1: stormyAfternoon } }));
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route('https://router.project-osrm.org/**', (r) => {
    if (opts.routing === 'fail') return r.abort();
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(osrmTable(ALL_AREAS.length, (i) => 25 + i * 5)) });
  });
  await page.route(/overpass/, (r) => {
    if (opts.places === 'fail') return r.fulfill({ status: 504, body: '' });
    const q = decodeURIComponent(r.request().url());
    const body = q.includes('around:') ? overpassArea(39.7, -105.2) : overpassBreweries(ALL_AREAS.map((a) => a.trailhead));
    // Area query: shift the fixture to the requested trailhead so distances are realistic.
    const m = /around:25000,([\d.-]+),([\d.-]+)/.exec(q);
    const payload = m ? overpassArea(Number(m[1]), Number(m[2])) : body;
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
}

export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}
