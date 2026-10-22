import type { ReactNode } from 'react';
import type { Difficulty, Rating, Source } from '../content/types';
import { STATUS_META, type Status } from '../engine/status';

export function Chip<T extends string | number | null>(props: {
  value: T;
  current: T;
  onSelect: (v: T) => void;
  children: ReactNode;
  small?: boolean;
  testId?: string;
}) {
  const pressed = props.value === props.current;
  return (
    <button
      type="button"
      className={`chip${props.small ? ' small' : ''}`}
      aria-pressed={pressed}
      data-testid={props.testId}
      onClick={() => props.onSelect(props.value)}
    >
      {props.children}
    </button>
  );
}

/** A toggle chip for multi-select groups. */
export function MultiChip(props: { pressed: boolean; onClick: () => void; children: ReactNode; testId?: string }) {
  return (
    <button type="button" className="chip" aria-pressed={props.pressed} data-testid={props.testId} onClick={props.onClick}>
      {props.children}
    </button>
  );
}

export function StatusBadge({ status, big }: { status: Status; big?: boolean }) {
  const m = STATUS_META[status];
  return (
    <span className={`status ${status}${big ? ' big' : ''}`} data-testid="status">
      <span className="dot" aria-hidden />
      {m.label}
    </span>
  );
}

export function NotEnoughData({ children = 'Not enough data' }: { children?: ReactNode }) {
  return <span className="nodata">{children}</span>;
}

export function SourceLine({ source, prefix = 'Source' }: { source: Source | null | undefined; prefix?: string }) {
  if (!source) return <div className="src">{prefix}: none on file</div>;
  const conf = { official: 'official', reported: 'reported', editorial: 'RIDEOUT editorial', estimate: 'estimate' }[source.confidence];
  return (
    <div className="src">
      {prefix}:{' '}
      {source.url ? (
        <a href={source.url} target="_blank" rel="noopener noreferrer">
          {source.label}
        </a>
      ) : (
        source.label
      )}{' '}
      · {conf}
      {source.checked ? ` · checked ${source.checked}` : ''}
    </div>
  );
}

const RATING_WORD = ['None', 'Low', 'Moderate', 'High', 'Extreme'];

export function RatingRow({ label, value, hot }: { label: string; value: Rating; hot?: boolean }) {
  return (
    <div className="rating" data-testid={`rating-${label.toLowerCase().replace(/\W+/g, '-')}`}>
      <span>{label}</span>
      {value == null ? (
        <span className="nodata small">Not enough data</span>
      ) : (
        <span className={`bars${hot ? ' hot' : ''}`} role="img" aria-label={`${label}: ${RATING_WORD[value]}`}>
          {[1, 2, 3, 4].map((i) => (
            <i key={i} className={i <= value ? 'on' : ''} />
          ))}
        </span>
      )}
      <span className="dim">{value == null ? '' : RATING_WORD[value]}</span>
    </div>
  );
}

export function ExtLink({ href, children, className = 'btn' }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

export function Section({ title, children, id, right }: { title: string; children: ReactNode; id?: string; right?: ReactNode }) {
  return (
    <section className="section" id={id} aria-labelledby={id ? `${id}-h` : undefined}>
      <div className="row between">
        <h2 className="h2" id={id ? `${id}-h` : undefined}>
          {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

/** The trail-sign symbol riders already read at the trailhead: green circle, blue square, black diamond, double black. */
export function TrailSign({ difficulty }: { difficulty: Difficulty }) {
  const diamond = (cx: number) => <rect x={cx - 4.6} y={2.4} width={9.2} height={9.2} transform={`rotate(45 ${cx} 7)`} />;
  return (
    <svg className={`tsign ${difficulty}`} viewBox={difficulty === 'dblack' ? '0 0 26 14' : '0 0 14 14'} aria-hidden focusable="false">
      {difficulty === 'green' && <circle cx={7} cy={7} r={6} />}
      {difficulty === 'blue' && <rect x={1.5} y={1.5} width={11} height={11} />}
      {difficulty === 'black' && diamond(7)}
      {difficulty === 'dblack' && (
        <>
          {diamond(7)}
          {diamond(19)}
        </>
      )}
    </svg>
  );
}
