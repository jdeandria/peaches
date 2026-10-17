import { IdGenerator } from '../domain/core/ids';
import { ZoneClock } from '../domain/core/zone-clock';
import { ExerciseCatalog } from '../domain/exercises/exercise-catalog';
import {
  BallotRepository,
  CrateRepository,
  LibraryRepository,
  PeachRepository,
  SeasonRepository,
  WorkoutLogRepository,
} from '../domain/repositories';
import { RoundWindowService } from '../domain/services/round-window';
import { ScoringService } from '../domain/services/scoring-service';
import { CrateService } from './crate-service';
import { LibraryService } from './library-service';
import { LoggingService } from './logging-service';
import { SeasonService } from './season-service';
import { SessionService } from './session-service';
import { VotingService } from './voting-service';

/** The six repositories a backend provides. */
export interface Repositories {
  readonly peaches: PeachRepository;
  readonly crates: CrateRepository;
  readonly seasons: SeasonRepository;
  readonly logs: WorkoutLogRepository;
  readonly ballots: BallotRepository;
  readonly library: LibraryRepository;
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
  readonly library: LibraryRepository;

  readonly windows: RoundWindowService;
  readonly scoring = new ScoringService();
  readonly crateService: CrateService;
  readonly loggingService: LoggingService;
  readonly votingService: VotingService;
  readonly libraryService: LibraryService;
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
      library: this.library,
    } = repositories);
    this.windows = new RoundWindowService(zone);
    this.crateService = new CrateService(this.crates, ids);
    this.loggingService = new LoggingService({ logs: this.logs, crates: this.crates, ids });
    this.votingService = new VotingService(this.ballots, this.crates);
    this.libraryService = new LibraryService(this.library, this.crates, catalog, ids);
    this.seasonService = new SeasonService({
      seasons: this.seasons,
      crates: this.crates,
      logs: this.logs,
      voting: this.votingService,
      ids,
      windows: this.windows,
      scoring: this.scoring,
    });
    this.sessionService = new SessionService(this.peaches);
  }
}
