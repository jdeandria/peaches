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
  WorkoutLogRepository,
} from '../domain/repositories';
import { RoundWindowService } from '../domain/services/round-window';
import { ScoringService } from '../domain/services/scoring-service';
import { CrateService } from './crate-service';
import { DisputeService } from './dispute-service';
import { LineupService } from './lineup-service';
import { LoggingService } from './logging-service';
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

  readonly windows: RoundWindowService;
  readonly scoring = new ScoringService();
  readonly crateService: CrateService;
  readonly loggingService: LoggingService;
  readonly routineService: RoutineService;
  readonly votingService: VotingService;
  readonly lineupService: LineupService;
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
    } = repositories);
    this.windows = new RoundWindowService(zone);
    this.crateService = new CrateService(this.crates, ids);
    this.loggingService = new LoggingService({ logs: this.logs, crates: this.crates, ids });
    this.routineService = new RoutineService(this.routines, ids);
    this.votingService = new VotingService(this.ballots, this.crates);
    this.lineupService = new LineupService({
      seasons: this.seasons,
      crates: this.crates,
      windows: this.windows,
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
      lineups: this.lineupService,
      disputes: this.disputeService,
      ids,
      windows: this.windows,
      scoring: this.scoring,
    });
    this.sessionService = new SessionService(this.peaches);
  }
}
