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

  /**
   * Search over names and aliases, forgiving of case, hyphens, spacing and
   * plurals ("push-ups", "pushup" and "Push Up" all match), best matches
   * first (see {@link searchRank}), then by name.
   */
  search(query: string): Exercise[] {
    if (!query.trim()) return this.all;
    return this.all
      .map((e) => ({ e, rank: searchRank(query, e.name, e.aliases) }))
      .filter((r): r is { e: Exercise; rank: number } => r.rank !== null)
      .sort((a, b) => a.rank - b.rank || (a.e.name < b.e.name ? -1 : a.e.name > b.e.name ? 1 : 0))
      .map((r) => r.e);
  }
}

/** "presses" → "press", "ups" → "up". Queries and names go through it alike. */
function singular(word: string): string {
  if (word.length < 3) return word;
  if (/(sses|shes|ches|xes)$/.test(word)) return word.slice(0, -2);
  return word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word;
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(singular);
}

/**
 * How well `query` matches an exercise called `name` (or one of its
 * `aliases`): 0 (the name starts with it) .. 3 (an alias contains it), or
 * null for no match. Every word of the query must start a word of the text,
 * or (four letters or more) appear in it once spaces and hyphens are gone,
 * so "pushup" finds "Push Up" but "air" doesn't find "Chair Squat".
 */
export function searchRank(
  query: string,
  name: string,
  aliases: readonly string[] = [],
): number | null {
  const tokens = words(query);
  if (tokens.length === 0) return null;
  const whole = tokens.join('');
  let best: number | null = null;
  [name, ...aliases].forEach((text, i) => {
    const ws = words(text);
    const compact = ws.join('');
    const found = tokens.every(
      (t) => ws.some((w) => w.startsWith(t)) || (t.length >= 4 && compact.includes(t)),
    );
    if (!found) return;
    const rank = (compact.startsWith(whole) ? 0 : 2) + (i === 0 ? 0 : 1);
    if (best === null || rank < best) best = rank;
  });
  return best;
}
