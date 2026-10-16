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
import { ExerciseCapability } from './models/capability';
import { Crate, CrateMembership } from './models/crate';
import { Peach } from './models/peach';
import { Matchup, Round, Season } from './models/season';
import { Workout } from './models/workout';
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

export interface CapabilityRepository {
  forPeach(peachId: string): Promise<ExerciseCapability[]>;
  forPeaches(peachIds: Iterable<string>): Promise<ExerciseCapability[]>;
  save(capability: ExerciseCapability): Promise<void>;
  saveAll(capabilities: Iterable<ExerciseCapability>): Promise<void>;
  watchForPeach(peachId: string): Observable<ExerciseCapability[]>;
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
  /** Every matchup involving `peachId`, optionally only on `on`. */
  matchupsFor(peachId: string, on?: LocalDate): Promise<Matchup[]>;
  saveMatchup(matchup: Matchup): Promise<void>;
  saveSchedule(rounds: readonly Round[], matchups: readonly Matchup[]): Promise<void>;
  watchMatchupsFor(peachId: string): Observable<Matchup[]>;
}

export interface WorkoutRepository {
  getById(id: string): Promise<Workout | null>;
  getByIds(ids: Iterable<string>): Promise<Workout[]>;
  save(workout: Workout): Promise<void>;
}

export interface WorkoutLogRepository {
  getById(id: string): Promise<WorkoutLog | null>;
  forMatchup(matchupId: string, peachId: string): Promise<WorkoutLog | null>;
  /** Newest first by start time. */
  forPeach(peachId: string): Promise<WorkoutLog[]>;
  save(log: WorkoutLog): Promise<void>;
  watch(id: string): Observable<WorkoutLog | null>;
  /** Newest first by start time. */
  watchForPeach(peachId: string): Observable<WorkoutLog[]>;
}
