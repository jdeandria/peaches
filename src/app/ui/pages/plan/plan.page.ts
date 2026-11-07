import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';

import { MatchupBoard } from '../../../application/season-service';
import { addDays, LocalDate, startOfWeek } from '../../../domain/core/local-date';
import { CategoryWeights, DEFAULT_WEIGHTS, weightsToJson } from '../../../domain/models/scoring';
import { daysOf, plannedSetCount, WeekPlan } from '../../../domain/models/week-plan';
import {
  doneCount,
  hasStarted,
  isSubmitted,
  planProgress,
  totalSets,
} from '../../../domain/models/workout-log';
import { AppState } from '../../../state/app-state';
import { ButtonGroup, ButtonGroupOption } from '../../expressive/button-group';
import { LoadingIndicator } from '../../expressive/loading-indicator';
import { Fmt } from '../../format';
import { ListCard } from '../../layout/list-card';
import { Page } from '../../layout/page';
import { Section } from '../../layout/section';
import { Stagger } from '../../layout/stagger';
import { TwoPane } from '../../layout/two-pane';
import { MatchupCard } from '../matchup/matchup-card';
import { PlanActions } from './plan-actions';
import { WorkoutCard, WorkoutView } from './workout-card';

export type PlanWeek = 'this' | 'next';

const WEEKS: readonly ButtonGroupOption<PlanWeek>[] = [
  { value: 'this', label: 'This week' },
  { value: 'next', label: 'Next week' },
];

interface DayView {
  readonly date: LocalDate;
  readonly label: string;
  readonly today: boolean;
  readonly past: boolean;
  readonly workouts: readonly WorkoutView[];
}

/**
 * The home tab, and the one screen for planning the week and doing it.
 * Workouts go on days (+ picks an exercise, a routine or a template) and
 * open to their exercises, each of which starts the workout there. In a
 * Crate, each matchup shows what the plans are worth: before the week
 * against the opponent's plan as it changes, so there's a reason to plan
 * big; during it, against what was committed, since falling short costs.
 */
@Component({
  selector: 'pch-plan-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MatButton,
    MatIconButton,
    MatTooltip,
    ButtonGroup,
    ListCard,
    LoadingIndicator,
    Page,
    Section,
    Stagger,
    TwoPane,
    MatchupCard,
    WorkoutCard,
  ],
  providers: [PlanActions],
  templateUrl: './plan.page.html',
  styleUrl: './plan.page.scss',
})
export class PlanPage {
  /** Query param: `next` for next week's plan. */
  readonly week = input<string>();

  protected readonly state = inject(AppState);
  protected readonly actions = inject(PlanActions);
  private readonly router = inject(Router);
  protected readonly fmt = Fmt;
  protected readonly weeks = WEEKS;
  protected readonly busy = signal(false);

  protected readonly shown = computed<PlanWeek>(() => (this.week() === 'next' ? 'next' : 'this'));
  private readonly thisMonday = computed(() => startOfWeek(this.state.today()));
  protected readonly monday = computed(() =>
    this.shown() === 'next' ? addDays(this.thisMonday(), 7) : this.thisMonday(),
  );
  /** The week, and how it's going: "Oct 12 – 18 · 1 of 4 done". */
  protected readonly subtitle = computed(() => {
    const week = Fmt.week(this.monday());
    const summary = this.summary();
    return summary ? `${week} · ${summary}` : week;
  });

  private readonly me = this.state.peachId;

  private readonly planRef = this.state.watch(
    () => {
      const me = this.me();
      return me ? { me, monday: this.monday() } : undefined;
    },
    ({ me, monday }, app) => app.plans.watch(me, monday),
  );
  /** Undefined while loading; a week with no plan is an empty one. */
  protected readonly plan = computed<WeekPlan | undefined>(() => {
    const value = this.planRef.value();
    const me = this.me();
    if (value === undefined || !me) return undefined;
    // Ignore a plan still showing from the other week while the new one loads.
    if (value && value.weekStart !== this.monday()) return undefined;
    return value ?? { peachId: me, weekStart: this.monday(), workouts: [], updatedAt: new Date(0) };
  });

