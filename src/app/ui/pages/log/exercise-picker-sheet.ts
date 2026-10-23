import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheet,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { firstValueFrom } from 'rxjs';

import { AppContainer } from '../../../application/app-container';
import { isPerformableWith } from '../../../domain/exercises/exercise';
import { ExerciseCatalog, searchRank } from '../../../domain/exercises/exercise-catalog';
import {
  customExercise,
  LoggableExercise,
  loggableFromCatalog,
  LogTrack,
  MAX_CUSTOM_NAME,
} from '../../../domain/exercises/loggable';
import { Equipment } from '../../../domain/exercises/taxonomy';
import { DistanceKind } from '../../../domain/models/scoring';
import { UnitSystem } from '../../../domain/models/training';
import {
  ExerciseLogEntry,
  loggableFromEntry,
  WorkoutLog,
} from '../../../domain/models/workout-log';
import { Fmt } from '../../format';

/** An exercise crate-mates have logged, and who. */
export interface CrateExercise {
  readonly exercise: LoggableExercise;
  /** "Ada", "Ada and Ben". */
  readonly from: string;
}

export interface ExercisePickerData {
  readonly catalog: ExerciseCatalog;
  /** The last entry for each exercise the Peach has logged, newest first. */
  readonly recent: readonly ExerciseLogEntry[];
  /** Exercises crate-mates have logged. */
  readonly fromCrates: readonly CrateExercise[];
  /** Exercises already in the log, marked as such. */
  readonly loggedIds: ReadonlySet<string>;
  readonly units: UnitSystem;
  /** A fresh id for an exercise the Peach makes up. */
  readonly newId: () => string;
  /** Where the workout is planned: the catalog lists what its equipment allows. */
  readonly kit?: { readonly name: string; readonly equipment: ReadonlySet<Equipment> } | null;
}

/**
 * Exercises crate-mates have logged in any of `me`'s Crates, with who logged
 * them, for the picker.
 */
export async function crateExercisesFor(app: AppContainer, me: string): Promise<CrateExercise[]> {
  const shared = (await app.loggingService.crateExercises(me)).filter((s) => s.peachId !== me);
  const peaches = await app.peaches.getByIds(new Set(shared.map((s) => s.peachId)));
  const names = new Map(peaches.map((p) => [p.id, p.displayName]));
  const byExercise = new Map<string, { exercise: LoggableExercise; from: Set<string> }>();
  for (const s of shared) {
    const row = byExercise.get(s.exercise.id) ?? {
      exercise: { ...s.exercise, cues: app.catalog.byId(s.exercise.id)?.cues ?? null },
      from: new Set<string>(),
    };
    row.from.add(names.get(s.peachId) ?? 'a crate-mate');
    byExercise.set(s.exercise.id, row);
  }
  return [...byExercise.values()]
    .map(({ exercise, from }) => ({ exercise, from: Fmt.names([...from].sort()) }))
    .sort((a, b) => (a.exercise.name < b.exercise.name ? -1 : 1));
}

/** The latest entry for each exercise in `logs` (newest first), skipping one log. */
export function recentEntries(
  logs: readonly WorkoutLog[],
  excludingLogId: string | null = null,
): ExerciseLogEntry[] {
  const seen = new Map<string, ExerciseLogEntry>();
  for (const log of logs) {
    if (log.id === excludingLogId) continue;
    for (const e of log.entries) if (!seen.has(e.exerciseId)) seen.set(e.exerciseId, e);
  }
  return [...seen.values()];
}

const PICKER_HEIGHT = 'min(88dvh, 860px)';

function finePointer(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;
}

/** How many matches per group to list before asking for a narrower search. */
const LIMIT = 40;
/** Recent exercises shown before anything is typed. */
const RECENT_LIMIT = 8;

/** How a made-up exercise is logged, which decides how it scores. */
interface CreateKind {
  readonly label: string;
  readonly icon: string;
  readonly track: LogTrack;
  readonly takesLoad?: boolean;
  readonly distanceKind?: DistanceKind;
}

