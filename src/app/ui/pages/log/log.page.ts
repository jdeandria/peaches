import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { localDateOfLocal } from '../../../domain/core/local-date';
import { LoggableExercise } from '../../../domain/exercises/loggable';
import { CategoryWeights, SCORING_CATEGORIES } from '../../../domain/models/scoring';
import { Routine } from '../../../domain/models/routine';
import {
  doneCount,
  elapsedSeconds,
  entryFor,
  ExerciseLogEntry,
  hasStarted,
  isSubmitted,
  loggableFromEntry,
  nextPlannedSet,
  plannedFor,
  planProgress,
  WorkoutLog,
} from '../../../domain/models/workout-log';
import { stableHash } from '../../../domain/core/stable-hash';
import { lastEntry } from '../../../domain/services/last-entry';
import {
  templateWorkout,
  WORKOUT_TEMPLATES,
  WorkoutTemplate,
} from '../../../domain/services/workout-templates';
import { MetricExtractor } from '../../../domain/services/metric-extractor';
import { AppState } from '../../../state/app-state';
import { LoadingIndicator } from '../../expressive/loading-indicator';
import { Fmt } from '../../format';
import { confirmDialog } from '../../layout/confirm-dialog';
import { EmptyState } from '../../layout/empty-state';
import { ListCard } from '../../layout/list-card';
import { Page } from '../../layout/page';
import { Section } from '../../layout/section';
import { Stagger } from '../../layout/stagger';
import { SwipeRow } from '../../layout/swipe-row';
import { DisputeCard } from '../workout/dispute-card';
import { CrateExercise, openExercisePicker } from './exercise-picker-sheet';
import { LogDetailsData, LogDetailsDialog, LogDetailsResult } from './log-details-dialog';
import { SaveRoutineData, SaveRoutineDialog, SaveRoutineResult } from './save-routine-dialog';
import { SessionRunner } from './session-runner';
import { openSetLogger } from './set-logger-sheet';

/** How often the clock ticks while a workout is on. */
const CLOCK_MS = 1000;

interface EntryView {
  readonly entry: ExerciseLogEntry;
  readonly summary: string;
}

interface PlannedView extends EntryView {
  readonly done: number;
  readonly complete: boolean;
}

/**
 * Log a workout, solo, in two modes. Plan: pick exercises (your recent ones
 * and your crate-mates' come first, or a saved routine), each pre-filled
 * from last time, and set their target sets. Log (`?mode=log`): Start, and
 * a full-screen runner takes you through the sets one at a time; the clock
 * starts then and runs only while the page is open. Finish shares it with
 * your Crates. With an id it shows one of your logs, which you can keep
 * editing (exercises, when it happened, how long it took).
 */
@Component({
  selector: 'pch-log-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DisputeCard,
    EmptyState,
    ListCard,
    LoadingIndicator,
    MatButton,
    MatIconButton,
    MatTooltip,
    Page,
    Section,
    SessionRunner,
    Stagger,
    SwipeRow,
  ],
  templateUrl: './log.page.html',
  styleUrl: './log.page.scss',
})
export class LogPage {
  /** Route param for a specific log; without it, the draft. */
  readonly logId = input<string>();
  /** Query param: `log` while doing the sets (which starts the clock), else planning. */
  readonly mode = input<string>();
  /** Query param: a routine of mine to plan, when nothing is planned yet. */
  readonly routine = input<string>();

  private readonly state = inject(AppState);
  private readonly sheet = inject(MatBottomSheet);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  protected readonly busy = signal(false);

  private readonly me = this.state.peachId;
  private readonly myLogs = this.state.myLogs.value;
  private readonly draftId = signal<string | null>(null);
  private readonly id = computed(() => this.logId() ?? this.draftId());
  private readonly live = this.state.watch(
    () => this.id() ?? undefined,
    (id, app) => app.logs.watch(id),
  );
  protected readonly log = computed<WorkoutLog | null>(() =>
    this.id() === null ? null : (this.live.value() ?? null),
  );
  protected readonly loading = computed(
    () => this.id() === null || (this.live.value() === undefined && !this.live.error()),
  );
  protected readonly mine = computed(() => this.log()?.peachId === this.me());
  protected readonly draft = computed(() => {
    const log = this.log();
    return log !== null && !isSubmitted(log);
  });
  protected readonly started = computed(() => {
    const log = this.log();
    return log !== null && hasStarted(log);
  });
  protected readonly running = computed(() => this.draft() && this.mode() === 'log');
  /** Whether this page put the runner on the history stack (so Back closes it). */
  private pushedRunner = false;

