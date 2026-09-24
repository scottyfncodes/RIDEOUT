import type { RidingArea, SignatureRide } from '../content/types';
import type { AreaForecast, DriveInfo, Fetched, Place } from '../services/types';
import { evaluateAccess, type AccessResult } from './access';
import { nearestBrewery } from './apres';
import { difficultyFit, estimateRideMinutes, matchesDifficulty, pickRide, preferenceFit, vibeFit, clamp01 } from './fit';
import { MODES, type SearchParams } from './modes';
import { assessMudRisk, type MudRisk } from './mudRisk';
import { buildItinerary, earliestRideStart, type Itinerary } from './planner';
import type { Preferences } from './prefs';
import { findRideWindow, type WindowResult } from './rideWindow';
import { capStatus, statusFromScore, statusRank, type Status } from './status';
import { formatClock, formatDuration } from '../utils/time';
import { stormOnset } from './weather';

/**
 * The RIDEOUT decision engine. Pure function of (content, forecast, drive, prefs, params).
 * Every number that moves the score is a named component with a human note, and the
 * WHY text is generated from those same components.
 */

export interface ScoreComponent {
  key: 'weather' | 'mud' | 'difficulty' | 'time' | 'vibe' | 'prefs' | 'apres' | 'access';
  label: string;
  weight: number;
  value: number | null; // 0..1, null = unknown (excluded from the weighted mean)
  note: string;
}

export interface Recommendation {
  area: RidingArea;
  ride: SignatureRide | null;
  rideMinutes: number;
  rideMinutesEstimated: boolean;
  status: Status;
  score: number | null;
  components: ScoreComponent[];
  access: AccessResult;
  mud: MudRisk;
  window: WindowResult | null;
  drive: DriveInfo | null;
  itinerary: Itinerary | null;
  brewery: { place: Place; miles: number; driveMin: number } | null;
  why: string[];
  whyNot: string[];
  headline: string;
  weatherAvailable: boolean;
}

export interface EngineInput {
  areas: RidingArea[];
  forecasts: Record<string, Fetched<AreaForecast>>;
  drives: Record<string, DriveInfo>;
  breweries: Place[] | null;
  prefs: Preferences;
  params: SearchParams;
  /** Present when the selected date is today in the region timezone. */
  nowMin: number | null;
}

export interface EngineOutput {
  results: Recommendation[];
  excluded: Array<{ area: RidingArea; reason: string }>;
}

export function recommend(input: EngineInput): EngineOutput {
  const { areas, params } = input;
  const results: Recommendation[] = [];
  const excluded: EngineOutput['excluded'] = [];

  for (const area of areas) {
    if (!matchesDifficulty(area, params.difficulty)) {
      excluded.push({ area, reason: 'Outside the difficulty you picked' });
      continue;
    }
    const drive = input.drives[area.id] ?? null;
    if (params.maxDrive != null && drive && drive.minutes > params.maxDrive) {
      excluded.push({ area, reason: `More than ${params.maxDrive} min away (${Math.round(drive.minutes)} min)` });
      continue;
    }
    results.push(evaluateArea(area, input));
  }

  results.sort((a, b) => statusRank(a.status) - statusRank(b.status) || (b.score ?? -1) - (a.score ?? -1) || (a.drive?.minutes ?? 0) - (b.drive?.minutes ?? 0));
  return { results, excluded };
}

