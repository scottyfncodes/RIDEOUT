/**
 * Synthetic Open-Meteo payload builder for tests. Produces the same shape as
 * https://api.open-meteo.com/v1/forecast with past_days=3, forecast_days=10.
 */

export interface DayOpts {
  high?: number;
  low?: number;
  /** Daily precip sum (inches). */
  precip?: number;
  snowfall?: number;
  /** Hourly overrides by hour-of-day. */
  hours?: Record<number, Partial<{ temp: number; pp: number; amt: number; code: number; gust: number; wind: number; snowDepthM: number }>>;
  sunrise?: string; // "06:52"
  sunset?: string; // "18:58"
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function buildPayload(opts: { today: string; days?: Record<number, DayOpts>; elevationM?: number; lat?: number; lon?: number }) {
  const start = addDays(opts.today, -3);
  const hourly = {
    time: [] as string[],
    temperature_2m: [] as Array<number | null>,
    apparent_temperature: [] as Array<number | null>,
    precipitation_probability: [] as Array<number | null>,
    precipitation: [] as Array<number | null>,
    weather_code: [] as Array<number | null>,
    wind_speed_10m: [] as Array<number | null>,
    wind_gusts_10m: [] as Array<number | null>,
    snow_depth: [] as Array<number | null>,
  };
  const daily = {
    time: [] as string[],
    temperature_2m_max: [] as number[],
    temperature_2m_min: [] as number[],
    precipitation_sum: [] as number[],
    precipitation_probability_max: [] as number[],
    snowfall_sum: [] as number[],
    sunrise: [] as string[],
    sunset: [] as string[],
  };
  for (let d = 0; d < 13; d++) {
    const date = addDays(start, d);
    const rel = d - 3; // 0 = today
    const o: DayOpts = opts.days?.[rel] ?? {};
    const high = o.high ?? 72;
    const low = o.low ?? 48;
    let maxPP = 0;
    for (let h = 0; h < 24; h++) {
      // simple diurnal curve: low at 6am, high at 3pm
      const frac = h < 6 ? 0 : h <= 15 ? (h - 6) / 9 : Math.max(0, 1 - (h - 15) / 12);
      const base = low + (high - low) * frac;
      const ov = o.hours?.[h] ?? {};
      const pp = ov.pp ?? 5;
      maxPP = Math.max(maxPP, pp);
      hourly.time.push(`${date}T${String(h).padStart(2, '0')}:00`);
      hourly.temperature_2m.push(ov.temp ?? Math.round(base * 10) / 10);
      hourly.apparent_temperature.push((ov.temp ?? base) - 2);
      hourly.precipitation_probability.push(pp);
      hourly.precipitation.push(ov.amt ?? 0);
      hourly.weather_code.push(ov.code ?? 1);
      hourly.wind_speed_10m.push(ov.wind ?? 8);
      hourly.wind_gusts_10m.push(ov.gust ?? 14);
      hourly.snow_depth.push(ov.snowDepthM ?? 0);
    }
    daily.time.push(date);
    daily.temperature_2m_max.push(high);
    daily.temperature_2m_min.push(low);
    daily.precipitation_sum.push(o.precip ?? 0);
    daily.precipitation_probability_max.push(maxPP);
    daily.snowfall_sum.push(o.snowfall ?? 0);
    daily.sunrise.push(`${date}T${o.sunrise ?? '06:52'}`);
    daily.sunset.push(`${date}T${o.sunset ?? '18:58'}`);
  }
  return {
    latitude: opts.lat ?? 39.7,
    longitude: opts.lon ?? -105.2,
    elevation: opts.elevationM ?? 1900,
    timezone: 'America/Denver',
    hourly_units: { snow_depth: 'm' },
    hourly,
    daily,
    current: { time: `${opts.today}T10:00`, temperature_2m: 65, apparent_temperature: 63, wind_speed_10m: 7, wind_gusts_10m: 12, weather_code: 1 },
  };
}

/** A clear, dry day with afternoon storms building from 1 PM. */
export const stormyAfternoon: DayOpts = {
  high: 78,
  low: 50,
  hours: { 13: { pp: 45, code: 80 }, 14: { pp: 65, code: 95, amt: 0.08 }, 15: { pp: 70, code: 95, amt: 0.12 }, 16: { pp: 55, code: 80 } },
};
