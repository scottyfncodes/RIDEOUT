import type { Source } from '../../content/types';
import { cacheGet, cacheSet, fetchJson } from '../cache';
import type { AreaForecast, DailyPoint, Fetched, HourlyPoint } from '../types';
import { localTimeToMinutes } from '../../utils/time';

/**
 * Open-Meteo adapter (https://open-meteo.com). Keyless, CORS-enabled, free for
 * non-commercial use. One request covers every riding area (multi-location).
 * Forecast is requested at the trailhead coordinates; the model's grid elevation
 * is returned so the UI can say what elevation the numbers represent.
 */

export const OPEN_METEO_SOURCE: Source = {
  label: 'Open-Meteo forecast (NOAA GFS/HRRR & other national models)',
  url: 'https://open-meteo.com/',
  confidence: 'official',
};

const HOURLY = 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,snow_depth';
const DAILY = 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,snowfall_sum,sunrise,sunset';
const CURRENT = 'temperature_2m,apparent_temperature,wind_speed_10m,wind_gusts_10m,weather_code';

export function buildForecastUrl(points: Array<{ lat: number; lon: number }>, timezone: string): string {
  const p = new URLSearchParams({
    latitude: points.map((x) => x.lat.toFixed(4)).join(','),
    longitude: points.map((x) => x.lon.toFixed(4)).join(','),
    hourly: HOURLY,
    daily: DAILY,
    current: CURRENT,
    timezone,
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    past_days: '3',
    forecast_days: '10',
  });
  return `https://api.open-meteo.com/v1/forecast?${p.toString()}`;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Physical sanity bounds: reject obviously corrupt values rather than reason from them. */
const bounded = (v: unknown, lo: number, hi: number): number | null => {
  const n = num(v);
  return n != null && n >= lo && n <= hi ? n : null;
};

function snowDepthToInches(v: unknown, unit: string | undefined): number | null {
  const n = num(v);
  if (n == null || n < 0) return null;
  switch (unit) {
    case 'm':
      return n * 39.3701;
    case 'cm':
      return n / 2.54;
    case 'ft':
      return n * 12;
    case 'inch':
    case 'in':
    case '"':
      return n;
    default:
      return null; // unknown unit: don't guess
  }
}

type Json = Record<string, unknown>;
const arr = (o: unknown, k: string): unknown[] => {
  const v = (o as Json | undefined)?.[k];
  return Array.isArray(v) ? v : [];
};

/** Parse one location's payload. Throws if the payload is structurally unusable. */
export function parseForecast(raw: unknown): AreaForecast {
  if (!raw || typeof raw !== 'object') throw new Error('Empty forecast payload');
  const o = raw as Json;
  const hourly = o.hourly as Json | undefined;
  const daily = o.daily as Json | undefined;
  const times = arr(hourly, 'time');
  if (!hourly || !daily || times.length === 0) throw new Error('Forecast payload missing hourly/daily data');
  const hourlyUnits = (o.hourly_units ?? {}) as Record<string, string>;

  const H: HourlyPoint[] = [];
  times.forEach((t, i) => {
    if (typeof t !== 'string') return;
    const minutes = localTimeToMinutes(t);
    if (minutes == null) return;
    H.push({
      time: t,
      date: t.slice(0, 10),
      minutes,
      tempF: bounded(arr(hourly, 'temperature_2m')[i], -60, 130),
      feelsF: bounded(arr(hourly, 'apparent_temperature')[i], -90, 150),
      precipProb: bounded(arr(hourly, 'precipitation_probability')[i], 0, 100),
      precipIn: bounded(arr(hourly, 'precipitation')[i], 0, 20),
      weatherCode: bounded(arr(hourly, 'weather_code')[i], 0, 99),
      windMph: bounded(arr(hourly, 'wind_speed_10m')[i], 0, 200),
      gustMph: bounded(arr(hourly, 'wind_gusts_10m')[i], 0, 250),
      snowDepthIn: snowDepthToInches(arr(hourly, 'snow_depth')[i], hourlyUnits.snow_depth),
    });
  });

  const D: DailyPoint[] = [];
  arr(daily, 'time').forEach((d, i) => {
    if (typeof d !== 'string') return;
    const sr = arr(daily, 'sunrise')[i];
    const ss = arr(daily, 'sunset')[i];
    D.push({
      date: d,
      highF: bounded(arr(daily, 'temperature_2m_max')[i], -60, 130),
      lowF: bounded(arr(daily, 'temperature_2m_min')[i], -60, 130),
      precipSumIn: bounded(arr(daily, 'precipitation_sum')[i], 0, 50),
      precipProbMax: bounded(arr(daily, 'precipitation_probability_max')[i], 0, 100),
      snowfallIn: bounded(arr(daily, 'snowfall_sum')[i], 0, 200),
      sunriseMin: typeof sr === 'string' ? localTimeToMinutes(sr) : null,
      sunsetMin: typeof ss === 'string' ? localTimeToMinutes(ss) : null,
    });
  });

  const c = o.current as Json | undefined;
  const elevM = num(o.elevation);
  return {
    lat: num(o.latitude) ?? NaN,
    lon: num(o.longitude) ?? NaN,
    modelElevationFt: elevM == null ? null : Math.round(elevM * 3.28084),
    hourly: H,
    daily: D,
    current:
      c && typeof c.time === 'string'
        ? {
            time: c.time,
            tempF: bounded(c.temperature_2m, -60, 130),
            feelsF: bounded(c.apparent_temperature, -90, 150),
            windMph: bounded(c.wind_speed_10m, 0, 200),
            gustMph: bounded(c.wind_gusts_10m, 0, 250),
            weatherCode: bounded(c.weather_code, 0, 99),
          }
        : null,
  };
}

const TTL = 30 * 60 * 1000;
const STALE_TTL = 12 * 60 * 60 * 1000;

/**
 * Fetch forecasts for many points in one request. Returns one Fetched per point, in order.
 * If the network fails, falls back to a cached copy (clearly marked fromCache) no older
 * than 12 h; never fabricates.
 */
export async function fetchForecasts(
  points: Array<{ id: string; lat: number; lon: number }>,
  timezone: string,
): Promise<Record<string, Fetched<AreaForecast>>> {
  const key = `wx:${timezone}:${points.map((p) => p.id).join(',')}`;
  const fresh = cacheGet<unknown[]>(key, TTL);
  const out: Record<string, Fetched<AreaForecast>> = {};

  const fill = (payloads: unknown[], at: number, fromCache: boolean) => {
    points.forEach((p, i) => {
      try {
        out[p.id] = { ok: true, data: parseForecast(payloads[i]), source: OPEN_METEO_SOURCE, fetchedAt: new Date(at).toISOString(), fromCache };
      } catch (e) {
        out[p.id] = { ok: false, error: (e as Error).message, source: OPEN_METEO_SOURCE };
      }
    });
  };

  if (fresh) {
    fill(fresh.value, fresh.at, true);
    return out;
  }
  try {
    const raw = await fetchJson(buildForecastUrl(points, timezone));
    const payloads = Array.isArray(raw) ? raw : [raw];
    if ((raw as Json)?.error) throw new Error(String((raw as Json).reason ?? 'Forecast error'));
    cacheSet(key, payloads);
    fill(payloads, Date.now(), false);
  } catch (e) {
    const stale = cacheGet<unknown[]>(key, STALE_TTL);
    if (stale) {
      fill(stale.value, stale.at, true);
    } else {
      for (const p of points) out[p.id] = { ok: false, error: `Weather unavailable (${(e as Error).message})`, source: OPEN_METEO_SOURCE };
    }
  }
  return out;
}

/** WMO weather-code → short text. */
export function describeWeatherCode(code: number | null): string {
  if (code == null) return 'Unknown';
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Showers';
  if (code === 85 || code === 86) return 'Snow showers';
  if (code >= 95) return 'Thunderstorms';
  return 'Mixed';
}
