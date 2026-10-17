import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';

import { isLocked, LINEUP_OPENS_MS, Pledge } from '../../../domain/models/lineup';
import {
  CATEGORY_INFO,
  CategoryTotals,
  SCORING_CATEGORIES,
  ScoringCategory,
} from '../../../domain/models/scoring';
import { UnitSystem } from '../../../domain/models/training';
import { AppState } from '../../../state/app-state';
import { LoadingIndicator } from '../../expressive/loading-indicator';
import { Fmt } from '../../format';
import { Card } from '../../layout/card';
import { EmptyState } from '../../layout/empty-state';
import { ListCard } from '../../layout/list-card';
import { Page } from '../../layout/page';
import { Stagger } from '../../layout/stagger';

/** How many past weeks the "usually does" hints average over. */
const FORM_WEEKS = 3;
const MS_PER_WEEK = 7 * 86_400_000;

/** One tap on a pledge's stepper, in display units. */
function stepFor(c: ScoringCategory, units: UnitSystem): number {
  switch (c) {
    case 'runWalk':
      return 1;
    case 'ride':
      return 5;
    case 'swimRow':
      return 250;
    case 'weightMoved':
      return units === 'imperial' ? 1000 : 500;
    case 'reps':
      return 25;
    default:
      return 15;
  }
}

interface CategoryRow {
  readonly category: ScoringCategory;
  readonly label: string;
  readonly icon: string;
  readonly unit: string;
  /** "25 pts per 5 km". */
  readonly value: string;
  /** "You ~12 km · Sam ~20 km a week". */
  readonly form: string;
  /** The pledge, in display units, or null if not picked. */
  readonly shown: number | null;
  /** "Hit it: +37.5 · Beat Sam: +25". */
  readonly payoff: string | null;
}

/**
 * Sets your lineup for a week: pick up to the Season's number of categories
 * and pledge how much of each you'll do. Hitting a pledge earns a bonus on
 * top of its points; doing more of a pledged category than your opponent
 * wins its battle. Lineups are secret until the week starts, so you play
 * against what you think your opponent will do, with their recent weeks as
 * a hint.
 */
@Component({
  selector: 'pch-lineup-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Card,
    EmptyState,
    ListCard,
    LoadingIndicator,
    MatButton,
    MatCheckbox,
    MatIconButton,
    Page,
    Stagger,
  ],
  templateUrl: './lineup.page.html',
  styleUrl: './lineup.page.scss',
})
export class LineupPage {
  readonly matchupId = input.required<string>();

  private readonly state = inject(AppState);
  private readonly router = inject(Router);
  protected readonly busy = signal(false);

  protected readonly data = this.state.query(
    () => {
      const me = this.state.peachId();
      return me ? { id: this.matchupId(), me } : undefined;
    },
    async ({ id, me }, app) => {
      const board = await app.seasonService.board(id);
      if (!board) return null;
      const mine = board.home.peachId === me ? board.home : board.away;
      if (!mine) return null;
      const theirs = mine === board.home ? board.away : board.home;
      const from = new Date(board.window.opensAt.getTime() - FORM_WEEKS * MS_PER_WEEK);
      const [recent, opponent] = await Promise.all([
        app.logs.sharedWith(board.crate.id, from, board.window.opensAt),
        theirs ? app.peaches.getById(theirs.peachId) : null,
      ]);
      const perWeek = (peachId: string): CategoryTotals => {
        const totals = app.scoring.totalsOf(recent.filter((l) => l.peachId === peachId));
        return Object.fromEntries(
          SCORING_CATEGORIES.map((c) => [c, totals[c] / FORM_WEEKS]),
        ) as CategoryTotals;
      };
      return {
        board,
        mine,
        opponentName: opponent?.displayName ?? null,
        myForm: perWeek(me),
        theirForm: theirs ? perWeek(theirs.peachId) : null,
      };
    },
  );

  /** My pledges as I edit them, by category, in canonical units. */
  protected readonly draft = signal<ReadonlyMap<ScoringCategory, number>>(new Map());
  private readonly touched = signal(false);

  constructor() {
    // Start from the lineup in force (mine for the week, or carried over).
    effect(() => {
      const d = this.data.value();
      if (!d || this.touched()) return;
      this.draft.set(new Map(d.mine.lineup?.pledges.map((p) => [p.category, p.target]) ?? []));
    });
  }

  protected readonly locked = computed(() => {
    const d = this.data.value();
    return !!d && isLocked({ locksAt: d.board.window.opensAt }, this.state.nowTick());
  });

  /** Lineups open a week before the week starts. */
  protected readonly notYet = computed(() => {
    const d = this.data.value();
    return (
      !!d && d.board.window.opensAt.getTime() - this.state.nowTick().getTime() > LINEUP_OPENS_MS
    );
  });

  protected readonly rules = computed(() => this.data.value()?.board.season.rules ?? null);
  protected readonly slots = computed(() => this.rules()?.lineup.slots ?? 0);

  protected readonly title = computed(() => {
    const d = this.data.value();
    if (!d) return 'Lineup';
    return `Week ${d.board.round.index + 1} lineup`;
  });

