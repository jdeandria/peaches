import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatTooltip } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { LocalDate, parseLocalDate, startOfWeek } from '../../../domain/core/local-date';
import { stableHash } from '../../../domain/core/stable-hash';
import { LoggableExercise } from '../../../domain/exercises/loggable';
import { isSeasonOpen } from '../../../domain/models/season';
import {
  daysOf,
  isInWeek,
  PlannedWorkout,
  PLANNED_NAME_MAX,
} from '../../../domain/models/week-plan';
import {
  ExerciseLogEntry,
  isSubmitted,
  loggableFromEntry,
} from '../../../domain/models/workout-log';
import { lastEntry } from '../../../domain/services/last-entry';
import {
  templateWorkout,
  WORKOUT_TEMPLATES,
  WorkoutTemplate,
} from '../../../domain/services/workout-templates';
import { AppState } from '../../../state/app-state';
import { ButtonGroup, ButtonGroupOption } from '../../expressive/button-group';
import { LoadingIndicator } from '../../expressive/loading-indicator';
import { Fmt } from '../../format';
import { EmptyState } from '../../layout/empty-state';
import { ListCard } from '../../layout/list-card';
import { Page } from '../../layout/page';
import { Section } from '../../layout/section';
import { Stagger } from '../../layout/stagger';
import { SwipeRow } from '../../layout/swipe-row';
import { crateExercisesFor, openExercisePicker, recentEntries } from '../log/exercise-picker-sheet';
import { SaveRoutineData, SaveRoutineDialog, SaveRoutineResult } from '../log/save-routine-dialog';
import { openSetLogger } from '../log/set-logger-sheet';

const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' });

/** "Mon" for a date. */
function weekdayOf(date: LocalDate): string {
  return WEEKDAY.format(new Date(`${date}T00:00:00Z`));
}

/** "4 exercises · Goblet Squat, Push Up, Row…" */
function exercisesSummary(exercises: readonly ExerciseLogEntry[]): string {
  const names = exercises.slice(0, 3).map((e) => e.exerciseName);
  const more = exercises.length > 3 ? '…' : '';
  return `${Fmt.count(exercises.length, 'exercise')} · ${names.join(', ')}${more}`;
}

/** "Squat & Bench Press", "Run", "Squat, Row & more": a name from the exercises. */
function suggestName(exercises: readonly ExerciseLogEntry[]): string {
  const names = exercises.map((e) => e.exerciseName);
  if (names.length === 0) return 'Workout';
  const name = names.length <= 2 ? names.join(' & ') : `${names.slice(0, 2).join(', ')} & more`;
  return name.length <= PLANNED_NAME_MAX ? name : `${names[0]} & more`.slice(0, PLANNED_NAME_MAX);
}

/**
 * Plans one workout of a week: its day, where (a location's equipment
 * decides which exercises and templates are offered), and its exercises
 * with target sets, from scratch, a routine or a template. Shows what it's
 * worth in each Crate with a Season on. Nothing is saved until Save.
 */
@Component({
  selector: 'pch-planned-workout-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ButtonGroup,
    EmptyState,
    ListCard,
    LoadingIndicator,
    MatButton,
    MatFormField,
    MatIconButton,
    MatInput,
    MatLabel,
    MatTooltip,
    Page,
    Section,
    Stagger,
    SwipeRow,
  ],
  templateUrl: './planned-workout.page.html',
  styleUrl: './planned-workout.page.scss',
})
export class PlannedWorkoutPage {
  /** Route param: the Monday of the week. */
  readonly week = input.required<string>();
  /** Route param: a planned workout's id, or `new`. */
  readonly workoutId = input.required<string>();
  /** Query param: the day a new workout goes on. */
  readonly day = input<string>();

  protected readonly state = inject(AppState);
  private readonly router = inject(Router);
  private readonly sheet = inject(MatBottomSheet);
  private readonly dialog = inject(MatDialog);
  protected readonly nameMax = PLANNED_NAME_MAX;
  protected readonly busy = signal(false);

  private readonly me = this.state.peachId;
  private readonly myLogs = this.state.myLogs.value;

  protected readonly monday = computed<LocalDate | null>(() => {
    try {
      return startOfWeek(parseLocalDate(this.week()));
    } catch {
      return null;
    }
  });
  protected readonly isNew = computed(() => this.workoutId() === 'new');

