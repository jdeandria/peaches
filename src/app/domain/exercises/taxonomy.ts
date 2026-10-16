/**
 * The exercise taxonomy used to describe and sample exercises.
 *
 * Every exercise in the catalog is classified along these axes. The workout
 * generator reasons about *patterns*, *muscles*, *modality* and *equipment*
 * rather than about specific exercises, which is what lets it build a
 * balanced session from whatever subset of exercises two Peaches share.
 *
 * Each axis is a string union backed by an ordered `as const` list; the
 * strings are the stored names, so data written by any client round-trips.
 */

/**
 * Fundamental human movement patterns (after Cook / Boyle style functional
 * training taxonomies). Balancing these across a session is the primary
 * lever for a well-rounded, injury-conscious workout.
 */
export const MOVEMENT_PATTERNS = [
  /** Knee-dominant bilateral lower body (squat, leg press). */
  'squat',
  /** Hip-dominant lower body (deadlift, hip thrust, swing). */
  'hinge',
  /** Single-leg / split-stance lower body (lunge, step-up, split squat). */
  'lunge',
  /** Upper body push in the horizontal plane (push-up, bench press). */
  'horizontalPush',
  /** Upper body push in the vertical plane (overhead press, pike push-up). */
  'verticalPush',
  /** Upper body pull in the horizontal plane (row). */
  'horizontalPull',
  /** Upper body pull in the vertical plane (pull-up, lat pulldown). */
  'verticalPull',
  /** Loaded carries and holds (farmer carry, suitcase carry). */
  'carry',
  /** Trunk flexion (crunch, leg raise, hollow hold). */
  'coreFlexion',
  /** Resisting extension of the spine (plank, dead bug). */
  'antiExtension',
  /** Rotation or resisting rotation (Russian twist, Pallof press). */
  'rotation',
  /** Resisting lateral flexion (side plank, suitcase hold). */
  'antiLateralFlexion',
  /** Explosive jumping / throwing (jump squat, burpee, slam). */
  'plyometric',
  /** Steady or interval locomotion (run, row, bike, jump rope). */
  'locomotion',
  /** Single-joint accessory work (curl, extension, calf raise). */
  'isolation',
  /** Dynamic mobility / activation used in warm-ups. */
  'mobility',
  /** Static stretching used in cool-downs. */
  'stretch',
] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

export function isPush(p: MovementPattern): boolean {
  return p === 'horizontalPush' || p === 'verticalPush';
}

export function isPull(p: MovementPattern): boolean {
  return p === 'horizontalPull' || p === 'verticalPull';
}

export function isLowerBody(p: MovementPattern): boolean {
  return p === 'squat' || p === 'hinge' || p === 'lunge';
}

export function isCore(p: MovementPattern): boolean {
  return (
    p === 'coreFlexion' || p === 'antiExtension' || p === 'rotation' || p === 'antiLateralFlexion'
  );
}

export const BODY_REGIONS = ['upper', 'lower', 'core', 'systemic'] as const;
export type BodyRegion = (typeof BODY_REGIONS)[number];

/** Muscle groups at the granularity useful for balancing a workout. */
export const MUSCLE_GROUPS = [
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'hipFlexors',
  'adductors',
  'abductors',
  'chest',
  'lats',
  'upperBack',
  'lowerBack',
  'frontDelts',
  'sideDelts',
  'rearDelts',
  'biceps',
  'triceps',
  'forearms',
  'abdominals',
  'obliques',
  'deepCore',
  'cardiovascular',
  'fullBody',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

const REGION_OF: Record<MuscleGroup, BodyRegion> = {
  quadriceps: 'lower',
  hamstrings: 'lower',
  glutes: 'lower',
  calves: 'lower',
  hipFlexors: 'lower',
  adductors: 'lower',
  abductors: 'lower',
  chest: 'upper',
  lats: 'upper',
  upperBack: 'upper',
  frontDelts: 'upper',
  sideDelts: 'upper',
  rearDelts: 'upper',
  biceps: 'upper',
  triceps: 'upper',
  forearms: 'upper',
  lowerBack: 'core',
  abdominals: 'core',
  obliques: 'core',
  deepCore: 'core',
  cardiovascular: 'systemic',
  fullBody: 'systemic',
};

export function regionOf(muscle: MuscleGroup): BodyRegion {
  return REGION_OF[muscle];
}

/** Equipment an exercise *requires*. Bodyweight exercises list none. */
export const EQUIPMENT = [
  'dumbbell',
  'barbell',
  'kettlebell',
  'resistanceBand',
  'pullUpBar',
  'dipStation',
  'bench',
  'box',
  'medicineBall',
  'slamBall',
  'jumpRope',
  'cableMachine',
  'weightMachine',
  'treadmill',
  'stationaryBike',
  'rowingMachine',
  'elliptical',
  'stairClimber',
  'suspensionTrainer',
  'abWheel',
  'foamRoller',
  'wall',
  'chair',
  'stairs',
  'pool',
  'bicycle',
  'sled',
  'battleRope',
  'sandbag',
  'plate',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

const LOAD_EQUIPMENT: ReadonlySet<Equipment> = new Set<Equipment>([
  'dumbbell',
  'barbell',
  'kettlebell',
  'medicineBall',
  'slamBall',
  'cableMachine',
  'weightMachine',
  'sled',
  'sandbag',
  'plate',
]);

/**
 * Whether this equipment adds an external weight that is worth recording
 * per set. Bands, suspension trainers and cardio machines do not: their
 * resistance is not a comparable number.
 */
export function isLoadEquipment(e: Equipment): boolean {
  return LOAD_EQUIPMENT.has(e);
}

/** The training quality an exercise primarily develops. */
export const MODALITIES = [
  'strength',
  'power',
  'conditioning',
  'mobility',
  'flexibility',
  'stability',
] as const;
export type Modality = (typeof MODALITIES)[number];

/** Compound (multi-joint) vs isolation (single-joint). */
export const MECHANICS = ['compound', 'isolation'] as const;
export type Mechanics = (typeof MECHANICS)[number];

/** How an exercise is counted and therefore how it is scored. */
export const MEASUREMENT_TYPES = [
  /** Repetitions of bodyweight or fixed-load movement. */
  'reps',
  /** Repetitions where the load lifted matters (dumbbell press). */
  'loadedReps',
  /** Time under tension or time on task (plank, bike interval). */
  'duration',
  /** Distance covered (run, row, carry). */
  'distance',
] as const;
export type MeasurementType = (typeof MEASUREMENT_TYPES)[number];

export const LATERALITIES = [
  'bilateral',
  /** One side at a time, prescribed per side. */
  'unilateral',
  /** Alternating sides within a set, prescribed as total reps. */
  'alternating',
] as const;
export type Laterality = (typeof LATERALITIES)[number];

/**
 * Coarse joint-stress flags so Peaches with limitations can exclude whole
 * classes of movement without reviewing every exercise.
 */
export const JOINT_STRESSES = [
  'knee',
  'hip',
  'lowerBack',
  'shoulder',
  'wrist',
  'elbow',
  'ankle',
  'neck',
] as const;
export type JointStress = (typeof JOINT_STRESSES)[number];
