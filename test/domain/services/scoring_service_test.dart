import 'package:flutter_test/flutter_test.dart';
import 'package:peaches/domain/models/score.dart';
import 'package:peaches/domain/models/scoring_rules.dart';
import 'package:peaches/domain/models/season.dart';
import 'package:peaches/domain/models/training.dart';
import 'package:peaches/domain/models/workout.dart';
import 'package:peaches/domain/models/workout_log.dart';
import 'package:peaches/domain/services/scoring_service.dart';

void main() {
  const service = ScoringService();
  final now = DateTime.utc(2026);

  final workout = Workout(
    id: 'w',
    blocks: const [
      WorkoutBlock(
        type: BlockType.warmUp,
        items: [
          WorkoutItem(
            id: 'warm',
            exerciseId: 'mob-cat-cow',
            prescription: Prescription(sets: 1, reps: 10, restSeconds: 0),
            scoringWeight: 0,
          ),
        ],
      ),
      WorkoutBlock(
        type: BlockType.strength,
        items: [
          WorkoutItem(
            id: 'squat',
            exerciseId: 'bw-air-squat',
            prescription: Prescription(sets: 3, reps: 10, restSeconds: 60),
          ),
          WorkoutItem(
            id: 'plank',
            exerciseId: 'bw-side-plank',
            prescription: Prescription(
              sets: 2,
              seconds: 30,
              restSeconds: 30,
              perSide: true,
            ),
            scoringWeight: 0.5,
          ),
          WorkoutItem(
            id: 'carry',
            exerciseId: 'db-farmer-carry',
            prescription: Prescription(sets: 2, meters: 40, restSeconds: 60),
          ),
        ],
      ),
    ],
    focus: SessionFocus.fullBody,
    goal: TrainingGoal.generalFitness,
    targetDifficulty: 2,
    estimatedMinutes: 20,
    seed: 0,
    generatorVersion: 1,
    createdAt: now,
  );

  WorkoutLog log(List<ExerciseLogEntry> entries) => WorkoutLog(
    id: 'l',
    peachId: 'p',
    workoutId: 'w',
    startedAt: now,
    entries: entries,
    status: WorkoutLogStatus.submitted,
  );

  group('ScoringService.score', () {
    test('full completion earns all item points plus the bonus', () {
      final s = service.score(
        workout: workout,
        log: log(const [
          ExerciseLogEntry(
            exerciseId: 'bw-air-squat',
            workoutItemId: 'squat',
            sets: [SetLog(reps: 10), SetLog(reps: 10), SetLog(reps: 10)],
          ),
          ExerciseLogEntry(
            exerciseId: 'bw-side-plank',
            workoutItemId: 'plank',
            sets: [
              SetLog(seconds: 30),
              SetLog(seconds: 30),
              SetLog(seconds: 30),
              SetLog(seconds: 30),
            ],
          ),
          ExerciseLogEntry(
            exerciseId: 'db-farmer-carry',
            workoutItemId: 'carry',
            sets: [SetLog(meters: 40), SetLog(meters: 40)],
          ),
        ]),
      );
      expect(s.items.length, 3);
      expect(s.itemPoints, 10 + 5 + 10);
      expect(s.completionBonus, ScoringRules.standard.completionBonus);
      expect(s.total, 35);
    });

    test('partial completion scores proportionally with no bonus', () {
      final s = service.score(
        workout: workout,
        log: log(const [
          ExerciseLogEntry(
            exerciseId: 'bw-air-squat',
            workoutItemId: 'squat',
            sets: [SetLog(reps: 10), SetLog(reps: 5)],
          ),
          ExerciseLogEntry(
            exerciseId: 'bw-side-plank',
            workoutItemId: 'plank',
            sets: [
              SetLog(seconds: 30),
              SetLog(seconds: 30),
              SetLog(seconds: 30),
              SetLog(seconds: 30),
            ],
          ),
          ExerciseLogEntry(
            exerciseId: 'db-farmer-carry',
            workoutItemId: 'carry',
            sets: [SetLog(meters: 40), SetLog(meters: 40)],
          ),
        ]),
      );
      final squat = s.items.firstWhere((i) => i.workoutItemId == 'squat');
      expect(squat.achievementRatio, 0.5);
      expect(squat.points, 5);
      expect(s.completionBonus, 0);
      expect(s.total, 20);
    });

    test('over-achievement is capped by the rules', () {
      final s = service.score(
        workout: workout,
        log: log(const [
          ExerciseLogEntry(
            exerciseId: 'bw-air-squat',
            workoutItemId: 'squat',
            sets: [SetLog(reps: 100)],
          ),
        ]),
      );
      final squat = s.items.firstWhere((i) => i.workoutItemId == 'squat');
      expect(squat.achievementRatio, ScoringRules.standard.maxAchievementRatio);
      expect(squat.points, 12.5);
    });

    test('missing log scores zero', () {
      final s = service.score(workout: workout, log: null);
      expect(s.total, 0);
      expect(s.items.every((i) => i.points == 0), isTrue);
    });

    test('free-form entries without an item id do not count', () {
      final s = service.score(
        workout: workout,
        log: log(const [
          ExerciseLogEntry(
            exerciseId: 'bw-air-squat',
            sets: [SetLog(reps: 30)],
          ),
        ]),
      );
      expect(s.total, 0);
    });

    test('custom rules are honoured', () {
      final s = service.score(
        workout: workout,
        log: log(const [
          ExerciseLogEntry(
            exerciseId: 'bw-air-squat',
            workoutItemId: 'squat',
            sets: [SetLog(reps: 27)],
          ),
          ExerciseLogEntry(
            exerciseId: 'bw-side-plank',
            workoutItemId: 'plank',
            sets: [SetLog(seconds: 120)],
          ),
          ExerciseLogEntry(
            exerciseId: 'db-farmer-carry',
            workoutItemId: 'carry',
            sets: [SetLog(meters: 80)],
          ),
        ]),
        rules: const ScoringRules(
          pointsPerItem: 20,
          completionBonus: 3,
          completionThreshold: 0.9,
        ),
      );
      expect(s.items.firstWhere((i) => i.workoutItemId == 'squat').points, 18);
      expect(s.completionBonus, 3);
    });

    test('a workout with no scored items scores zero', () {
      final warmOnly = Workout(
        id: 'x',
        blocks: workout.blocks.take(1).toList(),
        focus: SessionFocus.fullBody,
        goal: TrainingGoal.generalFitness,
        targetDifficulty: 1,
        estimatedMinutes: 2,
        seed: 0,
        generatorVersion: 1,
        createdAt: now,
      );
      expect(
        service.score(workout: warmOnly, log: log(const [])),
        WorkoutScore.zero,
      );
    });
  });

  group('ScoringService.resolve', () {
    const matchup = Matchup(
      id: 'm',
      seasonId: 's',
      roundId: 'r',
      homePeachId: 'home',
      awayPeachId: 'away',
    );

    test('resolves a matchup from both logs', () {
      final resolved = service.resolve(
        matchup: matchup,
        workout: workout,
        homeLog: log(const [
          ExerciseLogEntry(
            exerciseId: 'bw-air-squat',
            workoutItemId: 'squat',
            sets: [SetLog(reps: 30)],
          ),
        ]),
        awayLog: null,
      );
      expect(resolved.status, MatchupStatus.complete);
      expect(
        resolved.result,
        const MatchupResult(homePoints: 10, awayPoints: 0),
      );
      expect(resolved.winnerId, 'home');
    });

    test('a bye records points-for only', () {
      final resolved = service.resolve(
        matchup: const Matchup(
          id: 'm',
          seasonId: 's',
          roundId: 'r',
          homePeachId: 'home',
        ),
        workout: workout,
        homeLog: log(const [
          ExerciseLogEntry(
            exerciseId: 'bw-air-squat',
            workoutItemId: 'squat',
            sets: [SetLog(reps: 30)],
          ),
        ]),
        awayLog: null,
      );
      expect(resolved.result?.homePoints, 10);
      expect(resolved.result?.awayPoints, 0);
      expect(resolved.winnerId, isNull);
    });
  });
}
