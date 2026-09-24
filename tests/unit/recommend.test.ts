import { ALL_AREAS, getArea } from '../../src/content/areas';
import { recommend, evaluateArea, type EngineInput } from '../../src/engine/recommend';
import { DEFAULT_PREFS } from '../../src/engine/prefs';
import { parseForecast, OPEN_METEO_SOURCE } from '../../src/services/weather/openMeteo';
import type { AreaForecast, DriveInfo, Fetched } from '../../src/services/types';
import { OSRM_SOURCE } from '../../src/services/routing/drive';
import { buildPayload, stormyAfternoon, type DayOpts } from '../fixtures/openMeteo';
import type { SearchParams } from '../../src/engine/modes';

const today = '2026-09-23'; // a Wednesday

function forecasts(days: Record<number, DayOpts> = {}, date = today): Record<string, Fetched<AreaForecast>> {
  const out: Record<string, Fetched<AreaForecast>> = {};
  for (const a of ALL_AREAS) out[a.id] = { ok: true, data: parseForecast(buildPayload({ today: date, days })), source: OPEN_METEO_SOURCE, fetchedAt: '', fromCache: false };
  return out;
}
function drives(min = 45): Record<string, DriveInfo> {
  return Object.fromEntries(ALL_AREAS.map((a) => [a.id, { minutes: min, miles: min * 0.8, method: 'routed', source: OSRM_SOURCE } as DriveInfo]));
}
const params = (p: Partial<SearchParams> = {}): SearchParams => ({ date: '2026-09-24', mode: 'half', vibe: 'any', difficulty: 'any', maxDrive: null, quickBudget: 180, ...p });
const input = (p: Partial<EngineInput> = {}): EngineInput => ({
  areas: ALL_AREAS,
  forecasts: forecasts(),
  drives: drives(),
  breweries: null,
  prefs: DEFAULT_PREFS,
  params: params(),
  nowMin: null,
  ...p,
});

describe('recommendation scoring', () => {
  it('sends it on a perfect day with a clear, explained reason', () => {
    const { results } = recommend(input());
    expect(results.length).toBe(ALL_AREAS.length);
    expect(results[0].status).toBe('send');
    expect(results[0].why.length).toBeGreaterThan(0);
    expect(results[0].headline).toMatch(/weather|precip|Fits/i);
  });
  it('score is a weighted mean of the displayed components', () => {
    const r = evaluateArea(getArea('buffalo-creek')!, input());
    const known = r.components.filter((c) => c.value != null);
    const expected = Math.round((known.reduce((a, c) => a + c.weight * c.value!, 0) / known.reduce((a, c) => a + c.weight, 0)) * 100);
    expect(r.score).toBe(expected);
  });
  it('recommends an early start when afternoon storms build', () => {
    const r = evaluateArea(getArea('buffalo-creek')!, input({ forecasts: forecasts({ 1: stormyAfternoon }) }));
    expect(r.window!.window!.end).toBeLessThanOrEqual(13 * 60 + 15);
    expect(r.whyNot.join(' ')).toMatch(/Storm risk increases/);
  });
  it('caps status on high mud risk and explains why not', () => {
    const r = evaluateArea(getArea('marshall-mesa')!, input({ forecasts: forecasts({ 0: { precip: 0.8, high: 55 } }) }));
    expect(r.mud.level).toBe('high');
    expect(r.status).toBe('skip');
    expect(r.whyNot.join(' ')).toMatch(/wet/);
  });
  it('fast-draining granite can still be ridden when clay cannot', () => {
    const fx = forecasts({ 0: { precip: 0.2, high: 70 } });
    const granite = evaluateArea(getArea('betasso')!, input({ forecasts: fx, params: params({ date: '2026-09-24' }) }));
    const clay = evaluateArea(getArea('marshall-mesa')!, input({ forecasts: fx }));
    expect(['low', 'moderate']).toContain(granite.mud.level);
    expect(['elevated', 'high']).toContain(clay.mud.level);
  });
  it('extreme weather (all-day thunderstorms) → skip everywhere', () => {
    const hours: DayOpts['hours'] = {};
    for (let i = 0; i < 24; i++) hours![i] = { pp: 90, code: 95, amt: 0.2 };
    const { results } = recommend(input({ forecasts: forecasts({ 1: { hours } }) }));
    expect(results.every((r) => r.status === 'skip')).toBe(true);
  });
  it('extreme heat caps the day', () => {
    const { results } = recommend(input({ forecasts: forecasts({ 1: { high: 104, low: 88 } }) }));
    expect(results.every((r) => r.status !== 'send')).toBe(true);
  });
});

