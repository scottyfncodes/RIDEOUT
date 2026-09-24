import { useEffect, useMemo, useState } from 'react';
import { ALL_AREAS } from '../content/areas';
import { CHECKLIST, TRAILSIDE, TRAILSIDE_ESCALATION } from '../content/garage';
import { daysSince, loadChecklist, saveChecklist, type ServiceKind } from '../engine/garage';
import { useAreaPlaces } from '../hooks/useAreaPlaces';
import { fetchShopsNear } from '../services/places/overpass';
import type { Fetched, Place } from '../services/types';
import { useStore } from '../state/store';
import { DEFAULT_REGION } from '../data/regions';
import { nowInZone, weekday } from '../utils/time';
import { Chip, Section } from '../components/ui';
import { BikeCard } from '../components/garage/BikeCard';
import { SHOP_FILTERS, ShopList, type ShopFilter } from '../components/area/PlacesPanels';

const jump = (id: string) => (e: React.MouseEvent) => {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
};

export function Garage() {
  const { bike } = useStore();
  return (
    <>
      <p className="display brand">RIDEOUT</p>
      <h1 className="display" style={{ fontSize: 40, margin: '6px 0 2px' }}>
        Garage
      </h1>
      <p className="muted" style={{ marginTop: 0 }}>
        RIDEOUT knows where you’re riding. Garage knows what you’re riding.
      </p>
      <nav className="tabs chips scroll" aria-label="Jump to section">
        {[
          ['bike', 'My bike'],
          ['checklist', 'Checklist'],
          ['service', 'Service'],
          ['garage-shops', 'Shops'],
          ['trailside', 'Trailside'],
        ].map(([k, l]) => (
          <a key={k} className="chip small" href="#/garage" onClick={jump(k)}>
            {l}
          </a>
        ))}
      </nav>
      <Section title="My bike" id="bike">
        <BikeCard bike={bike} />
      </Section>
      <Checklist />
      <Service />
      <GarageShops />
      <Trailside />
    </>
  );
}

