import 'dart:math';

import '../domain/core/ids.dart';
import '../domain/core/local_date.dart';
import '../domain/models/crate.dart';
import '../domain/models/peach.dart';
import '../domain/models/score.dart';
import '../domain/models/season.dart';
import '../domain/models/workout.dart';
import '../domain/models/workout_log.dart';
import '../domain/repositories/repositories.dart';
import '../domain/services/exercise_pool.dart';
import '../domain/services/round_robin_scheduler.dart';
import '../domain/services/scoring_service.dart';
import '../domain/services/standings_calculator.dart';
import '../domain/services/workout_generator.dart';
import 'crate_service.dart';

/// Season lifecycle: scheduling, opening rounds (generating workouts),
/// closing rounds (scoring) and standings.
final class SeasonService {
  const SeasonService({
    required this._seasons,
    required this._crates,
    required this._peaches,
    required this._capabilities,
    required this._workouts,
    required this._logs,
    required this._pool,
    required this._generator,
    required this._ids,
    this._scoring = const ScoringService(),
    this._standings = const StandingsCalculator(),
  });

  /// How many previous rounds count as "recent" for exercise variety.
  static const recentRoundWindow = 3;

  final SeasonRepository _seasons;
  final CrateRepository _crates;
  final PeachRepository _peaches;
  final CapabilityRepository _capabilities;
  final WorkoutRepository _workouts;
  final WorkoutLogRepository _logs;
  final ExercisePoolService _pool;
  final WorkoutGenerator _generator;
  final IdGenerator _ids;
  final ScoringService _scoring;
  final StandingsCalculator _standings;

  /// Creates and schedules a Season for every active member of [crate].
  Future<Season> createSeason({
    required Crate crate,
    required String name,
    required List<LocalDate> exerciseDays,
    required DateTime now,
  }) async {
    final days = exerciseDays.toSet().toList()..sort();
    if (days.isEmpty) {
      throw const DomainException('Pick at least one exercise day.');
    }
    final members = (await _crates.membershipsOf(
      crate.id,
    )).where((m) => m.isActive).map((m) => m.peachId).toList()..sort();
    if (members.isEmpty) {
      throw const DomainException('A Season needs at least one member.');
    }
    final season = Season(
      id: _ids.newId(),
      crateId: crate.id,
      name: name.trim().isEmpty ? 'Season' : name.trim(),
      exerciseDays: days,
      participantIds: members,
      status: SeasonStatus.scheduled,
      createdAt: now,
    );
    final schedule = RoundRobinScheduler(ids: _ids)
        .schedule(season, goal: crate.settings.goal);
    await _seasons.save(season);
    await _seasons.saveSchedule(schedule.rounds, schedule.matchups);
    return season;
  }

  /// Generates a workout for every matchup in the round that lacks one and
  /// marks the round open. Safe to call repeatedly.
  Future<Round> openRound({
    required String roundId,
    required DateTime now,
  }) async {
    final round = await _seasons.getRound(roundId);
    if (round == null) throw const DomainException('Round not found.');
    final season = await _seasons.getById(round.seasonId);
    final crate = season == null ? null : await _crates.getById(season.crateId);
    if (season == null || crate == null) {
      throw const DomainException('Season not found.');
    }

    final matchups = await _seasons.matchupsInRound(round.id);
    final recent = await _recentUse(season, round);
    for (final matchup in matchups) {
      if (matchup.workoutId != null) continue;
      final workout = await _generateFor(
        matchup: matchup,
        round: round,
        crate: crate,
        recentUse: recent,
        now: now,
      );
      await _workouts.save(workout);
      await _seasons.saveMatchup(
        matchup.copyWith(
          workoutId: workout.id,
          status: MatchupStatus.inProgress,
        ),
      );
    }

    final opened = round.copyWith(status: RoundStatus.open);
    await _seasons.saveRound(opened);
    if (season.status == SeasonStatus.scheduled) {
      await _seasons.save(season.copyWith(status: SeasonStatus.active));
    }
    return opened;
  }

