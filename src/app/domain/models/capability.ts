import {
  dateTimeFromJson,
  dateTimeToJson,
  enumFromJson,
  JsonMap,
  requireString,
  stringOrNull,
} from '../core/json';

/** Whether a Peach has said they can perform an exercise. */
export const CAPABILITY_STATUSES = [
  /** The Peach can do this exercise and is happy to be assigned it. */
  'able',
  /** The Peach cannot or will not do this exercise (injury, equipment, ...). */
  'unable',
] as const;
export type CapabilityStatus = (typeof CAPABILITY_STATUSES)[number];

/**
 * A Peach's declaration about one exercise. Capabilities are global to the
 * Peach, not per Crate: "I can do pull-ups" is true everywhere.
 *
 * Only `able` exercises are ever prescribed. An exercise a Peach has not
 * declared is treated as not available, which keeps generated workouts safe
 * by default.
 */
export interface ExerciseCapability {
  readonly peachId: string;
  readonly exerciseId: string;
  readonly status: CapabilityStatus;
  readonly updatedAt: Date;
  readonly notes: string | null;
}

export function isAble(c: ExerciseCapability): boolean {
  return c.status === 'able';
}

export function capabilityFromJson(json: JsonMap): ExerciseCapability {
  return {
    peachId: requireString(json['peachId'], 'peachId'),
    exerciseId: requireString(json['exerciseId'], 'exerciseId'),
    status: enumFromJson(CAPABILITY_STATUSES, json['status']),
    updatedAt: dateTimeFromJson(json['updatedAt']),
    notes: stringOrNull(json['notes']),
  };
}

export function capabilityToJson(c: ExerciseCapability): JsonMap {
  return {
    peachId: c.peachId,
    exerciseId: c.exerciseId,
    status: c.status,
    updatedAt: dateTimeToJson(c.updatedAt),
    notes: c.notes,
  };
}
