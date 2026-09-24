/**
 * Static content model for riding areas.
 *
 * Rules (see docs/PRODUCT_BRIEF.md):
 *  - `null` means "we don't know" and renders as "Not enough data". Never guess.
 *  - Every factual claim that matters carries a Source.
 *  - Ride-character ratings are RIDEOUT editorial judgements, labelled as such.
 */

export type Confidence = 'official' | 'reported' | 'editorial' | 'estimate';

export interface Source {
  label: string;
  url?: string;
  confidence: Confidence;
  /** ISO date the fact was last checked by a human. */
  checked?: string;
}

export type Difficulty = 'green' | 'blue' | 'black' | 'dblack';
export const DIFFICULTY_ORDER: Difficulty[] = ['green', 'blue', 'black', 'dblack'];

/** 0 = none, 1 = low, 2 = moderate, 3 = high, 4 = extreme. null = not enough data. */
export type Rating = 0 | 1 | 2 | 3 | 4 | null;

export interface RideCharacter {
  technical: Rating;
  climbing: Rating;
  descending: Rating;
  flow: Rating;
  chunk: Rating;
  exposure: Rating;
  roots: Rating;
  rock: Rating;
  jumps: Rating;
  drops: Rating;
  hikeABike: Rating;
}

export interface SignatureRide {
  id: string;
  name: string;
  distanceMi: number | null;
  gainFt: number | null;
  highPointFt?: number | null;
  difficulty: Difficulty;
  /** Typical moving+stopped time in minutes for a fit intermediate rider, if a source gives one. */
  typicalMinutes?: number | null;
  source: Source | null;
  notes?: string;
}

/**
 * Access rules evaluated per date. Hard rules gate the recommendation.
 *  - closedWeekdays: area is closed to bikes (0=Sun..6=Sat)
 *  - oddEvenDates: some trails change use by calendar date (advisory; area stays open)
 *  - seasonal: closed to bikes between month/day ranges (inclusive)
 */
export type AccessRule =
  | { kind: 'closedWeekdays'; days: number[]; summary: string; source: Source }
  | { kind: 'oddEvenDates'; bikesOn: 'even' | 'odd'; summary: string; source: Source }
  | { kind: 'seasonal'; from: [number, number]; to: [number, number]; summary: string; source: Source }
  | { kind: 'advisory'; summary: string; source: Source };

export interface Parking {
  primary: string | null;
  fee: string | null;
  hours: string | null;
  overflow: string | null;
  restrictions: string | null;
  restrooms: boolean | null;
  amenities: string[];
  /** e.g. "Fills early on weekends" — only when reported by a source. */
  availability: string | null;
  source: Source | null;
}

/** How quickly the soil sheds water. Drives the mud-risk estimate. */
export type Drainage = 'fast' | 'moderate' | 'slow';

export interface RidingArea {
  id: string;
  name: string;
  region: string;
  subregion: string;
  manager: string;
  trailhead: { name: string; lat: number; lon: number; approximate: boolean };
  /** Approximate trailhead elevation in feet; weather model elevation is shown separately. */
  trailheadElevationFt: number | null;
  networkMiles: number | null;
  networkMilesSource: Source | null;
  trailCount: number | null;
  difficultyRange: [Difficulty, Difficulty];
  character: RideCharacter;
  characterSource: Source;
  drainage: Drainage;
  drainageNote: string;
  summary: string;
  tags: string[];
  scenic: boolean;
  rides: SignatureRide[];
  access: AccessRule[];
  parking: Parking;
  links: {
    official: string | null;
    officialLabel?: string;
    officialMap: string | null;
    trailMap: string | null;
    conditions: string | null;
  };
  /** Nearby town used as an apres hub, if relevant. */
  apresHub?: { name: string; lat: number; lon: number };
}
