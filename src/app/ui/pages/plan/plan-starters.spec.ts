import { ExerciseCatalog } from '../../../domain/exercises/exercise-catalog';
import { loggableFromCatalog } from '../../../domain/exercises/loggable';
import { entryOf, setLog } from '../../../domain/models/workout-log';
import { defaultEntry, suggestName } from './plan-starters';

describe('defaultEntry', () => {
  const catalog = ExerciseCatalog.standard();
  const exercise = (id: string) => loggableFromCatalog(catalog.require(id));

  it('plans last time’s sets when there are some', () => {
    const squat = exercise('bb-back-squat');
    const last = entryOf(squat, { sets: [setLog({ reps: 5, loadKg: 100 })], rpe: 8 });
    const entry = defaultEntry(squat, last);
    expect(entry.sets).toEqual(last.sets);
    expect(entry.rpe).toBeNull();
  });

  it('otherwise starts sensibly, with no numbers asked for', () => {
    expect(defaultEntry(exercise('bw-push-up'), null).sets).toEqual(
      [1, 2, 3].map(() => setLog({ reps: 10 })),
    );
    expect(defaultEntry(exercise('bw-forearm-plank'), null).sets).toEqual(
      [1, 2, 3].map(() => setLog({ seconds: 30 })),
    );
    // A run is one solid session's distance: the par, 5 km.
    expect(defaultEntry(exercise('bw-run'), null).sets).toEqual([setLog({ meters: 5000 })]);
  });

  it('names a workout from its exercises', () => {
    const one = defaultEntry(exercise('bw-push-up'), null);
    const two = defaultEntry(exercise('bw-run'), null);
    expect(suggestName([one])).toBe('Push Up');
    expect(suggestName([one, two])).toBe('Push Up & Run');
  });
});
