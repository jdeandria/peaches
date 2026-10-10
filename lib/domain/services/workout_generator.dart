import 'dart:math';

import '../core/ids.dart';
import '../exercises/exercise.dart';
import '../models/training.dart';
import '../models/workout.dart';
import 'exercise_selector.dart';
import 'prescriber.dart';
import 'session_planner.dart';

/// Everything the generator needs to build one workout.
final class WorkoutRequest {
  const WorkoutRequest({
    required this.availableExercises,
    required this.focus,
    required this.goal,
    required this.durationMinutes,
    required this.targetDifficulty,
    required this.seed,
    this.maxDifficulty = 5,
    this.recentUse = const {},
    this.title,
  }) : assert(durationMinutes > 0, 'durationMinutes must be positive'),
       assert(
         targetDifficulty >= 1 && targetDifficulty <= 5,
         'targetDifficulty is 1..5',
       );

  /// The pool shared by every Peach who will perform the workout.
  final List<Exercise> availableExercises;
  final SessionFocus focus;
  final TrainingGoal goal;
  final int durationMinutes;
  final double targetDifficulty;
  final int maxDifficulty;

  /// Reproducibility seed; same seed + same inputs = same workout.
  final int seed;

  /// exerciseId -> rounds ago it was last used, for variety.
  final Map<String, int> recentUse;
  final String? title;
}

/// Builds a complete, time-boxed workout from a shared exercise pool.
///
/// Pipeline: [SessionPlanner] decides the shape, [ExerciseSelector] fills
/// it, [Prescriber] sets the dose, and this class trims the result to the
/// time budget by dropping optional slots first and then reducing sets.
final class WorkoutGenerator {
  const WorkoutGenerator({
    required this._ids,
    this._planner = const SessionPlanner(),
    this._selector = const ExerciseSelector(),
    this._prescriber = const Prescriber(),
  });

  /// Bump when the algorithm changes in a way that alters output for the
  /// same inputs, so stored workouts can be reproduced.
  static const version = 1;

  final IdGenerator _ids;
  final SessionPlanner _planner;
  final ExerciseSelector _selector;
  final Prescriber _prescriber;

  Workout generate(WorkoutRequest request, {required DateTime now}) {
    final plan = _planner.plan(
      focus: request.focus,
      goal: request.goal,
      durationMinutes: request.durationMinutes,
    );
    final random = Random(request.seed);
    final selections = _selector.select(
      plan: plan,
      candidates: request.availableExercises,
      context: SelectionContext(
        targetDifficulty: request.targetDifficulty,
        maxDifficulty: request.maxDifficulty,
        recentUse: request.recentUse,
      ),
      random: random,
    );

    var drafts = selections
        .map(
          (s) => _Draft(
            selection: s,
            prescription: _prescriber.prescribe(
              exercise: s.exercise,
              block: s.block,
              goal: request.goal,
              targetDifficulty: request.targetDifficulty,
            ),
          ),
        )
        .toList();

    drafts = _fitToBudget(drafts, request.durationMinutes * 60);

    final blocks = <WorkoutBlock>[];
    for (final type in BlockType.values) {
      final items = [
        for (final d in drafts)
          if (d.selection.block == type)
            WorkoutItem(
              id: _ids.newId(),
              exerciseId: d.selection.exercise.id,
              prescription: d.prescription,
              scoringWeight: d.selection.slot.scoringWeight,
            ),
      ];
      if (items.isNotEmpty) blocks.add(WorkoutBlock(type: type, items: items));
    }

    return Workout(
      id: _ids.newId(),
      title: request.title,
      blocks: blocks,
      focus: request.focus,
      goal: request.goal,
      targetDifficulty: request.targetDifficulty,
      estimatedMinutes: (_totalSeconds(drafts) / 60).ceil(),
      seed: request.seed,
      generatorVersion: version,
      createdAt: now,
    );
  }

  int _totalSeconds(List<_Draft> drafts) => drafts.fold(
    0,
    (sum, d) =>
        sum + _prescriber.estimateSeconds(d.selection.exercise, d.prescription),
  );

  /// Drops optional items (last first), then trims sets off the longest
  /// scored items, then drops the lowest-priority scored items, until the
  /// estimate fits. Warm-up and cool-down are never cut: they are the
  /// cheapest insurance against injury.
  List<_Draft> _fitToBudget(List<_Draft> drafts, int budgetSeconds) {
    var current = List.of(drafts);
    while (_totalSeconds(current) > budgetSeconds) {
      final optionalIndex = current.lastIndexWhere(
        (d) => d.selection.slot.optional,
      );
      if (optionalIndex >= 0) {
        current.removeAt(optionalIndex);
        continue;
      }
      final trimmable = current
          .where((d) => d.selection.slot.scoringWeight > 0)
          .where((d) => d.prescription.sets > 2)
          .toList();
      if (trimmable.isEmpty) {
        // Sets are already minimal: drop the lowest-priority scored item
        // (the last one in the main block) while more than one remains.
        final scored = current
            .where((d) => d.selection.slot.scoringWeight > 0)
            .toList();
        if (scored.length <= 1) break;
        current.remove(scored.last);
        continue;
      }
      final target = trimmable.first;
      current = [
        for (final d in current)
          if (identical(d, target)) d.withSets(d.prescription.sets - 1) else d,
      ];
    }
    return current;
  }
}

final class _Draft {
  const _Draft({required this.selection, required this.prescription});

  final Selection selection;
  final Prescription prescription;

  _Draft withSets(int sets) => _Draft(
    selection: selection,
    prescription: Prescription(
      sets: sets,
      restSeconds: prescription.restSeconds,
      reps: prescription.reps,
      seconds: prescription.seconds,
      meters: prescription.meters,
      load: prescription.load,
      perSide: prescription.perSide,
    ),
  );
}
