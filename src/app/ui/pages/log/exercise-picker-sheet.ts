import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheet,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { firstValueFrom } from 'rxjs';

import { ExerciseCatalog, searchRank } from '../../../domain/exercises/exercise-catalog';
import {
  customExercise,
  LoggableExercise,
  loggableFromCatalog,
  LogTrack,
  MAX_CUSTOM_NAME,
} from '../../../domain/exercises/loggable';
import { DistanceKind } from '../../../domain/models/scoring';
import { UnitSystem } from '../../../domain/models/training';
import { ExerciseLogEntry, loggableFromEntry } from '../../../domain/models/workout-log';
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
  const ref = sheet.open<ExercisePickerSheet, ExercisePickerData, LoggableExercise>(
    ExercisePickerSheet,
    { data, ariaLabel: 'Add an exercise', ariaModal: true, autoFocus: 'input' },
  );
  return firstValueFrom(ref.afterDismissed());
}

/**
 * Search everything a Peach can log: what they logged before (with last
 * time's numbers), what crate-mates logged (tagged with who), then the
 * whole catalog. Anything else they can make up on the spot.
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
      <h2 class="pch-headline-small">Add an exercise</h2>
      <label class="search">
        <span class="material-symbols-rounded" aria-hidden="true">search</span>
        <input
          type="search"
          class="pch-body-large"
          autocomplete="off"
          aria-label="Search exercises"
          placeholder="Run, squat, yoga…"
          [value]="query()"
          (input)="query.set($any($event.target).value)"
        />
      </label>
      @for (group of groups(); track group.title) {
        <h3 class="pch-title-small group">{{ group.title }}</h3>
        <ul class="rows">
          @for (r of group.rows; track r.exercise.id) {
            <li>
              <button type="button" class="row" (click)="pick(r.exercise)">
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
        <button type="button" class="row create" (click)="creating.set(name)">
          <span class="material-symbols-rounded" aria-hidden="true">add_circle</span>
          <span class="text">
            <span class="pch-body-large">Create “{{ name }}”</span>
            <span class="pch-body-small muted">Your crate-mates will see it came from you</span>
          </span>
        </button>
      }
    }`,
  styles: `
    :host {
      display: block;
      max-width: 560px;
      margin: 0 auto;
      padding: 0 8px 16px;
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
  private readonly data = inject<ExercisePickerData>(MAT_BOTTOM_SHEET_DATA);

  protected readonly kinds = CREATE_KINDS;
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
    // The catalog's search already matched (and ranked) these.
    const all = rows(
      q ? catalog.search(q) : catalog.all.sort((a, b) => (a.name < b.name ? -1 : 1)),
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
      { title: 'All exercises', rows: all.slice(0, LIMIT) },
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

  protected pick(exercise: LoggableExercise): void {
    this.ref.dismiss(exercise);
  }

  protected create(kind: CreateKind): void {
    const name = this.creating();
    if (!name) return;
    this.pick(customExercise({ id: this.data.newId(), name, ...kind }));
  }
}
