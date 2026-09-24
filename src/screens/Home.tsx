import { useRef } from 'react';
import { Chip, StatusBadge } from '../components/ui';
import { DIFFICULTY_ICON, DIFFICULTY_LABEL, MODES, QUICK_BUDGETS, VIBES, type DifficultyChoice, type DriveLimit, type RideMode, type Vibe } from '../engine/modes';
import { useRideData, type RideData } from '../hooks/useRideData';
import { href } from '../hooks/useRoute';
import { useStore } from '../state/store';
import { fmtFt, fmtMi } from '../utils/format';
import { addDays, daysBetween, formatClock, formatDateLabel, formatDuration, nextWeekday } from '../utils/time';
import type { Recommendation } from '../engine/recommend';

const MAX_DAYS_AHEAD = 9;

export function Home() {
  const { params, setParams, today, home, searched, setSearched } = useStore();
  const data = useRideData();
  const resultsRef = useRef<HTMLDivElement>(null);

  const sat = nextWeekday(today, 6);
  const sun = nextWeekday(today, 0);
  const tomorrow = addDays(today, 1);
  const dateChips: Array<{ v: string; label: string }> = [
    { v: today, label: 'Today' },
    { v: tomorrow, label: 'Tomorrow' },
  ];
  if (sat !== today && sat !== tomorrow) dateChips.push({ v: sat, label: 'Sat' });
  if (sun !== today && sun !== tomorrow) dateChips.push({ v: sun, label: 'Sun' });
  const customDate = !dateChips.some((c) => c.v === params.date);

  const find = () => {
    setSearched(true);
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <>
      <p className="display brand">RIDEOUT</p>
      <h1 className="display hero">Where should I ride?</h1>

      <div className="label">When</div>
      <div className="chips scroll" role="group" aria-label="Date">
        {dateChips.map((c) => (
          <Chip key={c.v} value={c.v} current={params.date} onSelect={(v) => setParams({ date: v })} testId={`date-${c.label.toLowerCase()}`}>
            {c.label}
          </Chip>
        ))}
        <label className="chip" aria-pressed={customDate}>
          <span className="sr-only">Pick a date</span>
          📅
          <input
            type="date"
            aria-label="Pick a date"
            data-testid="date-pick"
            min={today}
            max={addDays(today, MAX_DAYS_AHEAD)}
            value={params.date}
            onChange={(e) => {
              const v = e.target.value;
              if (v && daysBetween(today, v) >= 0 && daysBetween(today, v) <= MAX_DAYS_AHEAD) setParams({ date: v });
            }}
          />
        </label>
      </div>

      <div className="label">What are we doing?</div>
      <div className="chips modes" role="group" aria-label="Ride type">
        {(Object.keys(MODES) as RideMode[]).map((m) => (
          <Chip key={m} value={m} current={params.mode} onSelect={(v) => setParams({ mode: v })} testId={`mode-${m}`}>
            {MODES[m].emoji} {MODES[m].label}
          </Chip>
        ))}
      </div>
      {params.mode === 'quick' && (
        <div className="chips" style={{ marginTop: 8 }} role="group" aria-label="Time available">
          <span className="dim" style={{ alignSelf: 'center' }}>
            I have
          </span>
          {QUICK_BUDGETS.map((b) => (
            <Chip key={b} small value={b} current={params.quickBudget} onSelect={(v) => setParams({ quickBudget: v })} testId={`budget-${b}`}>
              {b / 60} hrs
            </Chip>
          ))}
        </div>
      )}

      <div className="label">Vibe</div>
      <div className="chips scroll" role="group" aria-label="Vibe">
        {VIBES.map((v) => (
          <Chip<Vibe> key={v.id} value={v.id} current={params.vibe} onSelect={(x) => setParams({ vibe: x })} testId={`vibe-${v.id}`}>
            {v.emoji} {v.label}
          </Chip>
        ))}
      </div>

      <div className="label">How hard?</div>
      <div className="chips scroll" role="group" aria-label="Difficulty">
        {(['any', 'green', 'blue', 'black', 'dblack'] as DifficultyChoice[]).map((d) => (
          <Chip key={d} value={d} current={params.difficulty} onSelect={(v) => setParams({ difficulty: v })} testId={`diff-${d}`}>
            {d === 'any' ? 'Any' : `${DIFFICULTY_ICON[d]} ${DIFFICULTY_LABEL[d]}`}
          </Chip>
        ))}
      </div>

      <div className="label">How far? (drive)</div>
      <div className="chips" role="group" aria-label="Maximum drive">
        {([30, 60, 90, null] as DriveLimit[]).map((d) => (
          <Chip key={String(d)} value={d} current={params.maxDrive} onSelect={(v) => setParams({ maxDrive: v })} testId={`drive-${d ?? 'any'}`}>
            {d == null ? 'Anywhere' : `< ${d} min`}
          </Chip>
        ))}
      </div>
      <p className="dim" style={{ marginTop: 8 }}>
        From <b>{home.label}</b>
        {home.isDefault ? (
          <>
            {' '}
            · <a href={href.settings}>set your home</a>
          </>
        ) : null}
      </p>

      <button type="button" className="cta" onClick={find} data-testid="find">
        Find my ride
      </button>

      <div ref={resultsRef} style={{ scrollMarginTop: 12 }}>
        {searched && <Results data={data} date={params.date} today={today} />}
      </div>
    </>
  );
}

