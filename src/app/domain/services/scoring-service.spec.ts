import {
  categoryWeights,
  DEFAULT_PLAN_RULES,
  DEFAULT_WEIGHTS,
  ScoringRules,
  ZERO_TOTALS,
} from '../models/scoring';
import { exerciseLogEntry, setLog, WorkoutLog, workoutLog } from '../models/workout-log';
import { plannedSessionSeconds, ScoringService } from './scoring-service';

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
    const together = service.scoreTotals(service.totalsOf([run5k, lifting]), DEFAULT_WEIGHTS);
    const apart =
      service.scoreLog(run5k, DEFAULT_WEIGHTS).total +
      service.scoreLog(lifting, DEFAULT_WEIGHTS).total;
    expect(together.total).toBeCloseTo(apart, 1);
    expect(service.scoreTotals(service.totalsOf([]), DEFAULT_WEIGHTS)).toEqual({
      categories: [],
      total: 0,
    });
  });

  it('a plan is worth what its target sets would earn', () => {
    const weights = categoryWeights({ runWalk: 25, activeMinutes: 25, reps: 50 });
    // Same sets as the 5 km run: 5 km and 25 minutes of timed sets.
    expect(service.scorePlan(run5k.entries, weights).total).toBe(38.89);
    expect(service.scorePlan([], weights).total).toBe(0);
    // Untimed sets count two minutes each with their rest: 2 sets = 4 of 45 minutes.
    const lifts = service.scorePlan(lifting.entries, categoryWeights({ activeMinutes: 100 }));
    expect(lifts.categories.find((c) => c.category === 'activeMinutes')).toEqual({
      category: 'activeMinutes',
      amount: 4,
      points: 8.89,
    });
    // A timed set adds a minute's rest.
    expect(
      plannedSessionSeconds([
        exerciseLogEntry({ exerciseId: 'plank', sets: [setLog({ seconds: 60 })] }),
      ]),
    ).toBe(120);
  });

  describe('a week with a plan', () => {
    const rules: ScoringRules = {
      weights: categoryWeights({
        runWalk: 25,
        weightMoved: 20,
        activeMinutes: 20,
        reps: 20,
        ride: 10,
        swimRow: 5,
      }),
      plan: DEFAULT_PLAN_RULES,
    };
    // 16.2 km = 81, 8,400 kg = 33.6, 195 min = 86.67: 201.27 points.
    const mine = { ...ZERO_TOTALS, runWalk: 16.2, weightMoved: 8400, activeMinutes: 195 };

    it('hitting the plan earns the bonus on what was committed', () => {
      const week = service.scoreWeek(mine, 180, rules);
      expect(week.workouts.total).toBe(201.27);
      expect(week).toMatchObject({ committed: 180, hit: true, plan: 45 });
      expect(week.total).toBe(246.27);
    });

    it('falling short costs the penalty on every point missed', () => {
      const week = service.scoreWeek(mine, 261.27, rules);
      // 60 short at 50%.
      expect(week).toMatchObject({ hit: false, plan: -30 });
      expect(week.total).toBe(171.27);
    });

    it('exactly hitting it counts as a hit', () => {
      expect(service.scoreWeek(mine, 201.27, rules).hit).toBe(true);
    });

    it('no plan, no bonus and no penalty', () => {
      const week = service.scoreWeek(mine, 0, rules);
      expect(week).toMatchObject({ committed: 0, hit: true, plan: 0, total: 201.27 });
    });

    it('the Crate’s rules size the bonus and penalty', () => {
      const harsh = { ...rules, plan: { bonus: 50, penalty: 100 } };
      expect(service.scoreWeek(mine, 200, harsh).plan).toBe(100);
      expect(service.scoreWeek(mine, 300, harsh).plan).toBe(-98.73);
      // A big enough miss scores below zero.
      expect(service.scoreWeek(ZERO_TOTALS, 100, harsh).total).toBe(-100);
    });

    it('scores both sides of a matchup', () => {
      const { home, away } = service.scoreMatchup(
        { logs: [run5k], committed: 20 },
        { logs: [lifting], committed: 50 },
        rules,
      );
      expect(home.hit).toBe(true);
      expect(away!.hit).toBe(false);
      expect(service.scoreMatchup({ logs: [], committed: 0 }, null, rules).away).toBeNull();
    });
  });
});
