import {
  dateTimeFromJson,
  dateTimeToJson,
  enumFromJson,
  intFromJson,
  JsonMap,
  mapFromJson,
  numberFromJson,
  requireString,
  stringListFromJson,
  stringOrNull,
} from '../core/json';
import { addDays, LocalDate, parseLocalDate } from '../core/local-date';
import { rulesFromJson, rulesToJson, ScoringRules } from './scoring';

export const SEASON_STATUSES = ['draft', 'scheduled', 'active', 'complete', 'cancelled'] as const;
export type SeasonStatus = (typeof SEASON_STATUSES)[number];

/** How long a Season can run. */
export const MAX_SEASON_WEEKS = 12;

/**
 * A fantasy-style tournament run by one Crate, one matchup per week.
 *
 * Each week (Monday to Sunday in the Crate's time zone) is a {@link Round}
 * that pairs the participants into {@link Matchup}s. Participants are frozen
 * when the Season is scheduled, so members who join later wait for the next
 * Season. So are the scoring rules: the Crate's vote at scheduling time
 * decides how the whole Season scores, and later votes apply to the next one.
 */
export interface Season {
  readonly id: string;
  readonly crateId: string;
  readonly name: string;
  /** The Monday the first week starts. */
  readonly startWeek: LocalDate;
  readonly weeks: number;
  /** Peaches competing in this Season, frozen at scheduling time. */
  readonly participantIds: readonly string[];
  /** Category weights and plan rules, frozen at scheduling time. */
  readonly rules: ScoringRules;
  readonly status: SeasonStatus;
  readonly createdAt: Date;
}

export function seasonStartDate(s: Season): LocalDate {
  return s.startWeek;
}

/** The Sunday the last week ends. */
export function seasonEndDate(s: Season): LocalDate {
  return addDays(s.startWeek, s.weeks * 7 - 1);
}

export function isSeasonOpen(s: Season): boolean {
  return s.status === 'scheduled' || s.status === 'active';
}

export function seasonFromJson(json: JsonMap): Season {
  return {
    id: requireString(json['id'], 'id'),
    crateId: requireString(json['crateId'], 'crateId'),
    name: requireString(json['name'], 'name'),
    startWeek: parseLocalDate(requireString(json['startWeek'], 'startWeek')),
    weeks: intFromJson(json['weeks'], 1),
    participantIds: stringListFromJson(json['participantIds']),
    rules: rulesFromJson(mapFromJson(json['rules'])),
    status: enumFromJson(SEASON_STATUSES, json['status'], 'draft'),
    createdAt: dateTimeFromJson(json['createdAt']),
  };
}

export function seasonToJson(s: Season): JsonMap {
  return {
    id: s.id,
    crateId: s.crateId,
    name: s.name,
    startWeek: s.startWeek,
    weeks: s.weeks,
    participantIds: [...s.participantIds],
    rules: rulesToJson(s.rules),
    status: s.status,
    createdAt: dateTimeToJson(s.createdAt),
  };
}

export const ROUND_STATUSES = ['scheduled', 'open', 'closed'] as const;
export type RoundStatus = (typeof ROUND_STATUSES)[number];

/** One week of a Season. */
export interface Round {
  readonly id: string;
  readonly seasonId: string;
  /** Zero-based position within the Season. */
  readonly index: number;
  /** The Monday the week starts, in the Crate's time zone. */
  readonly weekStart: LocalDate;
  readonly status: RoundStatus;
}

/** The Sunday the round's week ends. */
export function roundEndDate(r: Round): LocalDate {
  return addDays(r.weekStart, 6);
}

export function roundFromJson(json: JsonMap): Round {
  return {
    id: requireString(json['id'], 'id'),
    seasonId: requireString(json['seasonId'], 'seasonId'),
    index: intFromJson(json['index']),
    weekStart: parseLocalDate(requireString(json['weekStart'], 'weekStart')),
    status: enumFromJson(ROUND_STATUSES, json['status'], 'scheduled'),
  };
}

export function roundToJson(r: Round): JsonMap {
  return {
    id: r.id,
    seasonId: r.seasonId,
    index: r.index,
    weekStart: r.weekStart,
    status: r.status,
  };
}

export const MATCHUP_STATUSES = ['scheduled', 'inProgress', 'complete'] as const;
export type MatchupStatus = (typeof MATCHUP_STATUSES)[number];

/** The outcome of a completed Matchup. */
export interface MatchupResult {
  readonly homePoints: number;
  readonly awayPoints: number;
}

export function isTie(r: MatchupResult): boolean {
  return r.homePoints === r.awayPoints;
}

export function homeWon(r: MatchupResult): boolean {
  return r.homePoints > r.awayPoints;
}

/**
 * A head-to-head pairing for one week. Each Peach brings their own workouts:
 * everything they log that week scores toward it.
 *
 * `awayPeachId` is null for a bye: the home Peach still scores points-for,
 * but no win or loss is recorded.
 */
export interface Matchup {
  readonly id: string;
  readonly seasonId: string;
  readonly roundId: string;
  readonly homePeachId: string;
  readonly awayPeachId: string | null;
  readonly status: MatchupStatus;
  readonly result: MatchupResult | null;
}

export type NewMatchup = Pick<Matchup, 'id' | 'seasonId' | 'roundId' | 'homePeachId'> &
  Partial<Matchup>;

export function matchup(init: NewMatchup): Matchup {
  return { awayPeachId: null, status: 'scheduled', result: null, ...init };
}

export function isBye(m: Matchup): boolean {
  return m.awayPeachId === null;
}

export function matchupPeachIds(m: Matchup): string[] {
  return m.awayPeachId === null ? [m.homePeachId] : [m.homePeachId, m.awayPeachId];
}

export function involves(m: Matchup, peachId: string): boolean {
  return m.homePeachId === peachId || m.awayPeachId === peachId;
}

/** The opponent of `peachId`, or null for a bye or a non-participant. */
export function opponentOf(m: Matchup, peachId: string): string | null {
  if (peachId === m.homePeachId) return m.awayPeachId;
  if (peachId === m.awayPeachId) return m.homePeachId;
  return null;
}

/** The winner's id, or null for a tie, a bye or an unfinished matchup. */
export function winnerId(m: Matchup): string | null {
  const r = m.result;
  if (r === null || isBye(m) || isTie(r)) return null;
  return homeWon(r) ? m.homePeachId : m.awayPeachId;
}

export function matchupFromJson(json: JsonMap): Matchup {
  const result = mapFromJson(json['result']);
  return {
    id: requireString(json['id'], 'id'),
    seasonId: requireString(json['seasonId'], 'seasonId'),
    roundId: requireString(json['roundId'], 'roundId'),
    homePeachId: requireString(json['homePeachId'], 'homePeachId'),
    awayPeachId: stringOrNull(json['awayPeachId']),
    status: enumFromJson(MATCHUP_STATUSES, json['status'], 'scheduled'),
    result: result
      ? {
          homePoints: numberFromJson(result['homePoints']),
          awayPoints: numberFromJson(result['awayPoints']),
        }
      : null,
  };
}

export function matchupToJson(m: Matchup): JsonMap {
  return {
    id: m.id,
    seasonId: m.seasonId,
    roundId: m.roundId,
    homePeachId: m.homePeachId,
    awayPeachId: m.awayPeachId,
    status: m.status,
    result: m.result ? { homePoints: m.result.homePoints, awayPoints: m.result.awayPoints } : null,
  };
}
