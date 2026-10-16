import {
  dateTimeFromJson,
  dateTimeToJson,
  enumFromJson,
  intFromJson,
  JsonMap,
  requireString,
  stringOrNull,
} from '../core/json';
import { UNIT_SYSTEMS, UnitSystem } from './training';

/**
 * A user of the app.
 *
 * A Peach is independent of any Crate: capabilities, logs and fitness level
 * belong to the Peach and are shared across every Crate they join.
 */
export interface Peach {
  readonly id: string;
  readonly displayName: string;
  readonly email: string | null;
  readonly avatarUrl: string | null;
  /**
   * Self-assessed level 1 (new to exercise) .. 5 (advanced). Caps the
   * difficulty of exercises the generator will prescribe.
   */
  readonly fitnessLevel: number;
  /** IANA time zone used to decide what "today" means for free logging. */
  readonly timeZone: string;
  readonly units: UnitSystem;
  readonly createdAt: Date;
}

export type NewPeach = Pick<Peach, 'id' | 'displayName' | 'createdAt'> & Partial<Peach>;

/** Builds a Peach, applying the defaults for anything not given. */
export function peach(init: NewPeach): Peach {
  const p: Peach = {
    email: null,
    avatarUrl: null,
    fitnessLevel: 2,
    timeZone: 'UTC',
    units: 'metric',
    ...init,
  };
  if (p.fitnessLevel < 1 || p.fitnessLevel > 5) throw new RangeError('fitnessLevel is 1..5');
  return p;
}

export function fitnessLevelLabel(level: number): string {
  switch (level) {
    case 1:
      return 'Getting started';
    case 2:
      return 'Regular mover';
    case 3:
      return 'Fit';
    case 4:
      return 'Athletic';
    default:
      return 'Advanced';
  }
}

export function peachFromJson(json: JsonMap): Peach {
  return {
    id: requireString(json['id'], 'id'),
    displayName: requireString(json['displayName'], 'displayName'),
    email: stringOrNull(json['email']),
    avatarUrl: stringOrNull(json['avatarUrl']),
    fitnessLevel: intFromJson(json['fitnessLevel'], 2),
    timeZone: stringOrNull(json['timeZone']) ?? 'UTC',
    units: enumFromJson(UNIT_SYSTEMS, json['units'], 'metric'),
    createdAt: dateTimeFromJson(json['createdAt']),
  };
}

export function peachToJson(p: Peach): JsonMap {
  return {
    id: p.id,
    displayName: p.displayName,
    email: p.email,
    avatarUrl: p.avatarUrl,
    fitnessLevel: p.fitnessLevel,
    timeZone: p.timeZone,
    units: p.units,
    createdAt: dateTimeToJson(p.createdAt),
  };
}
