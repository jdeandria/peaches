import { IdGenerator } from '../domain/core/ids';
import { LocalDate, weekday } from '../domain/core/local-date';
import { Crate, isActiveMembership } from '../domain/models/crate';
import { LogScore } from '../domain/models/scoring';
import { isSeasonOpen, Matchup, MAX_SEASON_WEEKS, Round, Season } from '../domain/models/season';
import { Standing } from '../domain/models/score';
import { WorkoutLog } from '../domain/models/workout-log';
import { CrateRepository, SeasonRepository, WorkoutLogRepository } from '../domain/repositories';
import { RoundRobinScheduler } from '../domain/services/round-robin-scheduler';
import { RoundWindow, RoundWindowService } from '../domain/services/round-window';
import { ScoringService } from '../domain/services/scoring-service';
import { StandingsCalculator } from '../domain/services/standings-calculator';
import { DomainError } from './errors';
import { VotingService } from './voting-service';

export interface SeasonServiceDeps {
  readonly seasons: SeasonRepository;
  readonly crates: CrateRepository;
  readonly logs: WorkoutLogRepository;
  readonly voting: VotingService;
  readonly ids: IdGenerator;
  readonly windows: RoundWindowService;
  readonly scoring?: ScoringService;
  readonly standings?: StandingsCalculator;
}

/** One side of a matchup's week: the logs that count and what they score. */
export interface MatchupSide {
  readonly peachId: string;
  readonly logs: readonly WorkoutLog[];
  readonly score: LogScore;
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
}

/**
 * Season lifecycle: scheduling a week-by-week round robin, opening each
 * week, closing it (scoring every matchup from the logs its two Peaches
 * shared with the Crate that week) and standings.
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
   * freezing the Crate's current vote on category weights.
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
      weights: await voting.currentWeights(args.crate.id),
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
    const { round, season } = await this.context(roundId);
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
   * the Crate, using the Season's frozen weights, and closes the round.
   * Completes the Season when its last round closes.
   */
  async closeRound(roundId: string): Promise<Round> {
    const { seasons } = this.deps;
    const { round, season, crate } = await this.context(roundId);
    const window = this.deps.windows.windowFor(round, crate);
    const logs = await this.weekLogs(crate.id, window);

    for (const matchup of await seasons.matchupsInRound(round.id)) {
      await seasons.saveMatchup(
        this.scoring.resolve({
          matchup,
          homeLogs: logs.filter((l) => l.peachId === matchup.homePeachId),
          awayLogs: logs.filter((l) => l.peachId === matchup.awayPeachId),
          weights: season.weights,
        }),
      );
    }

    const closed: Round = { ...round, status: 'closed' };
    await seasons.saveRound(closed);
    const rounds = await seasons.roundsOf(season.id);
    if (rounds.every((r) => r.status === 'closed')) {
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
   * Both sides of a matchup with the logs that count so far and their
   * points, scored with the Season's weights. Null if the matchup is gone.
   */
  async board(matchupId: string): Promise<MatchupBoard | null> {
    const matchup = await this.deps.seasons.getMatchup(matchupId);
    if (!matchup) return null;
    const { round, season, crate } = await this.context(matchup.roundId);
    const window = this.deps.windows.windowFor(round, crate);
    const logs = await this.weekLogs(crate.id, window);
    const side = (peachId: string): MatchupSide => {
      const mine = logs.filter((l) => l.peachId === peachId);
      return { peachId, logs: mine, score: this.scoring.scoreLogs(mine, season.weights) };
    };
    return {
      matchup,
      round,
      season,
      crate,
      window,
      home: side(matchup.homePeachId),
      away: matchup.awayPeachId === null ? null : side(matchup.awayPeachId),
    };
  }

  /**
   * Opens weeks that have started and closes weeks whose grace period has
   * ended, so a Crate never has to press anything. Runs on app start and
   * whenever the Today screen refreshes.
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

  /** {@link syncSeason} for every open Season in every Crate `peachId` belongs to. */
  async syncPeach(peachId: string, now: Date): Promise<void> {
    const { seasons, crates } = this.deps;
    for (const membership of await crates.membershipsFor(peachId)) {
      if (!isActiveMembership(membership)) continue;
      for (const season of await seasons.forCrate(membership.crateId)) {
        if (isSeasonOpen(season)) await this.syncSeason(season.id, now);
      }
    }
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

  /** Submitted logs shared with the Crate and started during the round's week. */
  private async weekLogs(crateId: string, window: RoundWindow): Promise<WorkoutLog[]> {
    return this.deps.logs.sharedWith(crateId, window.opensAt, window.endsAt);
  }

  private async context(roundId: string): Promise<{ round: Round; season: Season; crate: Crate }> {
    const { seasons, crates } = this.deps;
    const round = await seasons.getRound(roundId);
    if (!round) throw new DomainError('Round not found.');
    const season = await seasons.getById(round.seasonId);
    const crate = season ? await crates.getById(season.crateId) : null;
    if (!season || !crate) throw new DomainError('Season not found.');
    return { round, season, crate };
  }
}
