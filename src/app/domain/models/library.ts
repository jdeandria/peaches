import {
  dateTimeFromJson,
  dateTimeToJson,
  enumFromJson,
  intOrNullFromJson,
  JsonMap,
  mapListFromJson,
  requireString,
  stringOrNull,
} from '../core/json';
import { LOG_TRACKS, LoggableExercise, LogTrack } from '../exercises/loggable';
import { DistanceKind } from './scoring';
import { distanceKindFromJson } from './workout-log';

/*
 * A Crate's library: the exercises and routines its members have collected
 * for one another. It is private to the Crate and only for discovery: any
 * exercise a Peach logs scores, whether or not it is in a library.
 */

/** A catalog exercise a member added to the Crate's library. */
export interface LibraryEntry {
  readonly crateId: string;
  readonly exerciseId: string;
  readonly addedBy: string;
  readonly addedAt: Date;
}

export function libraryEntryFromJson(json: JsonMap): LibraryEntry {
  return {
    crateId: requireString(json['crateId'], 'crateId'),
    exerciseId: requireString(json['exerciseId'], 'exerciseId'),
    addedBy: requireString(json['addedBy'], 'addedBy'),
    addedAt: dateTimeFromJson(json['addedAt']),
  };
}

export function libraryEntryToJson(e: LibraryEntry): JsonMap {
  return {
    crateId: e.crateId,
    exerciseId: e.exerciseId,
    addedBy: e.addedBy,
    addedAt: dateTimeToJson(e.addedAt),
  };
}

/** Custom exercise ids carry a prefix so they can never collide with catalog slugs. */
export const CUSTOM_EXERCISE_PREFIX = 'custom-';

export function isCustomExerciseId(id: string): boolean {
  return id.startsWith(CUSTOM_EXERCISE_PREFIX);
}

/**
 * An exercise a member made up for the Crate ("Sunday hill loop", "Rucking").
 * How it is logged decides how it scores, exactly like a catalog exercise.
 */
export interface CustomExercise {
  readonly id: string;
  readonly crateId: string;
  readonly name: string;
  readonly track: LogTrack;
  readonly takesLoad: boolean;
  readonly distanceKind: DistanceKind | null;
  readonly createdBy: string;
  readonly createdAt: Date;
}

export function loggableFromCustom(c: CustomExercise): LoggableExercise {
  return {
    id: c.id,
    name: c.name,
    track: c.track,
    takesLoad: c.takesLoad,
    distanceKind: c.track === 'distance' ? c.distanceKind : null,
    cues: null,
  };
}

export function customExerciseFromJson(json: JsonMap): CustomExercise {
  return {
    id: requireString(json['id'], 'id'),
    crateId: requireString(json['crateId'], 'crateId'),
    name: requireString(json['name'], 'name'),
    track: enumFromJson(LOG_TRACKS, json['track'], 'reps'),
    takesLoad: json['takesLoad'] === true,
    distanceKind: distanceKindFromJson(json['distanceKind']),
    createdBy: requireString(json['createdBy'], 'createdBy'),
    createdAt: dateTimeFromJson(json['createdAt']),
  };
}

export function customExerciseToJson(c: CustomExercise): JsonMap {
  return {
    id: c.id,
    crateId: c.crateId,
    name: c.name,
    track: c.track,
    takesLoad: c.takesLoad,
    distanceKind: c.distanceKind,
    createdBy: c.createdBy,
    createdAt: dateTimeToJson(c.createdAt),
  };
}

/** One exercise of a routine, with an optional per-set target. */
export interface RoutineItem {
  readonly exerciseId: string;
  /** Copied in, like log entries, so a routine renders without its library. */
  readonly exerciseName: string;
  readonly sets: number;
  readonly reps: number | null;
  readonly seconds: number | null;
  readonly meters: number | null;
}

/** A named list of exercises a member shared with the Crate, to start a log from. */
export interface Routine {
  readonly id: string;
  readonly crateId: string;
  readonly name: string;
  readonly items: readonly RoutineItem[];
  readonly createdBy: string;
  readonly createdAt: Date;
}

function routineItemFromJson(json: JsonMap): RoutineItem {
  const exerciseId = requireString(json['exerciseId'], 'exerciseId');
  return {
    exerciseId,
    exerciseName: stringOrNull(json['exerciseName']) ?? exerciseId,
    sets: intOrNullFromJson(json['sets']) ?? 1,
    reps: intOrNullFromJson(json['reps']),
    seconds: intOrNullFromJson(json['seconds']),
    meters: intOrNullFromJson(json['meters']),
  };
}

export function routineFromJson(json: JsonMap): Routine {
  return {
    id: requireString(json['id'], 'id'),
    crateId: requireString(json['crateId'], 'crateId'),
    name: requireString(json['name'], 'name'),
    items: mapListFromJson(json['items']).map(routineItemFromJson),
    createdBy: requireString(json['createdBy'], 'createdBy'),
    createdAt: dateTimeFromJson(json['createdAt']),
  };
}

export function routineToJson(r: Routine): JsonMap {
  return {
    id: r.id,
    crateId: r.crateId,
    name: r.name,
    items: r.items.map((i) => ({
      exerciseId: i.exerciseId,
      exerciseName: i.exerciseName,
      sets: i.sets,
      reps: i.reps,
      seconds: i.seconds,
      meters: i.meters,
    })),
    createdBy: r.createdBy,
    createdAt: dateTimeToJson(r.createdAt),
  };
}
