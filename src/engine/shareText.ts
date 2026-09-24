import type { Rating } from '../content/types';
import type { Recommendation } from './recommend';
import { STATUS_META } from './status';
import { fmtFt, fmtMi } from '../utils/format';
import { formatClock } from '../utils/time';

const dot = (v: Rating) => (v == null ? '⚪' : ['🟢', '🟢', '🟡', '🟠', '🔴'][v]);

export function shareLines(r: Recommendation, dateLabel: string): string[] {
  const s = STATUS_META[r.status];
  const c = r.area.character;
  const lines = ['RIDEOUT', '', `🏔️ ${r.area.name.toUpperCase()} · ${dateLabel}`];
  if (r.ride) lines.push(`${r.ride.name}: ${fmtMi(r.ride.distanceMi)} · ${fmtFt(r.ride.gainFt)}`);
  lines.push('', `${s.emoji} ${s.label}`);
  if (r.window?.window) lines.push(`${formatClock(r.window.window.start)}–${formatClock(r.window.window.end)}`);
  lines.push('', `Technical ${dot(c.technical)}  Climbing ${dot(c.climbing)}`, `Flow ${dot(c.flow)}  Exposure ${dot(c.exposure)}`);
  if (r.itinerary?.apres) lines.push('', `🍺 Apres ${formatClock(r.itinerary.apres.arrive)} · ${r.itinerary.apres.name}`);
  if (r.itinerary) lines.push(`🚗 Leave ${formatClock(r.itinerary.leaveHome)} · home ${formatClock(r.itinerary.home)}`);
  const why = (r.status === 'send' || r.status === 'worth' ? r.why : r.whyNot).slice(0, 2).join(' ');
  if (why) lines.push('', `${r.status === 'send' || r.status === 'worth' ? 'WHY' : 'WHY NOT'}: ${why}`);
  lines.push('', 'Weather-based estimate. Check trail status before you go.');
  return lines;
}
