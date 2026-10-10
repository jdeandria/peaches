import 'package:flutter_test/flutter_test.dart';
import 'package:peaches/domain/core/local_date.dart';
import 'package:peaches/domain/models/training.dart';
import 'package:peaches/domain/services/focus_rotation.dart';

void main() {
  const rotation = FocusRotation();

  List<LocalDate> days(List<int> octoberDays) =>
      octoberDays.map((d) => LocalDate(2026, 10, d)).toList();

  group('FocusRotation', () {
    test('returns one focus per day', () {
      final result = rotation.assign(
        days([1, 3, 5, 8, 10]),
        TrainingGoal.generalFitness,
      );
      expect(result.length, 5);
    });

    test('cycles through the general sequence on spaced days', () {
      final result = rotation.assign(
        days([1, 3, 5, 7, 9]),
        TrainingGoal.generalFitness,
      );
      expect(result, [
        SessionFocus.fullBody,
        SessionFocus.upperBody,
        SessionFocus.lowerBody,
        SessionFocus.conditioning,
        SessionFocus.fullBody,
      ]);
    });

    test('never loads the same region hard on consecutive days', () {
      for (final goal in TrainingGoal.values) {
        final result = rotation.assign(days([1, 2, 3, 4, 5, 6, 7, 8]), goal);
        for (var i = 1; i < result.length; i++) {
          final a = result[i - 1];
          final b = result[i];
          expect(
            a.loadsUpper && b.loadsUpper,
            isFalse,
            reason: '$goal day $i: $a -> $b',
          );
          expect(
            a.loadsLower && b.loadsLower,
            isFalse,
            reason: '$goal day $i: $a -> $b',
          );
        }
      }
    });

    test('endurance goal emphasises conditioning', () {
      final result = rotation.assign(
        days([1, 4, 7, 10]),
        TrainingGoal.endurance,
      );
      expect(result.where((f) => f == SessionFocus.conditioning).length, 2);
    });

    test('handles empty input', () {
      expect(rotation.assign(const [], TrainingGoal.strength), isEmpty);
    });
  });
}
