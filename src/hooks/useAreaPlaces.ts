import { useEffect, useState } from 'react';
import type { RidingArea } from '../content/types';
import { fetchAreaPlaces } from '../services/places/overpass';
import type { Fetched, Place } from '../services/types';

export function useAreaPlaces(area: RidingArea | undefined): Fetched<Place[]> | null {
  const [res, setRes] = useState<Fetched<Place[]> | null>(null);
  useEffect(() => {
    if (!area) return;
    let live = true;
    setRes(null);
    fetchAreaPlaces(area.id, area.trailhead, area.apresHub).then((r) => live && setRes(r));
    return () => {
      live = false;
    };
  }, [area]);
  return res;
}
