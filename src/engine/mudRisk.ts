import type { Drainage } from '../content/types';
import type { AreaForecast } from '../services/types';
import { addDays } from '../utils/time';

/**
 * Mud-risk ESTIMATE from weather. It is never a trail report.
 * Inputs: modeled precipitation over the previous 3 days (recency-weighted), rain
 * forecast before the ride, soil drainage (per area), temperature (drying),
 * freeze/thaw, and modeled snow on the ground.
 */

export type MudLevel = 'low' | 'moderate' | 'elevated' | 'high' | 'unknown';

export interface MudRisk {
  level: MudLevel;
  /** Recency-weighted wetness index in inches-equivalent (after drainage/drying adjustments). */
  index: number | null;
  explanation: string;
  drivers: string[];
  recentPrecipIn: number | null;
}

const DRAINAGE_FACTOR: Record<Drainage, number> = { fast: 0.6, moderate: 1, slow: 1.6 };
const WEIGHTS = [1, 0.6, 0.35]; // day-1, day-2, day-3

export const MUD_ORDER: MudLevel[] = ['low', 'moderate', 'elevated', 'high'];

export function assessMudRisk(opts: {
  date: string;
  forecast: AreaForecast;
  drainage: Drainage;
  /** Minutes after midnight when the ride starts; precip on the day before this counts. */
  rideStartMin?: number | null;
}): MudRisk {
  const { date, forecast, drainage } = opts;
  const byDate = new Map(forecast.daily.map((d) => [d.date, d]));
  const prev = [1, 2, 3].map((n) => byDate.get(addDays(date, -n)));
  const today = byDate.get(date);

  if (prev.some((d) => d == null || d.precipSumIn == null)) {
    return { level: 'unknown', index: null, explanation: 'Not enough recent precipitation data to estimate mud risk.', drivers: [], recentPrecipIn: null };
  }
  const p = prev.map((d) => d!.precipSumIn!);
  const recent = p.reduce((a, b) => a + b, 0);
  const rideStart = opts.rideStartMin ?? 9 * 60;
  const morning = forecast.hourly
    .filter((h) => h.date === date && h.minutes < rideStart)
    .reduce((a, h) => a + (h.precipIn ?? 0), 0);

  let wet = p.reduce((acc, v, i) => acc + v * WEIGHTS[i], 0) + morning;
  const drivers: string[] = [];
  if (p[0] >= 0.1) drivers.push(`${p[0].toFixed(2)}″ of precip yesterday`);
  else if (recent >= 0.1) drivers.push(`${recent.toFixed(2)}″ of precip in the last 3 days`);
  if (morning >= 0.05) drivers.push(`${morning.toFixed(2)}″ forecast before your start`);

  wet *= DRAINAGE_FACTOR[drainage];
  if (drainage === 'slow' && wet >= 0.05) drivers.push('clay soils here dry slowly');
  if (drainage === 'fast' && recent >= 0.1) drivers.push('granitic soil drains fast');

  const highs = prev.map((d) => d!.highF).filter((x): x is number => x != null);
  const avgHigh = highs.length ? highs.reduce((a, b) => a + b, 0) / highs.length : null;
  if (avgHigh != null && avgHigh >= 78 && wet > 0) {
    wet *= 0.7;
    drivers.push('warm, drying days since');
  } else if (avgHigh != null && avgHigh < 50 && wet > 0) {
    wet *= 1.3;
    drivers.push('cool temps slow drying');
  }

  const freezeThaw = today?.lowF != null && today?.highF != null && today.lowF <= 30 && today.highF >= 42;
  const snowPrev = prev.reduce((a, d) => a + (d!.snowfallIn ?? 0), 0);
  const dayHours = forecast.hourly.filter((h) => h.date === date);
  const snowDepths = dayHours.map((h) => h.snowDepthIn).filter((x): x is number => x != null);
  const snowOnGround = snowDepths.length ? Math.max(...snowDepths) : 0;

  let level: MudLevel = wet < 0.06 ? 'low' : wet < 0.2 ? 'moderate' : wet < 0.45 ? 'elevated' : 'high';

  if (snowOnGround >= 1) {
    level = 'high';
    drivers.unshift(`~${Math.round(snowOnGround)}″ of snow modeled on the ground`);
  } else if (snowPrev >= 1) {
    level = bumpLevel(level, 1);
    drivers.push(`${snowPrev.toFixed(1)}″ of recent snowfall melting out`);
  }
  if (freezeThaw && (wet >= 0.03 || snowPrev > 0)) {
    level = bumpLevel(level, 1);
    drivers.push('freeze/thaw — firm early, soft once it warms');
  }

  return { level, index: Math.round(wet * 100) / 100, explanation: explain(level, drivers), drivers, recentPrecipIn: Math.round(recent * 100) / 100 };
}

function bumpLevel(l: MudLevel, n: number): MudLevel {
  if (l === 'unknown') return l;
  return MUD_ORDER[Math.min(MUD_ORDER.length - 1, MUD_ORDER.indexOf(l) + n)];
}

function explain(level: MudLevel, drivers: string[]): string {
  const why = drivers.length ? `${cap(drivers.slice(0, 3).join(', '))}.` : 'Little or no recent precipitation.';
  switch (level) {
    case 'low':
      return `${why} Surfaces are likely dry.`;
    case 'moderate':
      return `${why} Some damp or soft spots are possible.`;
    case 'elevated':
      return `${why} Soft, muddy sections are likely. If it's tacky enough to leave ruts, turn around.`;
    case 'high':
      return `${why} Trails are probably wet. Riding them causes lasting damage, and many agencies close muddy trails.`;
    default:
      return why;
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
