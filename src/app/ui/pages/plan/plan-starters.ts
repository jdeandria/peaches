import { stableHash } from '../../../domain/core/stable-hash';
import { isPerformableWith } from '../../../domain/exercises/exercise';
import { ExerciseCatalog } from '../../../domain/exercises/exercise-catalog';
import { LoggableExercise } from '../../../domain/exercises/loggable';
import { Equipment } from '../../../domain/exercises/taxonomy';
import { CATEGORY_INFO } from '../../../domain/models/scoring';
import { PLANNED_NAME_MAX } from '../../../domain/models/week-plan';
import { entryOf, ExerciseLogEntry, SetLog, WorkoutLog } from '../../../domain/models/workout-log';
import { lastEntry } from '../../../domain/services/last-entry';
import { templateWorkout, WORKOUT_TEMPLATES } from '../../../domain/services/workout-templates';
import { Fmt } from '../../format';
import { WorkoutStarter } from '../log/exercise-picker-sheet';

/** "4 exercises · Goblet Squat, Push Up, Row…" */
export function exercisesSummary(exercises: readonly ExerciseLogEntry[]): string {
  const names = exercises.slice(0, 3).map((e) => e.exerciseName);
  const more = exercises.length > 3 ? '…' : '';
  return `${Fmt.count(exercises.length, 'exercise')} · ${names.join(', ')}${more}`;
}

/** "Squat & Bench Press", "Run", "Squat, Row & more": a name from the exercises. */
export function suggestName(exercises: readonly ExerciseLogEntry[]): string {
  const names = exercises.map((e) => e.exerciseName);
  if (names.length === 0) return 'New workout';
  const name = names.length <= 2 ? names.join(' & ') : `${names.slice(0, 2).join(', ')} & more`;
  return name.length <= PLANNED_NAME_MAX ? name : `${names[0]} & more`.slice(0, PLANNED_NAME_MAX);
}

/**
 * An exercise as it goes on the plan, without asking for numbers: last
 * time's sets if it was done before, otherwise a sensible start (three
 * sets of ten, three 30-second holds, or one solid session's distance).
 * The numbers are turned on the dials when the set is done.
 */
export function defaultEntry(
  exercise: LoggableExercise,
  previous: ExerciseLogEntry | null | undefined,
): ExerciseLogEntry {
  if (previous && previous.sets.length > 0) {
    return entryOf(exercise, { sets: previous.sets, rpe: null, notes: null });
  }
  const set = (s: Partial<SetLog>): SetLog => ({
    reps: null,
    loadKg: null,
    seconds: null,
    meters: null,
    ...s,
  });
  let sets: SetLog[];
  switch (exercise.track) {
    case 'distance': {
      const par = exercise.distanceKind ? CATEGORY_INFO[exercise.distanceKind].par : 1;
      // Pars are in km for travel on foot or wheels, metres for the water.
      const meters = exercise.distanceKind === 'swimRow' ? par : par * 1000;
      sets = [set({ meters: exercise.distanceKind ? meters : 1000 })];
      break;
    }
    case 'time':
      sets = [1, 2, 3].map(() => set({ seconds: 30 }));
      break;
    default:
      sets = [1, 2, 3].map(() => set({ reps: 10 }));
  }
  return entryOf(exercise, { sets });
}

/** Ready-made workouts that fit `kit`, filled at random for the day (the same all day). */
export function templateStarters(args: {
  catalog: ExerciseCatalog;
  logs: readonly WorkoutLog[];
  day: string;
  kit: ReadonlySet<Equipment> | null;
}): WorkoutStarter[] {
  return WORKOUT_TEMPLATES.flatMap((template) => {
    const exercises = templateWorkout(
      template,
      args.catalog,
      stableHash(`${args.day}:${template.id}`),
      (id) => lastEntry(args.logs, id, null),
      args.kit,
    );
    if (exercises.length === 0) return [];
    return [
      {
        key: template.id,
        group: 'Templates',
        name: template.name,
        tag: template.kit,
        summary: exercisesSummary(exercises),
        exercises,
      },
    ];
  });
}

/**
 * Crate-mates' latest workouts to plan from: what they did, at my working
 * weights where I have them, keeping only what fits `kit`.
 */
export function crateStarters(args: {
  catalog: ExerciseCatalog;
  logs: readonly WorkoutLog[];
  theirs: readonly { readonly log: WorkoutLog; readonly from: string }[];
  kit: ReadonlySet<Equipment> | null;
}): WorkoutStarter[] {
  const fits = (id: string) => {
    const exercise = args.catalog.byId(id);
    return args.kit === null || !exercise || isPerformableWith(exercise, args.kit);
  };
  return args.theirs.flatMap(({ log, from }) => {
    const exercises = log.entries
      .filter((e) => e.sets.length > 0 && fits(e.exerciseId))
      .map((e): ExerciseLogEntry => {
        const mine = e.takesLoad
          ? lastEntry(args.logs, e.exerciseId, null)?.sets.at(-1)?.loadKg
          : null;
        const sets = mine == null ? e.sets : e.sets.map((s) => ({ ...s, loadKg: mine }));
        return { ...e, sets, rpe: null, notes: null };
      });
    if (exercises.length === 0) return [];
    return [
      {
        key: log.id,
        group: 'From your Crates',
        name: suggestName(exercises),
        tag: from,
        summary: exercisesSummary(exercises),
        exercises,
      },
    ];
  });
}
