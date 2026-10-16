import { ExerciseLogEntry, WorkoutLog } from '../models/workout-log';

/**
 * Looks up the weights a Peach used last time on an exercise, so the set
 * logger can start from them instead of a blank field.
 */
export const LoadHistory = {
  /**
   * Per-set loads (kg) from the most recent log containing `exerciseId`
   * with at least one recorded weight, or null if there is none.
   * `excludingLogId` skips the log currently being edited.
   */
  lastLoadsKg(
    logs: Iterable<WorkoutLog>,
    exerciseId: string,
    excludingLogId?: string | null,
  ): number[] | null {
    const when = (l: WorkoutLog) => (l.completedAt ?? l.startedAt).getTime();
    const ordered = [...logs]
      .filter((l) => l.id !== excludingLogId)
      .sort((a, b) => when(b) - when(a));
    for (const log of ordered) {
      for (const entry of log.entries) {
        if (entry.exerciseId !== exerciseId) continue;
        const loads = entry.sets.map((s) => s.loadKg).filter((kg): kg is number => kg !== null);
        if (loads.length > 0) return loads;
      }
    }
    return null;
  },

  /** The heaviest load recorded in `entry`, or null. */
  topLoadKg(entry: ExerciseLogEntry): number | null {
    const loads = entry.sets.map((s) => s.loadKg).filter((kg): kg is number => kg !== null);
    return loads.length === 0 ? null : Math.max(...loads);
  },
} as const;
