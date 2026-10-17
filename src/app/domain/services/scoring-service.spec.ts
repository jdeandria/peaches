import { Pledge } from '../models/lineup';
import {
  categoryWeights,
  DEFAULT_LINEUP_RULES,
  DEFAULT_WEIGHTS,
  ScoringRules,
  ZERO_TOTALS,
} from '../models/scoring';
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

  describe('a week with a lineup', () => {
    const rules: ScoringRules = {
      weights: categoryWeights({
        runWalk: 25,
        weightMoved: 20,
        activeMinutes: 20,
        reps: 20,
        ride: 10,
        swimRow: 5,
      }),
      lineup: DEFAULT_LINEUP_RULES,
    };
    const mine = { ...ZERO_TOTALS, runWalk: 16.2, weightMoved: 8400, activeMinutes: 195 };
    const theirs = { ...ZERO_TOTALS, runWalk: 9, weightMoved: 12000, activeMinutes: 140 };
    const pledges: Pledge[] = [
      { category: 'runWalk', target: 15 },
      { category: 'weightMoved', target: 10000 },
      { category: 'activeMinutes', target: 180 },
    ];

    it('adds pledge bonuses for pledges hit and battles won to workout points', () => {
      const week = service.scoreWeek(mine, theirs, pledges, rules);
      // 16.2 km = 81, 8,400 kg = 33.6, 195 min = 86.67.
      expect(week.workouts.total).toBe(201.27);
      // Half of what 15 km (75) and 180 min (80) are worth; 10,000 kg was missed.
      expect(week.pledges.map((p) => [p.hit, p.points])).toEqual([
        [true, 37.5],
        [false, 0],
        [true, 40],
      ]);
      // One par of each category won: running and minutes, not weight.
      expect(week.battles.map((b) => [b.outcome, b.points])).toEqual([
        ['win', 25],
        ['loss', 0],
        ['win', 20],
      ]);
      expect(week.total).toBe(323.77);
    });

    it('the Crate’s rules size the bonuses', () => {
      const richer = { ...rules, lineup: { slots: 3, pledgeBonus: 100, battlePars: 2 } };
      const week = service.scoreWeek(mine, theirs, pledges, richer);
      expect(week.pledges[0].points).toBe(75);
      expect(week.battles[0].points).toBe(50);
    });

    it('ties split a battle, but nothing for nothing', () => {
      const both = [
        { category: 'runWalk', target: 5 },
        { category: 'ride', target: 20 },
      ] as Pledge[];
      const week = service.scoreWeek(mine, { ...theirs, runWalk: 16.2 }, both, rules);
      expect(week.battles.map((b) => [b.outcome, b.points])).toEqual([
        ['tie', 12.5],
        ['tie', 0],
      ]);
    });

    it('a bye has pledges but no battles', () => {
      const week = service.scoreWeek(mine, null, pledges, rules);
      expect(week.battles).toEqual([]);
      expect(week.total).toBe(201.27 + 77.5);
    });

    it('scores both sides of a matchup against each other', () => {
      const { home, away } = service.scoreMatchup(
        { logs: [run5k], pledges: [{ category: 'runWalk', target: 5 }] },
        { logs: [lifting], pledges: [{ category: 'weightMoved', target: 5000 }] },
        rules,
      );
      // Home hit 5 km and out-ran away; away missed 5,000 kg but out-lifted home.
      expect(home.pledges[0].hit).toBe(true);
      expect(home.battles[0].outcome).toBe('win');
      expect(away!.pledges[0].hit).toBe(false);
      expect(away!.battles[0].outcome).toBe('win');
    });
  });
});
