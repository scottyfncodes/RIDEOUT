import type { Source } from '../content/types';

/** Result wrapper for every external data call. Adapters never throw into the UI. */
export type Fetched<T> =
  | { ok: true; data: T; source: Source; fetchedAt: string; fromCache: boolean }
  | { ok: false; error: string; source: Source };

export interface HourlyPoint {
  time: string; // local wall clock, "2026-09-23T08:00"
  date: string;
  minutes: number; // minutes after local midnight
  tempF: number | null;
  feelsF: number | null;
  precipProb: number | null;
  precipIn: number | null;
  weatherCode: number | null;
  windMph: number | null;
  gustMph: number | null;
  snowDepthIn: number | null;
}

export interface DailyPoint {
  date: string;
  highF: number | null;
  lowF: number | null;
  precipSumIn: number | null;
  precipProbMax: number | null;
  snowfallIn: number | null;
  sunriseMin: number | null;
  sunsetMin: number | null;
}

export interface CurrentConditions {
  time: string;
  tempF: number | null;
  feelsF: number | null;
  windMph: number | null;
  gustMph: number | null;
  weatherCode: number | null;
}

export interface AreaForecast {
  lat: number;
  lon: number;
  /** Elevation of the forecast grid point (ft), as reported by the model. */
  modelElevationFt: number | null;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  current: CurrentConditions | null;
}

export interface DriveInfo {
  minutes: number;
  miles: number;
  method: 'routed' | 'estimate';
  source: Source;
}

export type PlaceCategory = 'bike' | 'brewery' | 'food' | 'mexican' | 'pizza' | 'coffee' | 'dessert' | 'parking';

export interface Place {
  id: string; // "node/123"
  name: string;
  lat: number;
  lon: number;
  categories: PlaceCategory[];
  tags: Record<string, string>;
}
