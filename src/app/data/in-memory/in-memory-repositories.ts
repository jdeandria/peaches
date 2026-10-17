import { combineLatest, distinctUntilChanged, map, Observable } from 'rxjs';

import { Repositories } from '../../application/app-container';
import { RateBallot } from '../../domain/models/ballot';
import { Crate, CrateMembership, isActiveMembership } from '../../domain/models/crate';
import { CustomExercise, LibraryEntry, Routine } from '../../domain/models/library';
import { Peach } from '../../domain/models/peach';
import { involves, Matchup, Round, Season } from '../../domain/models/season';
import { isSubmitted, WorkoutLog } from '../../domain/models/workout-log';
import {
  BallotRepository,
  CrateRepository,
  LibraryRepository,
  PeachRepository,
  SeasonRepository,
  WorkoutLogRepository,
} from '../../domain/repositories';
import { InMemoryStore } from './in-memory-store';

const byName = (a: Crate, b: Crate) => a.name.localeCompare(b.name);
const newestSeasonFirst = (a: Season, b: Season) => b.createdAt.getTime() - a.createdAt.getTime();
const newestLogFirst = (a: WorkoutLog, b: WorkoutLog) =>
  b.startedAt.getTime() - a.startedAt.getTime();

function present<T>(values: Iterable<T | null>): T[] {
  return [...values].filter((v): v is T => v !== null);
}

export class InMemoryPeachRepository implements PeachRepository {
  private readonly store = new InMemoryStore<Peach>((p) => p.id);

  async getById(id: string): Promise<Peach | null> {
    return this.store.get(id);
  }

  async getByIds(ids: Iterable<string>): Promise<Peach[]> {
    return present([...ids].map((id) => this.store.get(id)));
  }

  async save(peach: Peach): Promise<void> {
    this.store.put(peach);
  }

  watch(id: string): Observable<Peach | null> {
    return this.store.watch(() => this.store.get(id)).pipe(distinctUntilChanged());
  }
}

export class InMemoryCrateRepository implements CrateRepository {
  private readonly crates = new InMemoryStore<Crate>((c) => c.id);
  private readonly memberships = new InMemoryStore<CrateMembership>(
    (m) => `${m.crateId}:${m.peachId}`,
  );

  async getById(id: string): Promise<Crate | null> {
    return this.crates.get(id);
  }

  async getByInviteCode(inviteCode: string): Promise<Crate | null> {
    const code = inviteCode.trim().toUpperCase();
    return this.crates.values.find((c) => c.inviteCode.toUpperCase() === code) ?? null;
  }

  async save(crate: Crate): Promise<void> {
    this.crates.put(crate);
  }

  async membershipsOf(crateId: string): Promise<CrateMembership[]> {
    return this.memberships.where((m) => m.crateId === crateId);
  }

  async membershipsFor(peachId: string): Promise<CrateMembership[]> {
    return this.memberships.where((m) => m.peachId === peachId);
  }

  async saveMembership(membership: CrateMembership): Promise<void> {
    this.memberships.put(membership);
  }

  watchCratesFor(peachId: string): Observable<Crate[]> {
    // Re-run the query whenever either store changes.
    return combineLatest([this.crates.changes, this.memberships.changes]).pipe(
      map(() => {
        const ids = new Set(
          this.memberships
            .where((m) => m.peachId === peachId && isActiveMembership(m))
            .map((m) => m.crateId),
        );
        return this.crates.where((c) => ids.has(c.id)).sort(byName);
      }),
    );
  }
}

export class InMemorySeasonRepository implements SeasonRepository {
  private readonly seasons = new InMemoryStore<Season>((s) => s.id);
  private readonly rounds = new InMemoryStore<Round>((r) => r.id);
  private readonly matchups = new InMemoryStore<Matchup>((m) => m.id);

  async getById(id: string): Promise<Season | null> {
    return this.seasons.get(id);
  }

  async forCrate(crateId: string): Promise<Season[]> {
    return this.seasons.where((s) => s.crateId === crateId).sort(newestSeasonFirst);
  }

  async save(season: Season): Promise<void> {
    this.seasons.put(season);
  }

  watchForCrate(crateId: string): Observable<Season[]> {
    return this.seasons.watch((all) =>
      all.filter((s) => s.crateId === crateId).sort(newestSeasonFirst),
    );
  }

  async getRound(id: string): Promise<Round | null> {
    return this.rounds.get(id);
  }

  async roundsOf(seasonId: string): Promise<Round[]> {
    return this.rounds.where((r) => r.seasonId === seasonId).sort((a, b) => a.index - b.index);
  }

  async saveRound(round: Round): Promise<void> {
    this.rounds.put(round);
  }

  async getMatchup(id: string): Promise<Matchup | null> {
    return this.matchups.get(id);
  }

  async matchupsOf(seasonId: string): Promise<Matchup[]> {
    return this.matchups.where((m) => m.seasonId === seasonId);
  }

