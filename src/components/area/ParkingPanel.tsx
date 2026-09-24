import type { RidingArea } from '../../content/types';
import type { AccessResult } from '../../engine/access';
import { ExtLink, NotEnoughData, Section, SourceLine } from '../ui';

export function AccessPanel({ area, access }: { area: RidingArea; access: AccessResult }) {
  if (!area.access.length && access.open) return null;
  return (
    <Section title="Access & rules" id="access">
      {!access.open && <div className="notice bad">{access.closedReason}</div>}
      {access.notes.map((n) => (
        <div key={n} className="notice">
          {n}
        </div>
      ))}
      <ul>
        {area.access.map((a) => (
          <li key={a.summary} style={{ marginBottom: 8 }}>
            {a.summary}
            <SourceLine source={a.source} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function ParkingPanel({ area }: { area: RidingArea }) {
  const p = area.parking;
  const Row = ({ k, v }: { k: string; v: string | null }) => (
    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
      <div className="dim">{k}</div>
      <div>{v ?? <NotEnoughData>Not listed</NotEnoughData>}</div>
    </div>
  );
  const nothing = !p.primary && !p.fee && !p.hours && !p.overflow;
  return (
    <Section title="Parking" id="parking">
      {nothing ? (
        <p className="nodata">Parking details unavailable</p>
      ) : (
        <div data-testid="parking">
          <Row k="Primary" v={p.primary} />
          <Row k="Fee" v={p.fee} />
          <Row k="Hours" v={p.hours} />
          <Row k="Availability" v={p.availability} />
          <Row k="Overflow / alternate" v={p.overflow} />
          <Row k="Restrictions" v={p.restrictions} />
          <Row k="Restrooms" v={p.restrooms == null ? null : p.restrooms ? 'Yes' : 'No'} />
          {p.amenities.length > 0 && <Row k="Amenities" v={p.amenities.join(' · ')} />}
        </div>
      )}
      <SourceLine source={p.source} />
      {area.links.official && (
        <div className="btn-row" style={{ marginTop: 10 }}>
          <ExtLink href={area.links.official}>{area.links.officialLabel ?? 'Official page'} ↗</ExtLink>
        </div>
      )}
    </Section>
  );
}

export function TrailMapsPanel({ area }: { area: RidingArea }) {
  const l = area.links;
  return (
    <Section title="Trail maps" id="maps">
      <div className="btn-row">
        {l.trailMap && (
          <ExtLink href={l.trailMap} className="btn primary">
            View trail map ↗
          </ExtLink>
        )}
        {l.officialMap && <ExtLink href={l.officialMap}>Open official map ↗</ExtLink>}
        {l.official && <ExtLink href={l.official}>Official site ↗</ExtLink>}
      </div>
      <p className="dim">
        Maps open on their publishers’ sites. RIDEOUT links out instead of copying them. “Official map” goes to the managing agency or COTREX, Colorado’s official trail map.
      </p>
    </Section>
  );
}
