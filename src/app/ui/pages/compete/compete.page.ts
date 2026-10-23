import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';

import { isLocked, LINEUP_OPENS_MS } from '../../../domain/models/lineup';
import { isBye, Matchup, opponentOf, Round, winnerId } from '../../../domain/models/season';
import { AppState } from '../../../state/app-state';
import { LoadingIndicator } from '../../expressive/loading-indicator';
import { Fmt } from '../../format';
import { Card } from '../../layout/card';
import { EmptyState } from '../../layout/empty-state';
import { ListCard } from '../../layout/list-card';
import { Page } from '../../layout/page';
import { Section } from '../../layout/section';
import { Stagger } from '../../layout/stagger';
import { TwoPane } from '../../layout/two-pane';
import { MatchupHeroCard, MatchupListRow } from './matchup-card';

interface LineupDue {
  readonly matchup: Matchup;
  /** "Oct 26 – Nov 1" */
  readonly week: string | null;
  readonly crate: string | null;
  /** Who it's against; null for a bye. */
  readonly opponent: string | null;
}

/** Results shown before "Show all". */
const RESULTS_SHOWN = 5;

/**
 * You against other Peaches: what needs you (lineups to set), this week's
 * live matchups, what's coming, and how past weeks went.
 */
@Component({
  selector: 'pch-compete-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MatButton,
    Page,
    Section,
    TwoPane,
    Card,
    ListCard,
    Stagger,
    EmptyState,
    LoadingIndicator,
    MatchupHeroCard,
    MatchupListRow,
  ],
  template: `
    <pch-page
      title="Compete"
      [subtitle]="subtitle()"
      [maxWidth]="1080"
      refreshable
      [refreshing]="refreshing()"
      (refresh)="refresh()"
    >
      @if (matchups() === undefined) {
        <div class="loading"><pch-loading-indicator /></div>
      } @else if (matchups()!.length === 0) {
        <pch-empty-state
          icon="emoji_events"
          title="No matchups yet"
          message="Join or start a Crate. Once its Season starts, you’re paired up every week."
        />
        <div class="empty-action">
          <a matButton="filled" routerLink="/crates">Go to Crates</a>
        </div>
      } @else {
        <pch-two-pane [stackedGap]="16">
          <div primaryPane>
            @for (d of lineupsDue(); track d.matchup.id) {
              <pch-card class="lineup" variant="filled" [pchStagger]="0">
                <span class="material-symbols-rounded" aria-hidden="true">checklist</span>
                <div class="text">
                  <h2 class="pch-title-medium">
                    Set your lineup{{ d.week ? ' for ' + d.week : '' }}
                  </h2>
                  <p class="pch-body-medium muted">
                    {{ d.crate ? d.crate + ' · ' : ''
                    }}{{ d.opponent ? 'vs ' + d.opponent : 'Bye week' }}. Pledge what you’ll do
                    before the week starts{{
                      d.opponent ? '; ' + d.opponent + ' can’t see it until then.' : '.'
                    }}
                  </p>
                </div>
                <a
                  matButton="tonal"
                  [routerLink]="['/matchups', d.matchup.id, 'lineup']"
                  [attr.aria-label]="'Set lineup' + (d.week ? ' for ' + d.week : '')"
                  >Set lineup</a
                >
              </pch-card>
            }

            <pch-section title="This week" [top]="lineupsDue().length > 0 ? 24 : 8" />
            @for (m of open(); track m.id) {
              <pch-matchup-hero-card class="hero" [pchStagger]="$index + 1" [matchup]="m" />
            } @empty {
              <pch-card variant="outlined" [pchStagger]="1">
                No matchup this week. {{ upcoming().length > 0 ? 'The next one is below.' : '' }}
              </pch-card>
            }
          </div>

          <div secondaryPane>
            @if (upcoming().length > 0) {
              <pch-section title="Coming up" [top]="8" />
              <pch-list-card [pchStagger]="open().length + 1">
                @for (m of upcoming(); track m.id) {
                  <pch-matchup-row [matchup]="m" [link]="true" />
                }
              </pch-list-card>
            }

            @if (results().length > 0) {
              <pch-section title="Results" [top]="upcoming().length > 0 ? 24 : 8">
                <span sectionTrailing class="record pch-label-large" aria-label="Season record">{{
                  record()
                }}</span>
              </pch-section>
              <pch-list-card [pchStagger]="open().length + 2">
                @for (m of shownResults(); track m.id) {
                  <pch-matchup-row [matchup]="m" [link]="true" />
                }
              </pch-list-card>
              @if (results().length > resultsShown) {
                <button
                  matButton
                  type="button"
                  class="show-all"
                  [attr.aria-expanded]="showAllResults()"
                  (click)="showAllResults.set(!showAllResults())"
                >
                  {{ showAllResults() ? 'Show fewer' : 'Show all ' + results().length }}
                </button>
              }
            }
          </div>
        </pch-two-pane>
      }
    </pch-page>
  `,
  styles: `
    .loading {
      display: flex;
      justify-content: center;
      padding: 32px 0;
    }
    .empty-action {
      display: flex;
      justify-content: center;
    }
    .hero {
      margin-bottom: 12px;
    }
    .muted {
      color: var(--mat-sys-on-surface-variant);
    }
    .lineup {
      --pch-card-padding: 16px 20px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px 16px;
      margin-bottom: 12px;

      > .material-symbols-rounded {
        color: var(--mat-sys-primary);
      }

      h2,
      p {
        margin: 0;
      }
    }
    .text {
      flex: 1;
      min-width: 180px;
    }
    .record {
      color: var(--mat-sys-on-surface-variant);
      font-variant-numeric: tabular-nums;
    }
    .show-all {
      display: flex;
      margin: 8px auto 0;
    }
  `,
})
export class CompetePage {
  private readonly state = inject(AppState);

