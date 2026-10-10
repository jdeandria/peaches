import 'dart:math';

import '../exercises/taxonomy.dart';
import '../models/score.dart';
import '../models/scoring_rules.dart';
import '../models/season.dart';
import '../models/workout.dart';
import '../models/workout_log.dart';

/// Turns a log of a workout into fantasy points.
final class ScoringService {
  const ScoringService();

  WorkoutScore score({
    required Workout workout,
    required WorkoutLog? log,
    ScoringRules rules = ScoringRules.standard,
  }) {
    final scored = workout.scoredItems.toList(growable: false);
    if (scored.isEmpty) return WorkoutScore.zero;

    final items = <ItemScore>[];
    var allComplete = true;
    for (final item in scored) {
      final entry = log?.entryForItem(item.id);
      final ratio = _achievement(item, entry, rules);
      if (ratio < rules.completionThreshold) allComplete = false;
      items.add(
        ItemScore(
          workoutItemId: item.id,
          achievementRatio: ratio,
          points: _round(rules.pointsPerItem * item.scoringWeight * ratio),
        ),
      );
    }
    return WorkoutScore(
      items: items,
      completionBonus: allComplete ? rules.completionBonus : 0,
    );
  }

  /// Resolves a Matchup from both Peaches' logs. A missing log scores zero.
  Matchup resolve({
    required Matchup matchup,
    required Workout workout,
    required WorkoutLog? homeLog,
    required WorkoutLog? awayLog,
    ScoringRules rules = ScoringRules.standard,
  }) {
    final home = score(workout: workout, log: homeLog, rules: rules).total;
    final away = matchup.isBye
        ? 0.0
        : score(workout: workout, log: awayLog, rules: rules).total;
    return matchup.copyWith(
      status: MatchupStatus.complete,
      result: MatchupResult(homePoints: home, awayPoints: away),
    );
  }

  static double _achievement(
    WorkoutItem item,
    ExerciseLogEntry? entry,
    ScoringRules rules,
  ) {
    if (entry == null) return 0;
    final target = item.prescription.totalTarget;
    if (target <= 0) return 0;
    final achieved = switch (item.prescription.unit) {
      MeasurementType.reps || MeasurementType.loadedReps => entry.totalReps,
      MeasurementType.duration => entry.totalSeconds,
      MeasurementType.distance => entry.totalMeters,
    };
    return min(achieved / target, rules.maxAchievementRatio);
  }

  static double _round(double value) => (value * 100).round() / 100;
}
