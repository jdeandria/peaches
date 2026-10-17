import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatChipListbox, MatChipOption } from '@angular/material/chips';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';

import { MOVEMENT_PATTERNS, MovementPattern } from '../../../domain/exercises/taxonomy';
import { AppState } from '../../../state/app-state';
import { LoadingIndicator } from '../../expressive/loading-indicator';
import { Fmt } from '../../format';
import { EmptyState } from '../../layout/empty-state';
import { Page } from '../../layout/page';
import { Stagger } from '../../layout/stagger';
import { ExerciseGroupCard } from './exercise-group-card';
import { groupExercises, isExpanded, isFiltering, toggleGroup } from './exercise-groups';

/**
 * Browse the catalog as an overview of movement patterns and add favourites
 * to a Crate's library, where crate-mates find them when they log. Groups
 * start collapsed; searching or filtering expands every matching group.
 */
@Component({
  selector: 'pch-exercises-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EmptyState,
    ExerciseGroupCard,
    LoadingIndicator,
    MatChipListbox,
    MatChipOption,
    MatFormField,
    MatLabel,
    MatOption,
    MatSelect,
    Page,
    Stagger,
  ],
  template: `<pch-page title="Exercises" [subtitle]="subtitle()">
    @let crates = myCrates();
    @if (crates && crates.length > 0) {
      <mat-form-field appearance="outline" class="library">
        <mat-label>Library</mat-label>
        <mat-select [value]="crateId()" (selectionChange)="chosenCrateId.set($event.value)">
          @for (c of crates; track c.id) {
            <mat-option [value]="c.id">{{ c.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    }

    <label class="search">
      <span class="material-symbols-rounded" aria-hidden="true">search</span>
      <input
        type="search"
        class="pch-body-large"
        autocomplete="off"
        aria-label="Search exercises"
        [placeholder]="'Search ' + catalogSize + ' exercises'"
        [value]="query()"
        (input)="onSearch($event)"
      />
    </label>

    <mat-chip-listbox multiple aria-label="Filters" class="filters">
      <mat-chip-option
        [selected]="onlyPicked()"
        [disabled]="!crateId()"
        (selectionChange)="$event.isUserInput && onlyPicked.set($event.selected)"
        >In library</mat-chip-option
      >
      @for (p of patterns; track p) {
        <mat-chip-option
          [selected]="pattern() === p"
          (selectionChange)="$event.isUserInput && selectPattern(p, $event.selected)"
          >{{ fmt.pattern(p) }}</mat-chip-option
        >
      }
    </mat-chip-listbox>

    @let pickedIds = picked();
    @if (pickedIds === undefined) {
      <pch-loading-indicator class="loading" [size]="40" />
    } @else {
      <p class="pch-visually-hidden" role="status">{{ resultSummary() }}</p>
      <div class="groups">
        @for (g of groups(); track g.pattern; let i = $index) {
          <pch-exercise-group-card
            [pchStagger]="i"
            [group]="g"
            [picked]="pickedIds"
            [disabled]="!crateId()"
            [expanded]="expanded(g.pattern)"
            (toggleExpanded)="toggle(g.pattern)"
            (setPicked)="setPicked($event.exerciseId, $event.picked)"
          />
        } @empty {
          <pch-empty-state icon="search_off" title="No exercises match" />
        }
      </div>
    }
  </pch-page>`,
  styles: `
    .library {
      width: 100%;
    }
    .search {
      display: flex;
      align-items: center;
      gap: 16px;
      height: 56px;
      padding: 0 16px;
      border-radius: 28px;
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-on-surface-variant);
      cursor: text;
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
    .search input::placeholder {
      color: var(--mat-sys-on-surface-variant);
    }
    .filters {
      margin: 12px 0 16px;
      overflow-x: auto;
      scrollbar-width: none;
    }
    /* Bleed to the screen edges on phones so the row reads as scrollable. */
    @media (max-width: 599px) {
      .filters {
        margin-inline: -16px;
        padding-inline: 16px;
      }
    }
    .filters ::ng-deep .mdc-evolution-chip-set__chips {
      flex-wrap: nowrap;
    }
    .groups {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-bottom: 24px;
    }
    .loading {
      display: flex;
      margin: 48px auto;
    }
  `,
})
export class ExercisesPage {
  private readonly state = inject(AppState);

  protected readonly fmt = Fmt;
  protected readonly patterns = MOVEMENT_PATTERNS;
  protected readonly catalogSize = this.state.catalog.length;

  readonly query = signal('');
  readonly pattern = signal<MovementPattern | null>(null);
  readonly onlyPicked = signal(false);
  /** Groups the user expanded or collapsed against the current default. */
  readonly toggled = signal<ReadonlySet<MovementPattern>>(new Set());

  protected readonly myCrates = this.state.myCrates.value;
  readonly chosenCrateId = signal<string | null>(null);
  /** The library being edited: the one chosen, else the first Crate's. */
  readonly crateId = computed(() => this.chosenCrateId() ?? this.myCrates()?.[0]?.id ?? null);
  private readonly crateName = computed(
    () => this.myCrates()?.find((c) => c.id === this.crateId())?.name ?? null,
  );

  private readonly entries = this.state.query(
    () => this.crateId() ?? undefined,
    (id, app) => app.library.entries(id),
  );
  /** Ids in the chosen library; empty without a Crate, undefined while loading. */
  protected readonly picked = computed<ReadonlySet<string> | undefined>(() => {
    if (this.myCrates() === undefined) return undefined;
    if (this.crateId() === null) return new Set<string>();
    const entries = this.entries.value();
    return entries === undefined ? undefined : new Set(entries.map((e) => e.exerciseId));
  });

  private readonly filter = computed(() => ({
    query: this.query(),
    pattern: this.pattern(),
    onlyPicked: this.onlyPicked(),
  }));
  readonly filtering = computed(() => isFiltering(this.filter()));

  readonly groups = computed(() =>
    groupExercises(this.state.catalog, this.filter(), this.picked() ?? new Set<string>()),
  );

  /** Announced to screen readers while filtering. */
  protected readonly resultSummary = computed(() => {
    if (!this.filtering()) return '';
    const n = this.groups().reduce((sum, g) => sum + g.exercises.length, 0);
    if (n === 0) return 'No results';
    return n === 1 ? '1 exercise matches' : `${n} exercises match`;
  });

  protected readonly subtitle = computed(() => {
    const name = this.crateName();
    if (!name) return 'Join a Crate to share favourites with it';
    return `${this.picked()?.size ?? 0} in ${name}’s library`;
  });

  expanded(pattern: MovementPattern): boolean {
    return isExpanded(this.filtering(), this.toggled(), pattern);
  }

  toggle(pattern: MovementPattern): void {
    this.toggled.update((t) => toggleGroup(t, pattern));
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  selectPattern(pattern: MovementPattern, selected: boolean): void {
    this.pattern.set(selected ? pattern : null);
  }

  async setPicked(exerciseId: string, picked: boolean): Promise<void> {
    const me = this.state.peachId();
    const crateId = this.crateId();
    if (!me || !crateId) return;
    await this.state.run(async (app) => {
      if (picked)
        await app.libraryService.addCatalogExercise(crateId, exerciseId, me, this.state.now());
      else await app.libraryService.removeCatalogExercise(crateId, exerciseId, me);
    });
  }
}
