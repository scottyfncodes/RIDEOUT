import { useMemo, useState } from 'react';
import { getArea } from '../content/areas';
import { DIFFICULTY_ICON, DIFFICULTY_LABEL } from '../engine/modes';
import { evaluateArea } from '../engine/recommend';
import { estimateRideMinutes } from '../engine/fit';
import { useAreaPlaces } from '../hooks/useAreaPlaces';
import { useRideData } from '../hooks/useRideData';
import { href } from '../hooks/useRoute';
import { useStore } from '../state/store';
import { fmtFt, fmtMi } from '../utils/format';
import { formatDateLabel, formatDuration, weekday } from '../utils/time';
import { Chip, RatingRow, Section, SourceLine, StatusBadge } from '../components/ui';
import { RideWindowPanel } from '../components/area/RideWindowPanel';
import { WeatherPanel } from '../components/area/WeatherPanel';
import { ConditionsPanel } from '../components/area/ConditionsPanel';
import { GettingThere } from '../components/area/GettingThere';
import { AccessPanel, ParkingPanel, TrailMapsPanel } from '../components/area/ParkingPanel';
import { ApresPanel, BikeShopsPanel } from '../components/area/PlacesPanels';
import { ShareCard } from '../components/area/ShareCard';
import { BikePrepPanel } from '../components/area/BikePrepPanel';
import { bikePrep } from '../engine/bikePrep';

