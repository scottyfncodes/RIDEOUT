import { useEffect, useMemo, useState } from 'react';
import { ALL_AREAS } from '../content/areas';
import { DEFAULT_REGION } from '../data/regions';
import { recommend, type EngineInput, type EngineOutput } from '../engine/recommend';
import { fetchForecasts } from '../services/weather/openMeteo';
import { fetchDriveTimes } from '../services/routing/drive';
import { fetchRegionalBreweries } from '../services/places/overpass';
import type { AreaForecast, DriveInfo, Fetched, Place } from '../services/types';
import { useStore } from '../state/store';
import { nowInZone } from '../utils/time';

export interface RideData {
  loading: boolean;
  forecasts: Record<string, Fetched<AreaForecast>>;
  drives: Record<string, DriveInfo>;
  breweries: Fetched<Place[]> | null;
  output: EngineOutput | null;
  input: EngineInput | null;
  weatherErrors: number;
  nowMin: number | null;
}

// Front Range bbox (S, W, N, E) for the regional brewery query.
const BREWERY_BBOX: [number, number, number, number] = [39.2, -105.8, 40.7, -104.7];

let shared: { forecasts?: Promise<Record<string, Fetched<AreaForecast>>>; breweries?: Promise<Fetched<Place[]>> } = {};
export function resetSharedData() {
  shared = {};
}

export function useRideData(): RideData {
  const { params, prefs, home, today } = useStore();
  const [forecasts, setForecasts] = useState<Record<string, Fetched<AreaForecast>> | null>(null);
  const [drives, setDrives] = useState<Record<string, DriveInfo> | null>(null);
  const [breweries, setBreweries] = useState<Fetched<Place[]> | null>(null);

  useEffect(() => {
    let live = true;
    shared.forecasts ??= fetchForecasts(
      ALL_AREAS.map((a) => ({ id: a.id, lat: a.trailhead.lat, lon: a.trailhead.lon })),
      DEFAULT_REGION.timezone,
    );
    shared.forecasts.then((f) => live && setForecasts(f));
    shared.breweries ??= fetchRegionalBreweries(BREWERY_BBOX);
    shared.breweries.then((b) => live && setBreweries(b));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    setDrives(null);
    fetchDriveTimes(home, ALL_AREAS.map((a) => ({ id: a.id, lat: a.trailhead.lat, lon: a.trailhead.lon }))).then((d) => live && setDrives(d));
    return () => {
      live = false;
    };
  }, [home]);

  const nowMin = params.date === today ? nowInZone(DEFAULT_REGION.timezone).minutes : null;

  const input = useMemo<EngineInput | null>(() => {
    if (!forecasts || !drives) return null;
    return {
      areas: ALL_AREAS,
      forecasts,
      drives,
      breweries: breweries?.ok ? breweries.data : null,
      prefs,
      params,
      nowMin,
    };
    // nowMin intentionally coarse: recomputed with params/prefs changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecasts, drives, breweries, prefs, params]);

  const output = useMemo(() => (input ? recommend(input) : null), [input]);

  const weatherErrors = forecasts ? Object.values(forecasts).filter((f) => !f.ok).length : 0;
  return {
    loading: !forecasts || !drives,
    forecasts: forecasts ?? {},
    drives: drives ?? {},
    breweries,
    output,
    input,
    weatherErrors,
    nowMin,
  };
}
