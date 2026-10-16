import { IdGenerator } from '../domain/core/ids';
import { ZoneClock } from '../domain/core/zone-clock';
import { ExerciseCatalog } from '../domain/exercises/exercise-catalog';
import {
  CapabilityRepository,
  CrateRepository,
  PeachRepository,
  SeasonRepository,
  WorkoutLogRepository,
  WorkoutRepository,
} from '../domain/repositories';
import { ExercisePoolService } from '../domain/services/exercise-pool';
import { RoundWindowService } from '../domain/services/round-window';
import { ScoringService } from '../domain/services/scoring-service';
import { WorkoutGenerator } from '../domain/services/workout-generator';
import { CapabilityService } from './capability-service';
import { CrateService } from './crate-service';
import { LoggingService } from './logging-service';
import { SeasonService } from './season-service';
import { SessionService } from './session-service';

/** The six repositories a backend provides. */
export interface Repositories {
  readonly peaches: PeachRepository;
  readonly crates: CrateRepository;
  readonly capabilities: CapabilityRepository;
  readonly seasons: SeasonRepository;
  readonly workouts: WorkoutRepository;
  readonly logs: WorkoutLogRepository;
}

/**
 * The composition root: every repository and service, wired once.
 *
 * Only the repositories differ between backends (in memory for the demo and
 * tests, Firestore in production); services and the domain are shared.
 */
export class AppContainer implements Repositories {
  readonly peaches: PeachRepository;
  readonly crates: CrateRepository;
  readonly capabilities: CapabilityRepository;
  readonly seasons: SeasonRepository;
  readonly workouts: WorkoutRepository;
  readonly logs: WorkoutLogRepository;

  readonly pool: ExercisePoolService;
  readonly windows: RoundWindowService;
  readonly generator: WorkoutGenerator;
  readonly scoring = new ScoringService();
  readonly crateService: CrateService;
  readonly capabilityService: CapabilityService;
  readonly loggingService: LoggingService;
  readonly seasonService: SeasonService;
  readonly sessionService: SessionService;

  constructor(
    repositories: Repositories,
    readonly catalog: ExerciseCatalog,
    readonly ids: IdGenerator,
    readonly zone: ZoneClock,
  ) {
    ({
      peaches: this.peaches,
      crates: this.crates,
      capabilities: this.capabilities,
      seasons: this.seasons,
      workouts: this.workouts,
      logs: this.logs,
    } = repositories);
    this.pool = new ExercisePoolService(catalog);
    this.windows = new RoundWindowService(zone);
    this.generator = new WorkoutGenerator(ids);
    this.crateService = new CrateService(this.crates, ids);
    this.capabilityService = new CapabilityService(this.capabilities, catalog);
    this.loggingService = new LoggingService({
      logs: this.logs,
      workouts: this.workouts,
      ids,
      seasons: this.seasons,
      crates: this.crates,
      windows: this.windows,
      scoring: this.scoring,
    });
    this.seasonService = new SeasonService({
      seasons: this.seasons,
      crates: this.crates,
      peaches: this.peaches,
      capabilities: this.capabilities,
      workouts: this.workouts,
      logs: this.logs,
      pool: this.pool,
      generator: this.generator,
      ids,
      windows: this.windows,
      scoring: this.scoring,
    });
    this.sessionService = new SessionService(this.peaches);
  }
}
