import {
  dateTimeFromJson,
  dateTimeOrNullFromJson,
  dateTimeToJson,
  enumFromJson,
  intOrNullFromJson,
  JsonMap,
  mapListFromJson,
  numberOrNullFromJson,
  requireString,
  stringListFromJson,
  stringOrNull,
} from '../core/json';
import { DISTANCE_KINDS, DistanceKind } from './scoring';

/** What was actually done in one set. */
export interface SetLog {
  readonly reps: number | null;
  readonly loadKg: number | null;
  readonly seconds: number | null;
  readonly meters: number | null;
}

/** Builds a set, checking it records reps, seconds or metres. */
export function setLog(init: Partial<SetLog>): SetLog {
  const s: SetLog = { reps: null, loadKg: null, seconds: null, meters: null, ...init };
  if (s.reps === null && s.seconds === null && s.meters === null) {
    throw new RangeError('A set must record reps, seconds or meters');
  }
  return s;
}

/**
 * Everything logged against one exercise in a session.
 *
 * The exercise's name and distance kind are copied in when it is logged. A
 * log is shared with every Crate its Peach belongs to, and an exercise from
 * one Crate's private library means nothing in another, so the entry has to
 * render and score on its own.
 */
export interface ExerciseLogEntry {
  readonly exerciseId: string;
  readonly exerciseName: string;
  /** Which distance category metres count toward; null when distance doesn't score. */
  readonly distanceKind: DistanceKind | null;
  readonly sets: readonly SetLog[];
  readonly rpe: number | null;
  readonly notes: string | null;
}

export type NewExerciseLogEntry = Pick<ExerciseLogEntry, 'exerciseId' | 'sets'> &
  Partial<ExerciseLogEntry>;

export function exerciseLogEntry(init: NewExerciseLogEntry): ExerciseLogEntry {
  const e: ExerciseLogEntry = {
    exerciseName: init.exerciseId,
    distanceKind: null,
    rpe: null,
    notes: null,
    ...init,
  };
  if (e.rpe !== null && (e.rpe < 1 || e.rpe > 10)) throw new RangeError('rpe is 1..10');
  return e;
}

export function totalReps(e: ExerciseLogEntry): number {
  return e.sets.reduce((sum, s) => sum + (s.reps ?? 0), 0);
}

export function totalSeconds(e: ExerciseLogEntry): number {
  return e.sets.reduce((sum, s) => sum + (s.seconds ?? 0), 0);
}

export function totalMeters(e: ExerciseLogEntry): number {
  return e.sets.reduce((sum, s) => sum + (s.meters ?? 0), 0);
}

/** Volume load in kg (reps x load), useful for progress tracking. */
export function volumeLoadKg(e: ExerciseLogEntry): number {
  return e.sets.reduce((sum, s) => sum + (s.reps ?? 0) * (s.loadKg ?? 0), 0);
}

export const WORKOUT_LOG_STATUSES = ['inProgress', 'submitted'] as const;
export type WorkoutLogStatus = (typeof WORKOUT_LOG_STATUSES)[number];

/**
 * A Peach's record of a training session, owned by the Peach.
 *
 * Logs belong to no Crate or Matchup. When submitted, a log is shared with
 * every Crate the Peach is active in (`sharedWith`); a Matchup scores the
 * shared logs its two Peaches started inside its week, so one workout counts
 * in every Crate, each with that Crate's own weights.
 */
export interface WorkoutLog {
  readonly id: string;
  readonly peachId: string;
  /** The Crate routine this log was started from, if any. */
  readonly routineId: string | null;
  /** Decides which week the log counts toward. */
  readonly startedAt: Date;
  readonly completedAt: Date | null;
  readonly status: WorkoutLogStatus;
  readonly entries: readonly ExerciseLogEntry[];
  /** How long the whole session took, as the Peach reports it on submit. */
  readonly durationMinutes: number | null;
  readonly notes: string | null;
  /** Crates the log was shared with on submit. */
  readonly sharedWith: readonly string[];
}

export type NewWorkoutLog = Pick<WorkoutLog, 'id' | 'peachId' | 'startedAt'> & Partial<WorkoutLog>;

