import { exerciseLogEntry, SetLog, setLog } from '../models/workout-log';
import { implausibility } from './plausibility';

describe('implausibility', () => {
  const entry = (sets: SetLog[], distanceKind: 'runWalk' | 'ride' | null = null) =>
    exerciseLogEntry({ exerciseId: 'x', exerciseName: 'X', distanceKind, sets });

  it('accepts ordinary training', () => {
    expect(implausibility(entry([setLog({ reps: 12, loadKg: 60 })]))).toBeNull();
    expect(
      implausibility(entry([setLog({ meters: 10_000, seconds: 3000 })], 'runWalk')),
    ).toBeNull();
    expect(implausibility(entry([setLog({ meters: 80_000, seconds: 10_800 })], 'ride'))).toBeNull();
  });

  it('rejects impossible numbers', () => {
    expect(implausibility(entry([setLog({ reps: 5000 })]))).toContain('reps');
    expect(implausibility(entry([setLog({ reps: 1, loadKg: 900 })]))).toContain('heavy');
    expect(implausibility(entry([setLog({ seconds: 30_000 })]))).toContain('6 hours');
    expect(implausibility(entry([setLog({ reps: -3 })]))).toContain('negative');
  });

  it('checks distance and pace by kind', () => {
    // A marathon in 20 minutes.
    expect(implausibility(entry([setLog({ meters: 42_195, seconds: 1200 })], 'runWalk'))).toContain(
      'pace',
    );
    // The same speed is fine on a bike.
    expect(implausibility(entry([setLog({ meters: 20_000, seconds: 1200 })], 'ride'))).toBeNull();
    expect(implausibility(entry([setLog({ meters: 200_000 })], 'runWalk'))).toContain('too far');
    // Untracked distance (a carry) is capped low.
    expect(implausibility(entry([setLog({ meters: 20_000 })]))).toContain('too far');
  });

  it('names the set at fault', () => {
    const problem = implausibility(entry([setLog({ reps: 10 }), setLog({ reps: 4000 })]));
    expect(problem).toMatch(/^X, set 2/);
  });
});
