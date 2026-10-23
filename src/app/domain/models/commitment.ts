import {
  dateTimeFromJson,
  dateTimeToJson,
  intFromJson,
  JsonMap,
  numberFromJson,
  requireString,
} from '../core/json';
import { LogScore } from './scoring';

/**
 * What a Peach's plan for one week of a Season is worth: the points its
 * planned workouts earn under the Season's weights. It follows the plan
 * until the week starts (`locksAt`), then it is fixed: from then on the
 * Peach can move and change workouts, but not what they committed to.
 *
 * Crate-mates see it as it changes, so opponents raise their plans against
 * each other until the week locks. Only the number is shared; the plan
 * itself stays private.
 */
export interface Commitment {
  readonly seasonId: string;
  readonly roundId: string;
  readonly peachId: string;
  readonly points: number;
  readonly locksAt: Date;
  readonly updatedAt: Date;
}

/** Document key: one commitment per Peach per week. */
export function commitmentKey(roundId: string, peachId: string): string {
  return `${roundId}_${peachId}`;
}

/** How long before its week starts a commitment can be made. */
export const COMMITMENT_OPENS_MS = 7 * 86_400_000;

/** The most a week's plan can be worth: twenty pars of everything. */
export const MAX_COMMITMENT = 2000;

export function isLocked(c: Pick<Commitment, 'locksAt'>, now: Date): boolean {
  return now.getTime() >= c.locksAt.getTime();
}

/**
 * How one side of a matchup scored a week: workout points for everything
 * logged, then the plan: a bonus for hitting what they committed to, or a
 * penalty for falling short of it.
 */
export interface WeekScore {
  readonly workouts: LogScore;
  /** The points committed to; zero without a plan. */
  readonly committed: number;
  /** Whether the workouts reached the commitment. */
  readonly hit: boolean;
  /** The bonus (positive) or penalty (negative). */
  readonly plan: number;
  readonly total: number;
}

export function commitmentFromJson(json: JsonMap): Commitment {
  return {
    seasonId: requireString(json['seasonId'], 'seasonId'),
    roundId: requireString(json['roundId'], 'roundId'),
    peachId: requireString(json['peachId'], 'peachId'),
    points: numberFromJson(json['points']),
    locksAt: new Date(intFromJson(json['locksAt'])),
    updatedAt: dateTimeFromJson(json['updatedAt']),
  };
}

/**
 * `locksAt` is stored as epoch milliseconds, not an ISO string like other
 * instants, because the security rules compare it with the request time.
 */
export function commitmentToJson(c: Commitment): JsonMap {
  return {
    seasonId: c.seasonId,
    roundId: c.roundId,
    peachId: c.peachId,
    points: c.points,
    locksAt: c.locksAt.getTime(),
    updatedAt: dateTimeToJson(c.updatedAt),
  };
}
