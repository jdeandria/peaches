import { localDate } from '../core/local-date';
import { isLocked } from './commitment';
import {
  daysOf,
  emptyPlan,
  isInWeek,
  PlannedWorkout,
  removeWorkout,
  upsertWorkout,
  workoutsOn,
} from './week-plan';

describe('week plans', () => {
  const now = new Date(Date.UTC(2026, 9, 10));
  const monday = localDate(2026, 10, 12);
  const workout = (id: string, day: number): PlannedWorkout => ({
    id,
    day: localDate(2026, 10, day),
    name: id,
    locationId: null,
    exercises: [],
    logId: null,
  });

  it('start on the Monday and cover seven days', () => {
    expect(emptyPlan('p', localDate(2026, 10, 15), now).weekStart).toBe(monday);
    expect(daysOf(monday)).toHaveLength(7);
    expect(daysOf(monday).at(-1)).toBe(localDate(2026, 10, 18));
    expect(isInWeek(monday, localDate(2026, 10, 18))).toBe(true);
    expect(isInWeek(monday, localDate(2026, 10, 19))).toBe(false);
  });

  it('keep workouts in day order, a moved one last on its new day', () => {
    let plan = emptyPlan('p', monday, now);
    plan = upsertWorkout(plan, workout('thu', 15));
    plan = upsertWorkout(plan, workout('mon', 12));
    plan = upsertWorkout(plan, workout('thu2', 15));
    expect(plan.workouts.map((w) => w.id)).toEqual(['mon', 'thu', 'thu2']);
    // Renaming in place keeps its spot.
    plan = upsertWorkout(plan, { ...workout('thu', 15), name: 'Legs' });
    expect(plan.workouts.map((w) => w.name)).toEqual(['mon', 'Legs', 'thu2']);
    plan = upsertWorkout(plan, workout('mon', 15));
    expect(plan.workouts.map((w) => w.id)).toEqual(['thu', 'thu2', 'mon']);
    expect(workoutsOn(plan, localDate(2026, 10, 15))).toHaveLength(3);
    expect(removeWorkout(plan, 'thu').workouts.map((w) => w.id)).toEqual(['thu2', 'mon']);
  });

  it('commitments lock when the week starts', () => {
    const locksAt = new Date(Date.UTC(2026, 9, 12));
    expect(isLocked({ locksAt }, new Date(locksAt.getTime() - 1))).toBe(false);
    expect(isLocked({ locksAt }, locksAt)).toBe(true);
  });
});
