import '../domain/core/ids.dart';
import '../domain/models/score.dart';
import '../domain/models/scoring_rules.dart';
import '../domain/models/season.dart';
import '../domain/models/workout_log.dart';
import '../domain/repositories/repositories.dart';
import '../domain/services/round_window.dart';
import '../domain/services/scoring_service.dart';
import 'crate_service.dart';

/// Recording what a Peach did: against a Matchup's workout or free-form.
final class LoggingService {
  const LoggingService({
    required this._logs,
    required this._workouts,
    required this._ids,
    required this._seasons,
    required this._crates,
    required this._windows,
    this._scoring = const ScoringService(),
  });

  final WorkoutLogRepository _logs;
  final WorkoutRepository _workouts;
  final IdGenerator _ids;
  final SeasonRepository _seasons;
  final CrateRepository _crates;
  final RoundWindowService _windows;
  final ScoringService _scoring;

  /// Returns the Peach's log for the matchup, creating it on first use.
  Future<WorkoutLog> logForMatchup({
    required Matchup matchup,
    required String peachId,
    required DateTime now,
  }) async {
    if (!matchup.involves(peachId)) {
      throw const DomainException('You are not part of this matchup.');
    }
    if (matchup.workoutId == null) {
      throw const DomainException('This round has not opened yet.');
    }
    final existing = await _logs.forMatchup(matchup.id, peachId);
    if (existing != null) return existing;
    final log = WorkoutLog(
      id: _ids.newId(),
      peachId: peachId,
      workoutId: matchup.workoutId,
      matchupId: matchup.id,
      startedAt: now,
      entries: const [],
    );
    await _logs.save(log);
    return log;
  }

  Future<WorkoutLog> startFreeLog({
    required String peachId,
    required DateTime now,
  }) async {
    final log = WorkoutLog(
      id: _ids.newId(),
      peachId: peachId,
      startedAt: now,
      entries: const [],
    );
    await _logs.save(log);
    return log;
  }

  /// Adds or replaces the entry for one exercise / workout item.
  Future<WorkoutLog> recordEntry({
    required String logId,
    required ExerciseLogEntry entry,
  }) async {
    final log = await _requireEditable(logId);
    final updated = log.upsertEntry(entry);
    await _logs.save(updated);
    return updated;
  }

  Future<WorkoutLog> submit({
    required String logId,
    required DateTime now,
    String? notes,
  }) async {
    final log = await _requireEditable(logId);
    if (log.matchupId != null && !await _windowOpen(log.matchupId!, now)) {
      throw const DomainException(
        'The logging window for this round has closed.',
      );
    }
    final submitted = log.copyWith(
      status: WorkoutLogStatus.submitted,
      completedAt: now,
      notes: notes,
    );
    await _logs.save(submitted);
    return submitted;
  }

  /// Live score for a log against its workout (zero for free logs).
  Future<WorkoutScore> scoreFor(
    WorkoutLog log, {
    ScoringRules rules = ScoringRules.standard,
  }) async {
    final workoutId = log.workoutId;
    final workout = workoutId == null
        ? null
        : await _workouts.getById(workoutId);
    if (workout == null) return WorkoutScore.zero;
    return _scoring.score(workout: workout, log: log, rules: rules);
  }

  Future<bool> _windowOpen(String matchupId, DateTime now) async {
    final matchup = await _seasons.getMatchup(matchupId);
    final round = matchup == null
        ? null
        : await _seasons.getRound(matchup.roundId);
    final season = round == null
        ? null
        : await _seasons.getById(round.seasonId);
    final crate = season == null ? null : await _crates.getById(season.crateId);
    if (round == null || crate == null) return false;
    return _windows.windowFor(round, crate).isOpenAt(now);
  }

  Future<WorkoutLog> _requireEditable(String logId) async {
    final log = await _logs.getById(logId);
    if (log == null) throw const DomainException('Workout log not found.');
    if (log.isSubmitted) {
      throw const DomainException('This workout has already been submitted.');
    }
    return log;
  }
}
