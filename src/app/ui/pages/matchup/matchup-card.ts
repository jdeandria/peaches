import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

import { MatchupBoard, MatchupSide } from '../../../application/season-service';
import { round2 } from '../../../domain/core/math';
import { isLocked } from '../../../domain/models/commitment';
import { involves, isBye, winnerId } from '../../../domain/models/season';
import { AppState } from '../../../state/app-state';
import { WavyProgress } from '../../expressive/wavy-progress';
import { Fmt } from '../../format';
import { AnimatedNumber } from '../../layout/animated-number';

/** One side of the card: who, their number, what it's made of, and how full their bar is. */
export interface MatchupCardSide {
  readonly peachId: string;
  readonly name: string;
  /** The score once the week is on (or final); before it, what the plan is worth. */
  readonly value: number;
  /** "47.8 of 104.5 planned", "12 pts, no plan", "Planned so far". */
  readonly caption: string;
  /** 0 to 1: earned of committed once the week is on; before it, against the bigger plan. */
  readonly fill: number;
}

/** Everything the matchup card shows, worked out from a board. */
export interface MatchupCardView {
  /** The Crate's name where the screen doesn't already say it, else empty. */
  readonly meta: string;
  /** "Ends in 6 d", "Locks in 2 d", "Closes in 5 h", "Final". */
  readonly when: string;
  readonly sides: readonly MatchupCardSide[];
  /** The one line that matters most right now. */
  readonly headline: string;
  readonly detail: string | null;
  /** The headline is bad news for the viewer. */
  readonly behind: boolean;
  /** "You vs Cho", "Your bye week": names the card for screen readers. */
  readonly title: string;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "47.8 of 104.5 planned", "12 pts, no plan": one side's workouts against its commitment. */
function planCaption(side: MatchupSide): string {
  const { committed } = side.score;
  const earned = Fmt.points(side.score.workouts.total);
  return committed <= 0
    ? `${earned} pts, no plan`
    : `${earned} of ${Fmt.points(committed)} planned`;
}

/**
 * Works out the matchup card from a board, from `me`'s side if they play in
 * it (else the home side's). Before the week the numbers are each plan's
 * worth, with `planned` standing in for mine while I'm still planning; once
 * it starts they're the live score, then the final one, each with its
 * workouts against the plan underneath.
 */
export function matchupCardView(args: {
  board: MatchupBoard;
  me: string | null;
  names: ReadonlyMap<string, string>;
  /** What my plan is worth right now, before the week locks it in. */
  planned?: number | null;
  showCrate?: boolean;
  now: Date;
}): MatchupCardView {
  const { board, me, names, now } = args;
  const playing = me !== null && involves(board.matchup, me);
  const mineIsAway = playing && board.away?.peachId === me;
  const mine = mineIsAway ? board.away! : board.home;
  const theirs = mineIsAway ? board.home : board.away;
  const nameOf = (id: string) => (id === me ? 'You' : (names.get(id) ?? 'Your opponent'));
  const them = theirs ? nameOf(theirs.peachId) : null;
  const result = board.matchup.result;
  const final = result !== null;
  const locked = final || isLocked({ locksAt: board.window.opensAt }, now);

  // The screen around the card already says which week it is.
  const meta = args.showCrate ? board.crate.name : '';

  let when: string;
  if (final) when = 'Final';
  else if (!locked)
    when = capitalize(
      Fmt.closesIn(board.window.opensAt.getTime() - now.getTime()).replace('closes', 'locks'),
    );
  else if (board.window.covers(now))
    when = capitalize(
      Fmt.closesIn(board.window.endsAt.getTime() - now.getTime()).replace('closes', 'ends'),
    );
  else when = capitalize(Fmt.closesIn(board.window.remainingMsAt(now)));

  // Final scores are the stored result; workouts edited since don't change it.
  const finalOf = (side: MatchupSide) =>
    side.peachId === board.matchup.homePeachId ? result!.homePoints : result!.awayPoints;
  const myCommitted = !locked && playing && args.planned != null ? args.planned : mine.committed;
  const top = Math.max(myCommitted, theirs?.committed ?? 0, 1);
  const side = (s: MatchupSide, committed: number): MatchupCardSide => {
    const earned = s.score.workouts.total;
    return locked
      ? {
          peachId: s.peachId,
          name: nameOf(s.peachId),
          value: final ? finalOf(s) : s.score.total,
          caption: planCaption(s),
          fill: s.score.committed > 0 ? Math.min(1, earned / s.score.committed) : 0,
        }
      : {
          peachId: s.peachId,
          name: nameOf(s.peachId),
          value: committed,
          caption: committed > 0 ? 'Planned so far' : 'Nothing planned yet',
          fill: committed / top,
        };
  };
  const sides = [side(mine, myCommitted), ...(theirs ? [side(theirs, theirs.committed)] : [])];

  const title = isBye(board.matchup)
    ? playing
      ? 'Your bye week'
      : `${nameOf(mine.peachId)}’s bye week`
    : `${nameOf(mine.peachId)} vs ${them}`;
  const base = { meta, when, sides, title };

  if (final) {
    if (isBye(board.matchup)) {
      return {
        ...base,
        headline: 'Bye week: points count, no win or loss',
        detail: null,
        behind: false,
      };
    }
    const winner = winnerId(board.matchup);
    const headline =
      winner === null
        ? 'Tie'
        : winner === mine.peachId
          ? `${nameOf(mine.peachId)} won`
          : `${them} won`;
    return { ...base, headline, detail: null, behind: playing && winner !== null && winner !== me };
  }

  if (!playing) {
    const [a, b] = [sides[0].value, sides[1]?.value ?? 0];
    const leader = a === b ? null : a > b ? sides[0].name : sides[1]!.name;
    return {
      ...base,
      headline: !locked ? 'Plans still moving' : leader ? `${leader} leads` : 'All square',
      detail: null,
      behind: false,
    };
  }

  const { bonus, penalty } = board.season.rules.plan;
  if (!locked) {
    const stakes =
      myCommitted > 0
        ? `Hit it for +${Fmt.points(round2((myCommitted * bonus) / 100))}; miss and lose ${penalty}% of the gap.`
        : null;
    if (!theirs) {
      return {
        ...base,
        headline: 'Bye week: your plan still earns its bonus',
        detail: stakes,
        behind: false,
      };
    }
    const gap = round2(theirs.committed - myCommitted);
    return {
      ...base,
      headline:
        gap > 0
          ? `Plan ${Fmt.points(gap)} more to match ${them}`
          : gap < 0
            ? `${Fmt.points(-gap)} ahead of ${them}’s plan`
            : theirs.committed === 0
              ? 'Neither of you has planned yet'
              : `Level with ${them}’s plan`,
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
    score.committed > 0 && !score.hit ? `Stop here and it costs ${Fmt.points(-score.plan)}.` : null;
  const behind = theirs !== null && score.total < theirs.score.total;
  return { ...base, headline, detail, behind };
}

/**
 * A matchup, the same card wherever it shows (the Plan, a Crate, the
 * matchup itself): the week and how long is left, each side's number on a
 * bar of their workouts against their plan, and the one line that matters.
 * The highlighted surface is kept for what's live. With `link` the whole
 * card opens the matchup.
 */
@Component({
  selector: 'pch-matchup-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterLink, WavyProgress, AnimatedNumber],
  template: `
    @if (view(); as v) {
      @if (link()) {
        <a
          class="card link"
          [routerLink]="['/matchups', board().matchup.id]"
          [attr.aria-label]="'View matchup: ' + v.title + ', ' + v.headline"
        >
          <ng-container [ngTemplateOutlet]="body" />
        </a>
      } @else {
        <div class="card" role="status" aria-live="polite">
          <ng-container [ngTemplateOutlet]="body" />
        </div>
      }
      <ng-template #body>
        <span class="top">
          @if (v.meta) {
            <span class="meta pch-label-large">{{ v.meta }}</span>
          }
          <span class="pill pch-label-medium">{{ v.when }}</span>
          @if (link()) {
            <span class="material-symbols-rounded chevron" aria-hidden="true">chevron_right</span>
          }
        </span>
        <span class="sides">
          @for (s of v.sides; track s.peachId; let first = $first) {
            <span class="side">
              <span class="name pch-title-small">{{ s.name }}</span>
              <span class="bar">
                <pch-wavy-progress
                  [value]="s.fill"
                  [flowing]="first && s.fill > 0 && s.fill < 1"
                  [color]="
                    first
                      ? 'primary'
                      : 'color-mix(in srgb, var(--mat-sys-on-primary-container) 55%, transparent)'
                  "
                  trackColor="color-mix(in srgb, var(--mat-sys-surface-container-lowest) 70%, transparent)"
                />
                <span class="caption pch-body-small">{{ s.caption }}</span>
              </span>
              <pch-animated-number
                class="value pch-headline-small"
                [value]="s.value"
                [format]="formatPoints"
              />
            </span>
          }
        </span>
        <span class="foot">
          <span class="headline pch-title-small" [class.behind]="v.behind">{{ v.headline }}</span>
          @if (v.detail) {
            <span class="pch-body-small">{{ v.detail }}</span>
          }
        </span>
      </ng-template>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .card {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px 20px 20px;
      border-radius: var(--pch-radius-extra-large);
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      text-decoration: none;
    }
    .link {
      position: relative;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .link::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: currentColor;
      opacity: 0;
      pointer-events: none;
      transition: opacity 150ms linear;
    }
    .link:hover::after {
      opacity: var(--mat-sys-hover-state-layer-opacity);
    }
    .link:active::after {
      opacity: var(--mat-sys-pressed-state-layer-opacity);
    }
    .link:focus-visible {
      outline: var(--pch-focus-ring, 2px solid var(--mat-sys-primary));
      outline-offset: 2px;
    }
    .top {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .meta {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .pill {
      flex: none;
      margin-inline-end: auto;
      padding: 4px 10px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--mat-sys-surface-container-lowest) 60%, transparent);
    }
    .chevron {
      margin-inline-end: -8px;
    }
    .sides {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .side {
      display: grid;
      grid-template-columns: 64px 1fr auto;
      align-items: center;
      gap: 12px;
    }
    .name {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .bar {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .caption {
      opacity: 0.85;
    }
    .value {
      min-width: 64px;
      text-align: end;
      font-variant-numeric: tabular-nums;
    }
    .foot {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .headline.behind {
      color: var(--mat-sys-error);
    }
  `,
})
export class MatchupCard {
  private readonly state = inject(AppState);

  readonly board = input.required<MatchupBoard>();
  /** What my plan is worth right now (the Plan tab, before the week locks). */
  readonly planned = input<number | null>(null);
  /** Name the Crate in the top line, where the screen doesn't already. */
  readonly showCrate = input(false, { transform: booleanAttribute });
  /** Make the whole card a link to the matchup. */
  readonly link = input(false, { transform: booleanAttribute });

  private readonly names = this.state.query(
    () => {
      const b = this.board();
      return [b.home.peachId, ...(b.away ? [b.away.peachId] : [])];
    },
    async (ids, app) =>
      new Map((await app.peaches.getByIds(ids)).map((p) => [p.id, p.displayName])),
  ).value;

  protected readonly formatPoints = (v: number) => Fmt.points(v);

  protected readonly view = computed(() => {
    const names = this.names();
    if (!names) return null;
    return matchupCardView({
      board: this.board(),
      me: this.state.peachId(),
      names,
      planned: this.planned(),
      showCrate: this.showCrate(),
      now: this.state.nowTick(),
    });
  });
}
