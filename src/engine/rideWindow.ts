import type { DailyPoint, HourlyPoint } from '../services/types';
import { classifyHour, type HourLevel, type HourVerdict } from './weather';
import { roundUpTo } from '../utils/time';

/**
 * Find the best practical riding window on a date:
 *  - only in daylight (sunrise+15 → sunset−15),
 *  - no earlier than `earliestStartMin` (e.g. now + drive when the date is today),
 *  - long enough for the planned ride,
 *  - maximising the time-weighted weather score. Ties go to the earlier start.
 * Also returns the maximal contiguous run of good hours ("best conditions" span).
 */

export interface HourSlot {
  minutes: number; // start of the hour
  hour: HourlyPoint;
  verdict: HourVerdict;
  daylight: boolean;
}

export interface RideWindow {
  start: number; // minutes after midnight
  end: number;
  quality: number; // 0..1 time-weighted
  level: HourLevel;
  /** Longest contiguous daylight run of great/good hours containing or nearest to the window. */
  goodSpan: { start: number; end: number } | null;
  /** True when daylight or the start time forced a shorter window than the planned ride. */
  clipped: boolean;
}

export interface WindowResult {
  slots: HourSlot[];
  window: RideWindow | null;
  reason: 'ok' | 'no-data' | 'no-daylight' | 'too-late';
  sunrise: number | null;
  sunset: number | null;
}

const STEP = 15;
const LIGHT_MARGIN = 15;

export function levelFromQuality(q: number): HourLevel {
  if (q >= 0.9) return 'great';
  if (q >= 0.72) return 'good';
  if (q >= 0.45) return 'fair';
  if (q >= 0.15) return 'poor';
  return 'bad';
}

export function findRideWindow(opts: {
  date: string;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  durationMin: number;
  earliestStartMin?: number;
}): WindowResult {
  const { date, hourly, daily, durationMin } = opts;
  const day = daily.find((d) => d.date === date);
  const hours = hourly.filter((h) => h.date === date).sort((a, b) => a.minutes - b.minutes);
  const sunrise = day?.sunriseMin ?? null;
  const sunset = day?.sunsetMin ?? null;

  if (hours.length === 0) return { slots: [], window: null, reason: 'no-data', sunrise, sunset };
  // Fall back to civil-ish defaults only for daylight bounds? No — without sunrise/sunset we can't
  // claim daylight. Treat as no data for the window but still show hourly weather.
  const slots: HourSlot[] = hours.map((h) => ({
    minutes: h.minutes,
    hour: h,
    verdict: classifyHour(h),
    daylight: sunrise != null && sunset != null ? h.minutes + 60 > sunrise && h.minutes < sunset : false,
  }));
  if (sunrise == null || sunset == null) return { slots, window: null, reason: 'no-data', sunrise, sunset };
  if (slots.every((s) => s.verdict.level === 'unknown')) return { slots, window: null, reason: 'no-data', sunrise, sunset };

  const lightStart = roundUpTo(sunrise + LIGHT_MARGIN, STEP);
  const lightEnd = sunset - LIGHT_MARGIN;
  const earliest = Math.max(lightStart, roundUpTo(opts.earliestStartMin ?? 0, STEP));
  const duration = Math.max(STEP, roundUpTo(durationMin, STEP));

  if (lightEnd - lightStart < duration) {
    // Very long ride vs short winter day: still pick best daylight block, clipped.
    if (lightEnd - lightStart < 60) return { slots, window: null, reason: 'no-daylight', sunrise, sunset };
  }
  const usable = Math.min(duration, lightEnd - lightStart);
  if (lightEnd - earliest < Math.min(usable, 45)) return { slots, window: null, reason: 'too-late', sunrise, sunset };

  const scoreAt = (m: number): number | null => {
    const slot = slots.find((s) => m >= s.minutes && m < s.minutes + 60);
    if (!slot || slot.verdict.level === 'unknown') return null;
    return slot.verdict.score;
  };

  let best: { start: number; q: number } | null = null;
  const len = Math.min(usable, lightEnd - earliest);
  for (let start = earliest; start + len <= lightEnd; start += STEP) {
    let sum = 0;
    let ok = true;
    for (let m = start; m < start + len; m += STEP) {
      const s = scoreAt(m);
      if (s == null) {
        ok = false;
        break;
      }
      sum += s;
    }
    if (!ok) continue;
    const q = sum / Math.ceil(len / STEP);
    if (!best || q > best.q + 1e-9) best = { start, q };
  }
  if (!best) return { slots, window: null, reason: 'no-data', sunrise, sunset };

  const window: RideWindow = {
    start: best.start,
    end: best.start + len,
    quality: best.q,
    level: levelFromQuality(best.q),
    goodSpan: goodSpanAround(slots, best.start, best.start + len, earliest, lightEnd),
    clipped: len < duration,
  };
  return { slots, window, reason: 'ok', sunrise, sunset };
}

function goodSpanAround(slots: HourSlot[], ws: number, we: number, lo: number, hi: number): { start: number; end: number } | null {
  const isGood = (m: number) => {
    const s = slots.find((x) => m >= x.minutes && m < x.minutes + 60);
    return !!s && (s.verdict.level === 'great' || s.verdict.level === 'good');
  };
  // Seed from the first good point inside the window.
  let seed: number | null = null;
  for (let m = ws; m < we; m += STEP) if (isGood(m)) {
    seed = m;
    break;
  }
  if (seed == null) return null;
  let start = seed;
  while (start - STEP >= lo && isGood(start - STEP)) start -= STEP;
  let end = seed;
  while (end + STEP <= hi && isGood(end)) end += STEP;
  return end - start >= 30 ? { start, end } : null;
}
