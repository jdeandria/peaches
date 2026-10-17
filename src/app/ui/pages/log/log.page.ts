import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { localDateOfLocal } from '../../../domain/core/local-date';
import { LoggableExercise } from '../../../domain/exercises/loggable';
import { CategoryWeights, SCORING_CATEGORIES } from '../../../domain/models/scoring';
import {
  elapsedSeconds,
  entryFor,
  ExerciseLogEntry,
  isSubmitted,
  loggableFromEntry,
  WorkoutLog,
} from '../../../domain/models/workout-log';
import { lastEntry } from '../../../domain/services/last-entry';
import { MetricExtractor } from '../../../domain/services/metric-extractor';
import { AppState } from '../../../state/app-state';
import { LoadingIndicator } from '../../expressive/loading-indicator';
import { Fmt } from '../../format';
import { Card } from '../../layout/card';
import { EmptyState } from '../../layout/empty-state';
import { ListCard } from '../../layout/list-card';
import { Page } from '../../layout/page';
import { Section } from '../../layout/section';
import { Stagger } from '../../layout/stagger';
import { DisputeCard } from '../workout/dispute-card';
import { CrateExercise, openExercisePicker } from './exercise-picker-sheet';
import { LogDetailsData, LogDetailsDialog, LogDetailsResult } from './log-details-dialog';
import { openSetLogger } from './set-logger-sheet';

/** How often the clock ticks while a workout is on. */
const CLOCK_MS = 1000;

interface EntryView {
  readonly entry: ExerciseLogEntry;
  readonly summary: string;
}

/**
 * Log a workout, solo, as fast as possible: opening the page starts (or
 * resumes) the clock, which runs only while the page is open. Pick an
 * exercise (your recent ones and your crate-mates' come first), check the
 * sets it pre-filled from last time, save; Finish shares it with your
 * Crates. With an id it shows one of your logs, which you can keep editing
 * (exercises, when it happened, how long it took).
 */
@Component({
  selector: 'pch-log-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Card,
    DisputeCard,
    EmptyState,
    ListCard,
    LoadingIndicator,
    MatButton,
    MatIconButton,
    MatTooltip,
    Page,
    Section,
    Stagger,
  ],
  templateUrl: './log.page.html',
  styleUrl: './log.page.scss',
})
export class LogPage {
  /** Route param for a specific log; without it, the draft. */
  readonly logId = input<string>();

  private readonly state = inject(AppState);
  private readonly sheet = inject(MatBottomSheet);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

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

  /** Ticks every second while the clock runs. */
  private readonly tick = signal(this.state.now());
  protected readonly clock = computed(() => {
    const log = this.log();
    return log ? Fmt.clock(elapsedSeconds(log, this.tick())) : '';
  });

  protected readonly title = computed(() => {
    const log = this.log();
    if (log && isSubmitted(log)) return Fmt.day(localDateOfLocal(log.startedAt));
    return 'Log a workout';
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
   * This week's matchups: the Season's weights, for points per Crate, and
   * my pledges with how much of each the logs shared so far have done.
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
        return side ? [{ crate: b.crate, weights: b.season.rules.weights, side }] : [];
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

  /** While a workout is on: my pledges this week, counting it. */
  protected readonly pledges = computed(() => {
    const log = this.log();
    if (!log || !this.draft()) return [];
    const extra = MetricExtractor.extract(log);
    const units = this.state.units();
    const boards = this.boards.value() ?? [];
    return boards.flatMap(({ crate, side }) =>
      side.score.pledges.map((p) => {
        const done = p.amount + extra[p.category];
        return {
          key: `${crate.id}:${p.category}`,
          crate: boards.length > 1 ? crate.name : null,
          icon: Fmt.categoryIcon(p.category),
          label: Fmt.category(p.category),
          progress: `${Fmt.amount(p.category, done, units)} of ${Fmt.amount(p.category, p.target, units)}`,
          hit: done >= p.target,
        };
      }),
    );
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

  /** Picks an exercise and logs it. */
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

  /** Re-opens a logged exercise. */
  protected async editEntry(entry: ExerciseLogEntry): Promise<void> {
    if (!this.mine()) return;
    const cues = this.state.catalog.byId(entry.exerciseId)?.cues ?? null;
    await this.logExercise(loggableFromEntry(entry, cues));
  }

  /** Removes at once (it's one tap from the row), with Undo to put the sets back. */
  protected async removeEntry(entry: ExerciseLogEntry): Promise<void> {
    const log = this.log();
    if (!log || !this.mine()) return;
    const removed = await this.state.run((app) =>
      app.loggingService.removeEntry(log.id, entry.exerciseId),
    );
    if (!removed) return;
    this.state.toast(`Removed ${entry.exerciseName}.`, () => {
      void this.state.run((app) => app.loggingService.recordEntry(log.id, entry));
    });
  }

  private async logExercise(exercise: LoggableExercise): Promise<void> {
    const log = this.log();
    if (!log || !this.mine()) return;
    const entry = await openSetLogger(this.sheet, {
      exercise,
      existing: entryFor(log, exercise.id),
      previous: lastEntry(this.myLogs() ?? [], exercise.id, log.id),
      units: this.state.units(),
    });
    if (!entry || entry.sets.length === 0) return;
    await this.state.run((app) => app.loggingService.recordEntry(log.id, entry));
  }

  /** Stops the clock and shares the workout. */
  protected async finish(): Promise<void> {
    const log = this.log();
    if (!log || this.busy()) return;
    this.busy.set(true);
    const done = await this.state.run(
      (app) => app.loggingService.submit(log.id, this.state.now()),
      'Workout logged. Nice work.',
    );
    this.busy.set(false);
    if (done) await this.router.navigate(['/log', done.id], { replaceUrl: true });
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

  /** Whether the Peach is in any Crate (for the empty-state hint). */
  protected readonly inCrates = computed(() => (this.state.myCrates.value() ?? []).length > 0);

  /** Row clicks edit too (pointer convenience; the buttons are the controls). */
  protected rowClick(event: MouseEvent, entry: ExerciseLogEntry): void {
    if ((event.target as Element).closest('button')) return;
    if (getSelection()?.toString()) return;
    void this.editEntry(entry);
  }
}
