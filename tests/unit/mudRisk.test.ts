import { assessMudRisk } from '../../src/engine/mudRisk';
import { parseForecast } from '../../src/services/weather/openMeteo';
import { buildPayload } from '../fixtures/openMeteo';

const today = '2026-09-23';
const fx = (days = {}) => parseForecast(buildPayload({ today, days }));

describe('assessMudRisk', () => {
  it('is low after dry days', () => {
    expect(assessMudRisk({ date: today, forecast: fx(), drainage: 'moderate' }).level).toBe('low');
  });
  it('rises with rain yesterday', () => {
    const m = assessMudRisk({ date: today, forecast: fx({ [-1]: { precip: 0.35, high: 60 } }), drainage: 'moderate' });
    expect(['elevated', 'high']).toContain(m.level);
    expect(m.explanation).toMatch(/yesterday/);
  });
  it('treats clay (slow drainage) as riskier than granite (fast)', () => {
    const f = fx({ [-1]: { precip: 0.15, high: 65 } });
    const slow = assessMudRisk({ date: today, forecast: f, drainage: 'slow' });
    const fast = assessMudRisk({ date: today, forecast: f, drainage: 'fast' });
    expect(slow.index!).toBeGreaterThan(fast.index!);
  });
  it('weights older rain less than recent rain', () => {
    const recent = assessMudRisk({ date: today, forecast: fx({ [-1]: { precip: 0.3 } }), drainage: 'moderate' });
    const older = assessMudRisk({ date: today, forecast: fx({ [-3]: { precip: 0.3 } }), drainage: 'moderate' });
    expect(recent.index!).toBeGreaterThan(older.index!);
  });
  it('counts rain forecast before the ride start', () => {
    const f = fx({ 0: { hours: { 5: { amt: 0.15, pp: 90 }, 6: { amt: 0.1, pp: 90 } } } });
    const m = assessMudRisk({ date: today, forecast: f, drainage: 'moderate', rideStartMin: 9 * 60 });
    expect(m.level).not.toBe('low');
  });
  it('goes high with snow on the ground', () => {
    const f = fx({ 0: { hours: { 10: { snowDepthM: 0.08 } } } });
    const m = assessMudRisk({ date: today, forecast: f, drainage: 'fast' });
    expect(m.level).toBe('high');
    expect(m.explanation).toMatch(/snow/i);
  });
  it('bumps risk for freeze/thaw with some moisture', () => {
    const base = assessMudRisk({ date: today, forecast: fx({ [-1]: { precip: 0.05 }, 0: { low: 45, high: 60 } }), drainage: 'moderate' });
    const ft = assessMudRisk({ date: today, forecast: fx({ [-1]: { precip: 0.05 }, 0: { low: 25, high: 50 } }), drainage: 'moderate' });
    const order = ['low', 'moderate', 'elevated', 'high'];
    expect(order.indexOf(ft.level)).toBeGreaterThan(order.indexOf(base.level));
  });
  it('is unknown when past precipitation is missing', () => {
    const p = buildPayload({ today });
    (p.daily.precipitation_sum as unknown[])[2] = null;
    expect(assessMudRisk({ date: today, forecast: parseForecast(p), drainage: 'fast' }).level).toBe('unknown');
  });
  it('is unknown for a date too early in the dataset to look back', () => {
    expect(assessMudRisk({ date: '2026-09-20', forecast: fx(), drainage: 'fast' }).level).toBe('unknown');
  });
  it('always says it is not a trail report for elevated/high', () => {
    const m = assessMudRisk({ date: today, forecast: fx({ [-1]: { precip: 1 } }), drainage: 'slow' });
    expect(m.level).toBe('high');
    expect(m.explanation).toMatch(/probably wet/);
  });
});
