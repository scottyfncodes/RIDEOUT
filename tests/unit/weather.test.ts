import { classifyHour } from '../../src/engine/weather';
import type { HourlyPoint } from '../../src/services/types';

const h = (o: Partial<HourlyPoint>): HourlyPoint => ({
  time: '2026-09-23T09:00', date: '2026-09-23', minutes: 540, tempF: 65, feelsF: 64, precipProb: 5, precipIn: 0, weatherCode: 1, windMph: 6, gustMph: 12, snowDepthIn: 0, ...o,
});

describe('classifyHour', () => {
  it('rates a mild dry calm hour as great', () => {
    expect(classifyHour(h({})).level).toBe('great');
  });
  it('flags thunderstorms as bad regardless of temperature', () => {
    const v = classifyHour(h({ weatherCode: 95, precipProb: 30 }));
    expect(v.level).toBe('bad');
    expect(v.reasons).toContain('Thunderstorms');
  });
  it('grades storm probability', () => {
    expect(classifyHour(h({ precipProb: 40 })).level).toBe('fair');
    expect(classifyHour(h({ precipProb: 65 })).level).toBe('poor');
    expect(classifyHour(h({ precipIn: 0.2 })).level).toBe('bad');
  });
  it('handles temperature extremes', () => {
    expect(classifyHour(h({ tempF: 20 })).level).toBe('bad');
    expect(classifyHour(h({ tempF: 33 })).level).toBe('poor');
    expect(classifyHour(h({ tempF: 101 })).level).toBe('bad');
    expect(classifyHour(h({ tempF: 90 })).level).toBe('fair');
  });
  it('penalises strong gusts', () => {
    expect(classifyHour(h({ gustMph: 55 })).level).toBe('bad');
    expect(classifyHour(h({ gustMph: 40 })).level).toBe('poor');
    expect(classifyHour(h({ gustMph: 30 })).level).toBe('fair');
  });
  it('returns unknown instead of guessing when data is missing', () => {
    expect(classifyHour(h({ tempF: null })).level).toBe('unknown');
    expect(classifyHour(h({ weatherCode: null, precipProb: null })).level).toBe('unknown');
  });
  it('takes the worst of several hazards', () => {
    expect(classifyHour(h({ tempF: 40, gustMph: 45 })).level).toBe('poor');
  });
});