  /** Ticks every second while the clock runs. */
  private readonly tick = signal(this.state.now());
  protected readonly clock = computed(() => {
    const log = this.log();
    return log ? Fmt.clock(elapsedSeconds(log, this.tick())) : '';
  });

  protected readonly title = computed(() => {
    const log = this.log();
    if (log && isSubmitted(log)) return Fmt.day(localDateOfLocal(log.startedAt));
    return this.started() ? 'Workout in progress' : 'Plan your workout';
  });

  protected readonly clockHint = computed(() => {
    if (!this.draft()) return 'Session time';
    return this.started() ? 'Runs while this screen is open' : 'Starts when you start';
  });

  /** The session's plan, exercise by exercise, with how much is done. */
  protected readonly planned = computed<PlannedView[]>(() => {
    const log = this.log();
    if (!log) return [];
    const units = this.state.units();
    return log.plan.map((entry) => {
      const done = doneCount(log, entry.exerciseId);
      return {
        entry,
        summary: Fmt.entrySummary(entry, units),
        done,
        complete: done >= entry.sets.length,
      };
    });
  });
  protected readonly progress = computed(() => {
    const log = this.log();
    return log ? planProgress(log) : { done: 0, total: 0 };
  });
  protected readonly hasNext = computed(() => {
    const log = this.log();
    return log !== null && nextPlannedSet(log) !== null;
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
  /**
   * Ready-made workouts, filled with exercises at random: the mix changes
   * each day and on Shuffle, with weights from last time.
   */
  protected readonly templates = computed(() => {
    const day = localDateOfLocal(this.state.now());
    const shuffles = this.shuffles();
    const logs = this.myLogs() ?? [];
    return WORKOUT_TEMPLATES.map((template) => {
      const seed = stableHash(`${day}:${template.id}:${shuffles[template.id] ?? 0}`);
      const exercises = templateWorkout(template, this.state.catalog, seed, (id) =>
        lastEntry(logs, id, null),
      );
      return { template, exercises, summary: exercisesSummary(exercises) };
    });
  });

  protected shuffle(template: WorkoutTemplate): void {
    this.shuffles.update((s) => ({ ...s, [template.id]: (s[template.id] ?? 0) + 1 }));
  }

  /** Plans a template's exercises, as shuffled. */
  protected async useTemplate(exercises: readonly ExerciseLogEntry[]): Promise<void> {
    const log = this.log();
    if (!log) return;
    await this.state.run((app) => app.loggingService.addToPlan(log.id, exercises));
  }

  protected readonly subtitle = computed(() => {
    const log = this.log();
    if (log && isSubmitted(log)) {
      return `${Fmt.time(log.startedAt)}${log.notes ? ` · ${log.notes}` : ''}`;
    }
    const crates = this.state.myCrates.value()?.length ?? 0;
    return crates === 0 ? 'Just for you' : `Counts in ${Fmt.count(crates, 'Crate')}`;
  });

  protected readonly entries = computed<EntryView[]>(() => {
    const units = this.state.units();
    return (this.log()?.entries ?? []).map((entry) => ({
      entry,
      summary: Fmt.entrySummary(entry, units),
    }));
  });

  /** What the log adds up to, per category. */
  protected readonly totals = computed(() => {
    const log = this.log();
    if (!log || log.entries.length === 0) return [];
    const totals = MetricExtractor.extract(log);
    const units = this.state.units();
    return SCORING_CATEGORIES.filter((c) => totals[c] > 0).map((c) => ({
      category: c,
      icon: Fmt.categoryIcon(c),
      label: Fmt.category(c),
      amount: Fmt.amount(c, totals[c], units),
    }));
  });

  /**
   * This week's matchups: the Season's weights, for points per Crate.
   */
  private readonly boards = this.state.query(
    () => {
      const me = this.me();
      const open = this.state.myMatchups.value()?.filter((m) => m.status === 'inProgress');
      return me && open ? { me, ids: open.map((m) => m.id) } : undefined;
    },
    async ({ me, ids }, app) => {
      const boards = await Promise.all(ids.map((id) => app.seasonService.board(id)));
      return boards.flatMap((b) => {
        if (!b) return [];
        const side = b.home.peachId === me ? b.home : b.away;
        return side ? [{ crate: b.crate, weights: b.season.rules.weights }] : [];
      });
    },
  );

  /** Points this log is worth in each Crate with a week under way. */
  protected readonly cratePoints = computed(() => {
    const log = this.log();
    if (!log || log.entries.length === 0) return [];
    return (this.boards.value() ?? []).map(({ crate, weights }) => ({
      name: crate.name,
      points: Fmt.points(this.pointsIn(log, weights)),
    }));
  });

  /** Disputes crate-mates raised about this log, in every Crate it is shared with. */
  private readonly disputeQuery = this.state.query(
    () => {
      const log = this.log();
      return log && isSubmitted(log) && this.mine() ? log : undefined;
    },
    async (log, app) => {
      const lists = await Promise.all(
        log.sharedWith.map(async (crateId) =>
          (await app.disputeService.views(crateId, [log])).map((view) => ({ crateId, view })),
        ),
      );
      const disputes = lists.flat();
      const ids = [...new Set(disputes.map((d) => d.view.dispute.openedBy))];
      const names = new Map((await app.peaches.getByIds(ids)).map((p) => [p.id, p.displayName]));
      return { disputes, names };
    },
  );
  protected readonly disputes = computed(() => this.disputeQuery.value()?.disputes ?? []);
  protected readonly disputeNames = computed(
    () => this.disputeQuery.value()?.names ?? new Map<string, string>(),
  );
  protected crateName(id: string): string {
    return this.state.myCrates.value()?.find((c) => c.id === id)?.name ?? 'a Crate';
  }

  /** Exercises crate-mates have logged, with who logged them, for the picker. */
  private readonly fromCrates = this.state.query(
    () => this.me() ?? undefined,
    async (me, app): Promise<CrateExercise[]> => {
      const shared = (await app.loggingService.crateExercises(me)).filter((s) => s.peachId !== me);
      const peaches = await app.peaches.getByIds(new Set(shared.map((s) => s.peachId)));
      const names = new Map(peaches.map((p) => [p.id, p.displayName]));
      const byExercise = new Map<
        string,
        { exercise: CrateExercise['exercise']; from: Set<string> }
      >();
      for (const s of shared) {
        const row = byExercise.get(s.exercise.id) ?? {
          exercise: { ...s.exercise, cues: app.catalog.byId(s.exercise.id)?.cues ?? null },
          from: new Set<string>(),
        };
        row.from.add(names.get(s.peachId) ?? 'a crate-mate');
        byExercise.set(s.exercise.id, row);
      }
      return [...byExercise.values()]
        .map(({ exercise, from }) => ({ exercise, from: Fmt.names([...from].sort()) }))
        .sort((a, b) => (a.exercise.name < b.exercise.name ? -1 : 1));
    },
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    const timer = setInterval(() => this.tick.set(this.state.now()), CLOCK_MS);
    destroyRef.onDestroy(() => clearInterval(timer));
    if (this.logId()) return;

    // Opening the runner starts the workout (links from Train go straight there).
    effect(() => {
      const log = this.log();
      if (!log || !this.running() || hasStarted(log) || this.starting === log.id) return;
      this.starting = log.id;
      void this.state.run((app) => app.loggingService.startSession(log.id, this.state.now()));
    });

    // A routine to start from: plan it into an empty draft, once.
    effect(() => {
      const id = this.routine();
      const log = this.log();
      const routines = this.routineList.value();
      if (!id || !log || routines === undefined) return;
      untracked(() => void this.planRoutineOnce(log, routines.find((r) => r.id === id) ?? null));
    });

    // The draft's clock runs only while this page is open and visible.
    void this.openDraft();
    const onVisibility = () =>
      document.visibilityState === 'visible' ? void this.openDraft() : void this.pause();
    document.addEventListener('visibilitychange', onVisibility);
    destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisibility);
      void this.pause();
    });
  }

  /** The draft whose clock is being started, so it's started once. */
  private starting: string | null = null;
  private routinePlanned = false;
  private async planRoutineOnce(log: WorkoutLog, routine: Routine | null): Promise<void> {
    if (this.routinePlanned) return;
    this.routinePlanned = true;
    if (routine && log.plan.length === 0 && log.entries.length === 0) {
      await this.state.run((app) => app.loggingService.addToPlan(log.id, routine.exercises));
    }
    await this.router.navigate([], {
      queryParams: { routine: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private async openDraft(): Promise<void> {
    const me = this.me();
    if (!me) return;
    const log = await this.state.run((app) => app.loggingService.openDraft(me, this.state.now()));
    if (log) this.draftId.set(log.id);
  }

  private async pause(): Promise<void> {
    const log = this.log();
    if (log && !isSubmitted(log)) {
      await this.state.run((app) => app.loggingService.pauseTimer(log.id, this.state.now()));
    }
  }

  private pointsIn(log: WorkoutLog, weights: CategoryWeights): number {
    return this.state.app.scoring.scoreLog(log, weights).total;
  }

  /** Picks an exercise and plans it (or, on a finished workout, logs it). */
  protected async addExercise(): Promise<void> {
    const log = this.log();
    const exercise = await openExercisePicker(this.sheet, {
      catalog: this.state.catalog,
      recent: this.recentEntries(log?.id ?? null),
      fromCrates: this.fromCrates.value() ?? [],
      loggedIds: new Set(log?.entries.map((e) => e.exerciseId) ?? []),
      units: this.state.units(),
      newId: () => this.state.app.ids.newId(),
    });
    if (exercise) await this.logExercise(exercise);
  }

  /** The latest entry for each exercise in my other logs, newest first. */
  private recentEntries(excludingLogId: string | null): ExerciseLogEntry[] {
    const seen = new Map<string, ExerciseLogEntry>();
    for (const log of this.myLogs() ?? []) {
      if (log.id === excludingLogId) continue;
      for (const e of log.entries) if (!seen.has(e.exerciseId)) seen.set(e.exerciseId, e);
    }
    return [...seen.values()];
  }

  /** Re-opens an exercise: its targets while planning, else what was logged. */
  protected async editEntry(entry: ExerciseLogEntry): Promise<void> {
    if (!this.mine()) return;
    const cues = this.state.catalog.byId(entry.exerciseId)?.cues ?? null;
    await this.logExercise(loggableFromEntry(entry, cues));
  }

  /** Removes at once (it's one tap from the row), with Undo to put the sets back. */
  protected async removeEntry(entry: ExerciseLogEntry): Promise<void> {
    const log = this.log();
    if (!log || !this.mine()) return;
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
  }

  private async logExercise(exercise: LoggableExercise): Promise<void> {
    const log = this.log();
    if (!log || !this.mine()) return;
    const planning = !isSubmitted(log);
    const entry = await openSetLogger(this.sheet, {
      exercise,
      existing: planning ? plannedFor(log, exercise.id) : entryFor(log, exercise.id),
      previous: lastEntry(this.myLogs() ?? [], exercise.id, log.id),
      units: this.state.units(),
      mode: planning ? 'plan' : 'log',
    });
    if (!entry || entry.sets.length === 0) return;
    await this.state.run((app) =>
      planning
        ? app.loggingService.planExercise(log.id, entry)
        : app.loggingService.recordEntry(log.id, entry),
    );
  }

  /** Starts (or carries on with) the workout: the runner, set by set. */
  protected async startWorkout(): Promise<void> {
    const log = this.log();
    if (!log || this.busy()) return;
    const started = await this.state.run((app) =>
      app.loggingService.startSession(log.id, this.state.now()),
    );
    if (!started) return;
    this.pushedRunner = true;
    await this.router.navigate([], { queryParams: { mode: 'log' } });
  }

  /** Back to planning. */
  protected closeRunner(): void {
    if (this.pushedRunner) {
      this.pushedRunner = false;
      this.location.back();
      return;
    }
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  /** Plans a routine's exercises after anything already planned. */
  protected async useRoutine(routine: Routine): Promise<void> {
    const log = this.log();
    if (!log) return;
    await this.state.run((app) => app.loggingService.addToPlan(log.id, routine.exercises));
  }

  /** Deletes a routine at once, with Undo. */
  protected async deleteRoutine(routine: Routine): Promise<void> {
    const me = this.me();
    if (!me) return;
    const removed = await this.state.run((app) => app.routineService.remove(me, routine.id));
    if (!removed) return;
    this.state.toast(`Deleted “${routine.name}”.`, () => {
      void this.state.run((app) => app.routineService.restore(removed));
    });
  }

  /** Keeps this session's plan as a routine (or replaces one of the same name). */
  protected async saveRoutine(): Promise<void> {
    const log = this.log();
    const me = this.me();
    if (!log || !me || log.plan.length === 0) return;
    const routines = this.routineList.value() ?? [];
    const ref = this.dialog.open<SaveRoutineDialog, SaveRoutineData, SaveRoutineResult>(
      SaveRoutineDialog,
      {
        data: { routines, suggestion: suggestRoutineName(log.plan) },
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
          ? app.routineService.update(
              me,
              result.replaces.id,
              { name: result.name, exercises: log.plan },
              now,
            )
          : app.routineService.create(me, result.name, log.plan, now),
      result.replaces ? `Updated “${result.name}”.` : `Saved “${result.name}”.`,
    );
  }

  /**
   * Stops the clock and shares the workout. With planned sets still to do,
   * asks first: they won't be logged.
   */
  protected async finish(): Promise<void> {
    const log = this.log();
    if (!log || this.busy()) return;
    const progress = planProgress(log);
    if (progress.done < progress.total) {
      const left = progress.total - progress.done;
      const go = await confirmDialog(this.dialog, {
        title: 'Finish now?',
        message: `${Fmt.count(left, 'planned set')} ${left === 1 ? 'isn’t' : 'aren’t'} done and won’t be logged. Everything you did will be.`,
        action: 'Finish',
      });
      if (!go) return;
    }
    this.busy.set(true);
    const done = await this.state.run(
      (app) => app.loggingService.submit(log.id, this.state.now()),
      'Workout logged. Nice work.',
    );
    this.busy.set(false);
    if (done) await this.router.navigate(['/log', done.id], { replaceUrl: true });
  }

  /** Deletes this finished workout, with Undo, and goes back. */
  protected async deleteWorkout(): Promise<void> {
    const log = this.log();
    const me = this.me();
    if (!log || !me || this.busy()) return;
    const day = this.title();
    const removed = await this.state.run((app) => app.loggingService.deleteLog(log.id, me));
    if (!removed) return;
    this.state.toast(`Deleted ${day}’s workout.`, () => {
      void this.state.run((app) => app.loggingService.restoreLog(removed));
    });
    await this.router.navigate(['/'], { replaceUrl: true });
  }

  /** Corrects when the workout happened, how long it took, and its notes. */
  protected async editDetails(): Promise<void> {
    const log = this.log();
    if (!log) return;
    const ref = this.dialog.open<LogDetailsDialog, LogDetailsData, LogDetailsResult>(
      LogDetailsDialog,
      { data: { log }, width: '420px', maxWidth: 'calc(100vw - 32px)' },
    );
    const details = await firstValueFrom(ref.afterClosed());
    if (!details) return;
    await this.state.run(
      (app) => app.loggingService.editDetails(log.id, details, this.state.now()),
      'Workout updated.',
    );
  }

  /** Row clicks edit too (pointer convenience; the buttons are the controls). */
  protected rowClick(event: MouseEvent, entry: ExerciseLogEntry): void {
    if ((event.target as Element).closest('button')) return;
    if (getSelection()?.toString()) return;
    void this.editEntry(entry);
  }
}

/** "Squat & Bench Press", "Run", "Squat, Row & more": a name from what's planned. */
function suggestRoutineName(plan: readonly ExerciseLogEntry[]): string {
  const names = plan.map((e) => e.exerciseName);
  if (names.length <= 2) return names.join(' & ').slice(0, 40);
  return `${names.slice(0, 2).join(', ')} & more`.slice(0, 40);
}

/** "4 exercises · Goblet Squat, Push Up, Row…" */
function exercisesSummary(exercises: readonly ExerciseLogEntry[]): string {
  const names = exercises.slice(0, 3).map((e) => e.exerciseName);
  const more = exercises.length > 3 ? '…' : '';
  return `${Fmt.count(exercises.length, 'exercise')} · ${names.join(', ')}${more}`;
}
