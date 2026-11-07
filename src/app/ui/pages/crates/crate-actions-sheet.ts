import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';

import { Crate } from '../../../domain/models/crate';
import { ShapedAvatar } from '../../expressive/shaped-avatar';
import { ListRow } from '../../layout/list-row';

/** A Crate's id to open it, or one of the two ways to add a Crate. */
export type CrateAction = 'create' | 'join' | (string & {});

export interface CrateSheetData {
  readonly crates: readonly Crate[];
  /** The Crate on screen, ticked. */
  readonly current: string | null;
}

/** The Crates sheet: switch to another Crate, or create or join one. Dismisses with the choice. */
@Component({
  selector: 'pch-crate-actions-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ListRow, ShapedAvatar],
  template: `<h2 class="pch-title-large">Your Crates</h2>
    @for (c of data.crates; track c.id) {
      @let on = c.id === data.current;
      <button
        pch-list-row
        type="button"
        [attr.aria-current]="on ? 'page' : null"
        (click)="choose(c.id)"
      >
        <pch-shaped-avatar rowLeading [shapeId]="c.id" [name]="c.name" />
        {{ c.name }}
        @if (on) {
          <span rowTrailing class="material-symbols-rounded check" aria-hidden="true">check</span>
        }
      </button>
    }
    <button pch-list-row type="button" (click)="choose('create')">
      <pch-shaped-avatar rowLeading color="surface-container-high" foreground="primary">
        <span class="material-symbols-rounded" aria-hidden="true">add</span>
      </pch-shaped-avatar>
      Create a Crate
    </button>
    <button pch-list-row type="button" (click)="choose('join')">
      <pch-shaped-avatar rowLeading color="surface-container-high" foreground="primary">
        <span class="material-symbols-rounded" aria-hidden="true">key</span>
      </pch-shaped-avatar>
      Join with invite code
    </button>`,
  styles: `
    :host {
      display: block;
      padding-bottom: 16px;
    }
    h2 {
      margin: 0;
      padding: 0 8px 8px;
    }
    button {
      border-radius: var(--pch-radius-large);
    }
    .check {
      color: var(--mat-sys-primary);
    }
  `,
})
export class CrateActionsSheet {
  private readonly ref =
    inject<MatBottomSheetRef<CrateActionsSheet, CrateAction>>(MatBottomSheetRef);
  protected readonly data = inject<CrateSheetData | null>(MAT_BOTTOM_SHEET_DATA, {
    optional: true,
  }) ?? { crates: [], current: null };

  protected choose(action: CrateAction): void {
    this.ref.dismiss(action);
  }
}