  private readonly planQuery = this.state.query(
    () => {
      const me = this.me();
      const monday = this.monday();
      return me && monday ? { me, monday } : undefined;
    },
    ({ me, monday }, app) => app.planService.plan(me, monday, this.state.now()),
  );
  protected readonly existing = computed(() => {
    const plan = this.planQuery.value();
    if (!plan || this.isNew()) return null;
    return plan.workouts.find((w) => w.id === this.workoutId()) ?? null;
  });
  /** loading → spinner; missing → not found; ready. */
  protected readonly phase = computed(() => {
    if (this.monday() === null) return 'missing';
    const plan = this.planQuery.value();
    if (plan === undefined) return this.planQuery.error() ? 'missing' : 'loading';
    return this.isNew() || this.existing() ? 'ready' : 'missing';
  });

  // The workout as it's being edited.
  protected readonly name = signal('');
  protected readonly date = signal<LocalDate | null>(null);
  protected readonly locationId = signal<string | null>(null);
  protected readonly exercises = signal<readonly ExerciseLogEntry[]>([]);
  private seeded = false;

  constructor() {
    // Start from the saved workout, or a new one on the day asked for.
    effect(() => {
      if (this.phase() !== 'ready' || this.seeded) return;
      const monday = this.monday()!;
      const existing = this.existing();
      untracked(() => {
        this.seeded = true;
        if (existing) {
          this.name.set(existing.name);
          this.date.set(existing.day);
          this.locationId.set(existing.locationId);
          this.exercises.set(existing.exercises);
          return;
        }
        const asked = this.day();
        const today = this.state.today();
        this.date.set(
          asked && isInWeek(monday, asked as LocalDate)
            ? (asked as LocalDate)
            : isInWeek(monday, today)
              ? today
              : monday,
        );
        this.locationId.set(this.state.peach.value()?.locations[0]?.id ?? null);
      });
    });
  }

  protected readonly title = computed(() =>
    this.isNew() ? 'Plan a workout' : (this.existing()?.name ?? 'Workout'),
  );
  protected readonly subtitle = computed(() => {
    const monday = this.monday();
    return monday ? Fmt.week(monday) : undefined;
  });
  protected readonly done = computed(() => {
    const logId = this.existing()?.logId;
    const log = logId ? this.myLogs()?.find((l) => l.id === logId) : undefined;
    return !!log && isSubmitted(log);
  });

  /** A workout for today can start straight away (and every workout starts from the plan). */
  protected readonly canStart = computed(() => this.date() === this.state.today() && !this.done());

  protected readonly dayOptions = computed<ButtonGroupOption<LocalDate>[]>(() => {
    const monday = this.monday();
    if (!monday) return [];
    return daysOf(monday).map((d) => ({ value: d, label: weekdayOf(d) }));
  });

  protected readonly locations = computed(() => this.state.peach.value()?.locations ?? []);
  private readonly location = computed(
    () => this.locations().find((l) => l.id === this.locationId()) ?? null,
  );
  private readonly kit = computed(() => {
    const l = this.location();
    return l ? { name: l.name, equipment: new Set(l.equipment) } : null;
  });

  protected readonly rows = computed(() => {
    const units = this.state.units();
    return this.exercises().map((entry) => ({ entry, summary: Fmt.entrySummary(entry, units) }));
  });
  protected readonly setCount = computed(() =>
    this.exercises().reduce((n, e) => n + e.sets.length, 0),
  );
  protected readonly placeholder = computed(() => suggestName(this.exercises()));

  /** The weights of each Crate with a Season on, to show what the workout is worth there. */
  private readonly seasons = this.state.query(
    () => {
      const crates = this.state.myCrates.value();
      return crates && crates.length > 0 ? crates : undefined;
    },
    async (crates, app) => {
      const lists = await Promise.all(
        crates.map(async (crate) => {
          const season = (await app.seasons.forCrate(crate.id)).find(isSeasonOpen);
          return season ? [{ crate: crate.name, weights: season.rules.weights }] : [];
        }),
      );
      return lists.flat();
    },
  );
  protected readonly worth = computed(() => {
    const exercises = this.exercises();
    if (exercises.length === 0) return [];
    return (this.seasons.value() ?? []).map(({ crate, weights }) => ({
      crate,
      points: Fmt.points(this.state.app.scoring.scorePlan(exercises, weights).total),
    }));
  });