  /// Scores every matchup in the round from the submitted logs and closes
  /// it. Completes the Season when its last round closes.
  Future<Round> closeRound({required String roundId}) async {
    final round = await _seasons.getRound(roundId);
    if (round == null) throw const DomainException('Round not found.');
    final season = await _seasons.getById(round.seasonId);
    final crate = season == null ? null : await _crates.getById(season.crateId);
    if (season == null || crate == null) {
      throw const DomainException('Season not found.');
    }

    for (final matchup in await _seasons.matchupsInRound(round.id)) {
      final workoutId = matchup.workoutId;
      final workout = workoutId == null
          ? null
          : await _workouts.getById(workoutId);
      if (workout == null) continue;
      final homeLog = await _submittedLog(matchup.id, matchup.homePeachId);
      final awayLog = matchup.awayPeachId == null
          ? null
          : await _submittedLog(matchup.id, matchup.awayPeachId!);
      await _seasons.saveMatchup(
        _scoring.resolve(
          matchup: matchup,
          workout: workout,
          homeLog: homeLog,
          awayLog: awayLog,
          rules: crate.settings.scoringRules,
        ),
      );
    }

    final closed = round.copyWith(status: RoundStatus.closed);
    await _seasons.saveRound(closed);
    final rounds = await _seasons.roundsOf(season.id);
    if (rounds.every((r) => r.status == RoundStatus.closed)) {
      await _seasons.save(season.copyWith(status: SeasonStatus.complete));
    }
    return closed;
  }

  /// Opens every round dated on or before [today] that is still scheduled.
  /// Used on app start so a Crate never has to "press go" on exercise day.
  Future<void> openDueRounds({
    required String seasonId,
    required LocalDate today,
    required DateTime now,
  }) async {
    for (final round in await _seasons.roundsOf(seasonId)) {
      if (round.status == RoundStatus.scheduled && !round.date.isAfter(today)) {
        await openRound(roundId: round.id, now: now);
      }
    }
  }

  Future<List<Standing>> standings(String seasonId) async {
    final season = await _seasons.getById(seasonId);
    if (season == null) return const [];
    return _standings.calculate(
      participantIds: season.participantIds,
      matchups: await _seasons.matchupsOf(seasonId),
    );
  }

  Future<Workout> _generateFor({
    required Matchup matchup,
    required Round round,
    required Crate crate,
    required Map<String, int> recentUse,
    required DateTime now,
  }) async {
    final peaches = await _peaches.getByIds(matchup.peachIds);
    final capabilities = await _capabilities.forPeaches(matchup.peachIds);
    final levels = peaches.map((p) => p.fitnessLevel).toList();
    final minLevel = levels.isEmpty ? 2 : levels.reduce(min);
    final meanLevel = levels.isEmpty
        ? 2.0
        : levels.fold(0, (a, b) => a + b) / levels.length;
    final maxDifficulty = (minLevel + 1).clamp(1, 5);

    final pool = _pool.poolFor(
      matchup.peachIds,
      capabilities,
      settings: crate.settings,
      maxDifficulty: maxDifficulty,
    );

    return _generator.generate(
      WorkoutRequest(
        availableExercises: pool,
        focus: round.focus,
        goal: crate.settings.goal,
        durationMinutes: crate.settings.workoutDurationMinutes,
        targetDifficulty: meanLevel.clamp(1, 5),
        maxDifficulty: maxDifficulty,
        seed: _seedFor(matchup, round),
        recentUse: recentUse,
        title: 'Round ${round.index + 1}',
      ),
      now: now,
    );
  }

  /// A stable seed per matchup so re-opening a round (after a crash, say)
  /// regenerates the identical workout.
  static int _seedFor(Matchup matchup, Round round) =>
      Object.hash(matchup.id, round.id, round.index) & 0x7fffffff;

  /// exerciseId -> rounds ago, looking back [recentRoundWindow] rounds
  /// across every workout in the Season (the whole Crate shares variety).
  Future<Map<String, int>> _recentUse(Season season, Round round) async {
    final rounds = await _seasons.roundsOf(season.id);
    final previous = rounds
        .where((r) => r.index < round.index)
        .where((r) => round.index - r.index <= recentRoundWindow)
        .toList();
    final result = <String, int>{};
    for (final r in previous) {
      final ago = round.index - r.index - 1;
      final ids = (await _seasons.matchupsInRound(r.id))
          .map((m) => m.workoutId)
          .nonNulls;
      for (final workout in await _workouts.getByIds(ids)) {
        for (final item in workout.items) {
          final existing = result[item.exerciseId];
          if (existing == null || ago < existing) result[item.exerciseId] = ago;
        }
      }
    }
    return result;
  }

  Future<WorkoutLog?> _submittedLog(String matchupId, String peachId) async {
    final log = await _logs.forMatchup(matchupId, peachId);
    return log == null || !log.isSubmitted ? null : log;
  }
}

/// Difficulty helpers shared with the UI.
extension PeachDifficulty on Peach {
  String get fitnessLevelLabel => switch (fitnessLevel) {
    1 => 'Getting started',
    2 => 'Regular mover',
    3 => 'Fit',
    4 => 'Athletic',
    _ => 'Advanced',
  };
}
