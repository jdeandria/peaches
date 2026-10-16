import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheet,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { firstValueFrom } from 'rxjs';

import { ExerciseCatalog } from '../../../domain/exercises/exercise-catalog';
import { LoggableExercise, loggableFromCatalog } from '../../../domain/exercises/loggable';
import { CustomExercise, loggableFromCustom } from '../../../domain/models/library';
import { Fmt } from '../../format';

export interface ExercisePickerData {
  readonly catalog: ExerciseCatalog;
  /** Custom exercises from the Peach's Crates. */
  readonly customs: readonly CustomExercise[];
  /** Catalog exercises the Peach's Crates put in their libraries. */
  readonly favouriteIds: ReadonlySet<string>;
  /** Exercises already in the log, marked as such. */
  readonly loggedIds: ReadonlySet<string>;
}

/** How many catalog matches to list before asking for a narrower search. */
const CATALOG_LIMIT = 40;

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
 * Search everything a Peach can log: their Crates' custom exercises and
 * library picks first, then the whole catalog.
 */
@Component({
  selector: 'pch-exercise-picker-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="handle" aria-hidden="true"></div>
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
                <span class="pch-body-small muted">{{ r.subtitle }}</span>
              </span>
              @if (r.logged) {
                <span class="pch-label-medium logged">Logged</span>
              }
            </button>
          </li>
        }
      </ul>
    } @empty {
      <p class="pch-body-medium muted empty">No exercises match “{{ query() }}”.</p>
    }
    @if (truncated()) {
      <p class="pch-body-small muted empty">
        Showing the first {{ limit }}. Keep typing to narrow it down.
      </p>
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
  `,
})
export class ExercisePickerSheet {
  private readonly ref =
    inject<MatBottomSheetRef<ExercisePickerSheet, LoggableExercise>>(MatBottomSheetRef);
  private readonly data = inject<ExercisePickerData>(MAT_BOTTOM_SHEET_DATA);

  protected readonly limit = CATALOG_LIMIT;
  readonly query = signal('');

  private readonly matches = computed(() => {
    const q = this.query().trim().toLowerCase();
    const { catalog, customs, favouriteIds, loggedIds } = this.data;
    const row = (exercise: LoggableExercise, subtitle: string): PickerRow => ({
      exercise,
      subtitle,
      logged: loggedIds.has(exercise.id),
    });
    const custom = customs
      .filter((c) => c.name.toLowerCase().includes(q))
      .map((c) => row(loggableFromCustom(c), 'Made by your Crate'));
    const found = catalog.search(q);
    const favourites = found
      .filter((e) => favouriteIds.has(e.id))
      .map((e) => row(loggableFromCatalog(e), Fmt.pattern(e.pattern)));
    const rest = found
      .filter((e) => !favouriteIds.has(e.id))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      .map((e) => row(loggableFromCatalog(e), Fmt.pattern(e.pattern)));
    return { crate: [...custom, ...favourites], rest };
  });

  protected readonly groups = computed(() => {
    const { crate, rest } = this.matches();
    return [
      { title: 'From your Crates', rows: crate },
      { title: 'All exercises', rows: rest.slice(0, CATALOG_LIMIT) },
    ].filter((g) => g.rows.length > 0);
  });

  protected readonly truncated = computed(() => this.matches().rest.length > CATALOG_LIMIT);

  protected pick(exercise: LoggableExercise): void {
    this.ref.dismiss(exercise);
  }
}
