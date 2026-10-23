import { IdGenerator } from '../domain/core/ids';
import { LocalDate, weekday } from '../domain/core/local-date';
import { Crate, isActiveMembership } from '../domain/models/crate';
import { withoutStruck } from '../domain/models/dispute';
import { WeekScore } from '../domain/models/commitment';
import {
  isSeasonOpen,
  Matchup,
  matchupPeachIds,
  MAX_SEASON_WEEKS,
  Round,
  Season,
} from '../domain/models/season';
import { Standing } from '../domain/models/score';
import { WorkoutLog } from '../domain/models/workout-log';
import { CrateRepository, SeasonRepository, WorkoutLogRepository } from '../domain/repositories';
import { RoundRobinScheduler } from '../domain/services/round-robin-scheduler';
import { RoundWindow, RoundWindowService } from '../domain/services/round-window';
import { ScoringService } from '../domain/services/scoring-service';
import { StandingsCalculator } from '../domain/services/standings-calculator';
import { DisputeService, DisputeView } from './dispute-service';
import { DomainError } from './errors';
import { PlanService } from './plan-service';
import { roundContext, RoundContext } from './round-context';
import { VotingService } from './voting-service';

export interface SeasonServiceDeps {
  readonly seasons: SeasonRepository;
  readonly crates: CrateRepository;
  readonly logs: WorkoutLogRepository;
  readonly voting: VotingService;
  readonly plans: PlanService;
  readonly disputes: DisputeService;
  readonly ids: IdGenerator;
  readonly windows: RoundWindowService;
  readonly scoring?: ScoringService;
  readonly standings?: StandingsCalculator;
}

/** One side of a matchup's week: what counts and how it scores. */
export interface MatchupSide {
  readonly peachId: string;
  /** The logs that count, as the Crate scores them (struck numbers removed). */
  readonly logs: readonly WorkoutLog[];
  /** The points their plan committed them to; zero without one. */
  readonly committed: number;
  readonly score: WeekScore;
}

/** A matchup with everything needed to show its live score. */
export interface MatchupBoard {
  readonly matchup: Matchup;
  readonly round: Round;
  readonly season: Season;
  readonly crate: Crate;
  readonly window: RoundWindow;
  readonly home: MatchupSide;
  /** Null for a bye. */
  readonly away: MatchupSide | null;
  /** Disputes about either side's logs this week. */
  readonly disputes: readonly DisputeView[];
}

/** A week's logs as the Crate scores them, with the disputes about them. */
interface WeekState {
  readonly window: RoundWindow;
  readonly rounds: readonly Round[];
  readonly logs: readonly WorkoutLog[];
  readonly disputes: readonly DisputeView[];
}

/**
 * Season lifecycle: scheduling a week-by-week round robin, opening each
 * week, closing it (scoring every matchup from the logs its two Peaches
 * shared with the Crate that week and their plans) and standings.
 */
export class SeasonService {
  private readonly scoring: ScoringService;
  private readonly standingsCalculator: StandingsCalculator;

  constructor(private readonly deps: SeasonServiceDeps) {
    this.scoring = deps.scoring ?? new ScoringService();
    this.standingsCalculator = deps.standings ?? new StandingsCalculator();
  }

  /**
   * Creates and schedules a Season for every active member of `crate`,
   * freezing the Crate's current vote on how it scores.
   */
  async createSeason(args: {
    crate: Crate;
    name: string;
    startWeek: LocalDate;
    weeks: number;
    now: Date;
  }): Promise<Season> {
    const { seasons, crates, voting, ids } = this.deps;
    if (weekday(args.startWeek) !== 1) throw new DomainError('Seasons start on a Monday.');
    if (!Number.isInteger(args.weeks) || args.weeks < 1 || args.weeks > MAX_SEASON_WEEKS) {
      throw new DomainError(`A Season runs 1 to ${MAX_SEASON_WEEKS} weeks.`);
    }
    if ((await seasons.forCrate(args.crate.id)).some(isSeasonOpen)) {
      throw new DomainError('Finish the current Season before starting another.');
    }
    const members = (await crates.membershipsOf(args.crate.id))
      .filter(isActiveMembership)
      .map((m) => m.peachId)
      .sort();
    if (members.length === 0) throw new DomainError('A Season needs at least one member.');
    const season: Season = {
      id: ids.newId(),
      crateId: args.crate.id,
      name: args.name.trim() || 'Season',
      startWeek: args.startWeek,
      weeks: args.weeks,
      participantIds: members,
      rules: await voting.currentRules(args.crate.id),
      status: 'scheduled',
      createdAt: args.now,
    };
    const schedule = new RoundRobinScheduler(ids).schedule(season);
    await seasons.save(season);
    await seasons.saveSchedule(schedule.rounds, schedule.matchups);
    return season;
  }

  /** Marks the week open and its matchups in progress. Safe to call repeatedly. */
  async openRound(roundId: string): Promise<Round> {
    const { seasons } = this.deps;
    const { round, season } = await roundContext(this.deps, roundId);
    for (const matchup of await seasons.matchupsInRound(round.id)) {
      if (matchup.status === 'scheduled') {
        await seasons.saveMatchup({ ...matchup, status: 'inProgress' });
      }
    }
    const opened: Round = { ...round, status: 'open' };
    await seasons.saveRound(opened);
    if (season.status === 'scheduled') await seasons.save({ ...season, status: 'active' });
    return opened;
  }

