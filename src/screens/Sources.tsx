import { ALL_AREAS } from '../content/areas';
import { CHECKED } from '../content/areas/sources';
import { OPEN_METEO_SOURCE } from '../services/weather/openMeteo';
import { OSRM_SOURCE } from '../services/routing/drive';
import { OSM_SOURCE } from '../services/places/overpass';
import { SourceLine } from '../components/ui';
import { href } from '../hooks/useRoute';

export function Sources() {
  return (
    <>
      <p className="display brand">RIDEOUT</p>
      <h1 className="display" style={{ fontSize: 40, margin: '6px 0 10px' }}>
        Data sources
      </h1>
      <p className="muted">
        RIDEOUT combines public data, then shows you where each piece came from. There are no API keys, no accounts and no tracking.
      </p>

      <div className="label">Live data</div>
      <ul>
        <li>
          <b>Weather:</b> hourly and daily forecast, 3 days of past precipitation, sunrise/sunset. <SourceLine source={OPEN_METEO_SOURCE} />
        </li>
        <li>
          <b>Drive times:</b> road routing from your home. No live traffic. If routing fails, a labeled straight-line estimate is used. <SourceLine source={OSRM_SOURCE} />
        </li>
        <li>
          <b>Bike shops, apres, parking lots:</b> live OpenStreetMap data. Hours, patios and dog policy appear only when they’re tagged. <SourceLine source={OSM_SOURCE} />
        </li>
        <li>
          <b>Map tiles:</b> © OpenStreetMap contributors.
        </li>
      </ul>

      <div className="label">Your Garage</div>
      <ul className="small">
        <li><b>Bike specs, service dates, checklist ticks:</b> entered by you and stored only on this device. Checklist ticks clear each day.</li>
        <li><b>Bike Prep:</b> general prep guidance based on the ride (editorial ride character, route stats), the forecast and the mud-risk estimate. It never recommends a tire pressure. Your own pressures appear only as “your usual”.</li>
        <li><b>Trailside help:</b> general guidance, not a professional diagnosis.</li>
      </ul>

      <div className="label">What RIDEOUT calculates</div>
      <ul className="small">
        <li><b>Ride window:</b> classifies each forecast hour by temperature, precipitation, thunder and gusts, then picks the best daylight block that fits your ride.</li>
        <li><b>Mud risk:</b> an <i>estimate</i> from the last 3 days of precipitation, rain forecast before your start, soil drainage, temperature, freeze/thaw and modeled snow. It is never a trail report.</li>
        <li><b>Trail condition:</b> always shown as “Not reported” unless it has been observed. There is no reliable public feed yet.</li>
        <li><b>Status:</b> a weighted score of these components, with hard rules for closures and mud. Every profile shows the full breakdown.</li>
      </ul>

      <div className="label">Trail content (last reviewed {CHECKED})</div>
      <p className="dim">
        “Official” means from the managing agency. “Reported” means from an established trail database. “Editorial” means RIDEOUT’s own judgment. Missing numbers show as “Not enough data”.
      </p>
      {ALL_AREAS.map((a) => (
        <details key={a.id}>
          <summary>{a.name}</summary>
          <div className="small" style={{ paddingBottom: 10 }}>
            <div>Managed by {a.manager}</div>
            {a.links.official && (
              <div className="src">
                Official: <a href={a.links.official} target="_blank" rel="noopener noreferrer">{a.links.officialLabel ?? a.links.official}</a>
              </div>
            )}
            {a.rides.map((r) => (
              <SourceLine key={r.id} source={r.source} prefix={r.name} />
            ))}
            <SourceLine source={a.parking.source} prefix="Parking" />
            <SourceLine source={a.characterSource} prefix="Ride character" />
            {a.access.map((x) => (
              <SourceLine key={x.summary} source={x.source} prefix="Access rule" />
            ))}
            <div className="src">
              Trailhead coordinates: {a.trailhead.lat.toFixed(4)}, {a.trailhead.lon.toFixed(4)}
              {a.trailhead.approximate ? ' (approximate)' : ''}
            </div>
            <a href={href.area(a.id)}>Open profile →</a>
          </div>
        </details>
      ))}
      <p className="dim" style={{ marginTop: 20 }}>
        Found something wrong? Seed data lives in <code>src/content/areas</code>. Every fact there carries its source.
      </p>
    </>
  );
}
