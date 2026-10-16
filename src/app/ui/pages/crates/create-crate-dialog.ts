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

import { deviceTimeZone } from '../../../data/tz/intl-zone-clock';
import { AppState } from '../../../state/app-state';

/**
 * "New Crate": a name and a description. What counts for points is up to
 * the members, who vote once they're in.
 */
@Component({
  selector: 'pch-create-crate-dialog',
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
  template: `<h2 mat-dialog-title>New Crate</h2>
    <mat-dialog-content class="fields">
      <mat-form-field appearance="outline">
        <mat-label>Name</mat-label>
        <input
          matInput
          autocomplete="off"
          autocapitalize="words"
          [value]="name()"
          (input)="name.set(inputValue($event))"
        />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Description</mat-label>
        <input
          matInput
          autocomplete="off"
          [value]="description()"
          (input)="description.set(inputValue($event))"
        />
      </mat-form-field>
      <p class="pch-body-medium hint">
        Every workout members log earns points here. Once your Crate is set up, members vote on what
        each kind of training is worth.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close [disabled]="busy()">Cancel</button>
      <button matButton="filled" type="button" [disabled]="busy()" (click)="create()">
        Create
      </button>
    </mat-dialog-actions>`,
  styles: `
    mat-dialog-content {
      display: flex;
      flex-direction: column;
    }
    /* Room for the first outlined field's floating label. */
    .fields.mat-mdc-dialog-content {
      padding-top: 8px;
    }
    .hint {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class CreateCrateDialog {
  private readonly state = inject(AppState);
  private readonly router = inject(Router);
  private readonly ref = inject(MatDialogRef<CreateCrateDialog>);

  readonly name = signal('');
  readonly description = signal('');
  readonly busy = signal(false);

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  async create(): Promise<void> {
    const me = this.state.peachId();
    if (!me || this.busy()) return;
    this.busy.set(true);
    const crate = await this.state.run((app) =>
      app.crateService.createCrate({
        ownerPeachId: me,
        name: this.name(),
        description: this.description(),
        now: this.state.now(),
        timeZone: deviceTimeZone(),
      }),
    );
    this.busy.set(false);
    if (!crate) return;
    this.ref.close(crate);
    await this.router.navigate(['/crates', crate.id]);
  }
}