  /**
   * Scores every matchup in the week from the logs its Peaches shared with
   * the Crate (less anything the Crate struck) and their plans, using the
   * Season's frozen rules, and closes the round. Completes the Season when
   * its last round closes.
   */
  async closeRound(roundId: string): Promise<Round> {
    const { seasons } = this.deps;
    const context = await roundContext(this.deps, roundId);
    const { round, season } = context;
    const week = await this.week(context);
    for (const matchup of await seasons.matchupsInRound(round.id)) {
      const { home, away } = await this.sides(context, week, matchup);
      await seasons.saveMatchup({
        ...matchup,
        status: 'complete',
        result: { homePoints: home.score.total, awayPoints: away?.score.total ?? 0 },
      });
    }

    const closed: Round = { ...round, status: 'closed' };
    await seasons.saveRound(closed);
    if (week.rounds.every((r) => r.id === closed.id || r.status === 'closed')) {
      await seasons.save({ ...season, status: 'complete' });
    }
    return closed;
  }

  /** The week a round covers, in the owning Crate's time zone. */
  async windowFor(roundId: string): Promise<RoundWindow | null> {
    const { seasons, crates, windows } = this.deps;
    const round = await seasons.getRound(roundId);
    const season = round ? await seasons.getById(round.seasonId) : null;
    const crate = season ? await crates.getById(season.crateId) : null;
    if (!round || !crate) return null;
    return windows.windowFor(round, crate);
  }

  /**
   * Both sides of a matchup with the logs that count so far, their commitments
   * and their points, scored with the Season's rules. Null if the matchup is
   * gone.
   */
  async board(matchupId: string): Promise<MatchupBoard | null> {
    const matchup = await this.deps.seasons.getMatchup(matchupId);
    if (!matchup) return null;
    const context = await roundContext(this.deps, matchup.roundId);
    const week = await this.week(context);
    const players = new Set(matchupPeachIds(matchup));
    return {
      ...context,
      ...(await this.sides(context, week, matchup)),
      matchup,
      window: week.window,
      disputes: week.disputes.filter((d) => players.has(d.dispute.peachId)),
    };
  }

  /**
   * Opens weeks that have started and closes weeks whose grace period has
   * ended, so a Crate never has to press anything. Runs on app start and
   * whenever a screen refreshes.
   */
  async syncSeason(seasonId: string, now: Date): Promise<void> {
    const { seasons, crates, windows } = this.deps;
    const season = await seasons.getById(seasonId);
    const crate = season ? await crates.getById(season.crateId) : null;
    if (!season || !crate || !isSeasonOpen(season)) return;
    for (const round of await seasons.roundsOf(seasonId)) {
      const window = windows.windowFor(round, crate);
      if (round.status === 'scheduled' && now >= window.opensAt) {
        const opened = await this.openRound(round.id);
        if (window.hasClosedBy(now)) await this.closeRound(opened.id);
      } else if (round.status === 'open' && window.hasClosedBy(now)) {
        await this.closeRound(round.id);
      }
    }
  }

  /**
   * {@link syncSeason} for every open Season in every Crate `peachId`
   * belongs to, then their commitments (a Season scheduled after they
   * planned picks the plan up here).
   */
  async syncPeach(peachId: string, now: Date): Promise<void> {
    const { seasons, crates } = this.deps;
    for (const membership of await crates.membershipsFor(peachId)) {
      if (!isActiveMembership(membership)) continue;
      for (const season of await seasons.forCrate(membership.crateId)) {
        if (isSeasonOpen(season)) await this.syncSeason(season.id, now);
      }
    }
    await this.deps.plans.syncCommitments(peachId, now);
  }

  async standings(seasonId: string): Promise<Standing[]> {
    const { seasons } = this.deps;
    const season = await seasons.getById(seasonId);
    if (!season) return [];
    const rounds = await seasons.roundsOf(seasonId);
    return this.standingsCalculator.calculate({
      participantIds: season.participantIds,
      matchups: await seasons.matchupsOf(seasonId),
      roundIndexOf: new Map(rounds.map((r) => [r.id, r.index])),
    });
  }

  /**
   * The logs shared with the Crate and started during the round's week, as
   * the Crate scores them: without numbers it struck by majority vote.
   */
  private async week({ round, season, crate }: RoundContext): Promise<WeekState> {
    const window = this.deps.windows.windowFor(round, crate);
    const [logs, rounds] = await Promise.all([
      this.deps.logs.sharedWith(crate.id, window.opensAt, window.endsAt),
      this.deps.seasons.roundsOf(season.id),
    ]);
    const disputes = await this.deps.disputes.views(crate.id, logs);
    const struck = disputes.filter((d) => d.outcome === 'struck').map((d) => d.dispute);
    return { window, rounds, logs: logs.map((l) => withoutStruck(l, struck)), disputes };
  }

  /**
   * Both sides of a matchup's week: each Peach's logs and commitment, scored
   * with the Season's rules. A Peach who logged nothing scores zero; a bye
   * has no away side.
   */
  private async sides(
    { round, season }: RoundContext,
    week: WeekState,
    matchup: Matchup,
  ): Promise<{ home: MatchupSide; away: MatchupSide | null }> {
    const side = async (peachId: string) => ({
      peachId,
      logs: week.logs.filter((l) => l.peachId === peachId),
      committed: await this.deps.plans.committed(season.id, round.id, peachId),
    });
    const [home, away] = await Promise.all([
      side(matchup.homePeachId),
      matchup.awayPeachId === null ? null : side(matchup.awayPeachId),
    ]);
    const scores = this.scoring.scoreMatchup(home, away, season.rules);
    return {
      home: { ...home, score: scores.home },
      away: away && { ...away, score: scores.away! },
    };
  }
}
