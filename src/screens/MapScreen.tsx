import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ALL_AREAS } from '../content/areas';
import { DEFAULT_REGION } from '../data/regions';
import { STATUS_META, type Status } from '../engine/status';
import { useRideData } from '../hooks/useRideData';
import { href } from '../hooks/useRoute';
import { useStore } from '../state/store';
import { formatClock, formatDateLabel } from '../utils/time';
import { StatusBadge } from '../components/ui';

export function MapScreen() {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const data = useRideData();
  const { params, today } = useStore();
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView(DEFAULT_REGION.center, DEFAULT_REGION.zoom);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m);
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    const syncZoom = () => el.current?.classList.toggle('z-hi', m.getZoom() >= 11);
    m.on('zoomend', syncZoom);
    syncZoom();
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // Status per area (evaluated for every area regardless of filters, so the map is complete)
  const byId = new Map<string, Status>();
  if (data.output) {
    for (const r of data.output.results) byId.set(r.area.id, r.status);
  }

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    for (const a of ALL_AREAS) {
      const st: Status = byId.get(a.id) ?? 'unknown';
      const filtered = data.output && !byId.has(a.id);
      const icon = L.divIcon({
        className: '',
        html: `<span class="mk ${st}" style="${filtered ? 'opacity:.45' : ''}" aria-label="${a.name}: ${STATUS_META[st].marker}"><span class="dot"></span><b>${shortName(a.name)}</b></span>`,
        iconSize: undefined,
        iconAnchor: [13, 13],
      });
      L.marker([a.trailhead.lat, a.trailhead.lon], { icon, title: a.name, keyboard: true })
        .on('click', () => setSel(a.id))
        .addTo(g);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.output]);

  const selR = sel ? data.output?.results.find((r) => r.area.id === sel) : null;
  const selArea = sel ? ALL_AREAS.find((a) => a.id === sel) : null;
  const selExcluded = sel ? data.output?.excluded.find((e) => e.area.id === sel) : null;

  return (
    <div className="map-wrap">
      <div ref={el} className="map" data-testid="map" role="application" aria-label="Map of riding areas" />
      <div className="map-top">
        <span className="display brand">RIDEOUT</span>
        <span className="pill">{formatDateLabel(params.date, today)}</span>
        {data.loading && <span className="pill">Loading…</span>}
      </div>
      <div className="map-legend legend" aria-label="Legend">
        {(['send', 'worth', 'questionable', 'skip', 'unknown'] as Status[]).map((s) => (
          <span key={s} className={`mk ${s}`}>
            <span className="dot" />
            {STATUS_META[s].marker}
          </span>
        ))}
      </div>
      {selArea && (
        <div className="sheet" data-testid="map-sheet">
          <div className="row between">
            {selR ? <StatusBadge status={selR.status} /> : <span className="dim">{selExcluded ? `Filtered: ${selExcluded.reason}` : ''}</span>}
            <button type="button" className="btn" onClick={() => setSel(null)} aria-label="Close">
              ✕
            </button>
          </div>
          <div className="display" style={{ fontSize: 30, margin: '6px 0' }}>
            {selArea.name}
          </div>
          {selR?.window?.window && (
            <p className="muted" style={{ margin: '0 0 6px' }}>
              ⏱ {formatClock(selR.window.window.start)}–{formatClock(selR.window.window.end)}
              {selR.drive ? ` · 🚗 ${Math.round(selR.drive.minutes)} min` : ''}
            </p>
          )}
          {selR && <p style={{ margin: '0 0 10px' }}>{selR.headline}</p>}
          <a className="btn primary block" href={href.area(selArea.id)}>
            Open RIDEOUT profile
          </a>
        </div>
      )}
    </div>
  );
}

export function shortName(name: string): string {
  return name.replace(/\s+(State Park|Open Space|Park|Preserve|Mountain Park)$/i, '').replace(/\s+Canyon State Park$/i, '');
}
