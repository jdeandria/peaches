import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatFabButton } from '@angular/material/button';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';

import { AppState } from '../../../state/app-state';
import { LoadingIndicator } from '../../expressive/loading-indicator';
import { Fmt } from '../../format';
import { EmptyState } from '../../layout/empty-state';
import { Page } from '../../layout/page';
import { Stagger } from '../../layout/stagger';
import { CrateActionsSheet, CrateAction } from './crate-actions-sheet';
import { CrateCard } from './crate-card';
import { CreateCrateDialog } from './create-crate-dialog';
import { JoinCrateDialog } from './join-crate-dialog';

/** The Crates the current Peach belongs to, with create / join actions. */
@Component({
  selector: 'pch-crates-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Page, EmptyState, LoadingIndicator, Stagger, CrateCard, MatFabButton],
  template: `<pch-page title="Crates" [subtitle]="subtitle()" [maxWidth]="1040">
    @let list = crates();
    @if (list === undefined) {
      <pch-loading-indicator class="loading" [size]="40" />
    } @else if (list.length === 0) {
      <pch-empty-state
        icon="inventory_2"
        title="No Crates yet"
        message="Create a Crate or join one with an invite code."
      />
    } @else {
      <div class="grid">
        @for (c of list; track c.id; let i = $index) {
          <pch-crate-card [crate]="c" [pchStagger]="i" />
        }
      </div>
    }
    <button pageFab matFab extended type="button" (click)="openActions()">
      <span class="material-symbols-rounded" aria-hidden="true">add</span>
      New Crate
    </button>
  </pch-page>`,
  styles: `
    .grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
      padding-bottom: 96px;
    }
    .loading {
      display: flex;
      margin: 48px auto;
    }
  `,
})
export class CratesPage {
  private readonly state = inject(AppState);
  private readonly sheet = inject(MatBottomSheet);
  private readonly dialog = inject(MatDialog);

  protected readonly crates = computed(() => this.state.myCrates.value());

  protected readonly subtitle = computed(() => {
    const list = this.crates();
    if (list === undefined) return undefined;
    return list.length === 0
      ? 'Train together, compete together.'
      : Fmt.count(list.length, 'Crate');
  });

  /** Opens the "Add a Crate" sheet; the chosen option opens its dialog once the sheet is gone. */
  protected openActions(): void {
    this.sheet
      .open<CrateActionsSheet, void, CrateAction>(CrateActionsSheet, { ariaLabel: 'Add a Crate' })
      .afterDismissed()
      .subscribe((action) => {
        if (action === 'create') {
          this.dialog.open(CreateCrateDialog, { width: '560px', maxWidth: 'calc(100vw - 32px)' });
        } else if (action === 'join') {
          this.dialog.open(JoinCrateDialog, { width: '400px', maxWidth: 'calc(100vw - 32px)' });
        }
      });
  }
}
