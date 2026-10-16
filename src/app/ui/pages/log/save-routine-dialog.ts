import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';

import { Crate } from '../../../domain/models/crate';
import { Routine } from '../../../domain/models/library';
import { WorkoutLog } from '../../../domain/models/workout-log';
import { AppState } from '../../../state/app-state';

export interface SaveRoutineData {
  readonly log: WorkoutLog;
  readonly crates: readonly Crate[];
}

/** Shares a logged workout with one of the Peach's Crates as a named routine. */
@Component({
  selector: 'pch-save-routine-dialog',
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
    MatOption,
    MatSelect,
  ],
  template: `<h2 mat-dialog-title>Share as a routine</h2>
    <form (submit)="$event.preventDefault(); save()">
      <mat-dialog-content class="fields">
        <mat-form-field appearance="outline">
          <mat-label>Routine name</mat-label>
          <input
            matInput
            autocomplete="off"
            [value]="name()"
            (input)="name.set($any($event.target).value)"
          />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Crate</mat-label>
          <mat-select [value]="crateId()" (selectionChange)="crateId.set($event.value)">
            @for (c of data.crates; track c.id) {
              <mat-option [value]="c.id">{{ c.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <p class="pch-body-medium muted">
          Crate-mates can start a workout from it. It stays inside the Crate.
        </p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close [disabled]="busy()">Cancel</button>
        <button matButton="filled" type="submit" [disabled]="busy() || !crateId()">Share</button>
      </mat-dialog-actions>
    </form>`,
  styles: `
    mat-dialog-content {
      display: flex;
      flex-direction: column;
    }
    .fields.mat-mdc-dialog-content {
      padding-top: 8px;
    }
    p {
      margin: 0;
    }
    .muted {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class SaveRoutineDialog {
  private readonly state = inject(AppState);
  private readonly ref = inject<MatDialogRef<SaveRoutineDialog, Routine>>(MatDialogRef);
  protected readonly data = inject<SaveRoutineData>(MAT_DIALOG_DATA);

  readonly name = signal('');
  readonly crateId = signal<string | null>(this.data.crates[0]?.id ?? null);
  readonly busy = signal(false);

  async save(): Promise<void> {
    const crateId = this.crateId();
    if (this.busy() || !crateId) return;
    this.busy.set(true);
    const routine = await this.state.run(
      (app) =>
        app.libraryService.saveLogAsRoutine({
          crateId,
          log: this.data.log,
          name: this.name(),
          now: this.state.now(),
        }),
      'Routine shared with your Crate.',
    );
    this.busy.set(false);
    if (routine) this.ref.close(routine);
  }
}
