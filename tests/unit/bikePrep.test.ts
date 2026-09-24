import { ALL_AREAS, getArea } from '../../src/content/areas';
import { bikePrep, MAX_CHECKS } from '../../src/engine/bikePrep';
import { EMPTY_BIKE, type Bike } from '../../src/engine/garage';
import { evaluateArea, type EngineInput } from '../../src/engine/recommend';
import { DEFAULT_PREFS } from '../../src/engine/prefs';
import { parseForecast, OPEN_METEO_SOURCE } from '../../src/services/weather/openMeteo';
import { OSRM_SOURCE } from '../../src/services/routing/drive';
import type { AreaForecast, DriveInfo, Fetched } from '../../src/services/types';
import { buildPayload, type DayOpts } from '../fixtures/openMeteo';

const today = '2026-09-23';
const fx = (days: Record<number, DayOpts> = {}): Record<string, Fetched<AreaForecast>> =>
  Object.fromEntries(ALL_AREAS.map((a) => [a.id, { ok: true, data: parseForecast(buildPayload({ today, days })), source: OPEN_METEO_SOURCE, fetchedAt: '', fromCache: false }]));
const drives = Object.fromEntries(ALL_AREAS.map((a) => [a.id, { minutes: 40, miles: 30, method: 'routed', source: OSRM_SOURCE } as DriveInfo]));
const input = (p: Partial<EngineInput> = {}, date = '2026-09-24'): EngineInput => ({
  areas: ALL_AREAS,
  forecasts: fx(),
  drives,
  breweries: null,
  prefs: DEFAULT_PREFS,
  params: { date, mode: 'half', vibe: 'any', difficulty: 'any', maxDrive: null, quickBudget: 180 },
  nowMin: null,
  ...p,
});
const rec = (id: string, p: Partial<EngineInput> = {}, date?: string) => evaluateArea(getArea(id)!, input(p, date));
const bike = (b: Partial<Bike> = {}): Bike => ({ ...EMPTY_BIKE, nickname: 'Trail Bike', ...b });
const ids = (p: ReturnType<typeof bikePrep>) => p!.checks.map((c) => c.id);

describe('bike prep: relevant guidance appears', () => {
  it('technical, rocky ride → tires, pressure and brakes', () => {
    const p = bikePrep(rec('walker-ranch'), bike())!;
    expect(p.triggers.map((t) => t.id)).toContain('technical');
    expect(ids(p)).toEqual(expect.arrayContaining(['pressure', 'tires', 'brakes']));
    expect(p.triggers.find((t) => t.id === 'technical')!.basis).toMatch(/editorial/);
  });
  it('long ride → drivetrain, flat kit, repair kit', () => {
    const p = bikePrep(rec('staunton'), bike({ tubeless: true }))!;
    expect(p.triggers.map((t) => t.id)).toEqual(expect.arrayContaining(['long', 'bigvert']));
    expect(ids(p)).toEqual(expect.arrayContaining(['drivetrain', 'sealant']));
  });
  it('tailors the flat kit to the bike: tubes → spare tube, not sealant', () => {
    const p = bikePrep(rec('staunton'), bike({ tubeless: false }))!;
    expect(ids(p)).toContain('tube');
    expect(ids(p)).not.toContain('sealant');
  });
  it('e-MTB on a long, big day → battery check', () => {
    expect(ids(bikePrep(rec('staunton'), bike({ type: 'emtb' })))).toContain('battery');
  });
  it('cold ride → pressure reminder, based on the forecast', () => {
    const p = bikePrep(rec('marshall-mesa', { forecasts: fx({ 1: { low: 28, high: 42 } }) }), bike())!;
    const cold = p.triggers.find((t) => t.id === 'cold')!;
    expect(cold.basis).toMatch(/^Forecast:/);
    expect(ids(p)).toContain('pressure');
  });
  it('wet: elevated/high mud estimate → brakes, drivetrain, clean after', () => {
    const p = bikePrep(rec('marshall-mesa', { forecasts: fx({ 0: { precip: 0.8, high: 55 } }) }), bike())!;
    expect(p.triggers.find((t) => t.id === 'wet')!.basis).toMatch(/Mud-risk estimate/);
    expect(ids(p)).toEqual(expect.arrayContaining(['brakes', 'drivetrain', 'clean']));
  });
  it('keeps the list short and puts shared checks first', () => {
    const p = bikePrep(rec('walker-ranch', { forecasts: fx({ 1: { low: 28, high: 42 } }) }), bike())!;
    expect(p.checks.length).toBeLessThanOrEqual(MAX_CHECKS);
    expect(new Set(ids(p)).size).toBe(p.checks.length);
  });
});

describe('bike prep: stays quiet when there is nothing useful to say', () => {
  it('short, mellow ride on a mild dry day → no panel', () => {
    expect(bikePrep(rec('marshall-mesa'), bike())).toBeNull();
    // Quick Rip picks the short 5 mi / 836′ loop at Green Mountain.
    const quick = evaluateArea(getArea('green-mountain')!, { ...input(), params: { ...input().params, mode: 'quick', quickBudget: 120 } });
    expect(quick.ride!.distanceMi).toBe(5);
    expect(bikePrep(quick, null)).toBeNull();
  });
  it('the same area earns prep when the chosen ride is bigger', () => {
    const p = bikePrep(rec('green-mountain'), null)!; // Half Day → 10.8 mi / 1,683′ loop
    expect(p.triggers.map((t) => t.id)).toEqual(['bigvert']);
  });
  it('area closed to bikes that day → no prep', () => {
    expect(bikePrep(rec('betasso', {}, '2026-09-26'), bike())).toBeNull();
  });
});

describe('bike prep: honest with bike data', () => {
  it('shows the rider’s own pressures only as “usual”, never a recommendation', () => {
    const p = bikePrep(rec('walker-ranch'), bike({ frontPsi: 23, rearPsi: 25 }))!;
    expect(p.usualPsi).toEqual({ front: 23, rear: 25 });
    expect(bikePrep(rec('walker-ranch'), bike())!.usualPsi).toBeNull();
  });
  it('works with an incomplete bike or no bike at all', () => {
    expect(() => bikePrep(rec('staunton'), bike())).not.toThrow();
    const p = bikePrep(rec('staunton'), null)!;
    expect(p.tailored).toBe(false);
    expect(ids(p)).toContain('sealant'); // unknown setup → default flat-kit advice
  });
  it('still works when weather is unavailable (no fabricated weather triggers)', () => {
    const f = fx();
    f['walker-ranch'] = { ok: false, error: 'down', source: OPEN_METEO_SOURCE };
    const p = bikePrep(rec('walker-ranch', { forecasts: f }), bike())!;
    expect(p.triggers.map((t) => t.id)).not.toContain('cold');
    expect(p.triggers.map((t) => t.id)).not.toContain('wet');
    expect(p.triggers.map((t) => t.id)).toContain('technical');
  });
  it('technical trigger fires for areas rated technical/rocky', () => {
    const technical = ALL_AREAS.filter((a) => Math.max(a.character.technical ?? 0, a.character.rock ?? 0, a.character.chunk ?? 0) >= 3);
    for (const a of technical) expect(bikePrep(evaluateArea(a, input()), null)!.triggers.map((t) => t.id)).toContain('technical');
  });
});
