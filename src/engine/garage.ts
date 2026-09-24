/**
 * Garage: the rider's primary bike, light maintenance notes and today's
 * pre-ride checklist. Everything is user-entered and lives only on this device,
 * using the same guarded localStorage pattern as preferences.
 */

export type BikeType = 'mtb' | 'emtb';
export type WheelSize = '27.5' | '29' | 'mullet' | 'other';

export interface Bike {
  nickname: string;
  make: string | null;
  model: string | null;
  type: BikeType;
  wheel: WheelSize | null;
  frontTravelMm: number | null;
  rearTravelMm: number | null;
  tireSize: string | null;
  tubeless: boolean | null;
  frontPsi: number | null;
  rearPsi: number | null;
  dropper: boolean | null;
  suspensionNotes: string | null;
  brakes: string | null;
  drivetrain: string | null;
  weightLb: number | null;
}

export const EMPTY_BIKE: Bike = {
  nickname: '',
  make: null,
  model: null,
  type: 'mtb',
  wheel: null,
  frontTravelMm: null,
  rearTravelMm: null,
  tireSize: null,
  tubeless: null,
  frontPsi: null,
  rearPsi: null,
  dropper: null,
  suspensionNotes: null,
  brakes: null,
  drivetrain: null,
  weightLb: null,
};

export type ServiceKind = 'general' | 'suspension' | 'brakes' | 'drivetrain' | 'tires';

export interface ServiceEntry {
  date: string; // YYYY-MM-DD
}

export interface Maintenance {
  entries: Partial<Record<ServiceKind, ServiceEntry>>;
  notes: string | null;
}

export const EMPTY_MAINTENANCE: Maintenance = { entries: {}, notes: null };

const BIKE_KEY = 'rideout:bike:v1';
const MAINT_KEY = 'rideout:maintenance:v1';
const CHECK_KEY = 'rideout:checklist:v1';

// ---------- sanitizers (stored data is untrusted: old versions, manual edits) ----------

const str = (v: unknown, max = 80): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, max);
  return t ? t : null;
};
const num = (v: unknown, lo: number, hi: number): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n * 10) / 10 : null;
};
const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);
const isoDate = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export function sanitizeBike(raw: unknown): Bike | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const bike: Bike = {
    nickname: str(b.nickname, 40) ?? '',
    make: str(b.make, 40),
    model: str(b.model, 60),
    type: b.type === 'emtb' ? 'emtb' : 'mtb',
    wheel: (['27.5', '29', 'mullet', 'other'] as const).includes(b.wheel as WheelSize) ? (b.wheel as WheelSize) : null,
    frontTravelMm: num(b.frontTravelMm, 0, 300),
    rearTravelMm: num(b.rearTravelMm, 0, 300),
    tireSize: str(b.tireSize, 30),
    tubeless: bool(b.tubeless),
    frontPsi: num(b.frontPsi, 5, 60),
    rearPsi: num(b.rearPsi, 5, 60),
    dropper: bool(b.dropper),
    suspensionNotes: str(b.suspensionNotes, 200),
    brakes: str(b.brakes, 60),
    drivetrain: str(b.drivetrain, 60),
    weightLb: num(b.weightLb, 10, 90),
  };
  return hasBike(bike) ? bike : null;
}

/** A bike exists once it has a name or any identifying field. */
export function hasBike(b: Bike | null | undefined): b is Bike {
  return !!b && !!(b.nickname || b.make || b.model);
}

export function bikeTitle(b: Bike): string {
  return b.nickname || [b.make, b.model].filter(Boolean).join(' ') || 'My bike';
}

export function bikeSummary(b: Bike): string[] {
  const out: string[] = [];
  if (b.type === 'emtb') out.push('e-MTB');
  if (b.wheel) out.push(b.wheel === 'mullet' ? 'Mullet' : b.wheel === 'other' ? 'Other wheels' : `${b.wheel}″`);
  if (b.frontTravelMm != null || b.rearTravelMm != null) {
    out.push(b.rearTravelMm != null ? `${b.frontTravelMm ?? '—'} / ${b.rearTravelMm}mm` : `${b.frontTravelMm}mm fork`);
  }
  if (b.tubeless === true) out.push('Tubeless');
  if (b.tubeless === false) out.push('Tubes');
  return out;
}

export function sanitizeMaintenance(raw: unknown): Maintenance {
  if (!raw || typeof raw !== 'object') return { entries: {}, notes: null };
  const m = raw as { entries?: Record<string, unknown>; notes?: unknown };
  const entries: Maintenance['entries'] = {};
  for (const k of ['general', 'suspension', 'brakes', 'drivetrain', 'tires'] as ServiceKind[]) {
    const e = m.entries?.[k] as Record<string, unknown> | undefined;
    if (!e) continue;
    const date = isoDate(e.date);
    if (date) entries[k] = { date };
  }
  return { entries, notes: str(m.notes, 1000) };
}

// ---------- persistence ----------

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown): void {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: data lasts for this session only */
  }
}

export const loadBike = (): Bike | null => sanitizeBike(read(BIKE_KEY));
export const saveBike = (b: Bike | null): void => write(BIKE_KEY, b && hasBike(b) ? b : null);
export const loadMaintenance = (): Maintenance => sanitizeMaintenance(read(MAINT_KEY));
export const saveMaintenance = (m: Maintenance): void => write(MAINT_KEY, m);

/**
 * Checklist ticks only matter for today's ride: they're stored with the local
 * date and quietly reset on a new day. No history is kept.
 */
export function loadChecklist(today: string): string[] {
  const c = read(CHECK_KEY) as { date?: unknown; done?: unknown } | null;
  if (!c || c.date !== today || !Array.isArray(c.done)) return [];
  return c.done.filter((x): x is string => typeof x === 'string').slice(0, 50);
}
export function saveChecklist(today: string, done: string[]): void {
  write(CHECK_KEY, done.length ? { date: today, done } : null);
}

/** Whole days between an ISO date and today (null when unknown). */
export function daysSince(date: string | null, today: string): number | null {
  if (!date) return null;
  const [y1, m1, d1] = date.split('-').map(Number);
  const [y2, m2, d2] = today.split('-').map(Number);
  const diff = Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
  return diff >= 0 ? diff : null;
}
