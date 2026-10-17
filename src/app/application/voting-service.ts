import { RateBallot } from '../domain/models/ballot';
import { isActiveMembership } from '../domain/models/crate';
import { categoryWeights, CategoryWeights } from '../domain/models/scoring';
import { BallotRepository, CrateRepository } from '../domain/repositories';
import { BallotTally } from '../domain/services/ballot-tally';
import { DomainError } from './errors';

/**
 * Crate members vote on what each scoring category is worth. Ballots can
 * change at any time; a Season freezes the tally when it is scheduled.
 */
export class VotingService {
  constructor(
    private readonly ballots: BallotRepository,
    private readonly crates: CrateRepository,
  ) {}

  async castBallot(
    crateId: string,
    peachId: string,
    weights: CategoryWeights,
    now: Date,
  ): Promise<RateBallot> {
    if (!(await this.activeMemberIds(crateId)).has(peachId)) {
      throw new DomainError('Only members can vote.');
    }
    let checked: CategoryWeights;
    try {
      checked = categoryWeights(weights);
    } catch (e) {
      throw new DomainError(e instanceof Error ? e.message : String(e));
    }
    const ballot: RateBallot = { crateId, peachId, weights: checked, updatedAt: now };
    await this.ballots.save(ballot);
    return ballot;
  }

  /** Ballots of current members; votes of Peaches who left no longer count. */
  async ballotsOf(crateId: string): Promise<RateBallot[]> {
    const members = await this.activeMemberIds(crateId);
    return (await this.ballots.forCrate(crateId)).filter((b) => members.has(b.peachId));
  }

  /** The weights the Crate's next Season would use. */
  async currentWeights(crateId: string): Promise<CategoryWeights> {
    return BallotTally.tally((await this.ballotsOf(crateId)).map((b) => b.weights));
  }

  private async activeMemberIds(crateId: string): Promise<Set<string>> {
    const memberships = await this.crates.membershipsOf(crateId);
    return new Set(memberships.filter(isActiveMembership).map((m) => m.peachId));
  }
}
