import { isActiveMembership } from '../domain/models/crate';
import {
  Dispute,
  disputeKey,
  disputeOutcome,
  DisputeOutcome,
  DisputeVote,
  metricSnapshot,
  SESSION_TIME,
  stillApplies,
} from '../domain/models/dispute';
import { isSeasonOpen } from '../domain/models/season';
import { entryFor, WorkoutLog } from '../domain/models/workout-log';
import {
  CrateRepository,
  DisputeRepository,
  SeasonRepository,
  WorkoutLogRepository,
} from '../domain/repositories';
import { RoundWindowService } from '../domain/services/round-window';
import { DomainError } from './errors';

/** A dispute with where it stands in its Crate today. */
export interface DisputeView {
  readonly dispute: Dispute;
  readonly outcome: DisputeOutcome;
  readonly strike: number;
  readonly keep: number;
  /** Strike votes it takes: more than half the Crate. */
  readonly needed: number;
  /** False once the owner has edited the disputed numbers. */
  readonly applies: boolean;
}

/** How far back the Crate page looks for disputes that need votes. */
const RECENT_MS = 14 * 86_400_000;

/**
 * Crates keep each other honest: any member can dispute an exercise or the
 * session time of a crate-mate's shared workout while its week is still
 * open, and the Crate votes. Struck numbers stop scoring in that Crate.
 */
export class DisputeService {
  constructor(
    private readonly deps: {
      disputes: DisputeRepository;
      logs: WorkoutLogRepository;
      crates: CrateRepository;
      seasons: SeasonRepository;
      windows: RoundWindowService;
    },
  ) {}

  /** Opens a dispute, counting the opener's vote to strike. Idempotent. */
  async open(args: {
    crateId: string;
    logId: string;
    target: string;
    peachId: string;
    now: Date;
  }): Promise<Dispute> {
    const { crateId, peachId, now } = args;
    const log = await this.deps.logs.getShared(crateId, args.logId);
    if (!log) throw new DomainError('Workout not found.');
    if (log.peachId === peachId) throw new DomainError('You can’t dispute your own workout.');
    await this.requireMember(crateId, peachId);
    if (!(await this.weekOpen(crateId, log.startedAt, now))) {
      throw new DomainError('That week is over, so its scores are final.');
    }
    const snapshot = metricSnapshot(log, args.target);
    if (snapshot === null) throw new DomainError('That isn’t in the workout.');
    const id = disputeKey(log.id, snapshot);
    const existing = await this.deps.disputes.get(crateId, id);
    if (existing) return existing;
    const dispute: Dispute = {
      id,
      crateId,
      logId: log.id,
      peachId: log.peachId,
      target: args.target,
      label:
        args.target === SESSION_TIME
          ? 'Session time'
          : (entryFor(log, args.target)?.exerciseName ?? args.target),
      snapshot,
      openedBy: peachId,
      openedAt: now,
      votes: { [peachId]: 'strike' },
    };
    await this.deps.disputes.create(dispute);
    return dispute;
  }

  /** A member's vote, changeable until the dispute is decided. */
  async vote(args: {
    crateId: string;
    disputeId: string;
    peachId: string;
    vote: DisputeVote;
  }): Promise<void> {
    const { crateId, disputeId, peachId } = args;
    const dispute = await this.deps.disputes.get(crateId, disputeId);
    if (!dispute) throw new DomainError('Dispute not found.');
    if (dispute.peachId === peachId) throw new DomainError('You can’t vote on your own workout.');
    const members = await this.requireMember(crateId, peachId);
    if (disputeOutcome(dispute, members).outcome !== 'open') {
      throw new DomainError('The Crate has already decided this one.');
    }
    await this.deps.disputes.vote(crateId, disputeId, peachId, args.vote);
  }

  /** Every dispute about `logs` in the Crate, with where each stands. */
  async views(crateId: string, logs: readonly WorkoutLog[]): Promise<DisputeView[]> {
    if (logs.length === 0) return [];
    const [disputes, members] = await Promise.all([
      this.deps.disputes.forLogs(
        crateId,
        logs.map((l) => l.id),
      ),
      this.memberIds(crateId),
    ]);
    const byId = new Map(logs.map((l) => [l.id, l]));
    return disputes.map((d) => {
      const log = byId.get(d.logId);
      return { dispute: d, ...disputeOutcome(d, members), applies: !!log && stillApplies(d, log) };
    });
  }

  /** Recent undecided disputes `peachId` hasn't voted on, newest first. */
  async awaitingVote(crateId: string, peachId: string, now: Date): Promise<DisputeView[]> {
    const [disputes, members] = await Promise.all([
      this.deps.disputes.openedSince(crateId, new Date(now.getTime() - RECENT_MS)),
      this.memberIds(crateId),
    ]);
    return disputes
      .filter((d) => d.peachId !== peachId && d.votes[peachId] === undefined)
      .map((d) => ({ dispute: d, ...disputeOutcome(d, members), applies: true }))
      .filter((v) => v.outcome === 'open');
  }

  /** Whether a log started at `startedAt` is in a week of the Crate's Season that is still open. */
  async weekOpen(crateId: string, startedAt: Date, now: Date): Promise<boolean> {
    const { seasons, crates, windows } = this.deps;
    const crate = await crates.getById(crateId);
    const season = (await seasons.forCrate(crateId)).find(isSeasonOpen);
    if (!crate || !season) return false;
    return (await seasons.roundsOf(season.id)).some((round) => {
      const window = windows.windowFor(round, crate);
      return round.status !== 'closed' && window.covers(startedAt) && !window.hasClosedBy(now);
    });
  }

  private async memberIds(crateId: string): Promise<Set<string>> {
    const memberships = await this.deps.crates.membershipsOf(crateId);
    return new Set(memberships.filter(isActiveMembership).map((m) => m.peachId));
  }

  private async requireMember(crateId: string, peachId: string): Promise<Set<string>> {
    const members = await this.memberIds(crateId);
    if (!members.has(peachId)) throw new DomainError('Only members can dispute workouts.');
    return members;
  }
}
