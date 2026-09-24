import type { Difficulty } from '../content/types';

/** HOW LONG — shapes the time budget. */
export type RideMode = 'quick' | 'half' | 'adventure' | 'brewery';
/** VIBE — shapes the kind of riding. */
export type Vibe = 'any' | 'cruise' | 'rip' | 'technical' | 'earn' | 'questionable';
export type DifficultyChoice = Difficulty | 'any';
export type DriveLimit = 30 | 60 | 90 | null;

export interface ModeSpec {
  id: RideMode;
  label: string;
  emoji: string;
  blurb: string;
  /** Acceptable ride duration in minutes. */
  rideMin: number;
  rideMax: number;
  /** Default ride duration when the route length is unknown. */
  rideDefault: number;
  /** Total outing budget (door-to-door incl. apres) in minutes, or null for no cap. */
  outingBudget: number | null;
  wantsApres: boolean;
}

export const MODES: Record<RideMode, ModeSpec> = {
  quick: { id: 'quick', label: 'Quick Rip', emoji: '⚡', blurb: 'Short, close, go', rideMin: 40, rideMax: 120, rideDefault: 90, outingBudget: 180, wantsApres: false },
  half: { id: 'half', label: 'Half Day', emoji: '🚵', blurb: 'A proper ride', rideMin: 90, rideMax: 240, rideDefault: 150, outingBudget: 360, wantsApres: false },
  adventure: { id: 'adventure', label: 'Big Adventure', emoji: '🏔️', blurb: 'Long day out', rideMin: 150, rideMax: 480, rideDefault: 240, outingBudget: null, wantsApres: true },
  brewery: { id: 'brewery', label: 'Bike + Brewery', emoji: '🍺', blurb: 'Ride, then a pint', rideMin: 60, rideMax: 240, rideDefault: 120, outingBudget: null, wantsApres: true },
};

export const QUICK_BUDGETS = [120, 180, 240];

export interface VibeSpec {
  id: Vibe;
  label: string;
  emoji: string;
  blurb: string;
}

export const VIBES: VibeSpec[] = [
  { id: 'any', label: 'Anything', emoji: '🎲', blurb: 'Surprise me' },
  { id: 'cruise', label: 'Cruise', emoji: '🟢', blurb: 'Easy, scenic, low stress' },
  { id: 'rip', label: 'Rip', emoji: '🔵', blurb: 'Fast, fun, flowy' },
  { id: 'technical', label: 'Get Technical', emoji: '🟣', blurb: 'Rocks, features' },
  { id: 'earn', label: 'Earn It', emoji: '🔴', blurb: 'Big climbing' },
  { id: 'questionable', label: 'Questionable Decisions', emoji: '💀', blurb: 'Very hard' },
];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  green: 'Green',
  blue: 'Blue',
  black: 'Black',
  dblack: 'Double Black',
};

export const DIFFICULTY_ICON: Record<Difficulty, string> = {
  green: '🟢',
  blue: '🔵',
  black: '⚫',
  dblack: '💀',
};

export interface SearchParams {
  date: string;
  mode: RideMode;
  vibe: Vibe;
  difficulty: DifficultyChoice;
  maxDrive: DriveLimit;
  /** Quick Rip total budget in minutes. */
  quickBudget: number;
}