function Checklist() {
  const { bike, today } = useStore();
  const items = useMemo(() => CHECKLIST.filter((i) => !i.appliesTo || i.appliesTo(bike)), [bike]);
  const [done, setDone] = useState<string[]>(() => loadChecklist(today));
  useEffect(() => saveChecklist(today, done), [today, done]);
  const doneVisible = items.filter((i) => done.includes(i.id)).length;
  const ready = doneVisible === items.length;
  const toggle = (id: string) => setDone((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  return (
    <Section
      title="Pre-ride check"
      id="checklist"
      right={
        <span className={`ready${ready ? ' on' : ''}`} data-testid="checklist-progress">
          {ready ? 'Ready to roll' : `${doneVisible}/${items.length}`}
        </span>
      }
    >
      <p className="dim" style={{ marginTop: -4 }}>
        Is the bike ready to leave the garage? Ticks clear themselves tomorrow.
      </p>
      <div className="progress" aria-hidden>
        <span style={{ width: `${(doneVisible / items.length) * 100}%` }} />
      </div>
      <ul className="checklist" data-testid="checklist">
        {items.map((i) => (
          <li key={i.id}>
            <label className={done.includes(i.id) ? 'done' : ''}>
              <input type="checkbox" checked={done.includes(i.id)} onChange={() => toggle(i.id)} data-testid={`check-${i.id}`} />
              <span>
                <b>{i.label}</b>
                <span className="dim">{i.hint}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {done.length > 0 && (
        <button type="button" className="btn" onClick={() => setDone([])} data-testid="checklist-reset">
          Clear ticks
        </button>
      )}
      <p className="dim small">General pre-ride habits, not a mechanical inspection. If something feels wrong, get it looked at before you ride.</p>
    </Section>
  );
}

const SERVICES: Array<{ kind: ServiceKind; label: string }> = [
  { kind: 'general', label: 'Last full service' },
  { kind: 'suspension', label: 'Suspension service' },
  { kind: 'brakes', label: 'Brakes (pads / bleed)' },
  { kind: 'drivetrain', label: 'Drivetrain' },
  { kind: 'tires', label: 'Tires replaced' },
];

function Service() {
  const { maintenance, setMaintenance, today } = useStore();
  const [notes, setNotes] = useState(maintenance.notes ?? '');
  const setDate = (kind: ServiceKind, date: string) => {
    const entries = { ...maintenance.entries };
    if (date) entries[kind] = { date };
    else delete entries[kind];
    setMaintenance({ ...maintenance, entries });
  };
  const ago = (d: number | null) => (d == null ? '' : d === 0 ? 'today' : d < 60 ? `${d} days ago` : d < 730 ? `${Math.round(d / 30.4)} months ago` : `${Math.round(d / 365)} years ago`);

  return (
    <Section title="Service log" id="service">
      <p className="dim" style={{ marginTop: -4 }}>
        Optional. When did it last get some love?
      </p>
      <div data-testid="service">
        {SERVICES.map((s) => {
          const date = maintenance.entries[s.kind]?.date ?? '';
          return (
            <div key={s.kind} className="service-row">
              <label htmlFor={`svc-${s.kind}`}>
                <b>{s.label}</b>
                <span className="dim">{date ? ago(daysSince(date, today)) : 'Not recorded'}</span>
              </label>
              <input id={`svc-${s.kind}`} type="date" max={today} value={date} onChange={(e) => setDate(s.kind, e.target.value)} data-testid={`svc-${s.kind}`} />
            </div>
          );
        })}
      </div>
      <div className="field">
        <label htmlFor="svc-notes">Notes</label>
        <textarea
          id="svc-notes"
          rows={3}
          maxLength={1000}
          placeholder="e.g. rear brake a bit soft, new tire in the garage"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => setMaintenance({ ...maintenance, notes: notes.trim() || null })}
          data-testid="svc-notes"
        />
      </div>
    </Section>
  );
}

function GarageShops() {
  const { home } = useStore();
  const [where, setWhere] = useState<string>('home');
  const [filter, setFilter] = useState<ShopFilter>('all');
  const area = where === 'home' ? undefined : ALL_AREAS.find((a) => a.id === where);
  const areaPlaces = useAreaPlaces(area);
  const [homeShops, setHomeShops] = useState<Fetched<Place[]> | null>(null);
  useEffect(() => {
    if (where !== 'home') return;
    let live = true;
    setHomeShops(null);
    fetchShopsNear('home', home).then((r) => live && setHomeShops(r));
    return () => {
      live = false;
    };
  }, [where, home]);

  const now = nowInZone(DEFAULT_REGION.timezone);
  const origin = area ? area.trailhead : home;
  return (
    <Section title="Bike shops" id="garage-shops">
      <div className="field" style={{ marginTop: 0 }}>
        <label htmlFor="shop-where">Near</label>
        <select id="shop-where" value={where} onChange={(e) => setWhere(e.target.value)} data-testid="shop-where">
          <option value="home">Home · {home.label}</option>
          {ALL_AREAS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div className="chips scroll" role="group" aria-label="Shop service" style={{ marginBottom: 6 }}>
        <Chip<ShopFilter> small value="all" current={filter} onSelect={setFilter}>
          All
        </Chip>
        {SHOP_FILTERS.map((f) => (
          <Chip<ShopFilter> key={f.key} small value={f.key} current={filter} onSelect={setFilter} testId={`shop-filter-${f.key}`}>
            {f.label}
          </Chip>
        ))}
      </div>
      <ShopList
        origin={origin}
        originLabel={area ? `the ${area.name} trailhead` : 'home'}
        places={area ? areaPlaces : homeShops}
        weekday={weekday(now.date)}
        atMin={now.minutes}
        filter={filter}
        limit={6}
      />
      <p className="dim small">Suspension and e-bike service are rarely tagged in OpenStreetMap. Call ahead for those.</p>
    </Section>
  );
}

function Trailside() {
  return (
    <Section title="Trailside help" id="trailside">
      <p className="dim" style={{ marginTop: -4 }}>
        Quick fixes to get you home. General guidance, not a professional diagnosis.
      </p>
      <div data-testid="trailside">
        {TRAILSIDE.map((g) => (
          <details key={g.id} className="help">
            <summary>
              <span aria-hidden>{g.icon}</span> {g.title}
            </summary>
            <ol>
              {g.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <div className="notice bad small">{TRAILSIDE_ESCALATION}</div>
          </details>
        ))}
      </div>
    </Section>
  );
}
