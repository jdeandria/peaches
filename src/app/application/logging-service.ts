import { IdGenerator } from '../domain/core/ids';
import { isActiveMembership } from '../domain/models/crate';
import { SharedExercise } from '../domain/models/crate-exercise';
import {
  ExerciseLogEntry,
  isResumed,
  isSubmitted,
  pauseTimer,
  elapsedSeconds,
  removeEntry,
  resumeTimer,
  upsertEntry,
  WorkoutLog,
  workoutLog,
} from '../domain/models/workout-log';
import { CrateRepository, WorkoutLogRepository } from '../domain/repositories';
import { implausibility } from '../domain/services/plausibility';
import { DomainError } from './errors';

/** The longest session a log can record. */
export const MAX_SESSION_SECONDS = 10 * 3600;

/**
 * Recording what a Peach did. Logs are the Peach's own: they are not tied to
 * a Crate or Matchup, and submitting one shares it, and the exercises in it,
 * with every Crate the Peach is active in, where it scores toward that
 * week's matchup. The Peach can keep editing it after that.
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

  /**
   * Starts a log with its clock running since `startedAt`, when the Peach
   * opened the log screen.
   */
  async startLog(peachId: string, startedAt: Date): Promise<WorkoutLog> {
    const log = workoutLog({
      id: this.deps.ids.newId(),
      peachId,
      startedAt,
      timerStartedAt: startedAt,
    });
    await this.deps.logs.save(log);
    return log;
  }

  /**
   * The log screen opened: resumes the Peach's draft, or starts one. A
   * draft with nothing in it yet starts afresh, so a log opened on Sunday
   * but filled in on Tuesday counts as Tuesday's.
   */
  async openDraft(peachId: string, now: Date): Promise<WorkoutLog> {
    const draft = await this.currentLog(peachId);
    if (!draft) return this.startLog(peachId, now);
    const opened =
      draft.entries.length === 0
        ? { ...draft, startedAt: now, durationSeconds: 0, timerStartedAt: now }
        : resumeTimer(draft, now);
    if (opened !== draft) await this.deps.logs.save(opened);
    return opened;
  }

  /**
   * Picks a finished workout back up: it becomes the Peach's draft again,
   * and its clock carries on from where it stopped when the log screen
   * opens. Its Crates keep the copies from when it was finished until it is
   * finished again. An empty draft makes way for it; one with exercises in
   * it has to be finished first.
   */
  async resume(logId: string): Promise<WorkoutLog> {
    const log = await this.require(logId);
    if (!isSubmitted(log)) return log;
    const draft = await this.currentLog(log.peachId);
    if (draft && draft.entries.length > 0) {
      throw new DomainError('Finish the workout you’re logging first.');
    }
    if (draft) await this.deps.logs.discardDraft(draft.id);
    const resumed: WorkoutLog = { ...log, status: 'inProgress' };
    await this.deps.logs.save(resumed);
    return resumed;
  }

  /** Adds or replaces the entry for one exercise, before or after submitting. */
  async recordEntry(logId: string, entry: ExerciseLogEntry): Promise<WorkoutLog> {
    const problem = implausibility(entry);
    if (problem) throw new DomainError(problem);
    return this.update(logId, (log) => upsertEntry(log, entry));
  }

  async removeEntry(logId: string, exerciseId: string): Promise<WorkoutLog> {
    return this.update(logId, (log) => {
      const updated = removeEntry(log, exerciseId);
      if ((isSubmitted(log) || isResumed(log)) && updated.entries.length === 0) {
        throw new DomainError('A workout needs at least one exercise.');
      }
      return updated;
    });
  }

  /** Stops the clock while the log screen is closed; a no-op once submitted. */
  async pauseTimer(logId: string, now: Date): Promise<WorkoutLog> {
    const log = await this.require(logId);
    const paused = pauseTimer(log, now);
    if (paused !== log) await this.deps.logs.save(paused);
    return paused;
  }

  /**
   * Stops the clock and shares the log with the Peach's active Crates.
   * Points land in a matchup only if the log is submitted before that
   * week's round closes.
   */
  async submit(logId: string, now: Date): Promise<WorkoutLog> {
    const log = await this.require(logId);
    if (isSubmitted(log)) throw new DomainError('This workout has already been submitted.');
    if (log.entries.length === 0) throw new DomainError('Log at least one exercise first.');
    const submitted: WorkoutLog = {
      ...log,
      status: 'submitted',
      completedAt: now,
      durationSeconds: Math.min(MAX_SESSION_SECONDS, elapsedSeconds(log, now)),
      timerStartedAt: null,
      sharedWith: await this.activeCrateIds(log.peachId),
    };
    await this.deps.logs.saveSubmitted(submitted);
    return submitted;
  }

  /** Corrects when a submitted workout happened, how long it took, and its notes. */
  async editDetails(
    logId: string,
    details: { startedAt: Date; durationSeconds: number; notes: string },
    now: Date,
  ): Promise<WorkoutLog> {
    const { startedAt, durationSeconds } = details;
    if (Number.isNaN(startedAt.getTime()) || startedAt > now) {
      throw new DomainError('A workout can’t start in the future.');
    }
    if (!Number.isInteger(durationSeconds) || durationSeconds < 0) {
      throw new DomainError('Session time must be a whole number of seconds.');
    }
    if (durationSeconds > MAX_SESSION_SECONDS) {
      throw new DomainError('A session can’t be longer than 10 hours.');
    }
    return this.update(logId, (log) => {
      if (!isSubmitted(log)) throw new DomainError('Finish the workout first.');
      return { ...log, startedAt, durationSeconds, notes: details.notes.trim() || null };
    });
  }

  /**
   * Exercises crate-mates have logged in any of the Peach's Crates, for the
   * exercise picker; each is tagged with who logged it.
   */
  async crateExercises(peachId: string): Promise<SharedExercise[]> {
    const lists = await Promise.all(
      (await this.activeCrateIds(peachId)).map((id) => this.deps.logs.exercisesSharedWith(id)),
    );
    return lists.flat();
  }

  /**
   * Applies `change` and saves: a draft privately; a submitted log with its
   * copies, re-shared with the Crates it was shared with that the Peach is
   * still in.
   */
  private async update(
    logId: string,
    change: (log: WorkoutLog) => WorkoutLog,
  ): Promise<WorkoutLog> {
    const log = await this.require(logId);
    const changed = change(log);
    if (!isSubmitted(changed)) {
      await this.deps.logs.save(changed);
      return changed;
    }
    const active = new Set(await this.activeCrateIds(log.peachId));
    const updated = { ...changed, sharedWith: changed.sharedWith.filter((id) => active.has(id)) };
    await this.deps.logs.saveSubmitted(updated);
    return updated;
  }

  private async require(logId: string): Promise<WorkoutLog> {
    const log = await this.deps.logs.getById(logId);
    if (!log) throw new DomainError('Workout log not found.');
    return log;
  }

  private async activeCrateIds(peachId: string): Promise<string[]> {
    return (await this.deps.crates.membershipsFor(peachId))
      .filter(isActiveMembership)
      .map((m) => m.crateId)
      .sort();
  }
}