  /** The week before the one shown, to repeat when this one is empty. */
  private readonly previousPlan = this.state.query(
    () => {
      const me = this.me();
      return me && this.plan()?.workouts.length === 0
        ? { me, monday: addDays(this.monday(), -7) }
        : undefined;
    },
    ({ me, monday }, app) => app.plans.get(me, monday),
  );
  protected readonly canRepeat = computed(
    () => (this.previousPlan.value()?.workouts.length ?? 0) > 0,
  );

  private readonly logs = this.state.myLogs.value;
  private readonly logsById = computed(
    () => new Map((this.logs() ?? []).map((l) => [l.id, l] as const)),
  );

  /** My matchups in the week shown, with everything to score them. */
  private readonly boardsQuery = this.state.query(
    () => {
      const matchups = this.state.myMatchups.value();
      if (!matchups) return undefined;
      const live = matchups.filter((m) => m.status !== 'complete');
      return { monday: this.monday(), ids: live.map((m) => m.id) };
    },
    async ({ monday, ids }, app) => {
      const boards = (await Promise.all(ids.map((id) => app.seasonService.board(id)))).filter(
        (b): b is MatchupBoard => b !== null && b.round.weekStart === monday,
      );
      return { monday, boards };
    },
  );

  /** One card per matchup this week, with what my plan is worth under its Season's weights. */
  protected readonly boards = computed(() => {
    const data = this.boardsQuery.value();
    const plan = this.plan();
    if (!data || data.monday !== this.monday()) return undefined;
    return data.boards.map((board) => ({
      board,
      planned: this.state.app.planService.plannedPoints(plan ?? null, board.season.rules.weights),
    }));
  });

  /** My Crates with no matchup in the week shown. */
  protected readonly idleCrates = computed(() => {
    const boards = this.boardsQuery.value()?.boards ?? [];
    const playing = new Set(boards.map((b) => b.crate.id));
    return (this.state.myCrates.value() ?? []).filter((c) => !playing.has(c.id));
  });

  protected readonly inCrates = computed(() => (this.state.myCrates.value()?.length ?? 0) > 0);

  /**
   * The weights a workout's points are shown in: the one set every matchup
   * this week uses, or the defaults without a Crate. Null when Crates
   * disagree (their strips show the totals instead).
   */
  private readonly rowWeights = computed<CategoryWeights | null>(() => {
    const boards = this.boardsQuery.value()?.boards ?? [];
    if (boards.length === 0) return this.inCrates() ? null : DEFAULT_WEIGHTS;
    const first = boards[0].season.rules.weights;
    const same = boards.every(
      (b) =>
        JSON.stringify(weightsToJson(b.season.rules.weights)) ===
        JSON.stringify(weightsToJson(first)),
    );
    return same ? first : null;
  });

