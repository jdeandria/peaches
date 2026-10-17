import {
  CategoryWeights,
  DEFAULT_WEIGHTS,
  SCORING_CATEGORIES,
  ScoringCategory,
  WEIGHT_BUDGET,
} from '../models/scoring';

/**
 * Combines members' budget ballots into a Crate's weights.
 *
 * Each ballot spends the same 100 points, so the mean of the ballots spends
 * 100 too and no single voter can move a category by more than their share.
 * The mean is rounded to whole points with the largest-remainder method so
 * the result still adds up to exactly 100 (ties go to the earlier
 * category). With no ballots the defaults apply.
 */
export const BallotTally = {
  tally(ballots: readonly CategoryWeights[]): CategoryWeights {
    if (ballots.length === 0) return DEFAULT_WEIGHTS;
    const means = SCORING_CATEGORIES.map((c) => ({
      category: c,
      mean: ballots.reduce((sum, b) => sum + b[c], 0) / ballots.length,
    }));
    const result = {} as Record<ScoringCategory, number>;
    let spent = 0;
    for (const { category, mean } of means) {
      result[category] = Math.floor(mean);
      spent += result[category];
    }
    const byRemainder = means
      .map((m, order) => ({ ...m, remainder: m.mean - Math.floor(m.mean), order }))
      .sort((a, b) => b.remainder - a.remainder || a.order - b.order);
    for (let i = 0; spent < WEIGHT_BUDGET; i++, spent++) {
      result[byRemainder[i % byRemainder.length].category] += 1;
    }
    return result;
  },
} as const;
