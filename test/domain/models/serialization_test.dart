import 'package:flutter_test/flutter_test.dart';
import 'package:peaches/domain/core/local_date.dart';
import 'package:peaches/domain/exercises/taxonomy.dart';
import 'package:peaches/domain/models/capability.dart';
import 'package:peaches/domain/models/crate.dart';
import 'package:peaches/domain/models/peach.dart';
import 'package:peaches/domain/models/scoring_rules.dart';
import 'package:peaches/domain/models/season.dart';
import 'package:peaches/domain/models/training.dart';
import 'package:peaches/domain/models/workout.dart';
import 'package:peaches/domain/models/workout_log.dart';

void main() {
  final now = DateTime.utc(2026, 10, 10, 12);

  group('model JSON round trips', () {
    test('Peach', () {
      final p = Peach(
        id: 'p1',
        displayName: 'Ada',
        email: 'ada@example.com',
        fitnessLevel: 4,
        timeZone: 'Europe/London',
        units: UnitSystem.imperial,
        createdAt: now,
      );
      expect(Peach.fromJson(p.toJson()), p);
    });

    test('ExerciseCapability', () {
      final c = ExerciseCapability(
        peachId: 'p1',
        exerciseId: 'bw-push-up',
        status: CapabilityStatus.unable,
        updatedAt: now,
        notes: 'wrist',
      );
      expect(ExerciseCapability.fromJson(c.toJson()), c);
    });

    test('Crate with settings and scoring rules', () {
      final crate = Crate(
        id: 'c1',
        name: 'Morning Crew',
        ownerPeachId: 'p1',
        inviteCode: 'PEACH1',
        timeZone: 'America/New_York',
        settings: const CrateSettings(
          workoutDurationMinutes: 30,
          goal: TrainingGoal.endurance,
          scoringRules: ScoringRules(completionBonus: 5),
          loggingGraceHours: 12,
          excludedExerciseIds: {'bw-burpee'},
          excludedJointStress: {JointStress.knee},
        ),
        createdAt: now,
      );
      expect(Crate.fromJson(crate.toJson()), crate);
    });

    test('Crate falls back to defaults for missing settings', () {
      final crate = Crate.fromJson({
        'id': 'c1',
        'name': 'x',
        'ownerPeachId': 'p1',
        'inviteCode': 'ABC',
        'createdAt': now.toIso8601String(),
      });
      expect(crate.settings, CrateSettings.defaults);
      expect(crate.timeZone, 'UTC');
    });

    test('CrateMembership', () {
      final m = CrateMembership(
        crateId: 'c1',
        peachId: 'p1',
        role: CrateRole.admin,
        status: MembershipStatus.invited,
        joinedAt: now,
      );
      expect(CrateMembership.fromJson(m.toJson()), m);
      expect(m.canManage, isTrue);
      expect(m.isActive, isFalse);
    });

    test('Season, Round and Matchup', () {
      final season = Season(
        id: 's1',
        crateId: 'c1',
        name: 'Autumn',
        exerciseDays: const [LocalDate(2026, 10, 12), LocalDate(2026, 10, 14)],
        participantIds: const ['p1', 'p2', 'p3'],
        status: SeasonStatus.active,
        createdAt: now,
      );
      expect(Season.fromJson(season.toJson()), season);
      expect(season.startDate, const LocalDate(2026, 10, 12));
      expect(season.endDate, const LocalDate(2026, 10, 14));

      const round = Round(
        id: 'r1',
        seasonId: 's1',
        index: 0,
        date: LocalDate(2026, 10, 12),
        focus: SessionFocus.lowerBody,
        status: RoundStatus.open,
      );
      expect(Round.fromJson(round.toJson()), round);

      const matchup = Matchup(
        id: 'm1',
        seasonId: 's1',
        roundId: 'r1',
        homePeachId: 'p1',
        awayPeachId: 'p2',
        workoutId: 'w1',
        status: MatchupStatus.complete,
        result: MatchupResult(homePoints: 55.5, awayPoints: 40),
      );
      expect(Matchup.fromJson(matchup.toJson()), matchup);
      expect(matchup.winnerId, 'p1');
      expect(matchup.opponentOf('p2'), 'p1');
      expect(matchup.opponentOf('p9'), isNull);

      const bye = Matchup(
        id: 'm2',
        seasonId: 's1',
        roundId: 'r1',
        homePeachId: 'p3',
        result: MatchupResult(homePoints: 30, awayPoints: 0),
      );
      expect(Matchup.fromJson(bye.toJson()), bye);
      expect(bye.isBye, isTrue);
      expect(bye.winnerId, isNull);
      expect(bye.peachIds, ['p3']);
    });

    test('Workout with nested blocks and prescriptions', () {
      final workout = Workout(
        id: 'w1',
        title: 'Round 1',
        blocks: const [
          WorkoutBlock(
            type: BlockType.strength,
            items: [
              WorkoutItem(
                id: 'i1',
                exerciseId: 'db-goblet-squat',
                prescription: Prescription(
                  sets: 3,
                  reps: 10,
                  restSeconds: 60,
                  load: LoadGuidance(rpe: 7, note: 'Moderate'),
                ),
              ),
              WorkoutItem(
                id: 'i2',
                exerciseId: 'bw-side-plank',
                prescription: Prescription(
                  sets: 2,
                  seconds: 30,
                  restSeconds: 30,
                  perSide: true,
                ),
                scoringWeight: 0.5,
              ),
            ],
          ),
        ],
        focus: SessionFocus.fullBody,
        goal: TrainingGoal.generalFitness,
        targetDifficulty: 2.5,
        estimatedMinutes: 12,
        seed: 42,
        generatorVersion: 1,
        createdAt: now,
      );
      expect(Workout.fromJson(workout.toJson()), workout);
      expect(workout.itemById('i2')?.prescription.totalTarget, 120);
      expect(workout.itemById('i1')?.prescription.totalTarget, 30);
      expect(workout.itemById('zz'), isNull);
    });

    test('Prescription enforces exactly one unit', () {
      expect(
        () => Prescription(sets: 1, restSeconds: 0, reps: 5, seconds: 5),
        throwsA(isA<AssertionError>()),
      );
      expect(
        () => Prescription(sets: 1, restSeconds: 0),
        throwsA(isA<AssertionError>()),
      );
    });

    test('WorkoutLog and entries', () {
      final log = WorkoutLog(
        id: 'l1',
        peachId: 'p1',
        workoutId: 'w1',
        matchupId: 'm1',
        startedAt: now,
        completedAt: now.add(const Duration(minutes: 40)),
        status: WorkoutLogStatus.submitted,
        entries: const [
          ExerciseLogEntry(
            exerciseId: 'db-goblet-squat',
            workoutItemId: 'i1',
            sets: [
              SetLog(reps: 10, loadKg: 16),
              SetLog(reps: 10, loadKg: 16),
              SetLog(reps: 8, loadKg: 16),
            ],
            rpe: 8,
          ),
        ],
        notes: 'Felt good',
      );
      expect(WorkoutLog.fromJson(log.toJson()), log);
      expect(log.entries.single.totalReps, 28);
      expect(log.entries.single.volumeLoadKg, 448);
    });

    test('WorkoutLog.upsertEntry replaces the entry for the same item', () {
      final log = WorkoutLog(
        id: 'l1',
        peachId: 'p1',
        startedAt: now,
        entries: const [
          ExerciseLogEntry(
            exerciseId: 'a',
            workoutItemId: 'i1',
            sets: [SetLog(reps: 1)],
          ),
          ExerciseLogEntry(exerciseId: 'b', sets: [SetLog(reps: 1)]),
        ],
      );
      final updated = log
          .upsertEntry(
            const ExerciseLogEntry(
              exerciseId: 'a',
              workoutItemId: 'i1',
              sets: [SetLog(reps: 9)],
            ),
          )
          .upsertEntry(
            const ExerciseLogEntry(exerciseId: 'b', sets: [SetLog(reps: 7)]),
          );
      expect(updated.entries.length, 2);
      expect(updated.entryForItem('i1')?.totalReps, 9);
      expect(
        updated.entries.firstWhere((e) => e.exerciseId == 'b').totalReps,
        7,
      );
    });
  });
}
