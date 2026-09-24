import type { Source } from '../../content/types';
import { cacheGet, cacheSet, fetchJson } from '../cache';
import type { Fetched, Place, PlaceCategory } from '../types';
import type { LatLon } from '../../utils/geo';

/**
 * OpenStreetMap / Overpass adapter for bike shops, apres spots and parking.
 * Keyless and live. We only surface tags that exist on the OSM object; hours,
 * patio, dog policy etc. are shown as "not listed" when absent — never inferred.
 */

export const OSM_SOURCE: Source = {
  label: 'OpenStreetMap contributors via Overpass API',
  url: 'https://www.openstreetmap.org/copyright',
  confidence: 'reported',
};

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

async function runOverpass(query: string): Promise<unknown> {
  let lastErr: unknown;
  for (const ep of ENDPOINTS) {
    try {
      return await fetchJson(`${ep}?data=${encodeURIComponent(query)}`, { timeoutMs: 25_000 });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Overpass unavailable');
}

export function categorize(tags: Record<string, string>): PlaceCategory[] {
  const cats = new Set<PlaceCategory>();
  const amenity = tags.amenity ?? '';
  const cuisine = (tags.cuisine ?? '').toLowerCase();
  const name = tags.name ?? '';
  if (tags.shop === 'bicycle') cats.add('bike');
  if (tags.craft === 'brewery' || tags.microbrewery === 'yes' || (/(pub|bar|restaurant|biergarten)/.test(amenity) && /\bbrew/i.test(name)))
    cats.add('brewery');
  if (amenity === 'restaurant' || amenity === 'fast_food' || amenity === 'food_court') cats.add('food');
  if (/mexican|tex-mex|burrito|taco/.test(cuisine)) cats.add('mexican');
  if (/pizza/.test(cuisine)) cats.add('pizza');
  if (amenity === 'cafe' || /coffee/.test(cuisine)) cats.add('coffee');
  if (amenity === 'ice_cream' || /ice_cream|dessert|frozen_yogurt|donut|bakery/.test(cuisine) || tags.shop === 'bakery') cats.add('dessert');
  if (amenity === 'parking') cats.add('parking');
  return [...cats];
}

export function parseElements(raw: unknown): Place[] {
  const els = (raw as { elements?: unknown[] })?.elements;
  if (!Array.isArray(els)) throw new Error('Bad Overpass response');
  const out: Place[] = [];
  const seen = new Set<string>();
  for (const e of els as Array<Record<string, unknown>>) {
    const tags = (e.tags ?? {}) as Record<string, string>;
    const center = (e.center ?? {}) as { lat?: number; lon?: number };
    const lat = typeof e.lat === 'number' ? e.lat : center.lat;
    const lon = typeof e.lon === 'number' ? e.lon : center.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    const cats = categorize(tags);
    if (!cats.length) continue;
    const id = `${e.type}/${e.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name: tags.name ?? (cats.includes('parking') ? 'Parking' : 'Unnamed'), lat, lon, categories: cats, tags });
  }
  return out;
}

const around = (r: number, p: LatLon) => `around:${r},${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;

export function buildAreaQuery(trailhead: LatLon, hub?: LatLon): string {
  const pts = [trailhead, ...(hub ? [hub] : [])];
  const parts: string[] = [];
  parts.push(`nwr(${around(25000, trailhead)})[shop=bicycle];`);
  if (hub) parts.push(`nwr(${around(5000, hub)})[shop=bicycle];`);
  for (const p of pts) {
    const near = p === trailhead ? 12000 : 4000;
    const food = p === trailhead ? 6000 : 2500;
    parts.push(`nwr(${around(near, p)})[craft=brewery];`);
    parts.push(`nwr(${around(near, p)})[microbrewery=yes];`);
    parts.push(`nwr(${around(food, p)})[amenity~"^(restaurant|fast_food|cafe|ice_cream|pub|bar|biergarten)$"][name];`);
  }
  parts.push(`nwr(${around(1200, trailhead)})[amenity=parking];`);
  return `[out:json][timeout:25];(${parts.join('')});out center tags;`;
}

export async function fetchAreaPlaces(areaId: string, trailhead: LatLon, hub?: LatLon): Promise<Fetched<Place[]>> {
  const key = `places:${areaId}`;
  const cached = cacheGet<Place[]>(key, 24 * 3600 * 1000);
  if (cached) return { ok: true, data: cached.value, source: OSM_SOURCE, fetchedAt: new Date(cached.at).toISOString(), fromCache: true };
  try {
    const places = parseElements(await runOverpass(buildAreaQuery(trailhead, hub)));
    cacheSet(key, places);
    return { ok: true, data: places, source: OSM_SOURCE, fetchedAt: new Date().toISOString(), fromCache: false };
  } catch (e) {
    return { ok: false, error: `Nearby places unavailable (${(e as Error).message})`, source: OSM_SOURCE };
  }
}

/** One regional query for breweries, used to rank Bike + Brewery rides. */
export async function fetchRegionalBreweries(bbox: [number, number, number, number]): Promise<Fetched<Place[]>> {
  const key = `breweries:${bbox.join(',')}`;
  const cached = cacheGet<Place[]>(key, 3 * 24 * 3600 * 1000);
  if (cached) return { ok: true, data: cached.value, source: OSM_SOURCE, fetchedAt: new Date(cached.at).toISOString(), fromCache: true };
  const b = bbox.join(',');
  const q = `[out:json][timeout:25];(nwr[craft=brewery](${b});nwr[microbrewery=yes](${b}););out center tags;`;
  try {
    const places = parseElements(await runOverpass(q)).filter((p) => p.categories.includes('brewery'));
    cacheSet(key, places);
    return { ok: true, data: places, source: OSM_SOURCE, fetchedAt: new Date().toISOString(), fromCache: false };
  } catch (e) {
    return { ok: false, error: `Brewery data unavailable (${(e as Error).message})`, source: OSM_SOURCE };
  }
}

export function osmUrl(id: string): string {
  return `https://www.openstreetmap.org/${id}`;
}
