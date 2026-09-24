import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadPrefs, savePrefs, type Preferences } from '../engine/prefs';
import type { SearchParams } from '../engine/modes';
import { DEFAULT_REGION, HOME_PRESETS } from '../data/regions';
import { nowInZone } from '../utils/time';

interface Store {
  prefs: Preferences;
  setPrefs: (p: Preferences) => void;
  params: SearchParams;
  setParams: (p: Partial<SearchParams>) => void;
  today: string;
  home: { lat: number; lon: number; label: string; isDefault: boolean };
  /** Has the user pressed FIND MY RIDE this session? */
  searched: boolean;
  setSearched: (v: boolean) => void;
}

const Ctx = createContext<Store | null>(null);
const PARAMS_KEY = 'rideout:params:v1';

function initialParams(today: string, prefs: Preferences): SearchParams {
  const base: SearchParams = { date: today, mode: 'half', vibe: 'any', difficulty: prefs.preferredDifficulty, maxDrive: prefs.maxDrive, quickBudget: 180 };
  try {
    const raw = sessionStorage.getItem(PARAMS_KEY);
    if (raw) {
      const p = { ...base, ...(JSON.parse(raw) as Partial<SearchParams>) };
      if (p.date < today) p.date = today; // a stale date from yesterday's session
      return p;
    }
  } catch {
    /* ignore */
  }
  return base;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const today = nowInZone(DEFAULT_REGION.timezone).date;
  const [prefs, setPrefsState] = useState<Preferences>(() => loadPrefs());
  const [params, setParamsState] = useState<SearchParams>(() => initialParams(today, prefs));
  const [searched, setSearched] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('rideout:searched') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(PARAMS_KEY, JSON.stringify(params));
      sessionStorage.setItem('rideout:searched', searched ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [params, searched]);

  const setPrefs = useCallback((p: Preferences) => {
    setPrefsState(p);
    savePrefs(p);
  }, []);
  const setParams = useCallback((p: Partial<SearchParams>) => setParamsState((prev) => ({ ...prev, ...p })), []);

  const home = useMemo(() => {
    if (prefs.home) return { ...prefs.home, isDefault: false };
    const d = HOME_PRESETS[0];
    return { lat: d.lat, lon: d.lon, label: d.name, isDefault: true };
  }, [prefs.home]);

  const value = useMemo(() => ({ prefs, setPrefs, params, setParams, today, home, searched, setSearched }), [prefs, setPrefs, params, setParams, today, home, searched]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