  /** My saved routines, to plan from. */
  private readonly routineList = this.state.watch(
    () => this.me() ?? undefined,
    (id, app) => app.routines.watchForPeach(id),
  );
  protected readonly routines = computed(() =>
    (this.routineList.value() ?? []).map((routine) => ({
      routine,
      summary: exercisesSummary(routine.exercises),
    })),
  );

  /** Times each template was shuffled, so a reshuffle draws a fresh mix. */
  private readonly shuffles = signal<Readonly<Record<string, number>>>({});
  /** Ready-made workouts that fit where it's planned, filled at random. */
  protected readonly templates = computed(() => {
    const date = this.date() ?? this.state.today();
    const shuffles = this.shuffles();
    const logs = this.myLogs() ?? [];
    const kit = this.kit()?.equipment ?? null;
    return WORKOUT_TEMPLATES.map((template) => {
      const seed = stableHash(`${date}:${template.id}:${shuffles[template.id] ?? 0}`);
      const exercises = templateWorkout(
        template,
        this.state.catalog,
        seed,
        (id) => lastEntry(logs, id, null),
        kit,
      );
      return { template, exercises, summary: exercisesSummary(exercises) };
    }).filter((t) => t.exercises.length > 0);
  });

  private readonly fromCrates = this.state.query(
    () => this.me() ?? undefined,
    (me, app) => crateExercisesFor(app, me),
  );

  protected setDay(day: LocalDate | null): void {
    if (day) this.date.set(day);
  }

  protected setLocation(id: string | null): void {
    this.locationId.set(id);
  }

  protected shuffle(template: WorkoutTemplate): void {
    this.shuffles.update((s) => ({ ...s, [template.id]: (s[template.id] ?? 0) + 1 }));
  }

  /** Adds exercises after those already planned, skipping repeats. */
  protected use(exercises: readonly ExerciseLogEntry[], name?: string): void {
    const have = new Set(this.exercises().map((e) => e.exerciseId));
    const added = exercises.filter((e) => e.sets.length > 0 && !have.has(e.exerciseId));
    this.exercises.update((list) => [...list, ...added]);
    if (name && !this.name().trim()) this.name.set(name);
  }

  protected async addExercise(): Promise<void> {
    const exercise = await openExercisePicker(this.sheet, {
      catalog: this.state.catalog,
      recent: recentEntries(this.myLogs() ?? []),
      fromCrates: this.fromCrates.value() ?? [],
      loggedIds: new Set(this.exercises().map((e) => e.exerciseId)),
      units: this.state.units(),
      newId: () => this.state.app.ids.newId(),
      kit: this.kit(),
    });
    if (exercise) await this.setTargets(exercise);
  }

  protected async editEntry(entry: ExerciseLogEntry): Promise<void> {
    const cues = this.state.catalog.byId(entry.exerciseId)?.cues ?? null;
    await this.setTargets(loggableFromEntry(entry, cues));
  }

  /** Takes an exercise out, with Undo to put it back where it was. */
  protected removeEntry(entry: ExerciseLogEntry): void {
    const at = this.exercises().findIndex((e) => e.exerciseId === entry.exerciseId);
    this.exercises.update((list) => list.filter((e) => e.exerciseId !== entry.exerciseId));
    this.state.toast(`Removed ${entry.exerciseName}.`, () => {
      this.exercises.update((list) => {
        const next = [...list];
        next.splice(at, 0, entry);
        return next;
      });
    });
  }

  /** Opens the set logger for an exercise's targets, and keeps them. */
  private async setTargets(exercise: LoggableExercise): Promise<void> {
    const existing = this.exercises().find((e) => e.exerciseId === exercise.id);
    const entry = await openSetLogger(this.sheet, {
      exercise,
      existing,
      previous: lastEntry(this.myLogs() ?? [], exercise.id, null),
      units: this.state.units(),
      mode: 'plan',
    });
    if (!entry || entry.sets.length === 0) return;
    this.exercises.update((list) =>
      existing
        ? list.map((e) => (e.exerciseId === entry.exerciseId ? entry : e))
        : [...list, entry],
    );
  }

