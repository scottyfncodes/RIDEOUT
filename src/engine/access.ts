import type { AccessRule, RidingArea } from '../content/types';
import { dayOfMonth, weekday, weekdayName } from '../utils/time';

export interface AccessResult {
  /** False when the area is closed to bikes on this date (hard gate). */
  open: boolean;
  closedReason: string | null;
  /** Date-specific notes (e.g. odd/even designated use) — shown prominently. */
  notes: string[];
  /** Soft penalty 0..1 for partial restrictions on this date. */
  penalty: number;
  rules: AccessRule[];
}

function inSeason(date: string, from: [number, number], to: [number, number]): boolean {
  const [, m, d] = date.split('-').map(Number);
  const v = m * 100 + d;
  const a = from[0] * 100 + from[1];
  const b = to[0] * 100 + to[1];
  return a <= b ? v >= a && v <= b : v >= a || v <= b; // wraps the new year
}

export function evaluateAccess(area: RidingArea, date: string): AccessResult {
  const res: AccessResult = { open: true, closedReason: null, notes: [], penalty: 0, rules: area.access };
  for (const rule of area.access) {
    switch (rule.kind) {
      case 'closedWeekdays':
        if (rule.days.includes(weekday(date))) {
          res.open = false;
          res.closedReason = `Closed to bikes on ${weekdayName(date)}s. ${rule.summary}`;
        }
        break;
      case 'seasonal':
        if (inSeason(date, rule.from, rule.to)) {
          res.open = false;
          res.closedReason = `Seasonal closure. ${rule.summary}`;
        }
        break;
      case 'oddEvenDates': {
        const even = dayOfMonth(date) % 2 === 0;
        const bikesToday = (rule.bikesOn === 'even') === even;
        if (bikesToday) {
          res.notes.push(`${even ? 'Even' : 'Odd'} date: the designated-use trails are bikes-only today.`);
        } else {
          res.notes.push(`${even ? 'Even' : 'Odd'} date: the designated-use trails are closed to bikes today. Other trails stay open.`);
          res.penalty = Math.max(res.penalty, 0.35);
        }
        break;
      }
      case 'advisory':
        break;
    }
  }
  return res;
}
