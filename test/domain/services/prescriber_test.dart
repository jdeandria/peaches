import 'package:flutter_test/flutter_test.dart';
import 'package:peaches/domain/exercises/exercise_catalog.dart';
import 'package:peaches/domain/exercises/taxonomy.dart';
import 'package:peaches/domain/models/training.dart';
import 'package:peaches/domain/models/workout.dart';
import 'package:peaches/domain/services/prescriber.dart';

void main() {
  final catalog = ExerciseCatalog.standard();
  const prescriber = Prescriber();

  group('Prescriber main block', () {
    test(
      'strength goal: fewer reps, longer rest, higher RPE than endurance',
      () {
        final squat = catalog.require('bb-back-squat');
        final strength = prescriber.prescribe(
          exercise: squat,
          block: BlockType.strength,
          goal: TrainingGoal.strength,
          targetDifficulty: 2,
        );
        final endurance = prescriber.prescribe(
          exercise: squat,
          block: BlockType.strength,
          goal: TrainingGoal.endurance,
          targetDifficulty: 2,
        );
        expect(strength.reps!, lessThan(endurance.reps!));
        expect(strength.restSeconds, greaterThan(endurance.restSeconds));
        expect(strength.load!.rpe, greaterThan(endurance.load!.rpe));
        expect(strength.sets, greaterThanOrEqualTo(endurance.sets));
      },
    );

    test('bodyweight reps carry no load guidance and run higher', () {
      final pushUp = catalog.require('bw-push-up');
      final p = prescriber.prescribe(
        exercise: pushUp,
        block: BlockType.strength,
        goal: TrainingGoal.generalFitness,
        targetDifficulty: 2,
      );
      expect(p.load, isNull);
      expect(p.reps, 12);
      expect(p.unit, MeasurementType.reps);
    });

    test('higher target difficulty scales volume up', () {
      final pushUp = catalog.require('bw-push-up');
      Prescription at(double d) => prescriber.prescribe(
        exercise: pushUp,
        block: BlockType.strength,
        goal: TrainingGoal.generalFitness,
        targetDifficulty: d,
      );
      expect(at(1).reps!, lessThan(at(2).reps!));
      expect(at(2).reps!, lessThan(at(4).reps!));
    });

    test('unilateral exercises are prescribed per side', () {
      final p = prescriber.prescribe(
        exercise: catalog.require('bw-side-plank'),
        block: BlockType.strength,
        goal: TrainingGoal.generalFitness,
        targetDifficulty: 2,
      );
      expect(p.perSide, isTrue);
      expect(p.unit, MeasurementType.duration);
      expect(p.totalTarget, p.seconds! * p.sets * 2);
    });

    test('isolation work gets fewer sets', () {
      final compound = prescriber.prescribe(
        exercise: catalog.require('db-bench-press'),
        block: BlockType.strength,
        goal: TrainingGoal.hypertrophy,
        targetDifficulty: 2,
      );
      final isolation = prescriber.prescribe(
        exercise: catalog.require('db-biceps-curl'),
        block: BlockType.strength,
        goal: TrainingGoal.hypertrophy,
        targetDifficulty: 2,
      );
      expect(isolation.sets, lessThan(compound.sets));
    });
  });

  group('Prescriber other blocks', () {
    test('warm-up and cool-down are single sets with no rest', () {
      final warm = prescriber.prescribe(
        exercise: catalog.require('mob-cat-cow'),
        block: BlockType.warmUp,
        goal: TrainingGoal.strength,
        targetDifficulty: 5,
      );
      final cool = prescriber.prescribe(
        exercise: catalog.require('str-pigeon'),
        block: BlockType.coolDown,
        goal: TrainingGoal.strength,
        targetDifficulty: 5,
      );
      expect(warm.sets, 1);
      expect(warm.restSeconds, 0);
      expect(cool.sets, 1);
      expect(cool.seconds, 30);
      expect(cool.perSide, isTrue);
    });

    test('conditioning locomotion is one continuous distance effort', () {
      final p = prescriber.prescribe(
        exercise: catalog.require('bw-run'),
        block: BlockType.conditioning,
        goal: TrainingGoal.generalFitness,
        targetDifficulty: 2,
      );
      expect(p.sets, 1);
      expect(p.meters, 800);
    });

    test('conditioning intervals scale with endurance goal', () {
      final general = prescriber.prescribe(
        exercise: catalog.require('bw-burpee'),
        block: BlockType.conditioning,
        goal: TrainingGoal.generalFitness,
        targetDifficulty: 2,
      );
      final endurance = prescriber.prescribe(
        exercise: catalog.require('bw-burpee'),
        block: BlockType.conditioning,
        goal: TrainingGoal.endurance,
        targetDifficulty: 2,
      );
      expect(endurance.sets, greaterThan(general.sets));
    });
  });

  group('Prescriber.estimateSeconds', () {
    test('accounts for reps, rest, sides and transition', () {
      const p = Prescription(sets: 3, reps: 10, restSeconds: 60, perSide: true);
      final seconds = prescriber.estimateSeconds(
        catalog.require('bw-split-squat'),
        p,
      );
      // 6 working sets x 30 s + 5 rests x 60 s + 20 s transition.
      expect(seconds, 6 * 30 + 5 * 60 + 20);
    });

    test('distance uses a slower pace for carries than locomotion', () {
      const p = Prescription(sets: 1, meters: 300, restSeconds: 0);
      final carry = prescriber.estimateSeconds(
        catalog.require('db-farmer-carry'),
        p,
      );
      final run = prescriber.estimateSeconds(catalog.require('bw-run'), p);
      expect(carry, greaterThan(run));
    });
  });
}
