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
import { MatFormField, MatHint, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';

import { MAX_SESSION_MINUTES } from '../../../application/logging-service';

export interface SubmitLogData {
  /** A starting guess for the session length. */
  readonly minutes: number;
  /** How many Crates the log will count in. */
  readonly crateCount: number;
}

export interface SubmitLogResult {
  readonly durationMinutes: number | null;
  readonly notes: string;
}

/** Suggests a session length from when the log was started: 5..180, to the nearest 5. */
export function suggestedMinutes(startedAt: Date, now: Date): number {
  const minutes = (now.getTime() - startedAt.getTime()) / 60_000;
  return Math.min(180, Math.max(5, Math.round(minutes / 5) * 5));
}

/** Confirms a submit: how long the whole session took, and an optional note. */
@Component({
  selector: 'pch-submit-log-dialog',
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
    MatSuffix,
  ],
  template: `<h2 mat-dialog-title>Finish workout</h2>
    <form (submit)="$event.preventDefault(); done()">
      <mat-dialog-content class="fields">
        <mat-form-field appearance="outline">
          <mat-label>Session length</mat-label>
          <input
            matInput
            inputmode="numeric"
            autocomplete="off"
            [value]="minutes()"
            (input)="minutes.set($any($event.target).value)"
          />
          <span matTextSuffix>min</span>
          <mat-hint>Counts toward active minutes</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Notes</mat-label>
          <input
            matInput
            autocomplete="off"
            [value]="notes()"
            (input)="notes.set($any($event.target).value)"
          />
        </mat-form-field>
        <p class="pch-body-medium muted">{{ sharing }}</p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Keep going</button>
        <button matButton="filled" type="submit" [disabled]="!valid()">Submit</button>
      </mat-dialog-actions>
    </form>`,
  styles: `
    mat-dialog-content {
      display: flex;
      flex-direction: column;
      gap: 8px;
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
export class SubmitLogDialog {
  private readonly ref = inject<MatDialogRef<SubmitLogDialog, SubmitLogResult>>(MatDialogRef);
  private readonly data = inject<SubmitLogData>(MAT_DIALOG_DATA);

  readonly minutes = signal(String(this.data.minutes));
  readonly notes = signal('');

  protected readonly sharing =
    this.data.crateCount === 0
      ? 'Join a Crate to score points with your workouts.'
      : `Shared with ${this.data.crateCount === 1 ? 'your Crate' : `your ${this.data.crateCount} Crates`}, where it scores toward this week’s matchups.`;

  /** Blank is allowed (no session length); otherwise whole minutes up to the cap. */
  protected valid(): boolean {
    const text = this.minutes().trim();
    return text === '' || (/^\d+$/.test(text) && Number(text) <= MAX_SESSION_MINUTES);
  }

  done(): void {
    if (!this.valid()) return;
    const text = this.minutes().trim();
    this.ref.close({
      durationMinutes: text === '' ? null : Number(text),
      notes: this.notes().trim(),
    });
  }
}
