/**
 * Time helpers. All schedule math is done in "minutes after local midnight" on the
 * selected ride date, in the region's timezone (America/Denver for Colorado).
 * Forecast timestamps from Open-Meteo arrive as local wall-clock strings
 * ("2026-09-23T08:00") because we request `timezone=America/Denver`.
 */

export type ISODate = string; // YYYY-MM-DD

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local date + minute-of-day for `now` in a timezone. */
export function nowInZone(tz: string, now: Date = new Date()): { date: ISODate; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const hour = get('hour') % 24;
  return { date: `${get('year')}-${pad(get('month'))}-${pad(get('day'))}`, minutes: hour * 60 + get('minute') };
}

export function addDays(date: ISODate, days: number): ISODate {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(date: ISODate): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function dayOfMonth(date: ISODate): number {
  return Number(date.split('-')[2]);
}

export function daysBetween(a: ISODate, b: ISODate): number {
  const toUtc = (s: ISODate) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** Next Saturday/Sunday on or after `from` (Sat=6, Sun=0). */
export function nextWeekday(from: ISODate, target: number): ISODate {
  const diff = (target - weekday(from) + 7) % 7;
  return addDays(from, diff);
}

/** "2026-09-23T08:15" → minutes after midnight (ignores the date part). */
export function localTimeToMinutes(ts: string): number | null {
  const m = /T(\d{2}):(\d{2})/.exec(ts);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function formatClock(minutes: number): string {
  const dayOffset = Math.floor(minutes / 1440);
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const suffix = dayOffset > 0 ? ' (+1d)' : dayOffset < 0 ? ' (−1d)' : '';
  return `${h12}:${pad(mm)} ${ampm}${suffix}`;
}

export function formatHourShort(minutes: number): string {
  const h24 = Math.floor((((minutes % 1440) + 1440) % 1440) / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}${h24 < 12 ? 'a' : 'p'}`;
}

export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}m`;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDateLabel(date: ISODate, today: ISODate): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  const [, m, d] = date.split('-').map(Number);
  return `${WEEKDAYS[weekday(date)]}, ${MONTHS[m - 1]} ${d}`;
}

export function weekdayName(date: ISODate): string {
  return WEEKDAYS[weekday(date)];
}

export function roundUpTo(minutes: number, step: number): number {
  return Math.ceil(minutes / step) * step;
}
