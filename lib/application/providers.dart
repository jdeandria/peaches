import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/core/local_date.dart';
import '../domain/exercises/exercise_catalog.dart';
import '../domain/models/capability.dart';
import '../domain/models/crate.dart';
import '../domain/models/peach.dart';
import '../domain/models/score.dart';
import '../domain/models/season.dart';
import '../domain/models/workout.dart';
import '../domain/models/workout_log.dart';
import 'app_container.dart';

/// The wired backend. Overridden in `main` and in tests.
final appContainerProvider = Provider<AppContainer>(
  (_) => throw UnimplementedError('appContainerProvider must be overridden'),
);

/// Wall-clock source so screens and tests agree on "now".
final clockProvider = Provider<DateTime Function()>((_) => DateTime.now);

final todayProvider = Provider<LocalDate>(
  (ref) => LocalDate.of(ref.watch(clockProvider)()),
);

final catalogProvider = Provider<ExerciseCatalog>(
  (ref) => ref.watch(appContainerProvider).catalog,
);

/// The signed-in Peach. Demo mode pins this to the seeded user; the auth
/// layer will drive it once Firebase Auth is wired in.
final class CurrentPeachId extends Notifier<String?> {
  CurrentPeachId({this.initial});

  final String? initial;

  @override
  String? build() => initial;

  void set(String? id) => state = id;
}

final currentPeachIdProvider = NotifierProvider<CurrentPeachId, String?>(
  CurrentPeachId.new,
);

/// Bumped after any mutation so one-shot queries refetch.
final class DataRevision extends Notifier<int> {
  @override
  int build() => 0;

  void bump() => state++;
}

final dataRevisionProvider = NotifierProvider<DataRevision, int>(
  DataRevision.new,
);

final currentPeachProvider = StreamProvider<Peach?>((ref) {
  final id = ref.watch(currentPeachIdProvider);
  if (id == null) return Stream.value(null);
  return ref.watch(appContainerProvider).peaches.watch(id);
});

final myCratesProvider = StreamProvider<List<Crate>>((ref) {
  final id = ref.watch(currentPeachIdProvider);
  if (id == null) return Stream.value(const []);
  return ref.watch(appContainerProvider).crates.watchCratesFor(id);
});

final crateProvider = FutureProvider.family<Crate?, String>((ref, id) {
  ref.watch(dataRevisionProvider);
  return ref.watch(appContainerProvider).crates.getById(id);
});

final crateMembersProvider = FutureProvider.family<List<Peach>, String>((
  ref,
  crateId,
) async {
  ref.watch(dataRevisionProvider);
  final app = ref.watch(appContainerProvider);
  final members = await app.crateService.activeMembers(crateId);
  return app.peaches.getByIds(members.map((m) => m.peachId));
});

final crateSeasonsProvider = StreamProvider.family<List<Season>, String>((
  ref,
  crateId,
) {
  return ref.watch(appContainerProvider).seasons.watchForCrate(crateId);
});

final seasonRoundsProvider = FutureProvider.family<List<Round>, String>((
  ref,
  seasonId,
) {
  ref.watch(dataRevisionProvider);
  return ref.watch(appContainerProvider).seasons.roundsOf(seasonId);
});

final seasonMatchupsProvider = FutureProvider.family<List<Matchup>, String>((
  ref,
  seasonId,
) {
  ref.watch(dataRevisionProvider);
  return ref.watch(appContainerProvider).seasons.matchupsOf(seasonId);
});

final standingsProvider = FutureProvider.family<List<Standing>, String>((
  ref,
  seasonId,
) {
  ref.watch(dataRevisionProvider);
  return ref.watch(appContainerProvider).seasonService.standings(seasonId);
});

final myMatchupsProvider = StreamProvider<List<Matchup>>((ref) {
  final id = ref.watch(currentPeachIdProvider);
  if (id == null) return Stream.value(const []);
  return ref.watch(appContainerProvider).seasons.watchMatchupsFor(id);
});

final matchupProvider = FutureProvider.family<Matchup?, String>((ref, id) {
  ref.watch(dataRevisionProvider);
  return ref.watch(appContainerProvider).seasons.getMatchup(id);
});

final roundProvider = FutureProvider.family<Round?, String>((ref, id) {
  ref.watch(dataRevisionProvider);
  return ref.watch(appContainerProvider).seasons.getRound(id);
});

final seasonProvider = FutureProvider.family<Season?, String>((ref, id) {
  ref.watch(dataRevisionProvider);
  return ref.watch(appContainerProvider).seasons.getById(id);
});

final workoutProvider = FutureProvider.family<Workout?, String>((ref, id) {
  return ref.watch(appContainerProvider).workouts.getById(id);
});

final peachProvider = FutureProvider.family<Peach?, String>((ref, id) {
  ref.watch(dataRevisionProvider);
  return ref.watch(appContainerProvider).peaches.getById(id);
});

final myLogsProvider = StreamProvider<List<WorkoutLog>>((ref) {
  final id = ref.watch(currentPeachIdProvider);
  if (id == null) return Stream.value(const []);
  return ref.watch(appContainerProvider).logs.watchForPeach(id);
});

final logProvider = StreamProvider.family<WorkoutLog?, String>((ref, id) {
  return ref.watch(appContainerProvider).logs.watch(id);
});

final myCapabilitiesProvider = StreamProvider<Set<String>>((ref) {
  final id = ref.watch(currentPeachIdProvider);
  if (id == null) return Stream.value(const {});
  return ref
      .watch(appContainerProvider)
      .capabilities
      .watchForPeach(id)
      .map(
        (caps) => caps.where((c) => c.isAble).map((c) => c.exerciseId).toSet(),
      );
});

/// Capabilities for an arbitrary Peach (used to show opponents' pools).
final capabilitiesProvider =
    FutureProvider.family<List<ExerciseCapability>, String>((ref, peachId) {
      ref.watch(dataRevisionProvider);
      return ref.watch(appContainerProvider).capabilities.forPeach(peachId);
    });
