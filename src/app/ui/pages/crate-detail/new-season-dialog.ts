import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatChipListbox, MatChipOption } from '@angular/material/chips';
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
import { MatSlider, MatSliderThumb } from '@angular/material/slider';

import { addDays, LocalDate } from '../../../domain/core/local-date';
import { Crate } from '../../../domain/models/crate';
import { ExerciseDayPlanner } from '../../../domain/services/round-robin-scheduler';
import { AppState } from '../../../state/app-state';

/** ISO weekdays (Monday = 1) with their chip letter and accessible name. */
const WEEKDAYS = [
  { day: 1, short: 'M', long: 'Monday' },
  { day: 2, short: 'T', long: 'Tuesday' },
  { day: 3, short: 'W', long: 'Wednesday' },
  { day: 4, short: 'T', long: 'Thursday' },
  { day: 5, short: 'F', long: 'Friday' },
  { day: 6, short: 'S', long: 'Saturday' },
  { day: 7, short: 'S', long: 'Sunday' },
] as const;

/** Exercise days for a Season starting tomorrow and running `weeks` weeks. */
export function seasonDays(
  today: LocalDate,
  weekdays: ReadonlySet<number>,
  weeks: number,
): LocalDate[] {
  const start = addDays(today, 1);
  return new ExerciseDayPlanner().weekdaysBetween(start, addDays(start, weeks * 7 - 1), weekdays);
}

/** Picks weekdays and a length; exercise days are derived ahead of time. */
@Component({
  selector: 'pch-new-season-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButton,
    MatChipListbox,
    MatChipOption,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatFormField,
    MatInput,
    MatLabel,
    MatSlider,
    MatSliderThumb,
  ],
  template: `<h2 mat-dialog-title>New Season</h2>
    <mat-dialog-content class="fields">
      <mat-form-field appearance="outline">
        <mat-label>Name</mat-label>
        <input matInput autocomplete="off" [value]="name()" (input)="onName($event)" />
      </mat-form-field>
      <p class="pch-body-large label" id="season-days-label">Exercise days</p>
      <mat-chip-listbox multiple aria-labelledby="season-days-label" class="days">
        @for (w of weekdayOptions; track w.day) {
          <mat-chip-option
            [aria-label]="w.long"
            [selected]="weekdays().has(w.day)"
            (selectionChange)="$event.isUserInput && toggleDay(w.day, $event.selected)"
            >{{ w.short }}</mat-chip-option
          >
        }
      </mat-chip-listbox>
      <p class="pch-body-large label" id="season-length-label">Length: {{ weeks() }} weeks</p>
      <mat-slider min="1" max="12" step="1" discrete>
        <input
          matSliderThumb
          aria-labelledby="season-length-label"
          [value]="weeks()"
          (valueChange)="weeks.set($event)"
        />
      </mat-slider>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close [disabled]="busy()">Cancel</button>
      <button
        matButton="filled"
        type="button"
        [disabled]="busy() || weekdays().size === 0"
        (click)="start()"
      >
        Start
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
    .label {
      margin: 0 0 8px;
    }
    .days {
      margin-bottom: 16px;
    }
    mat-slider {
      margin-inline: 0;
    }
  `,
})
export class NewSeasonDialog {
  private readonly state = inject(AppState);
  private readonly ref = inject(MatDialogRef<NewSeasonDialog>);
  private readonly crate = inject<Crate>(MAT_DIALOG_DATA);

  protected readonly weekdayOptions = WEEKDAYS;

  readonly name = signal('New Season');
  readonly weekdays = signal<ReadonlySet<number>>(new Set([1, 3, 5]));
  readonly weeks = signal(4);
  readonly busy = signal(false);

  protected onName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }

  toggleDay(day: number, on: boolean): void {
    this.weekdays.update((current) => {
      const next = new Set(current);
      if (on) next.add(day);
      else next.delete(day);
      return next;
    });
  }

  async start(): Promise<void> {
    if (this.busy() || this.weekdays().size === 0) return;
    this.busy.set(true);
    const exerciseDays = seasonDays(this.state.today(), this.weekdays(), this.weeks());
    const season = await this.state.run((app) =>
      app.seasonService.createSeason({
        crate: this.crate,
        name: this.name(),
        exerciseDays,
        now: this.state.now(),
      }),
    );
    this.busy.set(false);
    if (season) this.ref.close(season);
  }
}
