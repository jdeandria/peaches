import 'package:flutter_test/flutter_test.dart';
import 'package:peaches/domain/exercises/exercise.dart';
import 'package:peaches/domain/exercises/exercise_catalog.dart';
import 'package:peaches/domain/exercises/taxonomy.dart';

void main() {
  final catalog = ExerciseCatalog.standard();

  group('standard catalog integrity', () {
    test('is large', () {
      expect(catalog.length, greaterThanOrEqualTo(400));
    });

    test('ids are unique, kebab-case slugs', () {
      final ids = catalog.all.map((e) => e.id).toList();
      expect(ids.toSet().length, ids.length);
      final slug = RegExp(r'^[a-z0-9]+(-[a-z0-9]+)*$');
      for (final id in ids) {
        expect(slug.hasMatch(id), isTrue, reason: '$id is not a slug');
      }
    });

    test('names are unique', () {
      final names = catalog.all.map((e) => e.name.toLowerCase()).toList();
      expect(names.toSet().length, names.length);
    });

    test('every exercise names at least one primary muscle', () {
      for (final e in catalog.all) {
        expect(e.primaryMuscles, isNotEmpty, reason: e.id);
      }
    });

    test('primary and secondary muscles do not overlap', () {
      for (final e in catalog.all) {
        final overlap = e.primaryMuscles.toSet().intersection(
          e.secondaryMuscles.toSet(),
        );
        expect(overlap, isEmpty, reason: e.id);
      }
    });

    test('every movement pattern is represented', () {
      for (final pattern in MovementPattern.values) {
        expect(catalog.withPattern(pattern), isNotEmpty, reason: pattern.name);
      }
    });

    test('every main pattern has bodyweight options at difficulty <= 2', () {
      const mainPatterns = [
        MovementPattern.squat,
        MovementPattern.hinge,
        MovementPattern.lunge,
        MovementPattern.horizontalPush,
        MovementPattern.horizontalPull,
        MovementPattern.antiExtension,
        MovementPattern.rotation,
        MovementPattern.antiLateralFlexion,
        MovementPattern.coreFlexion,
        MovementPattern.plyometric,
        MovementPattern.locomotion,
        MovementPattern.mobility,
        MovementPattern.stretch,
      ];
      for (final pattern in mainPatterns) {
        final easyBodyweight = catalog
            .withPattern(pattern)
            .where((e) => e.isBodyweight && e.difficulty <= 2);
        expect(easyBodyweight, isNotEmpty, reason: pattern.name);
      }
    });

    test('warm-up and cool-down patterns use matching modalities', () {
      for (final e in catalog.withPattern(MovementPattern.mobility)) {
        expect(e.modality, Modality.mobility, reason: e.id);
      }
      for (final e in catalog.withPattern(MovementPattern.stretch)) {
        expect(e.modality, Modality.flexibility, reason: e.id);
        expect(e.measurement, MeasurementType.duration, reason: e.id);
      }
    });

    test('locomotion is always conditioning work', () {
      for (final e in catalog.withPattern(MovementPattern.locomotion)) {
        expect(e.modality, Modality.conditioning, reason: e.id);
        expect(e.measurement, isNot(MeasurementType.loadedReps), reason: e.id);
      }
    });

    test('loaded exercises require equipment', () {
      for (final e in catalog.all) {
        if (e.measurement == MeasurementType.loadedReps) {
          expect(e.equipment, isNotEmpty, reason: e.id);
        }
      }
    });

    test('isolation mechanics only appear in accessory-style patterns', () {
      for (final e in catalog.all) {
        if (e.mechanics == Mechanics.isolation) {
          expect(
            e.pattern,
            anyOf(
              MovementPattern.isolation,
              MovementPattern.horizontalPull,
              MovementPattern.verticalPull,
              MovementPattern.antiLateralFlexion,
            ),
            reason: e.id,
          );
        }
      }
    });

    test('progression families link at least two exercises', () {
      final counts = <String, int>{};
      for (final e in catalog.all) {
        if (e.family != null) counts[e.family!] = (counts[e.family!] ?? 0) + 1;
      }
      for (final entry in counts.entries) {
        expect(entry.value, greaterThanOrEqualTo(2), reason: entry.key);
      }
    });

    test('every exercise round-trips through JSON', () {
      for (final e in catalog.all) {
        final copy = Exercise.fromJson(e.toJson());
        expect(copy.toJson(), e.toJson(), reason: e.id);
      }
    });
  });

  group('ExerciseCatalog queries', () {
    test('byId and require', () {
      expect(catalog.byId('bw-push-up')?.name, 'Push Up');
      expect(catalog.byId('nope'), isNull);
      expect(() => catalog.require('nope'), throwsArgumentError);
    });

    test('byIds drops unknown ids', () {
      final found = catalog.byIds(['bw-push-up', 'ghost', 'bw-air-squat']);
      expect(found.map((e) => e.id), ['bw-push-up', 'bw-air-squat']);
    });

    test('performableWith filters by equipment', () {
      final bodyweightOnly = catalog.performableWith(const {});
      expect(bodyweightOnly.every((e) => e.isBodyweight), isTrue);
      final withDumbbells = catalog.performableWith({Equipment.dumbbell});
      expect(withDumbbells.length, greaterThan(bodyweightOnly.length));
      expect(
        withDumbbells.any((e) => e.equipment.contains(Equipment.barbell)),
        isFalse,
      );
    });

    test('search matches names and aliases case-insensitively', () {
      expect(
        catalog.search('AIR squat').map((e) => e.id),
        contains('bw-air-squat'),
      );
      expect(
        catalog.search('military').map((e) => e.id),
        contains('bb-overhead-press'),
      );
      expect(catalog.search('   ').length, catalog.length);
    });

    test('rejects duplicate ids', () {
      final e = catalog.require('bw-push-up');
      expect(() => ExerciseCatalog([e, e]), throwsA(isA<AssertionError>()));
    });
  });
}