const CREATE_KINDS: readonly CreateKind[] = [
  { label: 'Reps', icon: 'repeat', track: 'reps' },
  { label: 'Reps with weight', icon: 'fitness_center', track: 'reps', takesLoad: true },
  { label: 'Time', icon: 'timer', track: 'time' },
  {
    label: Fmt.category('runWalk'),
    icon: Fmt.categoryIcon('runWalk'),
    track: 'distance',
    distanceKind: 'runWalk',
  },
  {
    label: Fmt.category('ride'),
    icon: Fmt.categoryIcon('ride'),
    track: 'distance',
    distanceKind: 'ride',
  },
  {
    label: Fmt.category('swimRow'),
    icon: Fmt.categoryIcon('swimRow'),
    track: 'distance',
    distanceKind: 'swimRow',
  },
  { label: 'Other distance (scores time)', icon: 'route', track: 'distance' },
];

interface PickerRow {
  readonly exercise: LoggableExercise;
  readonly subtitle: string;
  readonly logged: boolean;
}

/** Opens the picker and resolves with the chosen exercise, or undefined if dismissed. */
export function openExercisePicker(
  sheet: MatBottomSheet,
  data: ExercisePickerData,
): Promise<LoggableExercise | undefined> {
  // A fixed height, so the search box stays put while the results change
  // under it; the keyboard only comes up by itself where there's a real one.
  const ref = sheet.open<ExercisePickerSheet, ExercisePickerData, LoggableExercise>(
    ExercisePickerSheet,
    {
      data,
      ariaLabel: 'Add an exercise',
      ariaModal: true,
      autoFocus: finePointer() ? 'input' : 'first-heading',
      height: PICKER_HEIGHT,
      maxHeight: PICKER_HEIGHT,
      panelClass: 'pch-picker-panel',
    },
  );
  return firstValueFrom(ref.afterDismissed());
}

/**
 * Search everything a Peach can log: what they logged before (with last
 * time's numbers), what crate-mates logged (tagged with who), then the
 * whole catalog. Anything else they can make up on the spot.
 *
 * The title and search stay at the top while the results scroll. Enter
 * picks the top match (or makes up the exercise if nothing matches),
 * Escape clears the search before it closes the sheet, and the arrow keys
 * move between the search and the results.
 */
