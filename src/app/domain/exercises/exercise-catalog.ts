import { STANDARD_CATALOG_VERSION, STANDARD_EXERCISES } from './catalog-data';
import { Exercise, isPerformableWith } from './exercise';
import { Equipment, Modality, MovementPattern } from './taxonomy';

/**
 * An indexed, read-only collection of {@link Exercise}s.
 *
 * The default catalog ships with the app ({@link ExerciseCatalog.standard});
 * tests and future remote-config catalogs construct their own instances.
 */
export class ExerciseCatalog {
  private readonly byIdMap: ReadonlyMap<string, Exercise>;

  constructor(
    exercises: Iterable<Exercise>,
    readonly version = 0,
  ) {
    const list = [...exercises];
    this.byIdMap = new Map(list.map((e) => [e.id, e]));
    if (this.byIdMap.size !== list.length) throw new Error('Exercise ids must be unique');
  }

  private static standardInstance?: ExerciseCatalog;

  /** The catalog bundled with this build of the app (shared, immutable). */
  static standard(): ExerciseCatalog {
    return (ExerciseCatalog.standardInstance ??= new ExerciseCatalog(
      STANDARD_EXERCISES,
      STANDARD_CATALOG_VERSION,
    ));
  }

  get length(): number {
    return this.byIdMap.size;
  }

  get all(): Exercise[] {
    return [...this.byIdMap.values()];
  }

  byId(id: string): Exercise | undefined {
    return this.byIdMap.get(id);
  }

  /**
   * Looks up an exercise, throwing if the id is unknown. Prefer {@link byId}
   * when handling user data that may reference a removed exercise.
   */
  require(id: string): Exercise {
    const exercise = this.byIdMap.get(id);
    if (!exercise) throw new RangeError(`Unknown exercise: ${id}`);
    return exercise;
  }

  /** Resolves ids in order, dropping unknown ones. */
  byIds(ids: Iterable<string>): Exercise[] {
    const out: Exercise[] = [];
    for (const id of ids) {
      const e = this.byIdMap.get(id);
      if (e) out.push(e);
    }
    return out;
  }

  withPattern(pattern: MovementPattern): Exercise[] {
    return this.all.filter((e) => e.pattern === pattern);
  }

  withModality(modality: Modality): Exercise[] {
    return this.all.filter((e) => e.modality === modality);
  }

  inFamily(family: string): Exercise[] {
    return this.all.filter((e) => e.family === family);
  }

  /** Exercises performable with exactly the given equipment (or none). */
  performableWith(available: ReadonlySet<Equipment>): Exercise[] {
    return this.all.filter((e) => isPerformableWith(e, available));
  }

  /** Case-insensitive search over name and aliases. */
  search(query: string): Exercise[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.all;
    return this.all.filter(
      (e) => e.name.toLowerCase().includes(q) || e.aliases.some((a) => a.toLowerCase().includes(q)),
    );
  }
}
