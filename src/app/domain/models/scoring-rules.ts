import { JsonMap, numberFromJson } from '../core/json';

/**
 * How a logged workout is converted into fantasy points.
 *
 * Scoring is *relative to the prescription*, so two Peaches with the same
 * workout are compared on how completely each executed it, not on absolute
 * output. This is what makes mixed-ability matchups meaningful.
 */
export interface ScoringRules {
  /** Points awarded for fully completing an item with weight 1.0. */
  readonly pointsPerItem: number;
  /**
   * Achievement above the prescription still scores, but is capped here so
   * a single AMRAP cannot swamp the rest of the workout.
   */
  readonly maxAchievementRatio: number;
  /**
   * Flat bonus for completing every scored item to at least
   * `completionThreshold` of its prescription.
   */
  readonly completionBonus: number;
  readonly completionThreshold: number;
  /**
   * Reserved: bonus for logging an RPE on every item (encourages honest,
   * complete logging). Zero disables it.
   */
  readonly rpeHonestyBonus: number;
}

export const STANDARD_SCORING_RULES: ScoringRules = Object.freeze({
  pointsPerItem: 10,
  maxAchievementRatio: 1.25,
  completionBonus: 10,
  completionThreshold: 1.0,
  rpeHonestyBonus: 0,
});

export function scoringRules(overrides: Partial<ScoringRules> = {}): ScoringRules {
  const rules = { ...STANDARD_SCORING_RULES, ...overrides };
  if (!(rules.pointsPerItem > 0)) throw new RangeError('pointsPerItem must be positive');
  if (!(rules.maxAchievementRatio >= 1)) throw new RangeError('maxAchievementRatio must be >= 1');
  if (!(rules.completionBonus >= 0)) throw new RangeError('completionBonus must be >= 0');
  if (!(rules.completionThreshold > 0 && rules.completionThreshold <= 1)) {
    throw new RangeError('completionThreshold is 0..1');
  }
  return rules;
}

export function scoringRulesFromJson(json: JsonMap): ScoringRules {
  return {
    pointsPerItem: numberFromJson(json['pointsPerItem'], 10),
    maxAchievementRatio: numberFromJson(json['maxAchievementRatio'], 1.25),
    completionBonus: numberFromJson(json['completionBonus'], 10),
    completionThreshold: numberFromJson(json['completionThreshold'], 1),
    rpeHonestyBonus: numberFromJson(json['rpeHonestyBonus']),
  };
}

export function scoringRulesToJson(r: ScoringRules): JsonMap {
  return {
    pointsPerItem: r.pointsPerItem,
    maxAchievementRatio: r.maxAchievementRatio,
    completionBonus: r.completionBonus,
    completionThreshold: r.completionThreshold,
    rpeHonestyBonus: r.rpeHonestyBonus,
  };
}
