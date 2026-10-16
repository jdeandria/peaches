import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { AppContainer } from '../../../application/app-container';
import { localDateOfLocal } from '../../../domain/core/local-date';
import { LoggableExercise } from '../../../domain/exercises/loggable';
import { Crate } from '../../../domain/models/crate';
import { RoutineItem } from '../../../domain/models/library';
import { CategoryWeights, SCORING_CATEGORIES } from '../../../domain/models/scoring';
import {
  entryFor,
  ExerciseLogEntry,
  isSubmitted,
  WorkoutLog,
} from '../../../domain/models/workout-log';
import { LoadHistory } from '../../../domain/services/load-history';
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
import { openExercisePicker } from './exercise-picker-sheet';
import { SaveRoutineDialog, SaveRoutineData } from './save-routine-dialog';
import { openSetLogger } from './set-logger-sheet';
import {
  SubmitLogData,
  SubmitLogDialog,
  SubmitLogResult,
  suggestedMinutes,
} from './submit-log-dialog';

/** A Crate with a Season under way, and the weights it scores with. */
interface ScoringCrate {
  readonly crate: Crate;
  readonly weights: CategoryWeights;
}

interface EntryView {
  readonly entry: ExerciseLogEntry;
  readonly summary: string;
}

/**
 * Log a workout, solo: pick exercises from the catalog or your Crates'
 * libraries, record sets, submit. Opened without an id it continues your
 * unsubmitted log (or starts one on the first exercise); `?routine=` starts
 * from a Crate routine. With an id it shows a log, read-only once submitted.
 */
