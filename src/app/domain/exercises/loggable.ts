import { DistanceKind } from '../models/scoring';
import { Exercise, takesLoad } from './exercise';
import { MeasurementType } from './taxonomy';

/** What the set logger asks for on each set. */
export const LOG_TRACKS = ['reps', 'time', 'distance'] as const;
export type LogTrack = (typeof LOG_TRACKS)[number];

/**
 * Anything a Peach can log: a catalog exercise or a custom one, made up while
 * logging or shared by a crate-mate. The set logger and the log page only need
 * this much, so both kinds are handled alike.
 */
export interface LoggableExercise {
  readonly id: string;
  readonly name: string;
  /** reps: reps per set; time: seconds per set; distance: distance and time per set. */
  readonly track: LogTrack;
  /** Whether each set records the weight used. */
  readonly takesLoad: boolean;
  /** Which distance category metres count toward; null when distance doesn't score. */
  readonly distanceKind: DistanceKind | null;
  readonly cues: string | null;
}

/**
 * The distance category of a catalog exercise. Only locomotion scores
 * distance; the equipment tells a ride from a swim or row, and everything
 * on foot (outdoors or on a treadmill) is running and walking. Carries and
 * crawls are measured in metres but are not travel, so they score through
 * reps, weight and time instead.
 */
export function distanceKindOf(e: Exercise): DistanceKind | null {
  if (e.pattern !== 'locomotion') return null;
  const has = (...equipment: Exercise['equipment']) =>
    e.equipment.some((x) => equipment.includes(x));
  if (has('bicycle', 'stationaryBike')) return 'ride';
  if (has('rowingMachine', 'pool')) return 'swimRow';
  if (has('treadmill')) return 'runWalk';
  if (e.equipment.length === 0 && /walk|jog|run|sprint|hike/i.test(e.id)) return 'runWalk';
  return null;
}

/** How a measurement and distance kind are logged. */
export function trackFor(
  measurement: MeasurementType,
  distanceKind: DistanceKind | null,
): LogTrack {
  // Cardio that can travel always logs distance and time, whatever its
  // catalog measurement (a steady bike is "duration" but kilometres score).
  if (distanceKind !== null || measurement === 'distance') return 'distance';
  return measurement === 'duration' ? 'time' : 'reps';
}

export function loggableFromCatalog(e: Exercise): LoggableExercise {
  const distanceKind = distanceKindOf(e);
  return {
    id: e.id,
    name: e.name,
    track: trackFor(e.measurement, distanceKind),
    takesLoad: takesLoad(e),
    distanceKind,
    cues: e.cues,
  };
}

/** Custom exercise ids carry a prefix so they can never collide with catalog slugs. */
export const CUSTOM_EXERCISE_PREFIX = 'custom-';

/** Longest name a made-up exercise can have. */
export const MAX_CUSTOM_NAME = 60;

/**
 * An exercise a Peach made up while logging ("Rucking", "Reservoir hill
 * loop"). How it is logged decides how it scores, exactly like a catalog
 * exercise: only reps take a load, and only distance has a distance kind.
 */
export function customExercise(args: {
  id: string;
  name: string;
  track: LogTrack;
  takesLoad?: boolean;
  distanceKind?: DistanceKind | null;
}): LoggableExercise {
  const name = args.name.trim();
  if (!name) throw new RangeError('Give the exercise a name.');
  if (name.length > MAX_CUSTOM_NAME) {
    throw new RangeError(`Keep the name under ${MAX_CUSTOM_NAME} characters.`);
  }
  return {
    id: `${CUSTOM_EXERCISE_PREFIX}${args.id}`,
    name,
    track: args.track,
    takesLoad: args.track === 'reps' && (args.takesLoad ?? false),
    distanceKind: args.track === 'distance' ? (args.distanceKind ?? null) : null,
    cues: null,
  };
}
