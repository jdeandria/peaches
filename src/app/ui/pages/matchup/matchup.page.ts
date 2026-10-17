import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';

import { MatchupSide } from '../../../application/season-service';
import { localDateOfLocal } from '../../../domain/core/local-date';
import { isLocked, LINEUP_OPENS_MS } from '../../../domain/models/lineup';
import { CATEGORY_INFO, SCORING_CATEGORIES } from '../../../domain/models/scoring';
import { involves, isBye, winnerId } from '../../../domain/models/season';
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
import { DisputeCard } from '../workout/dispute-card';

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
  readonly points: string;
  /** My own logs open to edit; crate-mates' open to view and dispute. */
  readonly link: readonly string[];
}

/** One pledge of a lineup: how far along it is, and its battle. */
interface PledgeRow {
  readonly category: string;
  readonly label: string;
  readonly icon: string;
  readonly hit: boolean;
  /** "16.2 of 15 km". */
  readonly progress: string;
  readonly pledgePoints: string;
  /** "Won vs 9 km", or null without an opponent. */
  readonly battle: string | null;
  readonly battleWon: boolean;
  readonly battlePoints: string;
}

/**
 * A week's head-to-head: each side brings their own workouts and lineup.
 * Shows the score (live, then final) and exactly how it adds up: workout
 * points from everything logged, pledge bonuses and battles from the
 * lineups, then the workouts, with anything disputed.
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
    DisputeCard,
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
      if (!b) return undefined;
      const ids = [b.home.peachId, ...(b.away ? [b.away.peachId] : [])];
      return [...new Set([...ids, ...b.disputes.map((d) => d.dispute.openedBy)])];
    },
    async (ids, app) =>
      new Map((await app.peaches.getByIds(ids)).map((p) => [p.id, p.displayName])),
  ).value;

  protected nameOf(side: MatchupSide | null): string {
    return side ? this.nameOfId(side.peachId) : '';
  }

  private nameOfId(peachId: string): string {
    if (peachId === this.me()) return 'You';
    return this.names()?.get(peachId) ?? 'A crate-mate';
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

  /** Whether the week has started, so lineups are locked and revealed. */
  protected readonly started = computed(() => {
    const b = this.board();
    return !!b && isLocked({ locksAt: b.window.opensAt }, this.state.nowTick());
  });

  /** Setting a lineup makes sense here: mine, before the week, once lineups open. */
  protected readonly canSetLineup = computed(() => {
    const b = this.board();
    const s = this.sides();
    if (!b || !s?.playing || this.started() || b.season.rules.lineup.slots === 0) return false;
    return b.window.opensAt.getTime() - this.state.nowTick().getTime() <= LINEUP_OPENS_MS;
  });

  protected readonly usesLineups = computed(
    () => (this.board()?.season.rules.lineup.slots ?? 0) > 0,
  );

  /** Workouts, pledges and battles for each side: the whole score, line by line. */
  protected readonly breakdown = computed(() => {
    const s = this.sides();
    if (!s) return [];
    const sum = (xs: readonly { points: number }[]) => xs.reduce((n, x) => n + x.points, 0);
    const line = (label: string, of: (side: MatchupSide) => number) => ({
      label,
      mine: Fmt.points(of(s.mine)),
      theirs: s.theirs ? Fmt.points(of(s.theirs)) : null,
    });
    return [
      line('Workouts', (side) => side.score.workouts.total),
      ...(this.usesLineups()
        ? [
            line('Pledge bonus', (side) => sum(side.score.pledges)),
            line('Battle prizes', (side) => sum(side.score.battles)),
          ]
        : []),
    ];
  });

  /** Set when a closed week's workouts were edited afterwards. */
  protected readonly editedSince = computed(() => {
    const score = this.score();
    const s = this.sides();
    if (!score?.final || !s) return false;
    return (
      score.mine !== s.mine.score.total ||
      (s.theirs !== null && score.theirs !== s.theirs.score.total)
    );
  });

  private pledgeRows(side: MatchupSide | null, opponent: MatchupSide | null): PledgeRow[] {
    if (!side) return [];
    const units = this.state.units();
    const whose = opponent?.peachId === this.me() ? 'your' : `${this.nameOf(opponent)}’s`;
    return side.score.pledges.map((p, i) => {
      const battle = side.score.battles[i] ?? null;
      const outcome = { win: 'Won', tie: 'Tied', loss: 'Lost' }[battle?.outcome ?? 'loss'];
      return {
        category: p.category,
        label: Fmt.category(p.category),
        icon: Fmt.categoryIcon(p.category),
        hit: p.hit,
        progress: `${Fmt.amount(p.category, p.amount, units)} of ${Fmt.amount(p.category, p.target, units)}`,
        pledgePoints: `Pledge +${Fmt.points(p.points)}`,
        battle: battle && `${outcome} vs ${whose} ${Fmt.amount(p.category, battle.theirs, units)}`,
        battleWon: battle?.outcome === 'win',
        battlePoints: `Battle +${Fmt.points(battle?.points ?? 0)}`,
      };
    });
  }

  protected readonly myPledges = computed(() => {
    const s = this.sides();
    return s ? this.pledgeRows(s.mine, s.theirs) : [];
  });
  /** Null until the week starts: before that a crate-mate's lineup is secret. */
  protected readonly theirPledges = computed(() => {
    const s = this.sides();
    return s && this.started() ? this.pledgeRows(s.theirs, s.mine) : null;
  });

  /** Disputes about either side's workouts, each linking to the workout. */
  protected readonly disputes = computed(() => {
    const b = this.board();
    if (!b) return [];
    return b.disputes.map((view) => ({
      view,
      owner: this.nameOfId(view.dispute.peachId),
      openedBy: this.nameOfId(view.dispute.openedBy),
      link: ['/crates', b.crate.id, 'logs', view.dispute.logId],
    }));
  });

  protected readonly categories = computed<CategoryRow[]>(() => {
    const b = this.board();
    const s = this.sides();
    if (!b || !s) return [];
    const units = this.state.units();
    const amountOf = (side: MatchupSide | null, c: string) =>
      side?.score.workouts.categories.find((x) => x.category === c);
    const weights = b.season.rules.weights;
    return SCORING_CATEGORIES.filter((c) => weights[c] > 0).map((c) => {
      const mine = amountOf(s.mine, c);
      const theirs = amountOf(s.theirs, c);
      const mp = mine?.points ?? 0;
      const tp = theirs?.points ?? 0;
      return {
        label: Fmt.category(c),
        icon: Fmt.categoryIcon(c),
        weight: weights[c],
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
        names: log.entries.map((e) => e.exerciseName).join(', ') || 'Struck',
        points: Fmt.points(this.state.app.scoring.scoreLog(log, b.season.rules.weights).total),
        link: mine ? ['/log', log.id] : ['/crates', b.crate.id, 'logs', log.id],
      }));
  }

  protected readonly myLogs = computed(() => this.logRows(this.sides()?.mine ?? null));
  protected readonly theirLogs = computed(() => this.logRows(this.sides()?.theirs ?? null));
  protected readonly myName = computed(() => this.nameOf(this.sides()?.mine ?? null));
  protected readonly theirName = computed(() => this.nameOf(this.sides()?.theirs ?? null));
}