export function evaluateArea(area: RidingArea, input: EngineInput, rideId?: string): Recommendation {
  const { params, prefs } = input;
  const mode = MODES[params.mode];
  const drive = input.drives[area.id] ?? null;
  const driveMin = drive?.minutes ?? null;
  const gear = prefs.gearUpMin;

  // Time budget → max ride minutes (Quick Rip is budget-driven).
  const budget = params.mode === 'quick' ? params.quickBudget : mode.outingBudget;
  const maxRideMin = budget != null && driveMin != null ? Math.max(30, budget - 2 * driveMin - gear - 10) : null;

  const ride = (rideId && area.rides.find((r) => r.id === rideId)) || pickRide(area, params.difficulty, mode, maxRideMin);
  const est = ride ? estimateRideMinutes(ride) : null;
  const rideMinutesEstimated = est == null;
  let rideMinutes = est ?? (maxRideMin != null ? Math.min(mode.rideDefault, maxRideMin) : mode.rideDefault);
  rideMinutes = Math.round(rideMinutes / 5) * 5;

  const access = evaluateAccess(area, params.date);
  const fx = input.forecasts[area.id];
  const forecast = fx?.ok ? fx.data : null;

  const earliest = input.nowMin != null && driveMin != null ? earliestRideStart(input.nowMin, driveMin, gear) : input.nowMin != null ? input.nowMin + gear : undefined;
  const window = forecast ? findRideWindow({ date: params.date, hourly: forecast.hourly, daily: forecast.daily, durationMin: rideMinutes, earliestStartMin: earliest }) : null;
  const rideStart = window?.window?.start ?? null;
  const mud: MudRisk = forecast
    ? assessMudRisk({ date: params.date, forecast, drainage: area.drainage, rideStartMin: rideStart })
    : { level: 'unknown', index: null, explanation: 'Weather unavailable, so mud risk cannot be estimated.', drivers: [], recentPrecipIn: null };

  const brewery = input.breweries && input.breweries.length ? nearestBrewery(input.breweries, area.trailhead) : null;
  const wantsApres = mode.wantsApres || prefs.wantsBrewery;

  // The window is searched in 15-min steps; plan with the real ride length unless daylight clipped it.
  const actualRideMin = window?.window?.clipped ? window.window.end - window.window.start : rideMinutes;
  const itinerary =
    rideStart != null && driveMin != null
      ? buildItinerary({
          driveMin,
          rideStartMin: rideStart,
          rideMin: actualRideMin,
          gearUpMin: gear,
          apres: wantsApres && brewery && brewery.driveMin <= 30 ? { name: brewery.place.name, driveMin: brewery.driveMin } : null,
        })
      : null;

  // ---------- components ----------
  const components: ScoreComponent[] = [];
  const weatherAvailable = !!window && window.reason !== 'no-data';

  // Weather window
  let weatherNote = 'Weather unavailable';
  let weatherVal: number | null = null;
  if (window?.window) {
    weatherVal = window.window.quality;
    weatherNote = `Best window ${formatClock(window.window.start)}–${formatClock(window.window.end)}`;
  } else if (window?.reason === 'too-late') {
    weatherVal = 0;
    weatherNote = 'Not enough daylight left today';
  } else if (window?.reason === 'no-daylight') {
    weatherVal = 0;
    weatherNote = 'Not enough daylight for this ride';
  }
  components.push({ key: 'weather', label: 'Weather window', weight: 35, value: weatherVal, note: weatherNote });

  const mudVal = { low: 1, moderate: 0.7, elevated: 0.3, high: 0, unknown: null }[mud.level];
  components.push({ key: 'mud', label: 'Mud risk (estimate)', weight: 25, value: mudVal, note: `Mud risk ${mud.level}` });

  const d = difficultyFit(area, params.difficulty);
  components.push({ key: 'difficulty', label: 'Difficulty fit', weight: 10, value: d.value, note: d.note });

  // Time fit
  let timeVal: number | null = null;
  let timeNote = 'Drive time unknown';
  if (itinerary) {
    const total = itinerary.totalMin - (itinerary.apres ? itinerary.apres.leave - itinerary.apres.arrive : 0);
    if (budget != null) {
      timeVal = total <= budget ? 1 : clamp01(1 - (total - budget) / 90);
      timeNote = `${formatDuration(total)} door-to-door vs your ${formatDuration(budget)}`;
    } else {
      const inRange = rideMinutes >= mode.rideMin && rideMinutes <= mode.rideMax;
      timeVal = inRange ? 1 : rideMinutes < mode.rideMin ? 0.55 : 0.7;
      timeNote = inRange ? `${formatDuration(rideMinutes)} ride fits a ${mode.label}` : rideMinutes < mode.rideMin ? `Short for a ${mode.label}` : `Long for a ${mode.label}`;
    }
    if (window?.window?.clipped) {
      timeVal = Math.min(timeVal, 0.5);
      timeNote += ' — shortened by daylight';
    }
  } else if (driveMin != null) {
    timeVal = null;
    timeNote = 'No ride window to plan around';
  }
  if (rideMinutesEstimated) timeNote += ' (ride length unknown — using a typical duration)';
  components.push({ key: 'time', label: 'Time fit', weight: 15, value: timeVal, note: timeNote });

  const v = vibeFit(area, params.vibe);
  components.push({ key: 'vibe', label: 'Vibe fit', weight: params.vibe === 'any' ? 4 : 10, value: v.value, note: v.note });

  const p = preferenceFit(area, ride, prefs);
  components.push({ key: 'prefs', label: 'Your preferences', weight: 5, value: p.value, note: p.notes.length ? p.notes.join(', ') : 'No strong preference signals' });

  if (wantsApres) {
    const val = brewery ? clamp01(1 - (brewery.driveMin - 5) / 30) : null;
    components.push({
      key: 'apres',
      label: 'Apres',
      weight: params.mode === 'brewery' ? 20 : 6,
      value: val,
      note: brewery ? `${brewery.place.name} ~${brewery.driveMin} min from the trailhead` : 'Brewery data unavailable',
    });
  }

  if (access.penalty > 0) components.push({ key: 'access', label: 'Access today', weight: 10, value: 1 - access.penalty * 2, note: access.notes.join(' ') });

  // ---------- score + gates ----------
  let status: Status;
  let score: number | null = null;
  const known = components.filter((c) => c.value != null);
  if (!access.open) {
    status = 'skip';
    score = 0;
  } else if (!weatherAvailable) {
    status = 'unknown';
  } else {
    const wsum = known.reduce((a, c) => a + c.weight, 0);
    score = Math.round((known.reduce((a, c) => a + c.weight * (c.value as number), 0) / wsum) * 100);
    status = statusFromScore(score);
    if (mud.level === 'high') status = capStatus(status, 'skip');
    else if (mud.level === 'elevated') status = capStatus(status, 'questionable');
    if (window?.window && window.window.quality < 0.3) status = capStatus(status, 'skip');
    else if (window?.window && window.window.quality < 0.5) status = capStatus(status, 'questionable');
    else if (window?.window && window.window.quality < 0.72) status = capStatus(status, 'worth');
    if (!window?.window) status = 'skip';
  }

  const { why, whyNot, headline } = explain({ area, status, access, mud, window, components, forecastDate: params.date, forecast, brewery, wantsApres, itinerary, budget });

  return {
    area,
    ride,
    rideMinutes: actualRideMin,
    rideMinutesEstimated,
    status,
    score,
    components,
    access,
    mud,
    window,
    drive,
    itinerary,
    brewery,
    why,
    whyNot,
    headline,
    weatherAvailable,
  };
}

