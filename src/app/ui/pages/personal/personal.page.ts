import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { WeightUnits } from '../../../domain/core/units';
import { addDays, LocalDate, localDateOfLocal, startOfWeek } from '../../../domain/core/local-date';
import { EquipmentLocation, MAX_LOCATIONS, Peach } from '../../../domain/models/peach';
import { DistanceKind, ScoringCategory, SCORING_CATEGORIES } from '../../../domain/models/scoring';
import { UnitSystem } from '../../../domain/models/training';
import { isSubmitted, totalSets, WorkoutLog } from '../../../domain/models/workout-log';
import { MetricExtractor } from '../../../domain/services/metric-extractor';
import { AppState } from '../../../state/app-state';
import { Pwa } from '../../../state/pwa';
import { APP_VERSION } from '../../../version';
import { ButtonGroup, ButtonGroupOption } from '../../expressive/button-group';
import { LoadingIndicator } from '../../expressive/loading-indicator';
import { ShapedAvatar } from '../../expressive/shaped-avatar';
import { WavyProgress } from '../../expressive/wavy-progress';
import { Fmt } from '../../format';
import { Card } from '../../layout/card';
import { EmptyState } from '../../layout/empty-state';
import { ListCard } from '../../layout/list-card';
import { ListRow } from '../../layout/list-row';
import { Page } from '../../layout/page';
import { Section } from '../../layout/section';
import { Stagger } from '../../layout/stagger';
import { SwipeRow } from '../../layout/swipe-row';
import {
  equipmentSummary,
  LocationDialog,
  LocationDialogData,
  LocationDialogResult,
} from './location-dialog';
import { personalRecords, planKept, weekOf, workoutsPerWeek } from './personal-stats';

export type PersonalView = 'stats' | 'history' | 'equipment' | 'settings';

const VIEWS: readonly ButtonGroupOption<PersonalView>[] = [
  { value: 'stats', label: 'Stats' },
  { value: 'history', label: 'History' },
  { value: 'equipment', label: 'Gear' },
  { value: 'settings', label: 'Settings' },
];

const UNIT_OPTIONS: readonly ButtonGroupOption<UnitSystem>[] = [
  { value: 'metric', label: 'Metric' },
  { value: 'imperial', label: 'Imperial' },
];

interface LogRowView {
  readonly log: WorkoutLog;
  readonly submitted: boolean;
  readonly day: string;
  readonly names: string;
  readonly sets: number;
  /** The amount that sums the workout up: weight moved, else distance. */
  readonly headline: string | null;
}

interface WeekView {
  /** "This week", "Last week", "Oct 5 – 11". */
  readonly label: string;
  readonly rows: readonly LogRowView[];
}

/** Which total headlines a workout row, in order of preference. */
const HEADLINE_CATEGORIES: readonly ScoringCategory[] = [
  'weightMoved',
  'runWalk',
  'ride',
  'swimRow',
];

/** Workouts in the history before (and per) "Show more". */
const HISTORY_PAGE = 10;
/** How each distance record reads. */
const LONGEST: Readonly<Record<DistanceKind, string>> = {
  runWalk: 'Longest run or walk',
  ride: 'Longest ride',
  swimRow: 'Longest swim or row',
};

/** Heaviest lifts listed. */
const LIFT_RECORDS = 5;
/** Weeks of plans looked back over. */
const PLAN_WEEKS = 4;

/**
 * You: how your training is going (this week, recent weeks, how well you
 * keep your plans, personal bests), every workout you've logged, where you
 * train and with what, and your settings. One view at a time, kept in
 * `?view=`.
 */
@Component({
  selector: 'pch-personal-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonGroup,
    Card,
    EmptyState,
    ListCard,
    ListRow,
    LoadingIndicator,
    MatButton,
    MatIconButton,
    MatTooltip,
    NgTemplateOutlet,
    Page,
    RouterLink,
    Section,
    ShapedAvatar,
    Stagger,
    SwipeRow,
    WavyProgress,
  ],
  templateUrl: './personal.page.html',
  styleUrl: './personal.page.scss',
})
export class PersonalPage {
  /** Query param: which view shows (`stats` when absent). */
  readonly view = input<string>();

  private readonly state = inject(AppState);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  protected readonly pwa = inject(Pwa);

  protected readonly version = APP_VERSION;
  protected readonly unitOptions = UNIT_OPTIONS;
  protected readonly views = VIEWS;
  protected readonly shown = computed<PersonalView>(
    () => VIEWS.find((v) => v.value === this.view())?.value ?? 'stats',
  );

