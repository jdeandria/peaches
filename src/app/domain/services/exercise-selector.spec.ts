import { SeededRandom } from '../core/random';
import { ExerciseCatalog } from '../exercises/exercise-catalog';
import { isCore, isPull, isPush } from '../exercises/taxonomy';
import { ExerciseSelector, SelectionContext } from './exercise-selector';
import { SessionPlan, SessionPlanner, slot } from './session-planner';

describe('ExerciseSelector', () => {
  const catalog = ExerciseCatalog.standard();
  const planner = new SessionPlanner();
  const selector = new ExerciseSelector();
  const bodyweight = catalog.performableWith(new Set());
  const plan = planner.plan('fullBody', 'generalFitness', 45);
  const ctx = (c: Partial<SelectionContext> = {}): SelectionContext => ({
    targetDifficulty: 2,
    ...c,
  });

  it('is deterministic for a seed', () => {
    const run = (seed: number) =>
      selector.select(plan, bodyweight, ctx(), new SeededRandom(seed)).map((s) => s.exercise.id);
    expect(run(7)).toEqual(run(7));
    expect(run(123456)).toEqual(run(123456));
  });

  it('different seeds explore different selections', () => {
    const runs = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      runs.add(
        selector
          .select(plan, bodyweight, ctx(), new SeededRandom(seed))
          .map((s) => s.exercise.id)
          .join(),
      );
    }
    expect(runs.size).toBeGreaterThan(15);
  });

  it('never repeats an exercise or a progression family', () => {
    for (let seed = 0; seed < 50; seed++) {
      const picks = selector.select(
        plan,
        bodyweight,
        ctx({ targetDifficulty: 2.5 }),
        new SeededRandom(seed),
      );
      const ids = picks.map((s) => s.exercise.id);
      expect(new Set(ids).size, `seed ${seed}`).toBe(ids.length);
      const families = picks.map((s) => s.exercise.family).filter((f) => f !== null);
      expect(new Set(families).size, `seed ${seed}`).toBe(families.length);
    }
  });

  it('fills every required slot when the pool is rich', () => {
    const required = plan.blocks.flatMap((b) => b.slots).filter((s) => !s.optional).length;
    for (let seed = 0; seed < 20; seed++) {
      const picks = selector.select(plan, bodyweight, ctx(), new SeededRandom(seed));
      expect(picks.length, `seed ${seed}`).toBeGreaterThanOrEqual(required);
      const strength = picks.filter((p) => p.block === 'strength').map((p) => p.exercise.pattern);
      expect(strength.some(isPush), `seed ${seed}`).toBe(true);
      expect(strength.some(isPull), `seed ${seed}`).toBe(true);
      expect(strength.some(isCore), `seed ${seed}`).toBe(true);
    }
  });

  it('picks only from the slot patterns (or its fallbacks)', () => {
    for (let seed = 0; seed < 20; seed++) {
      for (const p of selector.select(plan, catalog.all, ctx(), new SeededRandom(seed))) {
        expect([...p.slot.patterns, ...p.slot.fallbackPatterns], p.exercise.id).toContain(
          p.exercise.pattern,
        );
      }
    }
  });

  it('respects the difficulty cap', () => {
    for (let seed = 0; seed < 20; seed++) {
      const picks = selector.select(
        plan,
        catalog.all,
        ctx({ targetDifficulty: 1, maxDifficulty: 2 }),
        new SeededRandom(seed),
      );
      for (const p of picks) expect(p.exercise.difficulty, p.exercise.id).toBeLessThanOrEqual(2);
    }
  });

  it('respects slot modality restrictions', () => {
    const condPlan = planner.plan('conditioning', 'generalFitness', 40);
    for (let seed = 0; seed < 20; seed++) {
      const picks = selector.select(condPlan, bodyweight, ctx(), new SeededRandom(seed));
      for (const p of picks.filter((x) => x.block === 'conditioning')) {
        expect(['conditioning', 'power'], p.exercise.id).toContain(p.exercise.modality);
      }
    }
  });

  it('skips slots gracefully when the pool is tiny', () => {
    const tiny = catalog.byIds(['bw-push-up', 'bw-air-squat', 'mob-cat-cow']);
    for (let seed = 0; seed < 10; seed++) {
      const picks = selector.select(plan, tiny, ctx(), new SeededRandom(seed));
      expect(new Set(picks.map((p) => p.exercise.id))).toEqual(
        new Set(['bw-push-up', 'bw-air-squat', 'mob-cat-cow']),
      );
    }
  });

  it('returns nothing for an empty pool', () => {
    expect(selector.select(plan, [], ctx(), new SeededRandom(1))).toEqual([]);
  });

  it('uses fallback patterns when primary patterns are absent', () => {
    // No pulling exercises at all: the pull slot should fall back to isolation.
    const noPull = bodyweight.filter((e) => !isPull(e.pattern));
    for (let seed = 0; seed < 20; seed++) {
      const picks = selector.select(plan, noPull, ctx(), new SeededRandom(seed));
      const pullSlot = picks.filter((p) => p.slot.label === 'Pull');
      expect(pullSlot.length, `seed ${seed}`).toBe(1);
      expect(pullSlot[0].exercise.pattern).toBe('isolation');
    }
  });

  it('prefers first-choice patterns over later ones', () => {
    // Knee dominant slot: [squat, lunge]. Squat should win clearly more often.
    const kneePlan: SessionPlan = {
      focus: 'lowerBody',
      goal: 'generalFitness',
      durationMinutes: 20,
      blocks: [{ type: 'warmUp', slots: [slot({ patterns: ['squat', 'lunge'] })] }],
    };
    const pool = bodyweight.filter((e) => e.pattern === 'squat' || e.pattern === 'lunge');
    const squats = pool.filter((e) => e.pattern === 'squat').length / pool.length;
    let hits = 0;
    const trials = 400;
    for (let seed = 0; seed < trials; seed++) {
      const [pick] = selector.select(kneePlan, pool, ctx(), new SeededRandom(seed));
      if (pick.exercise.pattern === 'squat') hits++;
    }
    expect(hits / trials).toBeGreaterThan(squats);
  });

  it('strongly avoids recently used exercises', () => {
    const pool = catalog.byIds([
      'bw-push-up',
      'bw-knee-push-up',
      'bw-incline-push-up',
      'bw-wide-push-up',
      'bw-diamond-push-up',
    ]);
    const pushPlan: SessionPlan = {
      focus: 'upperBody',
      goal: 'generalFitness',
      durationMinutes: 20,
      blocks: [{ type: 'strength', slots: [slot({ patterns: ['horizontalPush'] })] }],
    };
    let lastRoundHits = 0;
    let unpenalisedHits = 0;
    const trials = 400;
    for (let seed = 0; seed < trials; seed++) {
      const pick = selector.select(
        pushPlan,
        pool,
        ctx({ recentUse: new Map([['bw-push-up', 0]]) }),
        new SeededRandom(seed),
      );
      expect(pick.length).toBe(1);
      if (pick[0].exercise.id === 'bw-push-up') lastRoundHits++;
      const free = selector.select(pushPlan, pool, ctx(), new SeededRandom(seed));
      if (free[0].exercise.id === 'bw-push-up') unpenalisedHits++;
    }
    // Unpenalised and with similar difficulty it would be picked ~1/5 of the
    // time; the recency penalty should make it clearly rarer than that.
    expect(lastRoundHits / trials).toBeLessThan(0.1);
    expect(unpenalisedHits).toBeGreaterThan(lastRoundHits);
  });

  it('every pick is reproducible from the same random stream', () => {
    // Selection consumes exactly one random draw per filled slot, so two
    // selectors sharing a seed stay in lockstep.
    const a = new SeededRandom(5);
    const b = new SeededRandom(5);
    const picks = selector.select(plan, bodyweight, ctx(), a);
    picks.forEach(() => b.nextDouble());
    expect(a.nextDouble()).toBe(b.nextDouble());
  });
});