  async matchupsInRound(roundId: string): Promise<Matchup[]> {
    return this.matchups.where((m) => m.roundId === roundId);
  }

  async matchupsFor(peachId: string): Promise<Matchup[]> {
    return this.matchups.where((m) => involves(m, peachId));
  }

  async saveMatchup(matchup: Matchup): Promise<void> {
    this.matchups.put(matchup);
  }

  async saveSchedule(rounds: readonly Round[], matchups: readonly Matchup[]): Promise<void> {
    this.rounds.putAll(rounds);
    this.matchups.putAll(matchups);
  }

  watchMatchupsFor(peachId: string): Observable<Matchup[]> {
    return this.matchups.watch((all) => all.filter((m) => involves(m, peachId)));
  }
}

export class InMemoryWorkoutLogRepository implements WorkoutLogRepository {
  private readonly store = new InMemoryStore<WorkoutLog>((l) => l.id);

  async getById(id: string): Promise<WorkoutLog | null> {
    return this.store.get(id);
  }

  async forPeach(peachId: string): Promise<WorkoutLog[]> {
    return this.store.where((l) => l.peachId === peachId).sort(newestLogFirst);
  }

  async save(log: WorkoutLog): Promise<void> {
    this.store.put(log);
  }

  /** The shared copies are the log itself: it is immutable once submitted. */
  async saveSubmitted(log: WorkoutLog): Promise<void> {
    this.store.put(log);
  }

  async sharedWith(crateId: string, from: Date, to: Date): Promise<WorkoutLog[]> {
    return this.store
      .where((l) => this.isShared(l, crateId) && l.startedAt >= from && l.startedAt < to)
      .sort(newestLogFirst);
  }

  async recentlySharedWith(crateId: string, limit: number): Promise<WorkoutLog[]> {
    return this.store
      .where((l) => this.isShared(l, crateId))
      .sort(newestLogFirst)
      .slice(0, limit);
  }

  watch(id: string): Observable<WorkoutLog | null> {
    return this.store.watch(() => this.store.get(id)).pipe(distinctUntilChanged());
  }

  watchForPeach(peachId: string): Observable<WorkoutLog[]> {
    return this.store.watch((all) => all.filter((l) => l.peachId === peachId).sort(newestLogFirst));
  }

  private isShared(log: WorkoutLog, crateId: string): boolean {
    return isSubmitted(log) && log.sharedWith.includes(crateId);
  }
}

export class InMemoryBallotRepository implements BallotRepository {
  private readonly store = new InMemoryStore<RateBallot>((b) => `${b.crateId}:${b.peachId}`);

  async forCrate(crateId: string): Promise<RateBallot[]> {
    return this.store.where((b) => b.crateId === crateId);
  }

  async save(ballot: RateBallot): Promise<void> {
    this.store.put(ballot);
  }
}

export class InMemoryLibraryRepository implements LibraryRepository {
  private readonly entryStore = new InMemoryStore<LibraryEntry>(
    (e) => `${e.crateId}:${e.exerciseId}`,
  );
  private readonly customStore = new InMemoryStore<CustomExercise>((e) => `${e.crateId}:${e.id}`);
  private readonly routineStore = new InMemoryStore<Routine>((r) => `${r.crateId}:${r.id}`);

  async entries(crateId: string): Promise<LibraryEntry[]> {
    return this.entryStore.where((e) => e.crateId === crateId);
  }

  async saveEntry(entry: LibraryEntry): Promise<void> {
    this.entryStore.put(entry);
  }

  async removeEntry(crateId: string, exerciseId: string): Promise<void> {
    this.entryStore.remove(`${crateId}:${exerciseId}`);
  }

  async customExercises(crateId: string): Promise<CustomExercise[]> {
    return this.customStore.where((e) => e.crateId === crateId);
  }

  async saveCustomExercise(exercise: CustomExercise): Promise<void> {
    this.customStore.put(exercise);
  }

  async removeCustomExercise(crateId: string, id: string): Promise<void> {
    this.customStore.remove(`${crateId}:${id}`);
  }

  async routines(crateId: string): Promise<Routine[]> {
    return this.routineStore.where((r) => r.crateId === crateId);
  }

  async getRoutine(crateId: string, id: string): Promise<Routine | null> {
    return this.routineStore.get(`${crateId}:${id}`);
  }

  async saveRoutine(routine: Routine): Promise<void> {
    this.routineStore.put(routine);
  }

  async removeRoutine(crateId: string, id: string): Promise<void> {
    this.routineStore.remove(`${crateId}:${id}`);
  }
}

/** A fresh, empty set of in-memory repositories. */
export function inMemoryRepositories(): Repositories {
  return {
    peaches: new InMemoryPeachRepository(),
    crates: new InMemoryCrateRepository(),
    seasons: new InMemorySeasonRepository(),
    logs: new InMemoryWorkoutLogRepository(),
    ballots: new InMemoryBallotRepository(),
    library: new InMemoryLibraryRepository(),
  };
}
