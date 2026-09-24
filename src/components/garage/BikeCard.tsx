import { bikeSummary, bikeTitle, type Bike } from '../../engine/garage';
import { href } from '../../hooks/useRoute';

/** The saved bike, presented like a spec card rather than a form. */
export function BikeCard({ bike, from = 'garage' }: { bike: Bike | null; from?: 'garage' | 'settings' }) {
  if (!bike) {
    return (
      <div className="bike-card empty" data-testid="bike-empty">
        <p className="display" style={{ fontSize: 28, margin: 0 }}>
          Tell RIDEOUT what you’re riding.
        </p>
        <p className="muted">A name is enough to start. Add pressures and travel when you like, and Bike Prep uses them on every ride.</p>
        <a className="btn primary" href={href.bike(from)} data-testid="add-bike">
          Add my bike
        </a>
      </div>
    );
  }
  const extras: Array<[string, string | null]> = [
    ['Make / model', [bike.make, bike.model].filter(Boolean).join(' ') || null],
    ['Tires', bike.tireSize],
    ['Dropper', bike.dropper == null ? null : bike.dropper ? 'Yes' : 'No'],
    ['Brakes', bike.brakes],
    ['Drivetrain', bike.drivetrain],
    ['Suspension setup', bike.suspensionNotes],
    ['Weight', bike.weightLb != null ? `~${bike.weightLb} lb` : null],
  ];
  const shown = extras.filter(([, v]) => v);
  const summary = bikeSummary(bike);
  return (
    <div className="bike-card" data-testid="bike-card">
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div>
          <p className="display bike-name">{bikeTitle(bike)}</p>
          {summary.length > 0 && <p className="muted" style={{ margin: '4px 0 0' }}>{summary.join(' · ')}</p>}
        </div>
        <a className="btn" href={href.bike(from)} data-testid="edit-bike">
          Edit
        </a>
      </div>
      {(bike.frontPsi != null || bike.rearPsi != null) && (
        <div className="grid2" style={{ marginTop: 14 }} data-testid="bike-psi">
          <div className="stat">
            <b>{bike.frontPsi ?? '—'} PSI</b>
            <span>Front · your usual</span>
          </div>
          <div className="stat">
            <b>{bike.rearPsi ?? '—'} PSI</b>
            <span>Rear · your usual</span>
          </div>
        </div>
      )}
      {shown.length > 0 && (
        <dl className="specs">
          {shown.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="src">Specs entered by you · stored only on this device</p>
    </div>
  );
}
