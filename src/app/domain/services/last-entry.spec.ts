import {
  ExerciseLogEntry,
  exerciseLogEntry,
  setLog,
  WorkoutLog,
  workoutLog,
} from '../models/workout-log';
import { lastEntry } from './last-entry';

function log(id: string, day: number, entries: ExerciseLogEntry[]): WorkoutLog {
  return workoutLog({
    id,
    peachId: 'p',
    startedAt: new Date(Date.UTC(2026, 9, day, 9)),
    status: 'submitted',
    entries,
  });
}

function squat(load: number): ExerciseLogEntry {
  return exerciseLogEntry({
    exerciseId: 'db-goblet-squat',
    sets: [setLog({ reps: 10, loadKg: load }), setLog({ reps: 8, loadKg: load })],
  });
}

describe('lastEntry', () => {
  it('returns the most recent entry for the exercise', () => {
    const logs = [
      log('old', 1, [squat(16)]),
      log('new', 5, [squat(20)]),
      log('mid', 3, [squat(18)]),
    ];
    expect(lastEntry(logs, 'db-goblet-squat')?.sets[0].loadKg).toBe(20);
  });

  it('skips the log being edited', () => {
    const logs = [log('a', 1, [squat(16)]), log('current', 6, [squat(30)])];
    expect(lastEntry(logs, 'db-goblet-squat', 'current')?.sets[0].loadKg).toBe(16);
  });

  it('returns null with no history', () => {
    expect(lastEntry([], 'x')).toBeNull();
  });
});
