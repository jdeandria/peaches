import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';

import { canManage } from '../../../domain/models/crate';
import {
  CATEGORY_INFO,
  CategoryWeights,
  DEFAULT_RULES,
  PLAN_RULE_KEYS,
  PLAN_RULE_LIMITS,
  PlanRules,
  SCORING_CATEGORIES,
  ScoringCategory,
  WEIGHT_BUDGET,
  weightsTotal,
} from '../../../domain/models/scoring';
import { isSeasonOpen } from '../../../domain/models/season';
import { AppState } from '../../../state/app-state';
import { LoadingIndicator } from '../../expressive/loading-indicator';
import { WavyProgress } from '../../expressive/wavy-progress';
import { Fmt } from '../../format';
import { Card } from '../../layout/card';
import { EmptyState } from '../../layout/empty-state';
import { ListCard } from '../../layout/list-card';
import { Page } from '../../layout/page';
import { Section } from '../../layout/section';
import { Stagger } from '../../layout/stagger';

/** How far one tap moves a category. */
const STEP = 5;

/** How each plan rule is shown and stepped. */
const PLAN_RULES: Readonly<
  Record<keyof PlanRules, { label: string; step: number; describe: (n: number) => string }>
> = {
  bonus: {
    label: 'Plan bonus',
    step: 5,
    describe: (n) =>
      n === 0
        ? 'Hitting your plan earns nothing extra'
        : `Hitting your plan earns ${n}% of it on top`,
  },
  penalty: {
    label: 'Shortfall penalty',
    step: 5,
    describe: (n) =>
      n === 0 ? 'Falling short costs nothing' : `Every point you fall short costs ${n}% of a point`,
  },
};

interface RuleView {
  readonly key: keyof PlanRules;
  readonly label: string;
  readonly mine: number;
  readonly unit: string;
  readonly describe: string;
  readonly crate: number;
  readonly season: number | null;
  readonly min: number;
  readonly max: number;
}

interface CategoryView {
  readonly category: ScoringCategory;
  readonly label: string;
  readonly icon: string;
  readonly per: string;
  readonly mine: number;
  readonly crate: number;
  /** The weight the current Season scores with, if one is under way. */
  readonly season: number | null;
}

/**
 * Members vote on the Crate's rules: each splits 100 points across the
 * scoring categories (the Crate's weights are the average) and picks the
 * plan rules (the middle vote wins). A Season freezes the rules when it
 * starts, so a vote changes the next Season, not this one. Owners also set
 * the grace period here.
 */
@Component({
  selector: 'pch-vote-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Card,
    EmptyState,
    ListCard,
    LoadingIndicator,
    MatButton,
    MatIconButton,
    MatTooltip,
    Page,
    Section,
    Stagger,
    WavyProgress,
  ],
  templateUrl: './vote.page.html',
  styleUrl: './vote.page.scss',
})
export class VotePage {
  readonly crateId = input.required<string>();

  private readonly state = inject(AppState);
  protected readonly budget = WEIGHT_BUDGET;
  protected readonly busy = signal(false);

  private readonly data = this.state.query(
    () => {
      const me = this.state.peachId();
      return me ? { crateId: this.crateId(), me } : undefined;
    },
    async ({ crateId, me }, app) => {
      const [crate, ballots, tally, seasons, members] = await Promise.all([
        app.crates.getById(crateId),
        app.votingService.ballotsOf(crateId),
        app.votingService.currentRules(crateId),
        app.seasons.forCrate(crateId),
        app.crateService.activeMembers(crateId),
      ]);
      const membership = members.find((m) => m.peachId === me) ?? null;
      return {
        crate,
        mine: ballots.find((b) => b.peachId === me)?.rules ?? null,
        votes: ballots.length,
        memberCount: members.length,
        tally,
        season: seasons.find(isSeasonOpen) ?? null,
        member: membership !== null,
        manager: membership !== null && canManage(membership),
      };
    },
  );

  protected readonly loaded = computed(() => this.data.value());

  /** My ballot as I edit it; starts from my vote, else the Crate's tally. */
  protected readonly draft = signal<CategoryWeights>(DEFAULT_RULES.weights);
  protected readonly planDraft = signal<PlanRules>(DEFAULT_RULES.plan);
  private readonly touched = signal(false);
  protected readonly grace = signal<number | null>(null);

