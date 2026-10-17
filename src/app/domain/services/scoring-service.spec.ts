import { categoryWeights, DEFAULT_WEIGHTS } from '../models/scoring';
import { matchup, winnerId } from '../models/season';
import { exerciseLogEntry, setLog, WorkoutLog, workoutLog } from '../models/workout-log';
import { ScoringService } from './scoring-service';

describe('ScoringService', () => {
  const service = new ScoringService();
  const now = new Date(Date.UTC(2026, 0, 1));

  function log(id: string, ...entries: Parameters<typeof exerciseLogEntry>[0][]): WorkoutLog {
    return workoutLog({ id, peachId: 'p', startedAt: now, entries: entries.map(exerciseLogEntry) });
  }

  const run5k = log('run', {
    exerciseId: 'bw-run',
    distanceKind: 'runWalk',
    sets: [setLog({ meters: 5000, seconds: 1500 })],
  });
  const lifting = log('lift', {
    exerciseId: 'bb-back-squat',
    sets: [setLog({ reps: 10, loadKg: 100 }), setLog({ reps: 10, loadKg: 100 })],
  });

  it('earns each category its weight per par', () => {
    const weights = categoryWeights({ runWalk: 25, activeMinutes: 25, reps: 50 });
    const score = service.scoreLog(run5k, weights);
    // 5 km = one par of running; 25 min of 45 = 0.56 par of active minutes.
    expect(score.categories).toEqual([
      { category: 'runWalk', amount: 5, points: 25 },
      { category: 'activeMinutes', amount: 25, points: 13.89 },
    ]);
    expect(score.total).toBe(38.89);
  });

  it('scores reps and weight moved separately', () => {
    const score = service.scoreLog(lifting, DEFAULT_WEIGHTS);
    // 20 reps of 150 at 20 pts; 2,000 kg of 5,000 at 20 pts.
    expect(score.categories).toEqual([
      { category: 'weightMoved', amount: 2000, points: 8 },
      { category: 'reps', amount: 20, points: 2.67 },
    ]);
  });

  it('a category with no weight earns nothing but is still reported', () => {
    const weights = categoryWeights({ reps: 100 });
    const score = service.scoreLog(run5k, weights);
    expect(score.total).toBe(0);
    expect(score.categories.map((c) => c.category)).toEqual(['runWalk', 'activeMinutes']);
  });

  it('several logs score the same as their combined totals', () => {
    const together = service.scoreLogs([run5k, lifting], DEFAULT_WEIGHTS).total;
    const apart =
      service.scoreLog(run5k, DEFAULT_WEIGHTS).total +
      service.scoreLog(lifting, DEFAULT_WEIGHTS).total;
    expect(together).toBeCloseTo(apart, 1);
    expect(service.scoreLogs([], DEFAULT_WEIGHTS)).toEqual({ categories: [], total: 0 });
  });

  it('resolves a matchup from each side’s logs', () => {
    const m = matchup({ id: 'm', seasonId: 's', roundId: 'r', homePeachId: 'a', awayPeachId: 'b' });
    const resolved = service.resolve({
      matchup: m,
      homeLogs: [run5k],
      awayLogs: [lifting, lifting],
      weights: DEFAULT_WEIGHTS,
    });
    expect(resolved.status).toBe('complete');
    expect(resolved.result!.homePoints).toBe(service.scoreLog(run5k, DEFAULT_WEIGHTS).total);
    expect(winnerId(resolved)).toBe('a');

    const crateOfLifters = categoryWeights({ weightMoved: 100 });
    const flipped = service.resolve({
      matchup: m,
      homeLogs: [run5k],
      awayLogs: [lifting],
      weights: crateOfLifters,
    });
    expect(winnerId(flipped)).toBe('b');
  });

  it('a bye scores only the home side', () => {
    const bye = matchup({ id: 'm', seasonId: 's', roundId: 'r', homePeachId: 'a' });
    const resolved = service.resolve({
      matchup: bye,
      homeLogs: [run5k],
      awayLogs: [run5k],
      weights: DEFAULT_WEIGHTS,
    });
    expect(resolved.result!.awayPoints).toBe(0);
    expect(resolved.result!.homePoints).toBeGreaterThan(0);
  });
});
