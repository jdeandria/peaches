import { IdGenerator } from '../domain/core/ids';
import { isActiveMembership } from '../domain/models/crate';
import { Routine } from '../domain/models/library';
import {
  ExerciseLogEntry,
  isSubmitted,
  removeEntry,
  upsertEntry,
  WorkoutLog,
  workoutLog,
} from '../domain/models/workout-log';
import { CrateRepository, WorkoutLogRepository } from '../domain/repositories';
import { implausibility } from '../domain/services/plausibility';
import { DomainError } from './errors';

/** The longest session a Peach can report. */
export const MAX_SESSION_MINUTES = 600;

/**
 * Recording what a Peach did. Logs are the Peach's own: they are not tied to
 * a Crate or Matchup, and submitting one shares it with every Crate the
 * Peach is active in, where it scores toward that week's matchup.
 */
export class LoggingService {
  constructor(
    private readonly deps: {
      logs: WorkoutLogRepository;
      crates: CrateRepository;
      ids: IdGenerator;
    },
  ) {}

  /** The Peach's newest unsubmitted log, if they have one going. */
  async currentLog(peachId: string): Promise<WorkoutLog | null> {
    return (await this.deps.logs.forPeach(peachId)).find((l) => !isSubmitted(l)) ?? null;
  }

  async startLog(peachId: string, now: Date, routine?: Routine): Promise<WorkoutLog> {
    const log = workoutLog({
      id: this.deps.ids.newId(),
      peachId,
      startedAt: now,
      routineId: routine?.id ?? null,
    });
    await this.deps.logs.save(log);
    return log;
  }

  /**
   * Adds or replaces the entry for one exercise. A log counts toward the
   * week it was started in, so the clock restarts when the first exercise is
   * recorded: a log opened on Sunday but filled in on Tuesday is Tuesday's.
   */
  async recordEntry(logId: string, entry: ExerciseLogEntry, now: Date): Promise<WorkoutLog> {
    const problem = implausibility(entry);
    if (problem) throw new DomainError(problem);
    const log = await this.requireEditable(logId);
    const started = log.entries.length === 0 ? { ...log, startedAt: now } : log;
    const updated = upsertEntry(started, entry);
    await this.deps.logs.save(updated);
    return updated;
  }

  async removeEntry(logId: string, exerciseId: string): Promise<WorkoutLog> {
    const updated = removeEntry(await this.requireEditable(logId), exerciseId);
    await this.deps.logs.save(updated);
    return updated;
  }

  /**
   * Freezes the log and shares it with the Peach's active Crates. Points
   * land in a matchup only if the log is submitted before that week's
   * round closes.
   */
  async submit(
    logId: string,
    now: Date,
    details: { durationMinutes?: number | null; notes?: string | null } = {},
  ): Promise<WorkoutLog> {
    const log = await this.requireEditable(logId);
    if (log.entries.length === 0) throw new DomainError('Log at least one exercise first.');
    const minutes = details.durationMinutes ?? log.durationMinutes;
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 0)) {
      throw new DomainError('Session length must be a whole number of minutes.');
    }
    if (minutes !== null && minutes > MAX_SESSION_MINUTES) {
      throw new DomainError('A session can’t be longer than 10 hours.');
    }
    const crates = (await this.deps.crates.membershipsFor(log.peachId))
      .filter(isActiveMembership)
      .map((m) => m.crateId)
      .sort();
    const submitted: WorkoutLog = {
      ...log,
      status: 'submitted',
      completedAt: now,
      durationMinutes: minutes,
      notes: details.notes?.trim() || log.notes,
      sharedWith: crates,
    };
    await this.deps.logs.saveSubmitted(submitted);
    return submitted;
  }

  private async requireEditable(logId: string): Promise<WorkoutLog> {
    const log = await this.deps.logs.getById(logId);
    if (!log) throw new DomainError('Workout log not found.');
    if (isSubmitted(log)) throw new DomainError('This workout has already been submitted.');
    return log;
  }
}
