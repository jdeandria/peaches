import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';

import { MatchupSide } from '../../../application/season-service';
import { localDateOfLocal } from '../../../domain/core/local-date';
import { CATEGORY_INFO, SCORING_CATEGORIES } from '../../../domain/models/scoring';
import { involves, isBye, winnerId } from '../../../domain/models/season';
import { totalSets } from '../../../domain/models/workout-log';
import { AppState } from '../../../state/app-state';
import { LoadingIndicator } from '../../expressive/loading-indicator';
import { Fmt } from '../../format';
import { AnimatedNumber } from '../../layout/animated-number';
import { Card } from '../../layout/card';
import { EmptyState } from '../../layout/empty-state';
import { ListCard } from '../../layout/list-card';
import { ListRow } from '../../layout/list-row';
import { Page } from '../../layout/page';
import { Section } from '../../layout/section';
import { Stagger } from '../../layout/stagger';

/** One category row of the comparison table. */
interface CategoryRow {
  readonly label: string;
  readonly icon: string;
  readonly weight: number;
  readonly per: string;
  readonly mine: string;
  readonly minePoints: string;
  readonly theirs: string;
  readonly theirPoints: string;
  readonly leader: 'me' | 'them' | null;
}

interface LogRow {
  readonly id: string;
  readonly day: string;
  readonly names: string;
  readonly sets: number;
  readonly points: string;
  /** Only my own logs open (crate-mates' are read from the Crate's copies). */
  readonly link: readonly string[] | null;
}

/**
 * A week's head-to-head: each side brings their own workouts, and
 * everything they log that week scores with the Season's weights. Shows the
 * score (live, then final), where each side earned it, and the workouts.
 */
@Component({
  selector: 'pch-matchup-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AnimatedNumber,
    Card,
    EmptyState,
    ListCard,
    ListRow,
    LoadingIndicator,
    MatButton,
    NgTemplateOutlet,
    Page,
    RouterLink,
    Section,
    Stagger,
  ],
  templateUrl: './matchup.page.html',
  styleUrl: './matchup.page.scss',
})
export class MatchupPage {
  readonly matchupId = input.required<string>();

  private readonly state = inject(AppState);
  protected readonly fmt = Fmt;

  private readonly boardQuery = this.state.query(
    () => this.matchupId(),
    (id, app) => app.seasonService.board(id),
  );
  protected readonly board = computed(() => this.boardQuery.value() ?? null);
  /** loading → spinner; missing → not found; ready. */
  protected readonly phase = computed(() => {
    const b = this.boardQuery.value();
    if (b === undefined) return this.boardQuery.error() ? 'missing' : 'loading';
    return b === null ? 'missing' : 'ready';
  });

  private readonly me = this.state.peachId;
  /** The side to show as "mine": mine if I play in it, else home. */
  private readonly sides = computed(() => {
    const b = this.board();
    if (!b) return null;
    const me = this.me();
    const mineIsAway = me !== null && b.away?.peachId === me;
    return {
      mine: mineIsAway ? b.away! : b.home,
      theirs: mineIsAway ? b.home : b.away,
      playing: me !== null && involves(b.matchup, me),
    };
  });

  private readonly names = this.state.query(
    () => {
      const b = this.board();
      return b ? [b.home.peachId, ...(b.away ? [b.away.peachId] : [])] : undefined;
    },
    async (ids, app) =>
      new Map((await app.peaches.getByIds(ids)).map((p) => [p.id, p.displayName])),
  ).value;

  protected nameOf(side: MatchupSide | null): string {
    if (!side) return '';
    if (side.peachId === this.me()) return 'You';
    return this.names()?.get(side.peachId) ?? '…';
  }

  protected readonly headline = computed(() => {
    const b = this.board();
    const s = this.sides();
    if (!b || !s) return 'Matchup';
    if (isBye(b.matchup)) return s.playing ? 'Your bye week' : `${this.nameOf(s.mine)}’s bye week`;
    return `${this.nameOf(s.mine)} vs ${this.nameOf(s.theirs)}`;
  });

  protected readonly subtitle = computed(() => {
    const b = this.board();
    if (!b) return '';
    return `${b.crate.name} · Week ${b.round.index + 1} · ${Fmt.week(b.round.weekStart)}`;
  });

  protected readonly formatPoints = (v: number) => Fmt.points(v);

