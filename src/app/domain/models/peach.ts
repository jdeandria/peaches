import {
  dateTimeFromJson,
  dateTimeToJson,
  enumFromJson,
  intFromJson,
  enumListFromJson,
  JsonMap,
  mapListFromJson,
  requireString,
  stringOrNull,
} from '../core/json';
import { EQUIPMENT, Equipment } from '../exercises/taxonomy';
import { UNIT_SYSTEMS, UnitSystem } from './training';

/**
 * Somewhere a Peach trains and what it has: "Home" with dumbbells and a
 * bench, "Gym" with everything. A planned workout names one, so exercises
 * and templates fit the kit there.
 */
export interface EquipmentLocation {
  readonly id: string;
  readonly name: string;
  readonly equipment: readonly Equipment[];
}

/** Most locations a Peach can keep. */
export const MAX_LOCATIONS = 8;
/** Longest location name. */
export const LOCATION_NAME_MAX = 30;

/**
 * A user of the app.
 *
 * A Peach is independent of any Crate: logs and fitness level
 * belong to the Peach and are shared across every Crate they join.
 */
export interface Peach {
  readonly id: string;
  readonly displayName: string;
  readonly email: string | null;
  readonly avatarUrl: string | null;
  /**
   * Self-assessed level 1 (new to exercise) .. 5 (advanced). Kept from when
   * workouts were generated; nothing scores or prescribes by it now.
   */
  readonly fitnessLevel: number;
  /** IANA time zone used to decide what "today" means for free logging. */
  readonly timeZone: string;
  readonly units: UnitSystem;
  /** Where they train, and the equipment at each. */
  readonly locations: readonly EquipmentLocation[];
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
    locations: [],
    ...init,
  };
  if (p.fitnessLevel < 1 || p.fitnessLevel > 5) throw new RangeError('fitnessLevel is 1..5');
  return p;
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
    locations: mapListFromJson(json['locations']).map((l) => ({
      id: requireString(l['id'], 'id'),
      name: stringOrNull(l['name']) ?? 'Somewhere',
      equipment: enumListFromJson(EQUIPMENT, l['equipment']),
    })),
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
    locations: p.locations.map((l) => ({ id: l.id, name: l.name, equipment: [...l.equipment] })),
    createdAt: dateTimeToJson(p.createdAt),
  };
}
