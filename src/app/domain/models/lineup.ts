import {
  dateTimeFromJson,
  dateTimeToJson,
  enumFromJson,
  intFromJson,
  JsonMap,
  mapListFromJson,
  numberFromJson,
  requireString,
} from '../core/json';
import { MatchOutcome } from './score';
import {
  CATEGORY_INFO,
  LineupRules,
  LogScore,
  SCORING_CATEGORIES,
  ScoringCategory,
} from './scoring';

/** A category a Peach commits to for the week, and how much of it they'll do. */
export interface Pledge {
  readonly category: ScoringCategory;
  /** In the category's canonical unit (km, m, kg, reps or minutes). */
  readonly target: number;
}

/** The most a pledge can be, in pars: generous, but no typo can pledge a marathon a day. */
export const MAX_PLEDGE_PARS = 20;

/**
 * A Peach's lineup for one week of a Season: up to the Season's number of
 * slots, each a pledge in a different category. It can change until the
 * week starts (`locksAt`); until then crate-mates can't see it, so
 * opponents have to guess at each other's plans.
 */
export interface Lineup {
  readonly seasonId: string;
  readonly roundId: string;
  readonly peachId: string;
  readonly pledges: readonly Pledge[];
  readonly locksAt: Date;
  readonly updatedAt: Date;
}

/** Document key: one lineup per Peach per week. */
export function lineupKey(roundId: string, peachId: string): string {
  return `${roundId}_${peachId}`;
}

/** How long before its week starts a lineup can be set. */
export const LINEUP_OPENS_MS = 7 * 86_400_000;

export function isLocked(lineup: Pick<Lineup, 'locksAt'>, now: Date): boolean {
  return now.getTime() >= lineup.locksAt.getTime();
}

/** Why `pledges` can't be a lineup under `rules`, or null when it can. */
export function lineupProblem(pledges: readonly Pledge[], rules: LineupRules): string | null {
  if (pledges.length > rules.slots) {
    return rules.slots === 0
      ? 'This Season doesn’t use lineups.'
      : `Pick at most ${rules.slots} categories.`;
  }
  if (new Set(pledges.map((p) => p.category)).size !== pledges.length) {
    return 'Pledge each category once.';
  }
  for (const p of pledges) {
    const max = MAX_PLEDGE_PARS * CATEGORY_INFO[p.category].par;
    if (!Number.isFinite(p.target) || p.target <= 0) return 'Pledges must be more than zero.';
    if (p.target > max) return 'That pledge is more than anyone could do in a week.';
  }
  return null;
}

/** A pledge, scored: hit it and you earn the bonus. */
export interface PledgeResult {
  readonly category: ScoringCategory;
  readonly target: number;
  readonly amount: number;
  readonly hit: boolean;
  readonly points: number;
}

/** A lineup category, head to head with the opponent's amount in it. */
export interface BattleResult {
  readonly category: ScoringCategory;
  readonly mine: number;
  readonly theirs: number;
  readonly outcome: MatchOutcome;
  readonly points: number;
}

/**
 * How one side of a matchup scored a week: workout points for everything
 * logged, plus pledge bonuses and battles from the lineup.
 */
export interface WeekScore {
  readonly workouts: LogScore;
  readonly pledges: readonly PledgeResult[];
  readonly battles: readonly BattleResult[];
  readonly total: number;
}

/** Pledges in categories this client doesn't know are dropped. */
function pledgesFromJson(raw: unknown): Pledge[] {
  return mapListFromJson(raw).flatMap((json) => {
    const category = enumFromJson<ScoringCategory | 'unknown'>(
      [...SCORING_CATEGORIES, 'unknown'],
      json['category'],
      'unknown',
    );
    return category === 'unknown' ? [] : [{ category, target: numberFromJson(json['target']) }];
  });
}

export function lineupFromJson(json: JsonMap): Lineup {
  return {
    seasonId: requireString(json['seasonId'], 'seasonId'),
    roundId: requireString(json['roundId'], 'roundId'),
    peachId: requireString(json['peachId'], 'peachId'),
    pledges: pledgesFromJson(json['pledges']),
    locksAt: new Date(intFromJson(json['locksAt'])),
    updatedAt: dateTimeFromJson(json['updatedAt']),
  };
}

/**
 * `locksAt` is stored as epoch milliseconds, not an ISO string like other
 * instants, because the security rules compare it with the request time.
 */
export function lineupToJson(l: Lineup): JsonMap {
  return {
    seasonId: l.seasonId,
    roundId: l.roundId,
    peachId: l.peachId,
    pledges: l.pledges.map((p) => ({ category: p.category, target: p.target })),
    locksAt: l.locksAt.getTime(),
    updatedAt: dateTimeToJson(l.updatedAt),
  };
}