  /** Switches views in place, keeping the choice in the URL for Back. */
  protected showView(view: PersonalView | null): void {
    if (!view) return;
    void this.router.navigate([], {
      queryParams: { view: view === 'stats' ? null : view },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected readonly peach = computed(() => this.state.peach.value());
  /** True while the profile is still loading (as opposed to signed out). */
  protected readonly loading = computed(
    () => this.state.peachId() !== null && this.state.peach.value() === undefined,
  );

  protected readonly identityLine = computed(() => {
    const p = this.peach();
    const crates = this.state.myCrates.value()?.length ?? 0;
    return [...(p?.email ? [p.email] : []), Fmt.count(crates, 'Crate')].join(' · ');
  });

  protected readonly logs = this.state.myLogs.value;
  private readonly thisWeek = computed(() => startOfWeek(this.state.today()));
  private readonly submitted = computed(() => (this.logs() ?? []).filter(isSubmitted));

  // ── Stats ────────────────────────────────────────────────────────────────

  /** Workouts, sets and active minutes since Monday. */
  protected readonly stats = computed(() => {
    const week = this.submitted().filter((l) => weekOf(l) === this.thisWeek());
    const sets = week.reduce((n, l) => n + totalSets(l), 0);
    const minutes = week.reduce((n, l) => n + MetricExtractor.extract(l).activeMinutes, 0);
    return [
      { value: String(week.length), label: week.length === 1 ? 'Workout' : 'Workouts' },
      { value: String(sets), label: sets === 1 ? 'Set' : 'Sets' },
      { value: String(Math.round(minutes)), label: 'Active min' },
    ];
  });

  /** What this week adds up to, per category (active minutes are in the tiles). */
  protected readonly weekTotals = computed(() => {
    const units = this.state.units();
    const week = this.submitted().filter((l) => weekOf(l) === this.thisWeek());
    const totals = this.state.app.scoring.totalsOf(week);
    return SCORING_CATEGORIES.filter((c) => c !== 'activeMinutes' && totals[c] > 0).map((c) => ({
      category: c,
      icon: Fmt.categoryIcon(c),
      label: Fmt.category(c),
      amount: Fmt.amount(c, totals[c], units),
    }));
  });

  /** Finished workouts per week, newest first, with a bar against the busiest week. */
  protected readonly weeks = computed(() => {
    const weeks = workoutsPerWeek(this.submitted(), this.thisWeek());
    const most = Math.max(1, ...weeks.map((w) => w.count));
    return weeks.map((w) => ({
      key: w.monday,
      label: this.weekLabel(w.monday),
      count: Fmt.count(w.count, 'workout'),
      fraction: w.count / most,
    }));
  });

  private readonly plans = this.state.watch(
    () => this.state.peachId() ?? undefined,
    (id, app) => app.plans.watchForPeach(id),
  );

  /** How many planned workouts were done, over the last few weeks. */
  protected readonly kept = computed(() => {
    const kept = planKept(this.plans.value() ?? [], this.logs() ?? [], this.thisWeek(), PLAN_WEEKS);
    return {
      ...kept,
      summary: `${kept.kept} of ${Fmt.count(kept.planned, 'planned workout')} done in the last ${PLAN_WEEKS} weeks`,
      fraction: kept.planned > 0 ? kept.kept / kept.planned : 0,
      bars: kept.weeks.map((w) => ({
        key: w.monday,
        label: Fmt.week(w.monday),
        short: Fmt.week(w.monday).split(' – ')[0],
        text: `${w.kept} of ${w.planned}`,
        fraction: w.kept / w.planned,
        all: w.kept >= w.planned,
      })),
    };
  });

  /** Personal bests, ready to show. */
  protected readonly records = computed(() => {
    const units = this.state.units();
    const { lifts, distances, reps } = personalRecords(this.submitted());
    const when = (on: Date) => Fmt.day(localDateOfLocal(on));
    return {
      lifts: lifts.slice(0, LIFT_RECORDS).map((r) => ({
        key: r.exerciseId,
        name: r.name,
        value: `${weight(r.loadKg, units)} × ${r.reps}`,
        when: when(r.on),
      })),
      singles: [
        ...distances.map((d) => ({
          key: d.kind,
          icon: Fmt.categoryIcon(d.kind),
          label: LONGEST[d.kind],
          value: Fmt.amount(d.kind, d.amount, units),
          when: when(d.on),
        })),
        ...(reps
          ? [
              {
                key: 'reps',
                icon: Fmt.categoryIcon('reps'),
                label: 'Most reps in a set',
                value: `${reps.reps} · ${reps.name}`,
                when: when(reps.on),
              },
            ]
          : []),
      ],
    };
  });

  // ── History ──────────────────────────────────────────────────────────────

  protected readonly historyShown = signal(HISTORY_PAGE);
  private readonly rows = computed<LogRowView[]>(() => {
    const units = this.state.units();
    return (this.logs() ?? []).map((log) => {
      const names = log.entries
        .slice(0, 3)
        .map((e) => e.exerciseName)
        .join(', ');
      const totals = MetricExtractor.extract(log);
      const lead = HEADLINE_CATEGORIES.find((c) => totals[c] > 0);
      const submitted = isSubmitted(log);
      return {
        log,
        submitted,
        day: submitted ? Fmt.day(localDateOfLocal(log.startedAt)) : 'In progress',
        names: names || (log.plan.length > 0 ? 'Planned, not started' : 'Nothing logged yet'),
        sets: totalSets(log),
        headline: lead ? Fmt.amount(lead, totals[lead], units) : null,
      };
    });
  });
  protected readonly moreHistory = computed(() => this.rows().length > this.historyShown());

  /** The history, a week to a heading, newest first. */
  protected readonly history = computed<WeekView[]>(() => {
    const weeks: { monday: LocalDate; rows: LogRowView[] }[] = [];
    for (const row of this.rows().slice(0, this.historyShown())) {
      const monday = row.submitted ? weekOf(row.log) : this.thisWeek();
      const week = weeks.at(-1);
      if (week && week.monday === monday) week.rows.push(row);
      else weeks.push({ monday, rows: [row] });
    }
    return weeks.map((w) => ({ label: this.weekLabel(w.monday), rows: w.rows }));
  });

  protected showMore(): void {
    this.historyShown.update((n) => n + HISTORY_PAGE);
  }

  /** Opens a workout to change it: a finished one's page, or the one going. */
  protected openLog(r: LogRowView): void {
    void this.router.navigate(r.submitted ? ['/log', r.log.id] : ['/log']);
  }

  /** Deletes a workout at once, with Undo to put it back. */
  protected async deleteLog(r: LogRowView): Promise<void> {
    const me = this.state.peachId();
    if (!me) return;
    const removed = await this.state.run((app) => app.loggingService.deleteLog(r.log.id, me));
    if (!removed) return;
    this.state.toast(
      r.submitted ? `Deleted ${r.day}’s workout.` : 'Discarded the workout in progress.',
      () => {
        void this.state.run((app) => app.loggingService.restoreLog(removed));
      },
    );
  }

  // ── Equipment ────────────────────────────────────────────────────────────

  protected readonly maxLocations = MAX_LOCATIONS;
  protected readonly locations = computed(() =>
    (this.peach()?.locations ?? []).map((location) => ({
      location,
      summary: equipmentSummary(location.equipment),
    })),
  );

  /** Adds a location, or edits `existing`. */
  protected async editLocation(peach: Peach, existing: EquipmentLocation | null): Promise<void> {
    if (!existing && peach.locations.length >= MAX_LOCATIONS) {
      this.state.toast(`You can keep up to ${MAX_LOCATIONS} locations.`);
      return;
    }
    const ref = this.dialog.open<LocationDialog, LocationDialogData, LocationDialogResult>(
      LocationDialog,
      {
        data: {
          location: existing,
          taken: peach.locations.filter((l) => l.id !== existing?.id).map((l) => l.name),
        },
        width: '520px',
        maxWidth: 'calc(100vw - 32px)',
      },
    );
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;
    const locations = existing
      ? peach.locations.map((l) => (l.id === existing.id ? { ...l, ...result } : l))
      : [...peach.locations, { id: this.state.app.ids.newId(), ...result }];
    await this.saveLocations(
      peach,
      locations,
      existing ? 'Location saved.' : `Added ${result.name}.`,
    );
  }

  /** Deletes a location at once, with Undo to put it back where it was. */
  protected async deleteLocation(peach: Peach, location: EquipmentLocation): Promise<void> {
    const at = peach.locations.findIndex((l) => l.id === location.id);
    const saved = await this.saveLocations(
      peach,
      peach.locations.filter((l) => l.id !== location.id),
    );
    if (!saved) return;
    this.state.toast(`Deleted ${location.name}.`, () => {
      const current = this.peach();
      if (!current || current.locations.some((l) => l.id === location.id)) return;
      const locations = [...current.locations];
      locations.splice(Math.min(at, locations.length), 0, location);
      void this.saveLocations(current, locations);
    });
  }

  private async saveLocations(
    peach: Peach,
    locations: readonly EquipmentLocation[],
    success?: string,
  ): Promise<boolean> {
    const done = await this.state.run(async (app) => {
      await app.peaches.save({ ...peach, locations });
      return true;
    }, success);
    return done === true;
  }

  // ── Settings ─────────────────────────────────────────────────────────────

  protected readonly canSignOut = computed(() => {
    // Re-evaluated with the auth state; the provider set depends on it.
    this.state.authUser();
    return this.state.auth.availableProviders.size > 0;
  });

  async saveUnits(peach: Peach, units: UnitSystem | null): Promise<void> {
    if (units === null || units === peach.units) return;
    await this.state.run((app) => app.peaches.save({ ...peach, units }));
  }

  protected install(): void {
    void this.pwa.install();
  }

  protected signOut(): void {
    void this.state.auth.signOut();
  }

  /** "This week", "Last week" or "Oct 5 – 11". */
  private weekLabel(monday: LocalDate): string {
    const thisWeek = this.thisWeek();
    if (monday === thisWeek) return 'This week';
    if (monday === addDays(thisWeek, -7)) return 'Last week';
    return Fmt.week(monday);
  }
}

/** "100 kg", "225 lb". */
function weight(kg: number, units: UnitSystem): string {
  return `${WeightUnits.format(WeightUnits.toDisplay(kg, units))} ${WeightUnits.label(units)}`;
}
