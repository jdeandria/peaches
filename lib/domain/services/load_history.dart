import '../models/workout_log.dart';

/// Looks up the weights a Peach used last time on an exercise, so the set
/// logger can start from them instead of a blank field.
abstract final class LoadHistory {
  /// Per-set loads (kg) from the most recent log containing [exerciseId]
  /// with at least one recorded weight, or null if there is none.
  /// [excludingLogId] skips the log currently being edited.
  static List<double>? lastLoadsKg(
    Iterable<WorkoutLog> logs,
    String exerciseId, {
    String? excludingLogId,
  }) {
    final ordered = logs.where((l) => l.id != excludingLogId).toList()
      ..sort(
        (a, b) => (b.completedAt ?? b.startedAt).compareTo(
          a.completedAt ?? a.startedAt,
        ),
      );
    for (final log in ordered) {
      for (final entry in log.entries) {
        if (entry.exerciseId != exerciseId) continue;
        final loads = entry.sets.map((s) => s.loadKg).nonNulls.toList();
        if (loads.isNotEmpty) return loads;
      }
    }
    return null;
  }

  /// The heaviest load recorded in [entry], or null.
  static double? topLoadKg(ExerciseLogEntry entry) {
    final loads = entry.sets.map((s) => s.loadKg).nonNulls;
    return loads.isEmpty ? null : loads.reduce((a, b) => a > b ? a : b);
  }
}
