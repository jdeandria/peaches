import { ExerciseLogEntry, WorkoutLog } from '../models/workout-log';

/**
 * The last time a Peach logged an exercise, so the set logger can start
 * from what they did then instead of blank fields. `excludingLogId` skips
 * the log being edited.
 */
export function lastEntry(
  logs: Iterable<WorkoutLog>,
  exerciseId: string,
  excludingLogId?: string | null,
): ExerciseLogEntry | null {
  let latest: { at: number; entry: ExerciseLogEntry } | null = null;
  for (const log of logs) {
    if (log.id === excludingLogId) continue;
    const entry = log.entries.find((e) => e.exerciseId === exerciseId);
    const at = log.startedAt.getTime();
    if (entry && (latest === null || at > latest.at)) latest = { at, entry };
  }
  return latest?.entry ?? null;
}
