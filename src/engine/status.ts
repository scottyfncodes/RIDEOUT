export type Status = 'send' | 'worth' | 'questionable' | 'skip' | 'unknown';

export const STATUS_META: Record<Status, { emoji: string; label: string; marker: string; color: string }> = {
  send: { emoji: '🟢', label: 'SEND IT', marker: 'RIDE', color: 'var(--go)' },
  worth: { emoji: '🟡', label: 'WORTH IT', marker: 'MAYBE', color: 'var(--maybe)' },
  questionable: { emoji: '🟠', label: 'QUESTIONABLE', marker: 'CONDITIONS', color: 'var(--iffy)' },
  skip: { emoji: '🔴', label: 'SKIP IT', marker: 'NOPE', color: 'var(--nope)' },
  unknown: { emoji: '⚪', label: 'UNKNOWN', marker: 'UNKNOWN', color: 'var(--unknown)' },
};

const ORDER: Status[] = ['send', 'worth', 'questionable', 'skip'];

export function statusFromScore(score: number): Status {
  if (score >= 75) return 'send';
  if (score >= 58) return 'worth';
  if (score >= 40) return 'questionable';
  return 'skip';
}

/** Cap a status so it is no better than `ceiling`. */
export function capStatus(s: Status, ceiling: Status): Status {
  if (s === 'unknown') return s;
  return ORDER.indexOf(s) < ORDER.indexOf(ceiling) ? ceiling : s;
}

export function statusRank(s: Status): number {
  return s === 'unknown' ? 3.5 : ORDER.indexOf(s);
}
