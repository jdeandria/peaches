import '../exercises/exercise.dart';
import '../exercises/exercise_catalog.dart';
import '../models/capability.dart';
import '../models/crate.dart';

/// Derives the exercises available to a set of Peaches.
///
/// A Crate's pool is never stored: it is a pure function of its members'
/// capabilities and the Crate's settings, so it is always up to date and
/// can be computed for any subset of members (for instance the two Peaches
/// in a Matchup).
final class ExercisePoolService {
  const ExercisePoolService(this._catalog);

  final ExerciseCatalog _catalog;

  /// The ids a single Peach has declared they are able to do.
  Set<String> ableIdsOf(
    String peachId,
    Iterable<ExerciseCapability> capabilities,
  ) => {
    for (final c in capabilities)
      if (c.peachId == peachId && c.isAble) c.exerciseId,
  };

  /// The ids that *every* Peach in [peachIds] is able to do.
  ///
  /// Returns an empty set when [peachIds] is empty.
  Set<String> sharedIds(
    Iterable<String> peachIds,
    Iterable<ExerciseCapability> capabilities,
  ) {
    final capsList = capabilities.toList(growable: false);
    Set<String>? shared;
    for (final peachId in peachIds) {
      final able = ableIdsOf(peachId, capsList);
      shared = shared == null ? able : shared.intersection(able);
      if (shared.isEmpty) break;
    }
    return shared ?? const {};
  }

  /// Resolves ids to catalog exercises and applies Crate-level exclusions.
  ///
  /// Unknown ids (from a removed catalog entry) are dropped silently.
  List<Exercise> resolve(
    Iterable<String> exerciseIds, {
    CrateSettings settings = CrateSettings.defaults,
    int maxDifficulty = 5,
  }) => _catalog
      .byIds(exerciseIds)
      .where((e) => !settings.excludedExerciseIds.contains(e.id))
      .where((e) => e.difficulty <= maxDifficulty)
      .where((e) => !e.jointStress.any(settings.excludedJointStress.contains))
      .toList(growable: false);

  /// Convenience: the resolved pool for a group of Peaches.
  List<Exercise> poolFor(
    Iterable<String> peachIds,
    Iterable<ExerciseCapability> capabilities, {
    CrateSettings settings = CrateSettings.defaults,
    int maxDifficulty = 5,
  }) => resolve(
    sharedIds(peachIds, capabilities),
    settings: settings,
    maxDifficulty: maxDifficulty,
  );
}
