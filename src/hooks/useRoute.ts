import { useEffect, useState } from 'react';

export type Route = { name: 'home' } | { name: 'map' } | { name: 'area'; id: string } | { name: 'settings' } | { name: 'sources' };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  const [first, second] = h.split('/');
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
  settings: '#/settings',
  sources: '#/sources',
};
