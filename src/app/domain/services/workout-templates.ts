import { SeededRandom } from '../core/random';
import { Exercise, isPerformableWith, regionsOf } from '../exercises/exercise';
import { ExerciseCatalog } from '../exercises/exercise-catalog';
import { loggableFromCatalog } from '../exercises/loggable';
import { BodyRegion, Equipment, isLoadEquipment, MovementPattern } from '../exercises/taxonomy';
import { DistanceKind } from '../models/scoring';
import { entryOf, ExerciseLogEntry, SetLog, setLog } from '../models/workout-log';

/** One exercise in a template: any catalog exercise that fits. */
export interface TemplateSlot {
  readonly patterns: readonly MovementPattern[];
  /** Only exercises working this region (for accessory work). */
  readonly region?: BodyRegion;
  /** Only exercises whose distance counts toward this (for cardio). */
  readonly distanceKind?: DistanceKind;
  /** Only these exercises (when the pattern alone is too broad). */
  readonly ids?: readonly string[];
}

/**
 * A ready-made workout: a shape (which movements, in what order) and the
 * kit it needs. The exercises filling each slot are drawn at random from
 * the catalog, so the same template gives some variety.
 */
export interface WorkoutTemplate {
  readonly id: string;
  readonly name: string;
  /** What it needs, in a word: "Dumbbells", "Gym", "Anywhere". */
  readonly kit: string;
  /** Equipment its exercises may use (bodyweight always works). */
  readonly equipment: readonly Equipment[];
  readonly slots: readonly TemplateSlot[];
}

const GYM: readonly Equipment[] = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'bench',
  'cableMachine',
  'weightMachine',
  'pullUpBar',
  'plate',
];

const slot = (...patterns: MovementPattern[]): TemplateSlot => ({ patterns });

export const WORKOUT_TEMPLATES: readonly WorkoutTemplate[] = [
  {
    id: 'full-body',
    name: 'Full body',
    kit: 'Dumbbells',
    equipment: ['dumbbell', 'bench'],
    slots: [
      slot('squat'),
      slot('horizontalPush'),
      slot('hinge'),
      slot('horizontalPull'),
      slot('antiExtension', 'coreFlexion'),
    ],
  },
  {
    id: 'upper-body',
    name: 'Upper body',
    kit: 'Gym',
    equipment: GYM,
    slots: [
      slot('horizontalPush'),
      slot('verticalPull'),
      slot('verticalPush'),
      slot('horizontalPull'),
      { patterns: ['isolation'], region: 'upper' },
    ],
  },
  {
    id: 'lower-body',
    name: 'Lower body',
    kit: 'Gym',
    equipment: GYM,
    slots: [
      slot('squat'),
      slot('hinge'),
      slot('lunge'),
      { patterns: ['isolation'], region: 'lower' },
      slot('coreFlexion', 'antiExtension'),
    ],
  },
  {
    id: 'bodyweight',
    name: 'Bodyweight',
    kit: 'Anywhere',
    equipment: ['wall', 'chair'],
    slots: [
      slot('squat'),
      slot('horizontalPush'),
      slot('lunge'),
      slot('plyometric'),
      slot('antiExtension'),
    ],
  },
  {
    id: 'core',
    name: 'Core',
    kit: 'Anywhere',
    equipment: ['wall'],
    slots: [
      slot('antiExtension'),
      slot('coreFlexion'),
      slot('rotation'),
      slot('antiLateralFlexion'),
    ],
  },
  {
    id: 'easy-run',
    name: 'Easy run',
    kit: 'Outdoors',
    equipment: [],
    slots: [{ patterns: ['locomotion'], distanceKind: 'runWalk', ids: ['bw-run', 'bw-jog'] }],
  },
];

/** Hardest exercise a template picks (difficulty runs 1 to 5). */
const MAX_DIFFICULTY = 3;

/**
 * A workout from `template`: one fitting catalog exercise per slot (none
 * twice, two of one family only if nothing else fits, plain exercises more
 * often than tricky ones, the template's kit where it has any), picked by `seed`, with a few sets each.
 * Reps, hold times and distances vary a little with the seed too. Loads
 * come from the last time the Peach did that exercise (`previous`), else
 * they're left for the Peach to set.
 */
export function templateWorkout(
  template: WorkoutTemplate,
  catalog: ExerciseCatalog,
  seed: number,
  previous: (exerciseId: string) => ExerciseLogEntry | null | undefined = () => null,
): ExerciseLogEntry[] {
  const random = new SeededRandom(seed);
  const pick = <T>(items: readonly T[]): T => items[random.nextInt(items.length)];
  /** A pick leaning to the plainer, more familiar exercises. */
  const pickExercise = (items: readonly Exercise[]): Exercise => {
    const weights = items.map((e) => (e.difficulty <= 2 ? 3 : 1));
    let r = random.nextDouble() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < items.length; i++) if ((r -= weights[i]) < 0) return items[i];
    return items[items.length - 1];
  };
  // A template with kit uses it: bodyweight moves only when nothing else fits.
  const usesKit = template.equipment.some(isLoadEquipment);
  const kit = new Set(template.equipment);
  const chosen = new Set<string>();
  const families = new Set<string>();
  const workout: ExerciseLogEntry[] = [];
  for (const s of template.slots) {
    const candidates = catalog.all.filter((e) => {
      const loggable = loggableFromCatalog(e);
      return (
        s.patterns.includes(e.pattern) &&
        e.difficulty <= MAX_DIFFICULTY &&
        e.modality !== 'mobility' &&
        e.modality !== 'flexibility' &&
        isPerformableWith(e, kit) &&
        !chosen.has(e.id) &&
        (s.ids === undefined || s.ids.includes(e.id)) &&
        (s.region === undefined || regionsOf(e).has(s.region)) &&
        (s.distanceKind === undefined
          ? loggable.track !== 'distance'
          : loggable.distanceKind === s.distanceKind)
      );
    });
    if (candidates.length === 0) continue;
    // Rather not two of one family (two planks), unless that's all there is.
    const prefer = (pool: Exercise[], test: (e: Exercise) => boolean) => {
      const kept = pool.filter(test);
      return kept.length > 0 ? kept : pool;
    };
    let pool = prefer(candidates, (e) => !(e.family && families.has(e.family)));
    if (usesKit) pool = prefer(pool, (e) => e.equipment.some(isLoadEquipment));
    const e = pickExercise(pool);
    chosen.add(e.id);
    if (e.family) families.add(e.family);
    const exercise = loggableFromCatalog(e);
    const loadKg = exercise.takesLoad ? (previous(e.id)?.sets.at(-1)?.loadKg ?? null) : null;
    let sets: SetLog[];
    if (exercise.track === 'distance') {
      const km = pick([3, 4, 5, 6]);
      // An easy pace: six minutes a kilometre.
      sets = [setLog({ meters: km * 1000, seconds: km * 360 })];
    } else if (exercise.track === 'time') {
      const seconds = pick([30, 40, 45, 60]);
      sets = [1, 2, 3].map(() => setLog({ seconds }));
    } else {
      const reps = pick(exercise.takesLoad ? [8, 10, 12] : [10, 12, 15]);
      sets = [1, 2, 3].map(() => setLog({ reps, loadKg }));
    }
    workout.push(entryOf(exercise, { sets }));
  }
  return workout;
}
