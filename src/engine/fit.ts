import { DIFFICULTY_ORDER, type Difficulty, type RidingArea, type SignatureRide } from '../content/types';
import type { DifficultyChoice, ModeSpec, Vibe } from './modes';
import type { Preferences } from './prefs';

/** Ride-time estimate. Transparent formula; always labelled "estimate" in the UI. */
const MOVING_MPH: Record<Difficulty, number> = { green: 8, blue: 7, black: 6, dblack: 5 };

export function estimateRideMinutes(ride: Pick<SignatureRide, 'distanceMi' | 'gainFt' | 'difficulty' | 'typicalMinutes'>): number | null {
  if (ride.typicalMinutes) return ride.typicalMinutes;
  if (ride.distanceMi == null) return null;
  const moving = (ride.distanceMi / MOVING_MPH[ride.difficulty]) * 60;
  const climbing = ((ride.gainFt ?? 0) / 1000) * 15;
  return Math.round((moving + climbing) * 1.1); // +10% for stops
}

export function diffIndex(d: Difficulty): number {
  return DIFFICULTY_ORDER.indexOf(d);
}

/** Is the requested difficulty inside the area's range? Used as a filter. */
export function matchesDifficulty(area: RidingArea, choice: DifficultyChoice): boolean {
  if (choice === 'any') return true;
  const i = diffIndex(choice);
  return i >= diffIndex(area.difficultyRange[0]) && i <= diffIndex(area.difficultyRange[1]);
}

/** Pick the signature ride that best matches difficulty and duration. */
export function pickRide(area: RidingArea, choice: DifficultyChoice, mode: ModeSpec, maxRideMin: number | null): SignatureRide | null {
  if (!area.rides.length) return null;
  const target = maxRideMin != null ? Math.min(mode.rideDefault, maxRideMin) : mode.rideDefault;
  const scored = area.rides.map((r) => {
    const mins = estimateRideMinutes(r);
    let s = 0;
    if (choice !== 'any') s -= Math.abs(diffIndex(r.difficulty) - diffIndex(choice)) * 2;
    if (mins != null) {
      s -= Math.abs(mins - target) / 60;
      if (maxRideMin != null && mins > maxRideMin) s -= 3;
    } else s -= 0.75; // unknown length is less useful than a known one
    return { r, s };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored[0].r;
}

export interface FitComponent {
  value: number; // 0..1
  note: string;
}

export function difficultyFit(area: RidingArea, choice: DifficultyChoice): FitComponent {
  if (choice === 'any') return { value: 0.8, note: 'Any difficulty' };
  if (matchesDifficulty(area, choice)) {
    const exact = area.difficultyRange[0] === choice || area.difficultyRange[1] === choice;
    return { value: exact ? 1 : 0.9, note: 'Matches the difficulty you picked' };
  }
  return { value: 0.2, note: 'Outside the difficulty you picked' };
}

export function vibeFit(area: RidingArea, vibe: Vibe): FitComponent {
  const c = area.character;
  const v = (x: number | null, fallback = 2) => (x == null ? fallback : x);
  const hardest = diffIndex(area.difficultyRange[1]);
  switch (vibe) {
    case 'any':
      return { value: 0.75, note: 'Any vibe' };
    case 'cruise': {
      const val = 1 - (Math.max(0, v(c.technical) - 1) * 0.25 + Math.max(0, v(c.chunk) - 1) * 0.15) + (area.scenic ? 0.1 : 0);
      return { value: clamp01(val), note: v(c.technical) <= 1 ? 'Low-stress terrain' : 'More technical than a cruise' };
    }
    case 'rip': {
      const val = v(c.flow) / 4 * 0.7 + (v(c.technical) >= 1 && v(c.technical) <= 3 ? 0.3 : 0.1);
      return { value: clamp01(val), note: v(c.flow) >= 3 ? 'Flowy and fast' : 'Not the flowiest option' };
    }
    case 'technical': {
      const val = Math.max(v(c.technical), v(c.rock), v(c.chunk)) / 4;
      return { value: clamp01(val), note: v(c.technical) >= 3 ? 'Plenty of rock and features' : 'Only mildly technical' };
    }
    case 'earn': {
      const val = v(c.climbing) / 4;
      return { value: clamp01(val), note: v(c.climbing) >= 3 ? 'Serious climbing' : 'Moderate climbing' };
    }
    case 'questionable': {
      const val = (v(c.technical) / 4) * 0.6 + (hardest >= 2 ? 0.4 : 0);
      return { value: clamp01(val), note: hardest >= 3 ? 'Double-black lines available' : hardest >= 2 ? 'Black-diamond terrain' : 'Too tame for questionable decisions' };
    }
  }
}

export function preferenceFit(area: RidingArea, ride: SignatureRide | null, prefs: Preferences): { value: number; notes: string[] } {
  let score = 0.7;
  const notes: string[] = [];
  const c = area.character;
  if (prefs.likesTechnical && (c.technical ?? 0) >= 3) {
    score += 0.15;
    notes.push('technical, like you like it');
  }
  if (prefs.likesFlow && (c.flow ?? 0) >= 3) {
    score += 0.15;
    notes.push('good flow');
  }
  if (prefs.dislikesExposure && (c.exposure ?? 0) >= 2) {
    score -= 0.25;
    notes.push('some exposure');
  }
  if (prefs.wantsScenic && area.scenic) {
    score += 0.1;
    notes.push('scenic');
  }
  if (ride && prefs.minRideMiles != null && ride.distanceMi != null && ride.distanceMi < prefs.minRideMiles) {
    score -= 0.2;
    notes.push(`shorter than your ${prefs.minRideMiles} mi minimum`);
  }
  if (ride && prefs.maxClimbFt != null && ride.gainFt != null && ride.gainFt > prefs.maxClimbFt) {
    score -= 0.25;
    notes.push(`more climbing than your ${prefs.maxClimbFt.toLocaleString()}′ limit`);
  }
  return { value: clamp01(score), notes };
}

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
