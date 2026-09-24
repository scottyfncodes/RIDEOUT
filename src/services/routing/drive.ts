import type { Source } from '../../content/types';
import { cacheGet, cacheSet, fetchJson } from '../cache';
import type { DriveInfo } from '../types';
import { estimateDrive, type LatLon } from '../../utils/geo';

/**
 * Driving time/distance adapter.
 * Primary: OSRM public demo server (keyless, road network from OpenStreetMap, no live traffic).
 * Fallback: straight-line estimate, labelled as such. To use Google Routes with traffic,
 * implement the same function behind a server-side proxy — never ship a key to the client.
 */

export const OSRM_SOURCE: Source = {
  label: 'OSRM routing on OpenStreetMap roads (no live traffic)',
  url: 'https://project-osrm.org/',
  confidence: 'estimate',
};

export const ESTIMATE_SOURCE: Source = {
  label: 'Straight-line estimate (routing unavailable) — 1.35× detour at 38 mph',
  confidence: 'estimate',
};

export function buildTableUrl(home: LatLon, dests: LatLon[]): string {
  const coords = [home, ...dests].map((p) => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
  return `https://router.project-osrm.org/table/v1/driving/${coords}?sources=0&annotations=duration,distance`;
}

export function parseTable(raw: unknown, count: number): Array<{ minutes: number; miles: number } | null> {
  const o = raw as { code?: string; durations?: unknown; distances?: unknown };
  if (o?.code !== 'Ok' || !Array.isArray(o.durations) || !Array.isArray(o.durations[0])) throw new Error('Bad routing response');
  const dur = o.durations[0] as unknown[];
  const dist = (Array.isArray(o.distances) && Array.isArray(o.distances[0]) ? o.distances[0] : []) as unknown[];
  const out: Array<{ minutes: number; miles: number } | null> = [];
  for (let i = 1; i <= count; i++) {
    const s = dur[i];
    const m = dist[i];
    out.push(typeof s === 'number' && Number.isFinite(s) && s >= 0 ? { minutes: s / 60, miles: typeof m === 'number' ? m / 1609.34 : NaN } : null);
  }
  return out;
}

export async function fetchDriveTimes(home: LatLon, dests: Array<LatLon & { id: string }>): Promise<Record<string, DriveInfo>> {
  const key = `drive:${home.lat.toFixed(3)},${home.lon.toFixed(3)}:${dests.map((d) => d.id).join(',')}`;
  const cached = cacheGet<Array<{ minutes: number; miles: number } | null>>(key, 7 * 24 * 3600 * 1000);
  let routed: Array<{ minutes: number; miles: number } | null> = [];
  if (cached) routed = cached.value;
  else {
    try {
      routed = parseTable(await fetchJson(buildTableUrl(home, dests), { timeoutMs: 10_000 }), dests.length);
      cacheSet(key, routed);
    } catch {
      routed = [];
    }
  }
  const out: Record<string, DriveInfo> = {};
  dests.forEach((d, i) => {
    const r = routed[i];
    if (r) {
      const miles = Number.isFinite(r.miles) ? r.miles : estimateDrive(home, d).miles;
      out[d.id] = { minutes: r.minutes, miles, method: 'routed', source: OSRM_SOURCE };
    } else {
      const e = estimateDrive(home, d);
      out[d.id] = { minutes: e.minutes, miles: e.miles, method: 'estimate', source: ESTIMATE_SOURCE };
    }
  });
  return out;
}
