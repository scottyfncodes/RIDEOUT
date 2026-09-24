import type { BikePrep } from '../../engine/bikePrep';
import { href } from '../../hooks/useRoute';
import { Section } from '../ui';

export function BikePrepPanel({ prep }: { prep: BikePrep }) {
  return (
    <Section title="Bike prep" id="prep">
      <p className="muted" style={{ margin: '-4px 0 0', fontWeight: 600 }} data-testid="prep-triggers">
        {prep.triggers.map((t) => t.label).join(' · ')}
      </p>
      <ul className="checks" data-testid="bike-prep">
        {prep.checks.map((c) => (
          <li key={c.id} data-check={c.id}>
            <span aria-hidden>✓</span> {c.text}
          </li>
        ))}
      </ul>
      {prep.usualPsi && (
        <p className="small" data-testid="prep-psi">
          Your usual: <b>{prep.usualPsi.front ?? '—'}</b> front · <b>{prep.usualPsi.rear ?? '—'}</b> rear PSI <span className="dim">(from your Garage, not a recommendation)</span>
        </p>
      )}
      <ul className="basis" aria-label="Based on">
        {prep.triggers.map((t) => (
          <li key={t.id}>{t.label}: {t.basis}</li>
        ))}
      </ul>
      <p className="dim small">
        General prep guidance based on the ride and forecast. It isn’t a mechanical inspection.
        {!prep.tailored && (
          <>
            {' '}
            <a href={href.bike()}>Add your bike</a> to tailor it.
          </>
        )}
      </p>
      <a className="btn" href={href.garage}>
        Pre-ride checklist →
      </a>
    </Section>
  );
}
