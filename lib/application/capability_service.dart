import '../domain/exercises/exercise_catalog.dart';
import '../domain/exercises/taxonomy.dart';
import '../domain/models/capability.dart';
import '../domain/repositories/repositories.dart';

/// Maintains a Peach's "I can do this" declarations.
final class CapabilityService {
  const CapabilityService({
    required this._capabilities,
    required this._catalog,
  });

  final CapabilityRepository _capabilities;
  final ExerciseCatalog _catalog;

  Future<void> setAble({
    required String peachId,
    required String exerciseId,
    required bool able,
    required DateTime now,
  }) => _capabilities.save(
    ExerciseCapability(
      peachId: peachId,
      exerciseId: exerciseId,
      status: able ? CapabilityStatus.able : CapabilityStatus.unable,
      updatedAt: now,
    ),
  );

  /// Marks every catalog exercise performable with [equipment] and at or
  /// below [maxDifficulty] as able. A quick-start for new Peaches.
  Future<int> enableForEquipment({
    required String peachId,
    required Set<Equipment> equipment,
    required int maxDifficulty,
    required DateTime now,
  }) async {
    final exercises = _catalog
        .performableWith(equipment)
        .where((e) => e.difficulty <= maxDifficulty);
    final caps = [
      for (final e in exercises)
        ExerciseCapability(
          peachId: peachId,
          exerciseId: e.id,
          status: CapabilityStatus.able,
          updatedAt: now,
        ),
    ];
    await _capabilities.saveAll(caps);
    return caps.length;
  }
}
