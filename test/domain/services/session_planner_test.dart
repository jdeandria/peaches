import 'package:flutter_test/flutter_test.dart';
import 'package:peaches/domain/exercises/taxonomy.dart';
import 'package:peaches/domain/models/training.dart';
import 'package:peaches/domain/models/workout.dart';
import 'package:peaches/domain/services/session_planner.dart';

void main() {
  const planner = SessionPlanner();

  group('SessionPlanner', () {
    test('every plan starts with a warm-up and ends with a cool-down', () {
      for (final focus in SessionFocus.values) {
        for (final goal in TrainingGoal.values) {
          final plan = planner.plan(
            focus: focus,
            goal: goal,
            durationMinutes: 40,
          );
          expect(plan.blocks.first.type, BlockType.warmUp, reason: focus.name);
          expect(plan.blocks.last.type, BlockType.coolDown, reason: focus.name);
          for (final slot in plan.blocks.first.slots) {
            expect(slot.scoringWeight, 0);
          }
          for (final slot in plan.blocks.last.slots) {
            expect(slot.scoringWeight, 0);
          }
        }
      }
    });

    test('full body pairs push with pull and knee with hip dominant', () {
      final plan = planner.plan(
        focus: SessionFocus.fullBody,
        goal: TrainingGoal.generalFitness,
        durationMinutes: 45,
      );
      final strength = plan.blocks.firstWhere(
        (b) => b.type == BlockType.strength,
      );
      final firstChoices = strength.slots.map((s) => s.patterns.first).toList();
      expect(firstChoices, contains(MovementPattern.squat));
      expect(firstChoices, contains(MovementPattern.hinge));
      expect(firstChoices.where((p) => p.isPush).length, 1);
      expect(firstChoices.where((p) => p.isPull).length, 1);
      expect(firstChoices.any((p) => p.isCore), isTrue);
    });

    test('upper body has two pushes and two pulls', () {
      final plan = planner.plan(
        focus: SessionFocus.upperBody,
        goal: TrainingGoal.hypertrophy,
        durationMinutes: 45,
      );
      final strength = plan.blocks.firstWhere(
        (b) => b.type == BlockType.strength,
      );
      final required = strength.slots.where((s) => !s.optional);
      expect(required.where((s) => s.patterns.first.isPush).length, 2);
      expect(required.where((s) => s.patterns.first.isPull).length, 2);
    });

    test('lower body includes squat, hinge and single-leg work', () {
      final plan = planner.plan(
        focus: SessionFocus.lowerBody,
        goal: TrainingGoal.strength,
        durationMinutes: 40,
      );
      final strength = plan.blocks.firstWhere(
        (b) => b.type == BlockType.strength,
      );
      final required = strength.slots
          .where((s) => !s.optional)
          .map((s) => s.patterns.first);
      expect(
        required,
        containsAll([
          MovementPattern.squat,
          MovementPattern.hinge,
          MovementPattern.lunge,
        ]),
      );
    });

    test('shorter sessions carry fewer slots', () {
      final short = planner.plan(
        focus: SessionFocus.fullBody,
        goal: TrainingGoal.generalFitness,
        durationMinutes: 20,
      );
      final long = planner.plan(
        focus: SessionFocus.fullBody,
        goal: TrainingGoal.generalFitness,
        durationMinutes: 75,
      );
      expect(short.slotCount, lessThan(long.slotCount));
      // Required slots are never trimmed away in favour of optional ones.
      final shortStrength = short.blocks.firstWhere(
        (b) => b.type == BlockType.strength,
      );
      expect(shortStrength.slots.any((s) => s.optional), isFalse);
    });

    test(
      'endurance goal adds conditioning; strength goal removes it when short',
      () {
        final endurance = planner.plan(
          focus: SessionFocus.fullBody,
          goal: TrainingGoal.endurance,
          durationMinutes: 40,
        );
        final strength = planner.plan(
          focus: SessionFocus.fullBody,
          goal: TrainingGoal.strength,
          durationMinutes: 40,
        );
        int conditioning(SessionPlan p) => p.blocks
            .where((b) => b.type == BlockType.conditioning)
            .fold(0, (n, b) => n + b.slots.length);
        expect(conditioning(endurance), 2);
        expect(conditioning(strength), 0);
      },
    );

    test('conditioning focus is dominated by conditioning slots', () {
      final plan = planner.plan(
        focus: SessionFocus.conditioning,
        goal: TrainingGoal.generalFitness,
        durationMinutes: 40,
      );
      final conditioning = plan.blocks.firstWhere(
        (b) => b.type == BlockType.conditioning,
      );
      expect(conditioning.slots.length, 4);
      for (final slot in conditioning.slots) {
        expect(
          slot.modalities,
          containsAll([Modality.conditioning, Modality.power]),
        );
      }
    });
  });
}
