/** Tiny localStorage cache with TTL. Every access is guarded — storage can be unavailable. */

interface Entry<T> {
  at: number;
  value: T;
}

const PREFIX = 'rideout:cache:';

export function cacheGet<T>(key: string, maxAgeMs: number): { value: T; at: number } | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const e = JSON.parse(raw) as Entry<T>;
    if (typeof e?.at !== 'number' || Date.now() - e.at > maxAgeMs) return null;
    return { value: e.value, at: e.at };
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), value } satisfies Entry<T>));
  } catch {
    /* quota or disabled storage: caching is best-effort */
  }
}

export function cacheClear(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

export async function fetchJson(url: string, init?: RequestInit & { timeoutMs?: number }): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init?.timeoutMs ?? 15_000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}
