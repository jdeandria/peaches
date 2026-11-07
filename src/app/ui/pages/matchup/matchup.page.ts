import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MatchupSide } from '../../../application/season-service';
import { localDateOfLocal } from '../../../domain/core/local-date';
import { CATEGORY_INFO, SCORING_CATEGORIES } from '../../../domain/models/scoring';
import { involves, isBye } from '../../../domain/models/season';
import { AppState } from '../../../state/app-state';
import { LoadingIndicator } from '../../expressive/loading-indicator';
import { Fmt } from '../../format';
import { EmptyState } from '../../layout/empty-state';
import { ListCard } from '../../layout/list-card';
import { ListRow } from '../../layout/list-row';
import { Page } from '../../layout/page';
import { Section } from '../../layout/section';
import { Stagger } from '../../layout/stagger';
import { DisputeCard } from '../workout/dispute-card';
import { MatchupCard } from './matchup-card';

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

/** "+45", "−26": a plan's points with their sign. */
function signed(points: number): string {
  if (points > 0) return `+${Fmt.points(points)}`;
  if (points < 0) return `−${Fmt.points(-points)}`;
  return '0';
}

/**
 * A week's head-to-head: each side brings their own workouts and plan.
 * Shows the score (live, then final) and exactly how it adds up: workout
 * points from everything logged, then each side's plan bonus or penalty,
 * then the workouts, with anything disputed. Before the week starts it
 * shows what each side has committed to so far.
 */
@Component({
  selector: 'pch-matchup-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EmptyState,
    ListCard,
    ListRow,
    LoadingIndicator,
    DisputeCard,
    MatchupCard,
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

  /** Workouts, then the plan, for each side: the whole score, line by line. */
  protected readonly breakdown = computed(() => {
    const s = this.sides();
    if (!s) return [];
    const sides = [s.mine, ...(s.theirs ? [s.theirs] : [])].filter((x) => x.committed > 0);
    const hit = sides.every((x) => x.score.plan >= 0);
    const short = sides.length > 0 && sides.every((x) => x.score.plan < 0);
    const planLabel = short ? 'Plan penalty' : hit ? 'Plan bonus' : 'Plan bonus or penalty';
    return [
      {
        label: 'Workouts',
        mine: Fmt.points(s.mine.score.workouts.total),
        theirs: s.theirs ? Fmt.points(s.theirs.score.workouts.total) : null,
      },
      {
        label: planLabel,
        mine: signed(s.mine.score.plan),
        theirs: s.theirs ? signed(s.theirs.score.plan) : null,
      },
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
