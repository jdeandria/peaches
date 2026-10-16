import {
  dateTimeFromJson,
  dateTimeToJson,
  enumFromJson,
  FormatError,
  intFromJson,
  intOrNullFromJson,
  JsonMap,
  mapFromJson,
  mapListFromJson,
  numberFromJson,
  requireString,
  stringOrNull,
} from '../core/json';
import { MeasurementType } from '../exercises/taxonomy';
import { SESSION_FOCUSES, SessionFocus, TRAINING_GOALS, TrainingGoal } from './training';

/** The role a block plays in a session. Blocks are performed in this order. */
export const BLOCK_TYPES = ['warmUp', 'strength', 'conditioning', 'coolDown'] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

/**
 * Load guidance expressed as rating of perceived exertion (1..10), which
 * works for every Peach regardless of known maxes.
 */
export interface LoadGuidance {
  readonly rpe: number;
  readonly note: string | null;
}

/**
 * What to do for one exercise: sets of reps, seconds or metres.
 *
 * Exactly one of `reps`, `seconds` or `meters` is set, matching the
 * exercise's measurement type. For unilateral exercises values are *per
 * side*.
 */
export interface Prescription {
  readonly sets: number;
  readonly restSeconds: number;
  readonly reps: number | null;
  readonly seconds: number | null;
  readonly meters: number | null;
  readonly load: LoadGuidance | null;
  readonly perSide: boolean;
}

export type NewPrescription = Pick<Prescription, 'sets' | 'restSeconds'> & Partial<Prescription>;

/** Builds a prescription, checking that exactly one target is set. */
export function prescription(init: NewPrescription): Prescription {
  const p: Prescription = {
    reps: null,
    seconds: null,
    meters: null,
    load: null,
    perSide: false,
    ...init,
  };
  if (p.sets < 1) throw new RangeError('sets must be >= 1');
  if (p.restSeconds < 0) throw new RangeError('restSeconds must be >= 0');
  const targets = [p.reps, p.seconds, p.meters].filter((v) => v !== null).length;
  if (targets !== 1) throw new RangeError('Exactly one of reps, seconds or meters must be set');
  return p;
}

/** The per-set target in the exercise's native unit. */
export function targetPerSet(p: Prescription): number {
  return p.reps ?? p.seconds ?? p.meters ?? 0;
}

/**
 * Total prescribed volume in the native unit (reps, seconds or metres),
 * counting both sides for per-side prescriptions.
 */
export function totalTarget(p: Prescription): number {
  return targetPerSet(p) * p.sets * (p.perSide ? 2 : 1);
}

export function prescriptionUnit(p: Prescription): MeasurementType {
  return p.reps !== null ? 'reps' : p.seconds !== null ? 'duration' : 'distance';
}

/** One exercise inside a block. */
export interface WorkoutItem {
  /** Unique within the workout; logs reference items by this id. */
  readonly id: string;
  readonly exerciseId: string;
  readonly prescription: Prescription;
  /**
   * Relative contribution to the workout score. Warm-up and cool-down items
   * are typically 0 so they are logged but not competed on.
   */
  readonly scoringWeight: number;
}

export function isScored(item: WorkoutItem): boolean {
  return item.scoringWeight > 0;
}

export interface WorkoutBlock {
  readonly type: BlockType;
  readonly items: readonly WorkoutItem[];
}

/**
 * A generated session. Immutable once created; regenerate for changes.
 *
 * A Workout is independent of who performs it so the same instance can be
 * shared by both Peaches in a Matchup (fair play) or attached to nothing for
 * a solo session.
 */
export interface Workout {
  readonly id: string;
  readonly title: string | null;
  readonly blocks: readonly WorkoutBlock[];
  readonly focus: SessionFocus;
  readonly goal: TrainingGoal;
  readonly targetDifficulty: number;
  readonly estimatedMinutes: number;
  /**
   * Random seed used to generate this workout: the generator is
   * deterministic, so seed + inputs + version reproduce it exactly.
   */
  readonly seed: number;
  readonly generatorVersion: number;
  readonly createdAt: Date;
}

export function workoutItems(w: Workout): WorkoutItem[] {
  return w.blocks.flatMap((b) => b.items);
}

export function scoredItems(w: Workout): WorkoutItem[] {
  return workoutItems(w).filter(isScored);
}

export function itemById(w: Workout, id: string): WorkoutItem | undefined {
  return workoutItems(w).find((i) => i.id === id);
}

function loadFromJson(json: JsonMap): LoadGuidance {
  return { rpe: intFromJson(json['rpe'], 7), note: stringOrNull(json['note']) };
}

export function prescriptionFromJson(json: JsonMap): Prescription {
  const load = mapFromJson(json['load']);
  return {
    sets: intFromJson(json['sets'], 1),
    restSeconds: intFromJson(json['restSeconds']),
    reps: intOrNullFromJson(json['reps']),
    seconds: intOrNullFromJson(json['seconds']),
    meters: intOrNullFromJson(json['meters']),
    load: load ? loadFromJson(load) : null,
    perSide: json['perSide'] === true,
  };
}

export function prescriptionToJson(p: Prescription): JsonMap {
  return {
    sets: p.sets,
    restSeconds: p.restSeconds,
    reps: p.reps,
    seconds: p.seconds,
    meters: p.meters,
    load: p.load ? { rpe: p.load.rpe, note: p.load.note } : null,
    perSide: p.perSide,
  };
}

function itemFromJson(json: JsonMap): WorkoutItem {
  const p = mapFromJson(json['prescription']);
  if (!p) throw new FormatError('Missing prescription');
  return {
    id: requireString(json['id'], 'id'),
    exerciseId: requireString(json['exerciseId'], 'exerciseId'),
    prescription: prescriptionFromJson(p),
    scoringWeight: numberFromJson(json['scoringWeight'], 1),
  };
}

function itemToJson(i: WorkoutItem): JsonMap {
  return {
    id: i.id,
    exerciseId: i.exerciseId,
    prescription: prescriptionToJson(i.prescription),
    scoringWeight: i.scoringWeight,
  };
}

export function workoutFromJson(json: JsonMap): Workout {
  return {
    id: requireString(json['id'], 'id'),
    title: stringOrNull(json['title']),
    blocks: mapListFromJson(json['blocks']).map((b) => ({
      type: enumFromJson(BLOCK_TYPES, b['type']),
      items: mapListFromJson(b['items']).map(itemFromJson),
    })),
    focus: enumFromJson(SESSION_FOCUSES, json['focus']),
    goal: enumFromJson(TRAINING_GOALS, json['goal']),
    targetDifficulty: numberFromJson(json['targetDifficulty'], 2),
    estimatedMinutes: intFromJson(json['estimatedMinutes']),
    seed: intFromJson(json['seed']),
    generatorVersion: intFromJson(json['generatorVersion']),
    createdAt: dateTimeFromJson(json['createdAt']),
  };
}

export function workoutToJson(w: Workout): JsonMap {
  return {
    id: w.id,
    title: w.title,
    blocks: w.blocks.map((b) => ({ type: b.type, items: b.items.map(itemToJson) })),
    focus: w.focus,
    goal: w.goal,
    targetDifficulty: w.targetDifficulty,
    estimatedMinutes: w.estimatedMinutes,
    seed: w.seed,
    generatorVersion: w.generatorVersion,
    createdAt: dateTimeToJson(w.createdAt),
  };
}
