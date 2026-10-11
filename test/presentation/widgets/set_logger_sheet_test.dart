import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:peaches/app/theme.dart';
import 'package:peaches/domain/core/units.dart';
import 'package:peaches/domain/exercises/exercise.dart';
import 'package:peaches/domain/exercises/exercise_catalog.dart';
import 'package:peaches/domain/models/training.dart';
import 'package:peaches/domain/models/workout.dart';
import 'package:peaches/domain/models/workout_log.dart';
import 'package:peaches/presentation/widgets/set_logger_sheet.dart';

void main() {
  final catalog = ExerciseCatalog.standard();
  final squat = catalog.require('bb-back-squat');
  final pushUp = catalog.require('bw-push-up');

  WorkoutItem itemFor(Exercise e, {int sets = 3}) => WorkoutItem(
    id: 'w-1-i0',
    exerciseId: e.id,
    prescription: Prescription(sets: sets, reps: 8, restSeconds: 90),
  );

  /// Opens the sheet from a button and returns a getter for its result.
  Future<ExerciseLogEntry? Function()> open(
    WidgetTester tester,
    Exercise exercise, {
    UnitSystem units = UnitSystem.metric,
    List<double>? previous,
    ExerciseLogEntry? existing,
  }) async {
    ExerciseLogEntry? result;
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.6;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MaterialApp(
        theme: PeachesTheme.light(),
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: TextButton(
                onPressed: () async => result = await showSetLoggerSheet(
                  context,
                  exercise: exercise,
                  item: itemFor(exercise),
                  existing: existing,
                  units: units,
                  previousLoadsKg: previous,
                ),
                child: const Text('open'),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    return () => result;
  }

  Future<void> save(WidgetTester tester) async {
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();
  }

  testWidgets('bodyweight exercises have no weight stepper', (tester) async {
    final result = await open(tester, pushUp);
    expect(find.byTooltip('Heavier'), findsNothing);
    expect(find.text('kg'), findsNothing);
    await save(tester);
    expect(result()!.sets.map((s) => s.loadKg), everyElement(isNull));
  });

  testWidgets('weighted exercises get a weight per set', (tester) async {
    final result = await open(tester, squat);
    expect(find.byTooltip('Heavier'), findsNWidgets(3));
    expect(find.text('kg'), findsNWidgets(3));

    // Blank until set: one press from zero is a single 2.5 kg step.
    await tester.tap(find.byTooltip('Heavier').first);
    await tester.pump();
    await save(tester);
    // Carried forward to the later, still-blank sets.
    expect(result()!.sets.map((s) => s.loadKg), [2.5, 2.5, 2.5]);
    expect(result()!.sets.map((s) => s.reps), [8, 8, 8]);
  });

  testWidgets('pre-fills from last time and shows it', (tester) async {
    final result = await open(tester, squat, previous: [60, 62.5]);
    expect(find.text('Last time: 60 · 62.5 kg'), findsOneWidget);
    await save(tester);
    // The last recorded set's weight fills sets beyond last time's count.
    expect(result()!.sets.map((s) => s.loadKg), [60, 62.5, 62.5]);
  });

  testWidgets('changing a weight carries to later matching sets only', (
    tester,
  ) async {
    final result = await open(tester, squat, previous: [50, 60, 60]);
    // Raise set 2 from 60 to 62.5: set 3 (also 60) follows, set 1 stays.
    await tester.tap(find.byTooltip('Heavier').at(1));
    await tester.pump();
    await save(tester);
    expect(result()!.sets.map((s) => s.loadKg), [50, 62.5, 62.5]);
  });

  testWidgets('typed weights carry forward too', (tester) async {
    final result = await open(tester, squat, previous: [40, 40, 40]);
    await tester.enterText(find.widgetWithText(TextField, '40').first, '45');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pump();
    await save(tester);
    expect(result()!.sets.map((s) => s.loadKg), [45, 45, 45]);
  });

  testWidgets('shows and steps pounds but stores kilograms', (tester) async {
    final result = await open(
      tester,
      squat,
      units: UnitSystem.imperial,
      previous: [WeightUnits.toKg(135, UnitSystem.imperial)],
    );
    expect(find.text('lb'), findsNWidgets(3));
    expect(find.widgetWithText(TextField, '135'), findsNWidgets(3));
    await tester.tap(find.byTooltip('Heavier').first);
    await tester.pump();
    expect(find.widgetWithText(TextField, '140'), findsNWidgets(3));
    await save(tester);
    expect(
      result()!.sets.first.loadKg,
      closeTo(WeightUnits.toKg(140, UnitSystem.imperial), 1e-9),
    );
  });

  testWidgets('an existing entry wins over last time', (tester) async {
    final result = await open(
      tester,
      squat,
      previous: [100],
      existing: const ExerciseLogEntry(
        exerciseId: 'bb-back-squat',
        workoutItemId: 'w-1-i0',
        sets: [
          SetLog(reps: 6, loadKg: 80),
          SetLog(reps: 6, loadKg: 80),
          SetLog(reps: 5, loadKg: 82.5),
        ],
      ),
    );
    await save(tester);
    expect(result()!.sets.map((s) => s.loadKg), [80, 80, 82.5]);
    expect(result()!.sets.map((s) => s.reps), [6, 6, 5]);
  });
}
