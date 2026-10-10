import 'package:cloud_firestore/cloud_firestore.dart';

import '../data/demo/demo_seeder.dart';
import '../data/firestore/firestore_repositories.dart';
import '../data/in_memory/in_memory_repositories.dart';
import '../domain/core/ids.dart';
import '../domain/core/zone_clock.dart';
import '../domain/exercises/exercise_catalog.dart';
import '../domain/repositories/repositories.dart';
import '../domain/services/exercise_pool.dart';
import '../domain/services/round_window.dart';
import '../domain/services/scoring_service.dart';
import '../domain/services/workout_generator.dart';
import 'capability_service.dart';
import 'crate_service.dart';
import 'logging_service.dart';
import 'season_service.dart';

/// The composition root: every repository and service, wired once.
///
/// [AppContainer.inMemory] backs the app with volatile storage (demo mode
/// and tests); [AppContainer.firestore] backs it with Firestore. Only the
/// repositories differ; services and the domain are shared.
final class AppContainer {
  AppContainer({
    required this.catalog,
    required this.ids,
    required this.peaches,
    required this.crates,
    required this.capabilities,
    required this.seasons,
    required this.workouts,
    required this.logs,
    required this.zone,
  }) : pool = ExercisePoolService(catalog),
       generator = WorkoutGenerator(ids: ids),
       windows = RoundWindowService(zone) {
    crateService = CrateService(crates: crates, ids: ids);
    capabilityService = CapabilityService(
      capabilities: capabilities,
      catalog: catalog,
    );
    loggingService = LoggingService(
      logs: logs,
      workouts: workouts,
      ids: ids,
      seasons: seasons,
      crates: crates,
      windows: windows,
    );
    seasonService = SeasonService(
      seasons: seasons,
      crates: crates,
      peaches: peaches,
      capabilities: capabilities,
      workouts: workouts,
      logs: logs,
      pool: pool,
      generator: generator,
      ids: ids,
      windows: windows,
    );
  }

  factory AppContainer.inMemory({
    IdGenerator? ids,
    ExerciseCatalog? catalog,
    ZoneClock zone = const UtcZoneClock(),
  }) => AppContainer(
    catalog: catalog ?? ExerciseCatalog.standard(),
    ids: ids ?? RandomIdGenerator(),
    zone: zone,
    peaches: InMemoryPeachRepository(),
    crates: InMemoryCrateRepository(),
    capabilities: InMemoryCapabilityRepository(),
    seasons: InMemorySeasonRepository(),
    workouts: InMemoryWorkoutRepository(),
    logs: InMemoryWorkoutLogRepository(),
  );

  /// Firestore-backed container. [db] may be a `FakeFirebaseFirestore` in
  /// tests, which is how the repositories are contract-tested.
  factory AppContainer.firestore(
    FirebaseFirestore db, {
    required ExerciseCatalog catalog,
    required IdGenerator ids,
    required ZoneClock zone,
  }) => AppContainer(
    catalog: catalog,
    ids: ids,
    zone: zone,
    peaches: FirestorePeachRepository(db),
    crates: FirestoreCrateRepository(db),
    capabilities: FirestoreCapabilityRepository(db),
    seasons: FirestoreSeasonRepository(db),
    workouts: FirestoreWorkoutRepository(db),
    logs: FirestoreWorkoutLogRepository(db),
  );

  final ExerciseCatalog catalog;
  final IdGenerator ids;
  final PeachRepository peaches;
  final CrateRepository crates;
  final CapabilityRepository capabilities;
  final SeasonRepository seasons;
  final WorkoutRepository workouts;
  final WorkoutLogRepository logs;
  final ZoneClock zone;

  final ExercisePoolService pool;
  final RoundWindowService windows;
  final WorkoutGenerator generator;
  final ScoringService scoring = const ScoringService();
  late final CrateService crateService;
  late final CapabilityService capabilityService;
  late final LoggingService loggingService;
  late final SeasonService seasonService;

  DemoSeeder get demoSeeder => DemoSeeder(
    peaches: peaches,
    workouts: workouts,
    logs: logs,
    seasons: seasons,
    crateService: crateService,
    seasonService: seasonService,
    capabilityService: capabilityService,
    loggingService: loggingService,
  );
}
