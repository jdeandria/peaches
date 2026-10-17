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
import { MatFormField, MatHint, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';

import { MAX_SESSION_SECONDS } from '../../../application/logging-service';
import { WorkoutLog } from '../../../domain/models/workout-log';

export interface LogDetailsData {
  readonly log: WorkoutLog;
}

export interface LogDetailsResult {
  readonly startedAt: Date;
  readonly durationSeconds: number;
  readonly notes: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Corrects a finished workout: when it started (which decides the week it
 * counts toward), how long it took (active minutes) and notes. Times are in
 * the device's zone.
 */
@Component({
  selector: 'pch-log-details-dialog',
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
  template: `<h2 mat-dialog-title>Edit workout</h2>
    <form (submit)="$event.preventDefault(); done()">
      <mat-dialog-content class="fields">
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Date</mat-label>
            <input
              matInput
              type="date"
              [value]="date()"
              (input)="date.set($any($event.target).value)"
            />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Started</mat-label>
            <input
              matInput
              type="time"
              [value]="time()"
              (input)="time.set($any($event.target).value)"
            />
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline">
          <mat-label>Session time</mat-label>
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
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Cancel</button>
        <button matButton="filled" type="submit" [disabled]="!result()">Save</button>
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
    .row {
      display: flex;
      gap: 8px;
    }
    .row mat-form-field {
      flex: 1;
      min-width: 0;
    }
  `,
})
export class LogDetailsDialog {
  private readonly ref = inject<MatDialogRef<LogDetailsDialog, LogDetailsResult>>(MatDialogRef);
  private readonly log = inject<LogDetailsData>(MAT_DIALOG_DATA).log;

  private readonly start = this.log.startedAt;
  readonly date = signal(
    `${this.start.getFullYear()}-${pad(this.start.getMonth() + 1)}-${pad(this.start.getDate())}`,
  );
  readonly time = signal(`${pad(this.start.getHours())}:${pad(this.start.getMinutes())}`);
  readonly minutes = signal(String(Math.round(this.log.durationSeconds / 60)));
  readonly notes = signal(this.log.notes ?? '');

  /** The edited details, or null while something is invalid. */
  protected readonly result = computed<LogDetailsResult | null>(() => {
    const startedAt = new Date(`${this.date()}T${this.time()}`);
    const text = this.minutes().trim();
    if (Number.isNaN(startedAt.getTime()) || !/^\d+$/.test(text)) return null;
    // Unchanged minutes keep the clock's seconds.
    const unchanged = Number(text) === Math.round(this.log.durationSeconds / 60);
    const durationSeconds = unchanged ? this.log.durationSeconds : Number(text) * 60;
    if (durationSeconds > MAX_SESSION_SECONDS) return null;
    // Unchanged date and time keep the original seconds too.
    const sameMinute =
      Math.floor(startedAt.getTime() / 60_000) === Math.floor(this.start.getTime() / 60_000);
    return {
      startedAt: sameMinute ? this.start : startedAt,
      durationSeconds,
      notes: this.notes(),
    };
  });

  done(): void {
    const result = this.result();
    if (result) this.ref.close(result);
  }
}
