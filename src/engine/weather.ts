import type { HourlyPoint } from '../services/types';

/**
 * Interpret one forecast hour for riding. This is a WEATHER judgement only —
 * it says nothing about trail surface (see mudRisk.ts, which is also only an estimate).
 */

export type HourLevel = 'great' | 'good' | 'fair' | 'poor' | 'bad' | 'unknown';

export interface HourVerdict {
  level: HourLevel;
  label: string;
  reasons: string[];
  /** 0..1 desirability used by the window search. */
  score: number;
}

const RANK: Record<HourLevel, number> = { great: 0, good: 1, fair: 2, poor: 3, bad: 4, unknown: 5 };
export const LEVEL_SCORE: Record<HourLevel, number> = { great: 1, good: 0.85, fair: 0.55, poor: 0.2, bad: 0, unknown: 0 };

export function worst(a: HourLevel, b: HourLevel): HourLevel {
  return RANK[a] >= RANK[b] ? a : b;
}

export const isThunder = (code: number | null) => code != null && code >= 95;
export const isSnow = (code: number | null) => code != null && ((code >= 71 && code <= 77) || code === 85 || code === 86);
export const isRainCode = (code: number | null) => code != null && ((code >= 51 && code <= 67) || (code >= 80 && code <= 82));

export function classifyHour(h: HourlyPoint): HourVerdict {
  if (h.tempF == null || (h.weatherCode == null && h.precipProb == null)) {
    return { level: 'unknown', label: 'No data', reasons: ['Forecast missing for this hour'], score: 0 };
  }
  let level: HourLevel = 'great';
  const reasons: string[] = [];
  const bump = (l: HourLevel, why: string) => {
    if (RANK[l] > RANK['great']) reasons.push(why);
    level = worst(level, l);
  };

  // Temperature (air temp; feels-like is shown separately)
  const t = h.tempF;
  if (t < 25) bump('bad', 'Below 25°F');
  else if (t < 35) bump('poor', 'Cold');
  else if (t < 45) bump('fair', 'Chilly');
  else if (t < 50) bump('good', 'Cool');
  else if (t <= 78) {
    /* ideal */
  } else if (t <= 86) bump('good', 'Warm');
  else if (t <= 92) bump('fair', 'Hot');
  else if (t <= 98) bump('poor', 'Very hot');
  else bump('bad', 'Dangerous heat');

  // Storms / precipitation
  const code = h.weatherCode;
  const pp = h.precipProb ?? 0;
  const amt = h.precipIn ?? 0;
  if (isThunder(code)) bump('bad', 'Thunderstorms');
  else if (isSnow(code) && (amt > 0 || pp >= 40)) bump('bad', 'Snow');
  else if (amt >= 0.1) bump('bad', 'Rain');
  else if (amt >= 0.02 || pp >= 60) bump('poor', 'Rain likely');
  else if (pp >= 35) bump('fair', 'Storm risk');
  else if (pp >= 20) bump('good', 'Slight shower chance');

  // Wind
  const g = h.gustMph ?? h.windMph ?? 0;
  if (g >= 50) bump('bad', `Gusts ${Math.round(g)} mph`);
  else if (g >= 38) bump('poor', `Gusts ${Math.round(g)} mph`);
  else if (g >= 28) bump('fair', 'Gusty');

  const label = labelFor(level, reasons, t);
  return { level, label, reasons, score: LEVEL_SCORE[level] };
}

function labelFor(level: HourLevel, reasons: string[], t: number): string {
  if (level === 'great') return t < 60 ? 'Cool & dry' : 'Ideal';
  if (level === 'good') return reasons[0] ?? 'Good';
  if (level === 'fair') return reasons[0] ?? 'Fair';
  if (level === 'poor') return reasons[0] ?? 'Poor';
  if (level === 'bad') return reasons[0] ?? 'Poor weather';
  return 'No data';
}

/** Dominant hazard across a set of hours, for summary copy. */
export function stormOnset(hours: HourlyPoint[]): HourlyPoint | null {
  return hours.find((h) => isThunder(h.weatherCode) || (h.precipProb ?? 0) >= 40 || (h.precipIn ?? 0) >= 0.02) ?? null;
}
