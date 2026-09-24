import type { Place, PlaceCategory } from '../services/types';
import { estimateLocalDriveMin, haversineMi, type LatLon } from '../utils/geo';
import { hoursForDay, openStateAt, type OpenState } from '../utils/openingHours';

export interface PlaceOption {
  place: Place;
  miles: number; // straight-line from trailhead
  driveMin: number; // estimate
  open: OpenState; // at the time we'd arrive
  hoursToday: string | null;
  patio: boolean | null;
  dogs: boolean | null;
  food: boolean | null;
  phone: string | null;
  website: string | null;
}

export interface ApresFilters {
  patio?: boolean;
  dogs?: boolean;
  food?: boolean;
  openAfterRide?: boolean;
  close?: boolean; // ≤ 10 min
}

const yesNo = (v: string | undefined): boolean | null => (v == null ? null : v === 'yes' || v === 'designated' ? true : v === 'no' ? false : null);

export function toOption(place: Place, from: LatLon, weekday: number, arriveMin: number): PlaceOption {
  const miles = haversineMi(from, place);
  const t = place.tags;
  const foodTag = t.food ?? (place.categories.includes('food') ? 'yes' : undefined);
  return {
    place,
    miles,
    driveMin: estimateLocalDriveMin(miles),
    open: openStateAt(t.opening_hours, weekday, arriveMin),
    hoursToday: hoursForDay(t.opening_hours, weekday),
    patio: yesNo(t.outdoor_seating),
    dogs: yesNo(t.dog),
    food: yesNo(foodTag),
    phone: t.phone ?? t['contact:phone'] ?? null,
    website: t.website ?? t['contact:website'] ?? null,
  };
}

export function apresOptions(
  places: Place[],
  category: PlaceCategory,
  from: LatLon,
  weekday: number,
  rideEndMin: number,
  filters: ApresFilters = {},
): PlaceOption[] {
  return places
    .filter((p) => p.categories.includes(category))
    .map((p) => toOption(p, from, weekday, rideEndMin + 10 + estimateLocalDriveMin(haversineMi(from, p))))
    .filter((o) => {
      if (filters.patio && o.patio !== true) return false;
      if (filters.dogs && o.dogs !== true) return false;
      if (filters.food && o.food !== true) return false;
      if (filters.openAfterRide && o.open !== 'open') return false;
      if (filters.close && o.driveMin > 10) return false;
      return true;
    })
    .sort((a, b) => rankOpen(a.open) - rankOpen(b.open) || a.miles - b.miles);
}

const rankOpen = (s: OpenState) => (s === 'open' ? 0 : s === 'unknown' ? 1 : 2);

/** Nearest brewery to a trailhead from a regional list (for Bike + Brewery ranking). */
export function nearestBrewery(breweries: Place[], from: LatLon): { place: Place; miles: number; driveMin: number } | null {
  let best: { place: Place; miles: number } | null = null;
  for (const b of breweries) {
    const miles = haversineMi(from, b);
    if (!best || miles < best.miles) best = { place: b, miles };
  }
  return best ? { ...best, driveMin: estimateLocalDriveMin(best.miles) } : null;
}

export interface ShopService {
  key: string;
  label: string;
  icon: string;
}

/** Only services explicitly tagged in OSM. */
export function bikeShopServices(tags: Record<string, string>): ShopService[] {
  const out: ShopService[] = [];
  const has = (k: string) => tags[k] === 'yes';
  if (has('service:bicycle:repair')) out.push({ key: 'repair', label: 'Repairs', icon: '🔧' });
  if (has('service:bicycle:retail') || has('service:bicycle:parts')) out.push({ key: 'parts', label: 'Parts', icon: '🔩' });
  if (has('service:bicycle:rental')) out.push({ key: 'rental', label: 'Rentals', icon: '🚲' });
  if (has('service:bicycle:cleaning')) out.push({ key: 'wash', label: 'Bike wash', icon: '🧰' });
  if (has('service:bicycle:pump')) out.push({ key: 'pump', label: 'Pump', icon: '🛞' });
  return out;
}
