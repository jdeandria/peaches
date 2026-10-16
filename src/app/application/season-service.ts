import { IdGenerator } from '../domain/core/ids';
import { LocalDate } from '../domain/core/local-date';
import { clamp } from '../domain/core/math';
import { stableHash } from '../domain/core/stable-hash';
import { Crate, isActiveMembership } from '../domain/models/crate';
import { isSeasonOpen, Matchup, matchupPeachIds, Round, Season } from '../domain/models/season';
import { Standing } from '../domain/models/score';
import { Workout, workoutItems } from '../domain/models/workout';
import { isSubmitted, WorkoutLog } from '../domain/models/workout-log';
import {
  CapabilityRepository,
  CrateRepository,
  PeachRepository,
  SeasonRepository,
  WorkoutLogRepository,
  WorkoutRepository,
} from '../domain/repositories';
import { ExercisePoolService } from '../domain/services/exercise-pool';
import { RoundRobinScheduler } from '../domain/services/round-robin-scheduler';
import { RoundWindow, RoundWindowService } from '../domain/services/round-window';
import { ScoringService } from '../domain/services/scoring-service';
import { StandingsCalculator } from '../domain/services/standings-calculator';
import { WorkoutGenerator } from '../domain/services/workout-generator';
import { DomainError } from './errors';

/** How many previous rounds count as "recent" for exercise variety. */
export const RECENT_ROUND_WINDOW = 3;

export interface SeasonServiceDeps {
  readonly seasons: SeasonRepository;
  readonly crates: CrateRepository;
  readonly peaches: PeachRepository;
  readonly capabilities: CapabilityRepository;
  readonly workouts: WorkoutRepository;
  readonly logs: WorkoutLogRepository;
  readonly pool: ExercisePoolService;
  readonly generator: WorkoutGenerator;
  readonly ids: IdGenerator;
  readonly windows: RoundWindowService;
  readonly scoring?: ScoringService;
  readonly standings?: StandingsCalculator;
}

/**
 * A stable seed per matchup so any device that opens the round (or re-opens
 * it after a crash) generates the identical workout. Together with the
 * deterministic workout id this makes opening idempotent across the whole
 * Crate: there is no server, so every client is allowed to do it and they
 * all converge on the same document.
 */
export function seedFor(matchup: Matchup, round: Round): number {
  return stableHash(`${matchup.id}|${round.id}|${round.index}`);
}

/**
 * Season lifecycle: scheduling, opening rounds (generating workouts),
 * closing rounds (scoring) and standings.
 */
export class SeasonService {
  private readonly scoring: ScoringService;
  private readonly standingsCalculator: StandingsCalculator;

  constructor(private readonly deps: SeasonServiceDeps) {
    this.scoring = deps.scoring ?? new ScoringService();
    this.standingsCalculator = deps.standings ?? new StandingsCalculator();
  }

  /** Creates and schedules a Season for every active member of `crate`. */
  async createSeason(args: {
    crate: Crate;
    name: string;
    exerciseDays: readonly LocalDate[];
    now: Date;
  }): Promise<Season> {
    const { seasons, crates, ids } = this.deps;
    const days = [...new Set(args.exerciseDays)].sort();
    if (days.length === 0) throw new DomainError('Pick at least one exercise day.');
    const members = (await crates.membershipsOf(args.crate.id))
      .filter(isActiveMembership)
      .map((m) => m.peachId)
      .sort();
    if (members.length === 0) throw new DomainError('A Season needs at least one member.');
    const season: Season = {
      id: ids.newId(),
      crateId: args.crate.id,
      name: args.name.trim() || 'Season',
      exerciseDays: days,
      participantIds: members,
      status: 'scheduled',
      createdAt: args.now,
    };
    const schedule = new RoundRobinScheduler(ids).schedule(season, args.crate.settings.goal);
    await seasons.save(season);
    await seasons.saveSchedule(schedule.rounds, schedule.matchups);
    return season;
  }

  /**
   * Generates a workout for every matchup in the round that lacks one and
   * marks the round open. Safe to call repeatedly.
   */
  async openRound(roundId: string, now: Date): Promise<Round> {
    const { seasons, workouts } = this.deps;
    const { round, season, crate } = await this.context(roundId);

    const recent = await this.recentUse(season, round);
    for (const matchup of await seasons.matchupsInRound(round.id)) {
      if (matchup.workoutId !== null) continue;
      const workout = await this.generateFor(matchup, round, crate, recent, now);
      await workouts.save(workout);
      await seasons.saveMatchup({ ...matchup, workoutId: workout.id, status: 'inProgress' });
    }

    const opened: Round = { ...round, status: 'open' };
    await seasons.saveRound(opened);
    if (season.status === 'scheduled') await seasons.save({ ...season, status: 'active' });
    return opened;
  }

