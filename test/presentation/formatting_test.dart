import 'package:flutter_test/flutter_test.dart';
import 'package:peaches/domain/models/training.dart';
import 'package:peaches/domain/models/workout_log.dart';
import 'package:peaches/presentation/formatting.dart';

void main() {
  ExerciseLogEntry entry(List<double?> loads) => ExerciseLogEntry(
    exerciseId: 'bb-back-squat',
    workoutItemId: 'w-1-i0',
    sets: [for (final kg in loads) SetLog(reps: 5, loadKg: kg)],
  );

  group('Fmt.loggedLoad', () {
    test('is null without weights', () {
      expect(Fmt.loggedLoad(entry([null, null]), UnitSystem.metric), isNull);
    });

    test('collapses equal weights and shows a range otherwise', () {
      expect(
        Fmt.loggedLoad(entry([60, 60, 60]), UnitSystem.metric),
        'Lifted 60 kg',
      );
      expect(
        Fmt.loggedLoad(entry([60, 62.5, null]), UnitSystem.metric),
        'Lifted 60–62.5 kg',
      );
    });

    test('converts to pounds', () {
      expect(
        Fmt.loggedLoad(entry([61.234986]), UnitSystem.imperial),
        'Lifted 135 lb',
      );
    });
  });

  test('Fmt.volume groups thousands in the chosen units', () {
    expect(Fmt.volume(2450, UnitSystem.metric), '2,450 kg');
    expect(Fmt.volume(1000, UnitSystem.imperial), '2,205 lb');
  });
}