  /** Back to the plan, on the week this workout is in. */
  private async backToPlan(): Promise<void> {
    const monday = this.monday();
    const next = monday !== null && monday > startOfWeek(this.state.today());
    await this.router.navigate(['/'], {
      queryParams: next ? { week: 'next' } : {},
      replaceUrl: true,
    });
  }

  /** Saves it to the plan, then starts it in the log. */
  protected async saveAndStart(): Promise<void> {
    const me = this.me();
    const monday = this.monday();
    const saved = await this.persist(false);
    if (!saved || !me || !monday) return;
    this.busy.set(true);
    const log = await this.state.run((app) =>
      app.planService.launch(me, monday, saved.id, this.state.now()),
    );
    this.busy.set(false);
    if (log) {
      await this.router.navigate(['/log'], { queryParams: { mode: 'log' }, replaceUrl: true });
    } else {
      await this.backToPlan();
    }
  }

  protected async save(): Promise<void> {
    if (await this.persist()) await this.backToPlan();
  }

  /** Saves the workout to the plan (saying so, if `announce`); undefined if it couldn't be. */
  private async persist(announce = true): Promise<PlannedWorkout | undefined> {
    const me = this.me();
    const monday = this.monday();
    const day = this.date();
    if (!me || !monday || !day || this.busy() || this.exercises().length === 0) return undefined;
    this.busy.set(true);
    const saved = await this.state.run(
      (app) =>
        app.planService.saveWorkout({
          peachId: me,
          weekStart: monday,
          workout: {
            id: this.existing()?.id,
            day,
            name: this.name().trim() || this.placeholder(),
            locationId: this.locationId(),
            exercises: this.exercises(),
          },
          now: this.state.now(),
        }),
      announce ? (this.isNew() ? `Planned for ${Fmt.day(day)}.` : 'Plan updated.') : undefined,
    );
    this.busy.set(false);
    return saved;
  }

  /** Takes it off the plan, with Undo, and goes back. */
  protected async delete(): Promise<void> {
    const me = this.me();
    const monday = this.monday();
    const existing = this.existing();
    if (!me || !monday || !existing || this.busy()) return;
    const removed = await this.state.run((app) =>
      app.planService.removeWorkout(me, monday, existing.id, this.state.now()),
    );
    if (!removed) return;
    this.state.toast(`Took “${existing.name}” off the plan.`, () => {
      void this.state.run((app) =>
        app.planService.restoreWorkout(me, monday, removed, this.state.now()),
      );
    });
    await this.backToPlan();
  }

  /** Keeps the exercises as a routine (or replaces one of the same name). */
  protected async saveRoutine(): Promise<void> {
    const me = this.me();
    const exercises = this.exercises();
    if (!me || exercises.length === 0) return;
    const ref = this.dialog.open<SaveRoutineDialog, SaveRoutineData, SaveRoutineResult>(
      SaveRoutineDialog,
      {
        data: {
          routines: this.routineList.value() ?? [],
          suggestion: this.name().trim() || this.placeholder(),
        },
        width: '420px',
        maxWidth: 'calc(100vw - 32px)',
      },
    );
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;
    const now = this.state.now();
    await this.state.run(
      (app) =>
        result.replaces
          ? app.routineService.update(me, result.replaces.id, { name: result.name, exercises }, now)
          : app.routineService.create(me, result.name, exercises, now),
      result.replaces ? `Updated “${result.name}”.` : `Saved “${result.name}”.`,
    );
  }

  /** Deletes a routine at once, with Undo. */
  protected async deleteRoutine(id: string): Promise<void> {
    const me = this.me();
    if (!me) return;
    const removed = await this.state.run((app) => app.routineService.remove(me, id));
    if (!removed) return;
    this.state.toast(`Deleted “${removed.name}”.`, () => {
      void this.state.run((app) => app.routineService.restore(removed));
    });
  }

  /** Row clicks edit too (pointer convenience; the buttons are the controls). */
  protected rowClick(event: MouseEvent, entry: ExerciseLogEntry): void {
    if ((event.target as Element).closest('button')) return;
    if (getSelection()?.toString()) return;
    void this.editEntry(entry);
  }
}