  protected readonly subtitle = computed(() => {
    const d = this.data.value();
    if (!d) return '';
    const vs = d.opponentName ? `vs ${d.opponentName}` : 'Bye week';
    const lock = this.locked()
      ? 'Locked'
      : `Locks ${Fmt.day(d.board.round.weekStart)}, ${Fmt.time(d.board.window.opensAt)}`;
    return `${vs} · ${d.board.crate.name} · ${lock}`;
  });

  /** How the lineup scores, in this Season's numbers. */
  protected readonly explainer = computed(() => {
    const r = this.rules();
    const d = this.data.value();
    if (!r || !d) return '';
    const opponent = d.opponentName ?? 'your opponent';
    const battle =
      d.opponentName && r.lineup.battlePars > 0
        ? ` Do more of a pledged category than ${opponent} and you win its battle: ` +
          `${Fmt.count(r.lineup.battlePars, 'par')} of its points.`
        : '';
    const secret = d.opponentName
      ? ` ${d.opponentName} sees your lineup only once the week starts.`
      : '';
    return (
      `Pick up to ${Fmt.count(r.lineup.slots, 'category', 'categories')} and pledge how much ` +
      `you’ll do this week. Hit a pledge and you earn ${r.lineup.pledgeBonus}% of its points ` +
      `again.${battle}${secret}`
    );
  });

  protected readonly rows = computed<CategoryRow[]>(() => {
    const d = this.data.value();
    const r = this.rules();
    if (!d || !r) return [];
    const units = this.state.units();
    const draft = this.draft();
    const usually = (c: ScoringCategory, form: CategoryTotals | null) =>
      form === null ? null : `~${Fmt.amount(c, form[c], units)}`;
    return SCORING_CATEGORIES.filter((c) => r.weights[c] > 0).map((c) => {
      const target = draft.get(c) ?? null;
      const weight = r.weights[c];
      const pledgePoints =
        target === null ? 0 : (weight * target * r.lineup.pledgeBonus) / 100 / CATEGORY_INFO[c].par;
      const battle =
        d.opponentName && r.lineup.battlePars > 0
          ? ` · Beat ${d.opponentName}: +${Fmt.points(weight * r.lineup.battlePars)}`
          : '';
      return {
        category: c,
        label: Fmt.category(c),
        icon: Fmt.categoryIcon(c),
        unit: Fmt.unit(c, units),
        value: `${weight} pts ${Fmt.per(c, CATEGORY_INFO[c].par, units)}`,
        form:
          [
            `You ${usually(c, d.myForm)}`,
            d.opponentName ? `${d.opponentName} ${usually(c, d.theirForm)}` : null,
          ]
            .filter(Boolean)
            .join(' · ') + ' a week lately',
        shown: target === null ? null : round(Fmt.toDisplay(c, target, units)),
        payoff: target === null ? null : `Hit it: +${Fmt.points(round(pledgePoints))}${battle}`,
      };
    });
  });

  protected readonly full = computed(() => this.draft().size >= this.slots());

  protected toggle(c: ScoringCategory, on: boolean): void {
    const d = this.data.value();
    if (!d) return;
    const next = new Map(this.draft());
    if (on) {
      // Start from what you've been doing lately, else one par, on the step.
      const units = this.state.units();
      const step = stepFor(c, units);
      const start = d.myForm[c] > 0 ? d.myForm[c] : CATEGORY_INFO[c].par;
      const shown = Math.max(step, Math.round(Fmt.toDisplay(c, start, units) / step) * step);
      next.set(c, Fmt.fromDisplay(c, shown, units));
    } else {
      next.delete(c);
    }
    this.touched.set(true);
    this.draft.set(next);
  }

  protected nudge(c: ScoringCategory, direction: 1 | -1): void {
    const target = this.draft().get(c);
    if (target === undefined) return;
    const units = this.state.units();
    const step = stepFor(c, units);
    const shown = Math.round(Fmt.toDisplay(c, target, units) / step) * step + direction * step;
    this.setShown(c, String(Math.max(step, shown)));
  }

  protected setShown(c: ScoringCategory, text: string): void {
    const shown = Number(text.trim());
    if (!Number.isFinite(shown) || shown <= 0 || !this.draft().has(c)) return;
    this.touched.set(true);
    this.draft.update((d) => new Map(d).set(c, Fmt.fromDisplay(c, shown, this.state.units())));
  }

  async save(): Promise<void> {
    const d = this.data.value();
    const me = this.state.peachId();
    if (!d || !me || this.busy()) return;
    const pledges: Pledge[] = SCORING_CATEGORIES.filter((c) => this.draft().has(c)).map((c) => ({
      category: c,
      target: this.draft().get(c)!,
    }));
    this.busy.set(true);
    const saved = await this.state.run(
      (app) =>
        app.lineupService.setLineup({
          roundId: d.board.round.id,
          peachId: me,
          pledges,
          now: this.state.now(),
        }),
      'Lineup set. Good luck.',
    );
    this.busy.set(false);
    if (saved) await this.router.navigate(['/matchups', this.matchupId()]);
  }
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
