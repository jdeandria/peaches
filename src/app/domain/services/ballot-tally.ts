import {
  CategoryWeights,
  DEFAULT_RULES,
  DEFAULT_WEIGHTS,
  PLAN_RULE_KEYS,
  PlanRules,
  SCORING_CATEGORIES,
  ScoringCategory,
  ScoringRules,
  WEIGHT_BUDGET,
} from '../models/scoring';

/**
 * Combines members' ballots into a Crate's rules.
 *
 * Each plan rule is the middle vote (the lower of the two middle votes
 * when there is an even number), so one extreme ballot can't drag it
 * anywhere. Weights are the mean of the budget ballots (see `tally`).
 */
export const BallotTally = {
  rules(ballots: readonly ScoringRules[]): ScoringRules {
    if (ballots.length === 0) return DEFAULT_RULES;
    const plan = {} as Record<keyof PlanRules, number>;
    for (const key of PLAN_RULE_KEYS) {
      const votes = ballots.map((b) => b.plan[key]).sort((a, b) => a - b);
      plan[key] = votes[Math.floor((votes.length - 1) / 2)];
    }
    return { weights: BallotTally.tally(ballots.map((b) => b.weights)), plan };
  },

  /**
   * Each ballot spends the same 100 points, so the mean of the ballots
   * spends 100 too and no single voter can move a category by more than
   * their share. The mean is rounded to whole points with the
   * largest-remainder method so the result still adds up to exactly 100
   * (ties go to the earlier category). With no ballots the defaults apply.
   */
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
