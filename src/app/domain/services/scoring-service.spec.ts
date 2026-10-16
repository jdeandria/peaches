import { matchup, winnerId } from '../models/season';
import { itemPoints, scoreTotal, ZERO_SCORE } from '../models/score';
import { scoringRules, STANDARD_SCORING_RULES } from '../models/scoring-rules';
import { prescription, Workout } from '../models/workout';
import {
  ExerciseLogEntry,
  exerciseLogEntry,
  setLog,
  WorkoutLog,
  workoutLog,
} from '../models/workout-log';
import { ScoringService } from './scoring-service';

describe('ScoringService', () => {
  const service = new ScoringService();
  const now = new Date(Date.UTC(2026, 0, 1));

  const workout: Workout = {
    id: 'w',
    title: null,
    blocks: [
      {
        type: 'warmUp',
        items: [
          {
            id: 'warm',
            exerciseId: 'mob-cat-cow',
            prescription: prescription({ sets: 1, reps: 10, restSeconds: 0 }),
            scoringWeight: 0,
          },
        ],
      },
      {
        type: 'strength',
        items: [
          {
            id: 'squat',
            exerciseId: 'bw-air-squat',
            prescription: prescription({ sets: 3, reps: 10, restSeconds: 60 }),
            scoringWeight: 1,
          },
          {
            id: 'plank',
            exerciseId: 'bw-side-plank',
            prescription: prescription({ sets: 2, seconds: 30, restSeconds: 30, perSide: true }),
            scoringWeight: 0.5,
          },
          {
            id: 'carry',
            exerciseId: 'db-farmer-carry',
            prescription: prescription({ sets: 2, meters: 40, restSeconds: 60 }),
            scoringWeight: 1,
          },
        ],
      },
    ],
    focus: 'fullBody',
    goal: 'generalFitness',
    targetDifficulty: 2,
    estimatedMinutes: 20,
    seed: 0,
    generatorVersion: 1,
    createdAt: now,
  };

  const log = (entries: ExerciseLogEntry[]): WorkoutLog =>
    workoutLog({
      id: 'l',
      peachId: 'p',
      workoutId: 'w',
      startedAt: now,
      entries,
      status: 'submitted',
    });

  const squat = (...reps: number[]) =>
    exerciseLogEntry({
      exerciseId: 'bw-air-squat',
      workoutItemId: 'squat',
      sets: reps.map((r) => setLog({ reps: r })),
    });
  const plank = (...seconds: number[]) =>
    exerciseLogEntry({
      exerciseId: 'bw-side-plank',
      workoutItemId: 'plank',
      sets: seconds.map((s) => setLog({ seconds: s })),
    });
  const carry = (...meters: number[]) =>
    exerciseLogEntry({
      exerciseId: 'db-farmer-carry',
      workoutItemId: 'carry',
      sets: meters.map((m) => setLog({ meters: m })),
    });

  describe('score', () => {
    it('full completion earns all item points plus the bonus', () => {
      const s = service.score(
        workout,
        log([squat(10, 10, 10), plank(30, 30, 30, 30), carry(40, 40)]),
      );
      expect(s.items.length).toBe(3);
      expect(itemPoints(s)).toBe(10 + 5 + 10);
      expect(s.completionBonus).toBe(STANDARD_SCORING_RULES.completionBonus);
      expect(scoreTotal(s)).toBe(35);
    });

    it('partial completion scores proportionally with no bonus', () => {
      const s = service.score(workout, log([squat(10, 5), plank(30, 30, 30, 30), carry(40, 40)]));
      const sq = s.items.find((i) => i.workoutItemId === 'squat')!;
      expect(sq.achievementRatio).toBe(0.5);
      expect(sq.points).toBe(5);
      expect(s.completionBonus).toBe(0);
      expect(scoreTotal(s)).toBe(20);
    });

    it('over-achievement is capped by the rules', () => {
      const s = service.score(workout, log([squat(100)]));
      const sq = s.items.find((i) => i.workoutItemId === 'squat')!;
      expect(sq.achievementRatio).toBe(STANDARD_SCORING_RULES.maxAchievementRatio);
      expect(sq.points).toBe(12.5);
    });

    it('missing log scores zero', () => {
      const s = service.score(workout, null);
      expect(scoreTotal(s)).toBe(0);
      expect(s.items.every((i) => i.points === 0)).toBe(true);
      expect(s.items.length).toBe(3);
    });

    it('free-form entries without an item id do not count', () => {
      const s = service.score(
        workout,
        log([exerciseLogEntry({ exerciseId: 'bw-air-squat', sets: [setLog({ reps: 30 })] })]),
      );
      expect(scoreTotal(s)).toBe(0);
    });

    it('logging the wrong unit for an item earns nothing for it', () => {
      const s = service.score(
        workout,
        log([
          exerciseLogEntry({
            exerciseId: 'bw-air-squat',
            workoutItemId: 'squat',
            sets: [setLog({ seconds: 600 })],
          }),
        ]),
      );
      expect(s.items.find((i) => i.workoutItemId === 'squat')!.points).toBe(0);
    });

    it('custom rules are honoured', () => {
      const s = service.score(
        workout,
        log([squat(27), plank(120), carry(80)]),
        scoringRules({ pointsPerItem: 20, completionBonus: 3, completionThreshold: 0.9 }),
      );
      expect(s.items.find((i) => i.workoutItemId === 'squat')!.points).toBe(18);
      expect(s.completionBonus).toBe(3);
    });

    it('rounds points to two decimals', () => {
      // 1/3 of the squat target: 10 * 1/3 = 3.333... -> 3.33.
      const s = service.score(workout, log([squat(10)]));
      expect(s.items.find((i) => i.workoutItemId === 'squat')!.points).toBe(3.33);
      // 2/3: 6.666... -> 6.67.
      const t = service.score(workout, log([squat(20)]));
      expect(t.items.find((i) => i.workoutItemId === 'squat')!.points).toBe(6.67);
      for (const item of t.items) {
        expect(Math.round(item.points * 100) / 100).toBe(item.points);
      }
    });

    it('a workout with no scored items scores zero', () => {
      const warmOnly: Workout = {
        ...workout,
        id: 'x',
        blocks: workout.blocks.slice(0, 1),
        targetDifficulty: 1,
        estimatedMinutes: 2,
      };
      expect(service.score(warmOnly, log([]))).toEqual(ZERO_SCORE);
    });

    it('an item with a zero target scores zero instead of dividing by zero', () => {
      // Possible only for data decoded from storage, which skips the
      // builder's invariant checks.
      const broken: Workout = {
        ...workout,
        blocks: [
          {
            type: 'strength',
            items: [
              {
                id: 'z',
                exerciseId: 'x',
                prescription: { ...prescription({ sets: 1, reps: 1, restSeconds: 0 }), reps: 0 },
                scoringWeight: 1,
              },
            ],
          },
        ],
      };
      const s = service.score(
        broken,
        log([
          exerciseLogEntry({ exerciseId: 'x', workoutItemId: 'z', sets: [setLog({ reps: 5 })] }),
        ]),
      );
      expect(s.items[0].points).toBe(0);
      expect(Number.isFinite(scoreTotal(s))).toBe(true);
    });
  });

  describe('resolve', () => {
    const m = matchup({
      id: 'm',
      seasonId: 's',
      roundId: 'r',
      homePeachId: 'home',
      awayPeachId: 'away',
    });

    it('resolves a matchup from both logs', () => {
      const resolved = service.resolve({
        matchup: m,
        workout,
        homeLog: log([squat(30)]),
        awayLog: null,
      });
      expect(resolved.status).toBe('complete');
      expect(resolved.result).toEqual({ homePoints: 10, awayPoints: 0 });
      expect(winnerId(resolved)).toBe('home');
      // The input is not mutated.
      expect(m.status).toBe('scheduled');
      expect(m.result).toBeNull();
    });

    it('a bye records points-for only', () => {
      const resolved = service.resolve({
        matchup: matchup({ id: 'm', seasonId: 's', roundId: 'r', homePeachId: 'home' }),
        workout,
        homeLog: log([squat(30)]),
        awayLog: log([squat(30), plank(120), carry(80)]),
      });
      expect(resolved.result?.homePoints).toBe(10);
      expect(resolved.result?.awayPoints).toBe(0);
      expect(winnerId(resolved)).toBeNull();
    });

    it('passes custom rules through to both sides', () => {
      const rules = scoringRules({ pointsPerItem: 1, completionBonus: 0 });
      const resolved = service.resolve({
        matchup: m,
        workout,
        homeLog: log([squat(30)]),
        awayLog: log([squat(15)]),
        rules,
      });
      expect(resolved.result).toEqual({ homePoints: 1, awayPoints: 0.5 });
      expect(winnerId(resolved)).toBe('home');
    });
  });
});