  protected readonly days = computed<DayView[] | undefined>(() => {
    const plan = this.plan();
    if (!plan) return undefined;
    const today = this.state.today();
    const thisWeek = this.shown() === 'this';
    const weights = this.rowWeights();
    const logs = this.logsById();
    const scoring = this.state.app.scoring;
    const units = this.state.units();
    return daysOf(plan.weekStart).map((date) => ({
      date,
      label: Fmt.day(date),
      today: date === today,
      past: date < today,
      workouts: plan.workouts
        .filter((w) => w.day === date)
        .map((workout): WorkoutView => {
          const log = workout.logId ? (logs.get(workout.logId) ?? null) : null;
          const state = !log ? 'planned' : isSubmitted(log) ? 'done' : 'going';
          const sets = plannedSetCount(workout);
          const where = this.locationName(workout.locationId);
          let subtitle: string;
          if (state === 'done') {
            subtitle = `Done · ${Fmt.count(totalSets(log!), 'set')}${log!.durationSeconds > 0 ? ` in ${Fmt.duration(log!.durationSeconds)}` : ''}`;
          } else if (state === 'going') {
            const { done, total } = planProgress(log!);
            subtitle = `In progress · ${done} of ${total} sets`;
          } else {
            subtitle = `${Fmt.count(workout.exercises.length, 'exercise')} · ${Fmt.count(sets, 'set')}${where ? ` · ${where}` : ''}`;
          }
          const points =
            weights === null
              ? null
              : state === 'done'
                ? scoring.scoreLog(log!, weights).total
                : scoring.scorePlan(workout.exercises, weights).total;
          // What's planned, or under way (the session's own plan), or what was done.
          const entries =
            state === 'planned' ? workout.exercises : state === 'going' ? log!.plan : log!.entries;
          return {
            workout,
            state,
            log,
            subtitle,
            points: points === null ? null : `${state === 'done' ? '' : '~'}${Fmt.points(points)}`,
            exercises: entries.map((entry) => {
              const done = state === 'going' ? doneCount(log!, entry.exerciseId) : 0;
              return {
                entry,
                summary: Fmt.entrySummary(entry, units),
                done,
                complete: state === 'done' || (state === 'going' && done >= entry.sets.length),
              };
            }),
            canLaunch: thisWeek && state !== 'done',
          };
        }),
    }));
  });

  /** How the week is going: workouts done of planned, or what's planned. Nothing for an empty week. */
  private readonly summary = computed(() => {
    const rows = (this.days() ?? []).flatMap((d) => d.workouts);
    if (rows.length === 0) return null;
    if (this.shown() === 'next') return `${Fmt.count(rows.length, 'workout')} planned`;
    const done = rows.filter((r) => r.state === 'done').length;
    return `${done} of ${rows.length} done`;
  });

  /** A workout under way that isn't one of this week's planned ones. */
  protected readonly going = computed(() => {
    const plan = this.plan();
    const draft = (this.logs() ?? []).find((l) => !isSubmitted(l));
    if (!draft || !(hasStarted(draft) || draft.entries.length > 0)) return null;
    if (plan?.workouts.some((w) => w.logId === draft.id)) return null;
    const { done, total } = planProgress(draft);
    return total > 0 ? `${done} of ${total} sets done` : 'Under way';
  });

  private locationName(id: string | null): string | null {
    if (id === null) return null;
    return this.state.peach.value()?.locations.find((l) => l.id === id)?.name ?? null;
  }

  protected showWeek(week: PlanWeek | null): void {
    if (!week) return;
    void this.router.navigate([], {
      queryParams: { week: week === 'next' ? 'next' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Which workouts are open: as toggled, else those under way and today's still to do. */
  private readonly toggled = signal<ReadonlyMap<string, boolean>>(new Map());

  protected isOpen(v: WorkoutView): boolean {
    const set = this.toggled().get(v.workout.id);
    if (set !== undefined) return set;
    return v.state === 'going' || (v.state === 'planned' && v.workout.day === this.state.today());
  }

  protected toggle(v: WorkoutView): void {
    const open = !this.isOpen(v);
    this.toggled.update((m) => new Map(m).set(v.workout.id, open));
  }

  /** Plans a workout on a day from the picker, and opens it. */
  protected async add(day: LocalDate): Promise<void> {
    const id = await this.actions.addWorkout(this.monday(), day);
    if (id) this.toggled.update((m) => new Map(m).set(id, true));
  }

  /** Plans last week's workouts again, on the same days. */
  protected async repeat(): Promise<void> {
    const me = this.me();
    if (!me || this.busy()) return;
    this.busy.set(true);
    const monday = this.monday();
    const copied = await this.state.run((app) =>
      app.planService.repeatWeek(me, addDays(monday, -7), monday, this.state.now()),
    );
    this.busy.set(false);
    if (copied) this.state.toast(`Planned ${Fmt.count(copied, 'workout')} from the week before.`);
  }
}
