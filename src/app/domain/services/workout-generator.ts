import { IdGenerator } from '../core/ids';
import { SeededRandom } from '../core/random';
import { Exercise } from '../exercises/exercise';
import { SessionFocus, TrainingGoal } from '../models/training';
import { BLOCK_TYPES, Prescription, Workout, WorkoutBlock, WorkoutItem } from '../models/workout';
import { ExerciseSelector, Selection } from './exercise-selector';
import { Prescriber } from './prescriber';
import { SessionPlanner } from './session-planner';

/** Everything the generator needs to build one workout. */
export interface WorkoutRequest {
  /** The pool shared by every Peach who will perform the workout. */
  readonly availableExercises: readonly Exercise[];
  readonly focus: SessionFocus;
  readonly goal: TrainingGoal;
  readonly durationMinutes: number;
  readonly targetDifficulty: number;
  readonly maxDifficulty?: number;
  /** Reproducibility seed; same seed + same inputs = same workout. */
  readonly seed: number;
  /** exerciseId -> rounds ago it was last used, for variety. */
  readonly recentUse?: ReadonlyMap<string, number>;
  readonly title?: string | null;
  /**
   * When set, the workout and its items get ids derived from this value
   * instead of fresh random ids, so two devices generating the same
   * matchup's workout produce byte-identical documents.
   */
  readonly workoutId?: string | null;
}

interface Draft {
  readonly selection: Selection;
  readonly prescription: Prescription;
}

/**
 * Builds a complete, time-boxed workout from a shared exercise pool.
 *
 * Pipeline: {@link SessionPlanner} decides the shape,
 * {@link ExerciseSelector} fills it, {@link Prescriber} sets the dose, and
 * this class trims the result to the time budget by dropping optional slots
 * first and then reducing sets.
 */
export class WorkoutGenerator {
  /**
   * Bump when the algorithm changes in a way that alters output for the
   * same inputs, so stored workouts can be reproduced.
   */
  static readonly version = 1;

  constructor(
    private readonly ids: IdGenerator,
    private readonly planner = new SessionPlanner(),
    private readonly selector = new ExerciseSelector(),
    private readonly prescriber = new Prescriber(),
  ) {}

  generate(request: WorkoutRequest, now: Date): Workout {
    if (!(request.durationMinutes > 0)) throw new RangeError('durationMinutes must be positive');
    if (request.targetDifficulty < 1 || request.targetDifficulty > 5) {
      throw new RangeError('targetDifficulty is 1..5');
    }
    const plan = this.planner.plan(request.focus, request.goal, request.durationMinutes);
    const selections = this.selector.select(
      plan,
      request.availableExercises,
      {
        targetDifficulty: request.targetDifficulty,
        maxDifficulty: request.maxDifficulty ?? 5,
        recentUse: request.recentUse,
      },
      new SeededRandom(request.seed),
    );

    const drafts = this.fitToBudget(
      selections.map((s) => ({
        selection: s,
        prescription: this.prescriber.prescribe(
          s.exercise,
          s.block,
          request.goal,
          request.targetDifficulty,
        ),
      })),
      request.durationMinutes * 60,
    );

    const workoutId = request.workoutId ?? this.ids.newId();
    let itemIndex = 0;
    const nextItemId = () =>
      request.workoutId == null ? this.ids.newId() : `${workoutId}-i${++itemIndex}`;

    const blocks: WorkoutBlock[] = [];
    for (const type of BLOCK_TYPES) {
      const items: WorkoutItem[] = drafts
        .filter((d) => d.selection.block === type)
        .map((d) => ({
          id: nextItemId(),
          exerciseId: d.selection.exercise.id,
          prescription: d.prescription,
          scoringWeight: d.selection.slot.scoringWeight,
        }));
      if (items.length > 0) blocks.push({ type, items });
    }

    return {
      id: workoutId,
      title: request.title ?? null,
      blocks,
      focus: request.focus,
      goal: request.goal,
      targetDifficulty: request.targetDifficulty,
      estimatedMinutes: Math.ceil(this.totalSeconds(drafts) / 60),
      seed: request.seed,
      generatorVersion: WorkoutGenerator.version,
      createdAt: now,
    };
  }

  private totalSeconds(drafts: readonly Draft[]): number {
    return drafts.reduce(
      (sum, d) => sum + this.prescriber.estimateSeconds(d.selection.exercise, d.prescription),
      0,
    );
  }

  /**
   * Drops optional items (last first), then trims sets off the longest
   * scored items, then drops the lowest-priority scored items, until the
   * estimate fits. Warm-up and cool-down are never cut: they are the
   * cheapest insurance against injury.
   */
  private fitToBudget(drafts: readonly Draft[], budgetSeconds: number): Draft[] {
    let current = [...drafts];
    while (this.totalSeconds(current) > budgetSeconds) {
      const optionalIndex = current.findLastIndex((d) => d.selection.slot.optional);
      if (optionalIndex >= 0) {
        current.splice(optionalIndex, 1);
        continue;
      }
      const scored = current.filter((d) => d.selection.slot.scoringWeight > 0);
      const target = scored.find((d) => d.prescription.sets > 2);
      if (!target) {
        // Sets are already minimal: drop the lowest-priority scored item
        // (the last one in the main block) while more than one remains.
        if (scored.length <= 1) break;
        current = current.filter((d) => d !== scored.at(-1));
        continue;
      }
      current = current.map((d) =>
        d === target
          ? { ...d, prescription: { ...d.prescription, sets: d.prescription.sets - 1 } }
          : d,
      );
    }
    return current;
  }
}
