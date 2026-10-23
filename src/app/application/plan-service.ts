import { IdGenerator } from '../domain/core/ids';
import { addDays, daysBetween, LocalDate, startOfWeek } from '../domain/core/local-date';
import {
  Commitment,
  COMMITMENT_OPENS_MS,
  isLocked,
  MAX_COMMITMENT,
} from '../domain/models/commitment';
import { isActiveMembership } from '../domain/models/crate';
import { CategoryWeights } from '../domain/models/scoring';
import { involves, isSeasonOpen } from '../domain/models/season';
import {
  emptyPlan,
  isInWeek,
  MAX_PLANNED_WORKOUTS,
  PlannedWorkout,
  plannedEntries,
  plannedWorkout,
  PLANNED_NAME_MAX,
  removeWorkout,
  upsertWorkout,
  WeekPlan,
} from '../domain/models/week-plan';
import {
  ExerciseLogEntry,
  hasStarted,
  isSubmitted,
  WorkoutLog,
} from '../domain/models/workout-log';
import {
  CrateRepository,
  SeasonRepository,
  WeekPlanRepository,
  WorkoutLogRepository,
} from '../domain/repositories';
import { implausibility } from '../domain/services/plausibility';
import { RoundWindowService } from '../domain/services/round-window';
import { ScoringService } from '../domain/services/scoring-service';
import { DomainError } from './errors';
import { LoggingService } from './logging-service';

export interface PlanServiceDeps {
  readonly plans: WeekPlanRepository;
  readonly seasons: SeasonRepository;
  readonly crates: CrateRepository;
  readonly logs: WorkoutLogRepository;
  readonly logging: LoggingService;
  readonly windows: RoundWindowService;
  readonly ids: IdGenerator;
  readonly scoring: ScoringService;
}

/** A workout to plan: a new one has no id yet. */
export type PlannedWorkoutDraft = Omit<PlannedWorkout, 'id' | 'logId'> & { readonly id?: string };

/**
 * Weekly plans: a Peach puts workouts on the days of a week, then launches
 * each one into the log when it's time. In a Crate, what the plan is worth
 * under that Season's weights is their commitment for the week's matchup:
 * it follows the plan until the week starts, then locks (see
 * `syncCommitments`). Hitting it earns a bonus, falling short a penalty.
 */
export class PlanService {
  constructor(private readonly deps: PlanServiceDeps) {}

  /** The Peach's plan for the week `weekStart` falls in, or an empty one. */
  async plan(peachId: string, weekStart: LocalDate, now: Date): Promise<WeekPlan> {
    const monday = startOfWeek(weekStart);
    return (await this.deps.plans.get(peachId, monday)) ?? emptyPlan(peachId, monday, now);
  }

  /** Plans a workout on a day of the week, or changes one already planned. */
  async saveWorkout(args: {
    peachId: string;
    weekStart: LocalDate;
    workout: PlannedWorkoutDraft;
    now: Date;
  }): Promise<PlannedWorkout> {
    const plan = await this.plan(args.peachId, args.weekStart, args.now);
    const { workout } = args;
    if (!isInWeek(plan.weekStart, workout.day)) throw new DomainError('Pick a day in that week.');
    const existing = workout.id ? plannedWorkout(plan, workout.id) : undefined;
    if (workout.id && !existing) throw new DomainError('That workout isn’t in your plan.');
    if (!existing && plan.workouts.length >= MAX_PLANNED_WORKOUTS) {
      throw new DomainError(`A week holds up to ${MAX_PLANNED_WORKOUTS} workouts.`);
    }
    const saved: PlannedWorkout = {
      id: existing?.id ?? this.deps.ids.newId(),
      day: workout.day,
      name: checkedName(workout.name),
      locationId: workout.locationId,
      exercises: checkedExercises(workout.exercises),
      logId: existing?.logId ?? null,
    };
    await this.save({ ...upsertWorkout(plan, saved), updatedAt: args.now }, args.now);
    return saved;
  }

  /** Takes a workout out of the plan; returns it, to put back with `restoreWorkout`. */
  async removeWorkout(
    peachId: string,
    weekStart: LocalDate,
    workoutId: string,
    now: Date,
  ): Promise<PlannedWorkout> {
    const plan = await this.plan(peachId, weekStart, now);
    const workout = plannedWorkout(plan, workoutId);
    if (!workout) throw new DomainError('That workout isn’t in your plan.');
    await this.save({ ...removeWorkout(plan, workoutId), updatedAt: now }, now);
    return workout;
  }

  /** Puts back a workout just removed. */
  async restoreWorkout(
    peachId: string,
    weekStart: LocalDate,
    workout: PlannedWorkout,
    now: Date,
  ): Promise<void> {
    const plan = await this.plan(peachId, weekStart, now);
    await this.save({ ...upsertWorkout(plan, workout), updatedAt: now }, now);
  }