function Results({ data, date, today }: { data: RideData; date: string; today: string }) {
  if (data.loading || !data.output) {
    return (
      <div aria-busy="true" aria-live="polite">
        <div className="label">Checking weather & drive times…</div>
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    );
  }
  const { results, excluded } = data.output;
  const title = `Top rides · ${formatDateLabel(date, today)}`;
  const anyRouted = Object.values(data.drives).some((d) => d.method === 'routed');
  return (
    <div data-testid="results">
      <div className="label" style={{ marginTop: 28 }}>
        {title}
      </div>
      {data.weatherErrors > 0 && (
        <div className="notice bad" role="status">
          Weather unavailable for {data.weatherErrors === results.length + excluded.length ? 'all areas' : `${data.weatherErrors} area(s)`}. Those areas show ⚪ UNKNOWN. RIDEOUT
          won’t guess.
        </div>
      )}
      {!anyRouted && Object.keys(data.drives).length > 0 && (
        <div className="notice info" role="status">
          Routing unavailable. Drive times are rough straight-line estimates.
        </div>
      )}
      {results.length === 0 ? (
        <div className="notice" data-testid="no-results">
          <b>No rides match.</b> Nothing fits that difficulty and drive limit. Try <b>Any</b> difficulty or a longer drive.
          {excluded.length > 0 && (
            <ul className="small">
              {excluded.slice(0, 5).map((e) => (
                <li key={e.area.id}>
                  {e.area.name}: {e.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <ol className="results">
          {results.map((r, i) => (
            <li key={r.area.id}>
              <ResultRow r={r} rank={i + 1} />
            </li>
          ))}
        </ol>
      )}
      {results.length > 0 && excluded.length > 0 && (
        <p className="dim">
          {excluded.length} area{excluded.length > 1 ? 's' : ''} filtered out by difficulty or drive time.
        </p>
      )}
    </div>
  );
}

function ResultRow({ r, rank }: { r: Recommendation; rank: number }) {
  const w = r.window?.window;
  return (
    <a className="result" href={href.area(r.area.id)} data-testid={`result-${r.area.id}`}>
      <div className="row between">
        <StatusBadge status={r.status} />
        <span className="rank">#{rank}</span>
      </div>
      <div className="name">{r.area.name}</div>
      <div className="meta">
        {r.ride ? (
          r.ride.distanceMi != null ? (
            <>
              {fmtMi(r.ride.distanceMi)} · {fmtFt(r.ride.gainFt)} · {r.ride.name}
            </>
          ) : (
            <>{r.ride.name} · length not on file</>
          )
        ) : (
          'No signature ride on file'
        )}
      </div>
      <div className="tags">
        {r.drive && (
          <span className="pill">
            🚗 {Math.round(r.drive.minutes)} min{r.drive.method === 'estimate' ? ' (est.)' : ''}
          </span>
        )}
        {w && <span className="pill">⏱ {formatClock(w.start)}–{formatClock(w.end)}</span>}
        {r.itinerary && <span className="pill">🏠 {formatDuration(r.itinerary.totalMin)} total</span>}
        {r.mud.level !== 'unknown' && <span className="pill">Mud: {r.mud.level}</span>}
      </div>
      <div className="why">
        <b>{r.status === 'send' || r.status === 'worth' ? 'WHY' : 'WHY NOT'}:</b> {r.headline}
      </div>
    </a>
  );
}
