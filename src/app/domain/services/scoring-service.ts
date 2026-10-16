import {
  addTotals,
  CATEGORY_INFO,
  CategoryScore,
  CategoryTotals,
  CategoryWeights,
  LogScore,
  SCORING_CATEGORIES,
  ZERO_TOTALS,
} from '../models/scoring';
import { isBye, Matchup } from '../models/season';
import { WorkoutLog } from '../models/workout-log';
import { MetricExtractor } from './metric-extractor';

/**
 * Turns logs into fantasy points: each category earns its weight per par
 * (`weight × amount / par`), so with 25 points on running a 5 km run earns
 * 25 and a 10 km run 50. Points are linear in the amounts, so a week of
 * logs scores the same summed per log or all at once.
 */
export class ScoringService {
  scoreTotals(totals: CategoryTotals, weights: CategoryWeights): LogScore {
    const categories: CategoryScore[] = [];
    let total = 0;
    for (const category of SCORING_CATEGORIES) {
      const amount = totals[category];
      if (amount <= 0) continue;
      const points = round2((weights[category] * amount) / CATEGORY_INFO[category].par);
      categories.push({ category, amount, points });
      total += points;
    }
    return { categories, total: round2(total) };
  }

  scoreLog(log: WorkoutLog, weights: CategoryWeights): LogScore {
    return this.scoreTotals(MetricExtractor.extract(log), weights);
  }

  /** One score for several logs (a Peach's week in a matchup). */
  scoreLogs(logs: Iterable<WorkoutLog>, weights: CategoryWeights): LogScore {
    let totals = ZERO_TOTALS;
    for (const log of logs) totals = addTotals(totals, MetricExtractor.extract(log));
    return this.scoreTotals(totals, weights);
  }

  /**
   * Resolves a Matchup from each side's submitted logs for its week. A
   * Peach who logged nothing scores zero; a bye records the home side's
   * points only.
   */
  resolve(args: {
    matchup: Matchup;
    homeLogs: Iterable<WorkoutLog>;
    awayLogs: Iterable<WorkoutLog>;
    weights: CategoryWeights;
  }): Matchup {
    const { matchup, homeLogs, awayLogs, weights } = args;
    const home = this.scoreLogs(homeLogs, weights).total;
    const away = isBye(matchup) ? 0 : this.scoreLogs(awayLogs, weights).total;
    return { ...matchup, status: 'complete', result: { homePoints: home, awayPoints: away } };
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
