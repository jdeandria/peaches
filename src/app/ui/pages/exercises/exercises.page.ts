import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatChipListbox, MatChipOption } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';

import { errorMessage } from '../../../application/errors';
import { MOVEMENT_PATTERNS, MovementPattern } from '../../../domain/exercises/taxonomy';
import { AppState } from '../../../state/app-state';
import { LoadingIndicator } from '../../expressive/loading-indicator';
import { Fmt } from '../../format';
import { EmptyState } from '../../layout/empty-state';
import { Page } from '../../layout/page';
import { Stagger } from '../../layout/stagger';
import { ExerciseGroupCard } from './exercise-group-card';
import { groupExercises, isExpanded, isFiltering, toggleGroup } from './exercise-groups';
import { QuickSetupDialog } from './quick-setup-dialog';

/**
 * Browse the catalog as an overview of movement patterns and declare which
 * exercises you can do. Groups start collapsed; searching or filtering
 * expands every matching group.
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
    MatIconButton,
    MatTooltip,
    Page,
    Stagger,
  ],
  template: `<pch-page title="Exercises" [subtitle]="subtitle()">
    <button
      pageActions
      matIconButton
      type="button"
      aria-label="Quick setup"
      matTooltip="Quick setup"
      (click)="quickSetup()"
    >
      <span class="material-symbols-rounded" aria-hidden="true">auto_fix_high</span>
    </button>

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
        [selected]="onlyMine()"
        (selectionChange)="$event.isUserInput && onlyMine.set($event.selected)"
        >I can do</mat-chip-option
      >
      @for (p of patterns; track p) {
        <mat-chip-option
          [selected]="pattern() === p"
          (selectionChange)="$event.isUserInput && selectPattern(p, $event.selected)"
          >{{ fmt.pattern(p) }}</mat-chip-option
        >
      }
    </mat-chip-listbox>

    @let ableIds = able();
    @if (ableIds === undefined) {
      <pch-loading-indicator class="loading" [size]="40" />
    } @else {
      <p class="pch-visually-hidden" role="status">{{ resultSummary() }}</p>
      <div class="groups">
        @for (g of groups(); track g.pattern; let i = $index) {
          <pch-exercise-group-card
            [pchStagger]="i"
            [group]="g"
            [able]="ableIds"
            [expanded]="expanded(g.pattern)"
            (toggleExpanded)="toggle(g.pattern)"
            (setAble)="setAble($event.exerciseId, $event.able)"
          />
        } @empty {
          <pch-empty-state icon="search_off" title="No exercises match" />
        }
      </div>
    }
  </pch-page>`,
  styles: `
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
  private readonly dialog = inject(MatDialog);

  protected readonly fmt = Fmt;
  protected readonly patterns = MOVEMENT_PATTERNS;
  protected readonly catalogSize = this.state.catalog.length;

  readonly query = signal('');
  readonly pattern = signal<MovementPattern | null>(null);
  readonly onlyMine = signal(false);
  /** Groups the user expanded or collapsed against the current default. */
  readonly toggled = signal<ReadonlySet<MovementPattern>>(new Set());

  protected readonly able = computed(() => this.state.myCapabilityIds.value());

  private readonly filter = computed(() => ({
    query: this.query(),
    pattern: this.pattern(),
    onlyMine: this.onlyMine(),
  }));
  readonly filtering = computed(() => isFiltering(this.filter()));

  readonly groups = computed(() =>
    groupExercises(this.state.catalog, this.filter(), this.able() ?? new Set<string>()),
  );

  /** Announced to screen readers while filtering. */
  protected readonly resultSummary = computed(() => {
    if (!this.filtering()) return '';
    const n = this.groups().reduce((sum, g) => sum + g.exercises.length, 0);
    if (n === 0) return 'No results';
    return n === 1 ? '1 exercise matches' : `${n} exercises match`;
  });

  protected readonly subtitle = computed(() => {
    const able = this.able() ?? new Set<string>();
    const total = this.state.catalog.all.filter((e) => able.has(e.id)).length;
    return `${total} of ${this.catalogSize} enabled for you`;
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

  async setAble(exerciseId: string, able: boolean): Promise<void> {
    const me = this.state.peachId();
    if (!me) return;
    try {
      await this.state.app.capabilityService.setAble(me, exerciseId, able, this.state.now());
    } catch (e) {
      this.state.toast(errorMessage(e));
    }
  }

  protected quickSetup(): void {
    this.dialog.open(QuickSetupDialog, { width: '560px', maxWidth: 'calc(100vw - 32px)' });
  }
}
