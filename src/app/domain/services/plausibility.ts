import { DistanceKind } from '../models/scoring';
import { ExerciseLogEntry } from '../models/workout-log';

/** Per-set ceilings: generous for real people, low enough to stop typos and tall tales. */
const MAX_REPS = 1000;
const MAX_LOAD_KG = 500;
const MAX_SECONDS = 6 * 3600;
/** Longest single set, in metres, by distance kind ('none' for untracked distance). */
const MAX_METERS: Readonly<Record<DistanceKind | 'none', number>> = {
  runWalk: 100_000,
  ride: 400_000,
  swimRow: 50_000,
  none: 10_000,
};
/** Fastest believable average speed, metres per second. */
const MAX_SPEED: Readonly<Record<DistanceKind | 'none', number>> = {
  runWalk: 10.5,
  ride: 25,
  swimRow: 7,
  none: 10.5,
};

/**
 * Checks an entry for numbers no Peach could have done. Logging is on the
 * honour system, but points are now raw totals, so a slipped finger ("50 km"
 * for "5 km") would decide a matchup. Returns why the entry was rejected,
 * or null when it looks fine.
 */
export function implausibility(entry: ExerciseLogEntry): string | null {
  const kind = entry.distanceKind ?? 'none';
  for (const [i, set] of entry.sets.entries()) {
    const where = `${entry.exerciseName}, set ${i + 1}`;
    const values = [set.reps, set.loadKg, set.seconds, set.meters];
    if (values.some((v) => v !== null && (!Number.isFinite(v) || v < 0))) {
      return `${where}: numbers can't be negative.`;
    }
    if ((set.reps ?? 0) > MAX_REPS) return `${where}: more than ${MAX_REPS} reps in one set?`;
    if ((set.loadKg ?? 0) > MAX_LOAD_KG) return `${where}: that weight looks too heavy.`;
    if ((set.seconds ?? 0) > MAX_SECONDS) return `${where}: one set can't last over 6 hours.`;
    const meters = set.meters ?? 0;
    if (meters > MAX_METERS[kind]) return `${where}: that distance looks too far for one set.`;
    if (meters > 0 && (set.seconds ?? 0) > 0 && meters / set.seconds! > MAX_SPEED[kind]) {
      return `${where}: that pace is faster than humanly possible.`;
    }
  }
  return null;
}
