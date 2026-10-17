import { DistanceKind } from '../models/scoring';
import { Exercise, takesLoad } from './exercise';
import { MeasurementType } from './taxonomy';

/** What the set logger asks for on each set. */
export const LOG_TRACKS = ['reps', 'time', 'distance'] as const;
export type LogTrack = (typeof LOG_TRACKS)[number];

/**
 * Anything a Peach can log: a catalog exercise or a custom exercise from one
 * of their Crates' libraries. The set logger and the log page only need
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