  constructor() {
    // Seed the draft once the data arrives, unless the Peach already started editing.
    effect(() => {
      const d = this.data.value();
      if (!d || this.touched()) return;
      const start = d.mine ?? d.tally;
      this.draft.set(start.weights);
      this.planDraft.set(start.plan);
      this.grace.set(d.crate?.settings.loggingGraceHours ?? null);
    });
  }

  protected readonly spent = computed(() => weightsTotal(this.draft()));
  protected readonly left = computed(() => WEIGHT_BUDGET - this.spent());

  protected readonly categories = computed<CategoryView[]>(() => {
    const d = this.data.value();
    const draft = this.draft();
    const units = this.state.units();
    return SCORING_CATEGORIES.map((c) => ({
      category: c,
      label: Fmt.category(c),
      icon: Fmt.categoryIcon(c),
      per: Fmt.per(c, CATEGORY_INFO[c].par, units),
      mine: draft[c],
      crate: d?.tally.weights[c] ?? 0,
      season: d?.season ? d.season.rules.weights[c] : null,
    }));
  });

  protected readonly planRules = computed<RuleView[]>(() => {
    const d = this.data.value();
    const draft = this.planDraft();
    return PLAN_RULE_KEYS.map((key) => ({
      key,
      label: PLAN_RULES[key].label,
      mine: draft[key],
      unit: '%',
      describe: PLAN_RULES[key].describe(draft[key]),
      crate: d?.tally.plan[key] ?? 0,
      season: d?.season ? d.season.rules.plan[key] : null,
      min: PLAN_RULE_LIMITS[key][0],
      max: PLAN_RULE_LIMITS[key][1],
    }));
  });

  protected nudgeRule(key: keyof PlanRules, direction: 1 | -1): void {
    const [min, max] = PLAN_RULE_LIMITS[key];
    this.touched.set(true);
    this.planDraft.update((r) => ({
      ...r,
      [key]: Math.min(max, Math.max(min, r[key] + direction * PLAN_RULES[key].step)),
    }));
  }

  protected readonly status = computed(() => {
    const left = this.left();
    if (left > 0) return `${left} points left to give`;
    if (left < 0) return `${-left} points over: take some back`;
    return 'All 100 points given';
  });

  protected nudge(category: ScoringCategory, direction: 1 | -1): void {
    const current = this.draft();
    const room = direction > 0 ? Math.max(0, this.left()) : current[category];
    const step = Math.min(STEP, room);
    if (step === 0) return;
    this.touched.set(true);
    this.draft.set({ ...current, [category]: current[category] + direction * step });
  }

  protected set(category: ScoringCategory, text: string): void {
    const n = Number(text.trim());
    if (!Number.isInteger(n) || n < 0 || n > WEIGHT_BUDGET) return;
    this.touched.set(true);
    this.draft.update((w) => ({ ...w, [category]: n }));
  }

  protected evenSplit(): void {
    this.touched.set(true);
    // 100 over six categories: 17, 17, 17, 17, 16, 16.
    const base = Math.floor(WEIGHT_BUDGET / SCORING_CATEGORIES.length);
    const extra = WEIGHT_BUDGET - base * SCORING_CATEGORIES.length;
    this.draft.set(
      Object.fromEntries(
        SCORING_CATEGORIES.map((c, i) => [c, base + (i < extra ? 1 : 0)]),
      ) as CategoryWeights,
    );
  }

  async save(): Promise<void> {
    const me = this.state.peachId();
    if (!me || this.busy() || this.left() !== 0) return;
    this.busy.set(true);
    const saved = await this.state.run(
      (app) =>
        app.votingService.castBallot(
          this.crateId(),
          me,
          { weights: this.draft(), plan: this.planDraft() },
          this.state.now(),
        ),
      'Vote saved. It counts from the next Season.',
    );
    if (saved) this.touched.set(false);
    this.busy.set(false);
  }

  protected nudgeGrace(direction: 1 | -1): void {
    const g = this.grace();
    if (g === null) return;
    this.grace.set(Math.min(48, Math.max(0, g + direction)));
  }

  async saveGrace(): Promise<void> {
    const me = this.state.peachId();
    const grace = this.grace();
    const crate = this.data.value()?.crate;
    if (!me || grace === null || !crate) return;
    await this.state.run(
      (app) =>
        app.crateService.updateSettings(crate.id, me, {
          ...crate.settings,
          loggingGraceHours: grace,
        }),
      'Grace period saved.',
    );
  }
}