  /**
   * Scores every matchup in the round from the submitted logs and closes it.
   * Completes the Season when its last round closes.
   */
  async closeRound(roundId: string): Promise<Round> {
    const { seasons, workouts } = this.deps;
    const { round, season, crate } = await this.context(roundId);

    for (const matchup of await seasons.matchupsInRound(round.id)) {
      const workout = matchup.workoutId ? await workouts.getById(matchup.workoutId) : null;
      if (!workout) continue;
      const homeLog = await this.submittedLog(matchup.id, matchup.homePeachId);
      const awayLog = matchup.awayPeachId
        ? await this.submittedLog(matchup.id, matchup.awayPeachId)
        : null;
      await seasons.saveMatchup(
        this.scoring.resolve({
          matchup,
          workout,
          homeLog,
          awayLog,
          rules: crate.settings.scoringRules,
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

  /** The logging window of a round, in the owning Crate's time zone. */
  async windowFor(roundId: string): Promise<RoundWindow | null> {
    const { seasons, crates, windows } = this.deps;
    const round = await seasons.getRound(roundId);
    const season = round ? await seasons.getById(round.seasonId) : null;
    const crate = season ? await crates.getById(season.crateId) : null;
    if (!round || !crate) return null;
    return windows.windowFor(round, crate);
  }

  /**
   * Opens rounds whose window has started and closes rounds whose window has
   * ended, so a Crate never has to press anything on exercise day. Runs on
   * app start and whenever the Today screen refreshes.
   */
  async syncSeason(seasonId: string, now: Date): Promise<void> {
    const { seasons, crates, windows } = this.deps;
    const season = await seasons.getById(seasonId);
    const crate = season ? await crates.getById(season.crateId) : null;
    if (!season || !crate || !isSeasonOpen(season)) return;
    for (const round of await seasons.roundsOf(seasonId)) {
      const window = windows.windowFor(round, crate);
      if (round.status === 'scheduled' && now >= window.opensAt) {
        const opened = await this.openRound(round.id, now);
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

  private async context(roundId: string): Promise<{ round: Round; season: Season; crate: Crate }> {
    const { seasons, crates } = this.deps;
    const round = await seasons.getRound(roundId);
    if (!round) throw new DomainError('Round not found.');
    const season = await seasons.getById(round.seasonId);
    const crate = season ? await crates.getById(season.crateId) : null;
    if (!season || !crate) throw new DomainError('Season not found.');
    return { round, season, crate };
  }

  private async generateFor(
    matchup: Matchup,
    round: Round,
    crate: Crate,
    recentUse: ReadonlyMap<string, number>,
    now: Date,
  ): Promise<Workout> {
    const { peaches, capabilities, pool, generator } = this.deps;
    const peachIds = matchupPeachIds(matchup);
    const players = await peaches.getByIds(peachIds);
    const caps = await capabilities.forPeaches(peachIds);
    const levels = players.map((p) => p.fitnessLevel);
    const minLevel = levels.length === 0 ? 2 : Math.min(...levels);
    const meanLevel = levels.length === 0 ? 2 : levels.reduce((a, b) => a + b, 0) / levels.length;
    const maxDifficulty = clamp(minLevel + 1, 1, 5);

    return generator.generate(
      {
        availableExercises: pool.poolFor(peachIds, caps, {
          settings: crate.settings,
          maxDifficulty,
        }),
        focus: round.focus,
        goal: crate.settings.goal,
        durationMinutes: crate.settings.workoutDurationMinutes,
        targetDifficulty: clamp(meanLevel, 1, 5),
        maxDifficulty,
        seed: seedFor(matchup, round),
        recentUse,
        title: `Round ${round.index + 1}`,
        workoutId: `w-${matchup.id}`,
      },
      now,
    );
  }

  /**
   * exerciseId -> rounds ago, looking back {@link RECENT_ROUND_WINDOW} rounds
   * across every workout in the Season (the whole Crate shares variety).
   */
  private async recentUse(season: Season, round: Round): Promise<Map<string, number>> {
    const { seasons, workouts } = this.deps;
    const previous = (await seasons.roundsOf(season.id)).filter(
      (r) => r.index < round.index && round.index - r.index <= RECENT_ROUND_WINDOW,
    );
    const result = new Map<string, number>();
    for (const r of previous) {
      const ago = round.index - r.index - 1;
      const ids = (await seasons.matchupsInRound(r.id))
        .map((m) => m.workoutId)
        .filter((id): id is string => id !== null);
      for (const workout of await workouts.getByIds(ids)) {
        for (const item of workoutItems(workout)) {
          const existing = result.get(item.exerciseId);
          if (existing === undefined || ago < existing) result.set(item.exerciseId, ago);
        }
      }
    }
    return result;
  }

  private async submittedLog(matchupId: string, peachId: string): Promise<WorkoutLog | null> {
    const log = await this.deps.logs.forMatchup(matchupId, peachId);
    return log && isSubmitted(log) ? log : null;
  }
}
