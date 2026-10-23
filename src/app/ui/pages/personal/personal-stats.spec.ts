import { localDate } from '../../../domain/core/local-date';
import { WeekPlan } from '../../../domain/models/week-plan';
import {
  exerciseLogEntry,
  ExerciseLogEntry,
  setLog,
  WorkoutLog,
  workoutLog,
} from '../../../domain/models/workout-log';
import { personalRecords, planKept, workoutsPerWeek } from './personal-stats';

describe('personal stats', () => {
  // Local noon, so the week a log falls in doesn't depend on the test machine's zone.
  const at = (month: number, day: number) => new Date(2026, month - 1, day, 12);
  const log = (id: string, on: Date, entries: ExerciseLogEntry[], submitted = true): WorkoutLog =>
    workoutLog({
      id,
      peachId: 'p',
      startedAt: on,
      entries,
      status: submitted ? 'submitted' : 'inProgress',
    });
  const squat = (reps: number, loadKg: number) =>
    exerciseLogEntry({
      exerciseId: 'bb-back-squat',
      exerciseName: 'Back Squat',
      sets: [setLog({ reps, loadKg })],
    });
  const run = (km: number) =>
    exerciseLogEntry({
      exerciseId: 'bw-run',
      exerciseName: 'Run',
      distanceKind: 'runWalk',
      sets: [setLog({ meters: km * 1000, seconds: km * 330 })],
    });
  const thisWeek = localDate(2026, 10, 12);

  it('counts planned workouts done from finished logs, in the weeks before this one', () => {
    const plan = (monday: number, logIds: (string | null)[]): WeekPlan => ({
      peachId: 'p',
      weekStart: localDate(2026, 10, monday),
      workouts: logIds.map((logId, i) => ({
        id: `${monday}-${i}`,
        day: localDate(2026, 10, monday + i),
        name: 'W',
        locationId: null,
        exercises: [run(5)],
        logId,
      })),
      updatedAt: at(10, 1),
    });
    const logs = [
      log('done', at(10, 5), [run(5)]),
      log('draft', at(10, 6), [run(5)], false),
      log('later', at(9, 28), [run(5)]),
    ];
    const kept = planKept(
      [
        plan(12, ['done']), // this week: not counted yet
        plan(5, ['done', 'draft', null]),
        { ...plan(5, []), weekStart: localDate(2026, 9, 21) }, // nothing planned
        { ...plan(5, ['later']), weekStart: localDate(2026, 9, 28) },
        { ...plan(5, ['x']), weekStart: localDate(2026, 8, 31) }, // too long ago
      ],
      logs,
      thisWeek,
      4,
    );
    expect(kept.weeks.map((w) => [w.monday, w.kept, w.planned])).toEqual([
      ['2026-09-28', 1, 1],
      ['2026-10-05', 1, 3],
    ]);
    expect([kept.kept, kept.planned]).toEqual([2, 4]);
  });

  it('counts finished workouts per week, newest first', () => {
    const weeks = workoutsPerWeek(
      [
        log('a', at(10, 12), [run(5)]),
        log('b', at(10, 6), [run(5)]),
        log('c', at(10, 7), [run(5)]),
        log('d', at(10, 13), [run(5)], false),
      ],
      thisWeek,
      3,
    );
    expect(weeks).toEqual([
      { monday: '2026-10-12', count: 1 },
      { monday: '2026-10-05', count: 2 },
      { monday: '2026-09-28', count: 0 },
    ]);
  });

  it('finds the heaviest lifts, longest sessions and most reps', () => {
    const records = personalRecords([
      log('1', at(10, 1), [squat(5, 100), run(5)]),
      log('2', at(10, 3), [squat(8, 100), run(12)]),
      log('3', at(10, 5), [
        squat(3, 90),
        exerciseLogEntry({
          exerciseId: 'bw-push-up',
          exerciseName: 'Push Up',
          sets: [setLog({ reps: 40 })],
        }),
      ]),
      log('4', at(10, 7), [squat(1, 140)], false),
    ]);
    // More reps at the same weight beats the first time it was lifted.
    expect(records.lifts).toEqual([
      { exerciseId: 'bb-back-squat', name: 'Back Squat', loadKg: 100, reps: 8, on: at(10, 3) },
    ]);
    expect(records.distances).toEqual([{ kind: 'runWalk', amount: 12, on: at(10, 3) }]);
    expect(records.reps).toEqual({ name: 'Push Up', reps: 40, on: at(10, 5) });
    expect(personalRecords([])).toEqual({ lifts: [], distances: [], reps: null });
  });
});
