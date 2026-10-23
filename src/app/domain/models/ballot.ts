import {
  dateTimeFromJson,
  dateTimeToJson,
  JsonMap,
  mapFromJson,
  requireString,
} from '../core/json';
import { rulesFromJson, rulesToJson, ScoringRules } from './scoring';

/**
 * One member's vote on how the Crate scores: the 100-point budget split
 * across the categories, and the plan rules they want. A member has at
 * most one ballot per Crate and can change it at any time; the Crate's rules
 * are the tally of its active members' ballots.
 */
export interface Ballot {
  readonly crateId: string;
  readonly peachId: string;
  readonly rules: ScoringRules;
  readonly updatedAt: Date;
}

export function ballotFromJson(json: JsonMap): Ballot {
  return {
    crateId: requireString(json['crateId'], 'crateId'),
    peachId: requireString(json['peachId'], 'peachId'),
    rules: rulesFromJson(mapFromJson(json['rules'])),
    updatedAt: dateTimeFromJson(json['updatedAt']),
  };
}

export function ballotToJson(b: Ballot): JsonMap {
  return {
    crateId: b.crateId,
    peachId: b.peachId,
    rules: rulesToJson(b.rules),
    updatedAt: dateTimeToJson(b.updatedAt),
  };
}
