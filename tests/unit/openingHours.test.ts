import { hoursForDay, openStateAt, parseOpeningHours } from '../../src/utils/openingHours';

describe('opening hours', () => {
  it('parses common weekday ranges', () => {
    const s = 'Mo-Fr 07:00-18:00; Sa,Su 08:00-17:00';
    expect(openStateAt(s, 1, 8 * 60)).toBe('open');
    expect(openStateAt(s, 1, 19 * 60)).toBe('closed');
    expect(openStateAt(s, 6, 7 * 60 + 30)).toBe('closed');
    expect(openStateAt(s, 0, 12 * 60)).toBe('open');
  });
  it('handles overnight ranges spilling into the next day', () => {
    const s = 'Fr-Sa 16:00-02:00';
    expect(openStateAt(s, 5, 23 * 60)).toBe('open');
    expect(openStateAt(s, 6, 60)).toBe('open'); // Sat 1am from Friday
    expect(openStateAt(s, 0, 60)).toBe('open'); // Sun 1am from Saturday
    expect(openStateAt(s, 1, 60)).toBe('closed');
  });
  it('supports off days, 24/7 and split ranges', () => {
    expect(openStateAt('Tu-Su 11:00-21:00; Mo off', 1, 12 * 60)).toBe('closed');
    expect(openStateAt('24/7', 3, 3 * 60)).toBe('open');
    expect(openStateAt('11:00-14:00,17:00-21:00', 2, 15 * 60)).toBe('closed');
    expect(openStateAt('11:00-14:00,17:00-21:00', 2, 18 * 60)).toBe('open');
  });
  it('returns unknown for anything it cannot parse — never guesses', () => {
    expect(openStateAt(undefined, 1, 600)).toBe('unknown');
    expect(openStateAt('sunrise-sunset', 1, 600)).toBe('unknown');
    expect(openStateAt('Jan-Mar Mo 10:00-12:00', 1, 600)).toBe('unknown');
    expect(parseOpeningHours('')).toBeNull();
  });
  it('formats hours for a day', () => {
    expect(hoursForDay('Mo-Su 11:00-22:00', 2)).toBe('11:00 AM–10:00 PM');
    expect(hoursForDay('Mo off; Tu-Su 11:00-21:00', 1)).toBe('Closed');
    expect(hoursForDay('24/7', 1)).toBe('Open 24 hours');
  });
});
