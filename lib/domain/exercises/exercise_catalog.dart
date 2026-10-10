import 'catalog_data.dart';
import 'exercise.dart';
import 'taxonomy.dart';

/// An indexed, read-only collection of [Exercise]s.
///
/// The default catalog ships with the app ([ExerciseCatalog.standard]); tests
/// and future remote-config catalogs construct their own instances.
final class ExerciseCatalog {
  ExerciseCatalog(Iterable<Exercise> exercises, {this.version = 0})
    : _byId = {for (final e in exercises) e.id: e} {
    assert(_byId.length == exercises.length, 'Exercise ids must be unique');
  }

  /// The catalog bundled with this build of the app.
  factory ExerciseCatalog.standard() =>
      ExerciseCatalog(standardExercises, version: standardCatalogVersion);

  final int version;
  final Map<String, Exercise> _byId;

  int get length => _byId.length;

  Iterable<Exercise> get all => _byId.values;

  Exercise? byId(String id) => _byId[id];

  /// Looks up an exercise, throwing if the id is unknown. Prefer [byId] when
  /// handling user data that may reference a removed exercise.
  Exercise require(String id) {
    final exercise = _byId[id];
    if (exercise == null) {
      throw ArgumentError.value(id, 'id', 'Unknown exercise');
    }
    return exercise;
  }

  Iterable<Exercise> byIds(Iterable<String> ids) => ids.map(byId).nonNulls;

  Iterable<Exercise> withPattern(MovementPattern pattern) =>
      all.where((e) => e.pattern == pattern);

  Iterable<Exercise> withModality(Modality modality) =>
      all.where((e) => e.modality == modality);

  Iterable<Exercise> inFamily(String family) =>
      all.where((e) => e.family == family);

  /// Exercises performable with exactly the given equipment (or none).
  Iterable<Exercise> performableWith(Set<Equipment> available) =>
      all.where((e) => e.isPerformableWith(available));

  /// Case-insensitive search over name and aliases.
  Iterable<Exercise> search(String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return all;
    return all.where(
      (e) =>
          e.name.toLowerCase().contains(q) ||
          e.aliases.any((a) => a.toLowerCase().contains(q)),
    );
  }
}