function explain(x: {
  area: RidingArea;
  status: Status;
  access: AccessResult;
  mud: MudRisk;
  window: WindowResult | null;
  components: ScoreComponent[];
  forecastDate: string;
  forecast: AreaForecast | null;
  brewery: Recommendation['brewery'];
  wantsApres: boolean;
  itinerary: Itinerary | null;
  budget: number | null;
}): { why: string[]; whyNot: string[]; headline: string } {
  const why: string[] = [];
  const whyNot: string[] = [];

  if (!x.access.open) {
    whyNot.push(x.access.closedReason ?? 'Closed to bikes on this date.');
    return { why, whyNot, headline: whyNot[0] };
  }
  if (!x.window || x.window.reason === 'no-data') {
    whyNot.push('Weather unavailable. RIDEOUT won’t guess at conditions.');
    return { why, whyNot, headline: 'Weather unavailable — no recommendation' };
  }
  if (x.window.reason === 'too-late') whyNot.push('Not enough daylight left today to get there and ride.');
  if (x.window.reason === 'no-daylight') whyNot.push('Too little daylight for this ride.');

  const w = x.window.window;
  if (w) {
    const dayHours = x.forecast?.hourly.filter((h) => h.date === x.forecastDate && h.minutes >= w.end) ?? [];
    const onset = stormOnset(dayHours);
    const span = w.goodSpan;
    if (w.quality >= 0.72) why.push(`Good weather ${formatClock(span?.start ?? w.start)}–${formatClock(span?.end ?? w.end)}.`);
    else if (w.quality >= 0.45) whyNot.push(`The best window (${formatClock(w.start)}–${formatClock(w.end)}) is only fair: ${dominantIssue(x.window, w.start, w.end)}.`);
    else whyNot.push(`Poor weather all day: ${dominantIssue(x.window, w.start, w.end)}.`);
    if (onset && w.quality >= 0.45) {
      whyNot.push(`Storm risk increases around ${formatClock(onset.minutes)}. Start early.`);
    }
    if (w.clipped) whyNot.push('Daylight or start time cuts the ride short.');
  }

  if (x.mud.level === 'low') why.push(x.mud.recentPrecipIn != null && x.mud.recentPrecipIn < 0.05 ? 'Little recent precipitation.' : 'Low mud-risk estimate.');
  else if (x.mud.level === 'moderate') whyNot.push(`Some mud possible: ${x.mud.drivers[0] ?? 'recent moisture'}.`);
  else if (x.mud.level === 'elevated' || x.mud.level === 'high') whyNot.push(x.mud.explanation);
  else whyNot.push('Mud risk unknown.');

  for (const n of x.access.notes) (x.access.penalty > 0 ? whyNot : why).push(n);

  const time = x.components.find((c) => c.key === 'time');
  if (time?.value != null && x.itinerary) {
    if (time.value >= 1 && x.budget != null) why.push(`Fits your time: ${formatDuration(x.itinerary.totalMin)} door-to-door.`);
    else if (time.value < 0.7) whyNot.push(time.note + '.');
  }
  const vibe = x.components.find((c) => c.key === 'vibe');
  if (vibe && vibe.weight >= 10) (vibe.value! >= 0.6 ? why : whyNot).push(vibe.note + '.');
  if (x.wantsApres && x.brewery && x.brewery.driveMin <= 15) why.push(`🍺 ${x.brewery.place.name} ~${x.brewery.driveMin} min away.`);

  const headline = x.status === 'send' || x.status === 'worth' ? why.slice(0, 2).join(' ') || whyNot[0] : whyNot.slice(0, 2).join(' ') || why[0];
  return { why, whyNot, headline: headline ?? '' };
}

function dominantIssue(w: WindowResult, start: number, end: number): string {
  const counts = new Map<string, number>();
  for (const s of w.slots) {
    if (s.minutes + 60 <= start || s.minutes >= end) continue;
    for (const r of s.verdict.reasons) counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? top[0].toLowerCase() : 'mixed conditions';
}
