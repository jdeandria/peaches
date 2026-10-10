import 'package:flutter_test/flutter_test.dart';
import 'package:peaches/domain/core/ids.dart';
import 'package:peaches/domain/exercises/exercise.dart';
import 'package:peaches/domain/exercises/exercise_catalog.dart';
import 'package:peaches/domain/exercises/taxonomy.dart';
import 'package:peaches/domain/models/training.dart';
import 'package:peaches/domain/models/workout.dart';
import 'package:peaches/domain/services/workout_generator.dart';

void main() {
  final catalog = ExerciseCatalog.standard();
  final bodyweight = catalog.performableWith(const {}).toList();
  final now = DateTime.utc(2026, 10, 10);

  WorkoutGenerator generator() =>
      WorkoutGenerator(ids: SequentialIdGenerator(prefix: 'w'));

  WorkoutRequest request({
    SessionFocus focus = SessionFocus.fullBody,
    TrainingGoal goal = TrainingGoal.generalFitness,
    int minutes = 40,
    double difficulty = 2,
    int maxDifficulty = 5,
    int seed = 1,
    List<Exercise>? pool,
  }) => WorkoutRequest(
    availableExercises: pool ?? bodyweight,
    focus: focus,
    goal: goal,
    durationMinutes: minutes,
    targetDifficulty: difficulty,
    maxDifficulty: maxDifficulty,
    seed: seed,
  );

  group('WorkoutGenerator', () {
    test('same seed and inputs reproduce the same workout', () {
      final a = generator().generate(request(seed: 99), now: now);
      final b = generator().generate(request(seed: 99), now: now);
      expect(a, b);
      expect(a.seed, 99);
      expect(a.generatorVersion, WorkoutGenerator.version);
    });

    test('different seeds produce different workouts', () {
      final a = generator().generate(request(), now: now);
      final b = generator().generate(request(seed: 2), now: now);
      expect(
        a.items.map((i) => i.exerciseId),
        isNot(b.items.map((i) => i.exerciseId)),
      );
    });

    test('blocks are ordered warm-up, strength, conditioning, cool-down', () {
      final w = generator().generate(request(), now: now);
      final types = w.blocks.map((b) => b.type).toList();
      expect(types.first, BlockType.warmUp);
      expect(types.last, BlockType.coolDown);
      expect(types, orderedEquals(types.toSet().toList()));
      for (var i = 1; i < types.length; i++) {
        expect(types[i].index, greaterThan(types[i - 1].index));
      }
    });

    test('warm-up and cool-down are not scored, main work is', () {
      final w = generator().generate(request(), now: now);
      for (final b in w.blocks) {
        for (final i in b.items) {
          if (b.type == BlockType.warmUp || b.type == BlockType.coolDown) {
            expect(i.isScored, isFalse, reason: i.exerciseId);
          } else {
            expect(i.isScored, isTrue, reason: i.exerciseId);
          }
        }
      }
      expect(w.scoredItems, isNotEmpty);
    });

    test('item ids are unique and workout id is set', () {
      final w = generator().generate(request(), now: now);
      final ids = w.items.map((i) => i.id).toList();
      expect(ids.toSet().length, ids.length);
      expect(w.id, isNotEmpty);
      expect(ids, isNot(contains(w.id)));
    });

    test('fits the time budget across durations and focuses', () {
      for (final minutes in [20, 30, 45, 60]) {
        for (final focus in SessionFocus.values) {
          for (var seed = 0; seed < 5; seed++) {
            final w = generator().generate(
              request(minutes: minutes, focus: focus, seed: seed),
              now: now,
            );
            expect(
              w.estimatedMinutes,
              lessThanOrEqualTo(minutes),
              reason: '$focus $minutes min seed $seed',
            );
            expect(w.estimatedMinutes, greaterThan(0));
          }
        }
      }
    });

    test('longer sessions carry more work', () {
      final short = generator().generate(request(minutes: 20), now: now);
      final long = generator().generate(request(minutes: 60), now: now);
      expect(long.items.length, greaterThan(short.items.length));
    });

    test('full-body strength block balances push and pull', () {
      for (var seed = 0; seed < 20; seed++) {
        final w = generator().generate(request(seed: seed), now: now);
        final patterns = w.blocks
            .firstWhere((b) => b.type == BlockType.strength)
            .items
            .map((i) => catalog.require(i.exerciseId).pattern)
            .toList();
        expect(patterns.where((p) => p.isPush).length, 1, reason: 'seed $seed');
        expect(patterns.where((p) => p.isPull).length, 1, reason: 'seed $seed');
        expect(
          patterns.any((p) => p.isLowerBody),
          isTrue,
          reason: 'seed $seed',
        );
        expect(patterns.any((p) => p.isCore), isTrue, reason: 'seed $seed');
      }
    });

    test('lower body focus has no upper-body pushing or pulling', () {
      for (var seed = 0; seed < 10; seed++) {
        final w = generator().generate(
          request(focus: SessionFocus.lowerBody, seed: seed),
          now: now,
        );
        final main = w.blocks.firstWhere((b) => b.type == BlockType.strength);
        for (final i in main.items) {
          final p = catalog.require(i.exerciseId).pattern;
          expect(p.isPush || p.isPull, isFalse, reason: i.exerciseId);
        }
      }
    });

    test('only prescribes from the available pool', () {
      final pool = catalog.performableWith({Equipment.dumbbell}).toList();
      final allowed = pool.map((e) => e.id).toSet();
      for (var seed = 0; seed < 10; seed++) {
        final w = generator().generate(
          request(pool: pool, seed: seed),
          now: now,
        );
        for (final i in w.items) {
          expect(allowed, contains(i.exerciseId));
        }
      }
    });

    test('respects the difficulty cap', () {
      final w = generator().generate(
        request(
          pool: catalog.all.toList(),
          difficulty: 1,
          maxDifficulty: 1,
          seed: 5,
        ),
        now: now,
      );
      for (final i in w.items) {
        expect(
          catalog.require(i.exerciseId).difficulty,
          1,
          reason: i.exerciseId,
        );
      }
    });

    test('degrades gracefully with a tiny pool', () {
      final tiny = catalog.byIds(['bw-air-squat', 'bw-push-up']).toList();
      final w = generator().generate(request(pool: tiny), now: now);
      expect(w.items.length, 2);
      expect(w.scoredItems.length, 2);
    });

    test('produces an empty but valid workout with an empty pool', () {
      final w = generator().generate(request(pool: const []), now: now);
      expect(w.blocks, isEmpty);
      expect(w.estimatedMinutes, 0);
    });

    test('loaded exercises carry RPE guidance', () {
      final pool = catalog.performableWith({
        Equipment.dumbbell,
        Equipment.bench,
      }).toList();
      final w = generator().generate(
        request(
          pool: pool,
          focus: SessionFocus.upperBody,
          goal: TrainingGoal.strength,
        ),
        now: now,
      );
      final loaded = w.blocks
          .firstWhere((b) => b.type == BlockType.strength)
          .items
          .where(
            (i) =>
                catalog.require(i.exerciseId).measurement ==
                MeasurementType.loadedReps,
          );
      expect(loaded, isNotEmpty);
      for (final i in loaded) {
        expect(i.prescription.load, isNotNull, reason: i.exerciseId);
      }
    });

    test('round-trips through JSON', () {
      final w = generator().generate(request(seed: 3), now: now);
      expect(Workout.fromJson(w.toJson()), w);
    });
  });
}