@Component({
  selector: 'pch-log-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Card,
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
  /** Route param for a specific log. */
  readonly logId = input<string>();
  /** Query param: start from this routine. */
  readonly routine = input<string>();

  private readonly state = inject(AppState);
  private readonly sheet = inject(MatBottomSheet);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  protected readonly fmt = Fmt;
  protected readonly busy = signal(false);

  private readonly me = this.state.peachId;
  private readonly myLogs = this.state.myLogs.value;
  private readonly createdId = signal<string | null>(null);
  /** The log on screen: the one asked for, else my draft (or the one just created). */
  private readonly id = computed(
    () =>
      this.logId() ??
      this.createdId() ??
      this.myLogs()?.find((l) => !isSubmitted(l) && l.peachId === this.me())?.id ??
      null,
  );
  private readonly live = this.state.watch(
    () => this.id() ?? undefined,
    (id, app) => app.logs.watch(id),
  );
  protected readonly log = computed<WorkoutLog | null>(() =>
    this.id() === null ? null : (this.live.value() ?? null),
  );
  protected readonly loading = computed(
    () => this.myLogs() === undefined || (this.id() !== null && this.live.value() === undefined),
  );
  protected readonly mine = computed(() => {
    const log = this.log();
    return log === null || log.peachId === this.me();
  });
  protected readonly submitted = computed(() => {
    const log = this.log();
    return log !== null && isSubmitted(log);
  });
  protected readonly editable = computed(() => this.mine() && !this.submitted());

  /** Custom exercises and library picks from my Crates, for the picker and routines. */
  private readonly crateLibrary = this.state.query(
    () => this.me() ?? undefined,
    async (me, app) => ({
      customs: await app.libraryService.customExercisesFor(me),
      favouriteIds: await app.libraryService.favouriteIdsFor(me),
    }),
  );

  /** The routine being followed: from the URL, else the one the log was started from. */
  private readonly routineQuery = this.state.query(
    () => {
      const id = this.routine() ?? this.log()?.routineId ?? undefined;
      const me = this.me();
      return id && me ? { id, me } : undefined;
    },
    ({ id, me }, app) => app.libraryService.findRoutine(me, id),
  );
  protected readonly followed = computed(() => this.routineQuery.value() ?? null);

  /** Crates with a Season under way: where this log will score. */
  private readonly scoringCrates = this.state.query(
    () => this.state.myCrates.value(),
    async (crates, app) => {
      const out: ScoringCrate[] = [];
      for (const crate of crates) {
        const season = (await app.seasons.forCrate(crate.id)).find((s) => s.status === 'active');
        if (season) out.push({ crate, weights: season.weights });
      }
      return out;
    },
  );

  protected readonly title = computed(() => {
    const log = this.log();
    if (log && isSubmitted(log)) return Fmt.day(localDateOfLocal(log.startedAt));
    return 'Log a workout';
  });

  protected readonly subtitle = computed(() => {
    const routine = this.followed();
    const crates = this.state.myCrates.value()?.length ?? 0;
    if (routine) return `Following “${routine.name}”`;
    if (this.submitted()) return this.log()?.notes ?? undefined;
    return crates === 0 ? 'Just for you' : `Counts in ${Fmt.count(crates, 'Crate')}`;
  });

  protected readonly entries = computed<EntryView[]>(() => {
    const units = this.state.units();
    return (this.log()?.entries ?? []).map((entry) => ({
      entry,
      summary: Fmt.entrySummary(entry, units),
    }));
  });

  /** Routine exercises not logged yet. */
  protected readonly planned = computed<RoutineItem[]>(() => {
    const routine = this.followed();
    if (!routine || !this.editable()) return [];
    const log = this.log();
    return routine.items.filter((i) => !log || !entryFor(log, i.exerciseId));
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

  /** Points this log is worth in each Crate with a Season under way. */
  protected readonly cratePoints = computed(() => {
    const log = this.log();
    if (!log || log.entries.length === 0) return [];
    return (this.scoringCrates.value() ?? []).map(({ crate, weights }) => ({
      name: crate.name,
      points: Fmt.points(this.state.app.scoring.scoreLog(log, weights).total),
    }));
  });

  /** Picks an exercise and logs it. */
  protected async addExercise(): Promise<void> {
    const library = this.crateLibrary.value();
    const exercise = await openExercisePicker(this.sheet, {
      catalog: this.state.catalog,
      customs: library?.customs ?? [],
      favouriteIds: library?.favouriteIds ?? new Set(),
      loggedIds: new Set(this.log()?.entries.map((e) => e.exerciseId) ?? []),
    });
    if (exercise) await this.logExercise(exercise);
  }

  /** Logs a routine exercise, starting from its target. */
  protected async logPlanned(item: RoutineItem): Promise<void> {
    const exercise = this.loggable(item.exerciseId);
    if (!exercise) {
      this.state.toast(`${item.exerciseName} isn’t in your Crates’ libraries any more.`);
      return;
    }
    await this.logExercise(exercise, item);
  }

  /** Re-opens a logged exercise. */
  protected async editEntry(entry: ExerciseLogEntry): Promise<void> {
    if (!this.editable()) return;
    // An exercise whose library entry is gone still edits the way it was logged.
    const fallback: LoggableExercise = {
      id: entry.exerciseId,
      name: entry.exerciseName,
      track: entry.sets.some((s) => s.meters !== null)
        ? 'distance'
        : entry.sets.some((s) => s.reps !== null)
          ? 'reps'
          : 'time',
      takesLoad: entry.sets.some((s) => s.loadKg !== null),
      distanceKind: entry.distanceKind,
      cues: null,
    };
    await this.logExercise(this.loggable(entry.exerciseId) ?? fallback);
  }

  protected async removeEntry(entry: ExerciseLogEntry): Promise<void> {
    const log = this.log();
    if (!log || !this.editable()) return;
    await this.state.run((app) => app.loggingService.removeEntry(log.id, entry.exerciseId));
  }

  private loggable(id: string): LoggableExercise | null {
    return this.state.app.libraryService.loggable(id, this.crateLibrary.value()?.customs ?? []);
  }

  private async logExercise(exercise: LoggableExercise, target?: RoutineItem): Promise<void> {
    if (!this.editable()) return;
    const current = this.log();
    const routineTarget =
      target ?? this.followed()?.items.find((i) => i.exerciseId === exercise.id) ?? null;
    const entry = await openSetLogger(this.sheet, {
      exercise,
      existing: current ? entryFor(current, exercise.id) : null,
      target: routineTarget,
      units: this.state.units(),
      previousLoadsKg: exercise.takesLoad
        ? LoadHistory.lastLoadsKg(this.myLogs() ?? [], exercise.id, current?.id)
        : null,
    });
    if (!entry || entry.sets.length === 0) return;
    await this.state.run(async (app) => {
      const log = await this.ensureLog(app);
      await app.loggingService.recordEntry(log.id, entry, this.state.now());
    });
  }

  private async ensureLog(app: AppContainer): Promise<WorkoutLog> {
    const existing = this.log();
    if (existing) return existing;
    const me = this.me();
    if (!me) throw new Error('Not signed in');
    const log = await app.loggingService.startLog(
      me,
      this.state.now(),
      this.followed() ?? undefined,
    );
    this.createdId.set(log.id);
    return log;
  }

  protected async submit(): Promise<void> {
    const log = this.log();
    if (!log || this.busy()) return;
    const ref = this.dialog.open<SubmitLogDialog, SubmitLogData, SubmitLogResult>(SubmitLogDialog, {
      data: {
        minutes: suggestedMinutes(log.startedAt, this.state.now()),
        crateCount: this.state.myCrates.value()?.length ?? 0,
      },
      width: '420px',
      maxWidth: 'calc(100vw - 32px)',
    });
    const details = await firstValueFrom(ref.afterClosed());
    if (!details) return;
    this.busy.set(true);
    const done = await this.state.run(
      (app) => app.loggingService.submit(log.id, this.state.now(), details),
      'Workout logged. Nice work.',
    );
    this.busy.set(false);
    if (done) await this.router.navigate(['/']);
  }

  protected shareAsRoutine(): void {
    const log = this.log();
    const crates = this.state.myCrates.value() ?? [];
    if (!log || crates.length === 0) return;
    this.dialog.open<SaveRoutineDialog, SaveRoutineData>(SaveRoutineDialog, {
      data: { log, crates },
      width: '420px',
      maxWidth: 'calc(100vw - 32px)',
    });
  }

  protected readonly hasCrates = computed(() => (this.state.myCrates.value()?.length ?? 0) > 0);

  /** Row clicks edit too (pointer convenience; the buttons are the controls). */
  protected rowClick(event: MouseEvent, entry: ExerciseLogEntry): void {
    if ((event.target as Element).closest('button')) return;
    if (getSelection()?.toString()) return;
    void this.editEntry(entry);
  }
}
