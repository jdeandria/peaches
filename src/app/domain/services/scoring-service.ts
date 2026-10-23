import { round2 } from '../core/math';
import { WeekScore } from '../models/commitment';
import {
  addTotals,
  CATEGORY_INFO,
  CategoryScore,
  CategoryTotals,
  CategoryWeights,
  LogScore,
  PlanRules,
  SCORING_CATEGORIES,
  ScoringCategory,
  ScoringRules,
  ZERO_TOTALS,
} from '../models/scoring';
import { ExerciseLogEntry, WorkoutLog, workoutLog } from '../models/workout-log';
import { MetricExtractor } from './metric-extractor';

/** One side of a matchup's week: what it logged and committed to. */
export interface WeekSide {
  readonly logs: Iterable<WorkoutLog>;
  /** The points its plan committed to; zero without one. */
  readonly committed: number;
}

/**
 * Turns logs into fantasy points: each category earns its weight per par
 * (`weight × amount / par`), so with 25 points on running a 5 km run earns
 * 25 and a 10 km run 50. Points are linear in the amounts, so a week of
 * logs scores the same summed per log or all at once.
 *
 * A week adds the plan on top (see {@link scoreWeek}).
 */
export class ScoringService {
  scoreTotals(totals: CategoryTotals, weights: CategoryWeights): LogScore {
    const categories: CategoryScore[] = [];
    let total = 0;
    for (const category of SCORING_CATEGORIES) {
      const amount = totals[category];
      if (amount <= 0) continue;
      const points = round2(parPoints(weights, category, amount));
      categories.push({ category, amount, points });
      total += points;
    }
    return { categories, total: round2(total) };
  }

  scoreLog(log: WorkoutLog, weights: CategoryWeights): LogScore {
    return this.scoreTotals(MetricExtractor.extract(log), weights);
  }

  totalsOf(logs: Iterable<WorkoutLog>): CategoryTotals {
    let totals = ZERO_TOTALS;
    for (const log of logs) totals = addTotals(totals, MetricExtractor.extract(log));
    return totals;
  }

  /**
   * What planned exercises are worth: the points their target sets would
   * earn in a session as long as {@link plannedSessionSeconds} says, as
   * the session clock would count it on the day.
   */
  scorePlan(exercises: readonly ExerciseLogEntry[], weights: CategoryWeights): LogScore {
    const planned = workoutLog({
      id: 'plan',
      peachId: '',
      startedAt: new Date(0),
      entries: exercises,
      durationSeconds: plannedSessionSeconds(exercises),
    });
    return this.scoreLog(planned, weights);
  }

  /**
   * One side's week: workout points for everything logged, then the plan.
   * Reaching the commitment earns `bonus`% of it on top; falling short
   * costs `penalty`% of the points missed. Without a commitment, neither.
   */
  scoreWeek(mine: CategoryTotals, committed: number, rules: ScoringRules): WeekScore {
    const workouts = this.scoreTotals(mine, rules.weights);
    const { hit, points } = planPoints(workouts.total, committed, rules.plan);
    return { workouts, committed, hit, plan: points, total: round2(workouts.total + points) };
  }

  /** Both sides of a matchup's week; `away` is null for a bye. */
  scoreMatchup(
    home: WeekSide,
    away: WeekSide | null,
    rules: ScoringRules,
  ): { home: WeekScore; away: WeekScore | null } {
    const score = (side: WeekSide) =>
      this.scoreWeek(this.totalsOf(side.logs), side.committed, rules);
    return { home: score(home), away: away && score(away) };
  }
}

/** A set without a time, and the rest after it. */
export const PLANNED_SET_SECONDS = 120;
/** The rest after a timed set (a distance is one effort, with none). */
export const PLANNED_REST_SECONDS = 60;

/**
 * How long planned exercises take: each untimed set two minutes with its
 * rest, a timed set its time and a minute's rest, a distance its time.
 */
export function plannedSessionSeconds(exercises: readonly ExerciseLogEntry[]): number {
  let seconds = 0;
  for (const e of exercises) {
    for (const set of e.sets) {
      if (set.seconds === null) seconds += PLANNED_SET_SECONDS;
      else seconds += set.seconds + (set.meters === null ? PLANNED_REST_SECONDS : 0);
    }
  }
  return seconds;
}

/** The plan's bonus (hit) or penalty (short, negative) for `earned` against `committed`. */
export function planPoints(
  earned: number,
  committed: number,
  rules: PlanRules,
): { hit: boolean; points: number } {
  if (committed <= 0) return { hit: true, points: 0 };
  if (earned >= committed) return { hit: true, points: round2((committed * rules.bonus) / 100) };
  const penalty = round2(((committed - earned) * rules.penalty) / 100);
  return { hit: false, points: penalty === 0 ? 0 : -penalty };
}

/** The points `amount` of `category` is worth: its weight per par. */
function parPoints(weights: CategoryWeights, category: ScoringCategory, amount: number): number {
  return (weights[category] * amount) / CATEGORY_INFO[category].par;
}
