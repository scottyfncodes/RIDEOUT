import { useState, type ReactNode } from 'react';
import { EMPTY_BIKE, sanitizeBike, type Bike, type BikeType, type WheelSize } from '../engine/garage';
import { href } from '../hooks/useRoute';
import { useStore } from '../state/store';
import { Chip } from '../components/ui';

type Form = Record<keyof Bike, string>;

const toForm = (b: Bike): Form =>
  Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v == null ? '' : typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v)])) as Form;

function fromForm(f: Form): Bike | null {
  const yn = (v: string) => (v === 'yes' ? true : v === 'no' ? false : null);
  return sanitizeBike({ ...f, tubeless: yn(f.tubeless), dropper: yn(f.dropper) });
}

/** One editor, one saved bike, reached from Garage and from Setup. */
export function BikeEditor({ from }: { from: 'garage' | 'settings' }) {
  const { bike, setBike } = useStore();
  const [f, setF] = useState<Form>(() => toForm(bike ?? EMPTY_BIKE));
  const set = (k: keyof Bike) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const back = from === 'settings' ? href.settings : href.garage;
  const parsed = fromForm(f);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed) return;
    setBike(parsed);
    location.hash = back;
  };
  const remove = () => {
    if (confirm('Remove this bike from RIDEOUT?')) {
      setBike(null);
      location.hash = back;
    }
  };

  return (
    <form onSubmit={save} data-testid="bike-form" noValidate>
      <a className="back" href={back}>
        ← {from === 'settings' ? 'Setup' : 'Garage'}
      </a>
      <h1 className="display" style={{ fontSize: 40, margin: '4px 0 2px' }}>
        {bike ? 'Edit bike' : 'My bike'}
      </h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Only a name is needed. Everything else is optional.
      </p>

      <div className="label">The essentials</div>
      <Text label="Bike name" id="nickname" value={f.nickname} onChange={set('nickname')} placeholder="e.g. Trail Bike" required />
      <Row label="Type">
        {(['mtb', 'emtb'] as BikeType[]).map((t) => (
          <Chip key={t} small value={t} current={f.type as BikeType} onSelect={set('type')} testId={`type-${t}`}>
            {t === 'mtb' ? 'MTB' : 'e-MTB'}
          </Chip>
        ))}
      </Row>
      <Row label="Wheels">
        {(['29', '27.5', 'mullet', 'other'] as WheelSize[]).map((w) => (
          <Chip key={w} small value={w} current={f.wheel} onSelect={(v) => set('wheel')(f.wheel === v ? '' : v)} testId={`wheel-${w}`}>
            {w === 'mullet' ? 'Mullet' : w === 'other' ? 'Other' : `${w}″`}
          </Chip>
        ))}
      </Row>
      <div className="grid2">
        <Num label="Front travel (mm)" id="frontTravelMm" value={f.frontTravelMm} onChange={set('frontTravelMm')} />
        <Num label="Rear travel (mm)" id="rearTravelMm" value={f.rearTravelMm} onChange={set('rearTravelMm')} />
      </div>
      <Row label="Tubeless">
        <YesNo value={f.tubeless} onChange={set('tubeless')} id="tubeless" />
      </Row>
      <div className="grid2">
        <Num label="Front PSI (usual)" id="frontPsi" value={f.frontPsi} onChange={set('frontPsi')} step="0.5" />
        <Num label="Rear PSI (usual)" id="rearPsi" value={f.rearPsi} onChange={set('rearPsi')} step="0.5" />
      </div>

      <details className="more" open={!!(f.make || f.model || f.tireSize || f.brakes || f.drivetrain || f.suspensionNotes || f.weightLb || f.dropper)}>
        <summary>More details (optional)</summary>
        <div className="grid2">
          <Text label="Make" id="make" value={f.make} onChange={set('make')} placeholder="e.g. Yeti" />
          <Text label="Model" id="model" value={f.model} onChange={set('model')} placeholder="e.g. SB140" />
        </div>
        <Text label="Tire size" id="tireSize" value={f.tireSize} onChange={set('tireSize')} placeholder='e.g. 29 × 2.4"' />
        <Row label="Dropper post">
          <YesNo value={f.dropper} onChange={set('dropper')} id="dropper" />
        </Row>
        <Text label="Brakes" id="brakes" value={f.brakes} onChange={set('brakes')} placeholder="e.g. SRAM Code, 4-piston" />
        <Text label="Drivetrain" id="drivetrain" value={f.drivetrain} onChange={set('drivetrain')} placeholder="e.g. Shimano XT 12-speed" />
        <Text label="Suspension setup" id="suspensionNotes" value={f.suspensionNotes} onChange={set('suspensionNotes')} placeholder="e.g. 30% sag, 2 tokens, 8 clicks rebound" />
        <Num label="Approx. weight (lb)" id="weightLb" value={f.weightLb} onChange={set('weightLb')} step="0.5" />
      </details>

      <button type="submit" className="cta" disabled={!parsed} data-testid="save-bike" style={parsed ? undefined : { opacity: 0.5 }}>
        Save bike
      </button>
      {!parsed && <p className="dim">Give it a name to save.</p>}
      {bike && (
        <button type="button" className="btn block" style={{ marginTop: 12 }} onClick={remove} data-testid="remove-bike">
          Remove bike
        </button>
      )}
      <p className="dim small">Stored only on this device. No account.</p>
    </form>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="chips" role="group" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

function YesNo({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <>
      {['yes', 'no'].map((v) => (
        <Chip key={v} small value={v} current={value} onSelect={(x) => onChange(value === x ? '' : x)} testId={`${id}-${v}`}>
          {v === 'yes' ? 'Yes' : 'No'}
        </Chip>
      ))}
    </>
  );
}

function Text(p: { label: string; id: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div className="field">
      <label htmlFor={`bike-${p.id}`}>
        {p.label}
        {p.required && <span className="dim"> · needed</span>}
      </label>
      <input id={`bike-${p.id}`} type="text" value={p.value} placeholder={p.placeholder} onChange={(e) => p.onChange(e.target.value)} autoComplete="off" />
    </div>
  );
}

function Num(p: { label: string; id: string; value: string; onChange: (v: string) => void; step?: string }) {
  return (
    <div className="field">
      <label htmlFor={`bike-${p.id}`}>{p.label}</label>
      <input id={`bike-${p.id}`} type="number" inputMode="decimal" min={0} step={p.step ?? '1'} value={p.value} onChange={(e) => p.onChange(e.target.value)} />
    </div>
  );
}
