import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';

import { MatchupBoard, MatchupSide } from '../../../application/season-service';
import { addDays, LocalDate, localDateOfLocal, startOfWeek } from '../../../domain/core/local-date';
import { round2 } from '../../../domain/core/math';
import { isLocked } from '../../../domain/models/commitment';
import { CategoryWeights, DEFAULT_WEIGHTS, weightsToJson } from '../../../domain/models/scoring';
import { isBye, opponentOf } from '../../../domain/models/season';
import {
  daysOf,
  isInWeek,
  PlannedWorkout,
  plannedSetCount,
  WeekPlan,
} from '../../../domain/models/week-plan';
import {
  hasStarted,
  isSubmitted,
  planProgress,
  totalSets,
  WorkoutLog,
} from '../../../domain/models/workout-log';
import { AppState } from '../../../state/app-state';
import { ButtonGroup, ButtonGroupOption } from '../../expressive/button-group';
import { LoadingIndicator } from '../../expressive/loading-indicator';
import { ShapedAvatar } from '../../expressive/shaped-avatar';
import { WavyProgress } from '../../expressive/wavy-progress';
import { Fmt } from '../../format';
import { Card } from '../../layout/card';
import { ListCard } from '../../layout/list-card';
import { Page } from '../../layout/page';
import { Section } from '../../layout/section';
import { Stagger } from '../../layout/stagger';
import { SwipeRow } from '../../layout/swipe-row';
import { TwoPane } from '../../layout/two-pane';

export type PlanWeek = 'this' | 'next';

const WEEKS: readonly ButtonGroupOption<PlanWeek>[] = [
  { value: 'this', label: 'This week' },
  { value: 'next', label: 'Next week' },
];

const STATE_ICONS = { planned: 'fitness_center', going: 'directions_run', done: 'check' } as const;

/** One side of a matchup, as the plan shows it. */
interface SideView {
  readonly name: string;
  /** Committed, or (my side, before the lock) what the plan is worth right now. */
  readonly committed: number;
  readonly earned: number;
  /** How full their bar is: earned of committed once the week is on, else against the bigger plan. */
  readonly fill: number;
}

/** A Crate's matchup for the week shown, from where the plan stands. */
export interface StripView {
  readonly key: string;
  readonly crate: string;
  readonly link: readonly string[];
  /** Before the week: plans still moving. During it: the plans are locked in. */
  readonly locked: boolean;
  readonly me: SideView;
  /** Null for a bye. */
  readonly them: SideView | null;
  /** The one line that matters most right now. */
  readonly headline: string;
  readonly detail: string;
  readonly behind: boolean;
}

interface WorkoutRow {
  readonly workout: PlannedWorkout;
  readonly state: 'planned' | 'going' | 'done';
  readonly icon: string;
  readonly subtitle: string;
  readonly points: string | null;
  readonly canLaunch: boolean;
}

interface LogRow {
  readonly log: WorkoutLog;
  readonly subtitle: string;
}

