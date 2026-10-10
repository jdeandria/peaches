import 'package:flutter_test/flutter_test.dart';
import 'package:peaches/domain/exercises/exercise_catalog.dart';
import 'package:peaches/domain/exercises/taxonomy.dart';
import 'package:peaches/domain/models/capability.dart';
import 'package:peaches/domain/models/crate.dart';
import 'package:peaches/domain/services/exercise_pool.dart';

void main() {
  final catalog = ExerciseCatalog.standard();
  final service = ExercisePoolService(catalog);
  final now = DateTime.utc(2026);

  ExerciseCapability able(String peach, String exercise) => ExerciseCapability(
    peachId: peach,
    exerciseId: exercise,
    status: CapabilityStatus.able,
    updatedAt: now,
  );
  ExerciseCapability unable(String peach, String exercise) =>
      ExerciseCapability(
        peachId: peach,
        exerciseId: exercise,
        status: CapabilityStatus.unable,
        updatedAt: now,
      );

  final caps = [
    able('p1', 'bw-push-up'),
    able('p1', 'bw-air-squat'),
    able('p1', 'bw-pull-up'),
    unable('p1', 'bw-burpee'),
    able('p2', 'bw-push-up'),
    able('p2', 'bw-air-squat'),
    able('p2', 'bw-burpee'),
    able('p3', 'bw-air-squat'),
  ];

  group('ExercisePoolService', () {
    test('ableIdsOf returns only able exercises for that Peach', () {
      expect(service.ableIdsOf('p1', caps), {
        'bw-push-up',
        'bw-air-squat',
        'bw-pull-up',
      });
      expect(service.ableIdsOf('nobody', caps), isEmpty);
    });

    test('sharedIds is the intersection across Peaches', () {
      expect(service.sharedIds(['p1', 'p2'], caps), {
        'bw-push-up',
        'bw-air-squat',
      });
      expect(service.sharedIds(['p1', 'p2', 'p3'], caps), {'bw-air-squat'});
      expect(service.sharedIds(['p1'], caps), service.ableIdsOf('p1', caps));
      expect(service.sharedIds(const [], caps), isEmpty);
    });

    test('resolve drops unknown ids and applies crate exclusions', () {
      final pool = service.resolve([
        'bw-push-up',
        'ghost',
        'bw-air-squat',
        'bw-pull-up',
      ], settings: const CrateSettings(excludedExerciseIds: {'bw-pull-up'}));
      expect(pool.map((e) => e.id), ['bw-push-up', 'bw-air-squat']);
    });

    test('resolve honours joint-stress exclusions and difficulty cap', () {
      final pool = service.resolve(
        ['bw-push-up', 'bw-air-squat', 'bw-pistol-squat', 'bw-glute-bridge'],
        settings: const CrateSettings(excludedJointStress: {JointStress.knee}),
        maxDifficulty: 3,
      );
      // push-up stresses wrist/shoulder only; squats stress the knee;
      // glute bridge has no joint flags.
      expect(pool.map((e) => e.id), ['bw-push-up', 'bw-glute-bridge']);
    });

    test('poolFor composes intersection and resolution', () {
      final pool = service.poolFor(['p1', 'p2'], caps);
      expect(pool.map((e) => e.id).toSet(), {'bw-push-up', 'bw-air-squat'});
    });
  });
}
