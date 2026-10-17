import {
  dateTimeFromJson,
  dateTimeToJson,
  enumFromJson,
  intFromJson,
  JsonMap,
  mapFromJson,
  requireString,
  stringOrNull,
} from '../core/json';

/**
 * Tunable behaviour of a Crate. Everything a Crate owner can change lives
 * here so that {@link Crate} itself stays a stable identity record. What
 * each scoring category is worth is not a setting: members vote on it.
 */
export interface CrateSettings {
  /**
   * Hours after a matchup week ends during which it stays open, so a
   * Sunday-night workout submitted after midnight still counts.
   */
  readonly loggingGraceHours: number;
}

export const DEFAULT_CRATE_SETTINGS: CrateSettings = Object.freeze({
  loggingGraceHours: 6,
});

export function crateSettings(overrides: Partial<CrateSettings> = {}): CrateSettings {
  const s = { ...DEFAULT_CRATE_SETTINGS, ...overrides };
  if (s.loggingGraceHours < 0 || s.loggingGraceHours > 48) {
    throw new RangeError('loggingGraceHours is 0..48');
  }
  return s;
}

export function crateSettingsFromJson(json: JsonMap): CrateSettings {
  return { loggingGraceHours: intFromJson(json['loggingGraceHours'], 6) };
}

export function crateSettingsToJson(s: CrateSettings): JsonMap {
  return { loggingGraceHours: s.loggingGraceHours };
}

/** A group of Peaches who train and compete together. */
export interface Crate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly ownerPeachId: string;
  /** Short shareable code other Peaches use to join. */
  readonly inviteCode: string;
  /** IANA time zone in which matchup weeks begin and end. */
  readonly timeZone: string;
  readonly settings: CrateSettings;
  readonly createdAt: Date;
}

export function crateFromJson(json: JsonMap): Crate {
  const settings = mapFromJson(json['settings']);
  return {
    id: requireString(json['id'], 'id'),
    name: requireString(json['name'], 'name'),
    description: stringOrNull(json['description']) ?? '',
    ownerPeachId: requireString(json['ownerPeachId'], 'ownerPeachId'),
    inviteCode: requireString(json['inviteCode'], 'inviteCode'),
    timeZone: stringOrNull(json['timeZone']) ?? 'UTC',
    settings: settings ? crateSettingsFromJson(settings) : DEFAULT_CRATE_SETTINGS,
    createdAt: dateTimeFromJson(json['createdAt']),
  };
}

export function crateToJson(c: Crate): JsonMap {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    ownerPeachId: c.ownerPeachId,
    inviteCode: c.inviteCode,
    timeZone: c.timeZone,
    settings: crateSettingsToJson(c.settings),
    createdAt: dateTimeToJson(c.createdAt),
  };
}

export const CRATE_ROLES = ['owner', 'admin', 'member'] as const;
export type CrateRole = (typeof CRATE_ROLES)[number];

export const MEMBERSHIP_STATUSES = ['active', 'invited', 'left', 'removed'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

/** The many-to-many link between Peaches and Crates. */
export interface CrateMembership {
  readonly crateId: string;
  readonly peachId: string;
  readonly role: CrateRole;
  readonly status: MembershipStatus;
  readonly joinedAt: Date;
}

export function isActiveMembership(m: CrateMembership): boolean {
  return m.status === 'active';
}

export function canManage(m: CrateMembership): boolean {
  return m.role === 'owner' || m.role === 'admin';
}

export function membershipFromJson(json: JsonMap): CrateMembership {
  return {
    crateId: requireString(json['crateId'], 'crateId'),
    peachId: requireString(json['peachId'], 'peachId'),
    role: enumFromJson(CRATE_ROLES, json['role'], 'member'),
    status: enumFromJson(MEMBERSHIP_STATUSES, json['status'], 'active'),
    joinedAt: dateTimeFromJson(json['joinedAt']),
  };
}

export function membershipToJson(m: CrateMembership): JsonMap {
  return {
    crateId: m.crateId,
    peachId: m.peachId,
    role: m.role,
    status: m.status,
    joinedAt: dateTimeToJson(m.joinedAt),
  };
}
