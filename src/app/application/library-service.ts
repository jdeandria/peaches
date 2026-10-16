import { IdGenerator } from '../domain/core/ids';
import { ExerciseCatalog } from '../domain/exercises/exercise-catalog';
import { LoggableExercise, loggableFromCatalog, LogTrack } from '../domain/exercises/loggable';
import { canManage, CrateMembership, isActiveMembership } from '../domain/models/crate';
import {
  CUSTOM_EXERCISE_PREFIX,
  CustomExercise,
  isCustomExerciseId,
  LibraryEntry,
  loggableFromCustom,
  Routine,
  RoutineItem,
} from '../domain/models/library';
import { DistanceKind } from '../domain/models/scoring';
import { WorkoutLog } from '../domain/models/workout-log';
import { CrateRepository, LibraryRepository } from '../domain/repositories';
import { DomainError } from './errors';

/** Everything in one Crate's library. */
export interface CrateLibrary {
  readonly entries: readonly LibraryEntry[];
  readonly customExercises: readonly CustomExercise[];
  readonly routines: readonly Routine[];
}

/**
 * A Crate's crowd-sourced library: any member can add catalog exercises,
 * make up custom ones and share routines; whoever added something, and the
 * Crate's owner and admins, can take it out again. It stays inside the Crate.
 */
export class LibraryService {
  constructor(
    private readonly library: LibraryRepository,
    private readonly crates: CrateRepository,
    private readonly catalog: ExerciseCatalog,
    private readonly ids: IdGenerator,
  ) {}

  async libraryOf(crateId: string): Promise<CrateLibrary> {
    const [entries, customExercises, routines] = await Promise.all([
      this.library.entries(crateId),
      this.library.customExercises(crateId),
      this.library.routines(crateId),
    ]);
    const newestFirst = (a: Date, b: Date) => b.getTime() - a.getTime();
    return {
      entries: entries.sort((a, b) => newestFirst(a.addedAt, b.addedAt)),
      customExercises: customExercises.sort((a, b) => newestFirst(a.createdAt, b.createdAt)),
      routines: routines.sort((a, b) => newestFirst(a.createdAt, b.createdAt)),
    };
  }

  async addCatalogExercise(
    crateId: string,
    exerciseId: string,
    peachId: string,
    now: Date,
  ): Promise<LibraryEntry> {
    await this.requireMember(crateId, peachId);
    if (!this.catalog.byId(exerciseId)) throw new DomainError('Unknown exercise.');
    const existing = (await this.library.entries(crateId)).find((e) => e.exerciseId === exerciseId);
    if (existing) return existing;
    const entry: LibraryEntry = { crateId, exerciseId, addedBy: peachId, addedAt: now };
    await this.library.saveEntry(entry);
    return entry;
  }

  async removeCatalogExercise(crateId: string, exerciseId: string, peachId: string): Promise<void> {
    const entry = (await this.library.entries(crateId)).find((e) => e.exerciseId === exerciseId);
    if (!entry) return;
    await this.requireOwnerOrManager(crateId, peachId, entry.addedBy);
    await this.library.removeEntry(crateId, exerciseId);
  }

  async createCustomExercise(args: {
    crateId: string;
    peachId: string;
    name: string;
    track: LogTrack;
    takesLoad: boolean;
    distanceKind: DistanceKind | null;
    now: Date;
  }): Promise<CustomExercise> {
    await this.requireMember(args.crateId, args.peachId);
    const name = args.name.trim();
    if (!name) throw new DomainError('Give the exercise a name.');
    if (name.length > 60) throw new DomainError('Keep the name under 60 characters.');
    const exercise: CustomExercise = {
      id: `${CUSTOM_EXERCISE_PREFIX}${this.ids.newId()}`,
      crateId: args.crateId,
      name,
      track: args.track,
      takesLoad: args.track === 'reps' && args.takesLoad,
      distanceKind: args.track === 'distance' ? args.distanceKind : null,
      createdBy: args.peachId,
      createdAt: args.now,
    };
    await this.library.saveCustomExercise(exercise);
    return exercise;
  }

  async removeCustomExercise(crateId: string, id: string, peachId: string): Promise<void> {
    const exercise = (await this.library.customExercises(crateId)).find((e) => e.id === id);
    if (!exercise) return;
    await this.requireOwnerOrManager(crateId, peachId, exercise.createdBy);
    await this.library.removeCustomExercise(crateId, id);
  }