  /** Live until the round closes, then the stored result. */
  protected readonly score = computed(() => {
    const b = this.board();
    const s = this.sides();
    if (!b || !s) return null;
    const result = b.matchup.result;
    const homeIsMine = s.mine.peachId === b.matchup.homePeachId;
    const mine = result ? (homeIsMine ? result.homePoints : result.awayPoints) : s.mine.score.total;
    const theirs = result
      ? homeIsMine
        ? result.awayPoints
        : result.homePoints
      : (s.theirs?.score.total ?? 0);
    return { mine, theirs, final: result !== null };
  });

  protected readonly verdict = computed(() => {
    const b = this.board();
    const s = this.sides();
    const score = this.score();
    if (!b || !s || !score) return '';
    if (isBye(b.matchup))
      return score.final ? 'Bye week: points count, no win or loss' : 'Bye week';
    if (score.final) {
      const winner = winnerId(b.matchup);
      if (winner === null) return 'Tie';
      return winner === s.mine.peachId
        ? `${this.nameOf(s.mine)} won`
        : `${this.nameOf(s.theirs)} won`;
    }
    if (score.mine === score.theirs) return 'All square';
    const leader = this.nameOf(score.mine > score.theirs ? s.mine : s.theirs);
    return leader === 'You' ? 'You lead' : `${leader} leads`;
  });

  /** Time left while the week is on, the grace period after, or nothing once final. */
  protected readonly banner = computed(() => {
    const b = this.board();
    if (!b || b.matchup.result !== null) return null;
    const now = this.state.nowTick();
    if (now < b.window.opensAt) return `Starts ${Fmt.day(b.round.weekStart)}`;
    if (b.window.covers(now)) {
      const left = Fmt.closesIn(b.window.endsAt.getTime() - now.getTime()).replace(
        'closes',
        'ends',
      );
      return `Everything you both log this week counts · week ${left}`;
    }
    return `Week over: submit any last workouts · ${Fmt.closesIn(b.window.remainingMsAt(now))}`;
  });

  /** Whether "Log a workout" makes sense here: my matchup, in its week. */
  protected readonly canLog = computed(() => {
    const b = this.board();
    const s = this.sides();
    return (
      !!b && !!s?.playing && b.matchup.result === null && b.window.covers(this.state.nowTick())
    );
  });

  protected readonly categories = computed<CategoryRow[]>(() => {
    const b = this.board();
    const s = this.sides();
    if (!b || !s) return [];
    const units = this.state.units();
    const amountOf = (side: MatchupSide | null, c: string) =>
      side?.score.categories.find((x) => x.category === c);
    return SCORING_CATEGORIES.filter((c) => b.season.weights[c] > 0).map((c) => {
      const mine = amountOf(s.mine, c);
      const theirs = amountOf(s.theirs, c);
      const mp = mine?.points ?? 0;
      const tp = theirs?.points ?? 0;
      return {
        label: Fmt.category(c),
        icon: Fmt.categoryIcon(c),
        weight: b.season.weights[c],
        per: Fmt.per(c, CATEGORY_INFO[c].par, units),
        mine: Fmt.amount(c, mine?.amount ?? 0, units),
        minePoints: Fmt.points(mp),
        theirs: Fmt.amount(c, theirs?.amount ?? 0, units),
        theirPoints: Fmt.points(tp),
        leader: s.theirs === null || mp === tp ? null : mp > tp ? 'me' : 'them',
      };
    });
  });

  protected readonly hasOpponent = computed(() => this.sides()?.theirs != null);

  private logRows(side: MatchupSide | null): LogRow[] {
    const b = this.board();
    if (!side || !b) return [];
    const mine = side.peachId === this.me();
    return [...side.logs]
      .sort((x, y) => x.startedAt.getTime() - y.startedAt.getTime())
      .map((log) => ({
        id: log.id,
        day: Fmt.day(localDateOfLocal(log.startedAt)),
        names: log.entries.map((e) => e.exerciseName).join(', '),
        sets: totalSets(log),
        points: Fmt.points(this.state.app.scoring.scoreLog(log, b.season.weights).total),
        link: mine ? ['/log', log.id] : null,
      }));
  }

  protected readonly myLogs = computed(() => this.logRows(this.sides()?.mine ?? null));
  protected readonly theirLogs = computed(() => this.logRows(this.sides()?.theirs ?? null));
  protected readonly myName = computed(() => this.nameOf(this.sides()?.mine ?? null));
  protected readonly theirName = computed(() => this.nameOf(this.sides()?.theirs ?? null));
}