describe('access rules by date', () => {
  it('Betasso is SKIP on Wednesdays and Saturdays (closed to bikes)', () => {
    for (const date of ['2026-09-23', '2026-09-26']) {
      const r = evaluateArea(getArea('betasso')!, input({ params: params({ date }) }));
      expect(r.status).toBe('skip');
      expect(r.whyNot[0]).toMatch(/Closed to bikes/);
    }
    const thu = evaluateArea(getArea('betasso')!, input({ params: params({ date: '2026-09-24' }) }));
    expect(thu.status).not.toBe('skip');
  });
  it('Apex notes odd/even designated use and penalises odd dates', () => {
    const even = evaluateArea(getArea('apex')!, input({ params: params({ date: '2026-09-24' }) }));
    const odd = evaluateArea(getArea('apex')!, input({ params: params({ date: '2026-09-25' }) }));
    expect(even.access.notes[0]).toMatch(/bikes-only today/);
    expect(odd.access.notes[0]).toMatch(/closed to bikes today/);
    expect(odd.score!).toBeLessThan(even.score!);
  });
  it('changing the date changes the evaluation', () => {
    const wetMorning: DayOpts = { hours: { 7: { pp: 80, amt: 0.05 }, 8: { pp: 80, amt: 0.05 }, 9: { pp: 70 }, 10: { pp: 60 } } };
    const fx = forecasts({ 1: {}, 2: wetMorning });
    const a = evaluateArea(getArea('green-mountain')!, input({ forecasts: fx, params: params({ date: '2026-09-24' }) }));
    const b = evaluateArea(getArea('green-mountain')!, input({ forecasts: fx, params: params({ date: '2026-09-25' }) }));
    expect(b.window!.window!.start).toBeGreaterThan(a.window!.window!.start);
    expect(b.score!).toBeLessThan(a.score!);
  });
});

describe('filtering', () => {
  it('difficulty filter excludes areas whose range does not include the choice', () => {
    const { results, excluded } = recommend(input({ params: params({ difficulty: 'dblack' }) }));
    expect(results.map((r) => r.area.id)).toEqual(['floyd-hill']);
    expect(excluded.length).toBe(ALL_AREAS.length - 1);
  });
  it('green shows only areas with green terrain', () => {
    const { results } = recommend(input({ params: params({ difficulty: 'green' }) }));
    expect(results.every((r) => r.area.difficultyRange[0] === 'green')).toBe(true);
  });
  it('drive filter excludes far areas with a reason', () => {
    const d = drives(40);
    d['buffalo-creek'].minutes = 75;
    const { results, excluded } = recommend(input({ drives: d, params: params({ maxDrive: 60 }) }));
    expect(results.find((r) => r.area.id === 'buffalo-creek')).toBeUndefined();
    expect(excluded.find((e) => e.area.id === 'buffalo-creek')!.reason).toMatch(/75 min/);
  });
  it('no-results scenario returns an empty list plus reasons', () => {
    const { results, excluded } = recommend(input({ drives: drives(120), params: params({ maxDrive: 30 }) }));
    expect(results).toHaveLength(0);
    expect(excluded).toHaveLength(ALL_AREAS.length);
  });
  it('Quick Rip penalises outings that blow the time budget', () => {
    const near = evaluateArea(getArea('green-mountain')!, input({ drives: drives(20), params: params({ mode: 'quick', quickBudget: 120 }) }));
    const far = evaluateArea(getArea('green-mountain')!, input({ drives: drives(70), params: params({ mode: 'quick', quickBudget: 120 }) }));
    const t = (r: typeof near) => r.components.find((c) => c.key === 'time')!.value!;
    expect(t(near)).toBe(1);
    expect(t(far)).toBeLessThan(0.5);
  });
});

