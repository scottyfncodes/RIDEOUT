/**
 * Minimal parser for the common subset of OpenStreetMap `opening_hours`.
 *
 * Supported: "24/7", "Mo-Fr 07:00-18:00; Sa,Su 08:00-17:00", "Mo off",
 * multiple ranges ("11:00-14:00,17:00-21:00"), overnight ranges ("16:00-02:00"),
 * and rules without days ("10:00-22:00" = every day).
 * Anything else (PH, month ranges, sunrise, "week" rules…) → unknown. It never guesses.
 */

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export type OpenState = 'open' | 'closed' | 'unknown';

interface Rule {
  days: Set<number>;
  ranges: Array<[number, number]>; // minutes; end may exceed 1440 for overnight
  off: boolean;
}

function parseDays(spec: string): Set<number> | null {
  const out = new Set<number>();
  for (const part of spec.split(',')) {
    const p = part.trim();
    const range = /^(Mo|Tu|We|Th|Fr|Sa|Su)-(Mo|Tu|We|Th|Fr|Sa|Su)$/.exec(p);
    if (range) {
      let i = DAYS.indexOf(range[1]);
      const end = DAYS.indexOf(range[2]);
      for (let guard = 0; guard < 8; guard++) {
        out.add(i);
        if (i === end) break;
        i = (i + 1) % 7;
      }
      continue;
    }
    if (DAYS.includes(p)) {
      out.add(DAYS.indexOf(p));
      continue;
    }
    return null;
  }
  return out;
}

function parseTimes(spec: string): Array<[number, number]> | null {
  const out: Array<[number, number]> = [];
  for (const part of spec.split(',')) {
    const m = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})\+?$/.exec(part.trim());
    if (!m) return null;
    const start = Number(m[1]) * 60 + Number(m[2]);
    let end = Number(m[3]) * 60 + Number(m[4]);
    if (start > 1440 || end > 1440 * 2) return null;
    if (end <= start) end += 1440; // overnight
    out.push([start, end]);
  }
  return out;
}

export function parseOpeningHours(raw: string | undefined | null): Rule[] | null {
  if (!raw) return null;
  const s = raw.trim();
  if (s === '24/7') return [{ days: new Set([0, 1, 2, 3, 4, 5, 6]), ranges: [[0, 1440]], off: false }];
  const rules: Rule[] = [];
  for (const chunk of s.split(';')) {
    const c = chunk.trim();
    if (!c) continue;
    if (/^PH\b/.test(c)) continue; // public-holiday rules: ignore, don't guess
    const m = /^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?,?\s*)+)?\s*(.*)$/.exec(c);
    if (!m) return null;
    const daySpec = m[1]?.replace(/\s+/g, '').replace(/,$/, '');
    const rest = (m[2] ?? '').trim();
    const days = daySpec ? parseDays(daySpec) : new Set([0, 1, 2, 3, 4, 5, 6]);
    if (!days) return null;
    if (rest === 'off' || rest === 'closed') {
      rules.push({ days, ranges: [], off: true });
      continue;
    }
    const ranges = parseTimes(rest.replace(/\s+/g, ''));
    if (!ranges) return null;
    rules.push({ days, ranges, off: false });
  }
  return rules.length ? rules : null;
}

/** Is the place open at `minutes` after midnight on weekday `day` (0=Sun)? */
export function openStateAt(raw: string | undefined | null, day: number, minutes: number): OpenState {
  const rules = parseOpeningHours(raw);
  if (!rules) return 'unknown';
  // Later rules override earlier ones for the same day (OSM semantics).
  const effective = new Map<number, Rule>();
  for (const r of rules) for (const d of r.days) effective.set(d, r);

  const today = effective.get(day);
  if (today && !today.off && today.ranges.some(([a, b]) => minutes >= a && minutes < b)) return 'open';
  // Overnight spill from the previous day.
  const prev = effective.get((day + 6) % 7);
  if (prev && !prev.off && prev.ranges.some(([, b]) => b > 1440 && minutes < b - 1440)) return 'open';
  return 'closed';
}

/** Human summary of the hours for a given weekday, e.g. "11:00 AM–10:00 PM". */
export function hoursForDay(raw: string | undefined | null, day: number): string | null {
  const rules = parseOpeningHours(raw);
  if (!rules) return null;
  const effective = new Map<number, Rule>();
  for (const r of rules) for (const d of r.days) effective.set(d, r);
  const r = effective.get(day);
  if (!r || r.off) return 'Closed';
  const fmt = (m: number) => {
    const mm = m % 1440;
    const h = Math.floor(mm / 60);
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(mm % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  };
  if (r.ranges.length === 1 && r.ranges[0][0] === 0 && r.ranges[0][1] === 1440) return 'Open 24 hours';
  return r.ranges.map(([a, b]) => `${fmt(a)}–${fmt(b)}`).join(', ');
}
