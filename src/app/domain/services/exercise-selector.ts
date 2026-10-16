import { SeededRandom } from '../core/random';
import { Exercise } from '../exercises/exercise';
import { MuscleGroup } from '../exercises/taxonomy';
import { BlockType } from '../models/workout';
import { SessionPlan, SlotSpec } from './session-planner';

/** Inputs that bias selection without changing the candidate pool. */
export interface SelectionContext {
  /** The difficulty the session is aiming for (1..5, fractional allowed). */
  readonly targetDifficulty: number;
  /** Hard cap on exercise difficulty (typically the weaker Peach's level + 1). */
  readonly maxDifficulty?: number;
  /**
   * exerciseId -> how many rounds ago it was last prescribed (0 = last
   * round). Recently used exercises are de-weighted for variety.
   */
  readonly recentUse?: ReadonlyMap<string, number>;
}

/** An exercise chosen for a slot. */
export interface Selection {
  readonly exercise: Exercise;
  readonly slot: SlotSpec;
  readonly block: BlockType;
}

export interface SelectorWeights {
  readonly difficultySigma: number;
  /**
   * Weight multiplier by rounds-ago (index 0 = last round). Older than the
   * list length is unpenalised.
   */
  readonly recentPenalty: readonly number[];
  readonly compoundBonus: number;
  readonly overlapPenalty: number;
  readonly fallbackPatternWeight: number;
}

export const DEFAULT_SELECTOR_WEIGHTS: SelectorWeights = Object.freeze({
  difficultySigma: 1.0,
  recentPenalty: [0.15, 0.4, 0.7],
  compoundBonus: 1.4,
  overlapPenalty: 0.35,
  fallbackPatternWeight: 0.5,
});

/**
 * Weighted-random exercise selection under programming constraints.
 *
 * Weights (multiplicative):
 * - pattern preference: first-choice patterns beat later ones;
 * - difficulty fit: Gaussian around the target difficulty;
 * - novelty: exercises used in recent rounds are strongly de-weighted;
 * - compound preference in the strength block;
 * - muscle overlap: exercises whose primary muscles are already loaded in
 *   the same block are de-weighted so a session spreads its stress.
 *
 * Hard constraints:
 * - no exercise appears twice in a session;
 * - no two exercises from the same progression family in a session;
 * - difficulty never exceeds `maxDifficulty`;
 * - slot modality restrictions are respected.
 */
export class ExerciseSelector {
  constructor(private readonly weights: SelectorWeights = DEFAULT_SELECTOR_WEIGHTS) {}

  /**
   * Fills every slot in `plan` from `candidates` (already filtered to what
   * the Peaches can do). Slots with no viable candidate are skipped, which
   * is how tiny pools degrade gracefully instead of failing.
   */
  select(
    plan: SessionPlan,
    candidates: readonly Exercise[],
    context: SelectionContext,
    random: SeededRandom,
  ): Selection[] {
    const chosen: Selection[] = [];
    const usedIds = new Set<string>();
    const usedFamilies = new Set<string>();

    for (const block of plan.blocks) {
      const loadedMuscles = new Set<MuscleGroup>();
      for (const slot of block.slots) {
        const picked = this.pickForSlot(slot, block.type, candidates, context, random, {
          usedIds,
          usedFamilies,
          loadedMuscles,
        });
        if (!picked) continue;
        chosen.push({ exercise: picked, slot, block: block.type });
        usedIds.add(picked.id);
        if (picked.family !== null) usedFamilies.add(picked.family);
        for (const m of picked.primaryMuscles) loadedMuscles.add(m);
      }
    }
    return chosen;
  }

  private pickForSlot(
    slot: SlotSpec,
    block: BlockType,
    candidates: readonly Exercise[],
    context: SelectionContext,
    random: SeededRandom,
    used: {
      usedIds: ReadonlySet<string>;
      usedFamilies: ReadonlySet<string>;
      loadedMuscles: ReadonlySet<MuscleGroup>;
    },
  ): Exercise | null {
    const maxDifficulty = context.maxDifficulty ?? 5;
    const eligible = (e: Exercise) =>
      !used.usedIds.has(e.id) &&
      (e.family === null || !used.usedFamilies.has(e.family)) &&
      e.difficulty <= maxDifficulty &&
      (slot.modalities.size === 0 || slot.modalities.has(e.modality));

    let pool = candidates.filter((e) => eligible(e) && slot.patterns.includes(e.pattern));
    let usingFallback = false;
    if (pool.length === 0 && slot.fallbackPatterns.length > 0) {
      pool = candidates.filter((e) => eligible(e) && slot.fallbackPatterns.includes(e.pattern));
      usingFallback = true;
    }
    if (pool.length === 0) return null;

    const weights = pool.map((e) =>
      this.weight(e, slot, block, context, used.loadedMuscles, usingFallback),
    );
    return pool[weightedIndex(weights, random)];
  }

  private weight(
    e: Exercise,
    slot: SlotSpec,
    block: BlockType,
    context: SelectionContext,
    loadedMuscles: ReadonlySet<MuscleGroup>,
    usingFallback: boolean,
  ): number {
    const { difficultySigma, recentPenalty, compoundBonus, overlapPenalty } = this.weights;
    const patterns = usingFallback ? slot.fallbackPatterns : slot.patterns;
    const rank = patterns.indexOf(e.pattern);
    let w = rank <= 0 ? 1.0 : 1.0 / (1 + rank * 0.6);
    if (usingFallback) w *= this.weights.fallbackPatternWeight;

    const dd = e.difficulty - context.targetDifficulty;
    w *= Math.exp(-(dd * dd) / (2 * difficultySigma * difficultySigma));

    const ago = context.recentUse?.get(e.id);
    if (ago !== undefined && ago >= 0 && ago < recentPenalty.length) w *= recentPenalty[ago];

    if (block === 'strength' && e.mechanics === 'compound') w *= compoundBonus;

    if (block === 'strength' && e.primaryMuscles.some((m) => loadedMuscles.has(m))) {
      w *= overlapPenalty;
    }

    // Never let a weight collapse to zero: every eligible exercise keeps a
    // small chance so sparse pools still fill.
    return Math.max(w, 1e-6);
  }
}

function weightedIndex(weights: readonly number[], random: SeededRandom): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random.nextDouble() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}
