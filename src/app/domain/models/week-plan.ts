import {
  dateTimeFromJson,
  dateTimeToJson,
  JsonMap,
  mapListFromJson,
  requireString,
  stringOrNull,
} from '../core/json';
import { addDays, LocalDate, parseLocalDate, startOfWeek } from '../core/local-date';
import { ExerciseLogEntry, entryFromJson, entryToJson } from './workout-log';

/**
 * One workout a Peach plans for a day of the week: what they mean to do
 * (exercises with target sets, in the shape a session plan uses) and where.
 * Launching it starts a log with this plan; `logId` then links the two, so
 * the day shows what was planned against what was done.
 */
export interface PlannedWorkout {
  readonly id: string;
  readonly day: LocalDate;
  readonly name: string;
  /** The equipment location it's planned for, or null for anywhere. */
  readonly locationId: string | null;
  readonly exercises: readonly ExerciseLogEntry[];
  /** The log launched from it, once launched. */
  readonly logId: string | null;
}

/**
 * A Peach's plan for one week, Monday to Sunday: the workouts they mean to
 * do, each on a day. Private to the Peach. In a Crate, what the plan is
 * worth becomes their commitment for that week's matchup (see
 * `Commitment`); the plan itself is never shared.
 */
export interface WeekPlan {
  readonly peachId: string;
  /** The Monday the week starts. */
  readonly weekStart: LocalDate;
  /** In day order; within a day, in the order they were planned. */
  readonly workouts: readonly PlannedWorkout[];
  readonly updatedAt: Date;
}

/** Document key: one plan per Peach per week. */
export function weekPlanKey(peachId: string, weekStart: LocalDate): string {
  return `${peachId}_${weekStart}`;
}

/** Most workouts a week can hold. */
export const MAX_PLANNED_WORKOUTS = 21;
/** Longest workout name. */
export const PLANNED_NAME_MAX = 40;

export function emptyPlan(peachId: string, weekStart: LocalDate, now: Date): WeekPlan {
  return { peachId, weekStart: startOfWeek(weekStart), workouts: [], updatedAt: now };
}

/** The seven days of the plan's week, Monday first. */
export function daysOf(weekStart: LocalDate): LocalDate[] {
  return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(weekStart, i));
}

export function isInWeek(weekStart: LocalDate, day: LocalDate): boolean {
  return day >= weekStart && day <= addDays(weekStart, 6);
}

export function workoutsOn(plan: WeekPlan, day: LocalDate): PlannedWorkout[] {
  return plan.workouts.filter((w) => w.day === day);
}

export function plannedWorkout(plan: WeekPlan, id: string): PlannedWorkout | undefined {
  return plan.workouts.find((w) => w.id === id);
}

/**
 * Adds a workout, or replaces the one with its id, keeping the list in day
 * order (a workout moved to another day goes last on that day).
 */
export function upsertWorkout(plan: WeekPlan, workout: PlannedWorkout): WeekPlan {
  const existing = plannedWorkout(plan, workout.id);
  const others = plan.workouts.filter((w) => w.id !== workout.id);
  if (existing && existing.day === workout.day) {
    return { ...plan, workouts: plan.workouts.map((w) => (w.id === workout.id ? workout : w)) };
  }
  const at = others.findIndex((w) => w.day > workout.day);
  const workouts = [...others];
  workouts.splice(at < 0 ? workouts.length : at, 0, workout);
  return { ...plan, workouts };
}

export function removeWorkout(plan: WeekPlan, id: string): WeekPlan {
  return { ...plan, workouts: plan.workouts.filter((w) => w.id !== id) };
}

/** Every exercise planned in the week, for what the plan is worth. */
export function plannedEntries(plan: WeekPlan): ExerciseLogEntry[] {
  return plan.workouts.flatMap((w) => w.exercises);
}

export function plannedSetCount(w: PlannedWorkout): number {
  return w.exercises.reduce((n, e) => n + e.sets.length, 0);
}

function plannedWorkoutFromJson(json: JsonMap): PlannedWorkout {
  return {
    id: requireString(json['id'], 'id'),
    day: parseLocalDate(requireString(json['day'], 'day')),
    name: stringOrNull(json['name']) ?? 'Workout',
    locationId: stringOrNull(json['locationId']),
    exercises: mapListFromJson(json['exercises']).map(entryFromJson),
    logId: stringOrNull(json['logId']),
  };
}

export function weekPlanFromJson(json: JsonMap): WeekPlan {
  return {
    peachId: requireString(json['peachId'], 'peachId'),
    weekStart: parseLocalDate(requireString(json['weekStart'], 'weekStart')),
    workouts: mapListFromJson(json['workouts']).map(plannedWorkoutFromJson),
    updatedAt: dateTimeFromJson(json['updatedAt']),
  };
}

export function weekPlanToJson(p: WeekPlan): JsonMap {
  return {
    peachId: p.peachId,
    weekStart: p.weekStart,
    workouts: p.workouts.map((w) => ({
      id: w.id,
      day: w.day,
      name: w.name,
      locationId: w.locationId,
      exercises: w.exercises.map(entryToJson),
      logId: w.logId,
    })),
    updatedAt: dateTimeToJson(p.updatedAt),
  };
}
