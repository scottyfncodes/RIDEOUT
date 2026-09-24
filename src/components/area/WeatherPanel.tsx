import type { AreaForecast, Fetched } from '../../services/types';
import { describeWeatherCode } from '../../services/weather/openMeteo';
import { isThunder } from '../../engine/weather';
import { fmtFt, fmtIn, fmtMph, fmtPct, fmtTemp } from '../../utils/format';
import { formatClock } from '../../utils/time';
import { Section, SourceLine } from '../ui';

export function WeatherPanel({ fx, date, isToday, window }: { fx: Fetched<AreaForecast> | undefined; date: string; isToday: boolean; window: { start: number; end: number } | null }) {
  if (!fx || !fx.ok) {
    return (
      <Section title="Weather" id="weather">
        <div className="notice bad" data-testid="weather-unavailable">
          Weather unavailable{fx && !fx.ok ? `: ${fx.error}` : ''}.
        </div>
      </Section>
    );
  }
  const f = fx.data;
  const day = f.daily.find((d) => d.date === date);
  const hours = f.hourly.filter((h) => h.date === date);
  const inWin = window ? hours.filter((h) => h.minutes + 60 > window.start && h.minutes < window.end) : hours;
  const maxGust = max(inWin.map((h) => h.gustMph));
  const maxWind = max(inWin.map((h) => h.windMph));
  const maxPP = max(inWin.map((h) => h.precipProb));
  const amt = inWin.reduce((a, h) => a + (h.precipIn ?? 0), 0);
  const thunderHour = hours.find((h) => isThunder(h.weatherCode));
  const afternoonPP = max(hours.filter((h) => h.minutes >= 12 * 60 && h.minutes < 18 * 60).map((h) => h.precipProb));
  const storm = thunderHour ? `Thunderstorms forecast from ~${formatClock(thunderHour.minutes)}` : afternoonPP != null && afternoonPP >= 40 ? `Afternoon storm risk ${afternoonPP}%` : afternoonPP != null ? 'Low' : null;
  const c = isToday ? f.current : null;

  return (
    <Section title="Weather" id="weather">
      <p className="dim" style={{ marginTop: -4 }}>
        Forecast for the trailhead grid point{f.modelElevationFt ? ` at ~${fmtFt(f.modelElevationFt)} (model elevation)` : ''}.
        {fx.fromCache ? ` Cached ${new Date(fx.fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.` : ''}
      </p>
      {c && (
        <div className="row" style={{ gap: 18, marginBottom: 12 }}>
          <div className="stat">
            <b>{fmtTemp(c.tempF)}</b>
            <span>Now</span>
          </div>
          <div className="stat">
            <b>{fmtTemp(c.feelsF)}</b>
            <span>Feels like</span>
          </div>
          <div className="stat">
            <b style={{ fontSize: 18 }}>{describeWeatherCode(c.weatherCode)}</b>
            <span>Sky</span>
          </div>
        </div>
      )}
      <div className="grid3" data-testid="weather-grid">
        <div className="stat">
          <b>{fmtTemp(day?.highF)}</b>
          <span>High</span>
        </div>
        <div className="stat">
          <b>{fmtTemp(day?.lowF)}</b>
          <span>Low</span>
        </div>
        <div className="stat">
          <b>{fmtPct(day?.precipProbMax)}</b>
          <span>Precip (day)</span>
        </div>
        <div className="stat">
          <b>{fmtMph(maxWind)}</b>
          <span>Wind{window ? ' (ride)' : ''}</span>
        </div>
        <div className="stat">
          <b>{fmtMph(maxGust)}</b>
          <span>Gusts{window ? ' (ride)' : ''}</span>
        </div>
        <div className="stat">
          <b>{fmtIn(window ? amt : day?.precipSumIn)}</b>
          <span>Precip amt{window ? ' (ride)' : ''}</span>
        </div>
        <div className="stat">
          <b>{fmtPct(maxPP)}</b>
          <span>Precip % (ride)</span>
        </div>
        <div className="stat">
          <b>{day?.sunriseMin != null ? formatClock(day.sunriseMin) : '—'}</b>
          <span>Sunrise</span>
        </div>
        <div className="stat">
          <b>{day?.sunsetMin != null ? formatClock(day.sunsetMin) : '—'}</b>
          <span>Sunset</span>
        </div>
      </div>
      <p style={{ marginTop: 12 }}>
        <b>Storm risk:</b> {storm ?? <span className="nodata">Not enough data</span>}
      </p>
      <SourceLine source={fx.source} />
    </Section>
  );
}

function max(xs: Array<number | null>): number | null {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? Math.max(...v) : null;
}
