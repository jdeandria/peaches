import '../data/demo/demo_seeder.dart';
import '../data/in_memory/in_memory_repositories.dart';
import '../domain/core/ids.dart';
import '../domain/exercises/exercise_catalog.dart';
import '../domain/repositories/repositories.dart';
import '../domain/services/exercise_pool.dart';
import '../domain/services/scoring_service.dart';
import '../domain/services/workout_generator.dart';
import 'capability_service.dart';
import 'crate_service.dart';
import 'logging_service.dart';
import 'season_service.dart';

/// The composition root: every repository and service, wired once.
///
/// [AppContainer.inMemory] backs the app with volatile storage (demo mode
/// and tests). A Firebase-backed factory will live beside it and swap only
/// the repositories; services and the domain stay untouched.
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
  }) : pool = ExercisePoolService(catalog),
       generator = WorkoutGenerator(ids: ids) {
    crateService = CrateService(crates: crates, ids: ids);
    capabilityService = CapabilityService(
      capabilities: capabilities,
      catalog: catalog,
    );
    loggingService = LoggingService(logs: logs, workouts: workouts, ids: ids);
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
    );
  }

  factory AppContainer.inMemory({IdGenerator? ids, ExerciseCatalog? catalog}) =>
      AppContainer(
        catalog: catalog ?? ExerciseCatalog.standard(),
        ids: ids ?? RandomIdGenerator(),
        peaches: InMemoryPeachRepository(),
        crates: InMemoryCrateRepository(),
        capabilities: InMemoryCapabilityRepository(),
        seasons: InMemorySeasonRepository(),
        workouts: InMemoryWorkoutRepository(),
        logs: InMemoryWorkoutLogRepository(),
      );

  final ExerciseCatalog catalog;
  final IdGenerator ids;
  final PeachRepository peaches;
  final CrateRepository crates;
  final CapabilityRepository capabilities;
  final SeasonRepository seasons;
  final WorkoutRepository workouts;
  final WorkoutLogRepository logs;

  final ExercisePoolService pool;
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
