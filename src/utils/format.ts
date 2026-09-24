export function fmtMi(mi: number | null | undefined, digits = 1): string {
  return mi == null ? '—' : `${mi.toFixed(digits).replace(/\.0$/, '')} mi`;
}

export function fmtFt(ft: number | null | undefined): string {
  return ft == null ? '—' : `${Math.round(ft).toLocaleString('en-US')}′`;
}

export function fmtTemp(f: number | null | undefined): string {
  return f == null ? '—' : `${Math.round(f)}°`;
}

export function fmtPct(p: number | null | undefined): string {
  return p == null ? '—' : `${Math.round(p)}%`;
}

export function fmtIn(inches: number | null | undefined): string {
  if (inches == null) return '—';
  if (inches > 0 && inches < 0.01) return '<0.01″';
  return `${inches.toFixed(2)}″`;
}

export function fmtMph(v: number | null | undefined): string {
  return v == null ? '—' : `${Math.round(v)} mph`;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
