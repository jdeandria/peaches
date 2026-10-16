import { ExerciseCatalog } from '../exercises/exercise-catalog';
import { TRAINING_GOALS } from '../models/training';
import { BLOCK_TYPES, prescription, prescriptionUnit, totalTarget } from '../models/workout';
import { Prescriber, SECONDS_PER_REP, TRANSITION_SECONDS } from './prescriber';

describe('Prescriber', () => {
  const catalog = ExerciseCatalog.standard();
  const prescriber = new Prescriber();

  describe('main block', () => {
    it('strength goal: fewer reps, longer rest, higher RPE than endurance', () => {
      const squat = catalog.require('bb-back-squat');
      const strength = prescriber.prescribe(squat, 'strength', 'strength', 2);
      const endurance = prescriber.prescribe(squat, 'strength', 'endurance', 2);
      expect(strength.reps!).toBeLessThan(endurance.reps!);
      expect(strength.restSeconds).toBeGreaterThan(endurance.restSeconds);
      expect(strength.load!.rpe).toBeGreaterThan(endurance.load!.rpe);
      expect(strength.sets).toBeGreaterThanOrEqual(endurance.sets);
    });

    it('bodyweight reps carry no load guidance and run higher', () => {
      const p = prescriber.prescribe(
        catalog.require('bw-push-up'),
        'strength',
        'generalFitness',
        2,
      );
      expect(p.load).toBeNull();
      expect(p.reps).toBe(12);
      expect(prescriptionUnit(p)).toBe('reps');
    });

    it('higher target difficulty scales volume up', () => {
      const pushUp = catalog.require('bw-push-up');
      const at = (d: number) => prescriber.prescribe(pushUp, 'strength', 'generalFitness', d);
      expect(at(1).reps!).toBeLessThan(at(2).reps!);
      expect(at(2).reps!).toBeLessThan(at(4).reps!);
    });

    it('scales volume with difficulty and rounds half up', () => {
      // base 12 reps x clamp(1 + 0.12 * (d - 2), 0.7, 1.4), rounded half up.
      const pushUp = catalog.require('bw-push-up');
      const reps = (d: number) =>
        prescriber.prescribe(pushUp, 'strength', 'generalFitness', d).reps;
      expect(reps(1)).toBe(11); // 10.56
      expect(reps(2)).toBe(12);
      expect(reps(3)).toBe(13); // 13.44
      expect(reps(4)).toBe(15); // 14.88
      expect(reps(5)).toBe(16); // 16.32
      // Locomotion: 800 m x scale.
      const run = catalog.require('bw-run');
      const metres = (d: number) =>
        prescriber.prescribe(run, 'conditioning', 'generalFitness', d).meters;
      expect(metres(1)).toBe(704);
      expect(metres(3)).toBe(896);
      expect(metres(5)).toBe(1088);
    });

    it('unilateral exercises are prescribed per side', () => {
      const p = prescriber.prescribe(
        catalog.require('bw-side-plank'),
        'strength',
        'generalFitness',
        2,
      );
      expect(p.perSide).toBe(true);
      expect(prescriptionUnit(p)).toBe('duration');
      expect(totalTarget(p)).toBe(p.seconds! * p.sets * 2);
    });

    it('isolation work gets fewer sets', () => {
      const compound = prescriber.prescribe(
        catalog.require('db-bench-press'),
        'strength',
        'hypertrophy',
        2,
      );
      const isolation = prescriber.prescribe(
        catalog.require('db-biceps-curl'),
        'strength',
        'hypertrophy',
        2,
      );
      expect(isolation.sets).toBeLessThan(compound.sets);
    });

    it('loaded reps carry an RPE note that matches the RPE', () => {
      const bench = catalog.require('db-bench-press');
      expect(prescriber.prescribe(bench, 'strength', 'strength', 2).load).toEqual({
        rpe: 8,
        note: 'Hard: about two reps in reserve',
      });
      expect(prescriber.prescribe(bench, 'strength', 'generalFitness', 2).load).toEqual({
        rpe: 7,
        note: 'Moderate: about three reps in reserve',
      });
      expect(prescriber.prescribe(bench, 'strength', 'endurance', 2).load).toEqual({
        rpe: 6,
        note: 'Light: four or more reps in reserve',
      });
    });
  });

  describe('other blocks', () => {
    it('warm-up and cool-down are single sets with no rest', () => {
      const warm = prescriber.prescribe(catalog.require('mob-cat-cow'), 'warmUp', 'strength', 5);
      const cool = prescriber.prescribe(catalog.require('str-pigeon'), 'coolDown', 'strength', 5);
      expect(warm.sets).toBe(1);
      expect(warm.restSeconds).toBe(0);
      expect(cool.sets).toBe(1);
      expect(cool.seconds).toBe(30);
      expect(cool.perSide).toBe(true);
    });

    it('conditioning locomotion is one continuous distance effort', () => {
      const p = prescriber.prescribe(
        catalog.require('bw-run'),
        'conditioning',
        'generalFitness',
        2,
      );
      expect(p.sets).toBe(1);
      expect(p.meters).toBe(800);
    });

    it('conditioning intervals scale with endurance goal', () => {
      const burpee = catalog.require('bw-burpee');
      const general = prescriber.prescribe(burpee, 'conditioning', 'generalFitness', 2);
      const endurance = prescriber.prescribe(burpee, 'conditioning', 'endurance', 2);
      expect(endurance.sets).toBeGreaterThan(general.sets);
    });
  });

  it('every exercise, block, goal and difficulty yields a valid integer prescription', () => {
    const difficulties = [1, 1.25, 1.5, 2, 2.37, 2.5, 3, 3.5, 4, 4.75, 5];
    for (const e of catalog.all) {
      for (const block of BLOCK_TYPES) {
        for (const goal of TRAINING_GOALS) {
          for (const d of difficulties) {
            const p = prescriber.prescribe(e, block, goal, d);
            const where = `${e.id} ${block} ${goal} ${d}`;
            // The builder already enforces exactly one target; check integrality.
            for (const v of [p.sets, p.restSeconds, p.reps, p.seconds, p.meters]) {
              if (v !== null) expect(Number.isInteger(v), where).toBe(true);
            }
            expect(p.sets, where).toBeGreaterThanOrEqual(1);
            expect(totalTarget(p), where).toBeGreaterThan(0);
            const est = prescriber.estimateSeconds(e, p);
            expect(Number.isInteger(est), where).toBe(true);
            expect(est, where).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  describe('estimateSeconds', () => {
    it('accounts for reps, rest, sides and transition', () => {
      const p = prescription({ sets: 3, reps: 10, restSeconds: 60, perSide: true });
      const seconds = prescriber.estimateSeconds(catalog.require('bw-split-squat'), p);
      // 6 working sets x 30 s + 5 rests x 60 s + 20 s transition.
      expect(seconds).toBe(6 * 30 + 5 * 60 + 20);
      expect(SECONDS_PER_REP).toBe(3);
      expect(TRANSITION_SECONDS).toBe(20);
    });

    it('distance uses a slower pace for carries than locomotion', () => {
      const p = prescription({ sets: 1, meters: 300, restSeconds: 0 });
      const carry = prescriber.estimateSeconds(catalog.require('db-farmer-carry'), p);
      const run = prescriber.estimateSeconds(catalog.require('bw-run'), p);
      expect(carry).toBeGreaterThan(run);
      expect(carry).toBe(200 + 20);
      expect(run).toBe(100 + 20);
    });

    it('rounds distance time to whole seconds', () => {
      const run = catalog.require('bw-run');
      // 10 m / 3 m/s = 3.33 s -> 3 s; 20 m / 3 m/s = 6.67 s -> 7 s.
      expect(
        prescriber.estimateSeconds(run, prescription({ sets: 1, meters: 10, restSeconds: 0 })),
      ).toBe(23);
      expect(
        prescriber.estimateSeconds(run, prescription({ sets: 1, meters: 20, restSeconds: 0 })),
      ).toBe(27);
      const carry = catalog.require('db-farmer-carry');
      // 40 m / 1.5 m/s = 26.67 s -> 27 s, twice with one 60 s rest.
      expect(
        prescriber.estimateSeconds(carry, prescription({ sets: 2, meters: 40, restSeconds: 60 })),
      ).toBe(27 * 2 + 60 + 20);
    });

    it('duration work counts the hold time directly', () => {
      const p = prescription({ sets: 2, seconds: 30, restSeconds: 15 });
      expect(prescriber.estimateSeconds(catalog.require('bw-forearm-plank'), p)).toBe(60 + 15 + 20);
    });
  });
});