interface DayView {
  readonly date: LocalDate;
  readonly label: string;
  readonly today: boolean;
  readonly past: boolean;
  readonly workouts: readonly WorkoutRow[];
  readonly unplanned: readonly LogRow[];
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Builds a Crate's strip: before the week, both plans as they stand and how
 * far apart they are (planning more is the point); during it, each side's
 * points against what they committed to, and what hitting or missing it
 * is worth.
 */
export function stripView(args: {
  board: MatchupBoard;
  me: string;
  opponent: string | null;
  /** What my plan for the week is worth now, under this Season's weights. */
  planned: number;
  now: Date;
}): StripView {
  const { board, me, opponent, planned, now } = args;
  const mine = board.home.peachId === me ? board.home : board.away!;
  const theirs: MatchupSide | null = board.home.peachId === me ? board.away : board.home;
  const locked = isLocked({ locksAt: board.window.opensAt }, now);
  const { bonus, penalty } = board.season.rules.plan;
  const name = opponent ?? 'Your opponent';
  const myCommitted = locked ? mine.committed : planned;
  const top = Math.max(myCommitted, theirs?.committed ?? 0, 1);
  const side = (label: string, s: MatchupSide, committed: number): SideView => ({
    name: label,
    committed,
    earned: s.score.workouts.total,
    fill: locked
      ? committed > 0
        ? Math.min(1, s.score.workouts.total / committed)
        : 0
      : committed / top,
  });
  const meView = side('You', mine, myCommitted);
  const themView = theirs ? side(name, theirs, theirs.committed) : null;
  const base = {
    key: board.matchup.id,
    crate: board.crate.name,
    link: ['/matchups', board.matchup.id],
    locked,
    me: meView,
    them: themView,
  };

  if (!locked) {
    const locks = Fmt.closesIn(board.window.opensAt.getTime() - now.getTime()).replace(
      'closes',
      'locks',
    );
    const stakes =
      myCommitted > 0
        ? `Hit it for +${Fmt.points(round2((myCommitted * bonus) / 100))}; miss and lose ${penalty}% of the gap. ${capitalize(locks)}.`
        : `${capitalize(locks)}.`;
    if (!themView) {
      return {
        ...base,
        headline: 'Bye week: your plan still earns its bonus',
        detail: stakes,
        behind: false,
      };
    }
    const gap = round2(themView.committed - myCommitted);
    return {
      ...base,
      headline:
        gap > 0
          ? `Plan ${Fmt.points(gap)} more to match ${name}`
          : gap < 0
            ? `${Fmt.points(-gap)} ahead of ${name}’s plan`
            : themView.committed === 0
              ? `Neither of you has planned yet`
              : `Level with ${name}’s plan`,
      detail: stakes,
      behind: gap > 0,
    };
  }

  const score = mine.score;
  const headline =
    score.committed === 0
      ? 'No plan this week: no bonus, no penalty'
      : score.hit
        ? `Plan hit: +${Fmt.points(score.plan)} bonus`
        : `${Fmt.points(round2(score.committed - score.workouts.total))} to go to hit your plan`;
  const detail =
    score.committed > 0 && !score.hit
      ? `Stop here and it costs ${Fmt.points(-score.plan)}. Live: you ${Fmt.points(score.total)}${theirs ? `, ${name} ${Fmt.points(theirs.score.total)}` : ''}.`
      : `Live: you ${Fmt.points(score.total)}${theirs ? `, ${name} ${Fmt.points(theirs.score.total)}` : ''}.`;
  const behind = theirs !== null && score.total < theirs.score.total;
  return { ...base, headline, detail, behind };
}

/**
 * The home tab: plan the week, then work through it. Workouts go on days
 * (each built in the planner) and launch straight into the log. In a
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
    Card,
    ListCard,
    LoadingIndicator,
    Page,
    Section,
    ShapedAvatar,
    Stagger,
    SwipeRow,
    TwoPane,
    WavyProgress,
  ],
  templateUrl: './plan.page.html',
  styleUrl: './plan.page.scss',
})
export class PlanPage {
  /** Query param: `next` for next week's plan. */
  readonly week = input<string>();

  protected readonly state = inject(AppState);
  private readonly router = inject(Router);
  protected readonly fmt = Fmt;
  protected readonly weeks = WEEKS;
  protected readonly refreshing = signal(false);
  protected readonly busy = signal(false);

  protected readonly shown = computed<PlanWeek>(() => (this.week() === 'next' ? 'next' : 'this'));
  private readonly thisMonday = computed(() => startOfWeek(this.state.today()));
  protected readonly monday = computed(() =>
    this.shown() === 'next' ? addDays(this.thisMonday(), 7) : this.thisMonday(),
  );
  protected readonly subtitle = computed(() => Fmt.week(this.monday()));

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

  /** My matchups in the week shown, with everything to score them, and who they're against. */
  private readonly boards = this.state.query(
    () => {
      const me = this.me();
      const matchups = this.state.myMatchups.value();
      if (!me || !matchups) return undefined;
      const live = matchups.filter((m) => m.status !== 'complete');
      return { me, monday: this.monday(), ids: live.map((m) => m.id) };
    },
    async ({ me, monday, ids }, app) => {
      const boards = (await Promise.all(ids.map((id) => app.seasonService.board(id)))).filter(
        (b): b is MatchupBoard => b !== null && b.round.weekStart === monday,
      );
      const opponents = boards.flatMap((b) => {
        const id = opponentOf(b.matchup, me);
        return id ? [id] : [];
      });
      const names = new Map(
        (await app.peaches.getByIds(opponents)).map((p) => [p.id, p.displayName]),
      );
      return { monday, boards, names };
    },
  );

  /** One strip per matchup this week, then a note for Crates without one. */
  protected readonly strips = computed<StripView[] | undefined>(() => {
    const data = this.boards.value();
    const me = this.me();
    const plan = this.plan();
    if (!data || !me || data.monday !== this.monday()) return undefined;
    const now = this.state.nowTick();
    return data.boards.map((board) => {
      const opponentId = isBye(board.matchup) ? null : opponentOf(board.matchup, me);
      return stripView({
        board,
        me,
        opponent: opponentId ? (data.names.get(opponentId) ?? 'Your opponent') : null,
        planned: this.state.app.planService.plannedPoints(plan ?? null, board.season.rules.weights),
        now,
      });
    });
  });

