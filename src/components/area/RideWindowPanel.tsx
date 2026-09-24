import type { Recommendation } from '../../engine/recommend';
import { formatClock, formatHourShort } from '../../utils/time';
import { fmtPct, fmtTemp } from '../../utils/format';
import { Section } from '../ui';

const EMOJI = { great: '🟢', good: '🟢', fair: '🟡', poor: '🟠', bad: '🔴', unknown: '⚪' } as const;

export function RideWindowPanel({ r }: { r: Recommendation }) {
  const w = r.window;
  return (
    <Section title="Ride window" id="window">
      <p className="dim" style={{ marginTop: -4 }}>
        Based on the <b>weather forecast</b>. This is not a trail report.
      </p>
      {!w || w.reason === 'no-data' ? (
        <div className="notice bad">Weather unavailable. No ride window can be calculated.</div>
      ) : (
        <>
          {w.window ? (
            <div data-testid="ride-window">
              <div className="wbig mono">
                {formatClock(w.window.start)} → {formatClock(w.window.end)}
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                {EMOJI[w.window.level]} {w.window.level === 'great' || w.window.level === 'good' ? 'Best conditions' : w.window.level === 'fair' ? 'Best available — fair' : 'Best available — poor'}
                {w.window.goodSpan && (w.window.goodSpan.start !== w.window.start || w.window.goodSpan.end !== w.window.end) && (
                  <span className="dim">
                    {' '}
                    · good weather {formatClock(w.window.goodSpan.start)}–{formatClock(w.window.goodSpan.end)}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="notice bad">
              {w.reason === 'too-late' ? 'Not enough daylight left today to get there and ride.' : 'Not enough daylight for this ride.'}
            </div>
          )}
          <div className="hbar" aria-hidden>
            {w.slots
              .filter((s) => s.daylight)
              .map((s) => (
                <span key={s.minutes} className={`lv-${s.verdict.level}`} />
              ))}
          </div>
          <ul className="hours" data-testid="hours">
            {w.slots
              .filter((s) => s.daylight || (w.window && s.minutes + 60 > w.window.start && s.minutes < w.window.end))
              .map((s) => {
                const inWin = !!w.window && s.minutes + 60 > w.window.start && s.minutes < w.window.end;
                return (
                  <li key={s.minutes} className={`hour${inWin ? ' in' : ''}`}>
                    <span className="mono">{formatHourShort(s.minutes)}</span>
                    <span aria-hidden>{EMOJI[s.verdict.level]}</span>
                    <span>{s.verdict.label}</span>
                    <span className="dim mono">
                      {fmtTemp(s.hour.tempF)} · {fmtPct(s.hour.precipProb)}
                    </span>
                  </li>
                );
              })}
          </ul>
          {w.sunrise != null && w.sunset != null && (
            <p className="dim">
              ☀️ Sunrise {formatClock(w.sunrise)} · Sunset {formatClock(w.sunset)}
            </p>
          )}
        </>
      )}
    </Section>
  );
}
