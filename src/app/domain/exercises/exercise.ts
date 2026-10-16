import {
  enumFromJson,
  enumListFromJson,
  intFromJson,
  JsonMap,
  numberFromJson,
  requireString,
  stringListFromJson,
  stringOrNull,
} from '../core/json';
import {
  BodyRegion,
  Equipment,
  EQUIPMENT,
  isLoadEquipment,
  JOINT_STRESSES,
  JointStress,
  LATERALITIES,
  Laterality,
  MEASUREMENT_TYPES,
  MeasurementType,
  MECHANICS,
  Mechanics,
  Modality,
  MODALITIES,
  MOVEMENT_PATTERNS,
  MovementPattern,
  MUSCLE_GROUPS,
  MuscleGroup,
  regionOf,
} from './taxonomy';

/**
 * A catalog exercise.
 *
 * Exercises are reference data, not user data: the catalog is versioned and
 * shipped with the app, and user data refers to exercises by stable `id`
 * (a slug such as `bw-push-up`). Renaming an exercise never changes its id.
 */
export interface Exercise {
  /** Stable identifier. Convention: `<equipment>-<name>` in kebab-case. */
  readonly id: string;
  readonly name: string;
  readonly pattern: MovementPattern;
  readonly primaryMuscles: readonly MuscleGroup[];
  readonly secondaryMuscles: readonly MuscleGroup[];
  readonly modality: Modality;
  readonly measurement: MeasurementType;
  readonly equipment: readonly Equipment[];
  readonly mechanics: Mechanics;
  readonly laterality: Laterality;
  /** Technical / strength difficulty from 1 (anyone) to 5 (advanced). */
  readonly difficulty: number;
  /** Approximate metabolic equivalent (energy cost) while performing. */
  readonly met: number;
  readonly jointStress: readonly JointStress[];
  /**
   * Progression family, e.g. `push-up`, so regressions and progressions can
   * be found (`knee push-up` -> `push-up` -> `archer push-up`).
   */
  readonly family: string | null;
  readonly aliases: readonly string[];
  /** Short coaching cue shown in the workout view. */
  readonly cues: string | null;
}

export function isBodyweight(e: Exercise): boolean {
  return e.equipment.length === 0;
}

/**
 * Whether each set should record the weight used: true for loaded reps and
 * for any carry, hold or movement done with load-bearing equipment (a
 * farmer carry or suitcase hold, for example).
 */
export function takesLoad(e: Exercise): boolean {
  return e.measurement === 'loadedReps' || e.equipment.some(isLoadEquipment);
}

export function allMuscles(e: Exercise): Set<MuscleGroup> {
  return new Set([...e.primaryMuscles, ...e.secondaryMuscles]);
}

export function regionsOf(e: Exercise): Set<BodyRegion> {
  return new Set(e.primaryMuscles.map(regionOf));
}

/** Whether this exercise can be performed with `available` equipment. */
export function isPerformableWith(e: Exercise, available: ReadonlySet<Equipment>): boolean {
  return e.equipment.every((eq) => available.has(eq));
}

export function exerciseFromJson(json: JsonMap): Exercise {
  return {
    id: requireString(json['id'], 'id'),
    name: requireString(json['name'], 'name'),
    pattern: enumFromJson(MOVEMENT_PATTERNS, json['pattern']),
    primaryMuscles: enumListFromJson(MUSCLE_GROUPS, json['primaryMuscles']),
    secondaryMuscles: enumListFromJson(MUSCLE_GROUPS, json['secondaryMuscles']),
    modality: enumFromJson(MODALITIES, json['modality']),
    measurement: enumFromJson(MEASUREMENT_TYPES, json['measurement']),
    equipment: enumListFromJson(EQUIPMENT, json['equipment']),
    mechanics: enumFromJson(MECHANICS, json['mechanics'], 'compound'),
    laterality: enumFromJson(LATERALITIES, json['laterality'], 'bilateral'),
    difficulty: intFromJson(json['difficulty'], 2),
    met: numberFromJson(json['met'], 5),
    jointStress: enumListFromJson(JOINT_STRESSES, json['jointStress']),
    family: stringOrNull(json['family']),
    aliases: stringListFromJson(json['aliases']),
    cues: stringOrNull(json['cues']),
  };
}

export function exerciseToJson(e: Exercise): JsonMap {
  return {
    id: e.id,
    name: e.name,
    pattern: e.pattern,
    primaryMuscles: [...e.primaryMuscles],
    secondaryMuscles: [...e.secondaryMuscles],
    modality: e.modality,
    measurement: e.measurement,
    equipment: [...e.equipment],
    mechanics: e.mechanics,
    laterality: e.laterality,
    difficulty: e.difficulty,
    met: e.met,
    jointStress: [...e.jointStress],
    family: e.family,
    aliases: [...e.aliases],
    cues: e.cues,
  };
}
