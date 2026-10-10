import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:peaches/domain/exercises/exercise_catalog.dart';
import 'package:peaches/domain/exercises/taxonomy.dart';
import 'package:peaches/domain/models/training.dart';
import 'package:peaches/domain/models/workout.dart';
import 'package:peaches/domain/services/exercise_selector.dart';
import 'package:peaches/domain/services/session_planner.dart';

void main() {
  final catalog = ExerciseCatalog.standard();
  const planner = SessionPlanner();
  const selector = ExerciseSelector();
  final bodyweight = catalog.performableWith(const {}).toList();
  final plan = planner.plan(
    focus: SessionFocus.fullBody,
    goal: TrainingGoal.generalFitness,
    durationMinutes: 45,
  );

  group('ExerciseSelector', () {
    test('is deterministic for a seed', () {
      List<String> run() => selector
          .select(
            plan: plan,
            candidates: bodyweight,
            context: const SelectionContext(targetDifficulty: 2),
            random: Random(7),
          )
          .map((s) => s.exercise.id)
          .toList();
      expect(run(), run());
    });

    test('never repeats an exercise or a progression family', () {
      for (var seed = 0; seed < 25; seed++) {
        final picks = selector.select(
          plan: plan,
          candidates: bodyweight,
          context: const SelectionContext(targetDifficulty: 2.5),
          random: Random(seed),
        );
        final ids = picks.map((s) => s.exercise.id).toList();
        expect(ids.toSet().length, ids.length, reason: 'seed $seed');
        final families = picks.map((s) => s.exercise.family).nonNulls.toList();
        expect(families.toSet().length, families.length, reason: 'seed $seed');
      }
    });

    test('fills every required slot when the pool is rich', () {
      final picks = selector.select(
        plan: plan,
        candidates: bodyweight,
        context: const SelectionContext(targetDifficulty: 2),
        random: Random(1),
      );
      final required = plan.blocks
          .expand((b) => b.slots)
          .where((s) => !s.optional)
          .length;
      expect(picks.length, greaterThanOrEqualTo(required));
      final strength = picks
          .where((p) => p.block == BlockType.strength)
          .map((p) => p.exercise.pattern);
      expect(strength.any((p) => p.isPush), isTrue);
      expect(strength.any((p) => p.isPull), isTrue);
      expect(strength.any((p) => p.isCore), isTrue);
    });

    test('respects the difficulty cap', () {
      for (var seed = 0; seed < 10; seed++) {
        final picks = selector.select(
          plan: plan,
          candidates: catalog.all.toList(),
          context: const SelectionContext(
            targetDifficulty: 1,
            maxDifficulty: 2,
          ),
          random: Random(seed),
        );
        for (final p in picks) {
          expect(
            p.exercise.difficulty,
            lessThanOrEqualTo(2),
            reason: p.exercise.id,
          );
        }
      }
    });

    test('respects slot modality restrictions', () {
      final picks = selector.select(
        plan: planner.plan(
          focus: SessionFocus.conditioning,
          goal: TrainingGoal.generalFitness,
          durationMinutes: 40,
        ),
        candidates: bodyweight,
        context: const SelectionContext(targetDifficulty: 2),
        random: Random(3),
      );
      for (final p in picks.where((p) => p.block == BlockType.conditioning)) {
        expect(
          p.exercise.modality,
          anyOf(Modality.conditioning, Modality.power),
          reason: p.exercise.id,
        );
      }
    });

    test('skips slots gracefully when the pool is tiny', () {
      final tiny = catalog.byIds([
        'bw-push-up',
        'bw-air-squat',
        'mob-cat-cow',
      ]).toList();
      final picks = selector.select(
        plan: plan,
        candidates: tiny,
        context: const SelectionContext(targetDifficulty: 2),
        random: Random(0),
      );
      final ids = picks.map((p) => p.exercise.id).toSet();
      expect(ids, {'bw-push-up', 'bw-air-squat', 'mob-cat-cow'});
    });

    test('uses fallback patterns when primary patterns are absent', () {
      // No pulling exercises at all: the pull slot should fall back to isolation.
      final noPull = bodyweight.where((e) => !e.pattern.isPull).toList();
      final picks = selector.select(
        plan: plan,
        candidates: noPull,
        context: const SelectionContext(targetDifficulty: 2),
        random: Random(11),
      );
      final pullSlot = picks.where((p) => p.slot.label == 'Pull');
      expect(pullSlot.length, 1);
      expect(pullSlot.single.exercise.pattern, MovementPattern.isolation);
    });

    test('strongly avoids recently used exercises', () {
      final pool = catalog.byIds([
        'bw-push-up',
        'bw-knee-push-up',
        'bw-incline-push-up',
        'bw-wide-push-up',
        'bw-diamond-push-up',
      ]).toList();
      const pushPlan = SessionPlan(
        focus: SessionFocus.upperBody,
        goal: TrainingGoal.generalFitness,
        durationMinutes: 20,
        blocks: [
          BlockSpec(
            type: BlockType.strength,
            slots: [
              SlotSpec(patterns: [MovementPattern.horizontalPush]),
            ],
          ),
        ],
      );
      var lastRoundHits = 0;
      const trials = 400;
      for (var seed = 0; seed < trials; seed++) {
        final pick = selector.select(
          plan: pushPlan,
          candidates: pool,
          context: const SelectionContext(
            targetDifficulty: 2,
            recentUse: {'bw-push-up': 0},
          ),
          random: Random(seed),
        );
        if (pick.single.exercise.id == 'bw-push-up') lastRoundHits++;
      }
      // Unpenalised and with similar difficulty it would be picked ~1/5 of the
      // time; the recency penalty should make it clearly rarer than that.
      expect(lastRoundHits / trials, lessThan(0.1));
    });
  });
}
