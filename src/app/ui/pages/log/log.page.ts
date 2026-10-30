import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { localDateOfLocal } from '../../../domain/core/local-date';
import { LoggableExercise } from '../../../domain/exercises/loggable';
import { CategoryWeights, SCORING_CATEGORIES } from '../../../domain/models/scoring';
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
import { lastEntry } from '../../../domain/services/last-entry';
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
import { HOLD_TO_DRAG, keepFocus, SwipeRow } from '../../layout/swipe-row';
import { DisputeCard } from '../workout/dispute-card';
import { exerciseOrderItems, openExerciseOrder } from './exercise-order-sheet';
import { crateExercisesFor, openExercisePicker, recentEntries } from './exercise-picker-sheet';
import { LogDetailsData, LogDetailsDialog, LogDetailsResult } from './log-details-dialog';
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
 * The workout launched from the plan, in two modes. Its exercises, with
 * how far along each is (add one, change targets, take one out, drag
 * them into another order); and Log
 * (`?mode=log`): a full-screen runner that takes you through the sets one
 * at a time; the clock starts then and runs only while the page is open.
 * Finish shares it with your Crates. With nothing launched it points back
 * to the plan: every workout starts there. With an id it shows one of your
 * logs, which you can keep editing (exercises, when it happened, how long
 * it took).
 */
@Component({
  selector: 'pch-log-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CdkDrag,
    CdkDropList,
    DisputeCard,
    EmptyState,
    ListCard,
    LoadingIndicator,
    MatButton,
    MatIconButton,
    MatTooltip,
    Page,
    RouterLink,
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

  private readonly state = inject(AppState);
  private readonly sheet = inject(MatBottomSheet);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly injector = inject(Injector);
  protected readonly holdToDrag = HOLD_TO_DRAG;
  /** Changes to the plan's order, saved one at a time in the order they were made. */
  private saving: Promise<unknown> = Promise.resolve();

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
  /** Whether there's a draft to resume: unknown until asked. */
  private readonly resumed = signal<boolean | null>(null);
  /** Nothing launched: workouts start from the plan. */
  protected readonly nothing = computed(() => !this.logId() && this.resumed() === false);
  protected readonly loading = computed(
    () =>
      !this.nothing() &&
      (this.id() === null || (this.live.value() === undefined && !this.live.error())),
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
    return this.started() ? 'Workout in progress' : 'Your workout';
  });

  protected readonly clockHint = computed(() => {
    if (!this.draft()) return 'Session time';
    return this.started() ? 'Runs while this screen is open' : 'Starts when you start';
  });

  /** The plan's order: as last dragged, until the saved log catches up. */
  private readonly order = linkedSignal(() => this.log()?.plan.map((e) => e.exerciseId) ?? []);

  /** The session's plan, exercise by exercise, with how much is done. */
  protected readonly planned = computed<PlannedView[]>(() => {
    const log = this.log();
    if (!log) return [];
    const units = this.state.units();
    const order = this.order();
    const at = (id: string) => {
      const i = order.indexOf(id);
      return i < 0 ? order.length : i;
    };
    const plan = [...log.plan].sort((a, b) => at(a.exerciseId) - at(b.exerciseId));
    return plan.map((entry) => {
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
    (me, app) => crateExercisesFor(app, me),
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

    // The draft's clock runs only while this page is open and visible.
    void this.resumeDraft();
    const onVisibility = () =>
      document.visibilityState === 'visible' ? void this.resumeDraft() : void this.pause();
    document.addEventListener('visibilitychange', onVisibility);
    destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisibility);
      void this.pause();
    });
  }

  /** The draft whose clock is being started, so it's started once. */
  private starting: string | null = null;
  private async resumeDraft(): Promise<void> {
    const me = this.me();
    if (!me) return;
    const log = await this.state.run((app) => app.loggingService.resumeDraft(me, this.state.now()));
    if (log === undefined) return;
    this.resumed.set(log !== null);
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
      recent: recentEntries(this.myLogs() ?? [], log?.id ?? null),
      fromCrates: this.fromCrates.value() ?? [],
      loggedIds: new Set(log?.entries.map((e) => e.exerciseId) ?? []),
      units: this.state.units(),
      newId: () => this.state.app.ids.newId(),
    });
    if (exercise) await this.logExercise(exercise);
  }

  /** Re-opens an exercise: its targets while planning, else what was logged. */
  protected async editEntry(entry: ExerciseLogEntry): Promise<void> {
    if (!this.mine()) return;
    const cues = this.state.catalog.byId(entry.exerciseId)?.cues ?? null;
    await this.logExercise(loggableFromEntry(entry, cues));
  }

  /** Changes the order the workout's exercises are done in, from a sheet. */
  protected async reorder(): Promise<void> {
    const log = this.log();
    if (!log || !this.mine()) return;
    await openExerciseOrder(this.sheet, {
      items: exerciseOrderItems(log),
      reorder: (ids) => this.saveOrder(log.id, ids),
    });
    await this.saving;
  }

  protected drop(event: CdkDragDrop<unknown>): void {
    this.moveExercise(event.previousIndex, event.currentIndex);
  }

  /** Moves the exercise at `from` to `to` in the list (from the keyboard, with `event`). */
  protected moveExercise(from: number, to: number, event?: Event): void {
    event?.preventDefault();
    const log = this.log();
    const ids = this.planned().map((p) => p.entry.exerciseId);
    if (!log || !this.mine() || from === to || to < 0 || to >= ids.length) return;
    if (event) keepFocus(this.injector);
    moveItemInArray(ids, from, to);
    // Shown in the new order at once; saved behind it.
    this.order.set(ids);
    this.saveOrder(log.id, ids);
  }

  private saveOrder(logId: string, ids: string[]): void {
    this.saving = this.saving.then(() =>
      this.state.run((app) => app.loggingService.reorderPlan(logId, ids)),
    );
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