export function Area({ id }: { id: string }) {
  const area = getArea(id);
  const { params, today, home, bike } = useStore();
  const data = useRideData();
  const places = useAreaPlaces(area);
  const [rideId, setRideId] = useState<string | undefined>(undefined);

  const r = useMemo(() => (area && data.input ? evaluateArea(area, data.input, rideId) : null), [area, data.input, rideId]);

  const prep = useMemo(() => (r ? bikePrep(r, bike) : null), [r, bike]);

  if (!area) {
    return (
      <>
        <a className="back" href={href.home}>
          ← Back
        </a>
        <p className="notice bad">Unknown riding area.</p>
      </>
    );
  }

  const dateLabel = formatDateLabel(params.date, today);
  const wd = weekday(params.date);
  const c = area.character;

  return (
    <article data-testid="area">
      <a className="back" href={href.home}>
        ← Rides
      </a>
      <p className="dim" style={{ margin: 0 }}>
        {area.subregion} · {area.manager}
      </p>
      <h1 className="display" style={{ fontSize: 46, margin: '4px 0 10px' }}>
        {area.name}
      </h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {area.summary}
      </p>

      <nav className="tabs chips scroll" aria-label="Jump to section">
        {[
          ['window', 'Window'],
          ['weather', 'Weather'],
          ['conditions', 'Trail'],
          ...(prep ? [['prep', 'Prep']] : []),
          ['drive', 'Drive'],
          ['parking', 'Parking'],
          ['shops', 'Shops'],
          ['apres', 'Apres'],
          ['share', 'Share'],
        ].map(([k, l]) => (
          <a key={k} className="chip small" href={`#/area/${area.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(k)?.scrollIntoView({ behavior: 'smooth' }); }}>
            {l}
          </a>
        ))}
      </nav>

      <Section title={`RIDEOUT status · ${dateLabel}`} id="status">
        {!r ? (
          <div className="skeleton" />
        ) : (
          <>
            <StatusBadge status={r.status} big />
            {r.why.length > 0 && (
              <>
                <div className="label">Why</div>
                <ul data-testid="why">
                  {r.why.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </>
            )}
            {r.whyNot.length > 0 && (
              <>
                <div className="label">Why not</div>
                <ul data-testid="why-not">
                  {r.whyNot.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </>
            )}
            <details>
              <summary>How RIDEOUT scored this{r.score != null ? ` (${r.score}/100)` : ''}</summary>
              <table className="breakdown">
                <tbody>
                  {r.components.map((comp) => (
                    <tr key={comp.key}>
                      <td>
                        <b>{comp.label}</b>
                        <div className="dim">{comp.note}</div>
                      </td>
                      <td>{comp.value == null ? 'n/a' : `${Math.round(comp.value * 100)}`} × {comp.weight}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="dim">
                Weighted average of the known components. Hard rules: closed to bikes → SKIP. High mud risk → SKIP. Elevated mud or a weak weather window → QUESTIONABLE at best. A merely fair weather window → WORTH IT at best. No weather → UNKNOWN.
              </p>
            </details>
          </>
        )}
      </Section>

      <Section title="Quick stats" id="stats">
        {area.rides.length > 1 && (
          <div className="chips" style={{ marginBottom: 10 }} role="group" aria-label="Signature ride">
            {area.rides.map((ride) => (
              <Chip<string> key={ride.id} small value={ride.id} current={r?.ride?.id ?? ""} onSelect={(v) => setRideId(v)}>
                {ride.name}
              </Chip>
            ))}
          </div>
        )}
        {r?.ride ? (
          <>
            <p style={{ margin: '0 0 8px' }}>
              <b>{r.ride.name}</b> · {DIFFICULTY_ICON[r.ride.difficulty]} {DIFFICULTY_LABEL[r.ride.difficulty]}
            </p>
            <div className="grid3" data-testid="stats">
              <div className="stat">
                <b>{fmtMi(r.ride.distanceMi)}</b>
                <span>Distance</span>
              </div>
              <div className="stat">
                <b>{fmtFt(r.ride.gainFt)}</b>
                <span>Climbing</span>
              </div>
              <div className="stat">
                <b>{estimateRideMinutes(r.ride) != null ? formatDuration(estimateRideMinutes(r.ride)!) : '—'}</b>
                <span>Est. ride time</span>
              </div>
              <div className="stat">
                <b>{fmtFt(r.ride.highPointFt ?? null)}</b>
                <span>High point</span>
              </div>
              <div className="stat">
                <b>{fmtMi(area.networkMiles, 1)}</b>
                <span>Network miles</span>
              </div>
              <div className="stat">
                <b>{area.trailCount ?? '—'}</b>
                <span>Trails</span>
              </div>
            </div>
            <p className="dim">
              Difficulty range: {DIFFICULTY_LABEL[area.difficultyRange[0]]}
              {area.difficultyRange[1] !== area.difficultyRange[0] ? ` → ${DIFFICULTY_LABEL[area.difficultyRange[1]]}` : ''}. “—” means not enough data.
            </p>
            {r.ride.notes && <p className="small muted">{r.ride.notes}</p>}
            <SourceLine source={r.ride.source} prefix="Ride stats" />
            {area.networkMilesSource && <SourceLine source={area.networkMilesSource} prefix="Network miles" />}
          </>
        ) : (
          <p className="nodata">Not enough data</p>
        )}
      </Section>

      <Section title="Ride character" id="character">
        <div className="ratings">
          <RatingRow label="Technical" value={c.technical} hot />
          <RatingRow label="Climbing" value={c.climbing} />
          <RatingRow label="Descending" value={c.descending} />
          <RatingRow label="Flow" value={c.flow} />
          <RatingRow label="Chunk" value={c.chunk} hot />
          <RatingRow label="Exposure" value={c.exposure} hot />
          <RatingRow label="Roots" value={c.roots} />
          <RatingRow label="Rock" value={c.rock} />
          <RatingRow label="Jumps" value={c.jumps} />
          <RatingRow label="Drops" value={c.drops} />
          <RatingRow label="Hike-a-bike" value={c.hikeABike} />
        </div>
        <SourceLine source={area.characterSource} prefix="Ratings" />
      </Section>

      {r && <RideWindowPanel r={r} />}
      <WeatherPanel fx={data.forecasts[area.id]} date={params.date} isToday={params.date === today} window={r?.window?.window ?? null} />
      {r && <ConditionsPanel r={r} />}
      {r && <AccessPanel area={area} access={r.access} />}
      {prep && <BikePrepPanel prep={prep} />}
      {r && <GettingThere r={r} homeLabel={home.label} />}
      <ParkingPanel area={area} />
      <TrailMapsPanel area={area} />
      <BikeShopsPanel area={area} places={places} weekday={wd} nowish={r?.window?.window?.start ?? 10 * 60} />
      <ApresPanel area={area} places={places} weekday={wd} rideEnd={r?.itinerary?.backAtCar ?? r?.window?.window?.end ?? null} />
      {r && <ShareCard r={r} dateLabel={dateLabel} />}
    </article>
  );
}
