import type { RidingArea } from '../types';
import { frontRangeAreas } from './frontRange';

/** Add new region packs here. Each must export RidingArea[]. */
export const ALL_AREAS: RidingArea[] = [...frontRangeAreas];

export function getArea(id: string): RidingArea | undefined {
  return ALL_AREAS.find((a) => a.id === id);
}
