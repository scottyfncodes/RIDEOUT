import { categorize, parseElements, buildAreaQuery } from '../../src/services/places/overpass';
import { apresOptions, bikeShopServices, nearestBrewery } from '../../src/engine/apres';
import { sanitizePrefs, loadPrefs, savePrefs, DEFAULT_PREFS } from '../../src/engine/prefs';
import { overpassArea } from '../fixtures/places';
import { parseHash } from '../../src/hooks/useRoute';
import { statusFromScore, capStatus } from '../../src/engine/status';

describe('places', () => {
  const places = parseElements(overpassArea(39.7, -105.2));
  it('categorises OSM tags', () => {
    expect(categorize({ craft: 'brewery' })).toContain('brewery');
    expect(categorize({ amenity: 'pub', name: 'Odd13 Brewing' })).toContain('brewery');
    expect(categorize({ amenity: 'restaurant', cuisine: 'mexican;tex-mex' })).toEqual(expect.arrayContaining(['food', 'mexican']));
    expect(categorize({ amenity: 'bank' })).toEqual([]);
  });
  it('parses nodes and way centers, dropping unusable elements', () => {
    expect(places).toHaveLength(5);
    expect(() => parseElements({})).toThrow();
  });
  it('filters apres by patio / dogs / open after ride', () => {
    const wed = 3;
    const all = apresOptions(places, 'brewery', { lat: 39.7, lon: -105.2 }, wed, 12 * 60);
    expect(all[0].open).toBe('open');
    expect(apresOptions(places, 'brewery', { lat: 39.7, lon: -105.2 }, wed, 12 * 60, { patio: true, dogs: true })).toHaveLength(1);
    expect(apresOptions(places, 'brewery', { lat: 39.7, lon: -105.2 }, wed, 23 * 60, { openAfterRide: true })).toHaveLength(0);
    expect(apresOptions(places, 'coffee', { lat: 39.7, lon: -105.2 }, wed, 12 * 60)[0].open).toBe('unknown');
  });
  it('only shows bike-shop services that are tagged', () => {
    const shop = places.find((p) => p.categories.includes('bike'))!;
    expect(bikeShopServices(shop.tags).map((s) => s.key)).toEqual(['repair', 'rental']);
    expect(bikeShopServices({})).toEqual([]);
  });
  it('finds the nearest brewery', () => {
    expect(nearestBrewery(places.filter((p) => p.categories.includes('brewery')), { lat: 39.7, lon: -105.2 })!.place.name).toBe('Trailside Brewing');
    expect(nearestBrewery([], { lat: 0, lon: 0 })).toBeNull();
  });
  it('overpass query is keyless and bounded', () => {
    const q = buildAreaQuery({ lat: 39.7, lon: -105.2 }, { lat: 39.75, lon: -105.22 });
    expect(q).toContain('[shop=bicycle]');
    expect(q).toContain('timeout:25');
  });
});

describe('preferences persistence', () => {
  beforeEach(() => localStorage.clear());
  it('round-trips through localStorage', () => {
    savePrefs({ ...DEFAULT_PREFS, likesFlow: true, maxDrive: 60 });
    expect(loadPrefs()).toMatchObject({ likesFlow: true, maxDrive: 60 });
  });
  it('sanitises corrupt stored values', () => {
    localStorage.setItem('rideout:prefs:v1', '{"maxDrive":45,"home":{"lat":"x"},"preferredDifficulty":"purple","gearUpMin":500}');
    const p = loadPrefs();
    expect(p.maxDrive).toBeNull();
    expect(p.home).toBeNull();
    expect(p.preferredDifficulty).toBe('any');
    expect(p.gearUpMin).toBe(60);
  });
  it('survives invalid JSON', () => {
    localStorage.setItem('rideout:prefs:v1', '{nope');
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
    expect(sanitizePrefs({})).toEqual(DEFAULT_PREFS);
  });
});

describe('routing + status helpers', () => {
  it('parses hash routes', () => {
    expect(parseHash('#/area/apex')).toEqual({ name: 'area', id: 'apex' });
    expect(parseHash('#/map')).toEqual({ name: 'map' });
    expect(parseHash('')).toEqual({ name: 'home' });
    expect(parseHash('#/garbage')).toEqual({ name: 'home' });
    expect(parseHash('#/garage')).toEqual({ name: 'garage' });
    expect(parseHash('#/garage/bike')).toEqual({ name: 'bike', from: 'garage' });
    expect(parseHash('#/garage/bike?from=settings')).toEqual({ name: 'bike', from: 'settings' });
  });
  it('maps scores to statuses and caps', () => {
    expect(statusFromScore(80)).toBe('send');
    expect(statusFromScore(60)).toBe('worth');
    expect(statusFromScore(45)).toBe('questionable');
    expect(statusFromScore(10)).toBe('skip');
    expect(capStatus('send', 'questionable')).toBe('questionable');
    expect(capStatus('skip', 'questionable')).toBe('skip');
    expect(capStatus('unknown', 'skip')).toBe('unknown');
  });
});
