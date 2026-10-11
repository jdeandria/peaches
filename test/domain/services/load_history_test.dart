import 'package:flutter_test/flutter_test.dart';
import 'package:peaches/domain/models/workout_log.dart';
import 'package:peaches/domain/services/load_history.dart';

void main() {
  WorkoutLog log(String id, int day, List<ExerciseLogEntry> entries) =>
      WorkoutLog(
        id: id,
        peachId: 'p',
        startedAt: DateTime.utc(2026, 10, day, 9),
        completedAt: DateTime.utc(2026, 10, day, 10),
        status: WorkoutLogStatus.submitted,
        entries: entries,
      );

  ExerciseLogEntry squat(List<double?> loads) => ExerciseLogEntry(
    exerciseId: 'db-goblet-squat',
    sets: [for (final l in loads) SetLog(reps: 10, loadKg: l)],
  );

  test('returns the most recent loads for the exercise', () {
    final logs = [
      log('old', 1, [
        squat([16, 16, 16]),
      ]),
      log('new', 5, [
        squat([20, 20, 22.5]),
      ]),
      log('mid', 3, [
        squat([18, 18, 18]),
      ]),
    ];
    expect(LoadHistory.lastLoadsKg(logs, 'db-goblet-squat'), [20, 20, 22.5]);
  });

  test('skips the log being edited and entries without weights', () {
    final logs = [
      log('a', 1, [
        squat([16, 16]),
      ]),
      log('b', 4, [
        squat([null, null]),
      ]),
      log('current', 6, [
        squat([30]),
      ]),
    ];
    expect(
      LoadHistory.lastLoadsKg(
        logs,
        'db-goblet-squat',
        excludingLogId: 'current',
      ),
      [16, 16],
    );
  });

  test('returns null with no history', () {
    expect(LoadHistory.lastLoadsKg(const [], 'x'), isNull);
  });

  test('topLoadKg picks the heaviest set', () {
    expect(LoadHistory.topLoadKg(squat([20, 25, 22.5])), 25);
    expect(LoadHistory.topLoadKg(squat([null])), isNull);
  });
}
