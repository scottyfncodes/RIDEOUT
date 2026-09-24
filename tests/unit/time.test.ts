import { addDays, formatClock, formatDateLabel, formatDuration, nextWeekday, nowInZone, weekday } from '../../src/utils/time';

describe('time utils', () => {
  it('computes local date/time in Denver across the UTC date line', () => {
    // 2026-09-24T03:30Z is 21:30 on Sep 23 in Denver (MDT, UTC-6)
    expect(nowInZone('America/Denver', new Date('2026-09-24T03:30:00Z'))).toEqual({ date: '2026-09-23', minutes: 21 * 60 + 30 });
  });
  it('handles DST transitions (MST in winter)', () => {
    expect(nowInZone('America/Denver', new Date('2026-12-01T15:00:00Z')).minutes).toBe(8 * 60);
  });
  it('adds days across months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('finds the upcoming weekend', () => {
    expect(weekday('2026-09-23')).toBe(3);
    expect(nextWeekday('2026-09-23', 6)).toBe('2026-09-26');
    expect(nextWeekday('2026-09-26', 6)).toBe('2026-09-26');
    expect(nextWeekday('2026-09-23', 0)).toBe('2026-09-27');
  });
  it('formats clocks and durations', () => {
    expect(formatClock(8 * 60 + 15)).toBe('8:15 AM');
    expect(formatClock(12 * 60)).toBe('12:00 PM');
    expect(formatClock(0)).toBe('12:00 AM');
    expect(formatClock(24 * 60 + 30)).toBe('12:30 AM (+1d)');
    expect(formatDuration(155)).toBe('2h 35m');
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(120)).toBe('2h');
  });
  it('labels dates relative to today', () => {
    expect(formatDateLabel('2026-09-23', '2026-09-23')).toBe('Today');
    expect(formatDateLabel('2026-09-24', '2026-09-23')).toBe('Tomorrow');
    expect(formatDateLabel('2026-09-26', '2026-09-23')).toBe('Saturday, Sep 26');
  });
});
