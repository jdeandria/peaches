import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';

import { addDays, LocalDate, localDateOfLocal, startOfWeek } from '../../../domain/core/local-date';
import { ScoringCategory } from '../../../domain/models/scoring';
import {
  hasStarted,
  isSubmitted,
  planProgress,
  totalSets,
  WorkoutLog,
} from '../../../domain/models/workout-log';
import { MetricExtractor } from '../../../domain/services/metric-extractor';
import { AppState } from '../../../state/app-state';
import { LoadingIndicator } from '../../expressive/loading-indicator';
import { ShapedAvatar } from '../../expressive/shaped-avatar';
import { WavyProgress } from '../../expressive/wavy-progress';
import { Fmt } from '../../format';
import { Card } from '../../layout/card';
import { ListCard } from '../../layout/list-card';
import { ListRow } from '../../layout/list-row';
import { Page } from '../../layout/page';
import { Section } from '../../layout/section';
import { Stagger } from '../../layout/stagger';
import { SwipeRow } from '../../layout/swipe-row';
import { TwoPane } from '../../layout/two-pane';

interface LogRowView {
  readonly log: WorkoutLog;
  readonly submitted: boolean;
  readonly day: string;
  readonly names: string;
  readonly sets: number;
  /** The amount that sums the workout up: weight moved, else distance. */
  readonly headline: string | null;
}

interface WeekView {
  /** "This week", "Last week", "Oct 5 – 11". */
  readonly label: string;
  readonly rows: readonly LogRowView[];
}

/** Which total headlines a workout row, in order of preference. */
const HEADLINE_CATEGORIES: readonly ScoringCategory[] = [
  'weightMoved',
  'runWalk',
  'ride',
  'swimRow',
];

/** Workouts in the history before (and per) "Show more". */
const HISTORY_PAGE = 10;
/** Routines offered as one-tap starts. */
const QUICK_ROUTINES = 4;

/**
 * The home tab, for training: start (or carry on with) a workout, the week
 * so far against your pledges, and every workout you've logged.
 */
@Component({
  selector: 'pch-train-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    RouterLink,
    MatButton,
    Page,
    Section,
    TwoPane,
    Card,
    ListCard,
    ListRow,
    Stagger,
    ShapedAvatar,
    LoadingIndicator,
    SwipeRow,
    WavyProgress,
  ],
  templateUrl: './train.page.html',
  styleUrl: './train.page.scss',
})
export class TrainPage {
  protected readonly state = inject(AppState);
  private readonly router = inject(Router);

  protected readonly subtitle = computed(() => Fmt.headerDay(this.state.today()));

  protected readonly logs = this.state.myLogs.value;

  /** The workout the Peach has going, if any. */
  protected readonly draft = computed(
    () => (this.logs() ?? []).find((l) => !isSubmitted(l)) ?? null,
  );

  /** The workout card: what's going, and the way into it. */
  protected readonly workout = computed(() => {
    const draft = this.draft();
    if (draft && (hasStarted(draft) || draft.entries.length > 0)) {
      const { done, total } = planProgress(draft);
      return {
        state: 'going' as const,
        title: 'Workout in progress',
        text:
          total > done
            ? `${done} of ${total} sets done. The clock picks up where it left off.`
            : `${Fmt.count(draft.entries.length, 'exercise')} logged so far.`,
        action: total > done ? 'Continue' : 'Finish up',
        icon: total > done ? 'play_arrow' : 'check',
        progress: total > 0 ? done / total : null,
      };
    }
    if (draft && draft.plan.length > 0) {
      const { total } = planProgress(draft);
      return {
        state: 'planned' as const,
        title: 'Workout planned',
        text: `${Fmt.count(draft.plan.length, 'exercise')}, ${Fmt.count(total, 'set')}. The clock starts when you do.`,
        action: 'Start',
        icon: 'play_arrow',
        progress: null,
      };
    }
    return {
      state: 'none' as const,
      title: 'Start a workout',
      text: 'Plan it, then tick it off a set at a time.',
      action: 'Plan a workout',
      icon: 'add',
      progress: null,
    };
  });

  /** Planning starts in the planner; a planned or going workout opens straight in the runner. */
  protected readonly workoutQuery = computed(() =>
    this.workout().state === 'none' ? {} : { mode: 'log' },
  );

  /** Saved routines, for a one-tap start when nothing's planned. */
  private readonly routineList = this.state.watch(
    () => this.state.peachId() ?? undefined,
    (id, app) => app.routines.watchForPeach(id),
  );
  protected readonly routines = computed(() =>
    (this.routineList.value() ?? []).slice(0, QUICK_ROUTINES),
  );

