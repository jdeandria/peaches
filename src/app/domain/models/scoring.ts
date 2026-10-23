import { JsonMap, mapFromJson, numberFromJson } from '../core/json';

/**
 * What a workout log is measured in for fantasy points.
 *
 * Every submitted log is reduced to an amount per category (see
 * `MetricExtractor`); a Crate decides how many points each category is worth
 * by voting. Amounts are raw totals, not relative to anything: reps and
 * weight are separate categories, so a lighter Peach doing more reps and a
 * stronger one moving more weight both earn.
 */
export const SCORING_CATEGORIES = [
  'runWalk',
  'ride',
  'swimRow',
  'weightMoved',
  'reps',
  'activeMinutes',
] as const;
export type ScoringCategory = (typeof SCORING_CATEGORIES)[number];

/** The categories distance is credited to. Which one depends on the exercise. */
export const DISTANCE_KINDS = ['runWalk', 'ride', 'swimRow'] as const;
export type DistanceKind = (typeof DISTANCE_KINDS)[number];

export interface CategoryInfo {
  /** Canonical unit amounts are stored in. */
  readonly unit: 'km' | 'm' | 'kg' | 'reps' | 'min';
  /**
   * "One solid session's worth". A category's weight is the points earned
   * for exactly one par, so weights compare across categories without
   * anyone having to think about exchange rates between miles and pounds.
   */
  readonly par: number;
}

export const CATEGORY_INFO: Readonly<Record<ScoringCategory, CategoryInfo>> = Object.freeze({
  runWalk: { unit: 'km', par: 5 },
  ride: { unit: 'km', par: 20 },
  swimRow: { unit: 'm', par: 2000 },
  weightMoved: { unit: 'kg', par: 5000 },
  reps: { unit: 'reps', par: 150 },
  activeMinutes: { unit: 'min', par: 45 },
});

/** An amount per category, in each category's canonical unit. */
export type CategoryTotals = Readonly<Record<ScoringCategory, number>>;

export const ZERO_TOTALS: CategoryTotals = Object.freeze({
  runWalk: 0,
  ride: 0,
  swimRow: 0,
  weightMoved: 0,
  reps: 0,
  activeMinutes: 0,
});

export function addTotals(a: CategoryTotals, b: CategoryTotals): CategoryTotals {
  const sum = { ...a };
  for (const c of SCORING_CATEGORIES) sum[c] = a[c] + b[c];
  return sum;
}

/**
 * Points per par for each category. A Crate's weights always total
 * {@link WEIGHT_BUDGET}: they are the average of its members' budget ballots.
 */
export type CategoryWeights = Readonly<Record<ScoringCategory, number>>;

/** What every ballot splits across the categories. */
export const WEIGHT_BUDGET = 100;

/** Used until a Crate's members vote. */
export const DEFAULT_WEIGHTS: CategoryWeights = Object.freeze({
  runWalk: 20,
  ride: 10,
  swimRow: 10,
  weightMoved: 20,
  reps: 20,
  activeMinutes: 20,
});

/** Builds weights, checking they are whole, non-negative and spend exactly the budget. */
export function categoryWeights(values: Partial<CategoryWeights>): CategoryWeights {
  const w = { ...ZERO_TOTALS, ...values };
  let total = 0;
  for (const c of SCORING_CATEGORIES) {
    if (!Number.isInteger(w[c]) || w[c] < 0) {
      throw new RangeError(`${c} must be a whole number of points >= 0`);
    }
    total += w[c];
  }
  if (total !== WEIGHT_BUDGET) {
    throw new RangeError(`Weights must add up to ${WEIGHT_BUDGET} (got ${total})`);
  }
  return w;
}

export function weightsTotal(w: Partial<CategoryWeights>): number {
  return SCORING_CATEGORIES.reduce((sum, c) => sum + (w[c] ?? 0), 0);
}

/** Decodes stored weights; anything missing or invalid falls back to the defaults. */
export function weightsFromJson(json: JsonMap | null): CategoryWeights {
  if (!json) return DEFAULT_WEIGHTS;
  const decoded: Partial<Record<ScoringCategory, number>> = {};
  for (const c of SCORING_CATEGORIES) decoded[c] = numberFromJson(json[c], -1);
  try {
    return categoryWeights(decoded);
  } catch {
    return DEFAULT_WEIGHTS;
  }
}

export function weightsToJson(w: CategoryWeights): JsonMap {
  return Object.fromEntries(SCORING_CATEGORIES.map((c) => [c, w[c]]));
}

/**
 * How a week's plan scores in a Crate. Members vote on these alongside the
 * category weights (the middle vote wins), and a Season freezes them.
 *
 * A Peach commits to the points their week's plan is worth. Hit it and
 * they earn `bonus`% of the commitment on top; fall short and they lose
 * `penalty`% of every point they missed by.
 */
export interface PlanRules {
  /** Hitting the plan earns this percentage of the committed points again. */
  readonly bonus: number;
  /** Falling short costs this percentage of the points missed. */
  readonly penalty: number;
}

/** The range each plan rule can be voted within. */
export const PLAN_RULE_LIMITS: Readonly<Record<keyof PlanRules, readonly [number, number]>> =
  Object.freeze({
    bonus: [0, 100],
    penalty: [0, 100],
  });

export const PLAN_RULE_KEYS = ['bonus', 'penalty'] as const;

export const DEFAULT_PLAN_RULES: PlanRules = Object.freeze({
  bonus: 25,
  penalty: 50,
});

/** Builds plan rules, checking each is a whole number within its limits. */
export function planRules(values: Partial<PlanRules>): PlanRules {
  const r = { ...DEFAULT_PLAN_RULES, ...values };
  for (const key of PLAN_RULE_KEYS) {
    const [min, max] = PLAN_RULE_LIMITS[key];
    if (!Number.isInteger(r[key]) || r[key] < min || r[key] > max) {
      throw new RangeError(`${key} must be a whole number from ${min} to ${max}`);
    }
  }
  return r;
}

/** Everything that decides how a week scores: what the Crate voted for. */
export interface ScoringRules {
  readonly weights: CategoryWeights;
  readonly plan: PlanRules;
}

export const DEFAULT_RULES: ScoringRules = Object.freeze({
  weights: DEFAULT_WEIGHTS,
  plan: DEFAULT_PLAN_RULES,
});

/** Decodes stored rules; anything missing or invalid falls back to the defaults. */
export function rulesFromJson(json: JsonMap | null): ScoringRules {
  const plan = mapFromJson(json?.['plan']);
  let decoded = DEFAULT_PLAN_RULES;
  if (plan) {
    try {
      decoded = planRules(
        Object.fromEntries(PLAN_RULE_KEYS.map((k) => [k, numberFromJson(plan[k], -1)])),
      );
    } catch {
      // Keep the defaults.
    }
  }
  return { weights: weightsFromJson(mapFromJson(json?.['weights'])), plan: decoded };
}

export function rulesToJson(r: ScoringRules): JsonMap {
  return {
    weights: weightsToJson(r.weights),
    plan: Object.fromEntries(PLAN_RULE_KEYS.map((k) => [k, r.plan[k]])),
  };
}

/** Points earned in one category. */
export interface CategoryScore {
  readonly category: ScoringCategory;
  readonly amount: number;
  readonly points: number;
}

/** A breakdown of points for one log or a set of logs. */
export interface LogScore {
  /** Only categories with a non-zero amount, in {@link SCORING_CATEGORIES} order. */
  readonly categories: readonly CategoryScore[];
  readonly total: number;
}
