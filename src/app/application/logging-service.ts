import { IdGenerator } from '../domain/core/ids';
import { isActiveMembership } from '../domain/models/crate';
import { SharedExercise } from '../domain/models/crate-exercise';
import {
  entryFor,
  ExerciseLogEntry,
  hasStarted,
  isSubmitted,
  logPlannedSet,
  pauseTimer,
  elapsedSeconds,
  planCoveringEntries,
  plannedFor,
  removeEntry,
  removePlanned,
  resumeTimer,
  SetLog,
  skipPlannedSet,
  startSession,
  unlogLastSet,
  upsertEntry,
  upsertPlanned,
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
   * Starts a log with its clock already running since `startedAt`, for a
   * workout recorded as it happens without a plan.
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
   * A new draft whose session plan is `plan`, not started yet: a planned
   * workout being launched (see `PlanService.launch`), the only way a
   * workout begins.
   */
  async newDraft(
    peachId: string,
    now: Date,
    plan: readonly ExerciseLogEntry[] = [],
  ): Promise<WorkoutLog> {
    const log = workoutLog({ id: this.deps.ids.newId(), peachId, startedAt: now, plan });
    await this.deps.logs.save(log);
    return log;
  }

  /**
   * The log screen opened: resumes the Peach's draft, or null with none
   * (workouts start from the plan). Once started, its clock runs again; a
   * draft not started yet takes today's date, so a workout launched on
   * Sunday but done on Tuesday counts as Tuesday's.
   */
  async resumeDraft(peachId: string, now: Date): Promise<WorkoutLog | null> {
    const draft = await this.currentLog(peachId);
    if (!draft) return null;
    const covered = planCoveringEntries(draft);
    const opened = hasStarted(covered)
      ? resumeTimer(covered, now)
      : covered.entries.length === 0
        ? { ...covered, startedAt: now }
        : startSession(covered, now);
    if (opened !== draft) await this.deps.logs.save(opened);
    return opened;
  }

  /** Starts the workout's clock (or resumes it): the Peach is about to do their sets. */
  async startSession(logId: string, now: Date): Promise<WorkoutLog> {
    return this.update(logId, (log) => {
      if (isSubmitted(log)) throw new DomainError('This workout is already finished.');
      return startSession(log, now);
    });
  }

  /** Adds or replaces the entry for one exercise, before or after submitting. */
  async recordEntry(logId: string, entry: ExerciseLogEntry): Promise<WorkoutLog> {
    const problem = implausibility(entry);
    if (problem) throw new DomainError(problem);
    return this.update(logId, (log) => upsertEntry(log, entry));
  }

  /**
   * Plans an exercise for the session (at the end, or at `at`: putting one
   * back where it was), or changes its target sets.
   */
  async planExercise(logId: string, planned: ExerciseLogEntry, at?: number): Promise<WorkoutLog> {
    const problem = implausibility(planned);
    if (problem) throw new DomainError(problem);
    if (planned.sets.length === 0) throw new DomainError('Plan at least one set.');
    return this.updateDraft(logId, (log) => upsertPlanned(log, planned, at));
  }

  /**
   * Records a set done of a planned exercise, starting the workout's clock
   * if it hasn't started.
   */
  async logSet(logId: string, exerciseId: string, set: SetLog, now: Date): Promise<WorkoutLog> {
    return this.updateDraft(logId, (log) => {
      if (!plannedFor(log, exerciseId)) throw new DomainError('That exercise isn’t planned.');
      const logged = logPlannedSet(startSession(log, now), exerciseId, set);
      const problem = implausibility(entryFor(logged, exerciseId)!);
      if (problem) throw new DomainError(problem);
      return logged;
    });
  }

  /** Takes back the last set logged of an exercise. */
  async undoSet(logId: string, exerciseId: string): Promise<WorkoutLog> {
    return this.updateDraft(logId, (log) => unlogLastSet(log, exerciseId));
  }

  /** Drops the next planned set of an exercise. */
  async skipSet(logId: string, exerciseId: string): Promise<WorkoutLog> {
    return this.updateDraft(logId, (log) => skipPlannedSet(log, exerciseId));
  }

  /** How hard an exercise was, once its sets are done (null clears it). */
  async rateExercise(logId: string, exerciseId: string, rpe: number | null): Promise<WorkoutLog> {
    if (rpe !== null && (!Number.isInteger(rpe) || rpe < 1 || rpe > 10)) {
      throw new DomainError('RPE is 1 to 10.');
    }
    return this.update(logId, (log) => {
      const entry = entryFor(log, exerciseId);
      return entry ? upsertEntry(log, { ...entry, rpe }) : log;
    });
  }

  /** Removes an exercise: what was done of it and, on a draft, its plan. */
  async removeEntry(logId: string, exerciseId: string): Promise<WorkoutLog> {
    return this.update(logId, (log) => {
      const updated = removePlanned(removeEntry(log, exerciseId), exerciseId);
      if (isSubmitted(log) && updated.entries.length === 0) {
        throw new DomainError('A workout needs at least one exercise.');
      }
      return updated;
    });
  }

  /**
   * Deletes one of the Peach's workouts, a draft or a finished one, with
   * its copies in their Crates: a week still open stops counting it, while
   * a closed week keeps its result. Returns it, to put back with `restore`.
   */
  async deleteLog(logId: string, peachId: string): Promise<WorkoutLog> {
    const log = await this.require(logId);
    if (log.peachId !== peachId) throw new DomainError('That isn’t your workout.');
    await this.deps.logs.delete(log);
    return log;
  }

  /**
   * Puts back a workout just deleted: a draft as it was, a finished one
   * shared again with those of its Crates the Peach is still in.
   */
  async restoreLog(log: WorkoutLog): Promise<WorkoutLog> {
    if (!isSubmitted(log)) {
      await this.deps.logs.save(log);
      return log;
    }
    const active = new Set(await this.activeCrateIds(log.peachId));
    const restored = { ...log, sharedWith: log.sharedWith.filter((id) => active.has(id)) };
    await this.deps.logs.saveSubmitted(restored);
    return restored;
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
      // The plan was for doing the workout; Crates see what was done.
      plan: [],
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

  /** Like `update`, for changes only a draft can take. */
  private updateDraft(logId: string, change: (log: WorkoutLog) => WorkoutLog): Promise<WorkoutLog> {
    return this.update(logId, (log) => {
      if (isSubmitted(log)) throw new DomainError('This workout is already finished.');
      return change(log);
    });
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
