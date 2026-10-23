import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  Directive,
  inject,
  input,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';

import { AppContainer } from '../../../application/app-container';
import { MatchupSide } from '../../../application/season-service';
import { isBye, Matchup, opponentOf, Round, winnerId } from '../../../domain/models/season';
import { RoundWindow } from '../../../domain/services/round-window';
import { AppState } from '../../../state/app-state';
import { ShapedAvatar } from '../../expressive/shaped-avatar';
import { WavyProgress } from '../../expressive/wavy-progress';
import { Fmt } from '../../format';
import { AnimatedNumber } from '../../layout/animated-number';
import { DateBadge } from '../../layout/date-badge';
import { ListRow } from '../../layout/list-row';

/** Display data for a matchup that needs a lookup (opponent, round, crate, window). */
export interface MatchupInfo {
  readonly opponentName: string | null;
  readonly round: Round | null;
  readonly crateName: string | null;
  readonly window: RoundWindow | null;
}

/** Resolves the names and dates a matchup card or row shows. */
export async function loadMatchupInfo(
  app: AppContainer,
  m: Matchup,
  me: string | null,
): Promise<MatchupInfo> {
  const opponentId = me === null ? null : opponentOf(m, me);
  const [opponent, round, season, window] = await Promise.all([
    opponentId === null ? null : app.peaches.getById(opponentId),
    app.seasons.getRound(m.roundId),
    app.seasons.getById(m.seasonId),
    app.seasonService.windowFor(m.roundId),
  ]);
  const crate = season ? await app.crates.getById(season.crateId) : null;
  return {
    opponentName: opponent?.displayName ?? null,
    round,
    crateName: crate?.name ?? null,
    window,
  };
}

/** "120 of 185 planned", "40, no plan": one side's workouts against its commitment. */
function planLine(who: string, side: MatchupSide): { who: string; line: string; hit: boolean } {
  const { committed, hit } = side.score;
  const earned = Fmt.points(side.score.workouts.total);
  if (committed <= 0) return { who, line: `${earned} pts, no plan`, hit: false };
  return { who, line: `${earned} of ${Fmt.points(committed)} planned`, hit };
}

/** Shared lookups for the hero card and list row. */
@Directive()
abstract class MatchupView {
  protected readonly state = inject(AppState);
  readonly matchup = input.required<Matchup>();

  protected readonly info = this.state.query(
    () => ({ m: this.matchup(), me: this.state.peachId() }),
    ({ m, me }, app) => loadMatchupInfo(app, m, me),
  );
  protected readonly me = this.state.peachId;
  protected readonly bye = computed(() => isBye(this.matchup()));
  protected readonly opponentId = computed(() => {
    const me = this.me();
    return me === null ? null : opponentOf(this.matchup(), me);
  });
  protected readonly round = computed(() => this.info.value()?.round ?? null);
  protected readonly crateName = computed(() => this.info.value()?.crateName ?? null);
  protected readonly title = computed(() =>
    this.bye() ? 'Bye round' : `vs ${this.info.value()?.opponentName ?? '…'}`,
  );
  /** Avatar initial source: "–" for a bye, "?" until the name loads. */
  protected readonly avatarName = computed(() =>
    this.bye() ? '–' : (this.info.value()?.opponentName ?? '?'),
  );
  protected readonly avatarId = computed(() => this.opponentId() ?? this.matchup().id);
}

/**
 * This week's matchup, as an M3 hero card on the primary container: who
 * you're up against, the live score (workouts plus each plan's bonus or
 * penalty so far), each side's points earned against what they committed
 * to, and how long is left. The call to action is a link; clicking
 * anywhere else on the card follows it too (pointer convenience only).
 */
