/**
 * Persistence boundaries for the domain.
 *
 * The domain never touches a database. Each repository is an interface
 * implemented once in memory (tests, demo mode) and once for Firestore.
 * Keeping these narrow and query-shaped (rather than generic CRUD) is what
 * lets the Firestore implementation map each method onto a single indexed
 * query.
 *
 * `watch*` methods return Observables that emit the current value on
 * subscribe and again on every change.
 */
import { Observable } from 'rxjs';

import { LocalDate } from './core/local-date';
import { Ballot } from './models/ballot';
import { Crate, CrateMembership } from './models/crate';
import { Commitment } from './models/commitment';
import { SharedExercise } from './models/crate-exercise';
import { Dispute, DisputeVote } from './models/dispute';
import { Peach } from './models/peach';
import { Routine } from './models/routine';
import { Matchup, Round, Season } from './models/season';
import { WeekPlan } from './models/week-plan';
import { WorkoutLog } from './models/workout-log';

export interface PeachRepository {
  getById(id: string): Promise<Peach | null>;
  getByIds(ids: Iterable<string>): Promise<Peach[]>;
  save(peach: Peach): Promise<void>;
  watch(id: string): Observable<Peach | null>;
}

export interface CrateRepository {
  getById(id: string): Promise<Crate | null>;
  getByInviteCode(inviteCode: string): Promise<Crate | null>;
  save(crate: Crate): Promise<void>;
  membershipsOf(crateId: string): Promise<CrateMembership[]>;
  membershipsFor(peachId: string): Promise<CrateMembership[]>;
  saveMembership(membership: CrateMembership): Promise<void>;
  /** Crates in which `peachId` has an active membership, sorted by name. */
  watchCratesFor(peachId: string): Observable<Crate[]>;
}

export interface SeasonRepository {
  getById(id: string): Promise<Season | null>;
  /** Newest first. */
  forCrate(crateId: string): Promise<Season[]>;
  save(season: Season): Promise<void>;
  /** Newest first. */
  watchForCrate(crateId: string): Observable<Season[]>;

  getRound(id: string): Promise<Round | null>;
  /** Ordered by index. */
  roundsOf(seasonId: string): Promise<Round[]>;
  saveRound(round: Round): Promise<void>;

  getMatchup(id: string): Promise<Matchup | null>;
  matchupsOf(seasonId: string): Promise<Matchup[]>;
  matchupsInRound(roundId: string): Promise<Matchup[]>;
  /** Every matchup involving `peachId`. */
  matchupsFor(peachId: string): Promise<Matchup[]>;
  saveMatchup(matchup: Matchup): Promise<void>;
  saveSchedule(rounds: readonly Round[], matchups: readonly Matchup[]): Promise<void>;
  watchMatchupsFor(peachId: string): Observable<Matchup[]>;

  /**
   * What a Peach's plan for a week is worth in a Season, or null if they
   * made none. Crate-mates can read it while it is still changing.
   */
  getCommitment(seasonId: string, roundId: string, peachId: string): Promise<Commitment | null>;
  saveCommitment(commitment: Commitment): Promise<void>;
}

export interface WorkoutLogRepository {
  getById(id: string): Promise<WorkoutLog | null>;
  /** Newest first by start time. */
  forPeach(peachId: string): Promise<WorkoutLog[]>;
  /** Saves a log the Peach is still doing (never a submitted one). */
  save(log: WorkoutLog): Promise<void>;
  /**
   * Saves a submitted log, its copy under every Crate in its `sharedWith`
   * and the exercises in it as each Crate's {@link SharedExercise}s, all at
   * once. Used again whenever the Peach edits it, so the copies follow.
   */
  saveSubmitted(log: WorkoutLog): Promise<void>;
  /**
   * Deletes a log and its copy under every Crate in its `sharedWith`, all at
   * once. The exercises it shared stay: they say what a member has logged.
   */
  delete(log: WorkoutLog): Promise<void>;
  /** A log as shared with `crateId`, for its crate-mates. */
  getShared(crateId: string, logId: string): Promise<WorkoutLog | null>;
  /** Logs shared with `crateId` that were started in `[from, to)`. */
  sharedWith(crateId: string, from: Date, to: Date): Promise<WorkoutLog[]>;
  /** The latest logs shared with `crateId`, newest first. */
  recentlySharedWith(crateId: string, limit: number): Promise<WorkoutLog[]>;
  /** Every exercise members have logged in `crateId`, one per exercise per member. */
  exercisesSharedWith(crateId: string): Promise<SharedExercise[]>;
  watch(id: string): Observable<WorkoutLog | null>;
  /** Newest first by start time. */
  watchForPeach(peachId: string): Observable<WorkoutLog[]>;
}

/** A Peach's saved workouts, private to them. */
export interface RoutineRepository {
  getById(id: string): Promise<Routine | null>;
  /** In name order. */
  forPeach(peachId: string): Promise<Routine[]>;
  save(routine: Routine): Promise<void>;
  delete(id: string): Promise<void>;
  /** In name order. */
  watchForPeach(peachId: string): Observable<Routine[]>;
}

/** A Peach's plans for their weeks, private to them. */
export interface WeekPlanRepository {
  get(peachId: string, weekStart: LocalDate): Promise<WeekPlan | null>;
  /** Newest week first. */
  forPeach(peachId: string): Promise<WeekPlan[]>;
  save(plan: WeekPlan): Promise<void>;
  /** Emits null while the week has no plan. */
  watch(peachId: string, weekStart: LocalDate): Observable<WeekPlan | null>;
  /** Newest week first. */
  watchForPeach(peachId: string): Observable<WeekPlan[]>;
}

/** Each member's vote on the Crate's scoring rules, one per member. */
export interface BallotRepository {
  forCrate(crateId: string): Promise<Ballot[]>;
  save(ballot: Ballot): Promise<void>;
}

/** Crate-mates questioning each other's numbers. */
export interface DisputeRepository {
  get(crateId: string, id: string): Promise<Dispute | null>;
  /** Disputes about any of `logIds`. */
  forLogs(crateId: string, logIds: Iterable<string>): Promise<Dispute[]>;
  /** Disputes opened since `since`, newest first. */
  openedSince(crateId: string, since: Date): Promise<Dispute[]>;
  /** Creates a dispute; it must not exist yet. */
  create(dispute: Dispute): Promise<void>;
  /** Records one member's vote, leaving everyone else's alone. */
  vote(crateId: string, id: string, peachId: string, vote: DisputeVote): Promise<void>;
}
