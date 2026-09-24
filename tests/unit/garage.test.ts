import {
  EMPTY_BIKE,
  bikeSummary,
  bikeTitle,
  daysSince,
  hasBike,
  loadBike,
  loadChecklist,
  loadMaintenance,
  sanitizeBike,
  sanitizeMaintenance,
  saveBike,
  saveChecklist,
  saveMaintenance,
  type Bike,
} from '../../src/engine/garage';
import { CHECKLIST, PREP_CHECKS, TRAILSIDE, TRAILSIDE_ESCALATION } from '../../src/content/garage';

const trailBike: Bike = { ...EMPTY_BIKE, nickname: 'Trail Bike', wheel: '29', frontTravelMm: 150, rearTravelMm: 140, tubeless: true, frontPsi: 23, rearPsi: 25 };

describe('bike profile', () => {
  beforeEach(() => localStorage.clear());

  it('empty state: no bike saved yet', () => {
    expect(loadBike()).toBeNull();
  });
  it('creates, saves and reloads a bike', () => {
    saveBike(trailBike);
    expect(loadBike()).toEqual(trailBike);
  });
  it('edits an existing bike', () => {
    saveBike(trailBike);
    saveBike({ ...loadBike()!, rearPsi: 26, brakes: 'SRAM Code' });
    expect(loadBike()).toMatchObject({ nickname: 'Trail Bike', rearPsi: 26, brakes: 'SRAM Code' });
  });
  it('a name alone is a valid bike; every other field is optional', () => {
    const b = sanitizeBike({ nickname: 'Hardtail' })!;
    expect(b).not.toBeNull();
    expect(b.tubeless).toBeNull();
    expect(b.frontPsi).toBeNull();
    expect(bikeTitle(b)).toBe('Hardtail');
    expect(bikeSummary(b)).toEqual([]);
  });
  it('make/model can stand in for a name', () => {
    const b = sanitizeBike({ make: 'Yeti', model: 'SB140' })!;
    expect(bikeTitle(b)).toBe('Yeti SB140');
  });
  it('a bike with no name, make or model is not saved', () => {
    expect(sanitizeBike({ frontPsi: 22 })).toBeNull();
    saveBike({ ...EMPTY_BIKE, frontPsi: 22 });
    expect(loadBike()).toBeNull();
  });
  it('removing the bike clears storage', () => {
    saveBike(trailBike);
    saveBike(null);
    expect(loadBike()).toBeNull();
  });
  it('sanitises corrupt or out-of-range stored values', () => {
    localStorage.setItem('rideout:bike:v1', JSON.stringify({ nickname: '  Enduro  ', type: 'moped', wheel: '26', frontPsi: 900, rearPsi: '24', tubeless: 'yes', weightLb: -3 }));
    expect(loadBike()).toMatchObject({ nickname: 'Enduro', type: 'mtb', wheel: null, frontPsi: null, rearPsi: 24, tubeless: null, weightLb: null });
    localStorage.setItem('rideout:bike:v1', '{broken');
    expect(loadBike()).toBeNull();
  });
  it('summarises specs for the bike card', () => {
    expect(bikeSummary(trailBike)).toEqual(['29″', '150 / 140mm', 'Tubeless']);
    expect(bikeSummary({ ...trailBike, type: 'emtb', wheel: 'mullet', rearTravelMm: null, tubeless: false })).toEqual(['e-MTB', 'Mullet', '150mm fork', 'Tubes']);
    expect(hasBike(null)).toBe(false);
  });
});

describe('pre-ride checklist', () => {
  beforeEach(() => localStorage.clear());
  it('keeps ticks for today', () => {
    saveChecklist('2026-09-24', ['pressure', 'brakes']);
    expect(loadChecklist('2026-09-24')).toEqual(['pressure', 'brakes']);
  });
  it('resets on a new day and keeps no history', () => {
    saveChecklist('2026-09-24', ['pressure']);
    expect(loadChecklist('2026-09-25')).toEqual([]);
  });
  it('clearing all ticks removes the stored entry', () => {
    saveChecklist('2026-09-24', ['pressure']);
    saveChecklist('2026-09-24', []);
    expect(localStorage.getItem('rideout:checklist:v1')).toBeNull();
  });
  it('items adapt to the bike: sealant hidden with tubes, battery only for e-MTB', () => {
    const ids = (b: Bike | null) => CHECKLIST.filter((i) => !i.appliesTo || i.appliesTo(b)).map((i) => i.id);
    expect(ids(null)).toContain('sealant');
    expect(ids(null)).not.toContain('battery');
    expect(ids({ ...trailBike, tubeless: false })).not.toContain('sealant');
    expect(ids({ ...trailBike, type: 'emtb' })).toContain('battery');
    expect(ids({ ...trailBike, dropper: false })).not.toContain('dropper');
  });
});

describe('maintenance', () => {
  beforeEach(() => localStorage.clear());
  it('records and reloads service dates and notes', () => {
    saveMaintenance({ entries: { brakes: { date: '2026-06-01' } }, notes: 'Rear brake soft' });
    expect(loadMaintenance()).toEqual({ entries: { brakes: { date: '2026-06-01' } }, notes: 'Rear brake soft' });
  });
  it('drops invalid dates and unknown kinds', () => {
    expect(sanitizeMaintenance({ entries: { brakes: { date: 'last spring' }, frame: { date: '2026-01-01' }, tires: { date: '2026-05-05' } } })).toEqual({
      entries: { tires: { date: '2026-05-05' } },
      notes: null,
    });
    expect(sanitizeMaintenance(null)).toEqual({ entries: {}, notes: null });
  });
  it('computes days since a service', () => {
    expect(daysSince('2026-09-01', '2026-09-24')).toBe(23);
    expect(daysSince(null, '2026-09-24')).toBeNull();
    expect(daysSince('2026-10-01', '2026-09-24')).toBeNull();
  });
});

describe('garage content', () => {
  it('every trailside guide ends with a clear escalation', () => {
    expect(TRAILSIDE_ESCALATION).toMatch(/stop riding/i);
    for (const g of TRAILSIDE) expect(g.steps.length).toBeGreaterThan(1);
    expect(TRAILSIDE.map((g) => g.id)).toEqual(expect.arrayContaining(['flat', 'broken-chain', 'dropped-chain', 'brakes', 'shifting', 'loose', 'tubeless']));
  });
  it('prep checks never state a pressure number', () => {
    for (const t of Object.values(PREP_CHECKS)) expect(t).not.toMatch(/\d+\s*psi/i);
  });
});
