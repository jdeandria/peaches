import {
  dateTimeFromJson,
  dateTimeToJson,
  enumFromJson,
  JsonMap,
  requireString,
  stringOrNull,
} from '../core/json';
import { LOG_TRACKS, LoggableExercise } from '../exercises/loggable';
import { distanceKindFromJson, WorkoutLog } from './workout-log';

/**
 * An exercise a member has logged, as their Crate sees it: shared
 * automatically whenever a log is, tagged with who it came from, so
 * crate-mates can log it too (including exercises someone made up).
 * There is one per exercise per member, rewritten whenever they share it.
 */
export interface SharedExercise {
  readonly crateId: string;
  readonly peachId: string;
  readonly exercise: Omit<LoggableExercise, 'cues'>;
  readonly lastLoggedAt: Date;
}

/** Document key: one per exercise per member, so sharing never conflicts. */
export function sharedExerciseKey(exerciseId: string, peachId: string): string {
  return `${exerciseId}__${peachId}`;
}

/** What sharing `log` tells each of its Crates about the exercises in it. */
export function sharedExercisesOf(log: WorkoutLog): SharedExercise[] {
  return log.sharedWith.flatMap((crateId) =>
    log.entries.map((e) => ({
      crateId,
      peachId: log.peachId,
      exercise: {
        id: e.exerciseId,
        name: e.exerciseName,
        track: e.track,
        takesLoad: e.takesLoad,
        distanceKind: e.distanceKind,
      },
      lastLoggedAt: log.startedAt,
    })),
  );
}

export function sharedExerciseFromJson(json: JsonMap): SharedExercise {
  const id = requireString(json['exerciseId'], 'exerciseId');
  return {
    crateId: requireString(json['crateId'], 'crateId'),
    peachId: requireString(json['peachId'], 'peachId'),
    exercise: {
      id,
      name: stringOrNull(json['name']) ?? id,
      track: enumFromJson(LOG_TRACKS, json['track'], 'reps'),
      takesLoad: json['takesLoad'] === true,
      distanceKind: distanceKindFromJson(json['distanceKind']),
    },
    lastLoggedAt: dateTimeFromJson(json['lastLoggedAt']),
  };
}

export function sharedExerciseToJson(s: SharedExercise): JsonMap {
  return {
    crateId: s.crateId,
    peachId: s.peachId,
    exerciseId: s.exercise.id,
    name: s.exercise.name,
    track: s.exercise.track,
    takesLoad: s.exercise.takesLoad,
    distanceKind: s.exercise.distanceKind,
    lastLoggedAt: dateTimeToJson(s.lastLoggedAt),
  };
}
