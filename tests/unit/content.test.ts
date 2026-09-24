import { ALL_AREAS } from '../../src/content/areas';
import { DIFFICULTY_ORDER } from '../../src/content/types';

describe('seed content integrity (no invented data)', () => {
  it('has unique ids and plausible Colorado coordinates', () => {
    const ids = new Set(ALL_AREAS.map((a) => a.id));
    expect(ids.size).toBe(ALL_AREAS.length);
    for (const a of ALL_AREAS) {
      expect(a.trailhead.lat).toBeGreaterThan(37);
      expect(a.trailhead.lat).toBeLessThan(41);
      expect(a.trailhead.lon).toBeGreaterThan(-109);
      expect(a.trailhead.lon).toBeLessThan(-102);
    }
  });
  it('every signature ride with numbers has a source with a URL', () => {
    for (const a of ALL_AREAS)
      for (const r of a.rides) {
        if (r.distanceMi != null || r.gainFt != null) {
          expect(r.source, `${a.id}/${r.id}`).not.toBeNull();
          expect(r.source!.url, `${a.id}/${r.id}`).toMatch(/^https:\/\//);
        }
      }
  });
  it('network miles are either null or sourced', () => {
    for (const a of ALL_AREAS) if (a.networkMiles != null) expect(a.networkMilesSource, a.id).not.toBeNull();
  });
  it('character ratings are labelled editorial and within 0..4', () => {
    for (const a of ALL_AREAS) {
      expect(a.characterSource.confidence).toBe('editorial');
      for (const v of Object.values(a.character)) if (v != null) expect(v >= 0 && v <= 4).toBe(true);
    }
  });
  it('difficulty ranges are ordered', () => {
    for (const a of ALL_AREAS) expect(DIFFICULTY_ORDER.indexOf(a.difficultyRange[0])).toBeLessThanOrEqual(DIFFICULTY_ORDER.indexOf(a.difficultyRange[1]));
  });
  it('parking facts with values carry a source', () => {
    for (const a of ALL_AREAS) {
      const p = a.parking;
      if (p.fee || p.hours || p.availability) expect(p.source, a.id).not.toBeNull();
    }
  });
  it('every access rule has a source', () => {
    for (const a of ALL_AREAS) for (const r of a.access) expect(r.source.url, a.id).toMatch(/^https:\/\//);
  });
  it('all external links are https', () => {
    for (const a of ALL_AREAS) for (const l of Object.values(a.links)) if (l && l.startsWith('http')) expect(l).toMatch(/^https:\/\//);
  });
  it('seeds the 14 requested Front Range areas', () => {
    expect(ALL_AREAS.map((a) => a.id).sort()).toEqual(
      ['apex', 'betasso', 'buffalo-creek', 'floyd-hill', 'golden-gate', 'green-mountain', 'hall-ranch', 'heil-valley', 'marshall-mesa', 'maryland-mountain', 'north-table', 'staunton', 'walker-ranch', 'white-ranch'].sort(),
    );
  });
});
