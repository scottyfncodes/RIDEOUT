export interface Region {
  id: string;
  name: string;
  timezone: string;
  center: [number, number];
  zoom: number;
}

export const REGIONS: Region[] = [
  { id: 'colorado', name: 'Colorado — Front Range', timezone: 'America/Denver', center: [39.72, -105.28], zoom: 9 },
];

export const DEFAULT_REGION = REGIONS[0];

export interface HomePreset {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

/** Town-centre coordinates used as a starting point when the user hasn't set a home. */
export const HOME_PRESETS: HomePreset[] = [
  { id: 'denver', name: 'Denver (downtown)', lat: 39.7392, lon: -104.9903 },
  { id: 'boulder', name: 'Boulder', lat: 40.015, lon: -105.2705 },
  { id: 'golden', name: 'Golden', lat: 39.7555, lon: -105.2211 },
  { id: 'lakewood', name: 'Lakewood', lat: 39.7047, lon: -105.0814 },
  { id: 'arvada', name: 'Arvada', lat: 39.8028, lon: -105.0875 },
  { id: 'littleton', name: 'Littleton', lat: 39.6133, lon: -105.0166 },
  { id: 'longmont', name: 'Longmont', lat: 40.1672, lon: -105.1019 },
  { id: 'evergreen', name: 'Evergreen', lat: 39.6333, lon: -105.3172 },
  { id: 'fort-collins', name: 'Fort Collins', lat: 40.5853, lon: -105.0844 },
  { id: 'colorado-springs', name: 'Colorado Springs', lat: 38.8339, lon: -104.8214 },
];
