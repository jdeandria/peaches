import { IdGenerator } from '../domain/core/ids';
import { involves, Matchup } from '../domain/models/season';
import { WorkoutScore, ZERO_SCORE } from '../domain/models/score';
import { STANDARD_SCORING_RULES } from '../domain/models/scoring-rules';
import {
  ExerciseLogEntry,
  isSubmitted,
  upsertEntry,
  WorkoutLog,
  workoutLog,
} from '../domain/models/workout-log';
import {
  CrateRepository,
  SeasonRepository,
  WorkoutLogRepository,
  WorkoutRepository,
} from '../domain/repositories';
import { RoundWindowService } from '../domain/services/round-window';
import { ScoringService } from '../domain/services/scoring-service';
import { DomainError } from './errors';

/** Recording what a Peach did: against a Matchup's workout or free-form. */
export class LoggingService {
  constructor(
    private readonly deps: {
      logs: WorkoutLogRepository;
      workouts: WorkoutRepository;
      ids: IdGenerator;
      seasons: SeasonRepository;
      crates: CrateRepository;
      windows: RoundWindowService;
      scoring?: ScoringService;
    },
  ) {}

  private get scoring(): ScoringService {
    return this.deps.scoring ?? DEFAULT_SCORING;
  }

  /** Returns the Peach's log for the matchup, creating it on first use. */
  async logForMatchup(matchup: Matchup, peachId: string, now: Date): Promise<WorkoutLog> {
    if (!involves(matchup, peachId)) throw new DomainError('You are not part of this matchup.');
    if (matchup.workoutId === null) throw new DomainError('This round has not opened yet.');
    const existing = await this.deps.logs.forMatchup(matchup.id, peachId);
    if (existing) return existing;
    const log = workoutLog({
      id: this.deps.ids.newId(),
      peachId,
      workoutId: matchup.workoutId,
      matchupId: matchup.id,
      startedAt: now,
    });
    await this.deps.logs.save(log);
    return log;
  }

  async startFreeLog(peachId: string, now: Date): Promise<WorkoutLog> {
    const log = workoutLog({ id: this.deps.ids.newId(), peachId, startedAt: now });
    await this.deps.logs.save(log);
    return log;
  }

  /** Adds or replaces the entry for one exercise / workout item. */
  async recordEntry(logId: string, entry: ExerciseLogEntry): Promise<WorkoutLog> {
    const updated = upsertEntry(await this.requireEditable(logId), entry);
    await this.deps.logs.save(updated);
    return updated;
  }

  async submit(logId: string, now: Date, notes?: string | null): Promise<WorkoutLog> {
    const log = await this.requireEditable(logId);
    if (log.matchupId !== null && !(await this.windowOpen(log.matchupId, now))) {
      throw new DomainError('The logging window for this round has closed.');
    }
    const submitted: WorkoutLog = {
      ...log,
      status: 'submitted',
      completedAt: now,
      notes: notes ?? log.notes,
    };
    await this.deps.logs.save(submitted);
    return submitted;
  }

  /** Live score for a log against its workout (zero for free logs). */
  async scoreFor(log: WorkoutLog, rules = STANDARD_SCORING_RULES): Promise<WorkoutScore> {
    const workout = log.workoutId === null ? null : await this.deps.workouts.getById(log.workoutId);
    return workout ? this.scoring.score(workout, log, rules) : ZERO_SCORE;
  }

  private async windowOpen(matchupId: string, now: Date): Promise<boolean> {
    const { seasons, crates, windows } = this.deps;
    const matchup = await seasons.getMatchup(matchupId);
    const round = matchup ? await seasons.getRound(matchup.roundId) : null;
    const season = round ? await seasons.getById(round.seasonId) : null;
    const crate = season ? await crates.getById(season.crateId) : null;
    if (!round || !crate) return false;
    return windows.windowFor(round, crate).isOpenAt(now);
  }

  private async requireEditable(logId: string): Promise<WorkoutLog> {
    const log = await this.deps.logs.getById(logId);
    if (!log) throw new DomainError('Workout log not found.');
    if (isSubmitted(log)) throw new DomainError('This workout has already been submitted.');
    return log;
  }
}

const DEFAULT_SCORING = new ScoringService();
