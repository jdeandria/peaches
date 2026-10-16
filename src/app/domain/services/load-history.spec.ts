import {
  ExerciseLogEntry,
  exerciseLogEntry,
  setLog,
  WorkoutLog,
  workoutLog,
} from '../models/workout-log';
import { LoadHistory } from './load-history';

function log(id: string, day: number, entries: ExerciseLogEntry[]): WorkoutLog {
  return workoutLog({
    id,
    peachId: 'p',
    startedAt: new Date(Date.UTC(2026, 9, day, 9)),
    completedAt: new Date(Date.UTC(2026, 9, day, 10)),
    status: 'submitted',
    entries,
  });
}

function squat(loads: (number | null)[]): ExerciseLogEntry {
  return exerciseLogEntry({
    exerciseId: 'db-goblet-squat',
    sets: loads.map((l) => setLog({ reps: 10, loadKg: l })),
  });
}

describe('LoadHistory', () => {
  it('returns the most recent loads for the exercise', () => {
    const logs = [
      log('old', 1, [squat([16, 16, 16])]),
      log('new', 5, [squat([20, 20, 22.5])]),
      log('mid', 3, [squat([18, 18, 18])]),
    ];
    expect(LoadHistory.lastLoadsKg(logs, 'db-goblet-squat')).toEqual([20, 20, 22.5]);
  });

  it('skips the log being edited and entries without weights', () => {
    const logs = [
      log('a', 1, [squat([16, 16])]),
      log('b', 4, [squat([null, null])]),
      log('current', 6, [squat([30])]),
    ];
    expect(LoadHistory.lastLoadsKg(logs, 'db-goblet-squat', 'current')).toEqual([16, 16]);
  });

  it('returns null with no history', () => {
    expect(LoadHistory.lastLoadsKg([], 'x')).toBeNull();
  });

  it('falls back to startedAt for logs still in progress', () => {
    const inProgress = workoutLog({
      id: 'live',
      peachId: 'p',
      startedAt: new Date(Date.UTC(2026, 9, 9, 9)),
      entries: [squat([24])],
    });
    const logs = [log('done', 8, [squat([20])]), inProgress];
    expect(LoadHistory.lastLoadsKg(logs, 'db-goblet-squat')).toEqual([24]);
  });

  it('keeps only the sets that recorded a weight, in order', () => {
    expect(
      LoadHistory.lastLoadsKg([log('a', 1, [squat([null, 12, null, 14])])], 'db-goblet-squat'),
    ).toEqual([12, 14]);
  });

  it('accepts any iterable and does not reorder the input', () => {
    const logs = [log('old', 1, [squat([16])]), log('new', 5, [squat([20])])];
    const snapshot = [...logs];
    expect(LoadHistory.lastLoadsKg(new Set(logs), 'db-goblet-squat')).toEqual([20]);
    expect(logs).toEqual(snapshot);
  });

  it('topLoadKg picks the heaviest set', () => {
    expect(LoadHistory.topLoadKg(squat([20, 25, 22.5]))).toBe(25);
    expect(LoadHistory.topLoadKg(squat([null]))).toBeNull();
    expect(LoadHistory.topLoadKg(squat([null, 0]))).toBe(0);
  });
});
