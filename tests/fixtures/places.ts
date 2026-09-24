/** Minimal Overpass + OSRM fixtures. Coordinates are near the seeded trailheads. */

export function overpassArea(lat: number, lon: number) {
  return {
    elements: [
      { type: 'node', id: 1, lat: lat + 0.02, lon: lon + 0.02, tags: { shop: 'bicycle', name: 'Test Cyclery', opening_hours: 'Mo-Su 09:00-18:00', phone: '+1 303 555 0100', website: 'https://example.com', 'service:bicycle:repair': 'yes', 'service:bicycle:rental': 'yes' } },
      { type: 'node', id: 2, lat: lat + 0.03, lon: lon + 0.01, tags: { craft: 'brewery', amenity: 'pub', name: 'Trailside Brewing', opening_hours: 'Mo-Su 11:00-22:00', outdoor_seating: 'yes', dog: 'yes', food: 'yes' } },
      { type: 'node', id: 3, lat: lat + 0.04, lon: lon - 0.01, tags: { amenity: 'restaurant', cuisine: 'mexican', name: 'Taco Line', opening_hours: 'Tu-Su 11:00-21:00; Mo off' } },
      { type: 'node', id: 4, lat: lat + 0.01, lon: lon + 0.05, tags: { amenity: 'cafe', name: 'Summit Coffee' } },
      { type: 'way', id: 5, center: { lat: lat + 0.001, lon: lon + 0.001 }, tags: { amenity: 'parking', fee: 'no' } },
    ],
  };
}

export function overpassBreweries(points: Array<{ lat: number; lon: number }>) {
  return {
    elements: points.map((p, i) => ({ type: 'node', id: 1000 + i, lat: p.lat + 0.03, lon: p.lon + 0.02, tags: { craft: 'brewery', name: `Brewery ${i + 1}` } })),
  };
}

export function osrmTable(count: number, minutesEach: (i: number) => number) {
  const durations = [[0, ...Array.from({ length: count }, (_, i) => minutesEach(i) * 60)]];
  const distances = [[0, ...Array.from({ length: count }, (_, i) => minutesEach(i) * 60 * 15)]];
  return { code: 'Ok', durations, distances };
}