  /** My Crates with no matchup in the week shown. */
  protected readonly idleCrates = computed(() => {
    const boards = this.boards.value()?.boards ?? [];
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
    const boards = this.boards.value()?.boards ?? [];
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
    const units = this.state.units();
    const weights = this.rowWeights();
    const logs = this.logsById();
    const linked = new Set(plan.workouts.map((w) => w.logId));
    const scoring = this.state.app.scoring;
    const unplanned = (this.logs() ?? []).filter(
      (l) =>
        isSubmitted(l) &&
        !linked.has(l.id) &&
        isInWeek(plan.weekStart, localDateOfLocal(l.startedAt)),
    );
    return daysOf(plan.weekStart).map((date) => ({
      date,
      label: Fmt.day(date),
      today: date === today,
      past: date < today,
      workouts: plan.workouts
        .filter((w) => w.day === date)
        .map((workout): WorkoutRow => {
          const log = workout.logId ? logs.get(workout.logId) : undefined;
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
          return {
            workout,
            state,
            icon: STATE_ICONS[state],
            subtitle,
            points: points === null ? null : `${state === 'done' ? '' : '~'}${Fmt.points(points)}`,
            canLaunch: thisWeek && state !== 'done',
          };
        }),
      unplanned: unplanned
        .filter((l) => localDateOfLocal(l.startedAt) === date)
        .map((log) => ({
          log,
          subtitle: `Unplanned · ${log.entries
            .slice(0, 2)
            .map((e) => `${e.exerciseName} ${Fmt.entryHeadline(e, units)}`)
            .join(', ')}`,
        })),
    }));
  });

  /** How the week is going: workouts done of planned, or what's planned. */
  protected readonly summary = computed(() => {
    const days = this.days();
    if (!days) return null;
    const rows = days.flatMap((d) => d.workouts);
    const done = rows.filter((r) => r.state === 'done').length;
    const extra = days.reduce((n, d) => n + d.unplanned.length, 0);
    const sets = rows.reduce((n, r) => n + plannedSetCount(r.workout), 0);
    if (rows.length === 0) {
      return {
        empty: true,
        title: this.shown() === 'this' ? 'Nothing planned this week' : 'Plan next week',
        text: this.inCrates()
          ? 'In a Crate, what your plan is worth is what you commit to. Hit it for a bonus; fall short and it costs you.'
          : 'Put workouts on the days you’ll do them, then launch each one when it’s time.',
        progress: null,
      };
    }
    if (this.shown() === 'next') {
      return {
        empty: false,
        title: `${Fmt.count(rows.length, 'workout')} planned`,
        text: `${Fmt.count(sets, 'set')} across ${Fmt.count(new Set(rows.map((r) => r.workout.day)).size, 'day')}.`,
        progress: null,
      };
    }
    return {
      empty: false,
      title: `${done} of ${Fmt.count(rows.length, 'workout')} done`,
      text:
        extra > 0
          ? `Plus ${Fmt.count(extra, 'unplanned workout')}.`
          : done === rows.length
            ? 'Every planned workout done. Anything more is a bonus.'
            : 'Launch the next one when it’s time.',
      progress: done / rows.length,
    };
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

  protected editLink(w: PlannedWorkout): unknown[] {
    return ['/plan', this.monday(), w.id];
  }

  /** Starts a planned workout (or carries on with it) in the log, set by set. */
  protected async launch(w: PlannedWorkout): Promise<void> {
    const me = this.me();
    if (!me || this.busy()) return;
    this.busy.set(true);
    const log = await this.state.run((app) =>
      app.planService.launch(me, this.monday(), w.id, this.state.now()),
    );
    this.busy.set(false);
    if (log) await this.router.navigate(['/log'], { queryParams: { mode: 'log' } });
  }

  /** Takes a workout out of the plan at once, with Undo. */
  protected async remove(w: PlannedWorkout): Promise<void> {
    const me = this.me();
    if (!me) return;
    const monday = this.monday();
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

  protected edit(w: PlannedWorkout): void {
    void this.router.navigate(this.editLink(w));
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

  protected async refresh(): Promise<void> {
    this.refreshing.set(true);
    try {
      await this.state.syncSeasons();
    } finally {
      this.refreshing.set(false);
    }
  }
}
