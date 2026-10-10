import 'package:equatable/equatable.dart';

import '../core/json.dart';

/// What was actually done in one set.
final class SetLog extends Equatable {
  const SetLog({this.reps, this.loadKg, this.seconds, this.meters})
    : assert(
        reps != null || seconds != null || meters != null,
        'A set must record reps, seconds or meters',
      );

  factory SetLog.fromJson(JsonMap json) => SetLog(
    reps: json['reps'] == null ? null : intFromJson(json['reps']),
    loadKg: json['loadKg'] == null ? null : doubleFromJson(json['loadKg']),
    seconds: json['seconds'] == null ? null : intFromJson(json['seconds']),
    meters: json['meters'] == null ? null : intFromJson(json['meters']),
  );

  final int? reps;
  final double? loadKg;
  final int? seconds;
  final int? meters;

  JsonMap toJson() => {
    'reps': reps,
    'loadKg': loadKg,
    'seconds': seconds,
    'meters': meters,
  };

  @override
  List<Object?> get props => [reps, loadKg, seconds, meters];
}

/// Everything logged against one exercise in a session.
///
/// [workoutItemId] links to a [WorkoutItem] when following a generated
/// workout; it is null for free-form logging.
final class ExerciseLogEntry extends Equatable {
  const ExerciseLogEntry({
    required this.exerciseId,
    required this.sets,
    this.workoutItemId,
    this.rpe,
    this.notes,
  }) : assert(rpe == null || (rpe >= 1 && rpe <= 10), 'rpe is 1..10');

  factory ExerciseLogEntry.fromJson(JsonMap json) => ExerciseLogEntry(
    exerciseId: json['exerciseId'] as String,
    workoutItemId: json['workoutItemId'] as String?,
    sets: mapListFromJson(json['sets'])
        .map(SetLog.fromJson)
        .toList(growable: false),
    rpe: json['rpe'] == null ? null : intFromJson(json['rpe']),
    notes: json['notes'] as String?,
  );

  final String exerciseId;
  final String? workoutItemId;
  final List<SetLog> sets;
  final int? rpe;
  final String? notes;

  int get totalReps => sets.fold(0, (sum, s) => sum + (s.reps ?? 0));
  int get totalSeconds => sets.fold(0, (sum, s) => sum + (s.seconds ?? 0));
  int get totalMeters => sets.fold(0, (sum, s) => sum + (s.meters ?? 0));

  /// Volume load in kg (reps x load), useful for progress tracking.
  double get volumeLoadKg =>
      sets.fold(0, (sum, s) => sum + (s.reps ?? 0) * (s.loadKg ?? 0));

  JsonMap toJson() => {
    'exerciseId': exerciseId,
    'workoutItemId': workoutItemId,
    'sets': sets.map((s) => s.toJson()).toList(),
    'rpe': rpe,
    'notes': notes,
  };

  @override
  List<Object?> get props => [exerciseId, workoutItemId, sets, rpe, notes];
}

enum WorkoutLogStatus { inProgress, submitted }

/// A Peach's record of a training session.
///
/// This is the single source of truth for "what I did". A log may be tied
/// to a Matchup (then it is scored) or stand alone (plain exercise logging).
final class WorkoutLog extends Equatable {
  const WorkoutLog({
    required this.id,
    required this.peachId,
    required this.startedAt,
    required this.entries,
    this.workoutId,
    this.matchupId,
    this.completedAt,
    this.status = WorkoutLogStatus.inProgress,
    this.notes,
  });

  factory WorkoutLog.fromJson(JsonMap json) => WorkoutLog(
    id: json['id'] as String,
    peachId: json['peachId'] as String,
    workoutId: json['workoutId'] as String?,
    matchupId: json['matchupId'] as String?,
    startedAt: dateTimeFromJson(json['startedAt']),
    completedAt: dateTimeOrNullFromJson(json['completedAt']),
    status: enumFromJson(
      WorkoutLogStatus.values,
      json['status'],
      fallback: WorkoutLogStatus.inProgress,
    ),
    entries: mapListFromJson(json['entries'])
        .map(ExerciseLogEntry.fromJson)
        .toList(growable: false),
    notes: json['notes'] as String?,
  );

  final String id;
  final String peachId;
  final String? workoutId;
  final String? matchupId;
  final DateTime startedAt;
  final DateTime? completedAt;
  final WorkoutLogStatus status;
  final List<ExerciseLogEntry> entries;
  final String? notes;

  bool get isSubmitted => status == WorkoutLogStatus.submitted;

  ExerciseLogEntry? entryForItem(String workoutItemId) {
    for (final entry in entries) {
      if (entry.workoutItemId == workoutItemId) return entry;
    }
    return null;
  }

  WorkoutLog copyWith({
    List<ExerciseLogEntry>? entries,
    DateTime? completedAt,
    WorkoutLogStatus? status,
    String? notes,
  }) => WorkoutLog(
    id: id,
    peachId: peachId,
    workoutId: workoutId,
    matchupId: matchupId,
    startedAt: startedAt,
    completedAt: completedAt ?? this.completedAt,
    status: status ?? this.status,
    entries: entries ?? this.entries,
    notes: notes ?? this.notes,
  );

  /// Returns a copy with [entry] replacing any existing entry for the same
  /// workout item (or exercise, for free logs).
  WorkoutLog upsertEntry(ExerciseLogEntry entry) {
    final next = [
      for (final e in entries)
        if (!_sameSlot(e, entry)) e,
      entry,
    ];
    return copyWith(entries: next);
  }

  static bool _sameSlot(ExerciseLogEntry a, ExerciseLogEntry b) =>
      a.workoutItemId != null
      ? a.workoutItemId == b.workoutItemId
      : b.workoutItemId == null && a.exerciseId == b.exerciseId;

  JsonMap toJson() => {
    'id': id,
    'peachId': peachId,
    'workoutId': workoutId,
    'matchupId': matchupId,
    'startedAt': dateTimeToJson(startedAt),
    'completedAt': completedAt == null ? null : dateTimeToJson(completedAt!),
    'status': status.name,
    'entries': entries.map((e) => e.toJson()).toList(),
    'notes': notes,
  };

  @override
  List<Object?> get props => [
    id,
    peachId,
    workoutId,
    matchupId,
    startedAt,
    completedAt,
    status,
    entries,
    notes,
  ];
}
