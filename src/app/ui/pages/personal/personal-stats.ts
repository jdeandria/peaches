import { addDays, LocalDate, localDateOfLocal, startOfWeek } from '../../../domain/core/local-date';
import { DistanceKind } from '../../../domain/models/scoring';
import { WeekPlan } from '../../../domain/models/week-plan';
import { isSubmitted, WorkoutLog } from '../../../domain/models/workout-log';
import { MetricExtractor } from '../../../domain/services/metric-extractor';

/** The Monday of the week a log counts in, on this device. */
export function weekOf(log: WorkoutLog): LocalDate {
  return startOfWeek(localDateOfLocal(log.startedAt));
}

/** One past week of a plan: workouts planned, and how many were done from it. */
export interface PlanWeek {
  readonly monday: LocalDate;
  readonly planned: number;
  readonly kept: number;
}

/**
 * How well plans were kept in the `weeks` weeks before `thisWeek`, oldest
 * first: a planned workout counts as kept when the log launched from it was
 * finished. Weeks with nothing planned are left out.
 */
export function planKept(
  plans: readonly WeekPlan[],
  logs: readonly WorkoutLog[],
  thisWeek: LocalDate,
  weeks = 4,
): { weeks: PlanWeek[]; planned: number; kept: number } {
  const done = new Set(logs.filter(isSubmitted).map((l) => l.id));
  const from = addDays(thisWeek, -7 * weeks);
  const shown = plans
    .filter((p) => p.weekStart >= from && p.weekStart < thisWeek && p.workouts.length > 0)
    .map((p) => ({
      monday: p.weekStart,
      planned: p.workouts.length,
      kept: p.workouts.filter((w) => w.logId !== null && done.has(w.logId)).length,
    }))
    .sort((a, b) => (a.monday < b.monday ? -1 : 1));
  return {
    weeks: shown,
    planned: shown.reduce((n, w) => n + w.planned, 0),
    kept: shown.reduce((n, w) => n + w.kept, 0),
  };
}

/** Finished workouts in each of the last `weeks` weeks up to `thisWeek`, newest first. */
export function workoutsPerWeek(
  logs: readonly WorkoutLog[],
  thisWeek: LocalDate,
  weeks = 6,
): { monday: LocalDate; count: number }[] {
  const counts = new Map<LocalDate, number>();
  for (const log of logs.filter(isSubmitted)) {
    const monday = weekOf(log);
    counts.set(monday, (counts.get(monday) ?? 0) + 1);
  }
  return Array.from({ length: weeks }, (_, i) => {
    const monday = addDays(thisWeek, -7 * i);
    return { monday, count: counts.get(monday) ?? 0 };
  });
}

/** The heaviest an exercise has been lifted, and when that was first done. */
export interface LiftRecord {
  readonly exerciseId: string;
  readonly name: string;
  readonly loadKg: number;
  /** The most reps done at that weight. */
  readonly reps: number;
  readonly on: Date;
}

/** The furthest gone in one session, per distance category. */
export interface DistanceRecord {
  readonly kind: DistanceKind;
  /** In the category's unit: km, or metres for swim & row. */
  readonly amount: number;
  readonly on: Date;
}

/** The most reps in one set. */
export interface RepsRecord {
  readonly name: string;
  readonly reps: number;
  readonly on: Date;
}

export interface Records {
  /** Newest record first. */
  readonly lifts: readonly LiftRecord[];
  /** In run & walk, ride, swim & row order; only kinds ever logged. */
  readonly distances: readonly DistanceRecord[];
  readonly reps: RepsRecord | null;
}

const DISTANCES: readonly DistanceKind[] = ['runWalk', 'ride', 'swimRow'];

/** Personal bests from finished workouts. Ties keep the first time it was done. */
export function personalRecords(logs: readonly WorkoutLog[]): Records {
  const oldestFirst = logs
    .filter(isSubmitted)
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  const lifts = new Map<string, LiftRecord>();
  const distances = new Map<DistanceKind, DistanceRecord>();
  let reps: RepsRecord | null = null;
  for (const log of oldestFirst) {
    const on = log.startedAt;
    for (const entry of log.entries) {
      for (const set of entry.sets) {
        const r = set.reps ?? 0;
        if (r > (reps?.reps ?? 0)) reps = { name: entry.exerciseName, reps: r, on };
        const kg = set.loadKg ?? 0;
        if (kg <= 0 || r <= 0) continue;
        const best = lifts.get(entry.exerciseId);
        if (!best || kg > best.loadKg) {
          lifts.set(entry.exerciseId, {
            exerciseId: entry.exerciseId,
            name: entry.exerciseName,
            loadKg: kg,
            reps: r,
            on,
          });
        } else if (kg === best.loadKg && r > best.reps) {
          lifts.set(entry.exerciseId, { ...best, reps: r, on });
        }
      }
    }
    const totals = MetricExtractor.extract(log);
    for (const kind of DISTANCES) {
      if (totals[kind] > (distances.get(kind)?.amount ?? 0)) {
        distances.set(kind, { kind, amount: totals[kind], on });
      }
    }
  }
  return {
    lifts: [...lifts.values()].sort((a, b) => b.on.getTime() - a.on.getTime()),
    distances: DISTANCES.flatMap((k) => distances.get(k) ?? []),
    reps,
  };
}
