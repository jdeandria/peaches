import {
  dateTimeFromJson,
  dateTimeToJson,
  JsonMap,
  mapFromJson,
  requireString,
} from '../core/json';
import { CategoryWeights, weightsFromJson, weightsToJson } from './scoring';

/**
 * One member's vote on what each scoring category is worth: the
 * 100-point budget split across the categories. A member has at most
 * one ballot per Crate and can change it at any time; the Crate's weights
 * are the tally of its active members' ballots.
 */
export interface RateBallot {
  readonly crateId: string;
  readonly peachId: string;
  readonly weights: CategoryWeights;
  readonly updatedAt: Date;
}

export function ballotFromJson(json: JsonMap): RateBallot {
  return {
    crateId: requireString(json['crateId'], 'crateId'),
    peachId: requireString(json['peachId'], 'peachId'),
    weights: weightsFromJson(mapFromJson(json['weights'])),
    updatedAt: dateTimeFromJson(json['updatedAt']),
  };
}

export function ballotToJson(b: RateBallot): JsonMap {
  return {
    crateId: b.crateId,
    peachId: b.peachId,
    weights: weightsToJson(b.weights),
    updatedAt: dateTimeToJson(b.updatedAt),
  };
}
