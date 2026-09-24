import { PREP_CHECKS, type PrepCheckId } from '../content/garage';
import type { Bike } from './garage';
import type { Recommendation } from './recommend';
import { estimateRideMinutes } from './fit';

/**
 * Ride-aware Bike Prep. Turns facts RIDEOUT already has about a ride (editorial
 * ride character, route stats, the forecast in the ride window, the mud-risk
 * ESTIMATE) plus the rider's own bike into a SHORT list of general prep checks.
 *
 * It never recommends a tire pressure or diagnoses the bike. When nothing
 * about the ride calls for extra prep, it returns null so the UI stays quiet.
 */

export type PrepTriggerId = 'technical' | 'long' | 'bigvert' | 'cold' | 'wet' | 'hot';

export interface PrepTrigger {
  id: PrepTriggerId;
  label: string;
  /** What the trigger is based on, so the reason is traceable. */
  basis: string;
}

export interface BikePrep {
  triggers: PrepTrigger[];
  checks: Array<{ id: PrepCheckId; text: string }>;
  /** User-entered pressures, shown as "your usual", never as a recommendation. */
  usualPsi: { front: number | null; rear: number | null } | null;
  tailored: boolean;
}

export const MAX_CHECKS = 4;

interface Rule {
  id: PrepTriggerId;
  label: string;
  when: (x: Ctx) => string | null; // returns the basis text, or null
  checks: (x: Ctx) => PrepCheckId[];
}

interface Ctx {
  r: Recommendation;
  bike: Bike | null;
  rideMin: number | null;
  distanceMi: number | null;
  gainFt: number | null;
  minTempF: number | null;
  maxTempF: number | null;
  maxPrecipProb: number | null;
}

const flatKit = (b: Bike | null): PrepCheckId => (b?.tubeless === false ? 'tube' : 'sealant');

const RULES: Rule[] = [
  {
    id: 'technical',
    label: 'Technical terrain',
    when: ({ r }) => {
      const c = r.area.character;
      const v = Math.max(c.technical ?? 0, c.rock ?? 0, c.chunk ?? 0);
      return v >= 3 ? 'RIDEOUT editorial rating: rocky / technical' : null;
    },
    checks: () => ['pressure', 'tires', 'brakes', 'pads'],
  },
  {
    id: 'long',
    label: 'Long ride',
    when: ({ rideMin, distanceMi }) =>
      (rideMin != null && rideMin >= 180) || (distanceMi != null && distanceMi >= 15)
        ? `${distanceMi != null ? `${distanceMi} mi` : 'Long'}${rideMin != null ? `, ~${Math.round(rideMin / 60 * 10) / 10} h estimated` : ''}`
        : null,
    checks: ({ bike }) => ['pressure', 'drivetrain', flatKit(bike), 'kit', ...(bike?.type === 'emtb' ? (['battery'] as PrepCheckId[]) : [])],
  },
  {
    id: 'bigvert',
    label: 'Big climb & descent',
    when: ({ gainFt, r }) => {
      const c = r.area.character;
      if (gainFt != null && gainFt >= 1500) return `${gainFt.toLocaleString('en-US')}′ of climbing`;
      if ((c.climbing ?? 0) >= 3 && (c.descending ?? 0) >= 3) return 'RIDEOUT editorial rating: big climbing and descending';
      return null;
    },
    checks: ({ bike }) => ['brakes', 'drivetrain', 'tires', ...(bike?.type === 'emtb' ? (['battery'] as PrepCheckId[]) : [])],
  },
  {
    id: 'wet',
    label: 'Wet conditions possible',
    when: ({ r, maxPrecipProb }) => {
      if (r.mud.level === 'elevated' || r.mud.level === 'high') return `Mud-risk estimate: ${r.mud.level}`;
      if (maxPrecipProb != null && maxPrecipProb >= 40) return `Forecast: up to ${maxPrecipProb}% chance of precipitation during the ride`;
      return null;
    },
    checks: () => ['brakes', 'drivetrain', 'clean'],
  },
  {
    id: 'cold',
    label: 'Cold start',
    when: ({ minTempF }) => (minTempF != null && minTempF < 45 ? `Forecast: ${Math.round(minTempF)}°F during the ride` : null),
    // Cold air lowers tire pressure, so check it at the trailhead, not just at home.
    checks: () => ['pressure'],
  },
  {
    id: 'hot',
    label: 'Hot day',
    when: ({ maxTempF }) => (maxTempF != null && maxTempF >= 88 ? `Forecast: up to ${Math.round(maxTempF)}°F during the ride` : null),
    checks: () => ['kit'],
  },
];

export function bikePrep(r: Recommendation, bike: Bike | null): BikePrep | null {
  // Nothing to prep for a ride RIDEOUT says to skip because the area is closed.
  if (!r.access.open) return null;

  const w = r.window?.window ?? null;
  const hours = w && r.window ? r.window.slots.filter((s) => s.minutes + 60 > w.start && s.minutes < w.end).map((s) => s.hour) : [];
  const temps = hours.map((h) => h.tempF).filter((t): t is number => t != null);
  const pps = hours.map((h) => h.precipProb).filter((p): p is number => p != null);

  const ctx: Ctx = {
    r,
    bike,
    rideMin: r.ride ? estimateRideMinutes(r.ride) : null,
    distanceMi: r.ride?.distanceMi ?? null,
    gainFt: r.ride?.gainFt ?? null,
    minTempF: temps.length ? Math.min(...temps) : null,
    maxTempF: temps.length ? Math.max(...temps) : null,
    maxPrecipProb: pps.length ? Math.max(...pps) : null,
  };

  const triggers: PrepTrigger[] = [];
  const counts = new Map<PrepCheckId, { n: number; first: number }>();
  let order = 0;
  for (const rule of RULES) {
    const basis = rule.when(ctx);
    if (!basis) continue;
    triggers.push({ id: rule.id, label: rule.label, basis });
    for (const c of rule.checks(ctx)) {
      const prev = counts.get(c);
      counts.set(c, { n: (prev?.n ?? 0) + 1, first: prev?.first ?? order++ });
    }
  }
  if (!triggers.length) return null;

  // Checks that several triggers agree on come first, then in rule order. Keep it short.
  const ids = [...counts.entries()].sort((a, b) => b[1].n - a[1].n || a[1].first - b[1].first).map(([id]) => id);
  const checks = ids.slice(0, MAX_CHECKS).map((id) => ({ id, text: PREP_CHECKS[id] }));

  const usual = bike && (bike.frontPsi != null || bike.rearPsi != null) ? { front: bike.frontPsi, rear: bike.rearPsi } : null;
  return { triggers, checks, usualPsi: checks.some((c) => c.id === 'pressure') ? usual : null, tailored: !!bike };
}
