import { Exercise } from '../../../domain/exercises/exercise';
import { ExerciseCatalog } from '../../../domain/exercises/exercise-catalog';
import { MOVEMENT_PATTERNS, MovementPattern } from '../../../domain/exercises/taxonomy';
import { Fmt } from '../../format';

/** What the library is filtered by. */
export interface ExerciseFilter {
  readonly query: string;
  readonly pattern: MovementPattern | null;
  /** Only exercises in the chosen Crate's library ("In library"). */
  readonly onlyPicked: boolean;
}

/** One movement pattern's matching exercises, sorted by name. */
export interface ExerciseGroup {
  readonly pattern: MovementPattern;
  readonly exercises: readonly Exercise[];
  /** How many of `exercises` are in the chosen library. */
  readonly picked: number;
}

/** True when any filter is active; filtering expands every group by default. */
export function isFiltering(filter: ExerciseFilter): boolean {
  return filter.query.trim() !== '' || filter.pattern !== null || filter.onlyPicked;
}

/**
 * Searches and filters the catalog and groups the result per movement
 * pattern, in {@link MOVEMENT_PATTERNS} order (empty groups are dropped).
 */
export function groupExercises(
  catalog: ExerciseCatalog,
  filter: ExerciseFilter,
  picked: ReadonlySet<string>,
): ExerciseGroup[] {
  const byPattern = new Map<MovementPattern, Exercise[]>();
  for (const e of catalog.search(filter.query)) {
    if (filter.pattern !== null && e.pattern !== filter.pattern) continue;
    if (filter.onlyPicked && !picked.has(e.id)) continue;
    let list = byPattern.get(e.pattern);
    if (!list) byPattern.set(e.pattern, (list = []));
    list.push(e);
  }
  const groups: ExerciseGroup[] = [];
  for (const pattern of MOVEMENT_PATTERNS) {
    const list = byPattern.get(pattern);
    if (!list) continue;
    // Code-unit order (not locale order), stable across devices.
    list.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    groups.push({ pattern, exercises: list, picked: list.filter((e) => picked.has(e.id)).length });
  }
  return groups;
}

/**
 * Groups start collapsed; filtering flips the default to expanded, and a
 * group the Peach toggled is the opposite of the default.
 */
export function isExpanded(
  filtering: boolean,
  toggled: ReadonlySet<MovementPattern>,
  pattern: MovementPattern,
): boolean {
  return filtering !== toggled.has(pattern);
}

/** Toggles `pattern` in the set of groups that differ from the default. */
export function toggleGroup(
  toggled: ReadonlySet<MovementPattern>,
  pattern: MovementPattern,
): Set<MovementPattern> {
  const next = new Set(toggled);
  if (!next.delete(pattern)) next.add(pattern);
  return next;
}

/** "Level 3 · Dumbbell, Bench" or "Level 1 · Bodyweight". */
export function exerciseSubtitle(e: Exercise): string {
  const equipment = e.equipment.map((x) => Fmt.equipment(x)).join(', ');
  return `Level ${e.difficulty} · ${equipment || 'Bodyweight'}`;
}