  /**
   * Plans the workouts of the week `from` again in the week `to`, each on
   * the same weekday, after anything already planned there.
   */
  async repeatWeek(peachId: string, from: LocalDate, to: LocalDate, now: Date): Promise<number> {
    const source = await this.plan(peachId, from, now);
    if (source.workouts.length === 0) throw new DomainError('That week has nothing planned.');
    let plan = await this.plan(peachId, to, now);
    const shift = daysBetween(source.weekStart, plan.weekStart);
    const room = MAX_PLANNED_WORKOUTS - plan.workouts.length;
    const copies = source.workouts.slice(0, Math.max(0, room));
    for (const w of copies) {
      plan = upsertWorkout(plan, {
        ...w,
        id: this.deps.ids.newId(),
        day: addDays(w.day, shift),
        logId: null,
      });
    }
    await this.save({ ...plan, updatedAt: now }, now);
    return copies.length;
  }

  /**
   * Starts a planned workout: a log with its exercises as the session's
   * plan, linked back to it. Launching it again carries on with that log.
   * An empty draft gives way; one with sets logged has to be finished first.
   */
  async launch(
    peachId: string,
    weekStart: LocalDate,
    workoutId: string,
    now: Date,
  ): Promise<WorkoutLog> {
    const { logs, logging } = this.deps;
    const plan = await this.plan(peachId, weekStart, now);
    const workout = plannedWorkout(plan, workoutId);
    if (!workout) throw new DomainError('That workout isn’t in your plan.');
    const linked = workout.logId ? await logs.getById(workout.logId) : null;
    if (linked && isSubmitted(linked)) throw new DomainError('You’ve already done that one.');
    if (linked) return linked;
    const draft = await logging.currentLog(peachId);
    if (draft && (hasStarted(draft) || draft.entries.length > 0)) {
      throw new DomainError('Finish the workout in progress first.');
    }
    if (draft) await logs.delete(draft);
    const log = await logging.newDraft(peachId, now, workout.exercises);
    await this.deps.plans.save({
      ...upsertWorkout(plan, { ...workout, logId: log.id }),
      updatedAt: now,
    });
    return log;
  }

  /** What a plan is worth under `weights`. */
  plannedPoints(plan: WeekPlan | null, weights: CategoryWeights): number {
    if (!plan) return 0;
    const points = this.deps.scoring.scorePlan(plannedEntries(plan), weights).total;
    return Math.min(MAX_COMMITMENT, points);
  }

  /** The points a Peach committed to for a week of a Season; zero without a plan. */
  async committed(seasonId: string, roundId: string, peachId: string): Promise<number> {
    return (await this.deps.seasons.getCommitment(seasonId, roundId, peachId))?.points ?? 0;
  }

  /**
   * Brings the Peach's commitments up to date with their plans: for every
   * week they play in that hasn't started yet (and opens within a week),
   * what that week's plan is worth under the Season's weights. Weeks that
   * have started keep what was committed. Safe to call repeatedly.
   */
  async syncCommitments(peachId: string, now: Date): Promise<void> {
    const { seasons, crates, windows } = this.deps;
    for (const membership of await crates.membershipsFor(peachId)) {
      if (!isActiveMembership(membership)) continue;
      const crate = await crates.getById(membership.crateId);
      if (!crate) continue;
      for (const season of await seasons.forCrate(crate.id)) {
        if (!isSeasonOpen(season) || !season.participantIds.includes(peachId)) continue;
        for (const round of await seasons.roundsOf(season.id)) {
          if (round.status !== 'scheduled') continue;
          const locksAt = windows.windowFor(round, crate).opensAt;
          if (isLocked({ locksAt }, now)) continue;
          if (locksAt.getTime() - now.getTime() > COMMITMENT_OPENS_MS) continue;
          const playing = (await seasons.matchupsInRound(round.id)).some((m) =>
            involves(m, peachId),
          );
          if (!playing) continue;
          const plan = await this.deps.plans.get(peachId, round.weekStart);
          const points = this.plannedPoints(plan, season.rules.weights);
          const existing = await seasons.getCommitment(season.id, round.id, peachId);
          const unchanged = existing ? existing.points === points : points === 0;
          if (unchanged) continue;
          const commitment: Commitment = {
            seasonId: season.id,
            roundId: round.id,
            peachId,
            points,
            locksAt,
            updatedAt: now,
          };
          await seasons.saveCommitment(commitment);
        }
      }
    }
  }

  private async save(plan: WeekPlan, now: Date): Promise<void> {
    await this.deps.plans.save(plan);
    await this.syncCommitments(plan.peachId, now);
  }
}

function checkedName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (trimmed.length > PLANNED_NAME_MAX) {
    throw new DomainError(`Keep the name to ${PLANNED_NAME_MAX} characters.`);
  }
  return trimmed || 'Workout';
}

/** Target sets only: what was felt (RPE, notes) belongs to a session. */
function checkedExercises(exercises: readonly ExerciseLogEntry[]): ExerciseLogEntry[] {
  const kept = exercises
    .filter((e) => e.sets.length > 0)
    .map((e) => ({ ...e, rpe: null, notes: null }));
  if (kept.length === 0) throw new DomainError('Plan at least one exercise.');
  for (const e of kept) {
    const problem = implausibility(e);
    if (problem) throw new DomainError(problem);
  }
  return kept;
}
