import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

export interface ConfirmData {
  readonly title: string;
  readonly message: string;
  /** The confirming button's label, a verb: "Dispute", "Leave". */
  readonly action: string;
}

/** Asks before something that can't be undone. Closes with true to go ahead. */
@Component({
  selector: 'pch-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButton, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle],
  template: `<h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p class="pch-body-medium">{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" [mat-dialog-close]="false">Cancel</button>
      <button matButton="filled" type="button" [mat-dialog-close]="true" cdkFocusInitial>
        {{ data.action }}
      </button>
    </mat-dialog-actions>`,
  styles: `
    p {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmData>(MAT_DIALOG_DATA);
}

/** Opens a {@link ConfirmDialog}; resolves true only if the user confirms. */
export async function confirmDialog(dialog: MatDialog, data: ConfirmData): Promise<boolean> {
  const ref = dialog.open<ConfirmDialog, ConfirmData, boolean>(ConfirmDialog, {
    data,
    width: '360px',
    maxWidth: 'calc(100vw - 32px)',
  });
  return (await firstValueFrom(ref.afterClosed())) === true;
}
