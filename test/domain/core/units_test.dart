import 'package:flutter_test/flutter_test.dart';
import 'package:peaches/domain/core/units.dart';
import 'package:peaches/domain/exercises/exercise_catalog.dart';
import 'package:peaches/domain/exercises/taxonomy.dart';
import 'package:peaches/domain/models/training.dart';

void main() {
  group('WeightUnits', () {
    test('metric is the identity', () {
      expect(WeightUnits.toDisplay(20, UnitSystem.metric), 20);
      expect(WeightUnits.toKg(20, UnitSystem.metric), 20);
      expect(WeightUnits.label(UnitSystem.metric), 'kg');
      expect(WeightUnits.step(UnitSystem.metric), 2.5);
    });

    test('imperial converts both ways', () {
      expect(
        WeightUnits.toKg(100, UnitSystem.imperial),
        closeTo(45.359, 0.001),
      );
      expect(
        WeightUnits.toDisplay(45.359237, UnitSystem.imperial),
        closeTo(100, 1e-9),
      );
      expect(WeightUnits.label(UnitSystem.imperial), 'lb');
      expect(WeightUnits.step(UnitSystem.imperial), 5);
    });

    test('round trips are lossless for stored values', () {
      for (final kg in [2.5, 20.0, 61.25, 140.0]) {
        final shown = WeightUnits.toDisplay(kg, UnitSystem.imperial);
        expect(WeightUnits.toKg(shown, UnitSystem.imperial), closeTo(kg, 1e-9));
      }
    });

    test('formats without trailing zeros', () {
      expect(WeightUnits.format(20), '20');
      expect(WeightUnits.format(22.5), '22.5');
      expect(WeightUnits.format(44.0924), '44');
      expect(WeightUnits.format(44.13), '44.25');
    });
  });

  group('Exercise.takesLoad', () {
    final catalog = ExerciseCatalog.standard();

    test('every barbell, dumbbell and kettlebell exercise takes a load', () {
      for (final e in catalog.all) {
        if (e.equipment.any(
          (q) =>
              q == Equipment.barbell ||
              q == Equipment.dumbbell ||
              q == Equipment.kettlebell,
        )) {
          expect(e.takesLoad, isTrue, reason: e.id);
        }
      }
    });

    test('bodyweight and band exercises do not', () {
      expect(catalog.require('bw-push-up').takesLoad, isFalse);
      expect(catalog.require('band-row').takesLoad, isFalse);
      expect(catalog.require('trx-row').takesLoad, isFalse);
    });

    test('weighted carries and holds do', () {
      expect(catalog.require('db-farmer-carry').takesLoad, isTrue);
      expect(catalog.require('db-suitcase-hold').takesLoad, isTrue);
      expect(catalog.require('sled-push').takesLoad, isTrue);
    });
  });
}
