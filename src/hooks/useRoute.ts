import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'map' }
  | { name: 'area'; id: string }
  | { name: 'garage' }
  | { name: 'bike'; from: 'garage' | 'settings' }
  | { name: 'settings' }
  | { name: 'sources' };

export function parseHash(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const [first, second] = path.split('/');
  if (first === 'garage' && second === 'bike') return { name: 'bike', from: new URLSearchParams(query).get('from') === 'settings' ? 'settings' : 'garage' };
  if (first === 'garage') return { name: 'garage' };
  if (first === 'map') return { name: 'map' };
  if (first === 'area' && second) return { name: 'area', id: decodeURIComponent(second) };
  if (first === 'settings') return { name: 'settings' };
  if (first === 'sources') return { name: 'sources' };
  return { name: 'home' };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const href = {
  home: '#/',
  map: '#/map',
  area: (id: string) => `#/area/${encodeURIComponent(id)}`,
  garage: '#/garage',
  bike: (from: 'garage' | 'settings' = 'garage') => (from === 'settings' ? '#/garage/bike?from=settings' : '#/garage/bike'),
  settings: '#/settings',
  sources: '#/sources',
};