@Component({
  selector: 'pch-matchup-hero-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButton, ShapedAvatar, WavyProgress, AnimatedNumber],
  template: `
    <!-- The card is a larger mouse target; keyboard and screen readers use its link. -->
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
    <div class="card" (click)="open($event)">
      <div class="top">
        <span class="meta pch-label-large">{{ weekLine() }}</span>
        @if (closesIn(); as closes) {
          <span class="pill pch-label-medium">
            <span class="material-symbols-rounded" aria-hidden="true">schedule</span>{{ closes }}
          </span>
        }
      </div>
      <div class="who">
        <pch-shaped-avatar
          [shapeId]="avatarId()"
          [name]="avatarName()"
          [size]="52"
          color="surface-container-lowest"
          foreground="primary"
        />
        <div class="names">
          <h3 class="pch-headline-small">{{ title() }}</h3>
          @if (crateName(); as crate) {
            <p class="meta pch-body-medium">{{ crate }}</p>
          }
        </div>
      </div>
      @if (score(); as s) {
        <div class="score-row" role="status">
          <span class="pch-label-large">You</span>
          <span class="pch-display-small points">
            <pch-animated-number [value]="s.mine" [format]="formatPoints" />
            @if (!bye()) {
              <span class="dash" aria-hidden="true">–</span>
              <pch-animated-number [value]="s.theirs" [format]="formatPoints" />
            }
          </span>
          <span class="pch-label-large">{{ bye() ? 'pts' : (s.leading ?? 'Tied') }}</span>
        </div>
        @if (!bye()) {
          <pch-wavy-progress
            [value]="s.share"
            [flowing]="s.mine > 0"
            color="primary"
            trackColor="color-mix(in srgb, var(--mat-sys-surface-container-lowest) 70%, transparent)"
          />
        }
        <ul class="plans pch-body-medium" aria-label="Plans">
          @for (p of s.plans; track p.who) {
            <li>
              <span class="material-symbols-rounded" aria-hidden="true">{{
                p.hit ? 'check_circle' : 'event_note'
              }}</span>
              <span
                ><strong>{{ p.who }}</strong> {{ p.line }}</span
              >
            </li>
          }
        </ul>
      }
      <a matButton="filled" class="cta" [routerLink]="link()">
        <span class="material-symbols-rounded" aria-hidden="true">scoreboard</span>
        View matchup
      </a>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .card {
      display: flex;
      flex-direction: column;
      padding: 20px 24px 24px;
      border-radius: var(--pch-radius-extra-large);
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      cursor: pointer;
    }
    .meta {
      opacity: 0.8;
    }
    .top,
    .who,
    .score-row {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .top .meta {
      flex: 1;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--mat-sys-surface-container-lowest) 60%, transparent);
    }
    .pill .material-symbols-rounded {
      font-size: 14px;
    }
    .who {
      margin-top: 16px;
    }
    .names {
      min-width: 0;
    }
    h3,
    p {
      margin: 0;
    }
    .score-row {
      justify-content: space-between;
      margin: 20px 0 8px;
    }
    .points {
      display: inline-flex;
      gap: 8px;
      font-variant-numeric: tabular-nums;
    }
    .dash {
      opacity: 0.6;
    }
    .plans {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin: 12px 0 0;
      padding: 0;
      list-style: none;
    }
    .plans li {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .plans .material-symbols-rounded {
      font-size: 18px;
    }
    .cta {
      margin-top: 20px;
      width: 100%;
    }
    .cta .material-symbols-rounded {
      margin-inline-end: 8px;
      font-size: 20px;
    }
  `,
})
export class MatchupHeroCard extends MatchupView {
  private readonly router = inject(Router);

  /** Both sides' logs this week, scored with the Season's weights. */
  private readonly board = this.state.query(
    () => this.matchup().id,
    (id, app) => app.seasonService.board(id),
  ).value;

  protected readonly formatPoints = (v: number) => Fmt.points(v);

