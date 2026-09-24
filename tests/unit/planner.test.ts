import { buildItinerary, earliestRideStart } from '../../src/engine/planner';
import { estimateDrive, haversineMi } from '../../src/utils/geo';
import { buildTableUrl, fetchDriveTimes, parseTable } from '../../src/services/routing/drive';
import { osrmTable } from '../fixtures/places';

describe('buildItinerary', () => {
  it('works backwards from ride start to departure and forwards to home', () => {
    const it = buildItinerary({ driveMin: 45, rideStartMin: 8 * 60 + 15, rideMin: 210, gearUpMin: 15 });
    expect(it.arriveTrailhead).toBe(8 * 60);
    expect(it.leaveHome).toBe(7 * 60 + 15);
    expect(it.rideEnd).toBe(11 * 60 + 45);
    expect(it.backAtCar).toBe(11 * 60 + 55);
    expect(it.home).toBe(12 * 60 + 40);
    expect(it.totalMin).toBe(it.home - it.leaveHome);
  });
  it('rounds departure down to 5 minutes (never late)', () => {
    const it = buildItinerary({ driveMin: 53, rideStartMin: 8 * 60, rideMin: 60, gearUpMin: 15 });
    expect(it.leaveHome % 5).toBe(0);
    expect(it.leaveHome + 53 + 15).toBeLessThanOrEqual(8 * 60);
  });
  it('inserts an apres stop and extends the day', () => {
    const it = buildItinerary({ driveMin: 30, rideStartMin: 9 * 60, rideMin: 120, apres: { name: 'Brewery', driveMin: 8, stayMin: 60 } });
    expect(it.apres!.arrive).toBeGreaterThanOrEqual(it.backAtCar + 8);
    expect(it.home).toBeGreaterThanOrEqual(it.apres!.leave + 30);
    expect(it.steps.map((s) => s.kind)).toContain('apres');
  });
  it('warns about pre-dawn departures and after-midnight returns', () => {
    expect(buildItinerary({ driveMin: 200, rideStartMin: 6 * 60, rideMin: 60 }).warnings.length).toBeGreaterThan(0);
    expect(buildItinerary({ driveMin: 120, rideStartMin: 20 * 60, rideMin: 180 }).warnings.join()).toMatch(/midnight/);
  });
  it('computes the earliest start from now + drive + gear-up', () => {
    expect(earliestRideStart(10 * 60, 40, 15)).toBe(10 * 60 + 55);
  });
});

describe('drive-time calculations', () => {
  it('haversine is sane (Denver→Boulder ≈ 24 mi)', () => {
    expect(haversineMi({ lat: 39.7392, lon: -104.9903 }, { lat: 40.015, lon: -105.2705 })).toBeGreaterThan(22);
    expect(haversineMi({ lat: 39.7392, lon: -104.9903 }, { lat: 40.015, lon: -105.2705 })).toBeLessThan(26);
  });
  it('fallback estimate is conservative and positive', () => {
    const e = estimateDrive({ lat: 39.7392, lon: -104.9903 }, { lat: 40.015, lon: -105.2705 });
    expect(e.minutes).toBeGreaterThan(40);
    expect(estimateDrive({ lat: 39, lon: -105 }, { lat: 39, lon: -105 }).minutes).toBe(5);
  });
  it('parses an OSRM table and nulls unroutable destinations', () => {
    const t = osrmTable(3, (i) => 20 + i * 10);
    (t.durations[0] as Array<number | null>)[2] = null;
    const r = parseTable(t, 3);
    expect(r[0]!.minutes).toBe(20);
    expect(r[1]).toBeNull();
    expect(r[2]!.minutes).toBe(40);
    expect(() => parseTable({ code: 'NoRoute' }, 3)).toThrow();
  });
  it('builds a keyless OSRM URL in lon,lat order', () => {
    expect(buildTableUrl({ lat: 39.7, lon: -105 }, [{ lat: 40, lon: -105.3 }])).toContain('/-105.00000,39.70000;-105.30000,40.00000?sources=0');
  });
  it('falls back to labelled estimates when routing fails', async () => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const r = await fetchDriveTimes({ lat: 39.74, lon: -104.99 }, [{ id: 'x', lat: 40.01, lon: -105.27 }]);
    expect(r.x.method).toBe('estimate');
    expect(r.x.source.label).toMatch(/estimate/i);
    vi.unstubAllGlobals();
  });
});
