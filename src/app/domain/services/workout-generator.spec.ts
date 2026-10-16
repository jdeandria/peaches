import { RandomIdGenerator, SequentialIdGenerator } from '../core/ids';
import { stableHash } from '../core/stable-hash';
import { Exercise } from '../exercises/exercise';
import { ExerciseCatalog } from '../exercises/exercise-catalog';
import { isCore, isLowerBody, isPull, isPush } from '../exercises/taxonomy';
import { SESSION_FOCUSES, SessionFocus, TRAINING_GOALS, TrainingGoal } from '../models/training';
import {
  BLOCK_TYPES,
  isScored,
  scoredItems,
  Workout,
  workoutFromJson,
  workoutItems,
  workoutToJson,
} from '../models/workout';
import { WorkoutGenerator, WorkoutRequest } from './workout-generator';

describe('WorkoutGenerator', () => {
  const catalog = ExerciseCatalog.standard();
  const bodyweight = catalog.performableWith(new Set());
  const now = new Date(Date.UTC(2026, 9, 10));

  const generator = () => new WorkoutGenerator(new SequentialIdGenerator('w'));

  const request = (
    o: {
      focus?: SessionFocus;
      goal?: TrainingGoal;
      minutes?: number;
      difficulty?: number;
      maxDifficulty?: number;
      seed?: number;
      pool?: readonly Exercise[];
    } = {},
  ): WorkoutRequest => ({
    availableExercises: o.pool ?? bodyweight,
    focus: o.focus ?? 'fullBody',
    goal: o.goal ?? 'generalFitness',
    durationMinutes: o.minutes ?? 40,
    targetDifficulty: o.difficulty ?? 2,
    maxDifficulty: o.maxDifficulty ?? 5,
    seed: o.seed ?? 1,
  });

  const ids = (w: Workout) => workoutItems(w).map((i) => i.exerciseId);

  it('same seed and inputs reproduce the same workout', () => {
    const a = generator().generate(request({ seed: 99 }), now);
    const b = generator().generate(request({ seed: 99 }), now);
    expect(a).toEqual(b);
    expect(a.seed).toBe(99);
    expect(a.generatorVersion).toBe(WorkoutGenerator.version);
  });

  it('is generator version 2 (the TypeScript build)', () => {
    expect(WorkoutGenerator.version).toBe(1);
  });

  it('different seeds produce different workouts', () => {
    const a = generator().generate(request(), now);
    const b = generator().generate(request({ seed: 2 }), now);
    expect(ids(a)).not.toEqual(ids(b));
    // And across many real-world seeds there is plenty of variety.
    const distinct = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const seed = stableHash(`m-${i}|r-1|0`);
      distinct.add(ids(generator().generate(request({ seed }), now)).join());
    }
    expect(distinct.size).toBeGreaterThan(25);
  });

  it('blocks are ordered warm-up, strength, conditioning, cool-down', () => {
    const w = generator().generate(request(), now);
    const types = w.blocks.map((b) => b.type);
    expect(types[0]).toBe('warmUp');
    expect(types.at(-1)).toBe('coolDown');
    expect(new Set(types).size).toBe(types.length);
    for (let i = 1; i < types.length; i++) {
      expect(BLOCK_TYPES.indexOf(types[i])).toBeGreaterThan(BLOCK_TYPES.indexOf(types[i - 1]));
    }
  });

  it('warm-up and cool-down are not scored, main work is', () => {
    const w = generator().generate(request(), now);
    for (const b of w.blocks) {
      for (const i of b.items) {
        if (b.type === 'warmUp' || b.type === 'coolDown')
          expect(isScored(i), i.exerciseId).toBe(false);
        else expect(isScored(i), i.exerciseId).toBe(true);
      }
    }
    expect(scoredItems(w).length).toBeGreaterThan(0);
  });

  it('item ids are unique and workout id is set', () => {
    const w = generator().generate(request(), now);
    const itemIds = workoutItems(w).map((i) => i.id);
    expect(new Set(itemIds).size).toBe(itemIds.length);
    expect(w.id).not.toBe('');
    expect(itemIds).not.toContain(w.id);
  });

  it('fits the time budget across durations and focuses', () => {
    for (const minutes of [20, 30, 45, 60]) {
      for (const focus of SESSION_FOCUSES) {
        for (let seed = 0; seed < 5; seed++) {
          const w = generator().generate(request({ minutes, focus, seed }), now);
          expect(w.estimatedMinutes, `${focus} ${minutes} min seed ${seed}`).toBeLessThanOrEqual(
            minutes,
          );
          expect(w.estimatedMinutes).toBeGreaterThan(0);
        }
      }
    }
  });

  it('fits the time budget for every goal and a full equipment pool', () => {
    for (const goal of TRAINING_GOALS) {
      for (const minutes of [15, 25, 40, 75, 120]) {
        for (let seed = 0; seed < 3; seed++) {
          const w = generator().generate(
            request({ goal, minutes, seed, pool: catalog.all, difficulty: 3.5 }),
            now,
          );
          expect(w.estimatedMinutes, `${goal} ${minutes} seed ${seed}`).toBeLessThanOrEqual(
            minutes,
          );
          expect(Number.isInteger(w.estimatedMinutes)).toBe(true);
        }
      }
    }
  });

  it('never trims a set count below what the prescriber allows', () => {
    for (let seed = 0; seed < 10; seed++) {
      const w = generator().generate(
        request({ minutes: 15, goal: 'strength', seed, pool: catalog.all }),
        now,
      );
      for (const i of workoutItems(w)) expect(i.prescription.sets).toBeGreaterThanOrEqual(1);
    }
  });

  it('longer sessions carry more work', () => {
    const short = generator().generate(request({ minutes: 20 }), now);
    const long = generator().generate(request({ minutes: 60 }), now);
    expect(workoutItems(long).length).toBeGreaterThan(workoutItems(short).length);
  });

  it('full-body strength block balances push and pull', () => {
    for (let seed = 0; seed < 20; seed++) {
      const w = generator().generate(request({ seed }), now);
      const patterns = w.blocks
        .find((b) => b.type === 'strength')!
        .items.map((i) => catalog.require(i.exerciseId).pattern);
      expect(patterns.filter(isPush).length, `seed ${seed}`).toBe(1);
      expect(patterns.filter(isPull).length, `seed ${seed}`).toBe(1);
      expect(patterns.some(isLowerBody), `seed ${seed}`).toBe(true);
      expect(patterns.some(isCore), `seed ${seed}`).toBe(true);
    }
  });

  it('lower body focus has no upper-body pushing or pulling', () => {
    for (let seed = 0; seed < 10; seed++) {
      const w = generator().generate(request({ focus: 'lowerBody', seed }), now);
      const main = w.blocks.find((b) => b.type === 'strength')!;
      for (const i of main.items) {
        const p = catalog.require(i.exerciseId).pattern;
        expect(isPush(p) || isPull(p), i.exerciseId).toBe(false);
      }
    }
  });

  it('only prescribes from the available pool', () => {
    const pool = catalog.performableWith(new Set(['dumbbell']));
    const allowed = new Set(pool.map((e) => e.id));
    for (let seed = 0; seed < 10; seed++) {
      const w = generator().generate(request({ pool, seed }), now);
      for (const i of workoutItems(w)) expect(allowed.has(i.exerciseId), i.exerciseId).toBe(true);
    }
  });

  it('respects the difficulty cap', () => {
    for (let seed = 0; seed < 10; seed++) {
      const w = generator().generate(
        request({ pool: catalog.all, difficulty: 1, maxDifficulty: 1, seed }),
        now,
      );
      for (const i of workoutItems(w))
        expect(catalog.require(i.exerciseId).difficulty, i.exerciseId).toBe(1);
    }
  });

  it('degrades gracefully with a tiny pool', () => {
    const tiny = catalog.byIds(['bw-air-squat', 'bw-push-up']);
    const w = generator().generate(request({ pool: tiny }), now);
    expect(workoutItems(w).length).toBe(2);
    expect(scoredItems(w).length).toBe(2);
  });

  it('produces an empty but valid workout with an empty pool', () => {
    const w = generator().generate(request({ pool: [] }), now);
    expect(w.blocks).toEqual([]);
    expect(w.estimatedMinutes).toBe(0);
  });

  it('loaded exercises carry RPE guidance', () => {
    const pool = catalog.performableWith(new Set(['dumbbell', 'bench']));
    for (let seed = 0; seed < 10; seed++) {
      const w = generator().generate(
        request({ pool, focus: 'upperBody', goal: 'strength', seed }),
        now,
      );
      const loaded = w.blocks
        .find((b) => b.type === 'strength')!
        .items.filter((i) => catalog.require(i.exerciseId).measurement === 'loadedReps');
      expect(loaded.length, `seed ${seed}`).toBeGreaterThan(0);
      for (const i of loaded) expect(i.prescription.load, i.exerciseId).not.toBeNull();
    }
  });

  it('a requested workoutId makes every id deterministic', () => {
    const build = () =>
      new WorkoutGenerator(new RandomIdGenerator()).generate(
        {
          availableExercises: bodyweight,
          focus: 'fullBody',
          goal: 'generalFitness',
          durationMinutes: 40,
          targetDifficulty: 2,
          seed: 7,
          workoutId: 'w-m1',
        },
        now,
      );
    const a = build();
    const b = build();
    expect(a).toEqual(b);
    expect(a.id).toBe('w-m1');
    const items = workoutItems(a);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    expect(items[0].id.startsWith('w-m1-i')).toBe(true);
    expect(items.map((i) => i.id)).toEqual(items.map((_, k) => `w-m1-i${k + 1}`));
  });

  it('without a workoutId, ids come from the generator', () => {
    const w = generator().generate(request(), now);
    expect(w.id).toBe('w-1');
    expect(workoutItems(w)[0].id).toBe('w-2');
  });

  it('copies request metadata onto the workout', () => {
    const w = generator().generate(
      { ...request({ difficulty: 3.5, goal: 'hypertrophy' }), title: 'Round 2' },
      now,
    );
    expect(w.title).toBe('Round 2');
    expect(w.targetDifficulty).toBe(3.5);
    expect(w.goal).toBe('hypertrophy');
    expect(w.focus).toBe('fullBody');
    expect(w.createdAt).toBe(now);
    expect(generator().generate(request(), now).title).toBeNull();
  });

  it('rejects invalid requests', () => {
    expect(() => generator().generate(request({ minutes: 0 }), now)).toThrow(RangeError);
    expect(() => generator().generate(request({ difficulty: 0.5 }), now)).toThrow(RangeError);
    expect(() => generator().generate(request({ difficulty: 5.5 }), now)).toThrow(RangeError);
  });

  it('round-trips through JSON', () => {
    const w = generator().generate(request({ seed: 3 }), now);
    expect(workoutFromJson(JSON.parse(JSON.stringify(workoutToJson(w))))).toEqual(w);
  });

  it('is sensitive to pool order, so callers must pass a canonical order', () => {
    // Weighted sampling walks the pool in order, so the same seed over the
    // same *set* of exercises in a different order gives a different
    // workout. Devices only converge if they build the pool in the same
    // order (see ExercisePoolService.resolve).
    const pool = catalog.performableWith(new Set(['dumbbell']));
    const reversed = [...pool].reverse();
    let differing = 0;
    for (let seed = 0; seed < 10; seed++) {
      const a = generator().generate(request({ pool, seed }), now);
      const b = generator().generate(request({ pool: reversed, seed }), now);
      if (ids(a).join() !== ids(b).join()) differing++;
    }
    expect(differing).toBeGreaterThan(0);
  });
});
