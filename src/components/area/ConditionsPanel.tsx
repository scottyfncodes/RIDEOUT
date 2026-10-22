import type { Recommendation } from '../../engine/recommend';
import { ExtLink, Section } from '../ui';

const MUD = { low: ['good', 'LOW'], moderate: ['fair', 'MODERATE'], elevated: ['poor', 'ELEVATED'], high: ['bad', 'HIGH'], unknown: ['unknown', 'UNKNOWN'] } as const;

export function ConditionsPanel({ r }: { r: Recommendation }) {
  const [e, l] = MUD[r.mud.level];
  return (
    <Section title="Trail condition" id="conditions">
      <p data-testid="trail-condition">
        <b>Not reported.</b> <span className="muted">No live trail report is available for {r.area.name}. What follows is an estimate from the weather.</span>
      </p>
      {r.area.links.conditions && (
        <div className="btn-row" style={{ marginBottom: 10 }}>
          <ExtLink href={r.area.links.conditions}>Check official status ↗</ExtLink>
        </div>
      )}
      <div className="label">Mud risk (estimate)</div>
      <p className="display" style={{ fontSize: 28 }} data-testid="mud-risk">
        <span className={`ldot big lv-${e}`} aria-hidden />{l}
      </p>
      <p>{r.mud.explanation}</p>
      <p className="dim">
        Soil: {r.area.drainageNote} This is an estimate, not an observed trail condition.
      </p>
    </Section>
  );
}