  protected readonly score = computed(() => {
    const board = this.board();
    const me = this.me();
    if (!board || me === null) return null;
    const home = board.home.peachId === me;
    const mySide = home ? board.home : board.away;
    const theirSide = home ? board.away : board.home;
    const mine = mySide?.score.total ?? 0;
    const theirs = theirSide?.score.total ?? 0;
    // Shares of a negative total make no sense: compare what's above zero.
    const total = Math.max(0, mine) + Math.max(0, theirs);
    const plans = [
      ...(mySide ? [planLine('You', mySide)] : []),
      ...(theirSide ? [planLine(this.info.value()?.opponentName ?? 'Them', theirSide)] : []),
    ];
    return {
      mine,
      theirs,
      share: total === 0 ? 0.5 : Math.max(0, mine) / total,
      leading: mine > theirs ? 'Leading' : mine < theirs ? 'Trailing' : null,
      plans,
    };
  });

  protected readonly weekLine = computed(() => {
    const r = this.round();
    return r ? `Week ${r.index + 1} · ${Fmt.week(r.weekStart)}` : '';
  });
  protected readonly closesIn = computed(() => {
    const window = this.info.value()?.window;
    if (!window) return null;
    return Fmt.closesIn(window.remainingMsAt(this.state.nowTick()));
  });
  protected readonly link = computed(() => ['/matchups', this.matchup().id]);

  protected open(event: MouseEvent): void {
    // The link handles its own clicks; text selection is not a click.
    if ((event.target as Element).closest('a')) return;
    if (getSelection()?.toString()) return;
    void this.router.navigate(this.link());
  }
}

/**
 * A matchup as a list row: opponent, crate and week, with a calendar badge
 * for the week's Monday or the result once played. With `link` set the row
 * opens the matchup.
 */
@Component({
  selector: 'pch-matchup-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterLink, ListRow, ShapedAvatar, DateBadge],
  template: `
    <ng-template #trailing>
      @if (result(); as r) {
        <span class="result">
          <span class="pch-title-small score" [class.won]="r.won">{{ r.score }}</span>
          <span class="pch-label-small outcome">{{ r.outcome }}</span>
        </span>
      } @else if (round(); as round) {
        <pch-date-badge [date]="round.weekStart" />
      }
    </ng-template>
    @if (link()) {
      <a pch-list-row [routerLink]="['/matchups', matchup().id]">
        <pch-shaped-avatar rowLeading [shapeId]="avatarId()" [name]="avatarName()" />
        {{ title() }}
        <span rowSubtitle class="one-line">{{ subtitle() }}</span>
        <span rowTrailing><ng-container [ngTemplateOutlet]="trailing" /></span>
      </a>
    } @else {
      <pch-list-row>
        <pch-shaped-avatar rowLeading [shapeId]="avatarId()" [name]="avatarName()" />
        {{ title() }}
        <span rowSubtitle class="one-line">{{ subtitle() }}</span>
        <span rowTrailing><ng-container [ngTemplateOutlet]="trailing" /></span>
      </pch-list-row>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .one-line {
      display: block;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .result {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }
    .score {
      font-variant-numeric: tabular-nums;
    }
    .won {
      color: var(--mat-sys-primary);
    }
    .outcome {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class MatchupListRow extends MatchupView {
  /** Make the row a link to the matchup. */
  readonly link = input(false);

  protected readonly subtitle = computed(() => {
    const r = this.round();
    return [this.crateName(), r ? Fmt.week(r.weekStart) : null]
      .filter((s) => s !== null)
      .join(' · ');
  });

  protected readonly result = computed(() => {
    const m = this.matchup();
    const me = this.me();
    if (m.result === null || me === null) return null;
    const home = m.homePeachId === me;
    const mine = home ? m.result.homePoints : m.result.awayPoints;
    const theirs = home ? m.result.awayPoints : m.result.homePoints;
    const winner = winnerId(m);
    const won = winner === me;
    return {
      won,
      score: isBye(m) ? Fmt.points(mine) : `${Fmt.points(mine)}–${Fmt.points(theirs)}`,
      outcome: isBye(m) ? 'Bye' : won ? 'Won' : winner === null ? 'Tie' : 'Lost',
    };
  });
}
