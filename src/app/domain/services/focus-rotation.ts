import { daysBetween, LocalDate } from '../core/local-date';
import { loadsLower, loadsUpper, SessionFocus, TrainingGoal } from '../models/training';

const GENERAL: readonly SessionFocus[] = ['fullBody', 'upperBody', 'lowerBody', 'conditioning'];
const ENDURANCE: readonly SessionFocus[] = [
  'conditioning',
  'fullBody',
  'conditioning',
  'coreAndMobility',
];
const STRENGTH: readonly SessionFocus[] = ['lowerBody', 'upperBody', 'fullBody'];

/**
 * Assigns a {@link SessionFocus} to each exercise day of a Season.
 *
 * The rotation cycles through a goal-specific sequence, but whenever two
 * exercise days are consecutive it avoids loading the same region hard on
 * both, respecting the ~48 h recovery guideline for a muscle group.
 */
export class FocusRotation {
  assign(days: readonly LocalDate[], goal: TrainingGoal): SessionFocus[] {
    const cycle = goal === 'endurance' ? ENDURANCE : goal === 'strength' ? STRENGTH : GENERAL;
    const result: SessionFocus[] = [];
    let cursor = 0;
    for (let i = 0; i < days.length; i++) {
      const previous = i === 0 ? null : result[i - 1];
      const consecutive = i > 0 && Math.abs(daysBetween(days[i - 1], days[i])) <= 1;
      let candidate = cycle[cursor % cycle.length];
      cursor++;
      if (consecutive && previous !== null && conflicts(previous, candidate)) {
        candidate = alternative(previous);
      }
      result.push(candidate);
    }
    return result;
  }
}

function conflicts(a: SessionFocus, b: SessionFocus): boolean {
  return (loadsUpper(a) && loadsUpper(b)) || (loadsLower(a) && loadsLower(b));
}

function alternative(previous: SessionFocus): SessionFocus {
  switch (previous) {
    case 'upperBody':
      return 'lowerBody';
    case 'lowerBody':
      return 'upperBody';
    case 'fullBody':
      return 'coreAndMobility';
    default:
      return 'fullBody';
  }
}