  async createRoutine(args: {
    crateId: string;
    peachId: string;
    name: string;
    items: readonly RoutineItem[];
    now: Date;
  }): Promise<Routine> {
    await this.requireMember(args.crateId, args.peachId);
    const name = args.name.trim();
    if (!name) throw new DomainError('Give the routine a name.');
    if (args.items.length === 0) throw new DomainError('A routine needs at least one exercise.');
    const routine: Routine = {
      id: this.ids.newId(),
      crateId: args.crateId,
      name,
      items: args.items,
      createdBy: args.peachId,
      createdAt: args.now,
    };
    await this.library.saveRoutine(routine);
    return routine;
  }

  /** Shares a logged workout as a routine: its exercises, with each one's first set as the target. */
  saveLogAsRoutine(args: {
    crateId: string;
    log: WorkoutLog;
    name: string;
    now: Date;
  }): Promise<Routine> {
    const items: RoutineItem[] = args.log.entries.map((e) => {
      const first = e.sets[0];
      return {
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        sets: Math.max(1, e.sets.length),
        reps: first?.reps ?? null,
        seconds: first?.seconds ?? null,
        meters: first?.meters ?? null,
      };
    });
    return this.createRoutine({
      crateId: args.crateId,
      peachId: args.log.peachId,
      name: args.name,
      items,
      now: args.now,
    });
  }

  async removeRoutine(crateId: string, id: string, peachId: string): Promise<void> {
    const routine = await this.library.getRoutine(crateId, id);
    if (!routine) return;
    await this.requireOwnerOrManager(crateId, peachId, routine.createdBy);
    await this.library.removeRoutine(crateId, id);
  }

  /** Custom exercises from every Crate the Peach is active in, for the log picker. */
  async customExercisesFor(peachId: string): Promise<CustomExercise[]> {
    const lists = await Promise.all(
      (await this.activeCrateIds(peachId)).map((id) => this.library.customExercises(id)),
    );
    return lists.flat().sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }

  /** Catalog exercises any of the Peach's Crates added to its library. */
  async favouriteIdsFor(peachId: string): Promise<Set<string>> {
    const lists = await Promise.all(
      (await this.activeCrateIds(peachId)).map((id) => this.library.entries(id)),
    );
    return new Set(lists.flat().map((e) => e.exerciseId));
  }

  /** A routine from any of the Peach's Crates (a log only remembers the routine's id). */
  async findRoutine(peachId: string, routineId: string): Promise<Routine | null> {
    for (const crateId of await this.activeCrateIds(peachId)) {
      const routine = await this.library.getRoutine(crateId, routineId);
      if (routine) return routine;
    }
    return null;
  }

  private async activeCrateIds(peachId: string): Promise<string[]> {
    return (await this.crates.membershipsFor(peachId))
      .filter(isActiveMembership)
      .map((m) => m.crateId);
  }

  /** Resolves an exercise id from the catalog or one of `customs`. */
  loggable(id: string, customs: readonly CustomExercise[]): LoggableExercise | null {
    if (isCustomExerciseId(id)) {
      const custom = customs.find((c) => c.id === id);
      return custom ? loggableFromCustom(custom) : null;
    }
    const exercise = this.catalog.byId(id);
    return exercise ? loggableFromCatalog(exercise) : null;
  }

  private async membership(crateId: string, peachId: string): Promise<CrateMembership | null> {
    const memberships = await this.crates.membershipsOf(crateId);
    return memberships.find((m) => m.peachId === peachId && isActiveMembership(m)) ?? null;
  }

  private async requireMember(crateId: string, peachId: string): Promise<CrateMembership> {
    const m = await this.membership(crateId, peachId);
    if (!m) throw new DomainError('Only members can add to the library.');
    return m;
  }

  private async requireOwnerOrManager(
    crateId: string,
    peachId: string,
    createdBy: string,
  ): Promise<void> {
    const m = await this.requireMember(crateId, peachId);
    if (createdBy !== peachId && !canManage(m)) {
      throw new DomainError('Only whoever added it, or the Crate’s owner, can remove it.');
    }
  }
}
