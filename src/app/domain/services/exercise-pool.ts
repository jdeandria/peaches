import { Exercise } from '../exercises/exercise';
import { ExerciseCatalog } from '../exercises/exercise-catalog';
import { ExerciseCapability, isAble } from '../models/capability';
import { CrateSettings, DEFAULT_CRATE_SETTINGS } from '../models/crate';

export interface PoolOptions {
  readonly settings?: CrateSettings;
  readonly maxDifficulty?: number;
}

/**
 * Derives the exercises available to a set of Peaches.
 *
 * A Crate's pool is never stored: it is a pure function of its members'
 * capabilities and the Crate's settings, so it is always up to date and can
 * be computed for any subset of members (for instance the two Peaches in a
 * Matchup).
 */
export class ExercisePoolService {
  constructor(private readonly catalog: ExerciseCatalog) {}

  /** The ids a single Peach has declared they are able to do. */
  ableIdsOf(peachId: string, capabilities: Iterable<ExerciseCapability>): Set<string> {
    const ids = new Set<string>();
    for (const c of capabilities) if (c.peachId === peachId && isAble(c)) ids.add(c.exerciseId);
    return ids;
  }

  /**
   * The ids that *every* Peach in `peachIds` is able to do. Empty when
   * `peachIds` is empty.
   */
  sharedIds(peachIds: Iterable<string>, capabilities: Iterable<ExerciseCapability>): Set<string> {
    const caps = [...capabilities];
    let shared: Set<string> | undefined;
    for (const peachId of peachIds) {
      const able = this.ableIdsOf(peachId, caps);
      const previous: Set<string> | undefined = shared;
      shared = previous ? new Set([...previous].filter((id) => able.has(id))) : able;
      if (shared.size === 0) break;
    }
    return shared ?? new Set<string>();
  }

  /**
   * Resolves ids to catalog exercises and applies Crate-level exclusions.
   * Unknown ids (from a removed catalog entry) are dropped silently.
   *
   * The result is in catalog order whatever order the ids arrive in: the
   * generator's weighted draw depends on candidate order, and capabilities
   * load in different orders from different backends, so this is what lets
   * every device generate the same workout for a matchup.
   */
  resolve(exerciseIds: Iterable<string>, options: PoolOptions = {}): Exercise[] {
    const settings = options.settings ?? DEFAULT_CRATE_SETTINGS;
    const maxDifficulty = options.maxDifficulty ?? 5;
    const wanted = new Set(exerciseIds);
    const excludedIds = new Set(settings.excludedExerciseIds);
    const excludedStress = new Set(settings.excludedJointStress);
    return this.catalog.all
      .filter((e) => wanted.has(e.id))
      .filter((e) => !excludedIds.has(e.id))
      .filter((e) => e.difficulty <= maxDifficulty)
      .filter((e) => !e.jointStress.some((j) => excludedStress.has(j)));
  }

  /** Convenience: the resolved pool for a group of Peaches. */
  poolFor(
    peachIds: Iterable<string>,
    capabilities: Iterable<ExerciseCapability>,
    options: PoolOptions = {},
  ): Exercise[] {
    return this.resolve(this.sharedIds(peachIds, capabilities), options);
  }
}
