import type { Recommendation } from '../../engine/recommend';
import { fmtMi } from '../../utils/format';
import { formatClock, formatDuration } from '../../utils/time';
import { ExtLink, Section, SourceLine } from '../ui';

export function mapsLinks(name: string, lat: number, lon: number) {
  const q = encodeURIComponent(`${name}, Colorado`);
  return {
    apple: `https://maps.apple.com/?daddr=${q}&ll=${lat},${lon}`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
  };
}

export function GettingThere({ r, homeLabel }: { r: Recommendation; homeLabel: string }) {
  const it = r.itinerary;
  const links = mapsLinks(r.area.trailhead.name, r.area.trailhead.lat, r.area.trailhead.lon);
  return (
    <Section title="Getting there" id="drive">
      <p className="muted">
        {homeLabel} → {r.area.trailhead.name}
      </p>
      {r.drive ? (
        <div className="grid2" style={{ margin: '10px 0' }}>
          <div className="stat">
            <b>{formatDuration(r.drive.minutes)}</b>
            <span>Drive {r.drive.method === 'estimate' ? '(rough est.)' : ''}</span>
          </div>
          <div className="stat">
            <b>{fmtMi(r.drive.miles)}</b>
            <span>Distance</span>
          </div>
        </div>
      ) : (
        <p className="nodata">Drive time unavailable</p>
      )}
      {it ? (
        <>
          <ol className="timeline" data-testid="itinerary">
            {it.steps.map((s) => (
              <li key={s.kind} className={s.kind === 'ride-start' || s.kind === 'leave' || s.kind === 'apres' ? 'key' : ''}>
                <time>{formatClock(s.at)}</time>
                <span>
                  {s.kind === 'ride-start' ? `Ride ${formatClock(it.rideStart)}–${formatClock(it.rideEnd)}` : s.label}
                  {s.kind === 'apres' ? ' 🍺' : ''}
                  {s.detail ? <span className="dim"> · {s.detail}</span> : null}
                </span>
              </li>
            ))}
          </ol>
          <p className="dim">
            Total outing: <b>{formatDuration(it.totalMin)}</b>. Ride time is a RIDEOUT estimate
            {r.rideMinutesEstimated ? ' (route length unknown, so a typical duration is used)' : ' from distance and climbing'}.
            {it.apres ? ' The drive home from apres reuses the trailhead drive time.' : ''}
          </p>
          {it.warnings.map((w) => (
            <div key={w} className="notice">
              {w}
            </div>
          ))}
        </>
      ) : (
        <p className="nodata">No plan. There is no usable ride window on this date.</p>
      )}
      <div className="btn-row" style={{ marginTop: 10 }}>
        <ExtLink href={links.apple}>Apple Maps ↗</ExtLink>
        <ExtLink href={links.google}>Google Maps ↗</ExtLink>
      </div>
      {r.area.trailhead.approximate && <p className="dim">Trailhead pin is approximate. Maps navigates by trailhead name.</p>}
      {r.drive && <SourceLine source={r.drive.source} />}
    </Section>
  );
}