export function workoutLog(init: NewWorkoutLog): WorkoutLog {
  return {
    routineId: null,
    completedAt: null,
    status: 'inProgress',
    entries: [],
    durationMinutes: null,
    notes: null,
    sharedWith: [],
    ...init,
  };
}

export function isSubmitted(log: WorkoutLog): boolean {
  return log.status === 'submitted';
}

export function entryFor(log: WorkoutLog, exerciseId: string): ExerciseLogEntry | undefined {
  return log.entries.find((e) => e.exerciseId === exerciseId);
}

/** Returns a copy with `entry` replacing any existing entry for the same exercise. */
export function upsertEntry(log: WorkoutLog, entry: ExerciseLogEntry): WorkoutLog {
  const i = log.entries.findIndex((e) => e.exerciseId === entry.exerciseId);
  const entries = [...log.entries];
  if (i < 0) entries.push(entry);
  else entries[i] = entry;
  return { ...log, entries };
}

/** Returns a copy without the entry for `exerciseId`. */
export function removeEntry(log: WorkoutLog, exerciseId: string): WorkoutLog {
  return { ...log, entries: log.entries.filter((e) => e.exerciseId !== exerciseId) };
}

export function totalSets(log: WorkoutLog): number {
  return log.entries.reduce((n, e) => n + e.sets.length, 0);
}

function setFromJson(json: JsonMap): SetLog {
  return {
    reps: intOrNullFromJson(json['reps']),
    loadKg: numberOrNullFromJson(json['loadKg']),
    seconds: intOrNullFromJson(json['seconds']),
    meters: intOrNullFromJson(json['meters']),
  };
}

/** Unknown or missing kinds decode as null: the distance then simply doesn't score. */
export function distanceKindFromJson(raw: unknown): DistanceKind | null {
  return typeof raw === 'string' && (DISTANCE_KINDS as readonly string[]).includes(raw)
    ? (raw as DistanceKind)
    : null;
}

export function entryFromJson(json: JsonMap): ExerciseLogEntry {
  const exerciseId = requireString(json['exerciseId'], 'exerciseId');
  return {
    exerciseId,
    exerciseName: stringOrNull(json['exerciseName']) ?? exerciseId,
    distanceKind: distanceKindFromJson(json['distanceKind']),
    sets: mapListFromJson(json['sets']).map(setFromJson),
    rpe: intOrNullFromJson(json['rpe']),
    notes: stringOrNull(json['notes']),
  };
}

export function entryToJson(e: ExerciseLogEntry): JsonMap {
  return {
    exerciseId: e.exerciseId,
    exerciseName: e.exerciseName,
    distanceKind: e.distanceKind,
    sets: e.sets.map((s) => ({
      reps: s.reps,
      loadKg: s.loadKg,
      seconds: s.seconds,
      meters: s.meters,
    })),
    rpe: e.rpe,
    notes: e.notes,
  };
}

export function workoutLogFromJson(json: JsonMap): WorkoutLog {
  return {
    id: requireString(json['id'], 'id'),
    peachId: requireString(json['peachId'], 'peachId'),
    routineId: stringOrNull(json['routineId']),
    startedAt: dateTimeFromJson(json['startedAt']),
    completedAt: dateTimeOrNullFromJson(json['completedAt']),
    status: enumFromJson(WORKOUT_LOG_STATUSES, json['status'], 'inProgress'),
    entries: mapListFromJson(json['entries']).map(entryFromJson),
    durationMinutes: intOrNullFromJson(json['durationMinutes']),
    notes: stringOrNull(json['notes']),
    sharedWith: stringListFromJson(json['sharedWith']),
  };
}

export function workoutLogToJson(log: WorkoutLog): JsonMap {
  return {
    id: log.id,
    peachId: log.peachId,
    routineId: log.routineId,
    startedAt: dateTimeToJson(log.startedAt),
    completedAt: log.completedAt ? dateTimeToJson(log.completedAt) : null,
    status: log.status,
    entries: log.entries.map(entryToJson),
    durationMinutes: log.durationMinutes,
    notes: log.notes,
    sharedWith: [...log.sharedWith],
  };
}
