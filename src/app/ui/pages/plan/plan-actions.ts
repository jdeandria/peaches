import { computed, inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { LocalDate } from '../../../domain/core/local-date';
import { LoggableExercise } from '../../../domain/exercises/loggable';
import { PlannedWorkout } from '../../../domain/models/week-plan';
import {
  entryFor,
  ExerciseLogEntry,
  plannedFor,
  WorkoutLog,
} from '../../../domain/models/workout-log';
import { lastEntry } from '../../../domain/services/last-entry';
import { AppState } from '../../../state/app-state';
import { Fmt } from '../../format';
import {
  crateExercisesFor,
  openExercisePicker,
  recentEntries,
  WorkoutStarter,
} from '../log/exercise-picker-sheet';
import { SaveRoutineData, SaveRoutineDialog, SaveRoutineResult } from '../log/save-routine-dialog';
import {
  crateStarters,
  defaultEntry,
  exercisesSummary,
  suggestName,
  templateStarters,
} from './plan-starters';

/** Crate-mates' latest workouts offered to start from. */
const CRATE_WORKOUTS = 5;

/** What the picker came back with: one exercise, or a whole workout to start from. */
type Picked =
  | { readonly kind: 'exercise'; readonly exercise: LoggableExercise }
  | { readonly kind: 'starter'; readonly starter: WorkoutStarter };

/**
 * Everything the Plan screen does to a week's workouts, in one place for
 * the page and its workout cards: plan one on a day (from an exercise, a
 * routine, a crate-mate's workout or a template), add, remove and reorder
 * its exercises, move it, say where, keep it as a routine, take it off the
 * plan, and start it at any exercise. Changes save as they're made.
 *
 * Exercises go on with last time's sets (or a sensible start) rather than
 * asking for numbers: they're dialled in set by set when it's done.
 *
 * Provided by the Plan page, so its queries live as long as the page.
 */
@Injectable()
export class PlanActions {
  private readonly state = inject(AppState);
  private readonly router = inject(Router);
  private readonly sheet = inject(MatBottomSheet);
  private readonly dialog = inject(MatDialog);

  private readonly me = this.state.peachId;
  private readonly myLogs = this.state.myLogs.value;

  private readonly fromCrates = this.state.query(
    () => this.me() ?? undefined,
    (me, app) => crateExercisesFor(app, me),
  );

  private readonly routineList = this.state.watch(
    () => this.me() ?? undefined,
    (id, app) => app.routines.watchForPeach(id),
  );

  /** Crate-mates' latest workouts (one of each), newest first, with who did them. */
  private readonly crateLogs = this.state.query(
    () => {
      const me = this.me();
      const crates = this.state.myCrates.value();
      return me && crates && crates.length > 0 ? { me, crates } : undefined;
    },
    async ({ me, crates }, app) => {
      const lists = await Promise.all(crates.map((c) => app.logs.recentlySharedWith(c.id, 8)));
      const seen = new Set<string>();
      const logs = lists
        .flat()
        .filter((log) => log.peachId !== me)
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
        .filter((log) => {
          // The same workout twice (two Crates, or a regular) shows once.
          const key = log.entries
            .map((e) => e.exerciseId)
            .sort()
            .join();
          if (seen.has(log.id) || seen.has(key)) return false;
          seen.add(log.id).add(key);
          return true;
        })
        .slice(0, CRATE_WORKOUTS);
      const peaches = await app.peaches.getByIds(new Set(logs.map((l) => l.peachId)));
      const names = new Map(peaches.map((p) => [p.id, p.displayName]));
      return logs.map((log) => ({ log, from: names.get(log.peachId) ?? 'A crate-mate' }));
    },
  );

  /** My equipment locations, for Where. */
  readonly locations = computed(() => this.state.peach.value()?.locations ?? []);

  private kitOf(locationId: string | null) {
    const l = this.locations().find((x) => x.id === locationId);
    return l ? { name: l.name, equipment: new Set(l.equipment) } : null;
  }

  /** Whole workouts to start a day's workout from: routines, crate-mates', templates. */
  private starters(day: LocalDate): WorkoutStarter[] {
    const logs = this.myLogs() ?? [];
    const catalog = this.state.catalog;
    return [
      ...(this.routineList.value() ?? []).map((r) => ({
        key: r.id,
        group: 'Your routines',
        name: r.name,
        tag: null,
        summary: exercisesSummary(r.exercises),
        exercises: r.exercises,
        removable: true,
      })),
      ...crateStarters({ catalog, logs, theirs: this.crateLogs.value() ?? [], kit: null }),
      ...templateStarters({ catalog, logs, day, kit: null }),
    ];
  }

  /** Opens the exercise picker; with `day`, whole workouts are offered first. */
  private async pick(args: {
    kit: ReturnType<PlanActions['kitOf']>;
    have: readonly ExerciseLogEntry[];
    excludingLogId?: string | null;
    day?: LocalDate;
  }): Promise<Picked | undefined> {
    let starter: WorkoutStarter | undefined;
    const exercise = await openExercisePicker(this.sheet, {
      catalog: this.state.catalog,
      recent: recentEntries(this.myLogs() ?? [], args.excludingLogId ?? null),
      fromCrates: this.fromCrates.value() ?? [],
      loggedIds: new Set(args.have.map((e) => e.exerciseId)),
      units: this.state.units(),
      newId: () => this.state.app.ids.newId(),
      kit: args.kit,
      starters: args.day ? this.starters(args.day) : [],
      useStarter: (w) => (starter = w),
      removeStarter: (w) => void this.deleteRoutine(w.key),
    });
    if (starter) return { kind: 'starter', starter };
    return exercise ? { kind: 'exercise', exercise } : undefined;
  }

  /** An exercise as it goes on a plan: last time's sets, or a sensible start. */
  private entryFor(exercise: LoggableExercise, excludingLogId: string | null): ExerciseLogEntry {
    return defaultEntry(exercise, lastEntry(this.myLogs() ?? [], exercise.id, excludingLogId));
  }

  /** Plans a workout on `day` from what's picked; resolves with its id, or null. */
  async addWorkout(monday: LocalDate, day: LocalDate): Promise<string | null> {
    const me = this.me();
    if (!me) return null;
    const picked = await this.pick({ kit: null, have: [], day });
    if (!picked) return null;
    const exercises =
      picked.kind === 'starter'
        ? picked.starter.exercises.filter((e) => e.sets.length > 0)
        : [this.entryFor(picked.exercise, null)];
    const name = picked.kind === 'starter' ? picked.starter.name : suggestName(exercises);
    // No toast: it appears on its day, open.
    const saved = await this.state.run((app) =>
      app.planService.saveWorkout({
        peachId: me,
        weekStart: monday,
        workout: { day, name, locationId: null, exercises },
        now: this.state.now(),
      }),
    );
    return saved?.id ?? null;
  }

  /** Adds an exercise to a workout: to its plan, or to the session if it's under way. */
  async addExercise(monday: LocalDate, w: PlannedWorkout, log: WorkoutLog | null): Promise<void> {
    const have = log ? log.plan : w.exercises;
    const picked = await this.pick({
      kit: this.kitOf(w.locationId),
      have,
      excludingLogId: log?.id ?? null,
    });
    if (picked?.kind !== 'exercise') return;
    const entry = this.entryFor(picked.exercise, log?.id ?? null);
    if (log) {
      await this.state.run((app) => app.loggingService.planExercise(log.id, entry));
      return;
    }
    if (w.exercises.some((e) => e.exerciseId === entry.exerciseId)) return;
    await this.save(monday, w, { exercises: [...w.exercises, entry] });
  }

  /** Changes an exercise's planned sets: on the plan, or the session's if it's under way. */
  async updateExercise(
    monday: LocalDate,
    w: PlannedWorkout,
    log: WorkoutLog | null,
    entry: ExerciseLogEntry,
  ): Promise<void> {
    if (log) {
      await this.state.run((app) => app.loggingService.planExercise(log.id, entry));
      return;
    }
    await this.save(monday, w, {
      exercises: w.exercises.map((e) => (e.exerciseId === entry.exerciseId ? entry : e)),
    });
  }

  /** Takes an exercise out, with Undo; the last one takes the workout off the plan. */
  async removeExercise(
    monday: LocalDate,
    w: PlannedWorkout,
    log: WorkoutLog | null,
    entry: ExerciseLogEntry,
  ): Promise<void> {
    if (log) {
      const logged = entryFor(log, entry.exerciseId);
      const planned = plannedFor(log, entry.exerciseId);
      const at = log.plan.findIndex((e) => e.exerciseId === entry.exerciseId);
      const removed = await this.state.run((app) =>
        app.loggingService.removeEntry(log.id, entry.exerciseId),
      );
      if (!removed) return;
      this.state.toast(`Removed ${entry.exerciseName}.`, () => {
        void this.state.run(async (app) => {
          if (planned) await app.loggingService.planExercise(log.id, planned, at);
          if (logged) await app.loggingService.recordEntry(log.id, logged);
        });
      });
      return;
    }
    const left = w.exercises.filter((e) => e.exerciseId !== entry.exerciseId);
    if (left.length === 0) {
      await this.takeOff(monday, w);
      return;
    }
    if (!(await this.save(monday, w, { exercises: left }))) return;
    this.state.toast(`Removed ${entry.exerciseName}.`, () => {
      void this.save(monday, { ...w, exercises: left }, { exercises: w.exercises });
    });
  }

  /** Moves the exercise at `from` to `to`. */
  async moveExercise(
    monday: LocalDate,
    w: PlannedWorkout,
    log: WorkoutLog | null,
    ids: readonly string[],
    from: number,
    to: number,
  ): Promise<void> {
    if (from === to || to < 0 || to >= ids.length) return;
    const order = [...ids];
    order.splice(to, 0, ...order.splice(from, 1));
    if (log) {
      await this.state.run((app) => app.loggingService.reorderPlan(log.id, order));
      return;
    }
    const byId = new Map(w.exercises.map((e) => [e.exerciseId, e]));
    await this.save(monday, w, { exercises: order.flatMap((id) => byId.get(id) ?? []) });
  }

  /**
   * Starts the workout (or carries on with it), at one exercise if given:
   * the runner does that one now, then follows the plan's order. Without
   * one, it takes the first with sets left.
   */
  async play(
    monday: LocalDate,
    w: PlannedWorkout,
    exerciseId: string | null = null,
  ): Promise<void> {
    const me = this.me();
    if (!me) return;
    const log = await this.state.run((app) =>
      app.planService.launch(me, monday, w.id, this.state.now()),
    );
    if (!log) return;
    await this.router.navigate(['/log'], {
      queryParams: exerciseId ? { mode: 'log', exercise: exerciseId } : { mode: 'log' },
    });
  }

  /** Takes a workout off the plan at once, with Undo. */
  async takeOff(monday: LocalDate, w: PlannedWorkout): Promise<void> {
    const me = this.me();
    if (!me) return;
    const removed = await this.state.run((app) =>
      app.planService.removeWorkout(me, monday, w.id, this.state.now()),
    );
    if (!removed) return;
    this.state.toast(`Took “${w.name}” off ${Fmt.day(w.day)}.`, () => {
      void this.state.run((app) =>
        app.planService.restoreWorkout(me, monday, removed, this.state.now()),
      );
    });
  }

  async moveTo(monday: LocalDate, w: PlannedWorkout, day: LocalDate): Promise<void> {
    if (day !== w.day && (await this.save(monday, w, { day }))) {
      this.state.toast(`Moved “${w.name}” to ${Fmt.day(day)}.`);
    }
  }

  async setWhere(monday: LocalDate, w: PlannedWorkout, locationId: string | null): Promise<void> {
    if (locationId !== w.locationId) await this.save(monday, w, { locationId });
  }

  /** Keeps a workout's exercises as a routine (or replaces one of the same name). */
  async saveRoutine(w: PlannedWorkout, exercises: readonly ExerciseLogEntry[]): Promise<void> {
    const me = this.me();
    if (!me || exercises.length === 0) return;
    const ref = this.dialog.open<SaveRoutineDialog, SaveRoutineData, SaveRoutineResult>(
      SaveRoutineDialog,
      {
        data: { routines: this.routineList.value() ?? [], suggestion: w.name },
        width: '420px',
        maxWidth: 'calc(100vw - 32px)',
      },
    );
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;
    const now = this.state.now();
    const planned = exercises.map((e) => ({ ...e, rpe: null, notes: null }));
    await this.state.run(
      (app) =>
        result.replaces
          ? app.routineService.update(
              me,
              result.replaces.id,
              { name: result.name, exercises: planned },
              now,
            )
          : app.routineService.create(me, result.name, planned, now),
      result.replaces ? `Updated “${result.name}”.` : `Saved “${result.name}”.`,
    );
  }

  /** Deletes a routine at once, with Undo. */
  private async deleteRoutine(id: string): Promise<void> {
    const me = this.me();
    if (!me) return;
    const removed = await this.state.run((app) => app.routineService.remove(me, id));
    if (!removed) return;
    this.state.toast(`Deleted “${removed.name}”.`, () => {
      void this.state.run((app) => app.routineService.restore(removed));
    });
  }

  /**
   * Saves changes to a planned workout. A name that was suggested from the
   * exercises follows them; one picked or typed stays.
   */
  private async save(
    monday: LocalDate,
    w: PlannedWorkout,
    changes: Partial<Pick<PlannedWorkout, 'day' | 'locationId' | 'exercises'>>,
  ): Promise<boolean> {
    const me = this.me();
    if (!me) return false;
    const exercises = changes.exercises ?? w.exercises;
    const name = w.name === suggestName(w.exercises) ? suggestName(exercises) : w.name;
    const saved = await this.state.run((app) =>
      app.planService.saveWorkout({
        peachId: me,
        weekStart: monday,
        workout: {
          id: w.id,
          day: changes.day ?? w.day,
          name,
          locationId: changes.locationId !== undefined ? changes.locationId : w.locationId,
          exercises,
        },
        now: this.state.now(),
      }),
    );
    return !!saved;
  }
}
