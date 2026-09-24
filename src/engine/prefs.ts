import type { DifficultyChoice, DriveLimit } from './modes';

/** On-device preferences. No account; stored in localStorage. */
export interface Preferences {
  home: { lat: number; lon: number; label: string } | null;
  preferredDifficulty: DifficultyChoice;
  maxDrive: DriveLimit;
  minRideMiles: number | null;
  maxClimbFt: number | null;
  likesTechnical: boolean;
  dislikesExposure: boolean;
  likesFlow: boolean;
  wantsBrewery: boolean;
  wantsScenic: boolean;
  /** Minutes between arriving at the trailhead and rolling out. */
  gearUpMin: number;
}

export const DEFAULT_PREFS: Preferences = {
  home: null,
  preferredDifficulty: 'any',
  maxDrive: null,
  minRideMiles: null,
  maxClimbFt: null,
  likesTechnical: false,
  dislikesExposure: false,
  likesFlow: false,
  wantsBrewery: false,
  wantsScenic: false,
  gearUpMin: 15,
};

const KEY = 'rideout:prefs:v1';

export function loadPrefs(): Preferences {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return sanitizePrefs(parsed);
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(p: Preferences): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable — preferences last for this session only */
  }
}

export function sanitizePrefs(p: Partial<Preferences>): Preferences {
  const out: Preferences = { ...DEFAULT_PREFS, ...p };
  const home = p.home;
  out.home =
    home && Number.isFinite(home.lat) && Number.isFinite(home.lon) && Math.abs(home.lat) <= 90 && Math.abs(home.lon) <= 180
      ? { lat: home.lat, lon: home.lon, label: String(home.label ?? 'Home') }
      : null;
  if (![30, 60, 90, null].includes(out.maxDrive as number | null)) out.maxDrive = null;
  if (!['any', 'green', 'blue', 'black', 'dblack'].includes(out.preferredDifficulty)) out.preferredDifficulty = 'any';
  out.minRideMiles = Number.isFinite(out.minRideMiles as number) && (out.minRideMiles as number) > 0 ? out.minRideMiles : null;
  out.maxClimbFt = Number.isFinite(out.maxClimbFt as number) && (out.maxClimbFt as number) > 0 ? out.maxClimbFt : null;
  out.gearUpMin = Number.isFinite(out.gearUpMin) ? Math.min(60, Math.max(0, out.gearUpMin)) : 15;
  return out;
}
