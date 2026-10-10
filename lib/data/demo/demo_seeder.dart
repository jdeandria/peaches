import 'dart:math';

import '../../application/capability_service.dart';
import '../../application/crate_service.dart';
import '../../application/logging_service.dart';
import '../../application/season_service.dart';
import '../../domain/core/local_date.dart';
import '../../domain/exercises/taxonomy.dart';
import '../../domain/models/crate.dart';
import '../../domain/models/peach.dart';
import '../../domain/models/season.dart';
import '../../domain/models/training.dart';
import '../../domain/models/workout_log.dart';
import '../../domain/repositories/repositories.dart';
import '../../domain/services/round_robin_scheduler.dart';

/// Populates the in-memory backend with a believable Crate mid-season so
/// the app is explorable without a server. Also used by integration tests.
final class DemoSeeder {
  const DemoSeeder({
    required this._peaches,
    required this._workouts,
    required this._logs,
    required this._seasons,
    required this._crateService,
    required this._seasonService,
    required this._capabilityService,
    required this._loggingService,
  });

  static const currentPeachId = 'me';

  final PeachRepository _peaches;
  final WorkoutRepository _workouts;
  final WorkoutLogRepository _logs;
  final SeasonRepository _seasons;
  final CrateService _crateService;
  final SeasonService _seasonService;
  final CapabilityService _capabilityService;
  final LoggingService _loggingService;

  Future<void> seed({required DateTime now}) async {
    final today = LocalDate.of(now);
    final created = now.subtract(const Duration(days: 30));

    final roster = [
      Peach(
        id: currentPeachId,
        displayName: 'You',
        fitnessLevel: 3,
        createdAt: created,
      ),
      Peach(id: 'ada', displayName: 'Ada', fitnessLevel: 4, createdAt: created),
      Peach(id: 'ben', displayName: 'Ben', createdAt: created),
      Peach(id: 'cho', displayName: 'Cho', fitnessLevel: 3, createdAt: created),
      Peach(id: 'dev', displayName: 'Dev', createdAt: created),
    ];
    for (final p in roster) {
      await _peaches.save(p);
    }

    // Everyone can do easy bodyweight work; some have dumbbells or a bar.
    for (final p in roster) {
      await _capabilityService.enableForEquipment(
        peachId: p.id,
        equipment: const {Equipment.wall, Equipment.chair},
        maxDifficulty: p.fitnessLevel,
        now: created,
      );
    }
    for (final id in const [currentPeachId, 'ada', 'cho']) {
      await _capabilityService.enableForEquipment(
        peachId: id,
        equipment: const {
          Equipment.dumbbell,
          Equipment.bench,
          Equipment.resistanceBand,
        },
        maxDifficulty: 3,
        now: created,
      );
    }
    await _capabilityService.enableForEquipment(
      peachId: 'ada',
      equipment: const {Equipment.pullUpBar, Equipment.kettlebell},
      maxDifficulty: 4,
      now: created,
    );

    final crate = await _crateService.createCrate(
      ownerPeachId: 'ada',
      name: 'Weekend Warriors',
      description: 'Mon / Wed / Fri, forty minutes, no excuses.',
      now: created,
    );
    for (final id in const [currentPeachId, 'ben', 'cho', 'dev']) {
      await _crateService.joinByInviteCode(
        inviteCode: crate.inviteCode,
        peachId: id,
        now: created,
      );
    }

    // A second, smaller crate so the multi-crate case is visible.
    final second = await _crateService.createCrate(
      ownerPeachId: currentPeachId,
      name: 'Lunch Break Lifters',
      description: 'Tuesdays and Thursdays at noon.',
      now: created,
      settings: const CrateSettings(
        workoutDurationMinutes: 30,
        goal: TrainingGoal.strength,
      ),
    );
    await _crateService.joinByInviteCode(
      inviteCode: second.inviteCode,
      peachId: 'cho',
      now: created,
    );

    // Season: Mon/Wed/Fri, starting ten days ago, for four weeks.
    const planner = ExerciseDayPlanner();
    final start = today.addDays(-10);
    final days = planner.weekdaysBetween(start, start.addDays(27), {
      DateTime.monday,
      DateTime.wednesday,
      DateTime.friday,
    });
    final season = await _seasonService.createSeason(
      crate: crate,
      name: 'Autumn Kick-off',
      exerciseDays: days,
      now: created,
    );

    // Play out past rounds with plausible logs, open today's round if any.
    final random = Random(2026);
    for (final round in await _seasons.roundsOf(season.id)) {
      if (round.date.isAfter(today)) break;
      await _seasonService.openRound(roundId: round.id, now: now);
      if (round.date == today) break;
      for (final matchup in await _seasons.matchupsInRound(round.id)) {
        for (final peachId in matchup.peachIds) {
          await _logPlausibly(matchup, peachId, random, now);
        }
      }
      await _seasonService.closeRound(roundId: round.id);
    }

    final second2 = await _seasonService.createSeason(
      crate: second,
      name: 'Strength Block 1',
      exerciseDays: planner.weekdaysBetween(
        today.addDays(1),
        today.addDays(21),
        {DateTime.tuesday, DateTime.thursday},
      ),
      now: now,
    );
    assert(second2.status == SeasonStatus.scheduled);
  }

  Future<void> _logPlausibly(
    Matchup matchup,
    String peachId,
    Random random,
    DateTime now,
  ) async {
    final workout = await _workouts.getById(matchup.workoutId!);
    if (workout == null) return;
    // Some Peaches skip a round entirely.
    if (random.nextDouble() < 0.12) return;
    final log = await _loggingService.logForMatchup(
      matchup: matchup,
      peachId: peachId,
      now: now,
    );
    for (final item in workout.items) {
      final p = item.prescription;
      final effort = 0.6 + random.nextDouble() * 0.6;
      final sides = p.perSide ? 2 : 1;
      final sets = [
        for (var s = 0; s < p.sets * sides; s++)
          SetLog(
            reps: p.reps == null ? null : (p.reps! * effort).round(),
            seconds: p.seconds == null ? null : (p.seconds! * effort).round(),
            meters: p.meters == null ? null : (p.meters! * effort).round(),
            loadKg: p.load == null ? null : 8.0 + random.nextInt(4) * 2,
          ),
      ];
      await _loggingService.recordEntry(
        logId: log.id,
        entry: ExerciseLogEntry(
          exerciseId: item.exerciseId,
          workoutItemId: item.id,
          sets: sets,
          rpe: 5 + random.nextInt(5),
        ),
      );
    }
    await _loggingService.submit(logId: log.id, now: now);
    assert((await _logs.getById(log.id))?.isSubmitted ?? false);
  }
}
