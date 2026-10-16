import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatTooltip } from '@angular/material/tooltip';

import { AppContainer } from '../../../application/app-container';
import { localDateOfLocal } from '../../../domain/core/local-date';
import { Exercise, takesLoad } from '../../../domain/exercises/exercise';
import { scoreTotal } from '../../../domain/models/score';
import { involves, isBye, opponentOf, winnerId } from '../../../domain/models/season';
import {
  isScored,
  prescriptionUnit,
  totalTarget,
  WorkoutItem,
} from '../../../domain/models/workout';
import {
  entryForItem,
  ExerciseLogEntry,
  isSubmitted,
  totalMeters,
  totalReps,
  totalSeconds,
  WorkoutLog,
} from '../../../domain/models/workout-log';
import { LoadHistory } from '../../../domain/services/load-history';
import { AppState } from '../../../state/app-state';
import { LoadingIndicator } from '../../expressive/loading-indicator';
import { WavyProgress } from '../../expressive/wavy-progress';
import { Fmt } from '../../format';
import { AnimatedNumber } from '../../layout/animated-number';
import { Card } from '../../layout/card';
import { EmptyState } from '../../layout/empty-state';
import { ListCard } from '../../layout/list-card';
import { Page } from '../../layout/page';
import { Section } from '../../layout/section';
import { Stagger } from '../../layout/stagger';
import { StatusLabel } from '../../layout/status-label';
import { openSetLogger } from './set-logger-sheet';

interface ItemView {
  readonly item: WorkoutItem;
  readonly exercise: Exercise | undefined;
  readonly name: string;
  readonly prescription: string;
  readonly loggedLoad: string | null;
  readonly scored: boolean;
  readonly ratio: number;
  /** none: nothing logged; done: target met; partial: logged below target. */
  readonly state: 'none' | 'done' | 'partial';
}

interface BlockView {
  readonly title: string;
  readonly scored: boolean;
  readonly items: readonly ItemView[];
}

/**
 * The generated workout for a matchup, with per-exercise logging and a live
 * score (port of `MatchupScreen`). The same workout is shown to both Peaches.
 */
@Component({
  selector: 'pch-matchup-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButton,
    MatIconButton,
    MatTooltip,
    Page,
    Section,
    Card,
    ListCard,
    EmptyState,
    StatusLabel,
    Stagger,
    AnimatedNumber,
    WavyProgress,
    LoadingIndicator,
  ],
  templateUrl: './matchup.page.html',
  styleUrl: './matchup.page.scss',
})
export class MatchupPage {
  readonly matchupId = input.required<string>();

  private readonly state = inject(AppState);
  private readonly sheet = inject(MatBottomSheet);

  private readonly matchupQuery = this.state.query(
    () => this.matchupId(),
    (id, app) => app.seasons.getMatchup(id),
  );
  protected readonly matchup = computed(() => this.matchupQuery.value() ?? null);
  private readonly workoutQuery = this.state.query(
    () => this.matchup()?.workoutId ?? undefined,
    (id, app) => app.workouts.getById(id),
  );
  protected readonly workout = computed(() => this.workoutQuery.value() ?? null);
  /** loading → spinner; closed → "Not open yet"; missing → workout gone; ready. */
  protected readonly phase = computed(() => {
    const m = this.matchupQuery.value();
    if (m === undefined) return this.matchupQuery.error() ? 'closed' : 'loading';
    if (m === null || m.workoutId === null) return 'closed';
    const w = this.workoutQuery.value();
    if (w === undefined) return this.workoutQuery.error() ? 'missing' : 'loading';
    return w === null ? 'missing' : 'ready';
  });

  private readonly me = this.state.peachId;
  private readonly opponentId = computed(() => {
    const m = this.matchup();
    const me = this.me();
    return m && me ? opponentOf(m, me) : null;
  });
  private readonly opponentName = this.state.query(
    () => this.opponentId() ?? undefined,
    async (id, app) => (await app.peaches.getById(id))?.displayName ?? null,
  ).value;
  private readonly window = this.state.query(
    () => this.matchup()?.roundId,
    (roundId, app) => app.seasonService.windowFor(roundId),
  ).value;

  // My log: found among my logs (or created on first save), then streamed.
  private readonly createdLogId = signal<string | null>(null);
  private readonly listedLog = computed(
    () => this.state.myLogs.value()?.find((l) => l.matchupId === this.matchupId()) ?? null,
  );
  private readonly logId = computed(() => this.createdLogId() ?? this.listedLog()?.id ?? null);
  private readonly liveLog = this.state.watch(
    () => this.logId() ?? undefined,
    (id, app) => app.logs.watch(id),
  );
  protected readonly log = computed<WorkoutLog | null>(() => {
    if (this.logId() === null) return null;
    return this.liveLog.value() ?? this.listedLog();
  });

  protected readonly submitted = computed(() => {
    const log = this.log();
    return log !== null && isSubmitted(log);
  });
  protected readonly editable = computed(() => {
    const m = this.matchup();
    const me = this.me();
    return !!m && !!me && involves(m, me) && !this.submitted() && m.status !== 'complete';
  });
  protected readonly busy = signal(false);