@Component({
  selector: 'pch-exercise-picker-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="handle" aria-hidden="true"></div>
    @if (creating(); as name) {
      <h2 class="pch-headline-small">“{{ name }}”</h2>
      <p class="pch-body-medium muted intro">How do you log it? That decides how it scores.</p>
      <ul class="rows">
        @for (k of kinds; track k.label) {
          <li>
            <button type="button" class="row" (click)="create(k)">
              <span class="material-symbols-rounded muted" aria-hidden="true">{{ k.icon }}</span>
              <span class="text pch-body-large">{{ k.label }}</span>
            </button>
          </li>
        }
      </ul>
      <button type="button" class="row back" (click)="creating.set(null)">
        <span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>
        <span class="pch-body-large">Back to search</span>
      </button>
    } @else {
      <header class="top">
        <h2 class="pch-headline-small" tabindex="-1">Add an exercise</h2>
        <label class="search">
          <span class="material-symbols-rounded" aria-hidden="true">search</span>
          <input
            #search
            type="search"
            class="pch-body-large"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            enterkeyhint="go"
            aria-label="Search exercises"
            placeholder="Run, squat, yoga…"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
            (keydown)="onSearchKey($event)"
          />
          @if (query()) {
            <button
              type="button"
              class="clear"
              aria-label="Clear search"
              (mousedown)="$event.preventDefault()"
              (click)="clear()"
            >
              <span class="material-symbols-rounded" aria-hidden="true">close</span>
            </button>
          }
        </label>
        @if (data.kit; as kit) {
          <button
            type="button"
            class="kit pch-label-large"
            [attr.aria-pressed]="!everything()"
            (click)="everything.set(!everything())"
          >
            <span class="material-symbols-rounded" aria-hidden="true">{{
              everything() ? 'filter_alt_off' : 'filter_alt'
            }}</span>
            {{ everything() ? 'Showing every exercise' : 'What fits ' + kit.name }}
          </button>
        }
      </header>
      <div #results class="results">
        @for (group of groups(); track group.title) {
          <h3 class="pch-title-small group">{{ group.title }}</h3>
          <ul class="rows">
            @for (r of group.rows; track r.exercise.id) {
              <li>
                <button
                  type="button"
                  class="row"
                  (mousedown)="$event.preventDefault()"
                  (keydown)="onResultsKey($event)"
                  (click)="pick(r.exercise)"
                >
                  <span class="text">
                    <span class="pch-body-large">{{ r.exercise.name }}</span>
                    <span class="pch-body-small muted one-line">{{ r.subtitle }}</span>
                  </span>
                  @if (r.logged) {
                    <span class="pch-label-medium logged">Logged</span>
                  }
                </button>
              </li>
            }
          </ul>
        }
        @if (truncated()) {
          <p class="pch-body-small muted empty">Keep typing to narrow it down.</p>
        }
        @if (newName(); as name) {
          <button
            type="button"
            class="row create"
            (mousedown)="$event.preventDefault()"
            (keydown)="onResultsKey($event)"
            (click)="creating.set(name)"
          >
            <span class="material-symbols-rounded" aria-hidden="true">add_circle</span>
            <span class="text">
              <span class="pch-body-large">Create “{{ name }}”</span>
              <span class="pch-body-small muted">Your crate-mates will see it came from you</span>
            </span>
          </button>
        }
        @if (groups().length === 0 && !newName()) {
          <p class="pch-body-medium muted empty">Nothing matches that.</p>
        }
      </div>
    }`,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      height: 100%;
      max-width: 560px;
      margin: 0 auto;
      padding: 0 8px;
    }
    .top {
      flex: none;
    }
    h2:focus {
      outline: none;
    }
    .results {
      flex: 1 1 auto;
      min-height: 0;
      margin: 0 -8px;
      padding: 0 8px 16px;
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    .clear {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      margin-inline-end: -8px;
      border: 0;
      border-radius: 50%;
      background: none;
      color: inherit;
      cursor: pointer;
    }
    .clear:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
    }
    .kit {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 32px;
      margin: 0 0 4px 8px;
      padding: 0 12px 0 8px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 8px;
      background: none;
      color: var(--mat-sys-on-surface-variant);
      cursor: pointer;
      font: inherit;
    }
    .kit[aria-pressed='true'] {
      border-color: transparent;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    .kit .material-symbols-rounded {
      font-size: 18px;
    }
    .search input::-webkit-search-cancel-button {
      display: none;
    }
    .handle {
      width: 32px;
      height: 4px;
      margin: 8px auto 16px;
      border-radius: 2px;
      background: var(--mat-sys-on-surface-variant);
      opacity: 0.4;
    }
    h2,
    h3,
    p {
      margin: 0;
    }
    .search {
      display: flex;
      align-items: center;
      gap: 12px;
      height: 48px;
      margin: 16px 0 8px;
      padding: 0 16px;
      border-radius: 24px;
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-on-surface-variant);
    }
    .search:focus-within {
      outline: 2px solid var(--mat-sys-primary);
    }
    .search input {
      flex: 1;
      min-width: 0;
      height: 100%;
      border: 0;
      outline: none;
      background: none;
      color: var(--mat-sys-on-surface);
    }
    .group {
      margin: 16px 8px 4px;
      color: var(--mat-sys-primary);
    }
    .rows {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      min-height: 56px;
      padding: 8px;
      border: 0;
      border-radius: var(--pch-radius-medium);
      background: none;
      color: var(--mat-sys-on-surface);
      text-align: start;
      cursor: pointer;
      font: inherit;
    }
    .row:hover {
      background: var(--mat-sys-surface-container-high);
    }
    .row:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
    }
    .text {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
    }
    .muted {
      color: var(--mat-sys-on-surface-variant);
    }
    .logged {
      color: var(--mat-sys-primary);
    }
    .empty {
      padding: 16px 8px;
    }
    .one-line {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .intro {
      margin: 8px 0;
    }
    .create {
      margin-top: 8px;
      color: var(--mat-sys-primary);
    }
    .back {
      margin-top: 8px;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class ExercisePickerSheet {
  private readonly ref =
    inject<MatBottomSheetRef<ExercisePickerSheet, LoggableExercise>>(MatBottomSheetRef);
  protected readonly data = inject<ExercisePickerData>(MAT_BOTTOM_SHEET_DATA);
  /** With a kit: list every exercise, not just what fits it. */
  readonly everything = signal(false);
  private readonly injector = inject(Injector);

  protected readonly kinds = CREATE_KINDS;
  private readonly searchRef = viewChild<ElementRef<HTMLInputElement>>('search');
  private readonly resultsRef = viewChild<ElementRef<HTMLElement>>('results');
  readonly query = signal('');
  /** The name of the exercise being made up, while choosing how it's logged. */
  readonly creating = signal<string | null>(null);

  private readonly matches = computed(() => {
    const q = this.query().trim().toLowerCase();
    const { catalog, recent, fromCrates, loggedIds, units } = this.data;
    const seen = new Set<string>();
    /** Recent and crate-mates' exercises match like the catalog does, aliases included. */
    const matches = (e: LoggableExercise) =>
      !q || searchRank(q, e.name, catalog.byId(e.id)?.aliases ?? []) !== null;
    const rows = <T>(items: readonly T[], toRow: (item: T) => PickerRow, filter = true) =>
      items.map(toRow).filter((r) => {
        if (seen.has(r.exercise.id) || (filter && !matches(r.exercise))) return false;
        seen.add(r.exercise.id);
        return true;
      });
    const row = (exercise: LoggableExercise, subtitle: string): PickerRow => ({
      exercise,
      subtitle,
      logged: loggedIds.has(exercise.id),
    });
    const mine = rows(recent, (e) =>
      row(
        loggableFromEntry(e, catalog.byId(e.exerciseId)?.cues ?? null),
        `Last time: ${Fmt.entrySummary(e, units)}`,
      ),
    );
    const crate = rows(fromCrates, (c) => row(c.exercise, `From ${c.from}`));
    const kit = this.everything() ? null : (this.data.kit?.equipment ?? null);
    // The catalog's search already matched (and ranked) these.
    const all = rows(
      (q ? catalog.search(q) : catalog.all.sort((a, b) => (a.name < b.name ? -1 : 1))).filter(
        (e) => kit === null || isPerformableWith(e, kit),
      ),
      (e) => row(loggableFromCatalog(e), Fmt.pattern(e.pattern)),
      false,
    );
    return { mine: q ? mine : mine.slice(0, RECENT_LIMIT), crate, all };
  });

  protected readonly groups = computed(() => {
    const { mine, crate, all } = this.matches();
    return [
      { title: 'Recent', rows: mine },
      { title: 'From your Crates', rows: crate.slice(0, LIMIT) },
      {
        title: this.data.kit && !this.everything() ? `Fits ${this.data.kit.name}` : 'All exercises',
        rows: all.slice(0, LIMIT),
      },
    ].filter((g) => g.rows.length > 0);
  });

  protected readonly truncated = computed(() => {
    const { crate, all } = this.matches();
    return crate.length > LIMIT || all.length > LIMIT;
  });

  /** What was typed, if it isn't already an exercise by that name. */
  protected readonly newName = computed(() => {
    const name = this.query().trim().slice(0, MAX_CUSTOM_NAME);
    if (!name) return null;
    const lower = name.toLowerCase();
    const groups = this.groups();
    const taken = groups.some((g) => g.rows.some((r) => r.exercise.name.toLowerCase() === lower));
    return taken ? null : name;
  });

  constructor() {
    // A new search starts at the top of its results.
    effect(() => {
      this.query();
      untracked(() => {
        const results = this.resultsRef()?.nativeElement;
        if (results) results.scrollTop = 0;
      });
    });
  }

  protected onSearchKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      const top = this.groups()[0]?.rows[0];
      if (top) this.pick(top.exercise);
      else if (this.newName()) this.creating.set(this.newName());
    } else if (e.key === 'Escape' && this.query()) {
      // Clear first; a second Escape closes the sheet.
      e.preventDefault();
      e.stopPropagation();
      this.clear();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.rows()[0]?.focus();
    }
  }

  /** Arrow keys move through the results, and up from the first back to the search. */
  protected onResultsKey(e: KeyboardEvent): void {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const rows = this.rows();
    const i = rows.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const next = i + (e.key === 'ArrowDown' ? 1 : -1);
    if (next < 0) this.searchRef()?.nativeElement.focus();
    else rows[Math.min(next, rows.length - 1)].focus();
  }

  protected clear(): void {
    this.query.set('');
    afterNextRender(() => this.searchRef()?.nativeElement.focus(), { injector: this.injector });
  }

  private rows(): HTMLButtonElement[] {
    const results = this.resultsRef()?.nativeElement;
    return results ? Array.from(results.querySelectorAll<HTMLButtonElement>('button.row')) : [];
  }

  protected pick(exercise: LoggableExercise): void {
    this.ref.dismiss(exercise);
  }

  protected create(kind: CreateKind): void {
    const name = this.creating();
    if (!name) return;
    this.pick(customExercise({ id: this.data.newId(), name, ...kind }));
  }
}
