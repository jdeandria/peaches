import {
  dateTimeFromJson,
  dateTimeToJson,
  enumFromJson,
  enumListFromJson,
  intFromJson,
  JsonMap,
  mapFromJson,
  requireString,
  stringListFromJson,
  stringOrNull,
} from '../core/json';
import { JOINT_STRESSES, JointStress } from '../exercises/taxonomy';
import {
  ScoringRules,
  scoringRulesFromJson,
  scoringRulesToJson,
  STANDARD_SCORING_RULES,
} from './scoring-rules';
import { TRAINING_GOALS, TrainingGoal } from './training';

/**
 * Tunable behaviour of a Crate. Everything a Crate owner can change lives
 * here so that {@link Crate} itself stays a stable identity record.
 */
export interface CrateSettings {
  readonly workoutDurationMinutes: number;
  readonly goal: TrainingGoal;
  readonly scoringRules: ScoringRules;
  /** Hours after the end of an exercise day during which logs still count. */
  readonly loggingGraceHours: number;
  /** Exercises the Crate has banned regardless of member capability. */
  readonly excludedExerciseIds: readonly string[];
  /** Joint-stress classes the Crate avoids (e.g. a knee-friendly Crate). */
  readonly excludedJointStress: readonly JointStress[];
}

export const DEFAULT_CRATE_SETTINGS: CrateSettings = Object.freeze({
  workoutDurationMinutes: 40,
  goal: 'generalFitness',
  scoringRules: STANDARD_SCORING_RULES,
  loggingGraceHours: 6,
  excludedExerciseIds: [],
  excludedJointStress: [],
});

export function crateSettings(overrides: Partial<CrateSettings> = {}): CrateSettings {
  const merged = { ...DEFAULT_CRATE_SETTINGS, ...overrides };
  // These are sets in meaning; keep them free of duplicates.
  const s: CrateSettings = {
    ...merged,
    excludedExerciseIds: [...new Set(merged.excludedExerciseIds)],
    excludedJointStress: [...new Set(merged.excludedJointStress)],
  };
  if (s.workoutDurationMinutes < 15 || s.workoutDurationMinutes > 120) {
    throw new RangeError('workoutDurationMinutes is 15..120');
  }
  if (s.loggingGraceHours < 0) throw new RangeError('loggingGraceHours must be >= 0');
  return s;
}

export function crateSettingsFromJson(json: JsonMap): CrateSettings {
  const rules = mapFromJson(json['scoringRules']);
  return {
    workoutDurationMinutes: intFromJson(json['workoutDurationMinutes'], 40),
    goal: enumFromJson(TRAINING_GOALS, json['goal'], 'generalFitness'),
    scoringRules: rules ? scoringRulesFromJson(rules) : STANDARD_SCORING_RULES,
    loggingGraceHours: intFromJson(json['loggingGraceHours'], 6),
    excludedExerciseIds: [...new Set(stringListFromJson(json['excludedExerciseIds']))],
    excludedJointStress: [
      ...new Set(enumListFromJson(JOINT_STRESSES, json['excludedJointStress'])),
    ],
  };
}

export function crateSettingsToJson(s: CrateSettings): JsonMap {
  return {
    workoutDurationMinutes: s.workoutDurationMinutes,
    goal: s.goal,
    scoringRules: scoringRulesToJson(s.scoringRules),
    loggingGraceHours: s.loggingGraceHours,
    excludedExerciseIds: [...s.excludedExerciseIds].sort(),
    excludedJointStress: [...s.excludedJointStress],
  };
}

/** A group of Peaches who train and compete together. */
export interface Crate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly ownerPeachId: string;
  /** Short shareable code other Peaches use to join. */
  readonly inviteCode: string;
  /** IANA time zone in which exercise days begin and end. */
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
