import { Ballot } from '../domain/models/ballot';
import { isActiveMembership } from '../domain/models/crate';
import { categoryWeights, lineupRules, ScoringRules } from '../domain/models/scoring';
import { BallotRepository, CrateRepository } from '../domain/repositories';
import { BallotTally } from '../domain/services/ballot-tally';
import { DomainError } from './errors';

/**
 * Crate members vote on how the Crate scores: what each category is worth
 * and the lineup rules. Ballots can change at any time; a Season freezes the
 * tally when it is scheduled.
 */
export class VotingService {
  constructor(
    private readonly ballots: BallotRepository,
    private readonly crates: CrateRepository,
  ) {}

  async castBallot(
    crateId: string,
    peachId: string,
    rules: ScoringRules,
    now: Date,
  ): Promise<Ballot> {
    if (!(await this.activeMemberIds(crateId)).has(peachId)) {
      throw new DomainError('Only members can vote.');
    }
    let checked: ScoringRules;
    try {
      checked = { weights: categoryWeights(rules.weights), lineup: lineupRules(rules.lineup) };
    } catch (e) {
      throw new DomainError(e instanceof Error ? e.message : String(e));
    }
    const ballot: Ballot = { crateId, peachId, rules: checked, updatedAt: now };
    await this.ballots.save(ballot);
    return ballot;
  }

  /** Ballots of current members; votes of Peaches who left no longer count. */
  async ballotsOf(crateId: string): Promise<Ballot[]> {
    const members = await this.activeMemberIds(crateId);
    return (await this.ballots.forCrate(crateId)).filter((b) => members.has(b.peachId));
  }

  /** The rules the Crate's next Season would use. */
  async currentRules(crateId: string): Promise<ScoringRules> {
    return BallotTally.rules((await this.ballotsOf(crateId)).map((b) => b.rules));
  }

  private async activeMemberIds(crateId: string): Promise<Set<string>> {
    const memberships = await this.crates.membershipsOf(crateId);
    return new Set(memberships.filter(isActiveMembership).map((m) => m.peachId));
  }
}
