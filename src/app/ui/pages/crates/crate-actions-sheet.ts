import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';

import { ShapedAvatar } from '../../expressive/shaped-avatar';
import { ListRow } from '../../layout/list-row';

export type CrateAction = 'create' | 'join';

/** The "Add a Crate" bottom sheet; dismisses with the chosen action. */
@Component({
  selector: 'pch-crate-actions-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ListRow, ShapedAvatar],
  template: `<h2 class="pch-title-large">Add a Crate</h2>
    <button pch-list-row type="button" (click)="choose('create')">
      <pch-shaped-avatar rowLeading>
        <span class="material-symbols-rounded" aria-hidden="true">add</span>
      </pch-shaped-avatar>
      Create a Crate
      <span rowSubtitle>Start a group and invite your Peaches</span>
    </button>
    <button pch-list-row type="button" (click)="choose('join')">
      <pch-shaped-avatar rowLeading>
        <span class="material-symbols-rounded" aria-hidden="true">key</span>
      </pch-shaped-avatar>
      Join with invite code
      <span rowSubtitle>Got a six-letter code from a friend?</span>
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
  `,
})
export class CrateActionsSheet {
  private readonly ref =
    inject<MatBottomSheetRef<CrateActionsSheet, CrateAction>>(MatBottomSheetRef);

  protected choose(action: CrateAction): void {
    this.ref.dismiss(action);
  }
}
