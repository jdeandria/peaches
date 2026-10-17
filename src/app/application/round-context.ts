import { Crate } from '../domain/models/crate';
import { Round, Season } from '../domain/models/season';
import { CrateRepository, SeasonRepository } from '../domain/repositories';
import { DomainError } from './errors';

/** A week with the Season and Crate it belongs to. */
export interface RoundContext {
  readonly round: Round;
  readonly season: Season;
  readonly crate: Crate;
}

export async function roundContext(
  repos: { seasons: SeasonRepository; crates: CrateRepository },
  roundId: string,
): Promise<RoundContext> {
  const round = await repos.seasons.getRound(roundId);
  if (!round) throw new DomainError('Round not found.');
  const season = await repos.seasons.getById(round.seasonId);
  const crate = season ? await repos.crates.getById(season.crateId) : null;
  if (!season || !crate) throw new DomainError('Season not found.');
  return { round, season, crate };
}
