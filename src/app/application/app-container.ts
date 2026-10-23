import { IdGenerator } from '../domain/core/ids';
import { ZoneClock } from '../domain/core/zone-clock';
import { ExerciseCatalog } from '../domain/exercises/exercise-catalog';
import {
  BallotRepository,
  CrateRepository,
  DisputeRepository,
  PeachRepository,
  RoutineRepository,
  SeasonRepository,
  WeekPlanRepository,
  WorkoutLogRepository,
} from '../domain/repositories';
import { RoundWindowService } from '../domain/services/round-window';
import { ScoringService } from '../domain/services/scoring-service';
import { CrateService } from './crate-service';
import { DisputeService } from './dispute-service';
import { LoggingService } from './logging-service';
import { PlanService } from './plan-service';
import { RoutineService } from './routine-service';
import { SeasonService } from './season-service';
import { SessionService } from './session-service';
import { VotingService } from './voting-service';

/** The repositories a backend provides. */
export interface Repositories {
  readonly peaches: PeachRepository;
  readonly crates: CrateRepository;
  readonly seasons: SeasonRepository;
  readonly logs: WorkoutLogRepository;
  readonly ballots: BallotRepository;
  readonly disputes: DisputeRepository;
  readonly routines: RoutineRepository;
  readonly plans: WeekPlanRepository;
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
  readonly seasons: SeasonRepository;
  readonly logs: WorkoutLogRepository;
  readonly ballots: BallotRepository;
  readonly disputes: DisputeRepository;
  readonly routines: RoutineRepository;
  readonly plans: WeekPlanRepository;

  readonly windows: RoundWindowService;
  readonly scoring = new ScoringService();
  readonly crateService: CrateService;
  readonly loggingService: LoggingService;
  readonly routineService: RoutineService;
  readonly votingService: VotingService;
  readonly planService: PlanService;
  readonly disputeService: DisputeService;
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
      seasons: this.seasons,
      logs: this.logs,
      ballots: this.ballots,
      disputes: this.disputes,
      routines: this.routines,
      plans: this.plans,
    } = repositories);
    this.windows = new RoundWindowService(zone);
    this.crateService = new CrateService(this.crates, ids);
    this.loggingService = new LoggingService({ logs: this.logs, crates: this.crates, ids });
    this.routineService = new RoutineService(this.routines, ids);
    this.votingService = new VotingService(this.ballots, this.crates);
    this.planService = new PlanService({
      plans: this.plans,
      seasons: this.seasons,
      crates: this.crates,
      logs: this.logs,
      logging: this.loggingService,
      windows: this.windows,
      ids,
      scoring: this.scoring,
    });
    this.disputeService = new DisputeService({
      disputes: this.disputes,
      logs: this.logs,
      crates: this.crates,
      seasons: this.seasons,
      windows: this.windows,
    });
    this.seasonService = new SeasonService({
      seasons: this.seasons,
      crates: this.crates,
      logs: this.logs,
      voting: this.votingService,
      plans: this.planService,
      disputes: this.disputeService,
      ids,
      windows: this.windows,
      scoring: this.scoring,
    });
    this.sessionService = new SessionService(this.peaches);
  }
}