  protected readonly refreshing = signal(false);
  protected readonly resultsShown = RESULTS_SHOWN;
  protected readonly showAllResults = signal(false);

  protected readonly matchups = this.state.myMatchups.value;
  protected readonly open = computed(() =>
    (this.matchups() ?? []).filter((m) => m.status === 'inProgress'),
  );

  /** Rounds of the matchups not under way, to put them in date order. */
  private readonly rounds = this.state.query(
    () => {
      const ids = [
        ...new Set(
          (this.matchups() ?? []).filter((m) => m.status !== 'inProgress').map((m) => m.roundId),
        ),
      ];
      return ids.length > 0 ? ids : undefined;
    },
    async (ids, app) => {
      const rounds = await Promise.all(ids.map((id) => app.seasons.getRound(id)));
      return new Map(rounds.filter((r): r is Round => r !== null).map((r) => [r.id, r]));
    },
  );
  private readonly byWeek = computed(() => {
    const rounds = this.rounds.value();
    const date = (m: Matchup) => rounds?.get(m.roundId)?.weekStart ?? '';
    return (a: Matchup, b: Matchup) => (date(a) < date(b) ? -1 : date(a) > date(b) ? 1 : 0);
  });

  protected readonly upcoming = computed(() =>
    (this.matchups() ?? [])
      .filter((m) => m.status === 'scheduled')
      .sort(this.byWeek())
      .slice(0, 4),
  );

  /** Finished matchups, the latest first. */
  protected readonly results = computed(() =>
    (this.matchups() ?? [])
      .filter((m) => m.status === 'complete')
      .sort(this.byWeek())
      .reverse(),
  );
  protected readonly shownResults = computed(() =>
    this.showAllResults() ? this.results() : this.results().slice(0, RESULTS_SHOWN),
  );

  /** "3-1", or "3-1-1" with ties; byes don't count. */
  protected readonly record = computed(() => {
    const me = this.state.peachId();
    let w = 0;
    let l = 0;
    let t = 0;
    for (const m of this.results()) {
      if (m.result === null || isBye(m) || me === null) continue;
      const winner = winnerId(m);
      if (winner === null) t++;
      else if (winner === me) w++;
      else l++;
    }
    return `${w}-${l}${t > 0 ? `-${t}` : ''}`;
  });

  protected readonly subtitle = computed(() => {
    const open = this.open().length;
    if (this.matchups() === undefined) return undefined;
    if (open > 0) return `${open === 1 ? 'A matchup' : `${open} matchups`} this week`;
    return this.results().length > 0 ? `Season record ${this.record()}` : undefined;
  });

  /**
   * Upcoming matchups I haven't set a lineup for, once their lineups open:
   * with the Crate, the week and who it's against, so two read apart.
   */
  private readonly lineupsDueQuery = this.state.query(
    () => {
      const me = this.state.peachId();
      const upcoming = this.upcoming();
      return me && upcoming.length > 0 ? { me, upcoming } : undefined;
    },
    async ({ me, upcoming }, app) => {
      const now = this.state.now();
      const due: LineupDue[] = [];
      for (const m of upcoming) {
        const [season, window, round] = await Promise.all([
          app.seasons.getById(m.seasonId),
          app.seasonService.windowFor(m.roundId),
          app.seasons.getRound(m.roundId),
        ]);
        if (!season || !window || season.rules.lineup.slots === 0) continue;
        if (isLocked({ locksAt: window.opensAt }, now)) continue;
        if (window.opensAt.getTime() - now.getTime() > LINEUP_OPENS_MS) continue;
        if (await app.seasons.getLineup(m.seasonId, m.roundId, me)) continue;
        const opponentId = opponentOf(m, me);
        const [crate, opponent] = await Promise.all([
          app.crates.getById(season.crateId),
          opponentId ? app.peaches.getById(opponentId) : Promise.resolve(null),
        ]);
        due.push({
          matchup: m,
          week: round ? Fmt.week(round.weekStart) : null,
          crate: crate?.name ?? null,
          opponent: isBye(m) ? null : (opponent?.displayName ?? 'your opponent'),
        });
      }
      return due;
    },
  );
  protected readonly lineupsDue = computed(() => this.lineupsDueQuery.value() ?? []);

  protected async refresh(): Promise<void> {
    this.refreshing.set(true);
    try {
      await this.state.syncSeasons();
    } finally {
      this.refreshing.set(false);
    }
  }
}
