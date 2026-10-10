import 'dart:math';

import '../exercises/exercise.dart';
import '../exercises/taxonomy.dart';
import '../models/workout.dart';
import 'session_planner.dart';

/// Inputs that bias selection without changing the candidate pool.
final class SelectionContext {
  const SelectionContext({
    required this.targetDifficulty,
    this.maxDifficulty = 5,
    this.recentUse = const {},
  });

  /// The difficulty the session is aiming for (1..5, fractional allowed).
  final double targetDifficulty;

  /// Hard cap on exercise difficulty (typically the weaker Peach's level + 1).
  final int maxDifficulty;

  /// exerciseId -> how many rounds ago it was last prescribed (0 = last
  /// round). Recently used exercises are de-weighted for variety.
  final Map<String, int> recentUse;
}

/// An exercise chosen for a slot.
final class Selection {
  const Selection({
    required this.exercise,
    required this.slot,
    required this.block,
  });

  final Exercise exercise;
  final SlotSpec slot;
  final BlockType block;
}

/// Weighted-random exercise selection under programming constraints.
///
/// Weights (multiplicative):
/// * pattern preference: first-choice patterns beat later ones;
/// * difficulty fit: Gaussian around the target difficulty;
/// * novelty: exercises used in recent rounds are strongly de-weighted;
/// * compound preference in the strength block;
/// * muscle overlap: exercises whose primary muscles are already loaded in
///   the same block are de-weighted so a session spreads its stress.
///
/// Hard constraints:
/// * no exercise appears twice in a session;
/// * no two exercises from the same progression family in a session;
/// * difficulty never exceeds [SelectionContext.maxDifficulty];
/// * slot modality restrictions are respected.
final class ExerciseSelector {
  const ExerciseSelector({
    this.difficultySigma = 1.0,
    this.recentPenalty = const [0.15, 0.4, 0.7],
    this.compoundBonus = 1.4,
    this.overlapPenalty = 0.35,
    this.fallbackPatternWeight = 0.5,
  });

  final double difficultySigma;

  /// Weight multiplier by rounds-ago (index 0 = last round). Older than the
  /// list length is unpenalised.
  final List<double> recentPenalty;
  final double compoundBonus;
  final double overlapPenalty;
  final double fallbackPatternWeight;

  /// Fills every slot in [plan] from [candidates] (already filtered to what
  /// the Peaches can do). Slots with no viable candidate are skipped, which
  /// is how tiny pools degrade gracefully instead of failing.
  List<Selection> select({
    required SessionPlan plan,
    required List<Exercise> candidates,
    required SelectionContext context,
    required Random random,
  }) {
    final chosen = <Selection>[];
    final usedIds = <String>{};
    final usedFamilies = <String>{};

    for (final block in plan.blocks) {
      final loadedMuscles = <MuscleGroup>{};
      for (final slot in block.slots) {
        final picked = _pickForSlot(
          slot: slot,
          block: block.type,
          candidates: candidates,
          context: context,
          random: random,
          usedIds: usedIds,
          usedFamilies: usedFamilies,
          loadedMuscles: loadedMuscles,
        );
        if (picked == null) continue;
        chosen.add(Selection(exercise: picked, slot: slot, block: block.type));
        usedIds.add(picked.id);
        if (picked.family != null) usedFamilies.add(picked.family!);
        loadedMuscles.addAll(picked.primaryMuscles);
      }
    }
    return chosen;
  }

  Exercise? _pickForSlot({
    required SlotSpec slot,
    required BlockType block,
    required List<Exercise> candidates,
    required SelectionContext context,
    required Random random,
    required Set<String> usedIds,
    required Set<String> usedFamilies,
    required Set<MuscleGroup> loadedMuscles,
  }) {
    bool eligible(Exercise e) =>
        !usedIds.contains(e.id) &&
        (e.family == null || !usedFamilies.contains(e.family)) &&
        e.difficulty <= context.maxDifficulty &&
        (slot.modalities.isEmpty || slot.modalities.contains(e.modality));

    var pool = candidates
        .where(eligible)
        .where((e) => slot.patterns.contains(e.pattern))
        .toList();
    var usingFallback = false;
    if (pool.isEmpty && slot.fallbackPatterns.isNotEmpty) {
      pool = candidates
          .where(eligible)
          .where((e) => slot.fallbackPatterns.contains(e.pattern))
          .toList();
      usingFallback = true;
    }
    if (pool.isEmpty) return null;

    final weights = pool
        .map(
          (e) => _weight(
            e,
            slot: slot,
            block: block,
            context: context,
            loadedMuscles: loadedMuscles,
            usingFallback: usingFallback,
          ),
        )
        .toList(growable: false);
    return pool[_weightedIndex(weights, random)];
  }

  double _weight(
    Exercise e, {
    required SlotSpec slot,
    required BlockType block,
    required SelectionContext context,
    required Set<MuscleGroup> loadedMuscles,
    required bool usingFallback,
  }) {
    final patterns = usingFallback ? slot.fallbackPatterns : slot.patterns;
    final rank = patterns.indexOf(e.pattern);
    var w = rank <= 0 ? 1.0 : 1.0 / (1 + rank * 0.6);
    if (usingFallback) w *= fallbackPatternWeight;

    final dd = e.difficulty - context.targetDifficulty;
    w *= exp(-(dd * dd) / (2 * difficultySigma * difficultySigma));

    final ago = context.recentUse[e.id];
    if (ago != null && ago >= 0 && ago < recentPenalty.length) {
      w *= recentPenalty[ago];
    }

    if (block == BlockType.strength && e.mechanics == Mechanics.compound) {
      w *= compoundBonus;
    }

    if (block == BlockType.strength &&
        e.primaryMuscles.any(loadedMuscles.contains)) {
      w *= overlapPenalty;
    }

    // Never let a weight collapse to zero: every eligible exercise keeps a
    // small chance so sparse pools still fill.
    return max(w, 1e-6);
  }

  static int _weightedIndex(List<double> weights, Random random) {
    final total = weights.fold(0.0, (a, b) => a + b);
    var r = random.nextDouble() * total;
    for (var i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }
}
