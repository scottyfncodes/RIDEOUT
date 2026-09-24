/**
 * Door-to-door plan. All values are minutes after local midnight on the ride date.
 * Drive home from an apres stop reuses the trailhead→home drive time (labelled approximate).
 */

export interface PlanStep {
  kind: 'leave' | 'arrive' | 'ride-start' | 'ride-end' | 'car' | 'apres' | 'apres-leave' | 'home';
  at: number;
  label: string;
  detail?: string;
}

export interface Itinerary {
  steps: PlanStep[];
  leaveHome: number;
  arriveTrailhead: number;
  rideStart: number;
  rideEnd: number;
  backAtCar: number;
  apres: { name: string; arrive: number; leave: number } | null;
  home: number;
  totalMin: number;
  warnings: string[];
}

export interface PlanInput {
  driveMin: number;
  rideStartMin: number;
  rideMin: number;
  gearUpMin?: number;
  packUpMin?: number;
  apres?: { name: string; driveMin: number; stayMin?: number } | null;
}

const floor5 = (m: number) => Math.floor(m / 5) * 5;
const ceil5 = (m: number) => Math.ceil(m / 5) * 5;

export function buildItinerary(p: PlanInput): Itinerary {
  const gear = p.gearUpMin ?? 15;
  const pack = p.packUpMin ?? 10;
  const drive = Math.max(0, Math.round(p.driveMin));
  const rideStart = p.rideStartMin;
  const rideEnd = rideStart + Math.round(p.rideMin);
  const arrive = rideStart - gear;
  const leave = floor5(arrive - drive);
  const backAtCar = rideEnd + pack;
  const warnings: string[] = [];

  let apres: Itinerary['apres'] = null;
  let home: number;
  if (p.apres) {
    const aArrive = ceil5(backAtCar + Math.round(p.apres.driveMin));
    const aLeave = aArrive + (p.apres.stayMin ?? 75);
    apres = { name: p.apres.name, arrive: aArrive, leave: aLeave };
    home = ceil5(aLeave + drive);
  } else {
    home = ceil5(backAtCar + drive);
  }

  if (leave < 4 * 60) warnings.push('This plan has you leaving before 4 AM.');
  if (home >= 24 * 60) warnings.push('This plan gets you home after midnight.');

  const steps: PlanStep[] = [
    { kind: 'leave', at: leave, label: 'Leave home' },
    { kind: 'arrive', at: arrive, label: 'Trailhead', detail: `${gear} min to gear up` },
    { kind: 'ride-start', at: rideStart, label: 'Ride' },
    { kind: 'ride-end', at: rideEnd, label: 'Ride done' },
    { kind: 'car', at: backAtCar, label: 'Back at car' },
  ];
  if (apres) {
    steps.push({ kind: 'apres', at: apres.arrive, label: apres.name });
    steps.push({ kind: 'apres-leave', at: apres.leave, label: 'Head home' });
  }
  steps.push({ kind: 'home', at: home, label: 'Home' });

  return { steps, leaveHome: leave, arriveTrailhead: arrive, rideStart, rideEnd, backAtCar, apres, home, totalMin: home - leave, warnings };
}

/** Earliest possible ride start if you left right now. */
export function earliestRideStart(nowMin: number, driveMin: number, gearUpMin = 15): number {
  return nowMin + Math.round(driveMin) + gearUpMin;
}
