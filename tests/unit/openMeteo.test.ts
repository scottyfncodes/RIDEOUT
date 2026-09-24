import { buildForecastUrl, fetchForecasts, parseForecast } from '../../src/services/weather/openMeteo';
import { buildPayload } from '../fixtures/openMeteo';

const today = '2026-09-23';

describe('parseForecast', () => {
  it('parses a valid payload into local-time hours and days', () => {
    const f = parseForecast(buildPayload({ today, elevationM: 2134 }));
    expect(f.hourly).toHaveLength(13 * 24);
    expect(f.hourly[0]).toMatchObject({ date: '2026-09-20', minutes: 0 });
    expect(f.daily.find((d) => d.date === today)).toMatchObject({ sunriseMin: 6 * 60 + 52, sunsetMin: 18 * 60 + 58 });
    expect(f.modelElevationFt).toBe(7001);
  });
  it('converts snow depth using the reported unit', () => {
    const p = buildPayload({ today, days: { 0: { hours: { 9: { snowDepthM: 0.1 } } } } });
    const f = parseForecast(p);
    const hr = f.hourly.find((x) => x.time === `${today}T09:00`)!;
    expect(hr.snowDepthIn).toBeCloseTo(3.94, 1);
    (p as { hourly_units: Record<string, string> }).hourly_units.snow_depth = 'furlongs';
    expect(parseForecast(p).hourly.find((x) => x.time === `${today}T09:00`)!.snowDepthIn).toBeNull();
  });
  it('nulls physically impossible values instead of reasoning from them', () => {
    const p = buildPayload({ today });
    p.hourly.temperature_2m[10] = 999;
    p.hourly.precipitation_probability[11] = -5;
    (p.hourly.weather_code as unknown[])[12] = 'storm';
    const f = parseForecast(p);
    expect(f.hourly[10].tempF).toBeNull();
    expect(f.hourly[11].precipProb).toBeNull();
    expect(f.hourly[12].weatherCode).toBeNull();
  });
  it('throws on structurally invalid payloads', () => {
    expect(() => parseForecast(null)).toThrow();
    expect(() => parseForecast({ hourly: { time: [] }, daily: {} })).toThrow();
    expect(() => parseForecast('nope')).toThrow();
  });
  it('builds one multi-location URL with no API key', () => {
    const url = buildForecastUrl([{ lat: 39.1, lon: -105 }, { lat: 40, lon: -105.3 }], 'America/Denver');
    expect(url).toContain('latitude=39.1000%2C40.0000');
    expect(url).toContain('past_days=3');
    expect(url).not.toMatch(/key|apikey|token/i);
  });
});

describe('fetchForecasts', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());
  const pts = [{ id: 'a', lat: 39.5, lon: -105 }, { id: 'b', lat: 40, lon: -105.3 }];

  it('reports each area as unavailable when the API fails (no fabricated fallback)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const res = await fetchForecasts(pts, 'America/Denver');
    expect(res.a.ok).toBe(false);
    expect(res.b.ok).toBe(false);
  });
  it('isolates a bad location inside an otherwise valid response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [buildPayload({ today }), { error: true }] }));
    const res = await fetchForecasts(pts, 'America/Denver');
    expect(res.a.ok).toBe(true);
    expect(res.b.ok).toBe(false);
  });
  it('handles HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }));
    const res = await fetchForecasts(pts, 'America/Denver');
    expect(res.a.ok).toBe(false);
    if (!res.a.ok) expect(res.a.error).toContain('503');
  });
  it('serves a recent cached copy marked fromCache when offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [buildPayload({ today }), buildPayload({ today })] }));
    await fetchForecasts(pts, 'America/Denver');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const res = await fetchForecasts(pts, 'America/Denver');
    expect(res.a.ok && res.a.fromCache).toBe(true);
  });
});
