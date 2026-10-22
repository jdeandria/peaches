import {
  dateTimeFromJson,
  dateTimeToJson,
  JsonMap,
  mapListFromJson,
  requireString,
} from '../core/json';
import { ExerciseLogEntry, entryFromJson, entryToJson } from './workout-log';

/**
 * A workout a Peach saved to plan again: its exercises, in order, each with
 * target sets (entries in the shape a session plan uses). Private to its
 * Peach.
 */
export interface Routine {
  readonly id: string;
  readonly peachId: string;
  readonly name: string;
  readonly exercises: readonly ExerciseLogEntry[];
  readonly updatedAt: Date;
}

/** Longest routine name. */
export const ROUTINE_NAME_MAX = 40;

export function routineFromJson(json: JsonMap): Routine {
  return {
    id: requireString(json['id'], 'id'),
    peachId: requireString(json['peachId'], 'peachId'),
    name: requireString(json['name'], 'name'),
    exercises: mapListFromJson(json['exercises']).map(entryFromJson),
    updatedAt: dateTimeFromJson(json['updatedAt']),
  };
}

export function routineToJson(r: Routine): JsonMap {
  return {
    id: r.id,
    peachId: r.peachId,
    name: r.name,
    exercises: r.exercises.map(entryToJson),
    updatedAt: dateTimeToJson(r.updatedAt),
  };
}

/** Routines in name order, case aside. */
export function byRoutineName(a: Routine, b: Routine): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || (a.id < b.id ? -1 : 1);
}