describe('preferences', () => {
  it('dislikes exposure lowers exposed areas', () => {
    const base = evaluateArea(getArea('walker-ranch')!, input());
    const shy = evaluateArea(getArea('walker-ranch')!, input({ prefs: { ...DEFAULT_PREFS, dislikesExposure: true } }));
    expect(shy.score!).toBeLessThan(base.score!);
  });
  it('max climbing preference penalises big climbs', () => {
    const base = evaluateArea(getArea('staunton')!, input());
    const lim = evaluateArea(getArea('staunton')!, input({ prefs: { ...DEFAULT_PREFS, maxClimbFt: 1500 } }));
    expect(lim.score!).toBeLessThan(base.score!);
    expect(lim.components.find((c) => c.key === 'prefs')!.note).toMatch(/climbing/);
  });
  it('vibe changes ranking: technical favours rocky areas over mellow ones', () => {
    const { results } = recommend(input({ params: params({ vibe: 'technical' }) }));
    const idx = (id: string) => results.findIndex((r) => r.area.id === id);
    expect(idx('walker-ranch')).toBeLessThan(idx('marshall-mesa'));
  });
  it('Bike + Brewery mode rewards a nearby brewery', () => {
    const area = getArea('hall-ranch')!;
    const near = [{ id: 'node/1', name: 'Near Brew', lat: area.trailhead.lat + 0.01, lon: area.trailhead.lon, categories: ['brewery' as const], tags: {} }];
    const far = [{ id: 'node/2', name: 'Far Brew', lat: area.trailhead.lat + 0.4, lon: area.trailhead.lon, categories: ['brewery' as const], tags: {} }];
    const a = evaluateArea(area, input({ breweries: near, params: params({ mode: 'brewery' }) }));
    const b = evaluateArea(area, input({ breweries: far, params: params({ mode: 'brewery' }) }));
    expect(a.score!).toBeGreaterThan(b.score!);
    expect(a.itinerary!.apres!.name).toBe('Near Brew');
  });
});

describe('missing data', () => {
  it('weather unavailable → UNKNOWN, never a fake status', () => {
    const fx = forecasts();
    fx['apex'] = { ok: false, error: 'Weather unavailable', source: OPEN_METEO_SOURCE };
    const r = evaluateArea(getArea('apex')!, input({ forecasts: fx }));
    expect(r.status).toBe('unknown');
    expect(r.score).toBeNull();
    expect(r.mud.level).toBe('unknown');
    expect(r.headline).toMatch(/Weather unavailable/);
  });
  it('unknown ride length uses a typical duration and says so', () => {
    const r = evaluateArea(getArea('buffalo-creek')!, input());
    expect(r.rideMinutesEstimated).toBe(true);
    expect(r.components.find((c) => c.key === 'time')!.note).toMatch(/unknown/);
  });
  it('closed areas still sort below open ones', () => {
    const { results } = recommend(input({ params: params({ date: '2026-09-26' }) }));
    expect(results[results.length - 1].area.id === 'betasso' || results.at(-1)!.status === 'skip').toBe(true);
  });
  it('today with no daylight left → skip with explanation', () => {
    const r = evaluateArea(getArea('apex')!, input({ params: params({ date: today }), nowMin: 18 * 60 + 30 }));
    expect(r.status).toBe('skip');
    expect(r.whyNot.join(' ')).toMatch(/daylight/);
  });
});
