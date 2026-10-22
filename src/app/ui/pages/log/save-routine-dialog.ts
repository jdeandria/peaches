import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';

import { Routine, ROUTINE_NAME_MAX } from '../../../domain/models/routine';

export interface SaveRoutineData {
  /** The Peach's routines: saving under one of their names replaces it. */
  readonly routines: readonly Routine[];
  /** A name to start from. */
  readonly suggestion: string;
}

/** The name to save under, and the routine it replaces, if any. */
export interface SaveRoutineResult {
  readonly name: string;
  readonly replaces: Routine | null;
}

/**
 * Names a session's plan to keep as a routine. Using the name of an
 * existing routine updates that one (and says so).
 */
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
    MatHint,
    MatInput,
    MatLabel,
  ],
  template: `<h2 mat-dialog-title>Save as routine</h2>
    <form (submit)="$event.preventDefault(); done()">
      <mat-dialog-content>
        <p class="pch-body-medium intro">Plan this workout again in one tap.</p>
        <mat-form-field appearance="outline">
          <mat-label>Name</mat-label>
          <input
            matInput
            autocomplete="off"
            cdkFocusInitial
            [attr.maxlength]="max"
            [value]="name()"
            (input)="name.set($any($event.target).value)"
          />
          @if (replaces(); as routine) {
            <mat-hint>Replaces your “{{ routine.name }}” routine</mat-hint>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Cancel</button>
        <button matButton="filled" type="submit" [disabled]="!trimmed()">
          {{ replaces() ? 'Replace' : 'Save' }}
        </button>
      </mat-dialog-actions>
    </form>`,
  styles: `
    .intro {
      margin: 0 0 16px;
      color: var(--mat-sys-on-surface-variant);
    }
    mat-form-field {
      width: 100%;
    }
  `,
})
export class SaveRoutineDialog {
  private readonly ref = inject<MatDialogRef<SaveRoutineDialog, SaveRoutineResult>>(MatDialogRef);
  private readonly data = inject<SaveRoutineData>(MAT_DIALOG_DATA);

  protected readonly max = ROUTINE_NAME_MAX;
  protected readonly name = signal(this.data.suggestion);
  protected readonly trimmed = computed(() => this.name().trim().replace(/\s+/g, ' '));
  protected readonly replaces = computed(() => {
    const name = this.trimmed().toLocaleLowerCase();
    return this.data.routines.find((r) => r.name.toLocaleLowerCase() === name) ?? null;
  });

  done(): void {
    const name = this.trimmed();
    if (name) this.ref.close({ name, replaces: this.replaces() });
  }
}
