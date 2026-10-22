import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';

import { localDateOfLocal, startOfWeek } from '../../../domain/core/local-date';
import { isLocked, LINEUP_OPENS_MS } from '../../../domain/models/lineup';
import { isBye, Matchup, Round, winnerId } from '../../../domain/models/season';
import { ScoringCategory } from '../../../domain/models/scoring';
import {
  isSubmitted,
  planProgress,
  totalSets,
  WorkoutLog,
} from '../../../domain/models/workout-log';
import { MetricExtractor } from '../../../domain/services/metric-extractor';
import { AppState } from '../../../state/app-state';
import { LoadingIndicator } from '../../expressive/loading-indicator';
import { ShapedAvatar } from '../../expressive/shaped-avatar';
import { Fmt } from '../../format';
import { Card } from '../../layout/card';
import { ListCard } from '../../layout/list-card';
import { ListRow } from '../../layout/list-row';
import { Page } from '../../layout/page';
import { Section } from '../../layout/section';
import { Stagger } from '../../layout/stagger';
import { TwoPane } from '../../layout/two-pane';
import { MatchupHeroCard, MatchupListRow } from './matchup-card';

interface LogRowView {
  readonly log: WorkoutLog;
  readonly submitted: boolean;
  readonly day: string;
  readonly names: string;
  readonly sets: number;
  /** The amount that sums the workout up: weight moved, else distance. */
  readonly headline: string | null;
}

/** Which total headlines a workout row, in order of preference. */
const HEADLINE_CATEGORIES: readonly ScoringCategory[] = [
  'weightMoved',
  'runWalk',
  'ride',
  'swimRow',
];

/**
 * The Peach's home: log a workout first, then this week's matchups and
 * where they stand, the week at a glance, what's coming, and recent history.
 */
@Component({
  selector: 'pch-today-page',
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
    MatchupHeroCard,
    MatchupListRow,
  ],
  templateUrl: './today.page.html',
  styleUrl: './today.page.scss',
})
export class TodayPage {
  protected readonly state = inject(AppState);

  protected readonly subtitle = computed(() => Fmt.headerDay(this.state.today()));
  protected readonly refreshing = signal(false);

  protected readonly matchups = this.state.myMatchups.value;
  protected readonly open = computed(() =>
    (this.matchups() ?? []).filter((m) => m.status === 'inProgress'),
  );
  private readonly scheduled = computed(() =>
    (this.matchups() ?? []).filter((m) => m.status === 'scheduled'),
  );
  /** Rounds of the scheduled matchups, to sort them by date. */
  private readonly rounds = this.state.query(
    () => {
      const ids = [...new Set(this.scheduled().map((m) => m.roundId))];
      return ids.length > 0 ? ids : undefined;
    },
    async (ids, app) => {
      const rounds = await Promise.all(ids.map((id) => app.seasons.getRound(id)));
      return new Map(rounds.filter((r): r is Round => r !== null).map((r) => [r.id, r]));
    },
  );
  protected readonly upcoming = computed(() => {
    const rounds = this.rounds.value();
    const date = (m: Matchup) => rounds?.get(m.roundId)?.weekStart ?? '';
    return [...this.scheduled()]
      .sort((a, b) => (date(a) < date(b) ? -1 : date(a) > date(b) ? 1 : 0))
      .slice(0, 4);
  });

  /** Upcoming matchups I haven't set a lineup for, once their lineups open. */
  private readonly lineupsDue = this.state.query(
    () => {
      const me = this.state.peachId();
      const upcoming = this.upcoming();
      return me && upcoming.length > 0 ? { me, upcoming } : undefined;
    },
    async ({ me, upcoming }, app) => {
      const now = this.state.now();
      const due: Matchup[] = [];
      for (const m of upcoming) {
        const [season, window] = await Promise.all([
          app.seasons.getById(m.seasonId),
          app.seasonService.windowFor(m.roundId),
        ]);
        if (!season || !window || season.rules.lineup.slots === 0) continue;
        if (isLocked({ locksAt: window.opensAt }, now)) continue;
        if (window.opensAt.getTime() - now.getTime() > LINEUP_OPENS_MS) continue;
        if (!(await app.seasons.getLineup(m.seasonId, m.roundId, me))) due.push(m);
      }
      return due;
    },
  );
  protected readonly lineupDue = computed(() => this.lineupsDue.value()?.[0] ?? null);

  protected readonly logs = this.state.myLogs.value;

  /** The workout the Peach has going, if any. */
  protected readonly draft = computed(
    () => (this.logs() ?? []).find((l) => !isSubmitted(l)) ?? null,
  );
  protected readonly logCta = computed(() => {
    const draft = this.draft();
    if (draft && draft.entries.length > 0) {
      const { done, total } = planProgress(draft);
      return {
        title: 'Workout in progress',
        text:
          total > done
            ? `${done} of ${total} sets done. The clock picks up where it left off.`
            : `${Fmt.count(draft.entries.length, 'exercise')} logged so far. The clock picks up where it left off.`,
        action: 'Continue',
        icon: 'play_arrow',
      };
    }
    if (draft && draft.plan.length > 0) {
      return {
        title: 'Workout planned',
        text: `${Fmt.count(draft.plan.length, 'exercise')} lined up. The clock starts when you do.`,
        action: 'Start',
        icon: 'play_arrow',
      };
    }
    return {
      title: 'Log a workout',
      text: 'Plan it, then tick it off a set at a time. The clock starts when you do.',
      action: 'Start',
      icon: 'play_arrow',
    };
  });

  /** Workouts and sets submitted since Monday, and the season record. */
  protected readonly stats = computed(() => {
    const monday = startOfWeek(this.state.today());
    const me = this.state.peachId();
    const week = (this.logs() ?? []).filter(
      (l) => isSubmitted(l) && localDateOfLocal(l.startedAt) >= monday,
    );
    const sets = week.reduce((n, l) => n + totalSets(l), 0);
    let w = 0;
    let l = 0;
    let t = 0;
    for (const m of this.matchups() ?? []) {
      if (m.result === null || isBye(m) || me === null) continue;
      const winner = winnerId(m);
      if (winner === null) t++;
      else if (winner === me) w++;
      else l++;
    }
    return [
      { value: String(week.length), label: 'Workouts this week' },
      { value: String(sets), label: 'Sets this week' },
      { value: `${w}-${l}${t > 0 ? `-${t}` : ''}`, label: 'Season record' },
    ];
  });

  protected readonly recent = computed<LogRowView[]>(() => {
    const units = this.state.units();
    return (this.logs() ?? []).slice(0, 6).map((log) => {
      const names = log.entries
        .slice(0, 3)
        .map((e) => e.exerciseName)
        .join(', ');
      const totals = MetricExtractor.extract(log);
      const lead = HEADLINE_CATEGORIES.find((c) => totals[c] > 0);
      return {
        log,
        submitted: isSubmitted(log),
        day: Fmt.day(localDateOfLocal(log.startedAt)),
        names: names || 'Empty log',
        sets: totalSets(log),
        headline: lead ? Fmt.amount(lead, totals[lead], units) : null,
      };
    });
  });

  /** Stagger indices follow the visual order: the log card, then matchups, then stats. */
  protected readonly statsIndex = computed(() => 1 + this.open().length);

  protected async refresh(): Promise<void> {
    this.refreshing.set(true);
    try {
      await this.state.syncSeasons();
    } finally {
      this.refreshing.set(false);
    }
  }
}
