import { isLocked, Lineup, LINEUP_OPENS_MS, lineupProblem, Pledge } from '../domain/models/lineup';
import { involves, Round, Season } from '../domain/models/season';
import { CrateRepository, SeasonRepository } from '../domain/repositories';
import { RoundWindowService } from '../domain/services/round-window';
import { DomainError } from './errors';
import { roundContext } from './round-context';

/**
 * Weekly lineups: before a week starts, each Peach pledges amounts in a few
 * categories (as many as the Season's rules allow). A lineup carries over
 * to later weeks until it is changed, and stays secret from crate-mates
 * until its week starts.
 */
export class LineupService {
  constructor(
    private readonly deps: {
      seasons: SeasonRepository;
      crates: CrateRepository;
      windows: RoundWindowService;
    },
  ) {}

  /** Sets the Peach's lineup for a week that hasn't started yet. */
  async setLineup(args: {
    roundId: string;
    peachId: string;
    pledges: readonly Pledge[];
    now: Date;
  }): Promise<Lineup> {
    const { seasons, windows } = this.deps;
    const { round, season, crate } = await roundContext(this.deps, args.roundId);
    const locksAt = windows.windowFor(round, crate).opensAt;
    if (isLocked({ locksAt }, args.now)) {
      throw new DomainError('That week has started: lineups are locked.');
    }
    if (locksAt.getTime() - args.now.getTime() > LINEUP_OPENS_MS) {
      throw new DomainError('Lineups open a week before the week starts.');
    }
    const playing = (await seasons.matchupsInRound(round.id)).some((m) =>
      involves(m, args.peachId),
    );
    if (!playing) throw new DomainError('You’re not playing that week.');
    const problem = lineupProblem(args.pledges, season.rules.lineup);
    if (problem) throw new DomainError(problem);
    const lineup: Lineup = {
      seasonId: season.id,
      roundId: round.id,
      peachId: args.peachId,
      pledges: args.pledges,
      locksAt,
      updatedAt: args.now,
    };
    await seasons.saveLineup(lineup);
    return lineup;
  }

  /**
   * The lineup that applies to `round` for `peachId`: theirs for that week,
   * else the latest from an earlier week. `rounds` are the Season's, in
   * order. A crate-mate's lineup for a week that hasn't started is secret,
   * so it reads as their previous week's.
   */
  async inForce(
    season: Season,
    rounds: readonly Round[],
    round: Round,
    peachId: string,
  ): Promise<Lineup | null> {
    for (let i = round.index; i >= 0; i--) {
      const lineup = await this.deps.seasons.getLineup(season.id, rounds[i].id, peachId);
      if (lineup) return lineup;
    }
    return null;
  }
}
