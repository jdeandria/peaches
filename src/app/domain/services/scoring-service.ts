import { round2 } from '../core/math';
import { BattleResult, Pledge, PledgeResult, WeekScore } from '../models/lineup';
import {
  addTotals,
  CATEGORY_INFO,
  CategoryScore,
  CategoryTotals,
  CategoryWeights,
  LogScore,
  SCORING_CATEGORIES,
  ScoringCategory,
  ScoringRules,
  ZERO_TOTALS,
} from '../models/scoring';
import { WorkoutLog } from '../models/workout-log';
import { MetricExtractor } from './metric-extractor';

/** One side of a matchup's week: what it logged and pledged. */
export interface WeekSide {
  readonly logs: Iterable<WorkoutLog>;
  readonly pledges: readonly Pledge[];
}

/**
 * Turns logs into fantasy points: each category earns its weight per par
 * (`weight × amount / par`), so with 25 points on running a 5 km run earns
 * 25 and a 10 km run 50. Points are linear in the amounts, so a week of
 * logs scores the same summed per log or all at once.
 *
 * A week adds the lineup on top (see {@link scoreWeek}).
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
   * One side's week: workout points for everything logged, plus for each
   * pledge in the lineup
   *
   * - the pledge bonus, if the pledge was hit: `pledgeBonus`% of the points
   *   the pledged amount is worth;
   * - a battle against the opponent's amount in that category: more wins
   *   `battlePars` pars of the category (a tie above zero splits them).
   *
   * `theirs` is null for a bye, which has no battles.
   */
  scoreWeek(
    mine: CategoryTotals,
    theirs: CategoryTotals | null,
    pledges: readonly Pledge[],
    rules: ScoringRules,
  ): WeekScore {
    const { weights, lineup } = rules;
    const workouts = this.scoreTotals(mine, weights);
    const pledgeResults: PledgeResult[] = pledges.map(({ category, target }) => {
      const amount = mine[category];
      const hit = amount >= target;
      const bonus = (parPoints(weights, category, target) * lineup.pledgeBonus) / 100;
      return { category, target, amount, hit, points: hit ? round2(bonus) : 0 };
    });
    const battles: BattleResult[] =
      theirs === null
        ? []
        : pledges.map(({ category }) => {
            const [m, t] = [mine[category], theirs[category]];
            const outcome = m > t ? 'win' : m < t ? 'loss' : 'tie';
            const prize = weights[category] * lineup.battlePars;
            const points = outcome === 'win' ? prize : outcome === 'tie' && m > 0 ? prize / 2 : 0;
            return { category, mine: m, theirs: t, outcome, points: round2(points) };
          });
    const sum = (xs: readonly { points: number }[]) => xs.reduce((s, x) => s + x.points, 0);
    return {
      workouts,
      pledges: pledgeResults,
      battles,
      total: round2(workouts.total + sum(pledgeResults) + sum(battles)),
    };
  }

  /** Both sides of a matchup's week; `away` is null for a bye. */
  scoreMatchup(
    home: WeekSide,
    away: WeekSide | null,
    rules: ScoringRules,
  ): { home: WeekScore; away: WeekScore | null } {
    const homeTotals = this.totalsOf(home.logs);
    const awayTotals = away ? this.totalsOf(away.logs) : null;
    return {
      home: this.scoreWeek(homeTotals, awayTotals, home.pledges, rules),
      away: away && this.scoreWeek(awayTotals!, homeTotals, away.pledges, rules),
    };
  }
}

/** The points `amount` of `category` is worth: its weight per par. */
function parPoints(weights: CategoryWeights, category: ScoringCategory, amount: number): number {
  return (weights[category] * amount) / CATEGORY_INFO[category].par;
}
