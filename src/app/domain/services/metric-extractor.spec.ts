import { exerciseLogEntry, setLog, workoutLog } from '../models/workout-log';
import { MetricExtractor } from './metric-extractor';

describe('MetricExtractor', () => {
  const startedAt = new Date(Date.UTC(2026, 0, 1));

  it('credits distance to the entry’s distance kind', () => {
    const log = workoutLog({
      id: 'l',
      peachId: 'p',
      startedAt,
      entries: [
        exerciseLogEntry({
          exerciseId: 'bw-run',
          distanceKind: 'runWalk',
          sets: [setLog({ meters: 3000 }), setLog({ meters: 2000 })],
        }),
        exerciseLogEntry({
          exerciseId: 'outdoor-cycling',
          distanceKind: 'ride',
          sets: [setLog({ meters: 20_000, seconds: 3600 })],
        }),
        exerciseLogEntry({
          exerciseId: 'row-steady',
          distanceKind: 'swimRow',
          sets: [setLog({ meters: 1500 })],
        }),
        // A carry covers metres but is not travel.
        exerciseLogEntry({
          exerciseId: 'db-farmer-carry',
          sets: [setLog({ meters: 40, loadKg: 24 })],
        }),
      ],
    });
    const totals = MetricExtractor.extract(log);
    expect(totals.runWalk).toBe(5);
    expect(totals.ride).toBe(20);
    expect(totals.swimRow).toBe(1500);
    expect(totals.activeMinutes).toBe(60);
    expect(totals.weightMoved).toBe(0);
  });

  it('counts every rep, and reps × load as weight moved', () => {
    const log = workoutLog({
      id: 'l',
      peachId: 'p',
      startedAt,
      entries: [
        exerciseLogEntry({ exerciseId: 'bw-push-up', sets: [setLog({ reps: 25 })] }),
        exerciseLogEntry({
          exerciseId: 'db-row',
          sets: [setLog({ reps: 10, loadKg: 20 }), setLog({ reps: 8, loadKg: 22.5 })],
        }),
      ],
    });
    const totals = MetricExtractor.extract(log);
    expect(totals.reps).toBe(43);
    expect(totals.weightMoved).toBe(380);
    expect(totals.runWalk).toBe(0);
  });

  it('active minutes fall back to the session’s time on the clock', () => {
    const yoga = workoutLog({
      id: 'l',
      peachId: 'p',
      startedAt,
      durationSeconds: 3600,
      entries: [exerciseLogEntry({ exerciseId: 'custom-yoga', sets: [setLog({ seconds: 600 })] })],
    });
    expect(MetricExtractor.extract(yoga).activeMinutes).toBe(60);
    // Timed sets win when they add up to more than the clock.
    expect(MetricExtractor.extract({ ...yoga, durationSeconds: 300 }).activeMinutes).toBe(10);
    expect(MetricExtractor.extract({ ...yoga, durationSeconds: 0 }).activeMinutes).toBe(10);
  });
});
