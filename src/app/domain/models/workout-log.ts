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
  stringOrNull,
} from '../core/json';

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
 * `workoutItemId` links to a workout item when following a generated
 * workout; it is null for free-form logging.
 */
export interface ExerciseLogEntry {
  readonly exerciseId: string;
  readonly workoutItemId: string | null;
  readonly sets: readonly SetLog[];
  readonly rpe: number | null;
  readonly notes: string | null;
}

export type NewExerciseLogEntry = Pick<ExerciseLogEntry, 'exerciseId' | 'sets'> &
  Partial<ExerciseLogEntry>;

export function exerciseLogEntry(init: NewExerciseLogEntry): ExerciseLogEntry {
  const e: ExerciseLogEntry = { workoutItemId: null, rpe: null, notes: null, ...init };
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
 * A Peach's record of a training session.
 *
 * This is the single source of truth for "what I did". A log may be tied to
 * a Matchup (then it is scored) or stand alone (plain exercise logging).
 */
export interface WorkoutLog {
  readonly id: string;
  readonly peachId: string;
  readonly workoutId: string | null;
  readonly matchupId: string | null;
  readonly startedAt: Date;
  readonly completedAt: Date | null;
  readonly status: WorkoutLogStatus;
  readonly entries: readonly ExerciseLogEntry[];
  readonly notes: string | null;
}

export type NewWorkoutLog = Pick<WorkoutLog, 'id' | 'peachId' | 'startedAt'> & Partial<WorkoutLog>;

export function workoutLog(init: NewWorkoutLog): WorkoutLog {
  return {
    workoutId: null,
    matchupId: null,
    completedAt: null,
    status: 'inProgress',
    entries: [],
    notes: null,
    ...init,
  };
}

export function isSubmitted(log: WorkoutLog): boolean {
  return log.status === 'submitted';
}

export function entryForItem(log: WorkoutLog, workoutItemId: string): ExerciseLogEntry | undefined {
  return log.entries.find((e) => e.workoutItemId === workoutItemId);
}

function sameSlot(a: ExerciseLogEntry, b: ExerciseLogEntry): boolean {
  return a.workoutItemId !== null
    ? a.workoutItemId === b.workoutItemId
    : b.workoutItemId === null && a.exerciseId === b.exerciseId;
}

/**
 * Returns a copy with `entry` replacing any existing entry for the same
 * workout item (or exercise, for free logs).
 */
export function upsertEntry(log: WorkoutLog, entry: ExerciseLogEntry): WorkoutLog {
  return { ...log, entries: [...log.entries.filter((e) => !sameSlot(e, entry)), entry] };
}

function setFromJson(json: JsonMap): SetLog {
  return {
    reps: intOrNullFromJson(json['reps']),
    loadKg: numberOrNullFromJson(json['loadKg']),
    seconds: intOrNullFromJson(json['seconds']),
    meters: intOrNullFromJson(json['meters']),
  };
}

export function entryFromJson(json: JsonMap): ExerciseLogEntry {
  return {
    exerciseId: requireString(json['exerciseId'], 'exerciseId'),
    workoutItemId: stringOrNull(json['workoutItemId']),
    sets: mapListFromJson(json['sets']).map(setFromJson),
    rpe: intOrNullFromJson(json['rpe']),
    notes: stringOrNull(json['notes']),
  };
}

export function entryToJson(e: ExerciseLogEntry): JsonMap {
  return {
    exerciseId: e.exerciseId,
    workoutItemId: e.workoutItemId,
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
    workoutId: stringOrNull(json['workoutId']),
    matchupId: stringOrNull(json['matchupId']),
    startedAt: dateTimeFromJson(json['startedAt']),
    completedAt: dateTimeOrNullFromJson(json['completedAt']),
    status: enumFromJson(WORKOUT_LOG_STATUSES, json['status'], 'inProgress'),
    entries: mapListFromJson(json['entries']).map(entryFromJson),
    notes: stringOrNull(json['notes']),
  };
}

export function workoutLogToJson(log: WorkoutLog): JsonMap {
  return {
    id: log.id,
    peachId: log.peachId,
    workoutId: log.workoutId,
    matchupId: log.matchupId,
    startedAt: dateTimeToJson(log.startedAt),
    completedAt: log.completedAt ? dateTimeToJson(log.completedAt) : null,
    status: log.status,
    entries: log.entries.map(entryToJson),
    notes: log.notes,
  };
}
