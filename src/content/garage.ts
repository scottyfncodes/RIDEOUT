import type { Bike } from '../engine/garage';

/**
 * Garage content as data: checklist items, the catalogue of prep checks the
 * Bike Prep engine can suggest, and trailside-help cards.
 *
 * All of this is GENERAL rider guidance: common practice, not a mechanical
 * inspection or professional service advice. The UI labels it that way.
 */

export interface ChecklistItem {
  id: string;
  label: string;
  hint: string;
  /** Hide the item when it clearly doesn't apply to the saved bike. */
  appliesTo?: (bike: Bike | null) => boolean;
}

export const CHECKLIST: ChecklistItem[] = [
  { id: 'pressure', label: 'Tire pressure', hint: 'Check with a gauge, not a thumb squeeze.' },
  { id: 'tires', label: 'Tire condition', hint: 'Look for cuts, torn knobs or exposed casing.' },
  { id: 'brakes', label: 'Brake feel', hint: 'Levers firm, not touching the bar. Pads not worn thin.' },
  { id: 'drivetrain', label: 'Chain & drivetrain', hint: 'Chain lubed, shifts clean through the range.' },
  { id: 'suspension', label: 'Suspension', hint: 'Sag and pressures where you like them. No new leaks or noises.' },
  { id: 'wheels', label: 'Wheels & spokes', hint: 'Axles tight, no loose spokes, wheels spin true.' },
  { id: 'bolts', label: 'Cockpit & major bolts', hint: 'Stem, bar, seatpost and axles snug.' },
  { id: 'dropper', label: 'Dropper operation', hint: 'Drops and returns fully.', appliesTo: (b) => b?.dropper !== false },
  { id: 'sealant', label: 'Tubeless sealant & plugs', hint: 'Sealant topped up in the last few months. Plugs in the pack.', appliesTo: (b) => b?.tubeless !== false },
  { id: 'battery', label: 'Battery charged', hint: 'Charged, and the charge covers the ride.', appliesTo: (b) => b?.type === 'emtb' },
  { id: 'kit', label: 'Water & repair kit', hint: 'Pump, tool, spare tube or plugs, quick link.' },
];

export type PrepCheckId =
  | 'pressure'
  | 'tires'
  | 'brakes'
  | 'pads'
  | 'drivetrain'
  | 'sealant'
  | 'tube'
  | 'kit'
  | 'battery'
  | 'clean';

/** Catalogue of prep checks. Text is written for the Area-profile Bike Prep panel. */
export const PREP_CHECKS: Record<PrepCheckId, string> = {
  pressure: 'Check tire pressure',
  tires: 'Check tire condition',
  brakes: 'Check brake feel',
  pads: 'Consider checking brake pad wear',
  drivetrain: 'Check chain lube & shifting',
  sealant: 'Check tubeless sealant, carry plugs',
  tube: 'Carry a spare tube and levers',
  kit: 'Bring a basic repair kit',
  battery: 'Charge the battery for the full ride',
  clean: 'Plan to clean & lube the drivetrain after',
};

export interface TrailsideGuide {
  id: string;
  title: string;
  icon: string;
  steps: string[];
}

export const TRAILSIDE_ESCALATION = 'If you can’t safely fix it, stop riding and arrange help. Walking out is always an option.';

export const TRAILSIDE: TrailsideGuide[] = [
  {
    id: 'flat',
    title: 'Flat tire',
    icon: '🛞',
    steps: [
      'Get off the trail. Find the leak by spinning the wheel and listening or feeling for air.',
      'Tubeless: rotate the hole to the bottom so sealant can reach it, then re-inflate. If it won’t seal, plug it.',
      'Still leaking, or a big sidewall cut: put a tube in. Check the inside of the tire for thorns first.',
      'Re-inflate and check the bead is seated before you ride.',
    ],
  },
  {
    id: 'dropped-chain',
    title: 'Dropped chain',
    icon: '⛓️',
    steps: [
      'Shift to a middle gear.',
      'Lift the chain back onto the chainring by hand, then turn the pedals backward slowly.',
      'If it keeps dropping, check for a bent chainring or a loose chain guide.',
    ],
  },
  {
    id: 'broken-chain',
    title: 'Broken chain',
    icon: '🔗',
    steps: [
      'Collect the chain and find the broken link.',
      'Use a chain tool to push out the damaged link or links.',
      'Rejoin with a quick link that matches your drivetrain speed.',
      'A shorter chain can’t reach the biggest cogs. Avoid them on the way out.',
    ],
  },
  {
    id: 'brakes',
    title: 'Brake problem',
    icon: '🛑',
    steps: [
      'Soft or spongy lever, or it pulls to the bar: stop riding downhill on that brake.',
      'Rubbing: check the wheel is seated and the axle is tight. A bent rotor can sometimes be gently trued by hand.',
      'Contaminated pads (squealing, no bite) can’t be fixed trailside. Descend slowly or walk.',
    ],
  },
  {
    id: 'shifting',
    title: 'Shifting problem',
    icon: '⚙️',
    steps: [
      'Check the derailleur and hanger aren’t visibly bent. A bent hanger can put the derailleur in the spokes.',
      'Skipping or ghost-shifting: a small barrel-adjuster turn often helps.',
      'If the hanger is badly bent, pick one gear that works and single-speed home.',
    ],
  },
  {
    id: 'loose',
    title: 'Loose component',
    icon: '🔩',
    steps: [
      'Find the source of the rattle or play: axles, stem, headset, bar, seatpost, pedals.',
      'Snug it with your multitool. Don’t over-tighten carbon parts.',
      'A loose headset or cracked part means it’s time to ride out gently.',
    ],
  },
  {
    id: 'tubeless',
    title: 'Tubeless problem',
    icon: '💧',
    steps: [
      'Burped tire: re-inflate, then check the bead is seated all the way round.',
      'Sealant spraying from a hole: rotate it to the bottom and wait. Plug it if it doesn’t seal.',
      'Valve leaking: tighten the valve core and lock nut.',
      'If nothing holds, put a tube in.',
    ],
  },
];
