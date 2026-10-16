import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { localDateOfLocal } from '../../../domain/core/local-date';
import { isBye, Matchup, Round, winnerId } from '../../../domain/models/season';
import { isSubmitted, volumeLoadKg, WorkoutLog } from '../../../domain/models/workout-log';
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

const MS_PER_DAY = 86_400_000;

interface LogRowView {
  readonly log: WorkoutLog;
  readonly submitted: boolean;
  readonly day: string;
  readonly names: string;
  readonly sets: number;
  readonly volume: string | null;
}

/**
 * What the Peach should do today: the due workout first, then the week at a
 * glance, what's coming, and recent history (port of `TodayScreen`).
 */
@Component({
  selector: 'pch-today-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    RouterLink,
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
    const date = (m: Matchup) => rounds?.get(m.roundId)?.date ?? '';
    return [...this.scheduled()]
      .sort((a, b) => (date(a) < date(b) ? -1 : date(a) > date(b) ? 1 : 0))
      .slice(0, 4);
  });

  protected readonly logs = this.state.myLogs.value;

  /** Workouts and sets submitted in the last seven days, and the season record. */
  protected readonly stats = computed(() => {
    const now = this.state.nowTick().getTime();
    const me = this.state.peachId();
    const week = (this.logs() ?? []).filter(
      (l) => isSubmitted(l) && now - (l.completedAt ?? l.startedAt).getTime() < 7 * MS_PER_DAY,
    );
    const sets = week.reduce((n, l) => n + l.entries.reduce((m, e) => m + e.sets.length, 0), 0);
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
        .map((e) => this.state.catalog.byId(e.exerciseId)?.name ?? e.exerciseId)
        .join(', ');
      const volumeKg = log.entries.reduce((v, e) => v + volumeLoadKg(e), 0);
      return {
        log,
        submitted: isSubmitted(log),
        day: Fmt.day(localDateOfLocal(log.startedAt)),
        names: names || 'Empty log',
        sets: log.entries.reduce((n, e) => n + e.sets.length, 0),
        volume: volumeKg > 0 ? Fmt.volume(volumeKg, units) : null,
      };
    });
  });

  /** Stagger indices follow the visual order. */
  protected readonly statsIndex = computed(() => Math.max(1, this.open().length));

  protected async refresh(): Promise<void> {
    this.refreshing.set(true);
    try {
      await this.state.syncSeasons();
    } finally {
      this.refreshing.set(false);
    }
  }
}
