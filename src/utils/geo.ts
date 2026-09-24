export interface LatLon {
  lat: number;
  lon: number;
}

const R_MI = 3958.8;

export function haversineMi(a: LatLon, b: LatLon): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_MI * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Rough road estimate from straight-line distance, used ONLY when routing fails.
 * Front Range roads wind; 1.35× detour and 38 mph average are deliberately conservative.
 * Always labelled "estimate" in the UI.
 */
export function estimateDrive(a: LatLon, b: LatLon): { miles: number; minutes: number } {
  const miles = haversineMi(a, b) * 1.35;
  return { miles, minutes: Math.max(5, (miles / 38) * 60) };
}

/** Short hop from trailhead to a nearby business: slower average, shorter detour. */
export function estimateLocalDriveMin(miles: number): number {
  return Math.max(2, Math.round(((miles * 1.3) / 30) * 60));
}

export function isValidLatLon(p: Partial<LatLon> | null | undefined): p is LatLon {
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat!) <= 90 && Math.abs(p.lon!) <= 180;
}
