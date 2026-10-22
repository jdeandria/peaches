import {
  dateTimeFromJson,
  dateTimeOrNullFromJson,
  dateTimeToJson,
  enumFromJson,
  intFromJson,
  intOrNullFromJson,
  JsonMap,
  mapListFromJson,
  numberOrNullFromJson,
  requireString,
  stringListFromJson,
  stringOrNull,
} from '../core/json';
import { LOG_TRACKS, LoggableExercise, LogTrack } from '../exercises/loggable';
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
 * How the exercise is logged (its name, track, whether it takes a load and
 * its distance kind) is copied in, so an entry renders, scores and can be
 * logged again on its own: custom exercises exist only in the entries of
 * the Peach who made them up, and in the Crates those entries are shared
 * with.
 */
export interface ExerciseLogEntry {
  readonly exerciseId: string;
  readonly exerciseName: string;
  readonly track: LogTrack;
  readonly takesLoad: boolean;
  /** Which distance category metres count toward; null when distance doesn't score. */
  readonly distanceKind: DistanceKind | null;
  readonly sets: readonly SetLog[];
  readonly rpe: number | null;
  readonly notes: string | null;
}

export type NewExerciseLogEntry = Pick<ExerciseLogEntry, 'exerciseId' | 'sets'> &
  Partial<ExerciseLogEntry>;

/** Builds an entry; how it is logged defaults to what its sets record. */
export function exerciseLogEntry(init: NewExerciseLogEntry): ExerciseLogEntry {
  const e: ExerciseLogEntry = {
    exerciseName: init.exerciseId,
    track: trackOfSets(init.sets),
    takesLoad: init.sets.some((s) => s.loadKg !== null),
    distanceKind: null,
    rpe: null,
    notes: null,
    ...init,
  };
  if (e.rpe !== null && (e.rpe < 1 || e.rpe > 10)) throw new RangeError('rpe is 1..10');
  return e;
}

/** An entry for `exercise`, copying in how it is logged. */
export function entryOf(
  exercise: Omit<LoggableExercise, 'cues'>,
  init: Pick<ExerciseLogEntry, 'sets'> & Partial<ExerciseLogEntry>,
): ExerciseLogEntry {
  return exerciseLogEntry({
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    track: exercise.track,
    takesLoad: exercise.takesLoad,
    distanceKind: exercise.distanceKind,
    ...init,
  });
}

function trackOfSets(sets: readonly SetLog[]): LogTrack {
  if (sets.some((s) => s.meters !== null)) return 'distance';
  return sets.some((s) => s.reps !== null) ? 'reps' : 'time';
}

/** The exercise an entry was logged against, to log it again. */
export function loggableFromEntry(
  e: ExerciseLogEntry,
  cues: string | null = null,
): LoggableExercise {
  return {
    id: e.exerciseId,
    name: e.exerciseName,
    track: e.track,
    takesLoad: e.takesLoad,
    distanceKind: e.distanceKind,
    cues,
  };
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
 * in every Crate, each with that Crate's own rules. The Peach can still edit
 * a submitted log, and the shared copies follow.
 *
 * The session times itself: the clock runs while the log screen is open
 * (`timerStartedAt` is set) and pauses when it is not, banking the time in
 * `durationSeconds`.
 *
 * A submitted log can be resumed: it goes back to `inProgress` with its
 * clock where it stopped, and its Crates keep the copies from when it was
 * finished until it is finished again.
 */
export interface WorkoutLog {
  readonly id: string;
  readonly peachId: string;
  /** When the session began; decides which week the log counts toward. */
  readonly startedAt: Date;
  /** When it was last finished; kept while it is resumed. */
  readonly completedAt: Date | null;
  readonly status: WorkoutLogStatus;
  readonly entries: readonly ExerciseLogEntry[];
  /** Time on the clock, not counting a segment that is still running. */
  readonly durationSeconds: number;
  /** When the running segment started; null while paused and once submitted. */
  readonly timerStartedAt: Date | null;
  readonly notes: string | null;
  /** Crates the log is shared with. */
  readonly sharedWith: readonly string[];
}

export type NewWorkoutLog = Pick<WorkoutLog, 'id' | 'peachId' | 'startedAt'> & Partial<WorkoutLog>;

export function workoutLog(init: NewWorkoutLog): WorkoutLog {
  return {
    completedAt: null,
    status: 'inProgress',
    entries: [],
    durationSeconds: 0,
    timerStartedAt: null,
    notes: null,
    sharedWith: [],
    ...init,
  };
}

export function isSubmitted(log: WorkoutLog): boolean {
  return log.status === 'submitted';
}

/** Finished before and picked back up: in progress, but already shared. */
export function isResumed(log: WorkoutLog): boolean {
  return !isSubmitted(log) && log.completedAt !== null;
}

/** Seconds on the clock at `now`, including a running segment. */
export function elapsedSeconds(log: WorkoutLog, now: Date): number {
  const running = log.timerStartedAt
    ? Math.max(0, Math.floor((now.getTime() - log.timerStartedAt.getTime()) / 1000))
    : 0;
  return log.durationSeconds + running;
}

/** Banks the running segment and stops the clock. */
export function pauseTimer(log: WorkoutLog, now: Date): WorkoutLog {
  if (!log.timerStartedAt) return log;
  return { ...log, durationSeconds: elapsedSeconds(log, now), timerStartedAt: null };
}

/** Starts the clock again. */
export function resumeTimer(log: WorkoutLog, now: Date): WorkoutLog {
  return log.timerStartedAt ? log : { ...log, timerStartedAt: now };
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
    track: enumFromJson(LOG_TRACKS, json['track'], 'reps'),
    takesLoad: json['takesLoad'] === true,
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
    track: e.track,
    takesLoad: e.takesLoad,
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
    startedAt: dateTimeFromJson(json['startedAt']),
    completedAt: dateTimeOrNullFromJson(json['completedAt']),
    status: enumFromJson(WORKOUT_LOG_STATUSES, json['status'], 'inProgress'),
    entries: mapListFromJson(json['entries']).map(entryFromJson),
    durationSeconds: intFromJson(json['durationSeconds']),
    timerStartedAt: dateTimeOrNullFromJson(json['timerStartedAt']),
    notes: stringOrNull(json['notes']),
    sharedWith: stringListFromJson(json['sharedWith']),
  };
}

export function workoutLogToJson(log: WorkoutLog): JsonMap {
  return {
    id: log.id,
    peachId: log.peachId,
    startedAt: dateTimeToJson(log.startedAt),
    completedAt: log.completedAt ? dateTimeToJson(log.completedAt) : null,
    status: log.status,
    entries: log.entries.map(entryToJson),
    durationSeconds: log.durationSeconds,
    timerStartedAt: log.timerStartedAt ? dateTimeToJson(log.timerStartedAt) : null,
    notes: log.notes,
    sharedWith: [...log.sharedWith],
  };
}