  protected readonly headline = computed(() => {
    const m = this.matchup();
    if (m && isBye(m)) return 'Bye round';
    return `You vs ${this.opponentName() ?? '…'}`;
  });
  protected readonly subtitle = computed(() => {
    const w = this.workout();
    if (!w) return '';
    return [w.title, Fmt.focus(w.focus), `~${w.estimatedMinutes} min`]
      .filter((s) => s !== null)
      .join(' · ');
  });

  protected readonly points = computed(() => {
    const w = this.workout();
    const log = this.log();
    return w && log ? scoreTotal(this.state.app.scoring.score(w, log)) : 0;
  });
  protected readonly formatPoints = (v: number) => `${Fmt.points(v)} pts`;

  /** The final score once the round has closed, from my point of view. */
  protected readonly final = computed(() => {
    const m = this.matchup();
    const me = this.me();
    if (!m || m.result === null || me === null) return null;
    const home = m.homePeachId === me;
    const mine = home ? m.result.homePoints : m.result.awayPoints;
    const theirs = home ? m.result.awayPoints : m.result.homePoints;
    const winner = winnerId(m);
    return {
      score: isBye(m) ? Fmt.points(mine) : `${Fmt.points(mine)} – ${Fmt.points(theirs)}`,
      verdict: isBye(m)
        ? 'Bye round'
        : winner === null
          ? 'Tie'
          : winner === me
            ? 'You won'
            : `${this.opponentName() ?? 'They'} won`,
    };
  });

  /** Deadline while open, or confirmation once submitted. */
  protected readonly banner = computed(() => {
    if (this.submitted()) {
      return { icon: 'check_circle', text: 'Submitted. Results arrive when the round closes.' };
    }
    const window = this.window();
    if (!window) return { icon: 'schedule', text: 'Log each exercise as you go.' };
    const closes = window.closesAt;
    return {
      icon: 'schedule',
      text:
        `Logging ${Fmt.closesIn(window.remainingMsAt(this.state.nowTick()))} · ` +
        `${Fmt.day(localDateOfLocal(closes))} ${Fmt.time(closes)}`,
    };
  });

  protected readonly blocks = computed<BlockView[]>(() => {
    const w = this.workout();
    if (!w) return [];
    const log = this.log();
    const units = this.state.units();
    return w.blocks.map((block) => ({
      title: Fmt.block(block.type),
      scored: block.items.some(isScored),
      items: block.items.map((item) => {
        const exercise = this.state.catalog.byId(item.exerciseId);
        const entry = log ? entryForItem(log, item.id) : undefined;
        const target = totalTarget(item.prescription);
        const ratio =
          target === 0 || !entry ? 0 : Math.min(1, Math.max(0, achieved(item, entry) / target));
        return {
          item,
          exercise,
          name: exercise?.name ?? item.exerciseId,
          prescription: Fmt.prescription(item.prescription),
          loggedLoad: entry ? Fmt.loggedLoad(entry, units) : null,
          scored: isScored(item),
          ratio,
          state: !entry ? 'none' : ratio >= 1 ? 'done' : 'partial',
        } satisfies ItemView;
      }),
    }));
  });

  /** Opens the set logger for an item and records what comes back. */
  protected async logItem(view: ItemView): Promise<void> {
    const exercise = view.exercise;
    if (!this.editable() || !exercise) return;
    const current = this.log();
    const entry = await openSetLogger(this.sheet, {
      exercise,
      item: view.item,
      existing: current ? entryForItem(current, view.item.id) : null,
      units: this.state.units(),
      previousLoadsKg: takesLoad(exercise)
        ? LoadHistory.lastLoadsKg(this.state.myLogs.value() ?? [], exercise.id, current?.id)
        : null,
    });
    if (!entry) return;
    await this.record(entry);
  }

  private async record(entry: ExerciseLogEntry): Promise<void> {
    await this.state.run(async (app) => {
      const log = await this.ensureLog(app);
      await app.loggingService.recordEntry(log.id, entry);
    });
  }

  protected async submit(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.state.run(async (app) => {
        const log = await this.ensureLog(app);
        await app.loggingService.submit(log.id, this.state.now());
      }, 'Workout submitted. Nice work.');
    } finally {
      this.busy.set(false);
    }
  }

  private async ensureLog(app: AppContainer): Promise<WorkoutLog> {
    const m = this.matchup();
    const me = this.me();
    if (!m || !me) throw new Error('No matchup');
    const log = await app.loggingService.logForMatchup(m, me, this.state.now());
    if (this.createdLogId() !== log.id) this.createdLogId.set(log.id);
    return log;
  }

  /** Row clicks open the logger too (pointer convenience; the button is the control). */
  protected rowClick(event: MouseEvent, view: ItemView): void {
    if ((event.target as Element).closest('button')) return;
    if (getSelection()?.toString()) return;
    void this.logItem(view);
  }
}

/** Achieved volume in the prescription's own unit. */
function achieved(item: WorkoutItem, entry: ExerciseLogEntry): number {
  switch (prescriptionUnit(item.prescription)) {
    case 'duration':
      return totalSeconds(entry);
    case 'distance':
      return totalMeters(entry);
    default:
      return totalReps(entry);
  }
}
