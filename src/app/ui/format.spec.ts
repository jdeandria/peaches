import { exerciseLogEntry, ExerciseLogEntry } from '../domain/models/workout-log';
import { Fmt } from './format';

/** Human-readable labels and formats. */
describe('Fmt', () => {
  const entry = (loads: (number | null)[]): ExerciseLogEntry =>
    exerciseLogEntry({
      exerciseId: 'bb-back-squat',
      workoutItemId: 'w-1-i0',
      sets: loads.map((kg) => ({ reps: 5, loadKg: kg, seconds: null, meters: null })),
    });

  describe('loggedLoad', () => {
    it('is null without weights', () => {
      expect(Fmt.loggedLoad(entry([null, null]), 'metric')).toBeNull();
    });

    it('collapses equal weights and shows a range otherwise', () => {
      expect(Fmt.loggedLoad(entry([60, 60, 60]), 'metric')).toBe('Lifted 60 kg');
      expect(Fmt.loggedLoad(entry([60, 62.5, null]), 'metric')).toBe('Lifted 60–62.5 kg');
    });

    it('converts to pounds', () => {
      expect(Fmt.loggedLoad(entry([61.234986]), 'imperial')).toBe('Lifted 135 lb');
    });
  });

  it('volume groups thousands in the chosen units', () => {
    expect(Fmt.volume(2450, 'metric')).toBe('2,450 kg');
    expect(Fmt.volume(1000, 'imperial')).toBe('2,205 lb');
  });
});
