import { clamp } from '../core/math';
import { Exercise } from '../exercises/exercise';
import { TrainingGoal } from '../models/training';
import {
  BlockType,
  Prescription,
  prescription,
  prescriptionUnit,
  targetPerSet,
} from '../models/workout';

/** Seconds assumed per repetition when estimating time. */
export const SECONDS_PER_REP = 3;

/** Seconds between exercises for transitions and setup. */
export const TRANSITION_SECONDS = 20;

/** (sets, reps, rest, rpe) base table by goal. */
const BASE: Record<TrainingGoal, readonly [number, number, number, number]> = {
  strength: [4, 5, 120, 8],
  hypertrophy: [3, 10, 75, 8],
  endurance: [3, 15, 45, 6],
  generalFitness: [3, 10, 60, 7],
};

/**
 * Converts an exercise plus a goal into sets, reps, time and rest.
 *
 * Prescriptions follow widely used resistance-training guidelines (for
 * example the ACSM position stand): strength work uses low reps, heavy loads
 * and long rests; hypertrophy moderate reps and rests; endurance high reps
 * and short rests. Bodyweight exercises shift to higher rep targets because
 * load cannot be scaled.
 */
export class Prescriber {
  prescribe(
    exercise: Exercise,
    block: BlockType,
    goal: TrainingGoal,
    targetDifficulty: number,
  ): Prescription {
    switch (block) {
      case 'warmUp':
        return warmUp(exercise);
      case 'coolDown':
        return coolDown(exercise);
      case 'conditioning':
        return conditioning(exercise, goal, targetDifficulty);
      case 'strength':
        return main(exercise, goal, targetDifficulty);
    }
  }

  /** Estimated wall-clock seconds to complete `p`. */
  estimateSeconds(exercise: Exercise, p: Prescription): number {
    const sides = p.perSide ? 2 : 1;
    let work: number;
    switch (prescriptionUnit(p)) {
      case 'duration':
        work = targetPerSet(p);
        break;
      case 'distance':
        // Assume a brisk 1.5 m/s for carries and 3 m/s for locomotion.
        work = Math.round(targetPerSet(p) / (exercise.pattern === 'carry' ? 1.5 : 3));
        break;
      default:
        work = targetPerSet(p) * SECONDS_PER_REP;
    }
    const sets = p.sets * sides;
    return work * sets + p.restSeconds * (sets - 1) + TRANSITION_SECONDS;
  }
}

function warmUp(e: Exercise): Prescription {
  const perSide = e.laterality === 'unilateral';
  return e.measurement === 'duration' || e.measurement === 'distance'
    ? prescription({ sets: 1, restSeconds: 0, seconds: 30, perSide })
    : prescription({ sets: 1, restSeconds: 0, reps: 10, perSide });
}

function coolDown(e: Exercise): Prescription {
  return prescription({
    sets: 1,
    restSeconds: 0,
    seconds: 30,
    perSide: e.laterality === 'unilateral',
  });
}

function main(e: Exercise, goal: TrainingGoal, target: number): Prescription {
  const perSide = e.laterality === 'unilateral';
  const scale = volumeScale(target);
  const isolation = e.mechanics === 'isolation';
  const [sets, reps, rest, rpe] = BASE[goal];
  const half = Math.trunc(rest / 2);

  switch (e.measurement) {
    case 'duration':
      return prescription({
        sets: isolation ? 2 : sets,
        restSeconds: half,
        seconds: clamp(Math.round(30 * scale), 15, 90),
        perSide,
      });
    case 'distance':
      return prescription({
        sets,
        restSeconds: half,
        meters: clamp(Math.round(30 * scale), 15, 60),
        perSide,
      });
    case 'reps': {
      // Bodyweight: cannot add load, so rep targets run higher and strength
      // goals fall back to moderate reps rather than very low ones.
      const base = goal === 'strength' ? 8 : reps + 2;
      return prescription({
        sets: isolation ? sets - 1 : sets,
        restSeconds: rest,
        reps: clamp(Math.round(base * scale), 4, 30),
        perSide,
      });
    }
    case 'loadedReps':
      return prescription({
        sets: isolation ? sets - 1 : sets,
        restSeconds: rest,
        reps: clamp(Math.round(reps * scale), 3, 25),
        perSide,
        load: { rpe, note: rpeNote(rpe) },
      });
  }
}

function conditioning(e: Exercise, goal: TrainingGoal, target: number): Prescription {
  const scale = volumeScale(target);
  const perSide = e.laterality === 'unilateral';
  const intervals = goal === 'endurance' ? 6 : 4;
  switch (e.measurement) {
    case 'distance':
      // Locomotion gets one continuous effort; carries get short shuttles.
      if (e.pattern === 'locomotion') {
        return prescription({ sets: 1, restSeconds: 0, meters: Math.round(800 * scale) });
      }
      return prescription({
        sets: intervals,
        restSeconds: 45,
        meters: Math.round(30 * scale),
        perSide,
      });
    case 'duration':
      return prescription({
        sets: intervals,
        restSeconds: 30,
        seconds: clamp(Math.round(30 * scale), 20, 60),
      });
    case 'reps':
    case 'loadedReps':
      return prescription({
        sets: intervals,
        restSeconds: 30,
        reps: clamp(Math.round(12 * scale), 6, 25),
        perSide,
        load: e.measurement === 'loadedReps' ? { rpe: 6, note: 'Light and fast' } : null,
      });
  }
}

/** Volume multiplier from target difficulty: 1.0 at level 2, ±12 % per level. */
function volumeScale(target: number): number {
  return clamp(1 + 0.12 * (target - 2), 0.7, 1.4);
}

function rpeNote(rpe: number): string {
  if (rpe <= 6) return 'Light: four or more reps in reserve';
  if (rpe === 7) return 'Moderate: about three reps in reserve';
  if (rpe === 8) return 'Hard: about two reps in reserve';
  return 'Very hard: one rep in reserve';
}
