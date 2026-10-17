import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';

import { AppState } from '../../../state/app-state';
import { LoadingIndicator } from '../../expressive/loading-indicator';
import { Fmt } from '../../format';
import { Card } from '../../layout/card';
import { ListCard } from '../../layout/list-card';
import { ListRow } from '../../layout/list-row';
import { Section } from '../../layout/section';
import { CustomExerciseDialog } from './custom-exercise-dialog';

interface LibraryRow {
  readonly id: string;
  readonly kind: 'routine' | 'custom' | 'catalog';
  readonly name: string;
  readonly subtitle: string;
  readonly icon: string;
  /** Whoever added it, or a manager, can remove it. */
  readonly removable: boolean;
}

/**
 * The Crate's library: routines members shared (start a workout from one),
 * exercises they made up, and catalog favourites. Private to the Crate.
 */
@Component({
  selector: 'pch-crate-library',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Card,
    ListCard,
    ListRow,
    LoadingIndicator,
    MatButton,
    MatIconButton,
    MatTooltip,
    RouterLink,
    Section,
  ],
  template: `<pch-section title="Library" [top]="8">
      <button sectionTrailing matButton type="button" (click)="newExercise()">
        <span class="material-symbols-rounded" aria-hidden="true">add</span>
        Exercise
      </button>
    </pch-section>
    @let list = rows();
    @if (list === undefined) {
      <pch-loading-indicator class="loading" [size]="40" />
    } @else if (list.length === 0) {
      <pch-card variant="outlined">
        Nothing here yet. Share a workout as a routine, add favourites from the Exercises tab, or
        make up an exercise.
      </pch-card>
    } @else {
      <pch-list-card class="library">
        @for (r of list; track r.kind + r.id) {
          <pch-list-row>
            <span rowLeading class="material-symbols-rounded icon" aria-hidden="true">{{
              r.icon
            }}</span>
            {{ r.name }}
            <span rowSubtitle class="one-line">{{ r.subtitle }}</span>
            <span rowTrailing class="actions">
              @if (r.kind === 'routine') {
                <a
                  matButton="tonal"
                  [routerLink]="['/log']"
                  [queryParams]="{ routine: r.id }"
                  [attr.aria-label]="'Start ' + r.name"
                  >Start</a
                >
              }
              @if (r.removable) {
                <button
                  matIconButton
                  type="button"
                  matTooltip="Remove"
                  [attr.aria-label]="'Remove ' + r.name"
                  (click)="remove(r)"
                >
                  <span class="material-symbols-rounded" aria-hidden="true">delete</span>
                </button>
              }
            </span>
          </pch-list-row>
        }
      </pch-list-card>
    }`,
  styles: `
    :host {
      display: block;
    }
    .loading {
      display: flex;
      margin: 24px auto;
    }
    .icon {
      width: 40px;
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
    }
    .actions {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .one-line {
      display: block;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    [sectionTrailing] .material-symbols-rounded {
      margin-inline-end: 4px;
      font-size: 18px;
    }
  `,
})
export class CrateLibraryPanel {
  private readonly state = inject(AppState);
  private readonly dialog = inject(MatDialog);

  readonly crateId = input.required<string>();
  readonly canManage = input(false);
  /** Display names of members, by Peach id. */
  readonly names = input<ReadonlyMap<string, string>>(new Map());

  private readonly library = this.state.query(
    () => this.crateId(),
    (id, app) => app.libraryService.libraryOf(id),
  );

  protected readonly rows = computed<LibraryRow[] | undefined>(() => {
    const library = this.library.value();
    if (!library) return undefined;
    const me = this.state.peachId();
    const by = (id: string) => (id === me ? 'you' : (this.names().get(id) ?? 'a member'));
    const removable = (id: string) => id === me || this.canManage();
    return [
      ...library.routines.map((r) => ({
        id: r.id,
        kind: 'routine' as const,
        name: r.name,
        subtitle: `${Fmt.count(r.items.length, 'exercise')} · shared by ${by(r.createdBy)}`,
        icon: 'list_alt',
        removable: removable(r.createdBy),
      })),
      ...library.customExercises.map((e) => ({
        id: e.id,
        kind: 'custom' as const,
        name: e.name,
        subtitle: `${trackLabel(e.track)} · made up by ${by(e.createdBy)}`,
        icon: 'edit_note',
        removable: removable(e.createdBy),
      })),
      ...library.entries.map((e) => {
        const exercise = this.state.catalog.byId(e.exerciseId);
        return {
          id: e.exerciseId,
          kind: 'catalog' as const,
          name: exercise?.name ?? e.exerciseId,
          subtitle: `${exercise ? Fmt.pattern(exercise.pattern) : 'Exercise'} · added by ${by(e.addedBy)}`,
          icon: 'star',
          removable: removable(e.addedBy),
        };
      }),
    ];
  });

  protected newExercise(): void {
    this.dialog.open(CustomExerciseDialog, {
      data: this.crateId(),
      width: '440px',
      maxWidth: 'calc(100vw - 32px)',
    });
  }

  protected async remove(row: LibraryRow): Promise<void> {
    const me = this.state.peachId();
    if (!me) return;
    const crateId = this.crateId();
    await this.state.run(
      (app) =>
        row.kind === 'routine'
          ? app.libraryService.removeRoutine(crateId, row.id, me)
          : row.kind === 'custom'
            ? app.libraryService.removeCustomExercise(crateId, row.id, me)
            : app.libraryService.removeCatalogExercise(crateId, row.id, me),
      `Removed ${row.name}.`,
    );
  }
}

function trackLabel(track: string): string {
  return track === 'distance' ? 'Distance & time' : track === 'time' ? 'Timed' : 'Reps';
}
