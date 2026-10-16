import { combineLatest, distinctUntilChanged, map, Observable } from 'rxjs';

import { Repositories } from '../../application/app-container';
import { LocalDate } from '../../domain/core/local-date';
import { ExerciseCapability } from '../../domain/models/capability';
import { Crate, CrateMembership, isActiveMembership } from '../../domain/models/crate';
import { Peach } from '../../domain/models/peach';
import { involves, Matchup, Round, Season } from '../../domain/models/season';
import { Workout } from '../../domain/models/workout';
import { WorkoutLog } from '../../domain/models/workout-log';
import {
  CapabilityRepository,
  CrateRepository,
  PeachRepository,
  SeasonRepository,
  WorkoutLogRepository,
  WorkoutRepository,
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

export class InMemoryCapabilityRepository implements CapabilityRepository {
  private readonly store = new InMemoryStore<ExerciseCapability>(
    (c) => `${c.peachId}:${c.exerciseId}`,
  );

  async forPeach(peachId: string): Promise<ExerciseCapability[]> {
    return this.store.where((c) => c.peachId === peachId);
  }

  async forPeaches(peachIds: Iterable<string>): Promise<ExerciseCapability[]> {
    const ids = new Set(peachIds);
    return this.store.where((c) => ids.has(c.peachId));
  }

  async save(capability: ExerciseCapability): Promise<void> {
    this.store.put(capability);
  }

  async saveAll(capabilities: Iterable<ExerciseCapability>): Promise<void> {
    this.store.putAll(capabilities);
  }

  watchForPeach(peachId: string): Observable<ExerciseCapability[]> {
    return this.store.watch((all) => all.filter((c) => c.peachId === peachId));
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

  async matchupsFor(peachId: string, on?: LocalDate): Promise<Matchup[]> {
    const mine = this.matchups.where((m) => involves(m, peachId));
    if (on === undefined) return mine;
    return mine.filter((m) => this.rounds.get(m.roundId)?.date === on);
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

export class InMemoryWorkoutRepository implements WorkoutRepository {
  private readonly store = new InMemoryStore<Workout>((w) => w.id);

  async getById(id: string): Promise<Workout | null> {
    return this.store.get(id);
  }

  async getByIds(ids: Iterable<string>): Promise<Workout[]> {
    return present([...ids].map((id) => this.store.get(id)));
  }

  async save(workout: Workout): Promise<void> {
    this.store.put(workout);
  }
}

export class InMemoryWorkoutLogRepository implements WorkoutLogRepository {
  private readonly store = new InMemoryStore<WorkoutLog>((l) => l.id);

  async getById(id: string): Promise<WorkoutLog | null> {
    return this.store.get(id);
  }

  async forMatchup(matchupId: string, peachId: string): Promise<WorkoutLog | null> {
    return (
      this.store.values.find((l) => l.matchupId === matchupId && l.peachId === peachId) ?? null
    );
  }

  async forPeach(peachId: string): Promise<WorkoutLog[]> {
    return this.store.where((l) => l.peachId === peachId).sort(newestLogFirst);
  }

  async save(log: WorkoutLog): Promise<void> {
    this.store.put(log);
  }

  watch(id: string): Observable<WorkoutLog | null> {
    return this.store.watch(() => this.store.get(id)).pipe(distinctUntilChanged());
  }

  watchForPeach(peachId: string): Observable<WorkoutLog[]> {
    return this.store.watch((all) => all.filter((l) => l.peachId === peachId).sort(newestLogFirst));
  }
}

/** A fresh, empty set of in-memory repositories. */
export function inMemoryRepositories(): Repositories {
  return {
    peaches: new InMemoryPeachRepository(),
    crates: new InMemoryCrateRepository(),
    capabilities: new InMemoryCapabilityRepository(),
    seasons: new InMemorySeasonRepository(),
    workouts: new InMemoryWorkoutRepository(),
    logs: new InMemoryWorkoutLogRepository(),
  };
}
