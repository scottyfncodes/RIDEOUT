import { findRideWindow } from '../../src/engine/rideWindow';
import { parseForecast } from '../../src/services/weather/openMeteo';
import { buildPayload, stormyAfternoon } from '../fixtures/openMeteo';

const today = '2026-09-23';
const fx = (days = {}) => parseForecast(buildPayload({ today, days }));

describe('findRideWindow', () => {
  it('finds a morning window before afternoon storms', () => {
    const f = fx({ 0: stormyAfternoon });
    const r = findRideWindow({ date: today, hourly: f.hourly, daily: f.daily, durationMin: 180 });
    expect(r.reason).toBe('ok');
    expect(r.window!.end).toBeLessThanOrEqual(13 * 60 + 15);
    expect(r.window!.level === 'great' || r.window!.level === 'good').toBe(true);
  });
  it('never starts before sunrise + margin or ends after sunset', () => {
    const f = fx({ 0: { sunrise: '07:10', sunset: '17:05' } });
    const r = findRideWindow({ date: today, hourly: f.hourly, daily: f.daily, durationMin: 120 });
    expect(r.window!.start).toBeGreaterThanOrEqual(7 * 60 + 25);
    expect(r.window!.end).toBeLessThanOrEqual(17 * 60 - 10);
  });
  it('respects the earliest start (today, after driving)', () => {
    const f = fx();
    const r = findRideWindow({ date: today, hourly: f.hourly, daily: f.daily, durationMin: 90, earliestStartMin: 14 * 60 + 7 });
    expect(r.window!.start).toBeGreaterThanOrEqual(14 * 60 + 15);
  });
  it('reports too-late when no daylight remains', () => {
    const f = fx();
    const r = findRideWindow({ date: today, hourly: f.hourly, daily: f.daily, durationMin: 90, earliestStartMin: 18 * 60 + 30 });
    expect(r.reason).toBe('too-late');
    expect(r.window).toBeNull();
  });
  it('clips a very long ride on a short day and flags it', () => {
    const f = fx({ 0: { sunrise: '07:20', sunset: '16:40' } });
    const r = findRideWindow({ date: today, hourly: f.hourly, daily: f.daily, durationMin: 11 * 60 });
    expect(r.window!.clipped).toBe(true);
  });
  it('handles missing sunrise/sunset as no-data rather than guessing daylight', () => {
    const p = buildPayload({ today });
    (p.daily.sunrise as unknown[])[3] = null;
    const f = parseForecast(p);
    const r = findRideWindow({ date: today, hourly: f.hourly, daily: f.daily, durationMin: 90 });
    expect(r.reason).toBe('no-data');
  });
  it('returns no-data for a date outside the forecast', () => {
    const f = fx();
    expect(findRideWindow({ date: '2027-01-01', hourly: f.hourly, daily: f.daily, durationMin: 90 }).reason).toBe('no-data');
  });
  it('picks a poor window on an all-day storm but labels it poor', () => {
    const hours: Record<number, { pp: number; code: number; amt: number }> = {};
    for (let i = 0; i < 24; i++) hours[i] = { pp: 90, code: 95, amt: 0.2 };
    const f = fx({ 0: { hours } });
    const r = findRideWindow({ date: today, hourly: f.hourly, daily: f.daily, durationMin: 120 });
    expect(r.window!.level).toBe('bad');
  });
  it('reports a good-conditions span wider than the ride when the day is nice', () => {
    const f = fx();
    const r = findRideWindow({ date: today, hourly: f.hourly, daily: f.daily, durationMin: 60 });
    expect(r.window!.goodSpan!.end - r.window!.goodSpan!.start).toBeGreaterThan(60);
  });
});
