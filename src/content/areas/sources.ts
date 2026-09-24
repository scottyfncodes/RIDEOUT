import type { Source } from '../types';

/** Date the seeded content was last reviewed. Update when a human re-checks sources. */
export const CHECKED = '2026-09-23';

export const editorial = (note = 'RIDEOUT editorial rating from agency descriptions and rider reports'): Source => ({
  label: note,
  confidence: 'editorial',
  checked: CHECKED,
});

export const official = (label: string, url: string): Source => ({ label, url, confidence: 'official', checked: CHECKED });
export const reported = (label: string, url: string): Source => ({ label, url, confidence: 'reported', checked: CHECKED });

export const COTREX = 'https://trails.colorado.gov/';
