import { isPerformableWith } from '../exercises/exercise';
import { ExerciseCatalog } from '../exercises/exercise-catalog';
import { exerciseLogEntry, setLog } from '../models/workout-log';
import { templateWorkout, WORKOUT_TEMPLATES } from './workout-templates';

describe('workout templates', () => {
  const catalog = ExerciseCatalog.standard();
  const ids = (workout: { exerciseId: string }[]) => workout.map((e) => e.exerciseId);

  it('fill every slot with a fitting, different exercise the kit allows', () => {
    for (const template of WORKOUT_TEMPLATES) {
      for (let seed = 1; seed <= 25; seed++) {
        const workout = templateWorkout(template, catalog, seed);
        expect(workout.length, `${template.id} #${seed}`).toBe(template.slots.length);
        expect(new Set(ids(workout)).size).toBe(workout.length);
        workout.forEach((entry, i) => {
          const e = catalog.require(entry.exerciseId);
          expect(template.slots[i].patterns).toContain(e.pattern);
          expect(isPerformableWith(e, new Set(template.equipment))).toBe(true);
          expect(e.difficulty).toBeLessThanOrEqual(3);
          expect(entry.sets.length).toBeGreaterThan(0);
        });
      }
    }
  });

  it('the same seed gives the same workout; others vary it', () => {
    const fullBody = WORKOUT_TEMPLATES.find((t) => t.id === 'full-body')!;
    expect(templateWorkout(fullBody, catalog, 7)).toEqual(templateWorkout(fullBody, catalog, 7));
    const variants = new Set(
      Array.from({ length: 20 }, (_, seed) => ids(templateWorkout(fullBody, catalog, seed)).join()),
    );
    expect(variants.size).toBeGreaterThan(5);
  });

  it('sets come out sensible for how each exercise is measured', () => {
    for (const template of WORKOUT_TEMPLATES) {
      for (const entry of templateWorkout(template, catalog, 3)) {
        for (const s of entry.sets) {
          if (entry.track === 'distance') {
            expect(s.meters).toBeGreaterThanOrEqual(3000);
            expect(s.meters).toBeLessThanOrEqual(6000);
            expect(entry.sets).toHaveLength(1);
          } else if (entry.track === 'time') {
            expect(s.seconds).toBeGreaterThanOrEqual(30);
          } else {
            expect(s.reps).toBeGreaterThanOrEqual(8);
          }
        }
      }
    }
  });

  it('weights come from last time; otherwise they are left to set', () => {
    const upper = WORKOUT_TEMPLATES.find((t) => t.id === 'upper-body')!;
    const fresh = templateWorkout(upper, catalog, 11);
    const loaded = fresh.find((e) => e.takesLoad)!;
    expect(loaded.sets.every((s) => s.loadKg === null)).toBe(true);
    const withHistory = templateWorkout(upper, catalog, 11, (id) =>
      id === loaded.exerciseId
        ? exerciseLogEntry({ exerciseId: id, sets: [setLog({ reps: 8, loadKg: 42.5 })] })
        : null,
    );
    const again = withHistory.find((e) => e.exerciseId === loaded.exerciseId)!;
    expect(again.sets.every((s) => s.loadKg === 42.5)).toBe(true);
  });

  it('a location’s equipment narrows the kit', () => {
    const upper = WORKOUT_TEMPLATES.find((t) => t.id === 'upper-body')!;
    const home = new Set(['dumbbell', 'bench'] as const);
    for (let seed = 1; seed <= 15; seed++) {
      for (const entry of templateWorkout(upper, catalog, seed, () => null, home)) {
        expect(isPerformableWith(catalog.require(entry.exerciseId), home)).toBe(true);
      }
    }
  });
});