  /** Workouts, sets and active minutes since Monday. */
  protected readonly stats = computed(() => {
    const monday = startOfWeek(this.state.today());
    const week = (this.logs() ?? []).filter(
      (l) => isSubmitted(l) && localDateOfLocal(l.startedAt) >= monday,
    );
    const sets = week.reduce((n, l) => n + totalSets(l), 0);
    const minutes = week.reduce((n, l) => n + MetricExtractor.extract(l).activeMinutes, 0);
    return [
      { value: String(week.length), label: week.length === 1 ? 'Workout' : 'Workouts' },
      { value: String(sets), label: sets === 1 ? 'Set' : 'Sets' },
      { value: String(Math.round(minutes)), label: 'Active min' },
    ];
  });

  /** This week's matchups, for my pledges and how far along each is. */
  private readonly boards = this.state.query(
    () => {
      const me = this.state.peachId();
      const open = this.state.myMatchups.value()?.filter((m) => m.status === 'inProgress');
      return me && open && open.length > 0 ? { me, ids: open.map((m) => m.id) } : undefined;
    },
    async ({ me, ids }, app) => {
      const boards = await Promise.all(ids.map((id) => app.seasonService.board(id)));
      return boards.flatMap((b) => {
        if (!b) return [];
        const side = b.home.peachId === me ? b.home : b.away;
        return side ? [{ crate: b.crate, side }] : [];
      });
    },
  );
  protected readonly pledges = computed(() => {
    const units = this.state.units();
    const boards = this.boards.value() ?? [];
    return boards.flatMap(({ crate, side }) =>
      side.score.pledges.map((p) => ({
        key: `${crate.id}:${p.category}`,
        crate: boards.length > 1 ? crate.name : null,
        icon: Fmt.categoryIcon(p.category),
        label: Fmt.category(p.category),
        progress: `${Fmt.amount(p.category, p.amount, units)} of ${Fmt.amount(p.category, p.target, units)}`,
        fraction: p.target > 0 ? Math.min(1, p.amount / p.target) : 1,
        hit: p.amount >= p.target,
      })),
    );
  });

  protected readonly historyShown = signal(HISTORY_PAGE);
  private readonly rows = computed<LogRowView[]>(() => {
    const units = this.state.units();
    return (this.logs() ?? []).map((log) => {
      const names = log.entries
        .slice(0, 3)
        .map((e) => e.exerciseName)
        .join(', ');
      const totals = MetricExtractor.extract(log);
      const lead = HEADLINE_CATEGORIES.find((c) => totals[c] > 0);
      const submitted = isSubmitted(log);
      return {
        log,
        submitted,
        day: submitted ? Fmt.day(localDateOfLocal(log.startedAt)) : 'In progress',
        names: names || (log.plan.length > 0 ? 'Planned, not started' : 'Nothing logged yet'),
        sets: totalSets(log),
        headline: lead ? Fmt.amount(lead, totals[lead], units) : null,
      };
    });
  });
  protected readonly moreHistory = computed(() => this.rows().length > this.historyShown());

  /** The history, a week to a heading, newest first. */
  protected readonly history = computed<WeekView[]>(() => {
    const thisWeek = startOfWeek(this.state.today());
    const lastWeek = addDays(thisWeek, -7);
    const weeks: { monday: LocalDate; rows: LogRowView[] }[] = [];
    for (const row of this.rows().slice(0, this.historyShown())) {
      const monday = row.submitted ? startOfWeek(localDateOfLocal(row.log.startedAt)) : thisWeek;
      const week = weeks.at(-1);
      if (week && week.monday === monday) week.rows.push(row);
      else weeks.push({ monday, rows: [row] });
    }
    return weeks.map((w) => ({
      label:
        w.monday === thisWeek
          ? 'This week'
          : w.monday === lastWeek
            ? 'Last week'
            : Fmt.week(w.monday),
      rows: w.rows,
    }));
  });

  protected showMore(): void {
    this.historyShown.update((n) => n + HISTORY_PAGE);
  }

  /** Opens a workout to change it: a finished one's page, or the one going. */
  protected openLog(r: LogRowView): void {
    void this.router.navigate(r.submitted ? ['/log', r.log.id] : ['/log']);
  }

  /** Deletes a workout at once, with Undo to put it back. */
  protected async deleteLog(r: LogRowView): Promise<void> {
    const me = this.state.peachId();
    if (!me) return;
    const removed = await this.state.run((app) => app.loggingService.deleteLog(r.log.id, me));
    if (!removed) return;
    this.state.toast(
      r.submitted ? `Deleted ${r.day}’s workout.` : 'Discarded the workout in progress.',
      () => {
        void this.state.run((app) => app.loggingService.restoreLog(removed));
      },
    );
  }
}
