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

import { RateBallot } from './models/ballot';
import { Crate, CrateMembership } from './models/crate';
import { CustomExercise, LibraryEntry, Routine } from './models/library';
import { Peach } from './models/peach';
import { Matchup, Round, Season } from './models/season';
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
}

export interface WorkoutLogRepository {
  getById(id: string): Promise<WorkoutLog | null>;
  /** Newest first by start time. */
  forPeach(peachId: string): Promise<WorkoutLog[]>;
  /** Saves a log the Peach is still editing (never a submitted one). */
  save(log: WorkoutLog): Promise<void>;
  /**
   * Saves a submitted log and shares a copy with every Crate in its
   * `sharedWith`, all at once: a log is either private and editable or
   * submitted and visible in every Crate it counts for.
   */
  saveSubmitted(log: WorkoutLog): Promise<void>;
  /** Logs shared with `crateId` that were started in `[from, to)`. */
  sharedWith(crateId: string, from: Date, to: Date): Promise<WorkoutLog[]>;
  /** The latest logs shared with `crateId`, newest first. */
  recentlySharedWith(crateId: string, limit: number): Promise<WorkoutLog[]>;
  watch(id: string): Observable<WorkoutLog | null>;
  /** Newest first by start time. */
  watchForPeach(peachId: string): Observable<WorkoutLog[]>;
}

/** Each member's vote on the Crate's category weights, one per member. */
export interface BallotRepository {
  forCrate(crateId: string): Promise<RateBallot[]>;
  save(ballot: RateBallot): Promise<void>;
}

/** A Crate's private library of catalog picks, custom exercises and routines. */
export interface LibraryRepository {
  entries(crateId: string): Promise<LibraryEntry[]>;
  saveEntry(entry: LibraryEntry): Promise<void>;
  removeEntry(crateId: string, exerciseId: string): Promise<void>;

  customExercises(crateId: string): Promise<CustomExercise[]>;
  saveCustomExercise(exercise: CustomExercise): Promise<void>;
  removeCustomExercise(crateId: string, id: string): Promise<void>;

  routines(crateId: string): Promise<Routine[]>;
  getRoutine(crateId: string, id: string): Promise<Routine | null>;
  saveRoutine(routine: Routine): Promise<void>;
  removeRoutine(crateId: string, id: string): Promise<void>;
}
