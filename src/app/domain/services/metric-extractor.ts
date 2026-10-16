import { CategoryTotals, ZERO_TOTALS } from '../models/scoring';
import { WorkoutLog } from '../models/workout-log';

/**
 * Reduces a log to an amount per scoring category, from the set numbers
 * alone (so custom exercises score exactly like catalog ones):
 *
 * - distance: metres on entries with a distance kind, credited to that kind;
 * - weight moved: reps × load on every set;
 * - reps: every rep, loaded or not;
 * - active minutes: timed sets, or the session length the Peach reported if
 *   that is longer (so a yoga class with no timed sets still counts).
 */
export const MetricExtractor = {
  extract(log: WorkoutLog): CategoryTotals {
    const metres = { runWalk: 0, ride: 0, swimRow: 0 };
    let reps = 0;
    let kg = 0;
    let seconds = 0;
    for (const entry of log.entries) {
      for (const set of entry.sets) {
        const r = set.reps ?? 0;
        reps += r;
        kg += r * (set.loadKg ?? 0);
        seconds += set.seconds ?? 0;
        if (entry.distanceKind !== null) metres[entry.distanceKind] += set.meters ?? 0;
      }
    }
    return {
      ...ZERO_TOTALS,
      runWalk: metres.runWalk / 1000,
      ride: metres.ride / 1000,
      swimRow: metres.swimRow,
      weightMoved: kg,
      reps,
      activeMinutes: Math.max(seconds / 60, log.durationMinutes ?? 0),
    };
  },
} as const;
