import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButton } from '@angular/material/button';
import {
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';

import { AppState } from '../../../state/app-state';

/** "Join a Crate" with an invite code. Stays open (with a toast) on a bad code. */
@Component({
  selector: 'pch-join-crate-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatFormField,
    MatInput,
    MatLabel,
  ],
  template: `<h2 mat-dialog-title>Join a Crate</h2>
    <form (submit)="$event.preventDefault(); join()">
      <mat-dialog-content>
        <mat-form-field appearance="outline">
          <mat-label>Invite code</mat-label>
          <input
            matInput
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
            maxlength="12"
            enterkeyhint="go"
            [value]="code()"
            (input)="onInput($event)"
          />
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close [disabled]="busy()">Cancel</button>
        <button matButton="filled" type="submit" [disabled]="busy()">Join</button>
      </mat-dialog-actions>
    </form>`,
  styles: `
    mat-form-field {
      width: 100%;
    }
    input {
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
  `,
})
export class JoinCrateDialog {
  private readonly state = inject(AppState);
  private readonly router = inject(Router);
  private readonly ref = inject(MatDialogRef<JoinCrateDialog>);

  readonly code = signal('');
  readonly busy = signal(false);

  protected onInput(event: Event): void {
    this.code.set((event.target as HTMLInputElement).value.toUpperCase());
  }

  async join(): Promise<void> {
    const me = this.state.peachId();
    if (!me || this.busy()) return;
    this.busy.set(true);
    const crate = await this.state.run((app) =>
      app.crateService.joinByInviteCode(this.code().trim(), me, this.state.now()),
    );
    this.busy.set(false);
    if (!crate) return;
    this.ref.close(crate);
    await this.router.navigate(['/crates', crate.id]);
  }
}
