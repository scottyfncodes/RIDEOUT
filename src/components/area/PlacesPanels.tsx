import { useState } from 'react';
import type { RidingArea } from '../../content/types';
import { apresOptions, bikeShopServices, toOption, type ApresFilters, type PlaceOption } from '../../engine/apres';
import { osmUrl } from '../../services/places/overpass';
import type { Fetched, Place, PlaceCategory } from '../../services/types';
import { fmtMi } from '../../utils/format';
import { formatClock } from '../../utils/time';
import { Chip, Section, SourceLine } from '../ui';

function OpenTag({ o }: { o: PlaceOption }) {
  if (o.open === 'open') return <span className="pill" style={{ color: 'var(--go)' }}>Open</span>;
  if (o.open === 'closed') return <span className="pill" style={{ color: 'var(--nope)' }}>Closed then</span>;
  return <span className="pill">Hours not listed</span>;
}

function Contact({ o }: { o: PlaceOption }) {
  return (
    <div className="btn-row" style={{ marginTop: 8 }}>
      {o.phone && (
        <a className="btn" href={`tel:${o.phone.replace(/[^\d+]/g, '')}`}>
          📞 Call
        </a>
      )}
      {o.website && (
        <a className="btn" href={o.website.startsWith('http') ? o.website : `https://${o.website}`} target="_blank" rel="noopener noreferrer">
          Website ↗
        </a>
      )}
      <a className="btn" href={osmUrl(o.place.id)} target="_blank" rel="noopener noreferrer">
        OSM ↗
      </a>
    </div>
  );
}

export function BikeShopsPanel({ area, places, weekday, nowish }: { area: RidingArea; places: Fetched<Place[]> | null; weekday: number; nowish: number }) {
  return (
    <Section title="Bike shops" id="shops">
      <p className="dim" style={{ marginTop: -4 }}>
        Your bailout for mechanicals. Distances are straight-line from the trailhead.
      </p>
      {places == null ? (
        <div className="skeleton" />
      ) : !places.ok ? (
        <div className="notice bad" data-testid="shops-unavailable">
          Bike shop data unavailable.
        </div>
      ) : (
        (() => {
          const shops = places.data
            .filter((p) => p.categories.includes('bike'))
            .map((p) => toOption(p, area.trailhead, weekday, nowish))
            .sort((a, b) => a.miles - b.miles)
            .slice(0, 5);
          if (!shops.length) return <p className="nodata">No bike shops found within ~15 mi in OpenStreetMap.</p>;
          return (
            <div data-testid="shops">
              {shops.map((o) => {
                const services = bikeShopServices(o.place.tags);
                return (
                  <div key={o.place.id} className="place">
                    <div className="row between">
                      <span className="pname">{o.place.name}</span>
                      <span className="dim mono">{fmtMi(o.miles)}</span>
                    </div>
                    <div className="dim">Today: {o.hoursToday ?? 'hours not listed'}</div>
                    <div className="tags">
                      {services.length ? services.map((s) => <span key={s.key} className="pill">{s.icon} {s.label}</span>) : <span className="pill">Services not listed</span>}
                    </div>
                    <Contact o={o} />
                  </div>
                );
              })}
            </div>
          );
        })()
      )}
      {places && <SourceLine source={places.source} />}
    </Section>
  );
}

const CATS: Array<{ id: PlaceCategory; label: string }> = [
  { id: 'brewery', label: '🍺 Breweries' },
  { id: 'food', label: '🍔 Food' },
  { id: 'mexican', label: '🌮 Mexican' },
  { id: 'pizza', label: '🍕 Pizza' },
  { id: 'coffee', label: '☕ Coffee' },
  { id: 'dessert', label: '🍦 Dessert' },
];

export function ApresPanel({ area, places, weekday, rideEnd }: { area: RidingArea; places: Fetched<Place[]> | null; weekday: number; rideEnd: number | null }) {
  const [cat, setCat] = useState<PlaceCategory>('brewery');
  const [f, setF] = useState<ApresFilters>({});
  const toggle = (k: keyof ApresFilters) => setF((p) => ({ ...p, [k]: !p[k] }));
  const end = rideEnd ?? 13 * 60;

  return (
    <Section title="Apres" id="apres">
      <p className="muted" style={{ marginTop: -4 }}>
        Ride ends ~<b>{formatClock(end)}</b>
        {rideEnd == null ? ' (no ride window; assuming 1 PM)' : ''}. “Open” means open when you’d arrive.
      </p>
      <div className="chips scroll" role="group" aria-label="Apres category">
        {CATS.map((c) => (
          <Chip key={c.id} small value={c.id} current={cat} onSelect={setCat} testId={`apres-${c.id}`}>
            {c.label}
          </Chip>
        ))}
      </div>
      <div className="chips" style={{ marginTop: 8 }} role="group" aria-label="Apres filters">
        {(
          [
            ['openAfterRide', 'Open after ride'],
            ['close', '≤10 min'],
            ['patio', 'Patio'],
            ['dogs', 'Dog-friendly'],
            ['food', 'Food'],
          ] as Array<[keyof ApresFilters, string]>
        ).map(([k, label]) => (
          <button key={k} type="button" className="chip small" aria-pressed={!!f[k]} onClick={() => toggle(k)}>
            {label}
          </button>
        ))}
      </div>
      {places == null ? (
        <div className="skeleton" />
      ) : !places.ok ? (
        <div className="notice bad" data-testid="apres-unavailable">
          Apres data unavailable.
        </div>
      ) : (
        (() => {
          const opts = apresOptions(places.data, cat, area.trailhead, weekday, end, f).slice(0, 8);
          if (!opts.length) return <p className="nodata">Nothing found with those filters. Filters only match what’s tagged in OpenStreetMap.</p>;
          return (
            <div data-testid="apres-list">
              {opts.map((o, i) => (
                <div key={o.place.id} className="place">
                  <div className="row between">
                    <span className="pname">{o.place.name}</span>
                    <span className="dim mono">~{o.driveMin} min</span>
                  </div>
                  <div className="tags">
                    <OpenTag o={o} />
                    {o.patio && <span className="pill">Patio</span>}
                    {o.dogs && <span className="pill">Dogs OK</span>}
                    {o.food && <span className="pill">Food</span>}
                    <span className="pill">{fmtMi(o.miles)} from trailhead</span>
                  </div>
                  {i === 0 && o.open === 'open' && o.driveMin <= 15 && <p style={{ margin: '6px 0 0', color: 'var(--go)', fontWeight: 700 }}>Perfect apres window</p>}
                  <div className="dim">Today: {o.hoursToday ?? 'hours not listed'}</div>
                  <Contact o={o} />
                </div>
              ))}
            </div>
          );
        })()
      )}
      <p className="dim">Bike-friendly and easy-parking filters aren’t offered because OpenStreetMap rarely tags them reliably.</p>
      {places && <SourceLine source={places.source} />}
    </Section>
  );
}
